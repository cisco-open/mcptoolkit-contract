// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Validate command - Validate files against MCP schemas
 */

import { Command } from 'commander';
import { writeFile, readFile } from 'node:fs/promises';
import { Validator, ValidationError, detectSchemaType, type SchemaType, type ValidationResult } from '../lib/validator.js';

interface ValidateCommandOptions {
  schema?: SchemaType;
  strict?: boolean;
  format?: 'text' | 'json';
  output?: string;
  showCompatibility?: boolean;
  display?: 'short' | 'full';
}

interface CompatibilityEntry {
  cliVersion: string;
  releaseDate: string;
  schemas: Record<string, string>;
  notes?: string;
}

interface CompatibilityData {
  compatibility: CompatibilityEntry[];
}

export function validateCommand(): Command {
  const cmd = new Command('validate');

  cmd
  .description('Validate an MCP description, diff, or split configuration against their specification schemas')
  .argument('[file]', 'Path to file to validate (omit when using --show-compatibility)')
  .option('--schema <type>', 'Schema type (auto-detected if omitted): mcpdesc (or mcp-description), diff, diff-breaking, or dump-split')
    .option('--strict', 'Treat warnings as errors', false)
    .option('-f, --format <format>', 'Output format: text or json', 'text')
    .option('-o, --output <path>', 'Write validation report to file')
    .option('--show-compatibility', 'Display schema-CLI compatibility matrix and exit')
    .option('--display <mode>', 'Display mode for compatibility: short (changes only) or full (all versions)', 'short')
    .action(async (file: string | undefined, options: ValidateCommandOptions) => {
      try {
        // Handle compatibility display
        if (options.showCompatibility) {
          await displayCompatibility(options);
          return;
        }

        // Regular validation requires file and schema
        if (!file) {
          console.error('❌ Error: file argument is required for validation');
          console.error('   Use --show-compatibility to display version compatibility matrix');
          process.exit(2);
        }

        await validateFile(file, options);
      } catch (error) {
        if (error instanceof ValidationError) {
          console.error(`\n❌ Validation Failed`);
          if (options.format === 'text') {
            printValidationResult(error.result, options.strict || false);
          } else {
            console.log(JSON.stringify(error.result, null, 2));
          }
          process.exit(1);
        } else if (error instanceof Error) {
          console.error(`\n❌ Error: ${error.message}`);
          process.exit(2);
        } else {
          console.error(`\n❌ Unknown error:`, error);
          process.exit(2);
        }
      }
    });

  return cmd;
}

/**
 * Main validation logic
 */
async function validateFile(filePath: string, options: ValidateCommandOptions): Promise<void> {
  // Validate explicit schema type if provided
  const validSchemaTypes: SchemaType[] = ['mcpdesc', 'mcp-description', 'diff', 'diff-breaking', 'dump-split'];
  if (options.schema && !validSchemaTypes.includes(options.schema)) {
    throw new Error(
      `Invalid schema type: ${options.schema}. Must be one of: ${validSchemaTypes.join(', ')}`
    );
  }

  // Auto-detect schema type if not provided
  let schemaType = options.schema;
  if (!schemaType) {
    const fileContent = await readFile(filePath, 'utf-8');
    let data: unknown;
    try {
      data = JSON.parse(fileContent);
    } catch {
      try {
        const { parse: yamlParse } = await import('yaml');
        data = yamlParse(fileContent);
      } catch {
        throw new Error('Failed to parse file as JSON or YAML — cannot auto-detect schema type');
      }
    }
    schemaType = detectSchemaType(data);
    if (!schemaType) {
      throw new Error(
        'Could not auto-detect schema type. Please specify --schema explicitly.\n' +
        `Valid types: ${validSchemaTypes.join(', ')}`
      );
    }
    console.error(`Auto-detected schema type: ${schemaType}`);
  }

  // Create validator
  const validator = new Validator();

  // Validate file
  const result = await validator.validateFile(filePath, schemaType);

  // Check if validation failed
  const hasErrors = result.errors.length > 0;
  const hasWarnings = result.warnings.length > 0;
  const failed = hasErrors || (options.strict && hasWarnings);

  if (failed) {
    throw new ValidationError('Validation failed', result);
  }

  // Output result
  if (options.format === 'json') {
    const output = JSON.stringify(result, null, 2);
    if (options.output) {
      await writeFile(options.output, output, 'utf-8');
      console.log(`✅ Validation report written to: ${options.output}`);
    } else {
      console.log(output);
    }
  } else {
    // Text format
    const output = formatTextOutput(result, options.strict || false);
    if (options.output) {
      await writeFile(options.output, output, 'utf-8');
      console.log(`✅ Validation report written to: ${options.output}`);
    } else {
      console.log(output);
    }
  }
}

/**
 * Format validation result as text
 */
