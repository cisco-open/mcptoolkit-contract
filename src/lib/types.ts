// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Type definitions for mcpcontract tool
 */

// ============================================================================
// Configuration Types
// ============================================================================

export type TransportType = 'stdio' | 'streamable-http' | 'http' | 'sse';

export interface StdioTransportConfig {
  type: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface HttpTransportConfig {
  type: 'streamable-http' | 'http';
  url: string;
  headers?: Record<string, string>;
}

export interface SseTransportConfig {
  type: 'sse';
  url: string;
  headers?: Record<string, string>;
}

export type TransportConfig = StdioTransportConfig | HttpTransportConfig | SseTransportConfig;

export interface ServerConfig {
  name: string;
  transport: TransportConfig;
}

// ============================================================================
// MCP Protocol Types (aligned with 2025-06-18 specification)
// ============================================================================

export interface ServerCapabilities {
  experimental?: Record<string, unknown>;
  logging?: Record<string, unknown>;
  prompts?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  tools?: {
    listChanged?: boolean;
  };
  completions?: Record<string, unknown>;
  tasks?: Record<string, unknown>;
}

export interface ClientCapabilities {
  experimental?: Record<string, unknown>;
  roots?: {
    listChanged?: boolean;
  };
  sampling?: Record<string, unknown>;
}

export interface Implementation {
  name: string;
  version: string;
  title?: string;
  description?: string;
  websiteUrl?: string;
  icons?: Icon[];
}

export interface ServerInfo {
  name: string;
  version: string;
  title?: string;
  description?: string;
  websiteUrl?: string;
  icons?: Icon[];
  protocolVersion: string;
  capabilities: ServerCapabilities;
  instructions?: string;
}

export interface Icon {
  src: string;
  mimeType?: string;
  sizes?: string[];
  theme?: 'light' | 'dark';
}

export interface ToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
  [key: string]: unknown;
}

export interface Tool {
  name: string;
  title?: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
  outputSchema?: Record<string, unknown>;
  annotations?: ToolAnnotations;
  execution?: {
    taskSupport?: 'forbidden' | 'optional' | 'required';
  };
  icons?: Icon[];
  tags?: string[];
  deprecated?: boolean;
  _meta?: Record<string, unknown>;
}

export interface Resource {
  uri: string;
  name: string;
  title?: string;
  description?: string;
  mimeType?: string;
  size?: number;
  annotations?: {
    audience?: string[];
    priority?: number;
    [key: string]: unknown;
  };
  icons?: Icon[];
  tags?: string[];
  deprecated?: boolean;
  _meta?: Record<string, unknown>;
}

export interface ResourceTemplate {
  uriTemplate: string;
  name: string;
  title?: string;
  description?: string;
  mimeType?: string;
  annotations?: {
    audience?: string[];
    priority?: number;
    [key: string]: unknown;
  };
  icons?: Icon[];
  tags?: string[];
  deprecated?: boolean;
  _meta?: Record<string, unknown>;
}

export interface PromptArgument {
  name: string;
  title?: string;
  description?: string;
  required?: boolean;
}

export interface Prompt {
  name: string;
  title?: string;
  description?: string;
  arguments?: PromptArgument[];
  icons?: Icon[];
  tags?: string[];
  deprecated?: boolean;
  _meta?: Record<string, unknown>;
}

export interface Root {
  uri: string;
  name?: string;
}

// ============================================================================
// Pagination Types
// ============================================================================

export interface PaginationResult<T> {
  items: T[];                    // All items across all pages
  paginationDetected: boolean;   // Whether server used pagination
  pagesRetrieved: number;        // Number of pages fetched
  totalItems: number;            // Total count of items
}

// ============================================================================
// Session Information Types
// ============================================================================

export interface SessionInfo {
  hasSession: boolean;
}

// ============================================================================
// CORS Support Types
// ============================================================================

export interface CorsResponseHeaders {
  accessControlAllowOrigin?: string;
  accessControlExposeHeaders?: string[];
}

export interface CorsPreflight {
  tested: boolean;
  status?: number;
  accessControlAllowOrigin?: string;
  accessControlAllowMethods?: string[];
  accessControlAllowHeaders?: string[];
}

export interface CorsSupport {
  browserReady: boolean | null;
  responseHeaders?: CorsResponseHeaders;
  preflight?: CorsPreflight;
}

// ============================================================================
// Dump Structure Types
// ============================================================================

export interface RuntimeFindings {
  mcpProtocolUsed: string; // MCP protocol version used by dump tool when communicating with server
  sessionIdSupported?: boolean; // Whether server supports session IDs (HTTP streaming only)
  sessionIdHeader?: string; // Exact session header name (e.g., "Mcp-Session-Id" or "MCP-Session-Id")
  clientCapabilitiesSent?: ClientCapabilities; // Client capabilities sent during initialization
  corsSupport?: CorsSupport; // CORS support detection (HTTP/SSE transports only)
  pingSupported?: boolean; // Whether server responded to ping request (optional MCP utility for keepalive)
  pingLatencyMs?: number; // Round-trip latency in ms for ping (baseline connection performance)
  
