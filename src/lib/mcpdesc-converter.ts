// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Bidirectional converter between the legacy internal ContractDump and mcpdesc.
 * New output targets MCP Description 0.8.0 RC.2. Legacy v0.7 documents and
 * x-cisco-metadata remain readable for migration.
 */

import {
  RC_1_SCHEMA_URI,
  RC_2_SCHEMA_URI,
  migrateMcpDescription07ToRc1 as migrateMcpDescription07ToRc1Core,
  projectEffectiveProtocolView,
  type CoreDiagnostic,
  type SupportedCoreSpecification,
} from '@mcpdesc/core';
import {
  supportedProtocolVersions,
  type SupportedProtocolVersion,
} from '@mcpdesc/validator';
import type {
  ContractDump,
  DumpServerConfig,
  RuntimeFindings,
  ClientCapabilities,
  Icon,
} from './types.js';
import { Validator } from './validator.js';

// ============================================================================
// mcpdesc Output Types
// ============================================================================

export interface McpDescTransport {
  type: 'stdio' | 'streamable-http' | 'sse';
  protocolVersions?: string[];
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
  protocolVersions?: string[];
  instructions?: string;
  transports?: McpDescTransport[];
  security?: unknown[];
  capabilities?: Array<Record<string, unknown>> | Record<string, unknown>;
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

const MCPDESC_VERSION = '0.8.0';
const MCPDESC_SCHEMA = RC_2_SCHEMA_URI;
const REPRESENTABLE_SERVER_CAPABILITIES = new Set([
  'completions',
  'experimental',
  'extensions',
  'logging',
  'prompts',
  'resources',
  'tasks',
  'tools',
]);

export interface ContractDumpConversionOptions {
  onUnsupportedServerCapabilities?: (capabilities: string[]) => void;
}

// ============================================================================
// ContractDump → mcpdesc
// ============================================================================

/**
 * Convert a captured ContractDump to one observed mcpdesc RC.2 protocol view.
 */
export function contractDumpToMcpDescription(
  dump: ContractDump,
  options: ContractDumpConversionOptions = {},
): McpDescDocument {
  const doc: McpDescDocument = {
    $schema: MCPDESC_SCHEMA,
    mcpdesc: MCPDESC_VERSION,
    info: buildInfo(dump),
    protocolVersions: [dump.serverInfo.protocolVersion],
    transports: buildTransports(dump.dumpDetails.mcpServerConfig),
  };

  if (dump.serverInfo.instructions) {
    doc.instructions = dump.serverInfo.instructions;
  }

  const representableCapabilities: Record<string, unknown> = {};
  const unsupportedCapabilities: string[] = [];
  for (const [name, value] of Object.entries(dump.serverInfo.capabilities ?? {})) {
    if (REPRESENTABLE_SERVER_CAPABILITIES.has(name)) {
      representableCapabilities[name] = value;
    } else {
      unsupportedCapabilities.push(name);
    }
  }

  if (unsupportedCapabilities.length > 0) {
    options.onUnsupportedServerCapabilities?.(unsupportedCapabilities.sort());
  }
  if (Object.keys(representableCapabilities).length > 0) {
    doc.capabilities = [representableCapabilities];
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

  if (dump.serverInfo.websiteUrl) {
    info.websiteUrl = dump.serverInfo.websiteUrl;
  }

  if (dump.serverInfo.icons && dump.serverInfo.icons.length > 0) {
    info.icons = dump.serverInfo.icons;
  }

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
 * Used by commands that accept mcpdesc files as input (split, diff, etc.)
 * Supports both x-cisco-metadata v0.1.0 and v0.2.0 shapes.
 */
export function mcpDescriptionToContractDump(doc: McpDescDocument): ContractDump {
  const normalized = normalizeXCiscoMetadata(doc['x-cisco-metadata'] as unknown as Record<string, unknown>);
  const meta = normalized?.dump;

  // Build dumpExecution (RuntimeFindings) from runtime observations
  const dumpExecution: RuntimeFindings = {
    mcpProtocolUsed: meta?.runtimeObservations?.mcpProtocolUsed || doc.info.protocolVersion || doc.protocolVersions?.[0] || 'unknown',
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
    version: doc.mcpdesc || '',
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
      protocolVersion: doc.info.protocolVersion || doc.protocolVersions?.[0] || dumpExecution.mcpProtocolUsed,
      capabilities: inferCapabilities(doc),
      instructions: doc.instructions || meta?.runtimeObservations?.instructions,
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
      transport: (sc.transport as 'stdio' | 'streamable-http' | 'sse') || doc.transports?.[0]?.type || 'stdio',
      url: sc.url,
      command: sc.command,
      args: sc.args,
      env: sc.env,
    };
  }

  // Fallback — derive from transports array
  const transport = doc.transports?.[0];
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
  if (Array.isArray(doc.capabilities) && doc.capabilities.length > 0) {
    const capability = { ...doc.capabilities[0] };
    delete capability.protocolVersions;
    return capability as ContractDump['serverInfo']['capabilities'];
  }
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
  return typeof data.mcpdesc === 'string' && data.info !== undefined;
}

/**
 * Returns true if the parsed data looks like a ContractDump.
 */
export function isContractDump(data: Record<string, unknown>): boolean {
  return data.dumpDetails !== undefined && data.serverInfo !== undefined && data.version !== undefined;
}

export interface McpDescriptionMigrationResult {
  document: McpDescDocument;
  diagnostics: readonly CoreDiagnostic[];
}

/**
 * Validate a legacy MCP Description against its frozen schema, then migrate it
 * to the current RC.1 snapshot using the shared core semantics.
 */
export async function migrateMcpDescription07ToRc1(
  document: McpDescDocument,
  sourceName: string = 'data'
): Promise<McpDescriptionMigrationResult> {
  if (document.mcpdesc !== '0.7.0') {
    throw new Error(`Migration requires MCP Description 0.7.0, received ${document.mcpdesc}`);
  }

  const sourceValidation = await new Validator().validateData(document, 'mcpdesc', sourceName);
  if (!sourceValidation.valid) {
    const details = sourceValidation.errors
      .map((issue) => `${issue.path}: ${issue.message}`)
      .join('; ');
    throw new Error(`MCP Description 0.7.0 validation failed: ${details}`);
  }

  const migration = migrateMcpDescription07ToRc1Core(document, {
    specification: '0.8.0-rc.1',
    sourceValidated: true,
  });
  if (!migration.ok) {
    const details = migration.diagnostics
      .map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`)
      .join('; ');
    throw new Error(`Cannot migrate MCP Description 0.7.0: ${details}`);
  }

  return {
    document: migration.value as unknown as McpDescDocument,
    diagnostics: migration.diagnostics,
  };
}

/**
 * Parse an MCP description (mcpdesc) document into the internal ContractDump model.
 * The legacy on-disk capability-dump format is no longer accepted as input — use
 * `mcpcontract convert` to migrate older dumps to mcpdesc first.
 */
export function parseAsContractDump(
  data: Record<string, unknown>,
  protocolVersion?: string
): ContractDump {
  if (isMcpDescDocument(data)) {
    let document = data as unknown as McpDescDocument;
    if (document.mcpdesc === '0.8.0') {
      document = projectMcpDescriptionView(document, protocolVersion);
    }
    return mcpDescriptionToContractDump(document);
  }
  if (isContractDump(data)) {
    throw new Error(
      'Legacy capability dumps are no longer supported as input. ' +
      'Convert the file to the MCP description (mcpdesc) format first: mcpcontract convert <file>'
    );
  }
  throw new Error('Unrecognized input format: expected an MCP description (mcpdesc) document');
}

export function projectMcpDescriptionView(
  document: McpDescDocument,
  requestedProtocolVersion?: string
): McpDescDocument {
  let specification: SupportedCoreSpecification;
  if (document.$schema === RC_2_SCHEMA_URI) {
    specification = '0.8.0-rc.2';
  } else if (document.$schema === RC_1_SCHEMA_URI) {
    specification = '0.8.0-rc.1';
  } else {
    throw new Error(
      `MCP Description 0.8.0 processing requires $schema ${RC_1_SCHEMA_URI} or ${RC_2_SCHEMA_URI}`
    );
  }

  const declaredVersions = document.protocolVersions;
  if (!Array.isArray(declaredVersions) || declaredVersions.length === 0) {
    throw new Error('MCP Description 0.8.0 requires non-empty protocolVersions');
  }

  const selectedVersion = requestedProtocolVersion ?? (
    declaredVersions.length === 1 ? declaredVersions[0] : undefined
  );
  if (!selectedVersion) {
    throw new Error(
      'MCP Description declares multiple protocol versions; select one with --protocol-version'
    );
  }
  if (!supportedProtocolVersions.includes(selectedVersion as SupportedProtocolVersion)) {
    throw new Error(`Unsupported MCP protocol version: ${selectedVersion}`);
  }

  const projection = projectEffectiveProtocolView(document, {
    specification,
    protocolVersion: selectedVersion as SupportedProtocolVersion,
  });
  if (!projection.ok) {
    const details = projection.diagnostics
      .map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`)
      .join('; ');
    throw new Error(`Cannot project MCP Description protocol view: ${details}`);
  }
  return projection.value as unknown as McpDescDocument;
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
