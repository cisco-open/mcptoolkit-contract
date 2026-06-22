// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Manifest command - Generate server.json manifest from MCP description and metadata
 */

import { Command } from 'commander';
import { writeFile } from 'node:fs/promises';
import { ManifestBuilder, ManifestGenerationError, type ValidationIssue } from '../lib/manifest-builder.js';
import { ValidationError as BuilderValidationError } from '../lib/manifest-builder.js';
import { Validator, ValidationError as SchemaValidationError } from '../lib/validator.js';
import { formatJSON, formatYAML } from '../lib/formatters.js';

interface ManifestCommandOptions {
  mcpdesc: string;
  info: string;
  output?: string;
  format?: 'json' | 'yaml';
  compact?: boolean;
  validate?: boolean;
  strict?: boolean;
  addCapabilitiesMeta?: boolean;
  quiet?: boolean;
}

export function manifestCommand(): Command {
  const cmd = new Command('manifest');

  cmd
    .description('[EXPERIMENTAL] Generate server.json manifest from MCP description and metadata')
    .requiredOption('--mcpdesc <path>', 'Path to MCP description or capability dump JSON file')
    .requiredOption('--info <path>', 'Path to server info JSON file (manifest metadata)')
    .option('-o, --output <path>', 'Output manifest file path', 'server.json')
    .option('-f, --format <format>', 'Output format (json or yaml)', 'json')
    .option('--compact', 'Compact JSON output (single line)', false)
    .option('--validate', 'Validate output against server.schema.json', false)
    .option('--strict', 'Treat warnings as errors', false)
    .option('--add-capabilities-meta', 'Add discovered capabilities to _meta section', false)
    .option('-q, --quiet', 'Suppress progress messages', false)
    .action(async (options: ManifestCommandOptions) => {
      try {
        await generateManifest(options);
      } catch (error) {
        if (error instanceof ManifestGenerationError) {
          console.error(`\n❌ Manifest Generation Failed: ${error.message}`);
          if (error.issues && error.issues.length > 0) {
            printIssues(error.issues);
          }
          process.exit(1);
        } else if (error instanceof BuilderValidationError) {
          console.error(`\n❌ Validation Failed: ${error.message}`);
          printIssues(error.issues);
          process.exit(1);
        } else if (error instanceof SchemaValidationError) {
          console.error(`\n❌ Schema Validation Failed: ${error.message}`);
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
 * Main manifest generation logic
 */
async function generateManifest(options: ManifestCommandOptions): Promise<void> {
  if (!options.quiet) {
    console.log('🔨 Generating manifest...');
    console.log(`  Input: ${options.mcpdesc}`);
    console.log(`  Info: ${options.info}`);
  }

  // Build manifest
  const { manifest, issues } = await ManifestBuilder.buildFromFiles(
    options.mcpdesc,
    options.info,
    {
      addCapabilitiesMeta: options.addCapabilitiesMeta,
      strict: options.strict,
    }
  );

  // Check for issues
  if (issues.length > 0) {
    if (!options.quiet) {
      console.log(''); // Add spacing
      printIssues(issues);
    }

    // In strict mode, treat warnings as errors
    if (options.strict && issues.some((i) => i.level === 'warning')) {
      throw new BuilderValidationError(
        'Validation failed in strict mode (warnings treated as errors)',
        issues
      );
    }

    // Fail on errors regardless of strict mode
    const errors = issues.filter((i) => i.level === 'error');
    if (errors.length > 0) {
      throw new BuilderValidationError('Validation failed with errors', issues);
    }
  }

  // Optional: Validate against schema
  if (options.validate) {
    if (!options.quiet) {
      console.log('\n🔍 Validating against server.schema.json...');
    }
    
    try {
      const validator = new Validator();
      const result = await validator.validateData(manifest, 'manifest', options.output || 'manifest');
      
      if (result.errors.length > 0) {
        console.error('\n❌ Manifest validation failed:');
        for (const error of result.errors) {
          console.error(`   ${error.path}: ${error.message}`);
        }
        if (options.strict) {
          throw new SchemaValidationError('Manifest validation failed', result);
        }
      } else if (result.warnings.length > 0) {
        console.log('\n⚠️  Manifest validation warnings:');
        for (const warning of result.warnings) {
          console.log(`   ${warning.path}: ${warning.message}`);
        }
        if (options.strict) {
          throw new SchemaValidationError('Manifest has warnings in strict mode', result);
        }
      } else {
        if (!options.quiet) {
          console.log('✅ Manifest validation passed');
        }
      }
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        throw error;
      }
      console.error(`\n⚠️  Validation error: ${(error as Error).message}`);
      if (options.strict) {
        throw error;
      }
    }
  }

  // Format output
  let outputContent: string;
  if (options.format === 'yaml') {
    outputContent = formatYAML(manifest);
  } else {
    // Pretty-print by default unless --compact is specified
    const prettyPrint = !options.compact;
    outputContent = formatJSON(manifest, prettyPrint);
  }

  // Write output
  if (options.output) {
    await writeFile(options.output, outputContent, 'utf-8');
    if (!options.quiet) {
      console.log(`\n✅ Manifest written to: ${options.output}`);
      console.log(`   Format: ${options.format}`);
      console.log(`   Version: ${manifest.version}`);
      console.log(`   Name: ${manifest.name}`);
      
      // Show capability counts if meta was added
      if (options.addCapabilitiesMeta && manifest._meta) {
        const caps = manifest._meta['io.modelcontextprotocol.registry/publisher-provided']?.discoveredCapabilities;
        if (caps) {
          console.log('\n📊 Discovered Capabilities:');
          console.log(`   Tools: ${caps.toolsCount}`);
          console.log(`   Resources: ${caps.resourcesCount}`);
          console.log(`   Resource Templates: ${caps.resourceTemplatesCount}`);
          console.log(`   Prompts: ${caps.promptsCount}`);
        }
      }
    }
  } else {
    // Write to stdout
    console.log(outputContent);
  }
}

/**
 * Print validation issues in a formatted way
 */
function printIssues(issues: ValidationIssue[]): void {
  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');
  const infos = issues.filter((i) => i.level === 'info');

  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach((issue) => {
      console.log(`   • ${issue.message}`);
      if (issue.field) {
        console.log(`     Field: ${issue.field}`);
      }
      if (issue.expected && issue.actual) {
        console.log(`     Expected: ${issue.expected}`);
        console.log(`     Actual: ${issue.actual}`);
      }
    });
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    warnings.forEach((issue) => {
      console.log(`   • ${issue.message}`);
      if (issue.field) {
        console.log(`     Field: ${issue.field}`);
      }
      if (issue.expected && issue.actual) {
        console.log(`     Expected: ${issue.expected}`);
        console.log(`     Actual: ${issue.actual}`);
      }
    });
  }

  if (infos.length > 0) {
    console.log('\nℹ️  Info:');
    infos.forEach((issue) => {
      console.log(`   • ${issue.message}`);
    });
  }
}
