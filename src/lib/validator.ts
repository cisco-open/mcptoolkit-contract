// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Schema validator for dump and diff files
 */

import { readFile } from 'node:fs/promises';
import { parse as yamlParse } from 'yaml';
import AjvModule from 'ajv';
import type { ValidateFunction, ErrorObject } from 'ajv';
import addFormatsModule from 'ajv-formats';

const Ajv = (AjvModule as any).default || AjvModule;
const addFormats = (addFormatsModule as any).default || addFormatsModule;

export type SchemaType = 'mcpdesc' | 'mcp-description' | 'diff' | 'diff-breaking' | 'dump-split';

/**
 * Auto-detect schema type from parsed data by inspecting top-level keys.
 * Returns undefined if the format cannot be determined.
 */
export function detectSchemaType(data: unknown): SchemaType | undefined {
  if (typeof data !== 'object' || data === null) return undefined;
  const obj = data as Record<string, unknown>;

  // mcpdesc: has top-level "mcpdesc" version key
  if ('mcpdesc' in obj) return 'mcpdesc';

  // split-config: has "categories" array (+ often "schemaVersion")
  if (Array.isArray(obj.categories)) return 'dump-split';

  // diff-breaking: has "versioningSuggestion" or "rulesApplied"
  if ('versioningSuggestion' in obj || 'rulesApplied' in obj) return 'diff-breaking';

  // diff: has "comparison" and "statistics"
  if ('comparison' in obj && 'statistics' in obj) return 'diff';

  return undefined;
}

