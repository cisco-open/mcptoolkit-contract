// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

import { Command } from 'commander';
import { readFile, writeFile } from 'node:fs/promises';
import {
  projectMcpNativeValue,
  parseMcpDescriptionSource,
  type McpNativeKind,
  type SupportedCoreSpecification,
} from '@mcpdesc/core';
import { supportedProtocolVersions, type SupportedProtocolVersion } from '@mcpdesc/validator';
import { formatJSON, formatYAML } from '../lib/formatters.js';
import {
  getMcpDescriptionSelector,
  isMcpDescDocument,
  projectMcpDescriptionView,
  type McpDescDocument,
} from '../lib/mcpdesc-converter.js';

interface ProjectOptions {
  view: 'effective' | 'native';
  selector?: string;
  protocolVersion?: string;
  kind?: McpNativeKind;
  identifier?: string;
  format?: 'json' | 'yaml';
  output?: string;
  compact?: boolean;
  quiet?: boolean;
}

export function projectCommand(): Command {
  const cmd = new Command('project');

  cmd
    .description('Project an MCP Description into an effective view or native MCP value')
    .argument('<input>', 'Input MCP Description file (JSON or YAML)')
    .option('--view <mode>', 'Projection mode: effective or native', 'effective')
    .option('--selector <selector>', 'Pin the MCP Description selector, e.g. 0.9.0-draft.4')
    .option('--protocol-version <version>', 'MCP protocol version (required for native view or multi-version input)')
    .option('--kind <kind>', 'Native declaration kind: tool, resource, resourceTemplate, or prompt (required with --view native)')
    .option('--identifier <identifier>', 'Project one native declaration by its MCP identity (only with --view native)')
    .option('-f, --format <format>', 'Output serialization: json or yaml (default: infer from output path)')
    .option('-o, --output <path>', 'Output file path (default: stdout)')
    .option('--compact', 'Compact JSON output', false)
    .option('-q, --quiet', 'Suppress status messages', false)
    .action(async (input: string, options: ProjectOptions) => {
      try {
        await runProject(input, options);
      } catch (error) {
        console.error(`Error: ${(error as Error).message}`);
        process.exit(2);
      }
    });

  return cmd;
}

async function runProject(input: string, options: ProjectOptions): Promise<void> {
  if (options.view !== 'effective' && options.view !== 'native') {
    throw new Error('--view must be effective or native');
  }
  if (options.format && options.format !== 'json' && options.format !== 'yaml') {
    throw new Error('--format must be json or yaml');
  }

  const parsed = parseMcpDescriptionSource(await readFile(input, 'utf-8'));
  if (!parsed.ok) {
    throw new Error(parsed.diagnostics.map((item) => item.message).join('; '));
  }
  if (
    typeof parsed.value !== 'object' ||
    parsed.value === null ||
    Array.isArray(parsed.value) ||
    !isMcpDescDocument(parsed.value as Record<string, unknown>)
  ) {
    throw new Error('Input must be an MCP Description document');
  }

  const document = parsed.value as unknown as McpDescDocument;
  const selector = getMcpDescriptionSelector(
    document,
    options.selector as SupportedCoreSpecification | undefined,
  );
  let result: unknown;

  if (options.view === 'effective') {
    if (options.kind || options.identifier) {
      throw new Error('--kind and --identifier are only available with --view native');
    }
    result = projectMcpDescriptionView(document, options.protocolVersion, selector);
  } else {
    if (!selector.startsWith('0.9.0-draft.')) {
      throw new Error('Native projection requires a 0.9.0 draft selector');
    }
    if (!options.protocolVersion) {
      throw new Error('--protocol-version is required with --view native');
    }
    if (!supportedProtocolVersions.includes(options.protocolVersion as SupportedProtocolVersion)) {
      throw new Error(`Unsupported MCP protocol version: ${options.protocolVersion}`);
    }
    if (!options.kind) {
      throw new Error('--kind is required with --view native');
    }
    if (!['tool', 'resource', 'resourceTemplate', 'prompt'].includes(options.kind)) {
      throw new Error('--kind must be tool, resource, resourceTemplate, or prompt');
    }

    const projection = projectMcpNativeValue(document, {
      selector: selector as Extract<SupportedCoreSpecification, `0.9.0-draft.${string}`>,
      protocolVersion: options.protocolVersion as SupportedProtocolVersion,
      kind: options.kind,
      ...(options.identifier ? { identifier: options.identifier } : {}),
    });
    if (!projection.ok) {
      throw new Error(projection.diagnostics
        .map((item) => `${item.code ?? item.rule ?? 'projection-error'}: ${item.message ?? 'Projection failed'}`)
        .join('; '));
    }
    result = projection.value;
    for (const diagnostic of projection.diagnostics) {
      console.error(`Warning: ${diagnostic.code ?? diagnostic.rule}: ${diagnostic.message ?? 'Projection warning'}`);
    }
  }

  const outputFormat = options.format ?? (options.output?.match(/\.ya?ml$/i) ? 'yaml' : 'json');
  const output = outputFormat === 'yaml'
    ? formatYAML(result)
    : formatJSON(result, !options.compact);
  if (options.output) {
    await writeFile(options.output, output, 'utf-8');
    if (!options.quiet) console.error(`Projection written to ${options.output}`);
  } else {
    process.stdout.write(output.endsWith('\n') ? output : `${output}\n`);
  }
}