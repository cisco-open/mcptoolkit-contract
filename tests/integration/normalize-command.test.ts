import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { parseMcpDescriptionSource } from '@mcpdesc/core';

describe('normalize command', () => {
  let directory: string;
  let input: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'mcpcontract-normalize-'));
    input = join(directory, 'input.json');
    await writeFile(input, JSON.stringify({
      tools: [{ name: 'lookup', inputSchema: { type: 'object' } }],
      info: { version: '1.0.0', name: 'normalize-test' },
      mcpdesc: '0.9.0',
      protocolVersions: ['2026-07-28'],
      $schema: 'https://mcpdesc.org/schema/mcp-description/0.9.0.json',
    }), 'utf-8');
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('uses document-oriented key order and indented YAML sequences', () => {
    const output = execFileSync(process.execPath, [
      'build/index.js', 'normalize', input, '--format', 'yaml',
    ], { encoding: 'utf-8' });

    expect(output.indexOf('mcpdesc:')).toBeLessThan(output.indexOf('info:'));
    expect(output.indexOf('info:')).toBeLessThan(output.indexOf('protocolVersions:'));
    expect(output.indexOf('protocolVersions:')).toBeLessThan(output.indexOf('tools:'));
    expect(output).toMatch(/protocolVersions:\n  - "2026-07-28"/);
    expect(output).toMatch(/[^\n]\n$/);
  });

  it.each(['document', 'preserve', 'sorted'])('normalizes YAML with %s order losslessly and idempotently', async (order) => {
    const document = {
      mcpdesc: '0.9.0',
      info: { name: 'scalar-test', version: '1.0.0' },
      protocolVersions: ['2026-07-28'],
      'x-payload': {
        z: 'on', a: '0o12', 'TRUE': '012', empty: '', null: null, boolean: true, number: 12,
        blocks: ['a\nb', 'a\nb\n', 'a\nb\n\n', 'a\r\nb\r\n'],
        significant: [[], {}, null],
      },
    };
    await writeFile(input, JSON.stringify(document));
    const args = ['build/index.js', 'normalize', input, '--format', 'yaml', '--key-order', order];
    const output = execFileSync(process.execPath, args, { encoding: 'utf-8' });
    const parsed = parseMcpDescriptionSource(output);
    expect(parsed).toMatchObject({ ok: true, value: document });
    expect(output).toContain('z: "on"');
    expect(output).toContain('"TRUE": "012"');
    expect(output).toMatch(/[^\n]\n$/);
    await writeFile(input, output);
    expect(execFileSync(process.execPath, args, { encoding: 'utf-8' })).toBe(output);
    if (order === 'sorted') {
      expect(output.indexOf('a: 0o12')).toBeLessThan(output.indexOf('z: "on"'));
    }
  });

  it('rejects retired selector identities instead of silently normalizing with newer rules', async () => {
    await writeFile(input, JSON.stringify({
      mcpdesc: '0.9.0',
      $schema: 'https://mcpdesc.org/schema/mcp-description/0.9.0-rc.1.json',
      info: { name: 'retired', version: '1.0.0' },
    }), 'utf-8');
    const result = spawnSync(process.execPath, ['build/index.js', 'normalize', input], { encoding: 'utf-8' });

    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('supported selector');
  });
});
