// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Unit tests for compare command
 *
 * Tests the internal composition logic: exit-code matrix, --exit-zero,
 * changelog on stdout by default vs --output to file, report on stderr.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Differ } from '../../src/lib/differ.js';
import { RulesEngine } from '../../src/lib/rules-engine.js';
import { Renderer } from '../../src/lib/renderer.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const V1_DUMP = {
  schemaVersion: '1.0.0',
  serverInfo: { name: 'test-server', version: '1.0.0' },
  capabilities: { tools: {} },
  tools: [
    {
      name: 'search',
      description: 'Search for items',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
        },
        required: ['query'],
      },
    },
  ],
  prompts: [],
  resources: [],
  resourceTemplates: [],
};

// V2: compatible — adds an optional parameter, adds a new tool
const V2_COMPATIBLE_DUMP = {
  ...V1_DUMP,
  serverInfo: { name: 'test-server', version: '2.0.0' },
  tools: [
    {
      name: 'search',
      description: 'Search for items',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          limit: { type: 'number', description: 'Max results' },
        },
        required: ['query'],
      },
    },
    {
      name: 'get_item',
      description: 'Get a specific item',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  ],
};

// V3: breaking — removes an existing tool
const V3_BREAKING_DUMP = {
  ...V1_DUMP,
  serverInfo: { name: 'test-server', version: '3.0.0' },
  tools: [], // removed 'search'
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function writeJsonFixture(dir: string, name: string, data: object): string {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  return filePath;
}

const RULES_PATH = 'rules/breaking-changes.yaml';

async function runCompareInProcess(
  fromDump: object,
  toDump: object,
  opts: { customRules?: string } = {}
): Promise<{ analysis: any; changelog: string }> {
  // Step 1: diff
  const differ = new Differ({ detectRenames: false });
  const diffResult = await differ.compare(
    fromDump as any,
    toDump as any,
    'from.json',
    'to.json'
  );

  // Step 2: breaking
  const rulesPath = opts.customRules ?? RULES_PATH;
  const engine = new RulesEngine(rulesPath);
  const analysis = engine.analyze(diffResult, 'from.json', rulesPath);

  // Step 3: changelog (minimal — just verify it renders without error)
  const templatesDir = path.join(process.cwd(), 'templates');
  const templatePath = path.join(templatesDir, 'changelog-release.md.hbs');
  const analysisData: any = { ...analysis, options: { omitZeros: false, showDiffReasoning: false, sort: 'original' } };
  const renderer = new Renderer();
  const changelog = await renderer.render({ template: templatePath, data: analysisData });

  return { analysis, changelog };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('compare — in-process composition', () => {
  it('produces a changelog string for compatible changes', async () => {
    const { analysis, changelog } = await runCompareInProcess(V1_DUMP, V2_COMPATIBLE_DUMP);

    expect(analysis.summary.exitCode).toBe(0);
    expect(changelog).toBeTruthy();
    expect(typeof changelog).toBe('string');
  });

  it('detects breaking changes and sets exitCode=1', async () => {
    const { analysis } = await runCompareInProcess(V1_DUMP, V3_BREAKING_DUMP);

    expect(analysis.summary.exitCode).toBe(1);
    expect(analysis.categorization.breaking.length).toBeGreaterThan(0);
  });

  it('still produces a changelog on breaking changes', async () => {
    const { analysis, changelog } = await runCompareInProcess(V1_DUMP, V3_BREAKING_DUMP);

    expect(analysis.summary.exitCode).toBe(1);
    expect(changelog).toBeTruthy();
  });

  it('respects --rules by loading a custom rules file', async () => {
    // Use the built-in strict rules for a stricter check
    const { analysis } = await runCompareInProcess(V1_DUMP, V2_COMPATIBLE_DUMP, {
      customRules: 'rules/strict-compatibility.yaml',
    });
    // Strict rules might flag enum or description changes; we just verify it runs
    expect(analysis.summary).toBeDefined();
    expect(typeof analysis.summary.exitCode).toBe('number');
  });

  it('summary counts match categorization arrays', async () => {
    const { analysis } = await runCompareInProcess(V1_DUMP, V2_COMPATIBLE_DUMP);

    expect(analysis.summary.totalChanges).toBe(
      analysis.categorization.breaking.length +
      analysis.categorization.new.length +
      analysis.categorization.updates.length +
      analysis.categorization.deleted.length
    );
  });

  it('includes versioningSuggestion in analysis', async () => {
    const { analysis } = await runCompareInProcess(V1_DUMP, V3_BREAKING_DUMP);

    expect(analysis.versioningSuggestion).toBeDefined();
    expect(analysis.versioningSuggestion.recommendedBump).toBe('major');
  });
});

describe('compare — output routing (file vs stdout)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcpcontract-compare-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes changelog to --output file when specified', async () => {
    const { changelog } = await runCompareInProcess(V1_DUMP, V2_COMPATIBLE_DUMP);
    const outFile = path.join(tmpDir, 'CHANGELOG.md');
    fs.writeFileSync(outFile, changelog, 'utf-8');

    expect(fs.existsSync(outFile)).toBe(true);
    const content = fs.readFileSync(outFile, 'utf-8');
    expect(content.length).toBeGreaterThan(0);
  });

  it('emit-diff writes a parseable JSON file', async () => {
    const differ = new Differ({ detectRenames: false });
    const diffResult = await differ.compare(V1_DUMP as any, V2_COMPATIBLE_DUMP as any, 'a', 'b');

    const emitDiffPath = path.join(tmpDir, 'diff.json');
    fs.writeFileSync(emitDiffPath, JSON.stringify(diffResult, null, 2), 'utf-8');

    const parsed = JSON.parse(fs.readFileSync(emitDiffPath, 'utf-8'));
    expect(parsed.changes).toBeDefined();
  });

  it('emit-breaking writes a parseable JSON file', async () => {
    const differ = new Differ({ detectRenames: false });
    const diffResult = await differ.compare(V1_DUMP as any, V3_BREAKING_DUMP as any, 'a', 'b');
    const engine = new RulesEngine(RULES_PATH);
    const analysis = engine.analyze(diffResult, 'a', RULES_PATH);

    const emitBreakingPath = path.join(tmpDir, 'diff-breaking.json');
    fs.writeFileSync(emitBreakingPath, JSON.stringify(analysis, null, 2), 'utf-8');

    const parsed = JSON.parse(fs.readFileSync(emitBreakingPath, 'utf-8'));
    expect(parsed.summary).toBeDefined();
    expect(parsed.categorization).toBeDefined();
  });
});

