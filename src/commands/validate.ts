// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Validate command - Validate files against MCP schemas
 */

import { Command } from 'commander';
import { writeFile, readFile } from 'node:fs/promises';
import { type McpDescriptionSelector } from '@mcpdesc/validator';
import {
  CLI_MCPDESC_FORMATS, CLI_MCPDESC_SELECTORS, DEFAULT_MIGRATION_VERSION,
  DEFAULT_OUTPUT_VERSION, HISTORICAL_PROCESSING_CLI_VERSION, LEGACY_CONVERSION_CLI_VERSION,
} from '../lib/mcpdesc-target.js';
import { Validator, ValidationError, detectSchemaType, type SchemaType, type ValidationResult } from '../lib/validator.js';

interface ValidateCommandOptions {
  schema?: SchemaType;
  selector?: string;
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

function diagnosticPath(path: readonly (string | number)[]): string {
  if (path.length === 0) return '/';
  return `/${path
    .map((segment) => String(segment).replace(/~/g, '~0').replace(/\//g, '~1'))
    .join('/')}`;
}

export function validateCommand(cliVersion: string): Command {
  const cmd = new Command('validate');

  cmd
  .description('Validate an MCP description, diff, or split configuration against their specification schemas')
  .usage('[options] <file>')
  .argument('[file]', 'Path to file to validate (required unless using --show-compatibility)')
  .option('--schema <type>', 'Schema type (auto-detected if omitted): mcpdesc (or mcp-description), diff, diff-breaking, or dump-split')
    .option('--selector <selector>', 'Pin MCP Description validation rules, e.g. 0.9.0 (overrides a recognized same-format schema)')
    .option('--strict', 'Treat warnings as errors', false)
    .option('-f, --format <format>', 'Output format: text or json', 'text')
    .option('-o, --output <path>', 'Write validation or compatibility output to file')
    .option('--show-compatibility', 'Show installed CLI compatibility or release history and exit')
    .option('--display <mode>', 'Compatibility mode: short (text summary or JSON schema changes) or full (recorded history)', 'short')
    .addHelpText('after', '\nWithout an input file: mcpcontract validate --show-compatibility')
    .action(async (file: string | undefined, options: ValidateCommandOptions) => {
      try {
        // Handle compatibility display
        if (options.showCompatibility) {
          await displayCompatibility(options, cliVersion);
          return;
        }

        // Regular validation requires file and schema
        if (!file) {
          console.error('❌ Error: file argument is required for validation');
          console.error('   Use --show-compatibility to display version compatibility');
          process.exit(2);
        }

        await validateFile(file, options);
      } catch (error) {
        if (error instanceof ValidationError) {
          console.error(`\n❌ Validation Failed`);
          const output = options.format === 'text'
            ? formatTextOutput(error.result, options.strict || false)
            : JSON.stringify(error.result, null, 2);
          if (options.output) {
            await writeFile(options.output, output, 'utf-8');
            console.error(`Validation report written to: ${options.output}`);
          } else {
            console.log(output);
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

  if (options.selector) {
    if (schemaType !== 'mcpdesc' && schemaType !== 'mcp-description') {
      throw new Error('--selector can only be used when validating an MCP Description');
    }
    if (!CLI_MCPDESC_SELECTORS.includes(options.selector as McpDescriptionSelector)) {
      throw new Error(`Unsupported MCP Description selector: ${options.selector}`);
    }
  }

  // Create validator
  const validator = new Validator();

  // Validate file
  const result = await validator.validateFile(
    filePath,
    schemaType,
    options.selector as McpDescriptionSelector | undefined,
  );

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
  if (result.selector) {
    lines.push(`- Validation Selector: ${result.selector}${result.selectionSource ? ` (${result.selectionSource})` : ''}`);
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
      if (error.rule) {
        lines.push(`     Rule: ${error.rule}`);
      }
      if (error.protocolVersions?.length) {
        lines.push(`     MCP versions: ${error.protocolVersions.join(', ')}`);
      }
      if (error.detail) {
        lines.push(`     Detail: ${JSON.stringify(error.detail)}`);
      }
      for (const related of error.relatedLocations ?? []) {
        lines.push(`     Related location: ${diagnosticPath(related.path)} (${related.relation})`);
      }
      lines.push('');
    }
  }

  if (result.warnings.length > 0) {
    lines.push('⚠️  Warnings:');
    for (const warning of result.warnings) {
      lines.push(`   ${warning.path}`);
      lines.push(`   → ${warning.message}`);
      if (warning.rule) {
        lines.push(`     Rule: ${warning.rule}`);
      }
      if (warning.protocolVersions?.length) {
        lines.push(`     MCP versions: ${warning.protocolVersions.join(', ')}`);
      }
      if (warning.detail) {
        lines.push(`     Detail: ${JSON.stringify(warning.detail)}`);
      }
      for (const related of warning.relatedLocations ?? []) {
        lines.push(`     Related location: ${diagnosticPath(related.path)} (${related.relation})`);
      }
      lines.push('');
    }
  }

  if (result.ruleResults) {
    const counts = new Map<string, number>();
    for (const ruleResult of result.ruleResults) {
      counts.set(ruleResult.status, (counts.get(ruleResult.status) ?? 0) + 1);
    }
    lines.push(`Rule results: ${[...counts].map(([status, count]) => `${status}=${count}`).join(', ') || 'none'}`);
    lines.push('');
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
async function displayCompatibility(options: ValidateCommandOptions, cliVersion: string): Promise<void> {
  const displayMode = options.display || 'short';
  let output: string;
  if (options.format !== 'json' && displayMode === 'short') {
    output = formatCompatibilitySummary(cliVersion);
  } else {
    const compatPath = new URL('../../schemas/cli-schema-compatibility.json', import.meta.url);
    const data: CompatibilityData = JSON.parse(await readFile(compatPath, 'utf-8'));
    output = options.format === 'json'
      ? JSON.stringify(displayMode === 'short' ? filterSchemaChanges(data) : data, null, 2)
      : formatCompatibilityHistory(data);
  }

  if (options.output) {
    await writeFile(options.output, output, 'utf-8');
    const label = options.format !== 'json' && displayMode === 'short' ? 'Compatibility summary' : 'Compatibility matrix';
    console.log(`✅ ${label} written to: ${options.output}`);
  } else {
    console.log(output);
  }
}

/**
 * Show what this installed CLI supports independently of the release history.
 */
function formatCompatibilitySummary(cliVersion: string): string {
  const alternatives = CLI_MCPDESC_FORMATS.filter((format) => format !== DEFAULT_OUTPUT_VERSION);
  return [
    `MCP Description Compatibility (mcpcontract ${cliVersion})`,
    '',
    `Validate and process: ${CLI_MCPDESC_FORMATS.join(', ')}`,
    `Dump output: ${DEFAULT_OUTPUT_VERSION} by default${alternatives.map((format) => `; use --to-version ${format} to emit ${format}`).join('')}`,
    `Migration target: ${DEFAULT_MIGRATION_VERSION}`,
    'Native projection: requires MCP Description 0.9.0',
    `Supported selectors: ${CLI_MCPDESC_SELECTORS.join(', ')}`,
    'Input rules: explicit selector, then recognized same-format $schema, then maintained format default.',
    '',
    'Which CLI to use:',
    `- ${cliVersion} (installed): use for the supported formats above.`,
    `- ${LEGACY_CONVERSION_CLI_VERSION}: convert legacy dumps or 0.7.0 to 0.8.0.`,
    `- ${HISTORICAL_PROCESSING_CLI_VERSION}: process 0.7.0 without upgrading.`,
    `  Convert with: npx --package=@cisco_open/mcptoolkit-contract@${LEGACY_CONVERSION_CLI_VERSION} mcpcontract convert <input> --output <output>`,
    '',
    'Use --display full for recorded release history, including prereleases.',
    'Use --format json for machine-readable history.',
  ].join('\n');
}

function formatCompatibilityHistory(data: CompatibilityData): string {
  const rows = data.compatibility.map((entry) => [
    `${entry.cliVersion} (${entry.releaseDate})`,
    ...Object.entries(entry.schemas).map(([name, version]) => `  ${name}: ${version}`),
    ...(entry.notes ? [`  Notes: ${entry.notes}`] : []),
  ].join('\n'));
  return ['Schema-CLI Compatibility History (curated, not a complete release index)', ...rows].join('\n\n');
}
