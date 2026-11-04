// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

import { Command } from 'commander';
import { readFile, writeFile } from 'node:fs/promises';
import {
  parseMcpDescriptionSource,
  type McpDescriptionConversionFix,
} from '@mcpdesc/core';
import { formatJSON, formatYAML } from '../lib/formatters.js';
import { isMcpDescDocument } from '../lib/mcpdesc-converter.js';
import { migrateMcpDescription } from '../lib/mcpdesc-migration.js';
import { ACTIVE_MCPDESC_VERSION, ACTIVE_MCPDESC_SELECTOR } from '../lib/mcpdesc-target.js';

interface MigrateOptions {
  toVersion?: string;
  selector?: string;
  fixes?: string;
  output?: string;
  report?: string;
  patch?: string;
  format?: 'json' | 'yaml';
  compact?: boolean;
  quiet?: boolean;
}

function isConversionFix(value: unknown): value is McpDescriptionConversionFix {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as { fix?: unknown; path?: unknown };
  return (
    (candidate.fix === 'remove-property' || candidate.fix === 'move-to-experimental') &&
    Array.isArray(candidate.path) &&
    candidate.path.every((part: unknown) =>
      typeof part === 'string' || (typeof part === 'number' && Number.isInteger(part) && part >= 0)
    )
  );
}

export function migrateCommand(): Command {
  const cmd = new Command('migrate');

  cmd
    .description('Upgrade MCP Description documents to the active format using reviewed migration steps')
    .argument('<input>', 'Input MCP Description file (JSON or YAML)')
    .option('--to-version <version>', 'Target format version (0.8.0 or active 0.9.0)', ACTIVE_MCPDESC_VERSION)
    .option('--selector <selector>', 'Pin target rules (0.9.0-draft.4 for 0.9.0; 0.8.0 for 0.8.0)')
    .option('--fixes <file>', 'JSON/YAML object with a top-level "fixes" array of requested conversion fixes')
    .option('-o, --output <path>', 'Converted document output path (default: stdout)')
    .option('--report <path>', 'Write conversion status and diagnostics as JSON')
    .option('--patch <path>', 'Write the generated RFC 6902 JSON Patch as JSON')
    .option('-f, --format <format>', 'Document output serialization: json or yaml')
    .option('--compact', 'Compact JSON document output', false)
    .option('-q, --quiet', 'Suppress status messages', false)
    .action(async (input: string, options: MigrateOptions) => {
      try {
        await runMigrate(input, options);
      } catch (error) {
        console.error(`Migration error: ${(error as Error).message}`);
        process.exit(2);
      }
    });

  return cmd;
}

async function parseSource(content: string, description: string): Promise<unknown> {
  const parsed = parseMcpDescriptionSource(content);
  if (!parsed.ok) {
    throw new Error(`Failed to parse ${description}: ${parsed.diagnostics.map((item) => item.message).join('; ')}`);
  }
  return parsed.value;
}

async function runMigrate(input: string, options: MigrateOptions): Promise<void> {
  const toVersion = options.toVersion ?? ACTIVE_MCPDESC_VERSION;
  if (toVersion !== ACTIVE_MCPDESC_VERSION && toVersion !== '0.8.0') {
    throw new Error('Supported migration targets are 0.8.0 and 0.9.0');
  }
  const selector = toVersion === '0.8.0' ? '0.8.0' : ACTIVE_MCPDESC_SELECTOR;
  if (options.selector !== undefined && options.selector !== selector) {
    throw new Error(`Target ${toVersion} requires selector ${selector}`);
  }
  if (options.format && options.format !== 'json' && options.format !== 'yaml') {
    throw new Error('--format must be json or yaml');
  }

  const source = await parseSource(await readFile(input, 'utf-8'), input);
  if (
    typeof source !== 'object' ||
    source === null ||
    Array.isArray(source) ||
    !isMcpDescDocument(source as Record<string, unknown>)
  ) {
    throw new Error('Input must be an MCP Description document');
  }

  let fixes: McpDescriptionConversionFix[] = [];
  if (options.fixes) {
    const fixData = await parseSource(await readFile(options.fixes, 'utf-8'), options.fixes);
    if (
      typeof fixData !== 'object' ||
      fixData === null ||
      Array.isArray(fixData) ||
      !('fixes' in fixData) ||
      !Array.isArray(fixData.fixes)
    ) {
      throw new Error('Fixes file must contain a top-level "fixes" array');
    }
    const validFixes = fixData.fixes.every(isConversionFix);
    if (!validFixes) {
      throw new Error('Each fix must have a supported fix type and a string/array-index path');
    }
    fixes = fixData.fixes as McpDescriptionConversionFix[];
  }

  const conversion = await migrateMcpDescription(source as import('../lib/mcpdesc-converter.js').McpDescDocument, {
    toVersion,
    fixes,
  });
  const report = {
    from: (source as Record<string, unknown>).mcpdesc,
    to: toVersion,
    selector,
    status: conversion.status,
    diagnostics: conversion.diagnostics,
    steps: conversion.steps,
  };

  if (options.report) {
    await writeFile(options.report, formatJSON(report, true), 'utf-8');
  }
  if (options.patch && conversion.ok) {
    await writeFile(options.patch, formatJSON(conversion.patch, true), 'utf-8');
  }

  if (!conversion.ok) {
    for (const diagnostic of conversion.diagnostics) {
      console.error(`${diagnostic.severity}: ${diagnostic.code ?? diagnostic.rule}: ${diagnostic.message ?? 'Conversion blocked'}`);
    }
    if (options.report) console.error(`Conversion report written to ${options.report}`);
    process.exitCode = 1;
    return;
  }

  const format = options.format ?? (options.output?.match(/\.ya?ml$/i) ? 'yaml' : 'json');
  const output = format === 'yaml'
    ? formatYAML(conversion.value)
    : formatJSON(conversion.value, !options.compact);
  if (options.output) {
    await writeFile(options.output, output, 'utf-8');
  } else {
    process.stdout.write(output.endsWith('\n') ? output : `${output}\n`);
  }
  if (!options.quiet) {
    if (options.output) console.error(`Converted document written to ${options.output}`);
    if (options.report) console.error(`Conversion report written to ${options.report}`);
    if (options.patch) console.error(`Conversion patch written to ${options.patch}`);
  }
}