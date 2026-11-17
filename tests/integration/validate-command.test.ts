import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

describe('validate command stable 0.9.0 diagnostics', () => {
  let directory: string;
  let input: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'mcpcontract-validate-'));
    input = join(directory, 'invalid.json');
    await writeFile(input, JSON.stringify({
      $schema: 'https://mcpdesc.org/schema/mcp-description/0.9.0.json',
      mcpdesc: '0.9.0',
      info: { name: 'invalid-test', version: '1.0.0' },
      protocolVersions: ['2026-07-28'],
      tools: [{ name: 'lookup', inputSchema: 42 }],
    }), 'utf-8');
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('retains structured details in JSON and text output', () => {
    const json = spawnSync(process.execPath, [
      'build/index.js', 'validate', input, '--format', 'json',
    ], { encoding: 'utf-8' });
    expect(json.status).toBe(1);
    const report = JSON.parse(json.stdout);
    expect(report.diagnostics).toContainEqual(expect.objectContaining({
      detail: expect.objectContaining({ kind: 'invalid-type' }),
    }));

    const text = spawnSync(process.execPath, [
      'build/index.js', 'validate', input,
    ], { encoding: 'utf-8' });
    expect(text.status).toBe(1);
    expect(`${text.stdout}\n${text.stderr}`).toContain('Detail: {"kind":"invalid-type"');
  });
});
