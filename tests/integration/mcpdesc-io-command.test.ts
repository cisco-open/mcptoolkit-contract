import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { parseMcpDescriptionSource } from '@mcpdesc/core';

jest.setTimeout(60_000);

describe('shared MCP Description input and output policy', () => {
  let directory: string;
  let input: string;
  let jsonInput: string;
  const document = {
    mcpdesc: '0.9.0',
    info: { name: 'scalar-test', version: '012' },
    protocolVersions: ['2026-07-28'],
    tools: [{
      name: 'platform-identity_lookup', description: '0o12',
      inputSchema: { type: 'object', properties: { flag: { const: 'TRUE' } } },
    }],
  };
  const commands = () => [
    ['normalize', input, '--format', 'yaml', '--quiet'],
    ['validate', input, '--format', 'json'],
    ['validate', input, '--schema', 'mcpdesc', '--format', 'json'],
    ['project', input, '--format', 'yaml', '--quiet'],
    ['document', input, '--quiet'],
    ['document', input, '--type', 'mcpdesc', '--quiet'],
    ['diff', '--from', input, '--to', jsonInput, '--quiet'],
    ['compare', '--from', input, '--to', jsonInput, '--quiet', '--exit-zero'],
    ['split', input, '--config', 'tests/fixtures/split/split-config-basic.yaml', '--dry-run', '--quiet'],
  ];
  const run = (args: string[]) => spawnSync(process.execPath, ['build/index.js', ...args], { encoding: 'utf-8' });

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'mcpcontract-io-'));
    input = join(directory, 'input.yaml');
    jsonInput = join(directory, 'input.json');
    await writeFile(jsonInput, JSON.stringify(document));
    await writeFile(input, `mcpdesc: 0.9.0
info:
  name: scalar-test
  version: 012
protocolVersions:
  - "2026-07-28"
tools:
  - name: platform-identity_lookup
    description: 0o12
    inputSchema:
      type: object
      properties:
        flag:
          const: TRUE
`);
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('uses the same scalar interpretation across all modern document readers', () => {
    for (const args of commands()) {
      const result = run(args);
      expect({ args, status: result.status, stderr: result.stderr }).toMatchObject({ status: 0 });
      if (args[0] === 'diff') expect(JSON.parse(result.stdout).changes).toEqual([]);
      if (args[0] === 'document') expect(result.stdout).toContain('0o12');
      if (args[0] === 'compare') expect(result.stdout).toContain('0 changes');
      if (args[0] === 'normalize' || args[0] === 'project') {
        expect(parseMcpDescriptionSource(result.stdout)).toMatchObject({ ok: true, value: document });
        expect(result.stdout).toContain('- "2026-07-28"');
        expect(result.stdout).toMatch(/[^\n]\n$/);
      }
    }
  });

  it('rejects 0.7.0 everywhere with verified historical guidance', async () => {
    await writeFile(input, JSON.stringify({ ...document, mcpdesc: '0.7.0' }));
    for (const args of commands()) {
      const result = run(args);
      expect({ args, status: result.status }).not.toMatchObject({ status: 0 });
      expect(result.stderr).toContain('@cisco_open/mcptoolkit-contract@2.0.5');
      expect(result.stdout).toBe('');
    }
  });

  it('recommends explicit migration for 0.8.0 inputs on stderr without upgrading', async () => {
    await writeFile(input, JSON.stringify({ ...document, mcpdesc: '0.8.0' }));
    for (const args of commands()) {
      const result = run(args);
      expect({ args, status: result.status, stderr: result.stderr }).toMatchObject({ status: 0 });
      expect(result.stderr).toContain('mcpcontract migrate <input> --output <new-file>');
      expect(result.stdout).not.toContain('Recommendation:');
      expect(result.stderr.match(/Recommendation:/g)).toHaveLength(1);
      if (args[0] === 'normalize' || args[0] === 'project') {
        expect(parseMcpDescriptionSource(result.stdout)).toMatchObject({
          ok: true, value: { mcpdesc: '0.8.0' },
        });
      }
    }
    const migrated = run(['migrate', input, '--quiet']);
    expect(migrated.status).toBe(0);
    expect(migrated.stderr).not.toContain('Recommendation:');
    expect(JSON.parse(migrated.stdout).mcpdesc).toBe('0.9.0');
  });

  it('does not retry malformed modern input through a permissive parser', async () => {
    await writeFile(input, 'mcpdesc: 0.9.0\ninfo: !unknown value\n');
    for (const args of commands()) {
      const result = run(args);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('tag');
    }
  });

  it('writes normalized split output that other commands can read unchanged', async () => {
    const result = run([
      'split', input, '--config', 'tests/fixtures/split/split-config-basic.yaml',
      '--output-dir', directory, '--format', 'yaml', '--validate', '--quiet',
    ]);
    expect({ status: result.status, stderr: result.stderr }).toMatchObject({ status: 0 });
    const output = join(directory, 'dump-platform-identity.yaml');
    const yaml = await readFile(output, 'utf-8');
    expect(yaml).toContain('- "2026-07-28"');
    expect(yaml).toMatch(/[^\n]\n$/);
    const validated = run(['validate', output, '--format', 'json']);
    expect(validated.status).toBe(0);
    expect(JSON.parse(validated.stdout).valid).toBe(true);
    const diff = run(['diff', '--from', output, '--to', jsonInput, '--quiet']);
    expect(diff.status).toBe(0);
    expect(JSON.parse(diff.stdout).changes).toEqual([]);
  });

  it('normalizes native projection without reordering it as a complete document', () => {
    const result = run([
      'project', input, '--view', 'native', '--kind', 'tool',
      '--identifier', 'platform-identity_lookup', '--protocol-version', '2026-07-28',
      '--format', 'yaml', '--key-order', 'document', '--quiet',
    ]);
    expect({ status: result.status, stderr: result.stderr }).toMatchObject({ status: 0 });
    expect(parseMcpDescriptionSource(result.stdout)).toMatchObject({ ok: true, value: document.tools[0] });
    expect(result.stdout.startsWith('name:')).toBe(true);
    expect(result.stdout).toMatch(/[^\n]\n$/);
  });

  it('keeps normalized YAML and compact JSON migration output separate', async () => {
    await writeFile(input, JSON.stringify({ ...document, mcpdesc: '0.8.0' }));
    const yaml = run(['migrate', input, '--format', 'yaml', '--quiet']);
    expect({ status: yaml.status, stderr: yaml.stderr }).toMatchObject({ status: 0 });
    expect(parseMcpDescriptionSource(yaml.stdout)).toMatchObject({ ok: true, value: document });
    expect(yaml.stdout).toContain('- "2026-07-28"');
    expect(yaml.stdout).toMatch(/[^\n]\n$/);
    const json = run(['migrate', input, '--compact', '--quiet']);
    expect(json.status).toBe(0);
    expect(json.stdout).toBe(`${JSON.stringify(document)}\n`);
  });
});
