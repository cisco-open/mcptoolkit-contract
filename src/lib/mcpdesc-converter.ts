// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Bidirectional converter between ContractDump (internal) and mcpdesc + x-cisco-metadata (output)
 * 
 * The mcpdesc format is the MCP Server Description specification v0.7.0.
 * The x-cisco-metadata v0.2.0 extension carries provenance, runtime observations, CORS,
 * pagination, and split metadata that aren't part of the core mcpdesc schema.
 */

import type {
  ContractDump,
  DumpServerConfig,
  RuntimeFindings,
  CorsSupport,
  ClientCapabilities,
  Icon,
} from './types.js';

// ============================================================================
// mcpdesc Output Types
// ============================================================================

export interface McpDescTransport {
  type: 'stdio' | 'streamable-http' | 'sse';
  url?: string;
  command?: string;
  args?: string[];
  security?: unknown[];
}

export interface McpDescInfo {
  name: string;
  title?: string;
  version: string;
  description?: string;
  protocolVersion?: string;
  id?: string;
  icons?: unknown[];
  websiteUrl?: string;
  contact?: Record<string, unknown>;
  license?: Record<string, unknown>;
}

export interface McpDescTag {
  name: string;
  description?: string;
}

export interface McpDescDocument {
  $schema?: string;
  mcpdesc: string;
  info: McpDescInfo;
  transports: McpDescTransport[];
  security?: unknown[];
  capabilities?: Record<string, unknown>;
  tools?: unknown[];
  resources?: unknown[];
  resourceTemplates?: unknown[];
  prompts?: unknown[];
  tags?: McpDescTag[];
  'x-cisco-metadata'?: XCiscoMetadata;
  [key: string]: unknown; // Allow other x- extensions
}

// ============================================================================
// x-cisco-metadata Extension Types (v0.2.0 shape)
// ============================================================================

