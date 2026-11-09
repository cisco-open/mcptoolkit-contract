import { Command } from 'commander';
import { readFile, writeFile } from 'node:fs/promises';
import { parseMcpDescriptionSource, serializeMcpDescription } from '@mcpdesc/core';
import { isMcpDescDocument } from '../lib/mcpdesc-converter.js';
import { resolveMcpDescriptionSelection } from '../lib/mcpdesc-target.js';

interface NormalizeOptions {
  format?: 'json' | 'yaml';
  keyOrder?: 'document' | 'preserve' | 'sorted';
  output?: string;
  quiet?: boolean;
}

export function normalizeCommand(): Command {
  const cmd = new Command('normalize');

  cmd
    .description('Normalize MCP Description key order and serialization')
    .argument('<input>', 'Input MCP Description file (JSON or YAML)')
    .option('-f, --format <format>', 'Output serialization: json or yaml (default: infer from output path or input)')
    .option('--key-order <order>', 'Key order: document, preserve, or sorted', 'document')
    .option('-o, --output <path>', 'Output file path (default: stdout)')
    .option('-q, --quiet', 'Suppress status messages', false)
    .action(async (input: string, options: NormalizeOptions) => {
      try {
        await runNormalize(input, options);
      } catch (error) {
        console.error(`Error: ${(error as Error).message}`);
        process.exit(2);
      }
    });

  return cmd;
}

async function runNormalize(input: string, options: NormalizeOptions): Promise<void> {
  if (options.format && options.format !== 'json' && options.format !== 'yaml') {
    throw new Error('--format must be json or yaml');
  }
  if (!['document', 'preserve', 'sorted'].includes(options.keyOrder ?? 'document')) {
    throw new Error('--key-order must be document, preserve, or sorted');
  }

  const parsed = parseMcpDescriptionSource(await readFile(input, 'utf-8'));
  if (!parsed.ok) {
    throw new Error(parsed.diagnostics.map((item) => item.message).join('; '));
  }
  if (
    typeof parsed.value !== 'object' ||
    parsed.value === null ||
    Array.isArray(parsed.value) ||
    !isMcpDescDocument(parsed.value)
  ) {
    throw new Error('Input must be an MCP Description document');
  }
  resolveMcpDescriptionSelection(parsed.value);

  const format = options.format ??
    (options.output?.match(/\.ya?ml$/i) ? 'yaml' : options.output?.match(/\.json$/i) ? 'json' : parsed.format);
  const output = serializeMcpDescription(parsed.value, {
    format,
    keyOrder: options.keyOrder ?? 'document',
  });
  if (options.output) {
    await writeFile(options.output, output, 'utf-8');
    if (!options.quiet) console.error(`Normalized document written to ${options.output}`);
  } else {
    process.stdout.write(output.endsWith('\n') ? output : `${output}\n`);
  }
}
