import {
  convertMcpDescriptionVersion,
  type CoreDiagnostic,
  type JsonObject,
  type McpDescriptionConversionFix,
  type McpDescriptionJsonPatchOperation,
} from '@mcpdesc/core';
import { migrateMcpDescription07To08, type McpDescDocument } from './mcpdesc-converter.js';
import { ACTIVE_MCPDESC_VERSION, ACTIVE_MCPDESC_SELECTOR, requireActiveDocument } from './mcpdesc-target.js';
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
}

export type MigrationResult = MigrationReport & (
  { ok: true; value: McpDescDocument; patch: readonly McpDescriptionJsonPatchOperation[] } |
  { ok: false }
);

export async function migrateMcpDescription(
  source: McpDescDocument,
  options: { toVersion?: string; fixes?: readonly McpDescriptionConversionFix[] } = {},
): Promise<MigrationResult> {
  const to = options.toVersion ?? ACTIVE_MCPDESC_VERSION;
  const from = source.mcpdesc;
  const steps: MigrationStep[] = [];
  const diagnostics: CoreDiagnostic[] = [];
  const report = (status: MigrationReport['status']): MigrationReport => ({ from, to, status, steps, diagnostics });
  if (
    !['0.7.0', '0.8.0', ACTIVE_MCPDESC_VERSION].includes(from) ||
    !['0.8.0', ACTIVE_MCPDESC_VERSION].includes(to) ||
    (from === ACTIVE_MCPDESC_VERSION && to === '0.8.0')
  ) {
    diagnostics.push({ code: 'migration-path-undefined', severity: 'error', phase: 'operation', path: [],
      message: `No supported migration path from ${from} to ${to}` });
    return { ...report('unsupported'), ok: false };
  }

  let document = source;
  if (from === '0.7.0') {
    try {
      const migration = await migrateMcpDescription07To08(document);
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

  if (document.mcpdesc === '0.8.0' && to === ACTIVE_MCPDESC_VERSION) {
    const conversion = convertMcpDescriptionVersion(document, {
      from: '0.8.0', to, selector: ACTIVE_MCPDESC_SELECTOR, fixes: options.fixes,
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
    if (to === ACTIVE_MCPDESC_VERSION) requireActiveDocument(document);
    const validation = await new Validator().validateData(document, 'mcpdesc');
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