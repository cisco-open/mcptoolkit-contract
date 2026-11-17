import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.setTimeout(20_000);

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

  it('describes the maintained destination and ordering choices in help', () => {
    const help = execFileSync(process.execPath, ['build/index.js', 'migrate', '--help'], { encoding: 'utf-8' });
    expect(help).toContain('Upgrade MCP Description documents to the maintained target (0.9.0)');
    expect(help).toContain('Pin destination rules (default: 0.9.0-rc.3)');
    expect(help).not.toContain('source rules are resolved independently');
    for (const option of ['--output', '--format', '--key-order', '--compact', '--quiet']) {
      expect(help.indexOf(option)).toBeGreaterThan(-1);
      expect(help.indexOf(option)).toBeLessThan(help.indexOf('--selector'));
    }
    expect(help).toContain('--key-order');
    expect(help).toContain('preserve, document, or sorted');
    expect(help).not.toContain('--to-version');
  });

  it('redirects 0.7 to CLI 2.0.5 without writing a document or patch', async () => {
    const legacy = {
      mcpdesc: '0.7.0',
      info: { name: 'legacy', version: '1.0.0', protocolVersion: '2025-11-25' },
      transports: [{ type: 'stdio', command: 'legacy-server' }],
      tools: [{ name: 'lookup', inputSchema: { type: 'object' } }],
    };
    await writeFile(input, JSON.stringify(legacy));
    const reportPath = join(directory!, 'chain-report.json');
    const patchPath = join(directory!, 'chain-patch.json');
    const outputPath = join(directory!, 'output.json');
    const result = spawnSync(process.execPath, [
      'build/index.js', 'migrate', input, '--report', reportPath, '--patch', patchPath, '--quiet',
      '--output', outputPath,
    ], { encoding: 'utf-8' });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('@cisco_open/mcptoolkit-contract@2.0.5');
    expect(JSON.parse(await readFile(reportPath, 'utf-8'))).toMatchObject({ status: 'unsupported', steps: [] });
    await expect(readFile(outputPath)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readFile(patchPath)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(JSON.parse(await readFile(input, 'utf-8'))).toEqual(legacy);
  }, 20_000);

  it('directs mcpdesc inputs away from convert and toward migrate', () => {
    const result = spawnSync(process.execPath, ['build/index.js', 'convert', input], { encoding: 'utf-8' });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('mcpcontract migrate');
  });

  it('keeps convert as guidance-only even with historical output flags', async () => {
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
    const outputPath = join(directory!, 'output.yaml');
    const converted = spawnSync(process.execPath, ['build/index.js', 'convert', input, '--output', outputPath], { encoding: 'utf-8' });
    expect(converted.status).toBe(1);
    expect(converted.stdout).toBe('');
    expect(converted.stderr).toContain('@cisco_open/mcptoolkit-contract@2.0.5');
    await expect(readFile(outputPath)).rejects.toMatchObject({ code: 'ENOENT' });
    const rc = spawnSync(process.execPath, ['build/index.js', 'convert', input, '--to-version', '0.9.0'], { encoding: 'utf-8' });
    expect(rc.status).toBe(1);
    expect(rc.stdout).toBe('');
    expect(rc.stderr).toContain('does not produce 0.8.0');
  });

  it('reports blockers and only applies an explicitly requested fix', async () => {
    const reportPath = join(directory, 'report.json');
    const outputPath = join(directory, 'draft.json');
    const blocked = spawnSync(process.execPath, [
      'build/index.js', 'migrate', input,
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
      '--fixes', fixesPath,
      '--output', outputPath,
      '--patch', patchPath,
      '--quiet',
    ]);

    const migrated = JSON.parse(await readFile(outputPath, 'utf-8'));
    expect(migrated.mcpdesc).toBe('0.9.0');
    expect(migrated.$schema).toBe('https://mcpdesc.org/schema/mcp-description/0.9.0-rc.3.json');
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

  it('preserves schema omission and reports independently resolved source and destination selectors', async () => {
    await writeFile(input, JSON.stringify({ mcpdesc: '0.8.0', info: { name: 'schema-less', version: '1.0.0' }, protocolVersions: ['2026-07-28'] }));
    const reportPath = join(directory!, 'selectors.json');
    const output = execFileSync(process.execPath, [
      'build/index.js', 'migrate', input, '--selector', '0.9.0-rc.3', '--report', reportPath, '--quiet',
    ], { encoding: 'utf-8' });
    expect(JSON.parse(output)).not.toHaveProperty('$schema');
    expect(JSON.parse(await readFile(reportPath, 'utf-8'))).toMatchObject({
      selector: '0.9.0-rc.3', selectionSource: 'explicit',
      sourceSelector: '0.8.0-rev.20261021', sourceSelectionSource: 'default',
    });
  });

  it('validates already-current input and reports unchanged with an empty patch', async () => {
    await writeFile(input, JSON.stringify({ mcpdesc: '0.9.0', info: { name: 'rc', version: '1.0.0' }, protocolVersions: ['2026-07-28'] }));
    const report = join(directory!, 'report.json');
    const patch = join(directory!, 'patch.json');
    const result = spawnSync(process.execPath, ['build/index.js', 'migrate', input, '--report', report, '--patch', patch, '--quiet'], { encoding: 'utf-8' });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).mcpdesc).toBe('0.9.0');
    expect(JSON.parse(await readFile(report, 'utf-8'))).toMatchObject({
      from: '0.9.0', to: '0.9.0', selector: '0.9.0-rc.3', status: 'unchanged', steps: [],
    });
    expect(JSON.parse(await readFile(patch, 'utf-8'))).toEqual([]);
  });

  it('rejects retired source schema identities rather than upgrading an RC implicitly', async () => {
    await writeFile(input, JSON.stringify({
      mcpdesc: '0.9.0', $schema: 'https://mcpdesc.org/schema/mcp-description/0.9.0-rc.1.json',
      info: { name: 'rc', version: '1.0.0' }, protocolVersions: ['2026-07-28'],
    }));
    const result = spawnSync(process.execPath, ['build/index.js', 'migrate', input, '--selector', '0.9.0-rc.3'], { encoding: 'utf-8' });
    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('supported selector');
  });

  it('rejects invalid current documents, inappropriate fixes and unsupported destination selectors', async () => {
    await writeFile(input, JSON.stringify({
      mcpdesc: '0.9.0', info: { name: 'rc' }, protocolVersions: ['2026-07-28'],
    }));
    const invalid = spawnSync(process.execPath, ['build/index.js', 'migrate', input], { encoding: 'utf-8' });
    expect(invalid.status).toBe(1);
    expect(invalid.stdout).toBe('');
    expect(invalid.stderr).toContain('error:');

    await writeFile(input, JSON.stringify({
      mcpdesc: '0.9.0', info: { name: 'rc', version: '1.0.0' }, protocolVersions: ['2026-07-28'],
    }));
    const fixes = join(directory!, 'fixes.json');
    await writeFile(fixes, JSON.stringify({ fixes: [{ fix: 'remove-property', path: ['info', 'name'] }] }));
    const withFix = spawnSync(process.execPath, ['build/index.js', 'migrate', input, '--fixes', fixes], { encoding: 'utf-8' });
    expect(withFix.status).toBe(2);
    expect(withFix.stderr).toContain('Fixes apply only to the 0.8.0 to 0.9.0 migration step');
    expect(withFix.stdout).toBe('');
    for (const selector of ['0.8.0', '0.9.0-rc.1']) {
      const selected = spawnSync(process.execPath, ['build/index.js', 'migrate', input, '--selector', selector], { encoding: 'utf-8' });
      expect(selected.status).toBe(2);
      expect(selected.stdout).toBe('');
    }
  });

  it('rejects the removed destination option without writing output', async () => {
    await writeFile(input, JSON.stringify({ mcpdesc: '0.8.0', info: { name: 'test', version: '1.0.0' }, protocolVersions: ['2026-07-28'] }));
    for (const version of ['0.8.0', '0.9.0', '1.0.0']) {
      const output = join(directory!, 'rejected.json');
      const rejected = spawnSync(process.execPath, ['build/index.js', 'migrate', input, '--to-version', version, '--output', output], { encoding: 'utf-8' });
      expect(rejected.status).not.toBe(0);
      expect(rejected.stderr).toContain("unknown option '--to-version'");
      expect(rejected.stdout).toBe('');
      await expect(readFile(output)).rejects.toMatchObject({ code: 'ENOENT' });
    }
  });

  it('preserves order by default and matches normalize for document and sorted order', async () => {
    const source = {
      tools: [{ inputSchema: { type: 'object', properties: { z: { type: 'string' }, a: { type: 'number' } } }, name: 'lookup' }],
      info: { version: '1.0.0', name: 'order-test' },
      mcpdesc: '0.8.0',
      protocolVersions: ['2026-07-28'],
      'x-payload': { z: 1, a: 2 },
    };
    await writeFile(input, JSON.stringify(source));
    const baseline = join(directory!, 'baseline.json');
    const patch = join(directory!, 'patch.json');
    const report = join(directory!, 'report.json');
    const result = spawnSync(process.execPath, [
      'build/index.js', 'migrate', input, '--output', baseline, '--report', report, '--patch', patch, '--quiet',
    ], { encoding: 'utf-8' });
    expect({ status: result.status, stderr: result.stderr }).toMatchObject({ status: 0 });
    const baselineText = await readFile(baseline, 'utf-8');
    expect(baselineText.indexOf('"tools"')).toBeLessThan(baselineText.indexOf('"mcpdesc"'));
    expect(baselineText.indexOf('"version"')).toBeLessThan(baselineText.indexOf('"name": "order-test"'));
    expect(JSON.parse(baselineText).mcpdesc).toBe('0.9.0');
    const originalPatch = JSON.parse(await readFile(patch, 'utf-8'));
    expect(originalPatch).toEqual([{ op: 'replace', path: '/mcpdesc', value: '0.9.0' }]);
    expect({ ...source, mcpdesc: originalPatch[0].value }).toEqual(JSON.parse(baselineText));
    expect(JSON.parse(await readFile(report, 'utf-8'))).toMatchObject({
      from: '0.8.0', to: '0.9.0', selector: '0.9.0-rc.3', selectionSource: 'default', status: 'converted',
    });

    for (const order of ['document', 'sorted']) {
      for (const format of ['json', 'yaml']) {
        const args = ['build/index.js', 'migrate', input, '--key-order', order, '--format', format, '--patch', patch, '--quiet'];
        const migrated = execFileSync(process.execPath, args, { encoding: 'utf-8' });
        const normalized = execFileSync(process.execPath, [
          'build/index.js', 'normalize', baseline, '--key-order', order, '--format', format,
        ], { encoding: 'utf-8' });
        expect(migrated).toBe(normalized);
        expect(JSON.parse(await readFile(patch, 'utf-8'))).toEqual(originalPatch);
        if (format === 'json') {
          expect(JSON.parse(migrated)).toEqual(JSON.parse(baselineText));
          const compact = execFileSync(process.execPath, [...args, '--compact'], { encoding: 'utf-8' });
          expect(compact).toBe(`${JSON.stringify(JSON.parse(migrated))}\n`);
        } else {
          expect(migrated).toMatch(/[^\n]\n$/);
        }
      }
    }
    const invalid = spawnSync(process.execPath, ['build/index.js', 'migrate', input, '--key-order', 'invalid'], { encoding: 'utf-8' });
    expect(invalid.status).toBe(2);
    expect(invalid.stderr).toContain('--key-order must be preserve, document, or sorted');
    expect(invalid.stdout).toBe('');
  });
});