  // Split operation metadata (only present in split outputs)
  // Mirrors the structure of top-level dumpDetails for consistency
  splitOperation?: {
    // Split tool identification (parallel to top-level toolName/toolVersion/createdAt)
    toolName: string;       // Tool that performed split (e.g., 'mcpcontract')
    toolVersion: string;    // Version of split command
    createdAt: string;      // ISO 8601 timestamp of split operation
    
    // Split configuration (parallel to mcpServerConfig)
    splitConfig: {
      sourceFile: string;      // Original dump filename
      category: string;        // Category name from split config
      configFile: string;      // Split config filename
    };
    
    // Split execution details (parallel to dumpExecution)
    splitExecution: {
      originalCounts: {
        tools: number;
        prompts: number;
        resources: number;
        resourceTemplates: number;
      };
      filteredCounts: {
        tools: number;
        prompts: number;
        resources: number;
        resourceTemplates: number;
      };
      filterRules: Array<{
        capability: string;  // 'tools', 'prompts', 'resources', 'resourceTemplates'
        type: string;        // 'name-pattern'
        pattern: string;     // Regex pattern applied
      }>;
    };
  };
}

export interface DumpMetadata {
  toolName: string; // Name of the tool used to create the dump
  toolVersion: string; // Version of mcpcontract tool
  description?: string; // Optional description of how the dump was created
  createdAt: string; // ISO 8601 timestamp of dump creation
  mcpServerConfig: DumpServerConfig; // Configuration used to connect to the MCP server
  dumpExecution: RuntimeFindings; // Runtime information discovered during connection (includes splitOperation for split outputs)
}

export interface DumpServerConfig {
  name: string;
  transport: 'stdio' | 'streamable-http' | 'sse'; // Always normalized to spec value
  // For HTTP/SSE transport
  url?: string;
  headers?: Record<string, string>;
  // For stdio transport
  command?: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface ContractDump {
  version: string; // Legacy dump schema $id reference — internal use only, remove at v1.0
  dumpDetails: DumpMetadata;
  serverInfo: ServerInfo;
  tools: Tool[];
  resources: Resource[];
  resourceTemplates: ResourceTemplate[];
  prompts: Prompt[];
  roots?: Root[];
}

// ============================================================================
// CLI Options Types
// ============================================================================

export interface CLIOptions {
  wizard?: boolean;        // Launch interactive wizard mode
  config?: string;          // Path to config file
  mcpServer?: string;       // Name of server to select from config file (when multiple servers exist)
  serverName?: string;      // Server name
  transport?: TransportType;
  url?: string;            // For HTTP transport
  command?: string;        // For stdio transport
  args?: string[];         // For stdio transport
  env?: string | Record<string, string>; // Environment variables (can be string from CLI or object)
  header?: string[];       // HTTP headers (curl-style array: ["Key: Value", ...])
  output?: string;         // Output file path
  format?: 'json' | 'yaml' | 'markdown'; // Output format
  compact?: boolean;       // Compact JSON output (single line)
  quiet?: boolean;         // Suppress progress messages
  verbose?: boolean;       // Show detailed debugging information
  auth?: 'auto' | 'oauth' | 'none'; // Authentication mode selection
  browser?: boolean;       // Whether to auto-launch browser for OAuth flow (default true)
  oauthScope?: string[];   // Additional OAuth scopes requested
  oauthResource?: string;  // Override for OAuth resource parameter
  oauthCallbackPort?: number; // Override for local OAuth callback listener port
  oauthClientId?: string;  // Pre-registered OAuth client ID (overrides default)
  oauthClientSecret?: string; // Pre-registered OAuth client secret (for confidential clients)
  validateSchema?: string; // Path to schema file for validation
  skipCorsCheck?: boolean; // Skip CORS detection (for dump command)
  corsOrigin?: string;     // Origin header for CORS preflight testing (default: http://localhost:3000)
  pageSize?: number;       // Hint for pagination page size (for testing/discovery)
  info?: string;           // Path to enrichment info file (for dump command)
}

// ============================================================================
// Error Types
// ============================================================================

export class MCPProtocolError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'MCPProtocolError';
  }
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export class UnsupportedProtocolVersionError extends Error {
  constructor(
    public receivedVersion: string,
    public expectedVersion: string = '2025-06-18'
  ) {
    super(
      `Unsupported MCP protocol version: ${receivedVersion}. ` +
      `Expected version: ${expectedVersion}`
    );
    this.name = 'UnsupportedProtocolVersionError';
  }
}

// ============================================================================
// Split Configuration Types
// ============================================================================

export interface SplitFilter {
  type: 'name-pattern';
  pattern: string;
  description?: string;
}

export interface SplitCategoryFilters {
  tools?: SplitFilter[];
  prompts?: SplitFilter[];
  resources?: SplitFilter[];
  resourceTemplates?: SplitFilter[];
}

export interface SplitCategory {
  name: string;
  description?: string;
  outputFile: string;
  filters: SplitCategoryFilters;
}

export interface SplitConfigInfo {
  version: string;
  name?: string;
  description?: string;
  created?: string;
  updated?: string;
  author?: string;
}

export interface UnmatchedItemsConfig {
  action: 'ignore' | 'warn' | 'error' | 'separate-file';
  outputFile?: string;
}

export interface SplitConfig {
  schemaVersion: string;
  info: SplitConfigInfo;
  categories: SplitCategory[];
  unmatchedItems?: UnmatchedItemsConfig;
}

export interface SplitResult {
  category: string;
  outputFile: string;
  matchedTools: number;
  dump: ContractDump;
}

export interface SplitStats {
  totalTools: number;
  matchedTools: number;
  unmatchedTools: number;
  categories: Array<{
    name: string;
    matchedTools: number;
  }>;
  multipleMatches: Array<{
    toolName: string;
    categories: string[];
  }>;
}
