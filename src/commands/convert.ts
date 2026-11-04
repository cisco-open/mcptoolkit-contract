// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Convert command - Import legacy capability dumps as active mcpdesc
 */

import { Command } from 'commander';
import { readFile, writeFile } from 'node:fs/promises';
import { parse as yamlParse } from 'yaml';
import { extname } from 'node:path';
import { formatJSON, formatYAML } from '../lib/formatters.js';
import {
  contractDumpToMcpDescription,
  isMcpDescDocument,
  isContractDump,
} from '../lib/mcpdesc-converter.js';
import type { ContractDump } from '../lib/types.js';
import { migrateMcpDescription } from '../lib/mcpdesc-migration.js';

type TargetFormat = 'mcpdesc';
type OutputFormat = 'json' | 'yaml';

interface ConvertCommandOptions {
  toFormat?: TargetFormat;
  output?: string;
  format?: OutputFormat;
  compact?: boolean;
  quiet?: boolean;
  guide?: boolean;
}

export function convertCommand(): Command {
  const cmd = new Command('convert');

  cmd
    .description('Convert a legacy capability dump to the active MCP Description format')
    .usage('[options] <input>')
    .argument('[input]', 'Legacy capability dump file (JSON or YAML; required unless using --guide)')
    .option('--to-format <format>', 'Target format: mcpdesc (default)')
    .option('-o, --output <path>', 'Output file path (default: stdout)')
    .option('-f, --format <format>', 'Output serialization: json or yaml (default: infer from output path, then input path)')
    .option('--compact', 'Compact JSON output (no indentation)', false)
    .option('-q, --quiet', 'Suppress progress messages', false)
    .option('--guide', 'Print the dump-to-mcpdesc conversion guide (for AI coding assistants)')
    .addHelpText('after', '\nWithout an input file: mcpcontract convert --guide')
    .action(async (inputPath: string | undefined, options: ConvertCommandOptions) => {
      try {
        if (options.guide) {
          await printGuide();
          return;
        }
        if (!inputPath) {
          console.error('❌ Error: missing required argument \'input\'');
          process.exit(1);
        }
        await runConvert(inputPath, options);
      } catch (error) {
        console.error(`\n❌ Error: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  return cmd;
}

async function printGuide(): Promise<void> {
  console.log('Convert legacy dumps: mcpcontract convert legacy.json --output server.yaml\n' +
    'Upgrade MCP Description documents: mcpcontract migrate server.yaml --output upgraded.yaml');
}

async function runConvert(inputPath: string, options: ConvertCommandOptions): Promise<void> {
  if (options.toFormat && options.toFormat !== 'mcpdesc') {
    throw new Error('convert supports only legacy dump to mcpdesc conversion; reverse conversion is no longer supported');
  }
  if (options.format && options.format !== 'json' && options.format !== 'yaml') {
    throw new Error('--format must be json or yaml');
  }

  // Read and parse input
  const content = await readFile(inputPath, 'utf-8');
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(content);
  } catch {
    try {
      data = yamlParse(content) as Record<string, unknown>;
    } catch (yamlError) {
      throw new Error(`Failed to parse ${inputPath} as JSON or YAML: ${(yamlError as Error).message}`);
    }
  }

  // Detect input format
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('Expected a legacy capability dump object');
  }
  if (isMcpDescDocument(data)) {
    throw new Error('Input is already an MCP Description. Use mcpcontract migrate <input> to upgrade its version');
  }
  if (!isContractDump(data)) {
    throw new Error('Unrecognized input format: expected a legacy capability dump');
  }

  if (!options.quiet) {
    console.error(`Converting legacy dump: ${inputPath}`);
  }

  const intermediate = contractDumpToMcpDescription(data as unknown as ContractDump, {
    selector: '0.8.0',
    onUnsupportedServerCapabilities: (names) => {
      console.error(`Warning: capabilities not representable in mcpdesc were omitted: ${names.join(', ')}`);
    },
  });
  const migration = await migrateMcpDescription(intermediate);
  for (const diagnostic of migration.diagnostics) {
    console.error(`${diagnostic.severity}: ${diagnostic.message ?? diagnostic.code ?? diagnostic.rule}`);
  }
  if (!migration.ok) {
    throw new Error(`Conversion ${migration.status}. Review the diagnostics; no output document was written`);
  }
  const result = migration.value;

  // Determine output serialization format
  const outputFormat: OutputFormat = options.format || inferSerializationFormat(inputPath, options.output);

  // Serialize
  let outputContent: string;
  if (outputFormat === 'yaml') {
    outputContent = formatYAML(result);
  } else {
    outputContent = formatJSON(result, !options.compact);
  }

  // Write or print
  if (options.output) {
    await writeFile(options.output, outputContent, 'utf-8');
    if (!options.quiet) {
      console.error(`Output: ${options.output} (${outputFormat})`);
    }
  } else {
    process.stdout.write(outputContent);
    if (!outputContent.endsWith('\n')) {
      process.stdout.write('\n');
    }
  }
}

function inferSerializationFormat(inputPath: string, outputPath?: string): OutputFormat {
  const path = outputPath || inputPath;
  const ext = extname(path).toLowerCase();
  if (ext === '.yaml' || ext === '.yml') return 'yaml';
  return 'json';
}
