import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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

describe('validate compatibility display', () => {
  const run = (...args: string[]) => spawnSync(process.execPath, [
    'build/index.js', 'validate', '--show-compatibility', ...args,
  ], { encoding: 'utf-8' });

  it('summarizes installed support without an input file', async () => {
    const { version } = JSON.parse(await readFile('package.json', 'utf-8'));
    const result = run();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`mcpcontract ${version}`);
    expect(result.stdout).toContain('Validate and process: 0.8.0, 0.9.0');
    expect(result.stdout).toContain('Migration target: 0.9.0');
    expect(result.stdout).toContain('--to-version 0.8.0');
    expect(result.stdout).toContain(`- ${version} (installed):`);
    expect(result.stdout).toContain('- 2.0.5: convert legacy dumps or 0.7.0 to 0.8.0.');
    expect(result.stdout).toContain('- 1.2.4: process 0.7.0 without upgrading.');
    expect(result.stdout).not.toContain('2.1.0-rc.2');
    expect(result.stdout).not.toContain('x-cisco-metadata:');
  });

  it('shows all recorded schema fields and complete notes in full text', async () => {
    const data = JSON.parse(await readFile('schemas/cli-schema-compatibility.json', 'utf-8'));
    const result = run('--display', 'full');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('curated');
    expect(result.stdout).toContain('2.0.5 (2026-10-27)');
    expect(result.stdout).toContain('1.2.4 (2026-09-07)');
    expect(result.stdout).toContain('2.1.0-rc.2 (2026-11-05)');
    for (const entry of data.compatibility) {
      expect(result.stdout).toContain(`${entry.cliVersion} (${entry.releaseDate})`);
      for (const [name, version] of Object.entries(entry.schemas)) {
        expect(result.stdout).toContain(`${name}: ${version}`);
      }
      if (entry.notes) expect(result.stdout).toContain(entry.notes);
    }
  });

  it('preserves both JSON modes and supports writing to a file', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'mcpcontract-compatibility-'));
    try {
      const output = join(directory, 'compatibility.json');
      const data = JSON.parse(await readFile('schemas/cli-schema-compatibility.json', 'utf-8'));
      expect(run('--display', 'full', '--format', 'json', '--output', output).status).toBe(0);
      expect(JSON.parse(await readFile(output, 'utf-8'))).toEqual(data);
      const short = run('--format', 'json');
      expect(short.status).toBe(0);
      expect(JSON.parse(short.stdout)).toEqual({
        ...data,
        compatibility: data.compatibility.filter((entry: { schemas: Record<string, string> }, index: number) =>
          index === 0 || Object.entries(entry.schemas).some(([key, value]) => value !== data.compatibility[index - 1].schemas[key])),
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 20_000);
});