export interface ValidationResult {
  valid: boolean;
  file: string;
  schemaType: SchemaType;
  schemaVersion?: string;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface ValidationIssue {
  path: string;
  message: string;
  keyword?: string;
  params?: Record<string, unknown>;
}

export class Validator {
  private ajv: any;
  private validators: Map<string, ValidateFunction> = new Map();
  private latestVersions?: Record<string, string>;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false,
      // Allow formats to pass even if they don't match exactly (e.g., URI templates)
      validateFormats: false,
    });
    addFormats(this.ajv);
  }

  /**
   * Load latest versions map
   */
  private async getLatestVersions(): Promise<Record<string, string>> {
    if (this.latestVersions) {
      return this.latestVersions;
    }

    const latestMapPath = new URL('../../schemas/latest.json', import.meta.url).pathname;
    const content = await readFile(latestMapPath, 'utf-8');
    const parsed = JSON.parse(content);
    this.latestVersions = parsed;
    return parsed;
  }

  /**
   * Get schema directory name for a given type
   */
  private getSchemaDirectory(schemaType: SchemaType): string {
    switch (schemaType) {
      case 'mcpdesc':
      case 'mcp-description':
        return 'mcp-description';
      case 'diff':
        return 'diff';
      case 'diff-breaking':
        return 'diff-breaking';
      case 'dump-split':
        return 'split-config';
      default:
        throw new Error(`Unknown schema type: ${schemaType}`);
    }
  }

  /**
   * Load and compile a schema with optional version
   */
  private async loadSchema(schemaType: SchemaType, version?: string): Promise<ValidateFunction> {
    // Resolve version
    let schemaVersion = version;
    if (!schemaVersion) {
      const latest = await this.getLatestVersions();
      const dir = this.getSchemaDirectory(schemaType);
      schemaVersion = latest[dir] || latest[schemaType];
      if (!schemaVersion) {
        throw new Error(`No version mapping found for schema type: ${schemaType}`);
      }
    }

    // Check cache with version key
    const cacheKey = `${schemaType}@${schemaVersion}`;
    if (this.validators.has(cacheKey)) {
      return this.validators.get(cacheKey)!;
    }

    // Construct versioned schema path
    const dir = this.getSchemaDirectory(schemaType);
    const schemaPath = new URL(`../../schemas/${dir}/${schemaVersion}.json`, import.meta.url).pathname;
    
    // Load and parse schema
    const schemaContent = await readFile(schemaPath, 'utf-8');
    const schema = JSON.parse(schemaContent);

    // Compile schema
    const validate = this.ajv.compile(schema);
    this.validators.set(cacheKey, validate);

    return validate;
  }

  /**
   * Extract schema version from data
   */
  private extractSchemaVersion(data: unknown, schemaType: SchemaType): string | undefined {
    if ((schemaType === 'mcpdesc' || schemaType === 'mcp-description') && typeof data === 'object' && data !== null) {
      const desc = data as any;
      if (desc.mcpdesc && typeof desc.mcpdesc === 'string') {
        return desc.mcpdesc;
      }
    }
    // Add other schema types as needed
    return undefined;
  }

  /**
   * Validate a file against a schema
   */
  async validateFile(
    filePath: string,
    schemaType: SchemaType
  ): Promise<ValidationResult> {
    // Load and parse file
    const fileContent = await readFile(filePath, 'utf-8');
    
    // Auto-detect format and parse
    let data: unknown;
    try {
      // Try JSON first
      data = JSON.parse(fileContent);
    } catch {
      // If JSON fails, try YAML
      try {
        data = yamlParse(fileContent);
      } catch (yamlError) {
        throw new Error(`Failed to parse file as JSON or YAML: ${(yamlError as Error).message}`);
      }
    }

    return this.validateData(data, schemaType, filePath);
  }

  /**
   * Validate data against a schema
   */
  async validateData(
    data: unknown,
    schemaType: SchemaType,
    fileName: string = 'data'
  ): Promise<ValidationResult> {
    // Auto-detect schema version from data
    const detectedVersion = this.extractSchemaVersion(data, schemaType);
    let usedVersion: string | undefined;
    let versionFallback = false;

    // Try to load version-specific schema
    let validate: ValidateFunction;
    if (detectedVersion) {
      try {
        validate = await this.loadSchema(schemaType, detectedVersion);
        usedVersion = detectedVersion;
      } catch (err) {
        // Version not found, fall back to latest
        console.warn(`⚠️  Schema version ${detectedVersion} not found, using latest`);
        validate = await this.loadSchema(schemaType);
        versionFallback = true;
        const latest = await this.getLatestVersions();
        const dir = this.getSchemaDirectory(schemaType);
        usedVersion = latest[dir] || latest[schemaType];
      }
    } else {
      // No version detected, use latest
      validate = await this.loadSchema(schemaType);
      const latest = await this.getLatestVersions();
      const dir = this.getSchemaDirectory(schemaType);
      usedVersion = latest[dir] || latest[schemaType];
    }

    // Perform validation
    const valid = validate(data);

    // Extract errors
    const errors: ValidationIssue[] = [];
    if (!valid && validate.errors) {
      for (const error of validate.errors) {
        errors.push(this.formatAjvError(error));
      }
    }

    // Perform semantic validation
    const warnings = this.performSemanticValidation(data, schemaType);

    // Add warning if version fallback occurred
    if (versionFallback && detectedVersion) {
      warnings.unshift({
        path: '/version',
        message: `File declares schema version ${detectedVersion} which is not available. Validated against ${usedVersion} instead. Consider regenerating with current CLI.`,
      });
    }

    return {
      valid,
      file: fileName,
      schemaType,
      schemaVersion: usedVersion,
      errors,
      warnings,
    };
  }

  /**
   * Format Ajv error into ValidationIssue
   */
  private formatAjvError(error: ErrorObject): ValidationIssue {
    let path = error.instancePath || '/';
    let message = error.message || 'Validation error';

    // Enhance message based on keyword
    switch (error.keyword) {
      case 'required':
        message = `Missing required property: ${error.params.missingProperty}`;
        break;
      case 'type':
        message = `Invalid type: expected ${error.params.type}`;
        break;
      case 'enum':
        message = `Invalid value: must be one of ${JSON.stringify(error.params.allowedValues)}`;
        break;
      case 'pattern':
        message = `Does not match pattern: ${error.params.pattern}`;
        break;
      case 'format':
        message = `Invalid format: expected ${error.params.format}`;
        break;
      case 'minLength':
        message = `Too short: minimum length is ${error.params.limit}`;
        break;
      case 'maxLength':
        message = `Too long: maximum length is ${error.params.limit}`;
        break;
      case 'minimum':
        message = `Too small: minimum value is ${error.params.limit}`;
        break;
      case 'maximum':
        message = `Too large: maximum value is ${error.params.limit}`;
        break;
      case 'additionalProperties':
        message = `Additional property not allowed: ${error.params.additionalProperty}`;
        break;
      default:
        message = error.message || 'Validation error';
    }

    return {
      path,
      message,
      keyword: error.keyword,
      params: error.params,
    };
  }

  /**
   * Perform semantic validation beyond JSON Schema
   */
  private performSemanticValidation(
    _data: unknown,
    _schemaType: SchemaType
  ): ValidationIssue[] {
    const warnings: ValidationIssue[] = [];

    return warnings;
  }
}

/**
 * Error thrown when validation fails
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public result: ValidationResult
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}
