import {
  convertMcpDescriptionVersion,
  type CoreDiagnostic,
  type McpDescriptionConversionFix,
  type McpDescriptionConversionOptions,
  type McpDescriptionJsonPatchOperation,
} from '@mcpdesc/core';
import type { McpDescDocument } from './mcpdesc-converter.js';
import { DEFAULT_MIGRATION_VERSION, UNSUPPORTED_07_GUIDANCE, resolveOutputSelection, type SelectionSource } from './mcpdesc-target.js';
import { Validator } from './validator.js';

export interface MigrationStep {
  from: string;
  to: string;
  status: string;
  diagnostics: readonly CoreDiagnostic[];
}

interface MigrationReport {
  from: string;
  to: string;
  status: 'converted' | 'unchanged' | 'blocked' | 'invalid-source' | 'unsupported';
  diagnostics: readonly CoreDiagnostic[];
  steps: MigrationStep[];
  selector?: string;
  selectionSource?: SelectionSource;
  sourceSelector?: string;
  sourceSelectionSource?: SelectionSource;
}

export type MigrationResult = MigrationReport & (
  { ok: true; value: McpDescDocument; patch: readonly McpDescriptionJsonPatchOperation[] } |
  { ok: false }
);

export async function migrateMcpDescription(
  source: McpDescDocument,
  options: { selector?: string; fixes?: readonly McpDescriptionConversionFix[] } = {},
): Promise<MigrationResult> {
  const to = DEFAULT_MIGRATION_VERSION;
  const from = source.mcpdesc;
  const steps: MigrationStep[] = [];
  const diagnostics: CoreDiagnostic[] = [];
  let selection: ReturnType<typeof resolveOutputSelection> | undefined;
  let sourceSelector: string | undefined;
  let sourceSelectionSource: SelectionSource | undefined;
  const report = (status: MigrationReport['status']): MigrationReport => ({
    from, to, status, steps, diagnostics, selector: selection?.selector,
    selectionSource: selection?.source, sourceSelector, sourceSelectionSource,
  });
  if (from === '0.7.0') {
    diagnostics.push({ code: 'unsupported-format-version', severity: 'error', phase: 'source',
      path: ['mcpdesc'], message: UNSUPPORTED_07_GUIDANCE });
    return { ...report('unsupported'), ok: false };
  }
  if (!['0.8.0', '0.9.0'].includes(from)) {
    diagnostics.push({ code: 'migration-path-undefined', severity: 'error', phase: 'operation', path: [],
      message: `No supported migration path from ${from} to ${to}; downgrades and unsupported upgrades are not implicit.` });
    return { ...report('unsupported'), ok: false };
  }

  selection = resolveOutputSelection(to, options.selector);
  const sourceValidation = await new Validator().validateData(source, 'mcpdesc');
  sourceSelector = sourceValidation.selector;
  sourceSelectionSource = sourceValidation.selectionSource ?? (source.$schema ? 'schema-derived' : 'default');
  if (!sourceValidation.valid) {
    diagnostics.push(...sourceValidation.errors.map((issue): CoreDiagnostic => ({
      code: issue.keyword ?? 'migration-source-invalid', severity: 'error', phase: 'source',
      rule: issue.rule, path: [], message: `${issue.path}: ${issue.message}`,
    })));
    return { ...report('invalid-source'), ok: false };
  }

  if (from === '0.8.0' && to === '0.9.0') {
    const conversion = convertMcpDescriptionVersion(source, {
      from: '0.8.0', to, selector: selection.selector as McpDescriptionConversionOptions['selector'], fixes: options.fixes,
    });
    diagnostics.push(...conversion.diagnostics);
    steps.push({ from: '0.8.0', to, status: conversion.status, diagnostics: conversion.diagnostics });
    if (!conversion.ok) return { ...report(conversion.status), ok: false };
    return {
      ...report('converted'), ok: true,
      value: conversion.value as unknown as McpDescDocument, patch: conversion.patch,
    };
  }
  if (options.fixes?.length) throw new Error('Fixes apply only to the 0.8.0 to 0.9.0 migration step');
  const validation = await new Validator().validateData(source, 'mcpdesc', 'data', selection.selector);
  if (!validation.valid) {
    diagnostics.push(...validation.errors.map((issue): CoreDiagnostic => ({
      code: issue.keyword ?? 'migration-source-invalid', severity: 'error', phase: 'source',
      path: [], message: `${issue.path}: ${issue.message}`,
    })));
    return { ...report('invalid-source'), ok: false };
  }
  return { ...report('unchanged'), ok: true, value: source, patch: [] };
}