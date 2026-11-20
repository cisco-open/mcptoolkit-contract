import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { parseDocumentSource, parseMcpDescriptionInput } from '../../src/lib/mcpdesc-io.js';
import { formatYAML } from '../../src/lib/formatters.js';

describe('MCP Description IO', () => {
  afterEach(() => jest.restoreAllMocks());

  it('uses JSON scalar recognition for enrichment and migration-fix data too', () => {
    expect(parseDocumentSource('version: 012\ntitle: TRUE\ndescription: 0o12\n', 'info.yaml').value)
      .toEqual({ version: '012', title: 'TRUE', description: '0o12' });
    expect(parseDocumentSource('fixes:\n  - fix: remove-property\n    path: [tools, 0, annotations, TRUE]\n', 'fixes.yaml').value)
      .toEqual({ fixes: [{ fix: 'remove-property', path: ['tools', 0, 'annotations', 'TRUE'] }] });
  });

  it('surfaces parse locations and does not coerce invalid input', () => {
    expect(() => parseDocumentSource('mcpdesc: 0.9.0\ninfo: !unknown value\n', 'broken.yaml'))
      .toThrow(/broken\.yaml: 2:/);
    expect(() => parseDocumentSource('value: 1e400', 'overflow.yaml')).toThrow();
    expect(() => parseDocumentSource('{"mcpdesc":"0.9.0","mcpdesc":"0.8.0"}', 'duplicate.json'))
      .toThrow('Duplicate');
  });

  it('does not mistake configuration version fields for an mcpdesc input', () => {
    const stderr = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    parseMcpDescriptionInput('version: 0.8.0\n', 'config.yaml');
    expect(stderr).not.toHaveBeenCalled();
  });

  it.each([undefined, NaN, Infinity, new Date(), { value: undefined }])('rejects non-JSON generated output: %p', (value) => {
    expect(() => formatYAML(value)).toThrow(TypeError);
  });

  it('rejects cyclic generated values rather than emitting aliases', () => {
    const value: { self?: unknown } = {};
    value.self = value;
    expect(() => formatYAML(value)).toThrow('cyclic');
  });
});
