import {
  defaultSpecifications,
  resolveMcpDescriptionSpecification,
  specificationProvenance,
  type McpDescriptionDiagnostic,
  type McpDescriptionSelector,
} from '@mcpdesc/validator';

export const DEFAULT_OUTPUT_VERSION = '0.9.0';
export const DEFAULT_MIGRATION_VERSION = '0.9.0';
export const CLI_MCPDESC_FORMATS = ['0.8.0', '0.9.0'] as const;
export const LEGACY_CONVERSION_CLI_VERSION = '2.0.5';
export const HISTORICAL_PROCESSING_CLI_VERSION = '1.2.4';
export const LEGACY_CONVERSION_GUIDANCE =
  `Use CLI ${LEGACY_CONVERSION_CLI_VERSION} to convert legacy capability dumps or MCP Description 0.7.0 to 0.8.0:\n` +
  `npx --package=@cisco_open/mcptoolkit-contract@${LEGACY_CONVERSION_CLI_VERSION} mcpcontract convert <input> --output <output>\n` +
  `Use the latest v1 CLI (${HISTORICAL_PROCESSING_CLI_VERSION}) only for historical 0.7.0 processing; it does not produce 0.8.0.`;
export const UNSUPPORTED_07_GUIDANCE =
  `MCP Description 0.7.0 is no longer supported by this CLI. ${LEGACY_CONVERSION_GUIDANCE}`;
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

export function checkMcpDescriptionInputVersion(document: unknown, name: string): void {
  if (typeof document !== 'object' || document === null || !('mcpdesc' in document)) return;
  if (document.mcpdesc === '0.7.0') {
    selectionError('unsupported-format-version', UNSUPPORTED_07_GUIDANCE, ['mcpdesc']);
  }
  if (document.mcpdesc === '0.8.0') {
    console.error(
      `Recommendation: ${name} uses MCP Description 0.8.0. ` +
      'Consider migrating to 0.9.0; this command will not upgrade it:\n' +
      'mcpcontract migrate <input> --output <new-file>'
    );
  }
}

export function resolveMcpDescriptionSelection(document: unknown, requested?: string): McpDescriptionSelection {
  const input = document as { mcpdesc?: unknown; $schema?: unknown } | null;
  if (!input || typeof input !== 'object' || Array.isArray(input) || typeof input.mcpdesc !== 'string') {
    return selectionError('missing-format-version', 'A string mcpdesc format version is required', ['mcpdesc']);
  }
  const format = CLI_MCPDESC_FORMATS.find((supported) => supported === input.mcpdesc);
  if (!format) {
    return selectionError('unsupported-format-version', input.mcpdesc === '0.7.0'
      ? UNSUPPORTED_07_GUIDANCE
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
    const maintained = defaultSpecifications[format]!.selector;
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
