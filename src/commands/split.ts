// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Split command - Split large MCP descriptions into focused subsets
 */

import { Command } from 'commander';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { stringify as yamlStringify } from 'yaml';
import { Splitter } from '../lib/splitter.js';
import { Validator } from '../lib/validator.js';
import { formatJSON } from '../lib/formatters.js';
import { contractDumpToMcpDescription } from '../lib/mcpdesc-converter.js';
import type { ContractDump, SplitResult } from '../lib/types.js';

interface SplitCommandOptions {
  config: string;
  outputDir?: string;
  format?: 'json' | 'yaml';
  pretty?: boolean;
  dryRun?: boolean;
  validate?: boolean;
  quiet?: boolean;
}

/**
 * Determine output format based on options and input file
 */
function getOutputFormat(dumpPath: string, options: SplitCommandOptions): 'json' | 'yaml' {
  if (options.format) {
    return options.format;
  }
  
  // Auto-detect from dump file extension
  const ext = extname(dumpPath).toLowerCase();
  if (ext === '.yaml' || ext === '.yml') {
    return 'yaml';
  }
  
  return 'json';
}

/**
 * Format output data based on format and pretty options
 * Converts internal ContractDump to mcpdesc format before formatting.
 */
function formatOutput(data: ContractDump, format: 'json' | 'yaml', pretty: boolean): string {
  const mcpdesc = contractDumpToMcpDescription(data);

  if (format === 'yaml') {
    return yamlStringify(mcpdesc, { indent: 2 });
  }
  
  return formatJSON(mcpdesc, pretty);
}

/**
 * Write split result to file
 */
async function writeResult(
  result: SplitResult,
  outputDir: string,
  format: 'json' | 'yaml',
  pretty: boolean,
  quiet: boolean
): Promise<string> {
  const extension = format === 'yaml' ? '.yaml' : '.json';
  const outputPath = join(outputDir, `${result.outputFile}${extension}`);
  
  const content = formatOutput(result.dump, format, pretty);
  await writeFile(outputPath, content, 'utf-8');
  
  if (!quiet) {
    console.log(`  → Writing: ${outputPath}`);
  }
  
  return outputPath;
}

/**
 * Validate a split dump
 */
async function validateDump(filePath: string, quiet: boolean): Promise<boolean> {
  const validator = new Validator();
  
  try {
    const result = await validator.validateFile(filePath, 'mcpdesc');
    
    if (!result.valid) {
      console.error(`\n✗ Validation failed: ${filePath}`);
      for (const error of result.errors) {
        console.error(`  ${error.path}: ${error.message}`);
      }
      return false;
    }
    
    if (!quiet && result.warnings.length > 0) {
      console.log(`\n⚠ Validation warnings: ${filePath}`);
      for (const warning of result.warnings) {
        console.log(`  ${warning.path}: ${warning.message}`);
      }
    }
    
    return true;
  } catch (error) {
    console.error(`✗ Validation error: ${(error as Error).message}`);
    return false;
  }
}

/**
 * Print summary statistics
 */
function printSummary(
  results: SplitResult[],
  totalTools: number,
  matchedTools: number,
  unmatchedTools: number,
  multipleMatches: Array<{ toolName: string; categories: string[] }>,
  quiet: boolean
): void {
  if (quiet) {
    return;
  }

  console.log('\nSummary:');
  console.log(`  Total tools:     ${totalTools}`);
  console.log(`  Matched:         ${matchedTools} (${((matchedTools / totalTools) * 100).toFixed(1)}%)`);
  console.log(`  Unmatched:       ${unmatchedTools} (${((unmatchedTools / totalTools) * 100).toFixed(1)}%)`);
  console.log(`  Output files:    ${results.length}`);

  if (multipleMatches.length > 0) {
    console.log(`\n⚠ ${multipleMatches.length} tools matched multiple categories:`);
    for (const match of multipleMatches.slice(0, 5)) { // Show first 5
      console.log(`  - ${match.toolName} (matches: ${match.categories.join(', ')})`);
    }
    if (multipleMatches.length > 5) {
      console.log(`  ... and ${multipleMatches.length - 5} more`);
    }
  }
}

/**
 * Print dry-run information
 */
function printDryRun(results: SplitResult[], quiet: boolean): void {
  if (quiet) {
    return;
  }

  console.log('\n[DRY RUN] Would create the following files:');
  for (const result of results) {
    console.log(`  - ${result.outputFile} (${result.matchedTools} tools)`);
  }
}