export interface XCiscoMetadataServerConfig {
  name?: string;
  transport?: string;
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface XCiscoMetadataRuntimeObservations {
  mcpProtocolUsed?: string;
  sessionIdSupported?: boolean;
  sessionIdHeader?: string;
  pingSupported?: boolean;
  pingLatencyMs?: number;
  instructions?: string;
}

export interface XCiscoMetadataCors {
  browserReady?: boolean | null;
  responseHeaders?: {
    accessControlAllowOrigin?: string;
    accessControlExposeHeaders?: string[];
  };
  preflight?: {
    tested: boolean;
    status?: number;
    accessControlAllowOrigin?: string;
    accessControlAllowMethods?: string[];
    accessControlAllowHeaders?: string[];
  };
}

export interface XCiscoMetadataPaginationDetection {
  tools?: { paginationDetected: boolean; pagesRetrieved: number; totalItems: number };
  resources?: { paginationDetected: boolean; pagesRetrieved: number; totalItems: number };
  resourceTemplates?: { paginationDetected: boolean; pagesRetrieved: number; totalItems: number };
  prompts?: { paginationDetected: boolean; pagesRetrieved: number; totalItems: number };
}

export interface XCiscoMetadataSplitOperation {
  toolName: string;
  toolVersion: string;
  createdAt: string;
  splitConfig: {
    sourceFile: string;
    category: string;
    configFile?: string;
    schemaVersion?: string;
  };
  splitExecution?: {
    originalCounts: { tools: number; prompts: number; resources: number; resourceTemplates: number };
    filteredCounts: { tools: number; prompts: number; resources: number; resourceTemplates: number };
    filterRules: Array<{ capability: string; type: string; pattern: string }>;
  };
}

/** x-cisco-metadata v0.2.0 dump payload */
export interface XCiscoMetadataDump {
  toolName: string;
  toolVersion: string;
  createdAt: string;
  serverConfig?: XCiscoMetadataServerConfig;
  runtimeObservations?: XCiscoMetadataRuntimeObservations;
  cors?: XCiscoMetadataCors;
  paginationDetection?: XCiscoMetadataPaginationDetection;
  clientCapabilities?: ClientCapabilities;
  splitOperation?: XCiscoMetadataSplitOperation;
  enrichment?: Record<string, unknown>;
}

/** x-cisco-metadata v0.2.0 top-level shape */
export interface XCiscoMetadata {
  version: string;
  dump: XCiscoMetadataDump;
}

/** Legacy x-cisco-metadata v0.1.0 shape (for reading old documents) */
export interface XCiscoMetadataV1 {
  sourceFormat?: string;
  sourceSchemaVersion?: string;
  dumpDetails?: {
    toolName: string;
    toolVersion: string;
    createdAt: string;
    description?: string;
  };
  serverConfig?: XCiscoMetadataServerConfig;
  runtimeObservations?: XCiscoMetadataRuntimeObservations;
  cors?: XCiscoMetadataCors;
  paginationDetection?: XCiscoMetadataPaginationDetection;
  clientCapabilities?: ClientCapabilities;
  splitOperation?: XCiscoMetadataSplitOperation;
}

// ============================================================================
// Constants
// ============================================================================

const MCPDESC_VERSION = '0.7.0';
const XCISCO_METADATA_VERSION = '0.2.0';

// ============================================================================
// ContractDump → mcpdesc + x-cisco-metadata
// ============================================================================

/**
 * Convert a ContractDump to an mcpdesc v0.6.0 document with x-cisco-metadata v0.2.0 extension.
 */
export function contractDumpToMcpDescription(dump: ContractDump): McpDescDocument {
  const doc: McpDescDocument = {
    mcpdesc: MCPDESC_VERSION,
    info: buildInfo(dump),
    transports: buildTransports(dump.dumpDetails.mcpServerConfig),
  };

  // Server capabilities — include if present
  if (dump.serverInfo.capabilities && Object.keys(dump.serverInfo.capabilities).length > 0) {
    doc.capabilities = dump.serverInfo.capabilities as Record<string, unknown>;
  }

  // Capability arrays — only include non-empty ones
  if (dump.tools && dump.tools.length > 0) {
    doc.tools = dump.tools;
  }
  if (dump.resources && dump.resources.length > 0) {
    doc.resources = dump.resources;
  }
  if (dump.resourceTemplates && dump.resourceTemplates.length > 0) {
    doc.resourceTemplates = dump.resourceTemplates;
  }
  if (dump.prompts && dump.prompts.length > 0) {
    doc.prompts = dump.prompts;
  }

  // x-cisco-metadata extension — always included (carries provenance)
  doc['x-cisco-metadata'] = buildXCiscoMetadata(dump);

  return doc;
}

function buildInfo(dump: ContractDump): McpDescInfo {
  const info: McpDescInfo = {
    name: dump.serverInfo.name,
    version: dump.serverInfo.version,
  };

  if (dump.serverInfo.title) {
    info.title = dump.serverInfo.title;
  }

  if (dump.serverInfo.description) {
    info.description = dump.serverInfo.description;
  }

  if (dump.serverInfo.protocolVersion) {
    info.protocolVersion = dump.serverInfo.protocolVersion;
  }

  if (dump.serverInfo.websiteUrl) {
    info.websiteUrl = dump.serverInfo.websiteUrl;
  }

  if (dump.serverInfo.icons && dump.serverInfo.icons.length > 0) {
    info.icons = dump.serverInfo.icons;
  }

  // Instructions go to x-cisco-metadata.runtimeObservations, not info.description
  // info.description is reserved for the server's own description from the initialize handshake

  return info;
}

function buildTransports(serverConfig: DumpServerConfig): McpDescTransport[] {
  const transport: McpDescTransport = {
    type: serverConfig.transport,
  };

  if (serverConfig.url) {
    transport.url = serverConfig.url;
  }
  if (serverConfig.command) {
    transport.command = serverConfig.command;
  }
  if (serverConfig.args && serverConfig.args.length > 0) {
    transport.args = serverConfig.args;
  }

  return [transport];
}

function buildXCiscoMetadata(dump: ContractDump): XCiscoMetadata {
  const dumpPayload: XCiscoMetadataDump = {
    toolName: dump.dumpDetails.toolName,
    toolVersion: dump.dumpDetails.toolVersion,
    createdAt: dump.dumpDetails.createdAt,
  };

  // Server config
  dumpPayload.serverConfig = buildServerConfig(dump.dumpDetails.mcpServerConfig);

  // Runtime observations
  const runtime = buildRuntimeObservations(dump.dumpDetails.dumpExecution, dump.serverInfo.instructions);
  if (runtime) {
    dumpPayload.runtimeObservations = runtime;
  }

  // CORS
  if (dump.dumpDetails.dumpExecution.corsSupport) {
    dumpPayload.cors = buildCors(dump.dumpDetails.dumpExecution.corsSupport);
  }

  // Pagination detection (dynamically added field, not in TypeScript type)
  const dumpExec = dump.dumpDetails.dumpExecution as unknown as Record<string, unknown>;
  if (dumpExec.paginationSupport) {
    dumpPayload.paginationDetection = dumpExec.paginationSupport as XCiscoMetadataPaginationDetection;
  }

  // Client capabilities
  if (dump.dumpDetails.dumpExecution.clientCapabilitiesSent) {
    dumpPayload.clientCapabilities = dump.dumpDetails.dumpExecution.clientCapabilitiesSent;
  }

  // Split operation
  if (dump.dumpDetails.dumpExecution.splitOperation) {
    dumpPayload.splitOperation = dump.dumpDetails.dumpExecution.splitOperation;
  }

  return {
    version: XCISCO_METADATA_VERSION,
    dump: dumpPayload,
  };
}

function buildServerConfig(config: DumpServerConfig): XCiscoMetadataServerConfig {
  const sc: XCiscoMetadataServerConfig = {};

  if (config.name) sc.name = config.name;
  if (config.transport) sc.transport = config.transport;
  if (config.url) sc.url = config.url;
  if (config.command) sc.command = config.command;
  if (config.args && config.args.length > 0) sc.args = config.args;
  if (config.env) sc.env = config.env;

  return sc;
}

function buildRuntimeObservations(
  exec: RuntimeFindings,
  instructions?: string
): XCiscoMetadataRuntimeObservations | undefined {
  const obs: XCiscoMetadataRuntimeObservations = {};
  let hasData = false;

  if (exec.mcpProtocolUsed) {
    obs.mcpProtocolUsed = exec.mcpProtocolUsed;
    hasData = true;
  }
  if (exec.sessionIdSupported !== undefined) {
    obs.sessionIdSupported = exec.sessionIdSupported;
    hasData = true;
  }
  if (exec.sessionIdHeader) {
    obs.sessionIdHeader = exec.sessionIdHeader;
    hasData = true;
  }
  if (exec.pingSupported !== undefined) {
    obs.pingSupported = exec.pingSupported;
    hasData = true;
  }
  if (exec.pingLatencyMs !== undefined) {
    obs.pingLatencyMs = exec.pingLatencyMs;
    hasData = true;
  }
  if (instructions) {
    obs.instructions = instructions;
    hasData = true;
  }

  return hasData ? obs : undefined;
}

function buildCors(cors: CorsSupport): XCiscoMetadataCors {
  const result: XCiscoMetadataCors = {};

  if (cors.browserReady !== undefined) {
    result.browserReady = cors.browserReady;
  }
  if (cors.responseHeaders) {
    result.responseHeaders = cors.responseHeaders;
  }
  if (cors.preflight) {
    result.preflight = cors.preflight;
  }

  return result;
}

// ============================================================================
// mcpdesc + x-cisco-metadata → ContractDump (reverse converter for input parsing)
// ============================================================================

/**
 * Normalize x-cisco-metadata from either v0.1.0 or v0.2.0 shape into v0.2.0 dump payload.
 */
function normalizeXCiscoMetadata(raw: Record<string, unknown> | undefined): { dump: XCiscoMetadataDump } | undefined {
  if (!raw) return undefined;

  // v0.2.0 shape: has `version` and `dump` keys
  if (typeof raw.version === 'string' && raw.dump) {
    return raw as unknown as XCiscoMetadata;
  }

  // v0.1.0 shape: flat structure with `dumpDetails`, `sourceFormat`, etc.
  const v1 = raw as unknown as XCiscoMetadataV1;
  const dump: XCiscoMetadataDump = {
    toolName: v1.dumpDetails?.toolName || 'unknown',
    toolVersion: v1.dumpDetails?.toolVersion || 'unknown',
    createdAt: v1.dumpDetails?.createdAt || new Date().toISOString(),
  };
  if (v1.serverConfig) dump.serverConfig = v1.serverConfig;
  if (v1.runtimeObservations) dump.runtimeObservations = v1.runtimeObservations;
  if (v1.cors) dump.cors = v1.cors;
  if (v1.paginationDetection) dump.paginationDetection = v1.paginationDetection;
  if (v1.clientCapabilities) dump.clientCapabilities = v1.clientCapabilities;
  if (v1.splitOperation) dump.splitOperation = v1.splitOperation;

  return { dump };
}

/**
 * Convert an mcpdesc document back to a ContractDump for internal processing.
 * Used by commands that accept mcpdesc files as input (manifest, split, diff, etc.)
 * Supports both x-cisco-metadata v0.1.0 and v0.2.0 shapes.
 */
export function mcpDescriptionToContractDump(doc: McpDescDocument): ContractDump {
  const normalized = normalizeXCiscoMetadata(doc['x-cisco-metadata'] as unknown as Record<string, unknown>);
  const meta = normalized?.dump;

  // Build dumpExecution (RuntimeFindings) from runtime observations
  const dumpExecution: RuntimeFindings = {
    mcpProtocolUsed: meta?.runtimeObservations?.mcpProtocolUsed || doc.info.protocolVersion || 'unknown',
  };

  if (meta?.runtimeObservations) {
    if (meta.runtimeObservations.sessionIdSupported !== undefined) {
      dumpExecution.sessionIdSupported = meta.runtimeObservations.sessionIdSupported;
    }
    if (meta.runtimeObservations.sessionIdHeader) {
      dumpExecution.sessionIdHeader = meta.runtimeObservations.sessionIdHeader;
    }
    if (meta.runtimeObservations.pingSupported !== undefined) {
      dumpExecution.pingSupported = meta.runtimeObservations.pingSupported;
    }
    if (meta.runtimeObservations.pingLatencyMs !== undefined) {
      dumpExecution.pingLatencyMs = meta.runtimeObservations.pingLatencyMs;
    }
  }

  if (meta?.cors) {
    dumpExecution.corsSupport = {
      browserReady: meta.cors.browserReady ?? null,
      responseHeaders: meta.cors.responseHeaders,
      preflight: meta.cors.preflight,
    };
  }

  if (meta?.clientCapabilities) {
    dumpExecution.clientCapabilitiesSent = meta.clientCapabilities;
  }

  if (meta?.splitOperation) {
    dumpExecution.splitOperation = {
      toolName: meta.splitOperation.toolName,
      toolVersion: meta.splitOperation.toolVersion,
      createdAt: meta.splitOperation.createdAt,
      splitConfig: {
        sourceFile: meta.splitOperation.splitConfig.sourceFile,
        category: meta.splitOperation.splitConfig.category,
        configFile: meta.splitOperation.splitConfig.configFile || '',
        schemaVersion: meta.splitOperation.splitConfig.schemaVersion || '',
      },
      splitExecution: meta.splitOperation.splitExecution || {
        originalCounts: { tools: 0, prompts: 0, resources: 0, resourceTemplates: 0 },
        filteredCounts: { tools: 0, prompts: 0, resources: 0, resourceTemplates: 0 },
        filterRules: [],
      },
    };
  }

  // Rebuild pagination support on dumpExecution (dynamic property)
  if (meta?.paginationDetection) {
    (dumpExecution as unknown as Record<string, unknown>).paginationSupport = meta.paginationDetection;
  }

  // Build server config from transports + x-cisco-metadata
  const serverConfig = buildDumpServerConfig(doc, meta);

  // Build ContractDump
  const dump: ContractDump = {
    version: '',
    dumpDetails: {
      toolName: meta?.toolName || 'unknown',
      toolVersion: meta?.toolVersion || 'unknown',
      createdAt: meta?.createdAt || new Date().toISOString(),
      mcpServerConfig: serverConfig,
      dumpExecution,
    },
    serverInfo: {
      name: doc.info.name,
      version: doc.info.version,
      ...(doc.info.title && { title: doc.info.title }),
      ...(doc.info.description && { description: doc.info.description }),
      ...(doc.info.websiteUrl && { websiteUrl: doc.info.websiteUrl }),
      ...(doc.info.icons && (doc.info.icons as unknown[]).length > 0 && { icons: doc.info.icons as Icon[] }),
      protocolVersion: doc.info.protocolVersion || dumpExecution.mcpProtocolUsed,
      capabilities: inferCapabilities(doc),
      instructions: meta?.runtimeObservations?.instructions,
    },
    tools: (doc.tools || []) as ContractDump['tools'],
    resources: (doc.resources || []) as ContractDump['resources'],
    resourceTemplates: (doc.resourceTemplates || []) as ContractDump['resourceTemplates'],
    prompts: (doc.prompts || []) as ContractDump['prompts'],
  };

  return dump;
}

function buildDumpServerConfig(doc: McpDescDocument, meta?: XCiscoMetadataDump): DumpServerConfig {
  // Prefer x-cisco-metadata.dump.serverConfig (has full details), fallback to transports[0]
  if (meta?.serverConfig) {
    const sc = meta.serverConfig;
    return {
      name: sc.name || doc.info.name,
      transport: (sc.transport as 'stdio' | 'streamable-http' | 'sse') || doc.transports[0]?.type || 'stdio',
      url: sc.url,
      command: sc.command,
      args: sc.args,
      env: sc.env,
    };
  }

  // Fallback — derive from transports array
  const transport = doc.transports[0];
  return {
    name: doc.info.name,
    transport: transport?.type || 'stdio',
    url: transport?.url,
    command: transport?.command,
    args: transport?.args,
  };
}

function inferCapabilities(doc: McpDescDocument): ContractDump['serverInfo']['capabilities'] {
  // Prefer explicit capabilities from mcpdesc document
  if (doc.capabilities && Object.keys(doc.capabilities).length > 0) {
    return doc.capabilities as ContractDump['serverInfo']['capabilities'];
  }
  // Fallback — infer from capability arrays
  const caps: ContractDump['serverInfo']['capabilities'] = {};
  if (doc.tools && (doc.tools as unknown[]).length > 0) caps.tools = {};
  if (doc.resources && (doc.resources as unknown[]).length > 0) caps.resources = {};
  if (doc.prompts && (doc.prompts as unknown[]).length > 0) caps.prompts = {};
  return caps;
}

// ============================================================================
// Auto-detection: determine if input data is mcpdesc or ContractDump
// ============================================================================

/**
 * Returns true if the parsed data looks like an mcpdesc document.
 */
export function isMcpDescDocument(data: Record<string, unknown>): boolean {
  return typeof data.mcpdesc === 'string' && data.info !== undefined && data.transports !== undefined;
}

/**
 * Returns true if the parsed data looks like a ContractDump.
 */
export function isContractDump(data: Record<string, unknown>): boolean {
  return data.dumpDetails !== undefined && data.serverInfo !== undefined && data.version !== undefined;
}

/**
 * Parse input data as ContractDump, auto-detecting format.
 * If the input is mcpdesc, converts it. If it's ContractDump, returns as-is.
 */
export function parseAsContractDump(data: Record<string, unknown>): ContractDump {
  if (isMcpDescDocument(data)) {
    return mcpDescriptionToContractDump(data as unknown as McpDescDocument);
  }
  if (isContractDump(data)) {
    return data as unknown as ContractDump;
  }
  throw new Error('Unrecognized input format: expected mcpdesc document or capability dump');
}

// ============================================================================
// Enrichment Types (from --info file)
// ============================================================================

export interface EnrichmentInfo {
  name?: string;
  title?: string;
  description?: string;
  version?: string;
  id?: string;
  icons?: unknown[];
  websiteUrl?: string;
  contact?: Record<string, unknown>;
  license?: Record<string, unknown>;
  security?: unknown[];
  tags?: McpDescTag[];
}

// ============================================================================
// Apply enrichment from --info file to mcpdesc document
// ============================================================================

/**
 * Apply enrichment metadata from an info file to an mcpdesc document.
 * Info fields override dump-derived fields where provided.
 */
export function applyEnrichment(doc: McpDescDocument, info: EnrichmentInfo): McpDescDocument {
  // Override info fields
  if (info.name) doc.info.name = info.name;
  if (info.title) doc.info.title = info.title;
  if (info.version) doc.info.version = info.version;
  if (info.description) doc.info.description = info.description;
  if (info.id) doc.info.id = info.id;
  if (info.icons) doc.info.icons = info.icons;
  if (info.websiteUrl) doc.info.websiteUrl = info.websiteUrl;
  if (info.contact) doc.info.contact = info.contact;
  if (info.license) doc.info.license = info.license;

  // Root-level enrichment
  if (info.security && info.security.length > 0) doc.security = info.security;
  if (info.tags && info.tags.length > 0) doc.tags = info.tags;

  return doc;
}
