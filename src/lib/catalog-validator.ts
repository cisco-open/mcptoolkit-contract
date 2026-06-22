// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Catalog Validator
 * 
 * Validates catalog entries against schema and checks completeness.
 * Ensures all rules in rules files have corresponding catalog documentation.
 */

import AjvModule from 'ajv';
import type { ValidateFunction } from 'ajv';
import addFormatsModule from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';
import { fileURLToPath } from 'url';

const Ajv = (AjvModule as any).default || AjvModule;
const addFormats = (addFormatsModule as any).default || addFormatsModule;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface CatalogEntry {
  changeType: string;
  category: 'tools' | 'prompts' | 'resources' | 'resourceTemplates' | 'serverInfo';
  version: string;
  introduced: string;
  rulesFile?: string;
  title: string;
  description: string;
  variants: CatalogVariant[];
  relatedRules?: string[];
  references?: Array<{ title: string; url?: string }>;
  tags?: string[];
}

export interface CatalogVariant {
  id: string;
  breaking: boolean;
  severity: 'info' | 'major' | 'critical';
  message: string;
  rationale: string;
  migration?: string | null;
  conditions?: Array<{
    field: string;
    operator: string;
    value: any;
  }>;
  examples: {
    pass: CatalogExample[];
    fail?: CatalogExample[];
  };
}

export interface CatalogExample {
  name: string;
  description: string;
  change: {
    id: string;
    category: string;
    changeType: string;
    path: string;
    description: string;
    from?: any;
    to?: any;
  };
  expectedResult: {
    breaking?: boolean;
    severity?: string;
    ruleMessage?: string;
    matchesThisVariant?: boolean;
  };
}

export interface RulesFile {
  version: string;
  description?: string;
  rules: {
    [category: string]: Array<{
      changeType: string;
      breaking: boolean;
      severity: string;
      message: string;
      rationale?: string;
      migration?: string;
      conditions?: any[];
    }>;
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type: 'schema' | 'completeness' | 'consistency';
  file: string;
  message: string;
  details?: any;
}

export interface ValidationWarning {
  type: 'coverage' | 'duplication' | 'outdated';
  file: string;
  message: string;
}

export class CatalogValidator {
  private ajv: any;
  private catalogSchemaValidator: ValidateFunction | null = null;

  constructor() {
    this.ajv = new Ajv({ 
      allErrors: true, 
      verbose: true,
      strict: false 
    });
    addFormats(this.ajv);
  }

  /**
   * Load and compile the catalog schema
   */
  async loadSchema(): Promise<void> {
    const schemaPath = path.join(__dirname, '../../rules/catalog/catalog-schema.json');
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    const schema = JSON.parse(schemaContent);
    
    this.catalogSchemaValidator = this.ajv.compile(schema);
  }

