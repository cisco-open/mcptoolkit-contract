import { describe, expect, it } from '@jest/globals';
import { ACTIVE_MCPDESC_SCHEMA_URI, requireActiveDocument } from '../../src/lib/mcpdesc-target.js';

describe('active MCP Description target', () => {
  it('pins schema-less 0.9.0 documents to Draft 4', () => {
    expect(requireActiveDocument({ mcpdesc: '0.9.0' })).toBe('0.9.0-draft.4');
    expect(requireActiveDocument({ mcpdesc: '0.9.0', $schema: ACTIVE_MCPDESC_SCHEMA_URI }))
      .toBe('0.9.0-draft.4');
  });

  it('rejects historical formats with an upgrade instruction', () => {
    expect(() => requireActiveDocument({ mcpdesc: '0.8.0' })).toThrow('CLI 2.0.5');
    expect(() => requireActiveDocument({ mcpdesc: '0.7.0' })).toThrow('mcpcontract migrate');
  });

  it('does not silently reinterpret earlier drafts or requested selectors', () => {
    expect(() => requireActiveDocument({ mcpdesc: '0.9.0', $schema: 'https://mcpdesc.org/schema/mcp-description/0.9.0-draft.3.json' }))
      .toThrow('does not match');
    expect(() => requireActiveDocument({ mcpdesc: '0.9.0' }, '0.8.0')).toThrow('not supported');
  });
});