import { describe, expect, it } from '@jest/globals';
import { validateMcpDescription } from '@mcpdesc/validator';

import { Validator } from '../../src/lib/validator.js';

const v08Document = {
  $schema: 'https://mcpdesc.org/schema/mcp-description/0.8.0.json',
  mcpdesc: '0.8.0',
  info: { name: 'validator-test', version: '1.0.0' },
  protocolVersions: ['2026-07-28'],
};

const v09Rc3Document = {
  $schema: 'https://mcpdesc.org/schema/mcp-description/0.9.0-rc.3.json',
  mcpdesc: '0.9.0',
  info: { name: 'validator-test', version: '1.0.0' },
  protocolVersions: ['2026-07-28'],
};

describe('Validator mcpdesc dispatch', () => {
  it('uses the shared v0.8 structural and semantic validator', async () => {
    const validator = new Validator();
    const result = await validator.validateData(
      {
        ...v08Document,
        capabilities: [{ logging: {} }],
      },
      'mcpdesc',
    );

    expect(result.valid).toBe(true);
    expect(result.schemaVersion).toBe('0.8.0');
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ keyword: 'logging-deprecated-in-2026' }),
    );
  });

  it('warns when extension negotiation is declared before MCP 2026', async () => {
    const validator = new Validator();
    const result = await validator.validateData(
      {
        ...v08Document,
        protocolVersions: ['2025-11-25'],
        capabilities: [{ extensions: { 'io.modelcontextprotocol/tasks': {} } }],
      },
      'mcpdesc',
    );

    expect(result.valid).toBe(true);
    expect(result.schemaVersion).toBe('0.8.0');
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ keyword: 'extensions-not-supported-by-version' }),
    );
  });

  it('uses the maintained v0.8 default without a schema URI', async () => {
    const validator = new Validator();
    const result = await validator.validateData(
      {
        mcpdesc: '0.8.0',
        info: { name: 'defaulted', version: '1.0.0' },
        protocolVersions: ['2025-11-25'],
        tools: [{
          name: 'get-header-params',
          inputSchema: {
            type: 'object',
            properties: {
              region: { type: 'string', 'x-mcp-header': 'Region' },
            },
            required: ['region'],
          },
        }],
      },
      'mcpdesc',
    );

    expect(result.valid).toBe(true);
    expect(result.schemaVersion).toBe('0.8.0');
    expect(result.errors).toEqual([]);
  });

  it('infers RC.3 from its schema identity and returns rule results', async () => {
    const result = await new Validator().validateData(v09Rc3Document, 'mcpdesc');

    expect(result.valid).toBe(true);
    expect(result.selector).toBe('0.9.0-rc.3');
    expect(result.ruleResults?.length).toBeGreaterThan(0);
  });

  it('uses RC.3 by default and rejects retired selectors', async () => {
    const document = { ...v09Rc3Document };
    delete (document as { $schema?: string }).$schema;

    const unpinned = await new Validator().validateData(document, 'mcpdesc');
    expect(unpinned.valid).toBe(true);
    expect(unpinned.selector).toBe('0.9.0-rc.3');
    expect(unpinned.defaulted).toBe(true);
    expect(unpinned.selectionSource).toBe('default');

    const retired = await new Validator().validateData(document, 'mcpdesc', 'data', '0.9.0-rc.1');
    expect(retired.valid).toBe(false);
    expect(retired.errors).toContainEqual(expect.objectContaining({ keyword: 'unsupported-selector' }));
  });

  it('distinguishes schema-derived selection from explicit overrides', async () => {
    const validator = new Validator();
    expect(await validator.validateData(v09Rc3Document, 'mcpdesc')).toMatchObject({
      selector: '0.9.0-rc.3', selectionSource: 'schema-derived', defaulted: false,
    });
    const result = await validator.validateData(v09Rc3Document, 'mcpdesc', 'data', '0.9.0-rc.3');
    expect(result).toMatchObject({ valid: true, selector: '0.9.0-rc.3', selectionSource: 'explicit' });
    expect(result.ruleResults).toContainEqual(expect.objectContaining({ rule: 'mcp.tool.output-schema.protocol-version' }));
  });

  it('requires a format even if a schema or selector is supplied', async () => {
    const result = await new Validator().validateData({ $schema: v09Rc3Document.$schema }, 'mcpdesc', 'data', '0.9.0-rc.3');
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ keyword: 'missing-format-version' }));
  });

  it('preserves RC.3 rule results and structured diagnostics', async () => {
    for (const extra of [{}, { capabilities: [{ logging: {} }] }, { tools: [{ name: 'invalid', inputSchema: 42 }] }]) {
      const document = { ...v09Rc3Document, $schema: 'https://mcpdesc.org/schema/mcp-description/0.9.0-rc.3.json',
        protocolVersions: ['2025-11-25', '2026-07-28'], ...extra,
      };
      const expected = validateMcpDescription(document, { selector: '0.9.0-rc.3' });
      const result = await new Validator().validateData(document, 'mcpdesc');
      expect(result.diagnostics).toEqual(expected.diagnostics);
      expect(result.ruleResults).toEqual(expected.results);
      if ('tools' in extra) {
        expect(result.diagnostics).toContainEqual(expect.objectContaining({
          detail: expect.objectContaining({ kind: 'invalid-type' }),
        }));
      }
    }
  });

  it('redirects legacy v0.7 documents instead of validating locally', async () => {
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

    expect(result.valid).toBe(false);
    expect(result.schemaVersion).toBe('0.7.0');
    expect(result.errors).toContainEqual(expect.objectContaining({
      keyword: 'unsupported-format-version',
      message: expect.stringContaining('CLI 2.0.5'),
    }));
  });

  it('rejects unknown mcpdesc versions instead of falling back', async () => {
    const validator = new Validator();

    const result = await validator.validateData(
        {
          mcpdesc: '9.9.9',
          info: { name: 'unknown', version: '1.0.0' },
        },
        'mcpdesc',
      );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ keyword: 'unsupported-format-version' }));
  });

  it('rejects a non-canonical schema identity', async () => {
    const validator = new Validator();
    const result = await validator.validateData(
      {
        ...v08Document,
        $schema: 'https://example.com/mcp-description/0.8.0.json',
      },
      'mcpdesc',
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ keyword: 'unknown-schema-identity' }),
    );
  });
});