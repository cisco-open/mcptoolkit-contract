import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

describe('migrate command', () => {
  let directory: string | undefined;
  let input: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'mcpcontract-migrate-'));
    input = join(directory, 'stable.json');
    await writeFile(input, JSON.stringify({
      $schema: 'https://mcpdesc.org/schema/mcp-description/0.8.0.json',
      mcpdesc: '0.8.0',
      info: { name: 'migration-test', version: '1.0.0' },
      protocolVersions: ['2026-07-28'],
      tools: [{
        name: 'lookup',
        inputSchema: { type: 'object' },
        annotations: { customFlag: true },
      }],
    }), 'utf-8');
  });

  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it('chains 0.7 through 0.8 to the active target by default and patches the original source', async () => {
    const legacy = {
      mcpdesc: '0.7.0',
      info: { name: 'legacy', version: '1.0.0', protocolVersion: '2025-11-25' },
      transports: [{ type: 'stdio', command: 'legacy-server' }],
      tools: [{ name: 'lookup', inputSchema: { type: 'object' } }],
    };
    await writeFile(input, JSON.stringify(legacy));
    const reportPath = join(directory!, 'chain-report.json');
    const patchPath = join(directory!, 'chain-patch.json');
    const output = execFileSync(process.execPath, [
      'build/index.js', 'migrate', input, '--report', reportPath, '--patch', patchPath, '--quiet',
    ], { encoding: 'utf-8' });
    const document = JSON.parse(output);
    expect(document.mcpdesc).toBe('0.9.0');
    expect(document.$schema).toContain('0.9.0-draft.4');
    expect(JSON.parse(await readFile(reportPath, 'utf-8')).steps).toEqual([
      expect.objectContaining({ from: '0.7.0', to: '0.8.0', status: 'converted' }),
      expect.objectContaining({ from: '0.8.0', to: '0.9.0', status: 'converted' }),
    ]);
    expect(JSON.parse(await readFile(patchPath, 'utf-8'))).toEqual([
      { op: 'replace', path: '', value: document },
    ]);
    expect(JSON.parse(await readFile(input, 'utf-8'))).toEqual(legacy);

    const stable = JSON.parse(execFileSync(process.execPath, [
      'build/index.js', 'migrate', input, '--to-version', '0.8.0', '--quiet',
    ], { encoding: 'utf-8' }));
    expect(stable.mcpdesc).toBe('0.8.0');
  }, 20_000);

  it('directs mcpdesc inputs away from convert and toward migrate', () => {
    const result = spawnSync(process.execPath, ['build/index.js', 'convert', input], { encoding: 'utf-8' });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('mcpcontract migrate');
  });

  it('converts legacy dumps to the active target with clean stdout', async () => {
    await writeFile(input, JSON.stringify({
      version: '0.3.8',
      dumpDetails: {
        toolName: 'legacy', toolVersion: '1.0.0', createdAt: '2026-01-01T00:00:00Z',
        mcpServerConfig: { transport: 'stdio', command: 'server' },
        dumpExecution: { mcpProtocolUsed: '2025-11-25' },
      },
      serverInfo: { name: 'legacy', version: '1.0.0', protocolVersion: '2025-11-25', capabilities: { tools: {} } },
      tools: [{ name: 'lookup', inputSchema: { type: 'object' } }],
      resources: [], resourceTemplates: [], prompts: [],
    }));
    const converted = spawnSync(process.execPath, ['build/index.js', 'convert', input], { encoding: 'utf-8' });
    expect(converted.status).toBe(0);
    expect(JSON.parse(converted.stdout)).toMatchObject({ mcpdesc: '0.9.0' });
    expect(converted.stderr).not.toContain('deprecated');
  });

  it('reports blockers and only applies an explicitly requested fix', async () => {
    const reportPath = join(directory, 'report.json');
    const outputPath = join(directory, 'draft.json');
    const blocked = spawnSync(process.execPath, [
      'build/index.js', 'migrate', input,
      '--to-version', '0.9.0',
      '--report', reportPath,
      '--output', outputPath,
    ], { encoding: 'utf-8' });

    expect(blocked.status).toBe(1);
    await expect(readFile(outputPath, 'utf-8')).rejects.toMatchObject({ code: 'ENOENT' });
    const blockedReport = JSON.parse(await readFile(reportPath, 'utf-8'));
    expect(blockedReport.status).toBe('blocked');
    expect(blockedReport.diagnostics).toContainEqual(
      expect.objectContaining({ severity: 'error', rule: 'mcpdesc.conversion.0-8-to-0-9.tool-annotations-closed' }),
    );

    const fixesPath = join(directory, 'fixes.json');
    const patchPath = join(directory, 'patch.json');
    await writeFile(fixesPath, JSON.stringify({ fixes: [{
      fix: 'remove-property',
      path: ['tools', 0, 'annotations', 'customFlag'],
    }] }), 'utf-8');

    execFileSync(process.execPath, [
      'build/index.js', 'migrate', input,
      '--to-version', '0.9.0',
      '--fixes', fixesPath,
      '--output', outputPath,
      '--patch', patchPath,
      '--quiet',
    ]);

    const migrated = JSON.parse(await readFile(outputPath, 'utf-8'));
    expect(migrated.mcpdesc).toBe('0.9.0');
    expect(migrated.$schema).toBe('https://mcpdesc.org/schema/mcp-description/0.9.0-draft.4.json');
    expect(migrated.tools[0].annotations).not.toHaveProperty('customFlag');
    expect(JSON.parse(await readFile(patchPath, 'utf-8'))).toContainEqual(
      expect.objectContaining({ op: 'remove', path: '/tools/0/annotations/customFlag' }),
    );
  }, 20_000);

  it('reports unsupported source versions without guessing an upgrade path', async () => {
    await writeFile(input, JSON.stringify({ mcpdesc: '9.9.9', info: { name: 'future', version: '1.0.0' } }));
    const reportPath = join(directory!, 'unsupported.json');
    const result = spawnSync(process.execPath, [
      'build/index.js', 'migrate', input, '--report', reportPath,
    ], { encoding: 'utf-8' });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(JSON.parse(await readFile(reportPath, 'utf-8'))).toMatchObject({ status: 'unsupported', steps: [] });
  });
});