  /**
   * Validate a single catalog entry file
   */
  validateCatalogEntry(filePath: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Load catalog entry
      const content = fs.readFileSync(filePath, 'utf-8');
      const entry: CatalogEntry = YAML.parse(content);

      // Validate against schema
      if (!this.catalogSchemaValidator) {
        throw new Error('Schema not loaded. Call loadSchema() first.');
      }

      const valid = this.catalogSchemaValidator(entry);
      
      if (!valid && this.catalogSchemaValidator.errors) {
        errors.push({
          type: 'schema',
          file: filePath,
          message: 'Schema validation failed',
          details: this.catalogSchemaValidator.errors
        });
      }

      // Validate internal consistency
      this.validateInternalConsistency(entry, filePath, errors, warnings);

    } catch (error: any) {
      errors.push({
        type: 'schema',
        file: filePath,
        message: `Failed to parse catalog entry: ${error.message}`
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate all catalog entries in a directory
   */
  validateCatalogDirectory(catalogDir: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!fs.existsSync(catalogDir)) {
      errors.push({
        type: 'completeness',
        file: catalogDir,
        message: 'Catalog directory does not exist'
      });
      return { valid: false, errors, warnings };
    }

    // Find all YAML files recursively
    const catalogFiles = this.findCatalogFiles(catalogDir);

    for (const filePath of catalogFiles) {
      const result = this.validateCatalogEntry(filePath);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate completeness: check if all rules have catalog entries
   */
  validateCompleteness(rulesFilePath: string, catalogDir: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Load rules file
      const rulesContent = fs.readFileSync(rulesFilePath, 'utf-8');
      const rulesFile: RulesFile = YAML.parse(rulesContent);

      // Collect all changeTypes from rules
      const ruleChangeTypes = new Set<string>();
      for (const rules of Object.values(rulesFile.rules)) {
        for (const rule of rules) {
          ruleChangeTypes.add(rule.changeType);
        }
      }

      // Collect all changeTypes from catalog
      const catalogFiles = this.findCatalogFiles(catalogDir);
      const catalogChangeTypes = new Set<string>();
      
      for (const filePath of catalogFiles) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const entry: CatalogEntry = YAML.parse(content);
          catalogChangeTypes.add(entry.changeType);
        } catch (error: any) {
          errors.push({
            type: 'schema',
            file: filePath,
            message: `Failed to parse catalog entry: ${error.message}`
          });
        }
      }

      // Check for missing catalog entries
      for (const changeType of ruleChangeTypes) {
        if (!catalogChangeTypes.has(changeType)) {
          warnings.push({
            type: 'coverage',
            file: rulesFilePath,
            message: `Rule '${changeType}' has no catalog entry`
          });
        }
      }

      // Check for orphaned catalog entries
      for (const changeType of catalogChangeTypes) {
        if (!ruleChangeTypes.has(changeType)) {
          warnings.push({
            type: 'coverage',
            file: catalogDir,
            message: `Catalog entry '${changeType}' has no corresponding rule in ${rulesFilePath}`
          });
        }
      }

    } catch (error: any) {
      errors.push({
        type: 'completeness',
        file: rulesFilePath,
        message: `Failed to load rules file: ${error.message}`
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate that catalog entry matches its corresponding rules
   */
  validateConsistency(catalogEntry: CatalogEntry, rulesFile: RulesFile): ValidationError[] {
    const errors: ValidationError[] = [];

    // Find matching rules
    const matchingRules: any[] = [];
    for (const [category, rules] of Object.entries(rulesFile.rules)) {
      for (const rule of rules) {
        if (rule.changeType === catalogEntry.changeType) {
          matchingRules.push({ ...rule, category });
        }
      }
    }

    if (matchingRules.length === 0) {
      errors.push({
        type: 'consistency',
        file: catalogEntry.changeType,
        message: `No rules found for changeType '${catalogEntry.changeType}'`
      });
      return errors;
    }

    // Check variant count matches
    if (catalogEntry.variants.length !== matchingRules.length) {
      errors.push({
        type: 'consistency',
        file: catalogEntry.changeType,
        message: `Variant count mismatch: catalog has ${catalogEntry.variants.length}, rules has ${matchingRules.length}`
      });
    }

    // Validate each variant matches a rule
    for (const variant of catalogEntry.variants) {
      const matchingRule = matchingRules.find(r => 
        r.breaking === variant.breaking &&
        r.severity === variant.severity &&
        r.message === variant.message
      );

      if (!matchingRule) {
        errors.push({
          type: 'consistency',
          file: catalogEntry.changeType,
          message: `Variant '${variant.id}' does not match any rule in rules file`,
          details: { variant }
        });
      }
    }

    return errors;
  }

  /**
   * Validate internal consistency of catalog entry
   */
  private validateInternalConsistency(
    entry: CatalogEntry,
    filePath: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Check that all examples have correct changeType
    for (const variant of entry.variants) {
      const allExamples = [
        ...variant.examples.pass,
        ...(variant.examples.fail || [])
      ];

      for (const example of allExamples) {
        if (example.change.changeType !== entry.changeType) {
          errors.push({
            type: 'consistency',
            file: filePath,
            message: `Example '${example.name}' has changeType '${example.change.changeType}' but entry expects '${entry.changeType}'`
          });
        }

        if (example.change.category !== entry.category) {
          errors.push({
            type: 'consistency',
            file: filePath,
            message: `Example '${example.name}' has category '${example.change.category}' but entry expects '${entry.category}'`
          });
        }
      }
    }

    // Check for duplicate variant IDs
    const variantIds = new Set<string>();
    for (const variant of entry.variants) {
      if (variantIds.has(variant.id)) {
        errors.push({
          type: 'consistency',
          file: filePath,
          message: `Duplicate variant ID: '${variant.id}'`
        });
      }
      variantIds.add(variant.id);
    }

    // Check for duplicate example names within variants
    for (const variant of entry.variants) {
      const exampleNames = new Set<string>();
      const allExamples = [
        ...variant.examples.pass,
        ...(variant.examples.fail || [])
      ];

      for (const example of allExamples) {
        if (exampleNames.has(example.name)) {
          warnings.push({
            type: 'duplication',
            file: filePath,
            message: `Duplicate example name in variant '${variant.id}': '${example.name}'`
          });
        }
        exampleNames.add(example.name);
      }
    }
  }

  /**
   * Find all catalog YAML files in directory
   */
  private findCatalogFiles(dir: string): string[] {
    const files: string[] = [];

    if (!fs.existsSync(dir)) {
      return files;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        files.push(...this.findCatalogFiles(fullPath));
      } else if (entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml'))) {
        // Skip schema files
        if (!entry.name.includes('schema')) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }

  /**
   * Format validation results for display
   */
  formatResults(result: ValidationResult): string {
    const lines: string[] = [];

    if (result.valid) {
      lines.push('✓ Validation passed');
    } else {
      lines.push('✗ Validation failed');
    }

    if (result.errors.length > 0) {
      lines.push('\nErrors:');
      for (const error of result.errors) {
        lines.push(`  [${error.type}] ${error.file}`);
        lines.push(`    ${error.message}`);
        if (error.details) {
          lines.push(`    Details: ${JSON.stringify(error.details, null, 2)}`);
        }
      }
    }

    if (result.warnings.length > 0) {
      lines.push('\nWarnings:');
      for (const warning of result.warnings) {
        lines.push(`  [${warning.type}] ${warning.file}`);
        lines.push(`    ${warning.message}`);
      }
    }

    return lines.join('\n');
  }
}