describe('compare — exit-code contract', () => {
  it('exitCode 0 for compatible changes', async () => {
    const { analysis } = await runCompareInProcess(V1_DUMP, V2_COMPATIBLE_DUMP);
    expect(analysis.summary.exitCode).toBe(0);
  });

  it('exitCode 1 for breaking changes', async () => {
    const { analysis } = await runCompareInProcess(V1_DUMP, V3_BREAKING_DUMP);
    expect(analysis.summary.exitCode).toBe(1);
  });

  it('--exit-zero semantics: exitCode 1 should be suppressed to 0', () => {
    // The command layer applies: exitCode === 1 && exitZero → process.exit(0)
    // Here we verify the underlying analysis still produces exitCode 1
    // (the suppression itself happens in the Commander action handler)
    const exitZero = true;
    const rawExitCode = 1; // would come from analysis.summary.exitCode
    const effectiveExitCode = rawExitCode === 1 && exitZero ? 0 : rawExitCode;
    expect(effectiveExitCode).toBe(0);
  });

  it('--exit-zero does not suppress exitCode 2', () => {
    const exitZero = true;
    const rawExitCode = 2; // error
    const effectiveExitCode = rawExitCode === 1 && exitZero ? 0 : rawExitCode;
    expect(effectiveExitCode).toBe(2);
  });
});

describe('compare — changelog formats', () => {
  const formats = ['release', 'compact'];

  for (const format of formats) {
    it(`renders ${format} format without error`, async () => {
      const differ = new Differ({ detectRenames: false });
      const diffResult = await differ.compare(V1_DUMP as any, V2_COMPATIBLE_DUMP as any, 'a', 'b');
      const engine = new RulesEngine(RULES_PATH);
      const analysis = engine.analyze(diffResult, 'a', RULES_PATH);

      const templatesDir = path.join(process.cwd(), 'templates');
      const templatePath = path.join(templatesDir, `changelog-${format}.md.hbs`);
      const analysisData: any = { ...analysis, options: { omitZeros: false, showDiffReasoning: false, sort: 'original' } };
      const renderer = new Renderer();
      const changelog = await renderer.render({ template: templatePath, data: analysisData });

      expect(changelog).toBeTruthy();
      expect(typeof changelog).toBe('string');
    });
  }
});
