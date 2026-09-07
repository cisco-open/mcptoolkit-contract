import { describe, expect, it } from '@jest/globals';

import { Validator } from '../../src/lib/validator.js';

const rc1Document = {
  $schema: 'https://mcpdesc.org/schema/mcp-description/0.8.0-rc.1.json',
  mcpdesc: '0.8.0',
  info: { name: 'validator-test', version: '1.0.0' },
  protocolVersions: ['2026-07-28'],
};

const rc2Document = {
  $schema: 'https://mcpdesc.org/schema/mcp-description/0.8.0-rc.2.json',
  mcpdesc: '0.8.0',
  info: { name: 'validator-test', version: '1.0.0' },
  protocolVersions: ['2025-11-25'],
};

describe('Validator mcpdesc dispatch', () => {
  it('uses the shared RC.1 structural and semantic validator', async () => {
    const validator = new Validator();
    const result = await validator.validateData(
      {
        ...rc1Document,
        capabilities: [{ logging: {} }],
      },
      'mcpdesc',
    );

    expect(result.valid).toBe(true);
    expect(result.schemaVersion).toBe('0.8.0-rc.1');
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ keyword: 'logging-deprecated-in-2026' }),
    );
  });

  it('warns when extension negotiation is declared before MCP 2026', async () => {
    const validator = new Validator();
    const result = await validator.validateData(
      {
        ...rc2Document,
        capabilities: [{ extensions: { 'io.modelcontextprotocol/tasks': {} } }],
      },
      'mcpdesc',
    );

    expect(result.valid).toBe(true);
    expect(result.schemaVersion).toBe('0.8.0-rc.2');
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ keyword: 'extensions-not-supported-by-version' }),
    );
  });

  it('rejects an ambiguous v0.8 document without an immutable selector', async () => {
    const validator = new Validator();

    await expect(
      validator.validateData(
        {
          mcpdesc: '0.8.0',
          info: { name: 'ambiguous', version: '1.0.0' },
          protocolVersions: ['2026-07-28'],
        },
        'mcpdesc',
      ),
    ).rejects.toThrow('exact supported $schema URI');
  });

  it('retains local validation for legacy v0.7 documents', async () => {
    const validator = new Validator();
    const result = await validator.validateData(
      {
        mcpdesc: '0.7.0',
        info: { name: 'legacy', version: '1.0.0' },
        transports: [{ type: 'stdio', command: 'legacy-server' }],
        tools: [
          {
            name: 'legacy-tool',
            inputSchema: { type: 'object' },
          },
        ],
      },
      'mcpdesc',
    );

    expect(result.valid).toBe(true);
    expect(result.schemaVersion).toBe('0.7.0');
  });

  it('rejects unknown mcpdesc versions instead of falling back', async () => {
    const validator = new Validator();

    await expect(
      validator.validateData(
        {
          mcpdesc: '9.9.9',
          info: { name: 'unknown', version: '1.0.0' },
        },
        'mcpdesc',
      ),
    ).rejects.toThrow('Unsupported MCP Description version');
  });

    it('rejects a supported selector on a non-canonical schema origin', async () => {
      const validator = new Validator();
      await expect(
        validator.validateData(
          {
            ...rc1Document,
            $schema: 'https://example.com/mcp-description/0.8.0-rc.1.json',
          },
          'mcpdesc'
        )
      ).rejects.toThrow(/Unsupported MCP Description specification/);
    });
});