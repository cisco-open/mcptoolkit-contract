import { V0_9_DRAFT_4_SCHEMA_URI, V0_9_DRAFT_4_SPECIFICATION } from '@mcpdesc/core';

export const ACTIVE_MCPDESC_VERSION = '0.9.0';
export const ACTIVE_MCPDESC_SELECTOR = V0_9_DRAFT_4_SPECIFICATION;
export const ACTIVE_MCPDESC_SCHEMA_URI = V0_9_DRAFT_4_SCHEMA_URI;

export function requireActiveSelector(requested?: string): typeof ACTIVE_MCPDESC_SELECTOR {
  if (requested !== undefined && requested !== ACTIVE_MCPDESC_SELECTOR) {
    throw new Error(`This CLI targets MCP Description ${ACTIVE_MCPDESC_SELECTOR}; selector ${requested} is not supported for processing`);
  }
  return ACTIVE_MCPDESC_SELECTOR;
}

export function requireActiveDocument(
  document: { mcpdesc: string; $schema?: string },
  requested?: string,
): typeof ACTIVE_MCPDESC_SELECTOR {
  const selector = requireActiveSelector(requested);
  if (document.mcpdesc !== ACTIVE_MCPDESC_VERSION) {
    const historicalCli = document.mcpdesc === '0.7.0' ? '1.2.4'
      : document.mcpdesc === '0.8.0' ? '2.0.5' : undefined;
    throw new Error(
      `This command requires MCP Description ${selector}; input declares ${document.mcpdesc}. ` +
      (historicalCli ? `Use CLI ${historicalCli} for historical processing, or run mcpcontract migrate <input> --output upgraded.yaml.`
        : 'No supported migration path is known for this format version.'),
    );
  }
  if (document.$schema !== undefined && document.$schema !== ACTIVE_MCPDESC_SCHEMA_URI) {
    throw new Error(`Schema identity ${document.$schema} does not match the active target ${selector}`);
  }
  return selector;
}