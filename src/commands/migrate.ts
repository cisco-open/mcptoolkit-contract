// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

import { Command } from 'commander';
import { readFile, writeFile } from 'node:fs/promises';
import {
  serializeMcpDescription,
  type JsonValue,
  type McpDescriptionConversionFix,
} from '@mcpdesc/core';
import { formatJSON } from '../lib/formatters.js';
import { formatMcpDescriptionDiagnostic } from '../lib/mcpdesc-diagnostics.js';
import { parseDocumentSource } from '../lib/mcpdesc-io.js';
import { isMcpDescDocument } from '../lib/mcpdesc-converter.js';
import { migrateMcpDescription } from '../lib/mcpdesc-migration.js';
import { DEFAULT_MIGRATION_VERSION, resolveOutputSelection } from '../lib/mcpdesc-target.js';

interface MigrateOptions {
  selector?: string;
  fixes?: string;
  output?: string;
  report?: string;
  patch?: string;
  format?: 'json' | 'yaml';
  keyOrder?: 'preserve' | 'document' | 'sorted';
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
  const defaultSelector = resolveOutputSelection(DEFAULT_MIGRATION_VERSION).selector;

  cmd
    .description(`Upgrade MCP Description documents to the maintained target (${DEFAULT_MIGRATION_VERSION})`)
    .argument('<input>', 'Input MCP Description file (JSON or YAML)')
    .option('-o, --output <path>', 'Converted document output path (default: stdout)')
    .option('-f, --format <format>', 'Document output serialization: json or yaml')
    .option('--key-order <order>', 'Key order: preserve, document, or sorted', 'preserve')
    .option('--compact', 'Compact JSON document output', false)
    .option('-q, --quiet', 'Suppress status messages', false)
    .option('--selector <selector>', `Pin destination rules (default: ${defaultSelector})`)
    .option('--fixes <file>', 'JSON/YAML object with a top-level "fixes" array of requested conversion fixes')
    .option('--report <path>', 'Write conversion status and diagnostics as JSON')
    .option('--patch <path>', 'Write the generated RFC 6902 JSON Patch as JSON')
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
  return parseDocumentSource(content, description).value;
}

async function runMigrate(input: string, options: MigrateOptions): Promise<void> {
  const toVersion = DEFAULT_MIGRATION_VERSION;
  resolveOutputSelection(toVersion, options.selector);
  if (options.format && options.format !== 'json' && options.format !== 'yaml') {
    throw new Error('--format must be json or yaml');
  }
  if (!['preserve', 'document', 'sorted'].includes(options.keyOrder ?? 'preserve')) {
    throw new Error('--key-order must be preserve, document, or sorted');
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
    selector: options.selector,
    fixes,
  });
  const report = {
    from: (source as Record<string, unknown>).mcpdesc,
    to: toVersion,
    selector: conversion.selector,
    selectionSource: conversion.selectionSource,
    sourceSelector: conversion.sourceSelector,
    sourceSelectionSource: conversion.sourceSelectionSource,
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
      console.error(`${diagnostic.severity}: ${formatMcpDescriptionDiagnostic(diagnostic)}`);
    }
    if (options.report) console.error(`Conversion report written to ${options.report}`);
    process.exitCode = 1;
    return;
  }

  const format = options.format ?? (options.output?.match(/\.ya?ml$/i) ? 'yaml' : 'json');
  const keyOrder = options.keyOrder ?? 'preserve';
  let output: string;
  if (format === 'yaml') {
    output = serializeMcpDescription(conversion.value as JsonValue, { format, presentation: 'normalized', keyOrder });
  } else if (keyOrder === 'preserve') {
    output = formatJSON(conversion.value, !options.compact);
  } else {
    const ordered = serializeMcpDescription(conversion.value as JsonValue, { format, keyOrder });
    output = options.compact ? formatJSON(JSON.parse(ordered), false) : ordered;
  }
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