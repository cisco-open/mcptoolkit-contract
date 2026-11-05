import { describe, expect, it } from '@jest/globals';
import { resolveMcpDescriptionSelection, resolveOutputSelection } from '../../src/lib/mcpdesc-target.js';

const schema = (selector: string) => `https://mcpdesc.org/schema/mcp-description/${selector}.json`;

describe('MCP Description selector policy', () => {
  it('uses maintained defaults only when neither schema nor selector is supplied', () => {
    expect(resolveMcpDescriptionSelection({ mcpdesc: '0.9.0' })).toMatchObject({
      selector: '0.9.0-rc.1', source: 'default', defaulted: true,
    });
    expect(resolveMcpDescriptionSelection({ mcpdesc: '0.8.0' }).selector).toBe('0.8.0-rev.20261021');
    expect(resolveOutputSelection().selector).toBe('0.8.0-rev.20261021');
  });

  it.each(['0.9.0-draft.4', '0.9.0-rc.1'])('pins unique schema identity %s', (selector) => {
    expect(resolveMcpDescriptionSelection({ mcpdesc: '0.9.0', $schema: schema(selector) }))
      .toMatchObject({ selector, source: 'schema-derived', defaulted: false });
  });

  it('uses the maintained selector for the shared stable URI', () => {
    const document = { mcpdesc: '0.8.0', $schema: schema('0.8.0') };
    expect(resolveMcpDescriptionSelection(document).selector).toBe('0.8.0-rev.20261021');
    expect(resolveMcpDescriptionSelection(document, '0.8.0')).toMatchObject({ selector: '0.8.0', source: 'explicit' });
  });

  it('lets an explicit same-format selector override a schema pin', () => {
    expect(resolveMcpDescriptionSelection({ mcpdesc: '0.9.0', $schema: schema('0.9.0-draft.4') }, '0.9.0-rc.1'))
      .toMatchObject({ selector: '0.9.0-rc.1', source: 'explicit', defaulted: false });
    expect(resolveMcpDescriptionSelection({ mcpdesc: '0.9.0', $schema: schema('0.9.0-draft.3') }, '0.9.0-rc.1').selector)
      .toBe('0.9.0-rc.1');
  });

  it.each([undefined, '0.9.0-rc.1'])('rejects unknown schema identities even with selector %s', (selector) => {
    expect(() => resolveMcpDescriptionSelection({ mcpdesc: '0.9.0', $schema: 'https://example.com/schema.json' }, selector))
      .toThrow();
  });

  it('rejects missing formats, malformed identities, cross-format conflicts, and unsupported pins', () => {
    expect(() => resolveMcpDescriptionSelection({ $schema: schema('0.9.0-rc.1') })).toThrow('mcpdesc');
    expect(() => resolveMcpDescriptionSelection({ mcpdesc: '0.9.0', $schema: 12 })).toThrow();
    expect(() => resolveMcpDescriptionSelection({ mcpdesc: '0.8.0', $schema: schema('0.9.0-rc.1') })).toThrow();
    expect(() => resolveMcpDescriptionSelection({ mcpdesc: '0.9.0' }, '0.8.0')).toThrow();
    expect(() => resolveMcpDescriptionSelection({ mcpdesc: '0.9.0', $schema: schema('0.9.0-draft.3') })).toThrow('not supported');
    expect(() => resolveMcpDescriptionSelection({ mcpdesc: '0.8.0', $schema: schema('0.8.0-rc.4') })).toThrow('not supported');
    expect(() => resolveMcpDescriptionSelection({ mcpdesc: '0.7.0' })).toThrow('CLI 1.2.4');
  });
});