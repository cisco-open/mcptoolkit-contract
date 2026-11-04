import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

const draftDocument = {
  $schema: 'https://mcpdesc.org/schema/mcp-description/0.9.0-draft.4.json',
  mcpdesc: '0.9.0',
  info: { name: 'project-test', version: '1.0.0' },
  protocolVersions: ['2025-11-25', '2026-07-28'],
  tools: [
    {
      name: 'lookup',
      description: 'Legacy',
      protocolVersions: ['2025-11-25'],
      inputSchema: { type: 'object' },
    },
    {
      name: 'lookup',
      description: 'Modern',
      protocolVersions: ['2026-07-28'],
      inputSchema: { type: 'object' },
    },
  ],
};

describe('project command', () => {
  let directory: string;
  let input: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'mcpcontract-project-'));
    input = join(directory, 'draft.json');
    await writeFile(input, JSON.stringify(draftDocument), 'utf-8');
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('exports an Effective Protocol View as JSON', () => {
    const output = execFileSync(process.execPath, [
      'build/index.js', 'project', input,
      '--view', 'effective',
      '--protocol-version', '2026-07-28',
    ], { encoding: 'utf-8' });
    const view = JSON.parse(output);

    expect(view.protocolVersions).toEqual(['2026-07-28']);
    expect(view.tools).toEqual([
      expect.objectContaining({ name: 'lookup', description: 'Modern' }),
    ]);
  });

  it('projects one native MCP declaration', () => {
    const output = execFileSync(process.execPath, [
      'build/index.js', 'project', input,
      '--view', 'native',
      '--protocol-version', '2026-07-28',
      '--kind', 'tool',
      '--identifier', 'lookup',
    ], { encoding: 'utf-8' });

    expect(JSON.parse(output)).toMatchObject({ name: 'lookup', description: 'Modern' });
  });

  it('rejects parsed scalar input as a non-document', async () => {
    await writeFile(input, 'null', 'utf-8');
    const result = spawnProject(input);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Input must be an MCP Description document');
  });

  it('uses the pinned active target when the document omits $schema', async () => {
    const document = { ...draftDocument };
    delete (document as { $schema?: string }).$schema;
    await writeFile(input, JSON.stringify(document));
    const output = execFileSync(process.execPath, [
      'build/index.js', 'project', input, '--protocol-version', '2026-07-28',
    ], { encoding: 'utf-8' });
    expect(JSON.parse(output).protocolVersions).toEqual(['2026-07-28']);
  });

  it('rejects historical processing inputs with upgrade guidance', async () => {
    await writeFile(input, JSON.stringify({
      ...draftDocument, mcpdesc: '0.8.0',
      $schema: 'https://mcpdesc.org/schema/mcp-description/0.8.0.json',
    }));
    for (const command of [
      ['project', input],
      ['document', input, '--quiet'],
      ['diff', '--from', input, '--to', input, '--quiet'],
      ['compare', '--from', input, '--to', input, '--quiet'],
      ['split', input, '--config', 'tests/fixtures/split/split-config-basic.yaml', '--dry-run', '--quiet'],
    ]) {
      const result = spawnSync(process.execPath, ['build/index.js', ...command], { encoding: 'utf-8' });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('mcpcontract migrate');
      expect(result.stderr).toContain('CLI 2.0.5');
    }
  }, 20_000);
});

function spawnProject(inputPath: string) {
  return spawnSync(process.execPath, ['build/index.js', 'project', inputPath], { encoding: 'utf-8' });
}