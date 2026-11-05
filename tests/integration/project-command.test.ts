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

  it('uses RC.1 effective and native projection when the document omits $schema', async () => {
    const document = { ...draftDocument };
    delete (document as { $schema?: string }).$schema;
    await writeFile(input, JSON.stringify(document));
    const output = execFileSync(process.execPath, [
      'build/index.js', 'project', input, '--protocol-version', '2026-07-28',
    ], { encoding: 'utf-8' });
    expect(JSON.parse(output).protocolVersions).toEqual(['2026-07-28']);
    const native = execFileSync(process.execPath, [
      'build/index.js', 'project', input, '--view', 'native', '--kind', 'tool',
      '--protocol-version', '2026-07-28', '--identifier', 'lookup',
    ], { encoding: 'utf-8' });
    expect(JSON.parse(native)).toMatchObject({ name: 'lookup', description: 'Modern' });
  });

  it('processes stable inputs across document commands without migration', async () => {
    await writeFile(input, JSON.stringify({
      ...draftDocument, mcpdesc: '0.8.0',
      $schema: 'https://mcpdesc.org/schema/mcp-description/0.8.0.json',
      tools: draftDocument.tools.map((tool) => ({ ...tool, name: 'platform-identity_lookup' })),
    }));
    for (const command of [
      ['project', input, '--protocol-version', '2026-07-28'],
      ['document', input, '--protocol-version', '2026-07-28', '--quiet'],
      ['diff', '--from', input, '--to', input, '--protocol-version', '2026-07-28', '--quiet'],
      ['compare', '--from', input, '--to', input, '--protocol-version', '2026-07-28', '--quiet'],
      ['split', input, '--config', 'tests/fixtures/split/split-config-basic.yaml', '--dry-run', '--quiet'],
    ]) {
      const result = spawnSync(process.execPath, ['build/index.js', ...command], { encoding: 'utf-8' });
      expect({ command: command[0], status: result.status, stderr: result.stderr }).toMatchObject({ status: 0 });
    }
  }, 20_000);

  it('rejects native projection of stable input without writing partial output', async () => {
    await writeFile(input, JSON.stringify({ ...draftDocument, mcpdesc: '0.8.0', $schema: 'https://mcpdesc.org/schema/mcp-description/0.8.0.json' }));
    const result = spawnSync(process.execPath, [
      'build/index.js', 'project', input, '--view', 'native', '--kind', 'tool', '--protocol-version', '2026-07-28',
    ], { encoding: 'utf-8' });
    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('requires MCP Description 0.9.0');
  });

  it('uses the RC.1 protocol-version diagnostic without partial native output', () => {
    const result = spawnSync(process.execPath, [
      'build/index.js', 'project', input, '--view', 'native', '--kind', 'tool',
      '--selector', '0.9.0-rc.1', '--protocol-version', '2024-11-05',
    ], { encoding: 'utf-8' });
    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('projection-protocol-version-not-declared');
  });

  it('validates schema pins and explicit overrides with their actual resolution origin', () => {
    for (const [extra, expected] of [
      [[], { selector: '0.9.0-draft.4', selectionSource: 'schema-derived' }],
      [['--selector', '0.9.0-rc.1'], { selector: '0.9.0-rc.1', selectionSource: 'explicit' }],
    ] as const) {
      const report = JSON.parse(execFileSync(process.execPath, [
        'build/index.js', 'validate', input, '--format', 'json', ...extra,
      ], { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }));
      expect(report).toMatchObject({ valid: true, defaulted: false, ...expected });
    }
  });

  it('compares equivalent stable and RC views and detects changed declarations', async () => {
    const stable = join(directory, 'stable.json');
    const rc = join(directory, 'rc.json');
    await writeFile(stable, JSON.stringify({ ...draftDocument, mcpdesc: '0.8.0', $schema: 'https://mcpdesc.org/schema/mcp-description/0.8.0.json' }));
    await writeFile(rc, JSON.stringify({ ...draftDocument, $schema: 'https://mcpdesc.org/schema/mcp-description/0.9.0-rc.1.json' }));
    const diff = (from: string, to: string) => JSON.parse(execFileSync(process.execPath, [
      'build/index.js', 'diff', '--from', from, '--to', to, '--protocol-version', '2026-07-28', '--quiet',
    ], { encoding: 'utf-8' }));
    expect(diff(stable, rc).statistics).toEqual(diff(stable, stable).statistics);
    await writeFile(rc, JSON.stringify({ ...draftDocument, $schema: 'https://mcpdesc.org/schema/mcp-description/0.9.0-rc.1.json',
      tools: [...draftDocument.tools, { name: 'new_tool', inputSchema: { type: 'object' } }],
    }));
    expect(JSON.stringify(diff(stable, rc))).toContain('new_tool');
    const conflict = spawnSync(process.execPath, [
      'build/index.js', 'diff', '--from', stable, '--to', rc, '--protocol-version', '2026-07-28', '--selector', '0.9.0-rc.1',
    ], { encoding: 'utf-8' });
    expect(conflict.status).not.toBe(0);
    expect(conflict.stdout).toBe('');
  }, 20_000);
});

function spawnProject(inputPath: string) {
  return spawnSync(process.execPath, ['build/index.js', 'project', inputPath], { encoding: 'utf-8' });
}