function formatTextOutput(result: ValidationResult, strict: boolean): string {
  const lines: string[] = [];

  if (result.valid && result.warnings.length === 0) {
    lines.push(`✅ Valid ${result.schemaType}: ${result.file}`);
  } else if (result.valid && result.warnings.length > 0) {
    lines.push(`✅ Valid ${result.schemaType} with warnings: ${result.file}`);
  } else {
    lines.push(`❌ Invalid ${result.schemaType}: ${result.file}`);
  }

  lines.push('');
  lines.push('Validation Summary:');
  lines.push(`- Schema Type: ${result.schemaType}`);
  if (result.schemaVersion) {
    lines.push(`- Schema Version: ${result.schemaVersion}`);
  }
  lines.push(`- Errors: ${result.errors.length}`);
  lines.push(`- Warnings: ${result.warnings.length}`);
  if (strict && result.warnings.length > 0) {
    lines.push(`- Strict Mode: enabled (warnings treated as errors)`);
  }
  lines.push('');

  if (result.errors.length > 0) {
    lines.push('❌ Errors:');
    for (const error of result.errors) {
      lines.push(`   ${error.path}`);
      lines.push(`   → ${error.message}`);
      if (error.keyword) {
        lines.push(`     (${error.keyword})`);
      }
      lines.push('');
    }
  }

  if (result.warnings.length > 0) {
    lines.push('⚠️  Warnings:');
    for (const warning of result.warnings) {
      lines.push(`   ${warning.path}`);
      lines.push(`   → ${warning.message}`);
      lines.push('');
    }
  }

  if (result.errors.length === 0 && result.warnings.length === 0) {
    lines.push('No issues found.');
  }

  return lines.join('\n');
}

/**
 * Filter compatibility data to show only versions with schema changes
 */
function filterSchemaChanges(data: CompatibilityData): CompatibilityData {
  const filtered: CompatibilityEntry[] = [];
  
  for (let i = 0; i < data.compatibility.length; i++) {
    const current = data.compatibility[i];
    
    // Always include the first entry (latest)
    if (i === 0) {
      filtered.push(current);
      continue;
    }
    
    // Check if any schema changed compared to previous entry
    const previous = data.compatibility[i - 1];
    const hasChange = Object.keys(current.schemas).some(
      key => current.schemas[key] !== previous.schemas[key]
    );
    
    if (hasChange) {
      filtered.push(current);
    }
  }
  
  return { ...data, compatibility: filtered };
}

/**
 * Display schema-CLI compatibility matrix
 */
async function displayCompatibility(options: ValidateCommandOptions): Promise<void> {
  // Load compatibility matrix
  const compatPath = new URL('../../schemas/cli-schema-compatibility.json', import.meta.url).pathname;
  const compatContent = await readFile(compatPath, 'utf-8');
  let compatData: CompatibilityData = JSON.parse(compatContent);

  // Filter to show only versions with schema changes (default)
  const displayMode = options.display || 'short';
  if (displayMode === 'short') {
    compatData = filterSchemaChanges(compatData);
  }

  if (options.format === 'json') {
    // JSON output
    const output = JSON.stringify(compatData, null, 2);
    if (options.output) {
      await writeFile(options.output, output, 'utf-8');
      console.log(`✅ Compatibility matrix written to: ${options.output}`);
    } else {
      console.log(output);
    }
  } else {
    // Text table output
    const output = formatCompatibilityTable(compatData, displayMode);
    if (options.output) {
      await writeFile(options.output, output, 'utf-8');
      console.log(`✅ Compatibility matrix written to: ${options.output}`);
    } else {
      console.log(output);
    }
  }

  process.exit(0);
}

/**
 * Format compatibility matrix as text table
 */
function formatCompatibilityTable(data: CompatibilityData, displayMode: string): string {
  const lines: string[] = [];
  
  lines.push('Schema-CLI Compatibility Matrix\n');
  lines.push('CLI Version/Date   mcpdesc  Dump   Diff   Breaking  Split   Notes');
  lines.push('─'.repeat(100));
  
  for (const entry of data.compatibility) {
    const versionDate = `${entry.cliVersion}/${entry.releaseDate.substring(0, 10)}`;
    const mcpdesc = (entry.schemas as Record<string, string>)['mcp-description'] || 'n/a';
    const dump = entry.schemas.dump || 'n/a';
    const diff = entry.schemas.diff || 'n/a';
    const breaking = entry.schemas.breaking || 'n/a';
    const split = entry.schemas.split || 'n/a';
    const notes = entry.notes ? entry.notes.substring(0, 25) : '';
    
    lines.push(
      `${versionDate.padEnd(18)} ${mcpdesc.padEnd(8)} ${dump.padEnd(6)} ${diff.padEnd(6)} ${breaking.padEnd(9)} ${split.padEnd(7)} ${notes}`
    );
  }
  
  lines.push('');
  
  // Add note about display mode
  if (displayMode === 'short') {
    lines.push('Note: Showing only CLI versions that introduced schema changes.');
    lines.push('      Subsequent versions use the same schemas until the next change.');
    lines.push('      Use --display full to show all versions.');
    lines.push('');
  }
  
  lines.push('Usage Guidelines:');
  lines.push('- For current work: Use latest CLI with latest schemas');
  lines.push('- For old dumps: Regenerate with appropriate CLI version');
  lines.push('- Diff/breaking analysis requires matching schema versions');
  lines.push('- Validation accepts any historical schema version');
  
  return lines.join('\n');
}

/**
 * Print validation result to console
 */
function printValidationResult(result: ValidationResult, strict: boolean): void {
  console.log(formatTextOutput(result, strict));
}
