import {
  convertMcpDescriptionVersion,
  type CoreDiagnostic,
  type JsonObject,
  type McpDescriptionConversionFix,
  type McpDescriptionConversionOptions,
  type McpDescriptionJsonPatchOperation,
} from '@mcpdesc/core';
import { migrateMcpDescription07To08, type McpDescDocument } from './mcpdesc-converter.js';
import { DEFAULT_OUTPUT_VERSION, resolveOutputSelection, type SelectionSource } from './mcpdesc-target.js';
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
  options: { toVersion?: string; selector?: string; fixes?: readonly McpDescriptionConversionFix[] } = {},
): Promise<MigrationResult> {
  const to = options.toVersion ?? DEFAULT_OUTPUT_VERSION;
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
  if (
    !['0.7.0', '0.8.0', '0.9.0'].includes(from) ||
    !['0.8.0', '0.9.0'].includes(to) ||
    (from === '0.9.0' && to === '0.8.0')
  ) {
    diagnostics.push({ code: 'migration-path-undefined', severity: 'error', phase: 'operation', path: [],
      message: `No supported migration path from ${from} to ${to}; use --to-version to choose a supported destination. Downgrades are not implicit.` });
    return { ...report('unsupported'), ok: false };
  }

  selection = resolveOutputSelection(to, options.selector);
  const sourceValidation = await new Validator().validateData(source, 'mcpdesc');
  sourceSelector = sourceValidation.selector ?? (from === '0.7.0' ? '0.7.0' : undefined);
  sourceSelectionSource = sourceValidation.selectionSource ?? (source.$schema ? 'schema-derived' : 'default');
  if (!sourceValidation.valid) {
    diagnostics.push(...sourceValidation.errors.map((issue): CoreDiagnostic => ({
      code: issue.keyword ?? 'migration-source-invalid', severity: 'error', phase: 'source',
      rule: issue.rule, path: [], message: `${issue.path}: ${issue.message}`,
    })));
    return { ...report('invalid-source'), ok: false };
  }

  let document = source;
  if (from === '0.7.0') {
    try {
      const migration = await migrateMcpDescription07To08(document, 'data', to === '0.8.0'
        ? selection.selector as '0.8.0' | '0.8.0-rev.20261021' : undefined);
      document = migration.document;
      diagnostics.push(...migration.diagnostics);
      steps.push({ from: '0.7.0', to: '0.8.0', status: 'converted', diagnostics: migration.diagnostics });
    } catch (error) {
      const finding: CoreDiagnostic = { code: 'migration-source-invalid', severity: 'error', phase: 'source',
        path: [], message: (error as Error).message };
      diagnostics.push(finding);
      steps.push({ from: '0.7.0', to: '0.8.0', status: 'invalid-source', diagnostics: [finding] });
      return { ...report('invalid-source'), ok: false };
    }
  }

  if (document.mcpdesc === '0.8.0' && to === '0.9.0') {
    const conversion = convertMcpDescriptionVersion(document, {
      from: '0.8.0', to, selector: selection.selector as McpDescriptionConversionOptions['selector'], fixes: options.fixes,
    });
    diagnostics.push(...conversion.diagnostics);
    steps.push({ from: '0.8.0', to, status: conversion.status, diagnostics: conversion.diagnostics });
    if (!conversion.ok) return { ...report(conversion.status), ok: false };
    document = conversion.value as unknown as McpDescDocument;
    if (from === '0.8.0') {
      return { ...report('converted'), ok: true, value: document, patch: conversion.patch };
    }
  } else {
    if (options.fixes?.length) throw new Error('Fixes apply only to the 0.8.0 to 0.9.0 migration step');
    const validation = await new Validator().validateData(document, 'mcpdesc', 'data', selection.selector);
    if (!validation.valid) {
      diagnostics.push(...validation.errors.map((issue): CoreDiagnostic => ({
        code: issue.keyword ?? 'migration-source-invalid', severity: 'error', phase: 'source',
        path: [], message: `${issue.path}: ${issue.message}`,
      })));
      return { ...report('invalid-source'), ok: false };
    }
  }

  const patch: McpDescriptionJsonPatchOperation[] = from === to ? [] : [
    { op: 'replace', path: '', value: document as unknown as JsonObject },
  ];
  return { ...report(from === to ? 'unchanged' : 'converted'), ok: true, value: document, patch };
}