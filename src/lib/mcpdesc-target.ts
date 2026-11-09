import {
  defaultSpecifications,
  resolveMcpDescriptionSpecification,
  specificationProvenance,
  type McpDescriptionDiagnostic,
  type McpDescriptionSelector,
} from '@mcpdesc/validator';

export const DEFAULT_OUTPUT_VERSION = '0.8.0';
export const CLI_MCPDESC_SELECTORS: readonly McpDescriptionSelector[] = [
  '0.8.0',
  defaultSpecifications['0.8.0']!.selector, defaultSpecifications['0.9.0']!.selector,
];

export type SelectionSource = 'explicit' | 'schema-derived' | 'default';

export interface McpDescriptionSelection {
  selector: McpDescriptionSelector;
  source: SelectionSource;
  defaulted: boolean;
  schemaUri: string;
}

export class McpDescriptionSelectionError extends Error {
  constructor(public readonly diagnostics: McpDescriptionDiagnostic[]) {
    super(diagnostics.map((diagnostic) => diagnostic.message ?? diagnostic.code).join('; '));
  }
}

function selectionError(code: string, message: string, path: string[]): never {
  throw new McpDescriptionSelectionError([{ code, severity: 'error', message, path }]);
}

export function resolveMcpDescriptionSelection(document: unknown, requested?: string): McpDescriptionSelection {
  const input = document as { mcpdesc?: unknown; $schema?: unknown } | null;
  if (!input || typeof input !== 'object' || Array.isArray(input) || typeof input.mcpdesc !== 'string') {
    return selectionError('missing-format-version', 'A string mcpdesc format version is required', ['mcpdesc']);
  }
  if (input.mcpdesc !== '0.8.0' && input.mcpdesc !== '0.9.0') {
    return selectionError('unsupported-format-version', input.mcpdesc === '0.7.0'
      ? 'Processing 0.7.0 requires CLI 1.2.4, or run mcpcontract migrate to upgrade explicitly'
      : `Unsupported MCP Description version: ${input.mcpdesc}`, ['mcpdesc']);
  }
  if (requested !== undefined && !CLI_MCPDESC_SELECTORS.includes(requested as McpDescriptionSelector)) {
    return selectionError('unsupported-selector', `Selector ${requested} is not supported by this CLI; use a former CLI release that supports it`, []);
  }
  const resolution = resolveMcpDescriptionSpecification(document, requested === undefined
    ? undefined : { selector: requested as McpDescriptionSelector });
  if (resolution.status !== 'resolved') throw new McpDescriptionSelectionError(resolution.diagnostics);

  let selector = resolution.selector;
  const source: SelectionSource = requested !== undefined ? 'explicit'
    : input.$schema !== undefined ? 'schema-derived' : 'default';
  if (source === 'schema-derived') {
    const candidates = Object.entries(specificationProvenance)
      .filter(([, provenance]) => provenance.schemaUri === input.$schema)
      .map(([candidate]) => candidate as McpDescriptionSelector);
    const maintained = defaultSpecifications[input.mcpdesc]!.selector;
    if (candidates.length === 1) selector = candidates[0];
    else if (candidates.includes(maintained)) selector = maintained;
    else return selectionError('unsupported-schema-selector',
      'Schema identity has no unambiguous supported selector; specify --selector or use a former CLI release', ['$schema']);
  }
  if (!CLI_MCPDESC_SELECTORS.includes(selector)) {
    return selectionError('unsupported-selector', `Selector ${selector} is not supported by this CLI; use a former CLI release that supports it`, []);
  }
  return { selector, source, defaulted: source === 'default', schemaUri: specificationProvenance[selector].schemaUri };
}

export function resolveOutputSelection(version: string = DEFAULT_OUTPUT_VERSION, requested?: string): McpDescriptionSelection {
  return resolveMcpDescriptionSelection({ mcpdesc: version }, requested);
}
