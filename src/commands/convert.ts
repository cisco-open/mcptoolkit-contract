// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Convert command - Convert between dump and mcpdesc formats
 */

import { Command } from 'commander';
import { readFile, writeFile } from 'node:fs/promises';
import { parse as yamlParse } from 'yaml';
import { extname } from 'node:path';
import { formatJSON, formatYAML } from '../lib/formatters.js';
import {
  contractDumpToMcpDescription,
  mcpDescriptionToContractDump,
  isMcpDescDocument,
  isContractDump,
  type McpDescDocument,
} from '../lib/mcpdesc-converter.js';
import type { ContractDump } from '../lib/types.js';

type TargetFormat = 'dump' | 'mcpdesc';
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
    .description('Convert between dump and mcpdesc formats')
    .argument('[input]', 'Input file path (dump or mcpdesc, JSON or YAML)')
    .option('--to-format <format>', 'Target format: dump or mcpdesc (auto-detected from input if omitted)')
    .option('-o, --output <path>', 'Output file path (default: stdout)')
    .option('-f, --format <format>', 'Output serialization: json or yaml (default: match input file extension)')
    .option('--compact', 'Compact JSON output (no indentation)', false)
    .option('-q, --quiet', 'Suppress progress messages', false)
    .option('--guide', 'Print the dump-to-mcpdesc conversion guide (for AI coding assistants)')
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
  const guidePath = new URL('../../docs/dump-to-mcpdesc.md', import.meta.url).pathname;
  const content = await readFile(guidePath, 'utf-8');
  process.stdout.write(content);
  if (!content.endsWith('\n')) {
    process.stdout.write('\n');
  }
}

async function runConvert(inputPath: string, options: ConvertCommandOptions): Promise<void> {
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
  const inputIsMcpDesc = isMcpDescDocument(data);
  const inputIsDump = isContractDump(data);

  if (!inputIsMcpDesc && !inputIsDump) {
    throw new Error('Unrecognized input format — expected mcpdesc document or capability dump');
  }

  const detectedInput = inputIsMcpDesc ? 'mcpdesc' : 'dump';

  // Determine target format
  let targetFormat: TargetFormat;
  if (options.toFormat) {
    targetFormat = options.toFormat;
  } else {
    // Auto: convert to the opposite format
    targetFormat = detectedInput === 'mcpdesc' ? 'dump' : 'mcpdesc';
  }

  if (detectedInput === targetFormat) {
    throw new Error(`Input is already in ${targetFormat} format. Use --to-format to specify a different target.`);
  }

  if (!options.quiet) {
    console.log(`🔄 Converting ${detectedInput} → ${targetFormat}`);
    console.log(`   Input: ${inputPath}`);
  }

  // Convert
  let result: unknown;
  if (targetFormat === 'mcpdesc') {
    const dump = data as unknown as ContractDump;
    result = contractDumpToMcpDescription(dump);
  } else {
    const doc = data as unknown as McpDescDocument;
    const dump = mcpDescriptionToContractDump(doc);
    // Populate dump schema version from schemas/dump-schema.json
    if (!dump.version) {
      try {
        const schemaPath = new URL('../../schemas/dump-schema.json', import.meta.url).pathname;
        const schema = JSON.parse(await readFile(schemaPath, 'utf-8'));
        dump.version = schema.$id as string;
      } catch {
        // Leave empty if schema unavailable
      }
    }
    result = dump;
  }

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
      console.log(`   Output: ${options.output} (${outputFormat})`);
      console.log('✅ Conversion complete');
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