export function splitCommand(): Command {
  const cmd = new Command('split');

  cmd
    .description('Split large MCP description into focused subsets based on filtering rules')
    .argument('<mcpdesc>', 'Input MCP description or dump file (JSON or YAML)')
    .requiredOption('--config <path>', 'Split configuration file (JSON or YAML)')
    .option('--output-dir <path>', 'Output directory for split dumps', '.')
    .option('--format <format>', 'Output format (json or yaml, default: auto-detect from input)')
    .option('--pretty', 'Pretty-print JSON output', true)
    .option('--no-pretty', 'Compact JSON output')
    .option('--dry-run', 'Show what would be split without writing files', false)
    .option('--validate', 'Validate split dumps against schema after generation', false)
    .option('--quiet', 'Suppress progress messages', false)
    .action(async (mcpdescPath: string, options: SplitCommandOptions) => {
      try {
        // Validate split configuration first
        if (!options.quiet) {
          console.log(`Validating split configuration: ${options.config}`);
        }
        
        const validator = new Validator();
        const configValidation = await validator.validateFile(options.config, 'dump-split');
        
        if (!configValidation.valid) {
          console.error('✗ Split configuration validation failed:');
          for (const error of configValidation.errors) {
            console.error(`  ${error.path}: ${error.message}`);
          }
          process.exit(1);
        }

        if (!options.quiet) {
          console.log('✓ Split configuration is valid\n');
        }

        // Load and split
        const splitter = new Splitter();
        
        if (!options.quiet) {
          console.log(`Loading: ${mcpdescPath}`);
        }
        
        const { results, stats, unmatchedTools } = await splitter.split({
          mcpdescPath: mcpdescPath,
          configPath: options.config,
          includeUnmatched: true,
        });

        if (!options.quiet) {
          console.log(`✓ Loaded: ${mcpdescPath} (${stats.totalTools} tools, 0 prompts, 0 resources)`);
          console.log(`✓ Loaded split config: ${options.config} (${stats.categories.length} categories)\n`);
          console.log('Splitting by category:\n');
        }

        // Check for no matches
        if (stats.matchedTools === 0 && results.length > 0) {
          console.error('✗ No tools matched any category patterns');
          process.exit(3);
        }

        // Dry run
        if (options.dryRun) {
          for (const result of results) {
            if (!options.quiet) {
              console.log(`  [${result.category}]`);
              console.log(`  ✓ Matched ${result.matchedTools} tools`);
            }
          }
          
          printDryRun(results, options.quiet || false);
          printSummary(
            results,
            stats.totalTools,
            stats.matchedTools,
            stats.unmatchedTools,
            stats.multipleMatches,
            options.quiet || false
          );
          return;
        }

        // Ensure output directory exists
        const outputDir = options.outputDir || '.';
        await mkdir(outputDir, { recursive: true });

        // Determine output format
        const format = getOutputFormat(mcpdescPath, options);
        const pretty = options.pretty !== false;

        // Write output files
        const outputFiles: string[] = [];
        for (const result of results) {
          if (!options.quiet) {
            console.log(`  [${result.category}]`);
            console.log(`  ✓ Matched ${result.matchedTools} tools`);
          }
          
          const outputPath = await writeResult(result, outputDir, format, pretty, options.quiet || false);
          outputFiles.push(outputPath);
        }

        // Validate output if requested
        if (options.validate) {
          if (!options.quiet) {
            console.log('\nValidating output files...');
          }
          
          let allValid = true;
          for (const filePath of outputFiles) {
            const valid = await validateDump(filePath, options.quiet || false);
            if (!valid) {
              allValid = false;
            }
          }
          
          if (!allValid) {
            process.exit(4);
          }
          
          if (!options.quiet) {
            console.log('✓ All output files are valid');
          }
        }

        // Handle unmatched items based on configuration
        if (unmatchedTools.length > 0) {
          // The unmatchedTools are already included in results if action is 'separate-file'
          // We just need to warn/error based on the action
          const unmatchedAction = stats.unmatchedTools > 0 ? 'warn' : 'ignore';
          
          if (unmatchedAction === 'warn' && !options.quiet) {
            console.log(`\n⚠ ${unmatchedTools.length} tools did not match any category`);
            console.log('  Configure unmatchedItems in split config to handle these');
          }
        }

        // Print summary
        printSummary(
          results,
          stats.totalTools,
          stats.matchedTools,
          stats.unmatchedTools,
          stats.multipleMatches,
          options.quiet || false
        );

        if (!options.quiet) {
          console.log('\n✓ Split completed successfully');
        }

      } catch (error) {
        if (error instanceof Error) {
          console.error(`Error: ${error.message}`);
          
          // Check for specific error types
          if (error.message.includes('Invalid regex pattern')) {
            process.exit(1);
          }
          if (error.message.includes('Failed to parse')) {
            process.exit(2);
          }
        } else {
          console.error('Unknown error occurred');
        }
        process.exit(1);
      }
    });

  return cmd;
}
