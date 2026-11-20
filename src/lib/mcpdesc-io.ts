import { parseMcpDescriptionSource } from '@mcpdesc/core';
import { checkMcpDescriptionInputVersion } from './mcpdesc-target.js';

export function parseDocumentSource(source: string, name: string) {
  const parsed = parseMcpDescriptionSource(source);
  if (!parsed.ok) {
    const details = parsed.diagnostics.map(({ message, location }) =>
      location ? `${location.line}:${location.column}: ${message}` : message
    ).join('; ');
    throw new Error(`Failed to parse ${name}: ${details}`);
  }
  return parsed;
}

export function parseMcpDescriptionInput(source: string, name: string) {
  const parsed = parseDocumentSource(source, name);
  checkMcpDescriptionInputVersion(parsed.value, name);
  return parsed;
}
