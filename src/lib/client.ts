// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * MCP Client wrapper supporting multiple transports
 */

import { readFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { OAuthManager } from './oauth/manager.js';
import {
  ServerConfig,
  ServerInfo,
  ServerCapabilities,
  Tool,
  Resource,
  ResourceTemplate,
  Prompt,
  Root,
  ClientCapabilities,
  MCPProtocolError,
  UnsupportedProtocolVersionError,
  CLIOptions,
  CorsSupport,
  CorsPreflight,
  PaginationResult
} from './types.js';

const SUPPORTED_PROTOCOL_VERSION = '2025-06-18';

// Read version from package.json
const packageJsonPath = new URL('../../package.json', import.meta.url).pathname;
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const VERSION = packageJson.version;

export class MCPClient {
  private client: Client;
  private transport: StdioClientTransport | StreamableHTTPClientTransport | SSEClientTransport | null = null;
  private config: ServerConfig;
  private options: CLIOptions;
  private connected = false;
  private sessionIdHeaderName: string | undefined;
  private rawResponseHeaders: Headers | undefined;
  private oauthManager?: OAuthManager;
  private oauthHeaders?: Record<string, string>;

  constructor(config: ServerConfig, options: CLIOptions = {}) {
    this.config = config;
    this.options = options;
    this.client = new Client(
      {
        name: 'mcpcontract',
        version: VERSION,
      },
      {
        capabilities: {
          roots: {
            listChanged: true
          },
          sampling: {}
        }
      }
    );

    if (config.transport.type === 'streamable-http' || config.transport.type === 'sse') {
      this.oauthManager = new OAuthManager(config, options);
    }
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    try {
      if (this.oauthManager) {
        this.oauthHeaders = await this.oauthManager.getAuthorizationHeader();
      }

      if (this.config.transport.type === 'stdio') {
        await this.connectStdio();
      } else if (this.config.transport.type === 'streamable-http') {
        await this.connectHttpWithHeaderCapture();
      } else if (this.config.transport.type === 'sse') {
        await this.connectSse();
      }
      
      this.connected = true;
    } catch (error) {
      throw new MCPProtocolError(
        `Failed to connect to server: ${(error as Error).message}`,
        'CONNECTION_FAILED',
        error
      );
    }
  }

  /**
   * Connect using stdio transport
   */
  private async connectStdio(): Promise<void> {
    const transportConfig = this.config.transport;
    if (transportConfig.type !== 'stdio') {
      throw new Error('Invalid transport type');
    }

    if (this.options.verbose) {
      console.error(`[VERBOSE] Stdio transport config:`);
      console.error(`[VERBOSE]   Command: ${transportConfig.command}`);
      console.error(`[VERBOSE]   Args: ${JSON.stringify(transportConfig.args || [])}`);
      console.error(`[VERBOSE]   Env keys: ${Object.keys(transportConfig.env || {}).join(', ') || '(none)'}`);
    }

    // Build env object, filtering out undefined values
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries({ ...process.env, ...transportConfig.env })) {
      if (value !== undefined) {
        env[key] = value;
      }
    }

    if (this.options.verbose) {
      console.error(`[VERBOSE] Creating stdio transport...`);
    }

    // Create stdio transport - it will manage the child process
    this.transport = new StdioClientTransport({
      command: transportConfig.command,
      args: transportConfig.args,
      env
    });

    if (this.options.verbose) {
      console.error(`[VERBOSE] Connecting to server via stdio...`);
    }

    await this.client.connect(this.transport);
    
    if (this.options.verbose) {
      console.error(`[VERBOSE] Stdio connection established`);
    }
  }

  /**
   * Connect using HTTP streaming transport with header capture
   */
  private async connectHttpWithHeaderCapture(): Promise<void> {
    const transportConfig = this.config.transport;
    if (transportConfig.type !== 'streamable-http') {
      throw new Error('Invalid transport type');
    }

    if (this.options.verbose) {
      console.error(`[VERBOSE] HTTP transport config:`);
      console.error(`[VERBOSE]   URL: ${transportConfig.url}`);
      console.error(`[VERBOSE]   Headers: ${Object.keys(transportConfig.headers || {}).join(', ') || '(none)'}`);
    }

    // Wrap fetch to capture response headers during initialization
    const originalFetch = globalThis.fetch;
    let capturedHeaders: Headers | undefined;
    
    const wrappedFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const response = await originalFetch(input, init);
      
      // Capture headers from first response (initialization)
      if (!capturedHeaders) {
        capturedHeaders = response.headers;
        if (this.options.verbose) {
          console.error('[VERBOSE] Captured HTTP response headers from initialization');
        }
      }
      
      return response;
    };
    
    // Temporarily replace global fetch
    globalThis.fetch = wrappedFetch as any;
    
    try {
      await this.connectHttp();
      this.rawResponseHeaders = capturedHeaders;
    } finally {
      // Always restore original fetch
      globalThis.fetch = originalFetch;
    }
  }

  /**
   * Connect using HTTP transport (internal, called by connectHttpWithHeaderCapture)
   */
  private async connectHttp(): Promise<void> {
    const transportConfig = this.config.transport;
    if (transportConfig.type !== 'streamable-http') {
      throw new Error('Invalid transport type');
    }

    // Build requestInit with custom headers (for Bearer tokens, API keys, etc.)
    const mergedHeaders = this.mergeHeaders(transportConfig.headers);
    const requestInit: RequestInit | undefined = mergedHeaders
      ? { headers: mergedHeaders }
      : undefined;

    if (this.options.verbose) {
      console.error(`[VERBOSE] Creating HTTP transport...`);
    }

    this.transport = new StreamableHTTPClientTransport(
      new URL(transportConfig.url),
      { requestInit }
    );

    if (this.options.verbose) {
      console.error(`[VERBOSE] Connecting to server via HTTP...`);
    }

    await this.client.connect(this.transport);
    
    if (this.options.verbose) {
      console.error(`[VERBOSE] HTTP connection established`);
    }
  }

  /**
   * Connect using SSE transport
   */
  private async connectSse(): Promise<void> {
    const transportConfig = this.config.transport;
    if (transportConfig.type !== 'sse') {
      throw new Error('Invalid transport type');
    }

    if (this.options.verbose) {
      console.error(`[VERBOSE] SSE transport config:`);
      console.error(`[VERBOSE]   URL: ${transportConfig.url}`);
      console.error(`[VERBOSE]   Headers: ${Object.keys(transportConfig.headers || {}).join(', ') || '(none)'}`);
    }

    // Create SSE transport with optional headers
    const mergedHeaders = this.mergeHeaders(transportConfig.headers);
    const requestInit: RequestInit | undefined = mergedHeaders
      ? { headers: mergedHeaders }
      : undefined;

    if (this.options.verbose) {
      console.error(`[VERBOSE] Creating SSE transport...`);
    }

    this.transport = new SSEClientTransport(
      new URL(transportConfig.url),
      { requestInit }
    );

    if (this.options.verbose) {
      console.error(`[VERBOSE] Connecting to server via SSE...`);
    }

    await this.client.connect(this.transport);
    
    if (this.options.verbose) {
      console.error(`[VERBOSE] SSE connection established`);
    }
  }

  private mergeHeaders(existing?: Record<string, string>): Record<string, string> | undefined {
    const merged: Record<string, string> = {};

    if (existing) {
      for (const [key, value] of Object.entries(existing)) {
        merged[key] = value;
      }
    }

    if (this.oauthHeaders) {
      for (const [key, value] of Object.entries(this.oauthHeaders)) {
        merged[key] = value;
      }
    }

    return Object.keys(merged).length > 0 ? merged : undefined;
  }

  /**
   * Initialize the connection and verify protocol version
   */
  async initialize(): Promise<ServerInfo> {
    if (!this.connected) {
      throw new MCPProtocolError('Not connected to server', 'NOT_CONNECTED');
    }

    try {
      if (this.options.verbose) {
        console.error(`[VERBOSE] Initializing MCP protocol handshake...`);
      }

      // Client will auto-initialize on connect, so we get server info from getServerVersion()
      const serverVersion = this.client.getServerVersion();
      const serverCapabilities = this.client.getServerCapabilities();
      const instructions = this.client.getInstructions();
      
      if (this.options.verbose) {
        console.error(`[VERBOSE] Server version: ${serverVersion?.name} v${serverVersion?.version}`);
        console.error(`[VERBOSE] Server capabilities: ${JSON.stringify(Object.keys(serverCapabilities || {}))}`);
      }
      
      if (!serverVersion || !serverCapabilities) {
        throw new MCPProtocolError('Server did not provide required initialization data', 'INITIALIZATION_FAILED');
      }

      // The protocol version is always 2024-11-05 in the current SDK
      // We need to check if there's a way to get the actual protocol version
      const protocolVersion = SUPPORTED_PROTOCOL_VERSION;
      
      if (this.options.verbose) {
        console.error(`[VERBOSE] Protocol version: ${protocolVersion}`);
      }
      
      // Verify protocol version
      if (protocolVersion !== SUPPORTED_PROTOCOL_VERSION) {
        throw new UnsupportedProtocolVersionError(
          protocolVersion,
          SUPPORTED_PROTOCOL_VERSION
        );
      }

      // For streamable-http, capture session header from raw response
      if (this.config.transport.type === 'streamable-http') {
        this.captureSessionHeaderName();
      }

      const serverInfo: ServerInfo = {
        name: serverVersion.name,
        version: serverVersion.version,
        protocolVersion: protocolVersion,
        capabilities: serverCapabilities as ServerCapabilities,
        instructions: instructions
      };

      // Optional MCP Implementation fields (2025-06-18+ / 2025-11-25+)
      if (serverVersion.title) {
        serverInfo.title = serverVersion.title;
      }
      if (serverVersion.description) {
        serverInfo.description = serverVersion.description;
      }
      if (serverVersion.websiteUrl) {
        serverInfo.websiteUrl = serverVersion.websiteUrl;
      }
      if (serverVersion.icons && serverVersion.icons.length > 0) {
        serverInfo.icons = serverVersion.icons;
      }

      return serverInfo;
    } catch (error) {
      if (error instanceof UnsupportedProtocolVersionError) {
        throw error;
      }
      throw new MCPProtocolError(
        `Failed to initialize: ${(error as Error).message}`,
        'INITIALIZATION_FAILED',
        error
      );
    }
  }

  /**
   * Capture session header name from raw HTTP response headers
   */
  private captureSessionHeaderName(): void {
    if (!this.rawResponseHeaders) {
      if (this.options.verbose) {
        console.error('[VERBOSE] No raw response headers available for session header detection');
      }
      return;
    }
    
    // Iterate through actual response headers to find session header
    // Preserve exact casing as returned by server
    this.rawResponseHeaders.forEach((_, headerName) => {
      if (headerName.toLowerCase() === 'mcp-session-id') {
        this.sessionIdHeaderName = headerName; // Exact casing from server
        if (this.options.verbose) {
          console.error(`[VERBOSE] Session header detected: ${headerName}`);
        }
      }
    });
  }

  /**
   * Get client capabilities that were sent
   */
  getClientCapabilities(): ClientCapabilities {
    return {
      roots: {
        listChanged: true
      },
      sampling: {}
    };
  }

  /**
   * Get CLI options (for internal use by dumper)
   */
  getOptions(): CLIOptions {
    return this.options;
  }

  /**
   * Get session ID from HTTP streaming transport (if applicable)
   * Returns undefined for stdio transport or if no session was established
   */
  getSessionId(): string | undefined {
    if (this.config.transport.type === 'streamable-http' && this.transport) {
      // The transport is StreamableHTTPClientTransport which has a sessionId getter
      return (this.transport as any).sessionId;
    }
    return undefined;
  }

  /**
   * Get session ID header name from HTTP streaming transport (if applicable)
   * Returns undefined for stdio transport or if no session was established
   */
  getSessionIdHeader(): string | undefined {
    return this.sessionIdHeaderName;
  }

  /**
   * Detect CORS support for browser-based MCP clients
   * Only applicable for streamable-http and sse transports
   */
  async detectCorsSupport(): Promise<CorsSupport | undefined> {
    // Only check CORS for HTTP/SSE transports
    if (this.config.transport.type !== 'streamable-http' && 
        this.config.transport.type !== 'sse') {
      return undefined;
    }

    try {
      const corsSupport: CorsSupport = {
        browserReady: null
      };

      // Capture CORS headers from the initialization response
      if (this.rawResponseHeaders) {
        corsSupport.responseHeaders = {
          accessControlAllowOrigin: this.rawResponseHeaders.get('access-control-allow-origin') || undefined,
          accessControlExposeHeaders: this.parseHeaderList(
            this.rawResponseHeaders.get('access-control-expose-headers')
          )
        };
      }

      // Perform OPTIONS preflight test
      const preflightResult = await this.testCorsPreflight();
      if (preflightResult) {
        corsSupport.preflight = preflightResult;
      }

      // Calculate browserReady heuristic
      corsSupport.browserReady = this.calculateBrowserReady(corsSupport);

      return corsSupport;
    } catch (error) {
      if (this.options.verbose) {
        console.error('[VERBOSE] CORS detection failed:', error);
      }
      // Return partial result or undefined
      return undefined;
    }
  }

  /**
   * Test CORS preflight (OPTIONS request)
   */
  private async testCorsPreflight(): Promise<CorsPreflight | undefined> {
    if (this.config.transport.type !== 'streamable-http' && 
        this.config.transport.type !== 'sse') {
      return undefined;
    }

    try {
      const url = this.config.transport.url;
      const origin = this.options.corsOrigin || 'http://localhost:3000';
      
      if (this.options.verbose) {
        console.error(`[VERBOSE] Testing CORS preflight with origin: ${origin}`);
      }

      const response = await fetch(url, {
        method: 'OPTIONS',
        headers: {
          'Origin': origin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, Mcp-Session-Id'
        }
      });

      const preflight: CorsPreflight = {
        tested: true,
        status: response.status,
        accessControlAllowOrigin: response.headers.get('access-control-allow-origin') || undefined,
        accessControlAllowMethods: this.parseHeaderList(
          response.headers.get('access-control-allow-methods')
        ),
        accessControlAllowHeaders: this.parseHeaderList(
          response.headers.get('access-control-allow-headers')
        )
      };

      if (this.options.verbose) {
        console.error(`[VERBOSE] Preflight status: ${preflight.status}`);
        console.error(`[VERBOSE] Allow-Origin: ${preflight.accessControlAllowOrigin}`);
        console.error(`[VERBOSE] Allow-Methods: ${preflight.accessControlAllowMethods?.join(', ')}`);
        console.error(`[VERBOSE] Allow-Headers: ${preflight.accessControlAllowHeaders?.join(', ')}`);
      }

      return preflight;
    } catch (error) {
      if (this.options.verbose) {
        console.error('[VERBOSE] CORS preflight test failed:', error);
      }
      return {
        tested: true
        // status and other fields will be undefined, indicating failure
      };
    }
  }

  /**
   * Parse comma-separated header list
   */
  private parseHeaderList(headerValue: string | null): string[] | undefined {
    if (!headerValue) return undefined;
    return headerValue
      .split(',')
      .map(h => h.trim())
      .filter(h => h.length > 0);
  }

  /**
   * Calculate browserReady heuristic
   * Uses existing dumpExecution session fields instead of duplicating in CORS object
   */
  private calculateBrowserReady(cors: CorsSupport): boolean | null {
    // If we don't have enough data, return null
    if (!cors.responseHeaders || !cors.preflight) {
      return null;
    }

    // Check critical requirements for browser usage:
    // 1. Session header must be exposed (if sessions are used)
    // 2. Preflight must succeed (2xx status)
    // 3. Preflight must allow POST method
    // 4. Preflight must allow session header (if sessions are used)

    // Check preflight success
    if (!cors.preflight.status || cors.preflight.status < 200 || cors.preflight.status >= 300) {
      return false;
    }

    // Check POST is allowed
    if (!cors.preflight.accessControlAllowMethods || 
        !cors.preflight.accessControlAllowMethods.some(m => m.toUpperCase() === 'POST')) {
      return false;
    }

    // If server uses sessions, check session header is properly handled
    // Use existing session info from dumpExecution (captured earlier)
    const sessionId = this.getSessionId();
    const sessionHeader = this.getSessionIdHeader();
    const hasSession = sessionId !== undefined;
    
    if (hasSession && sessionHeader) {
      // Session header must be exposed in Access-Control-Expose-Headers
      const exposedHeaders = cors.responseHeaders.accessControlExposeHeaders || [];
      const sessionExposed = exposedHeaders.some(h => h.toLowerCase() === sessionHeader.toLowerCase());
      
      if (!sessionExposed) {
        return false;
      }

      // Session header must be allowed in preflight
      if (cors.preflight.accessControlAllowHeaders) {
        const headerAllowed = cors.preflight.accessControlAllowHeaders
          .some(h => h.toLowerCase() === sessionHeader.toLowerCase());
        if (!headerAllowed) {
          return false;
        }
      }
    }

    // All checks passed
    return true;
  }

  /**
   * Check if an error indicates a JSON-RPC "Method not found" (-32601) response.
   * Handles both conformant servers (error.code === -32601) and non-conformant
   * servers that return -32601 inside an HTTP error body.
   *
   * Per MCP spec, JSON-RPC errors should be returned with HTTP 200 and the error
   * in the JSON-RPC response body. Some servers incorrectly return HTTP 4xx with
   * the JSON-RPC error embedded in the HTTP error body instead.
   */
  private isMethodNotSupported(error: unknown): boolean {
    const err = error as any;

    // Case 1: Conformant server — MCP SDK surfaces JSON-RPC error code directly
    if (err.code === -32601) {
      return true;
    }

    // Case 2: Non-conformant server — JSON-RPC error embedded in HTTP error body
    if (err.message && typeof err.message === 'string') {
      const match = err.message.match(/"code"\s*:\s*(-?\d+)/);
      if (match && parseInt(match[1]) === -32601) {
        console.error(
          `[WARNING] Server returned JSON-RPC error code -32601 inside an HTTP error response. ` +
          `Per MCP specification, JSON-RPC errors should be returned with HTTP 200 status ` +
          `and the error in the JSON-RPC response body. This server may not fully conform ` +
          `to the MCP transport specification.`
        );
        return true;
      }
    }

    return false;
  }

  /**
   * Test ping support and measure latency
   * Returns {supported: true, latencyMs: number} if server responds to ping
   * Returns {supported: false} if ping fails or times out
   */
  async testPing(timeoutMs: number = 5000): Promise<{ supported: boolean; latencyMs?: number }> {
    if (!this.connected) {
      throw new MCPProtocolError('Not connected to server', 'NOT_CONNECTED');
    }

    try {
      const startTime = Date.now();
      
      // Set timeout for ping request
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Ping timeout')), timeoutMs);
      });
      
      // Send ping request
      const pingPromise = this.client.ping();
      
      // Race between ping and timeout
      await Promise.race([pingPromise, timeoutPromise]);
      
      const latencyMs = Date.now() - startTime;
      
      if (this.options.verbose) {
        console.error(`[VERBOSE] Ping successful: ${latencyMs}ms`);
      }
      
      return { supported: true, latencyMs };
    } catch (error) {
      if (this.options.verbose) {
        console.error(`[VERBOSE] Ping failed: ${(error as Error).message}`);
      }
      return { supported: false };
    }
  }

  /**
   * List all tools
   */
  async listTools(): Promise<Tool[]> {
    const result = await this.listToolsComplete();
    return result.items;
  }

  /**
   * List all tools with pagination support (exhaustive fetch)
   */
  async listToolsComplete(): Promise<PaginationResult<Tool>> {
    const allItems: Tool[] = [];
    let cursor: string | undefined = undefined;
    let paginationDetected = false;
    let pagesRetrieved = 0;
    const maxPages = 1000; // Safety limit

    try {
      do {
        const params: any = {
          ...(cursor ? { cursor } : {}),
          ...(this.options.pageSize ? { pageSize: this.options.pageSize } : {})
        };
        const response = await this.client.listTools(params);
        
        const tools = response.tools as Tool[];
        allItems.push(...tools);
        pagesRetrieved++;
        
        cursor = (response as any).nextCursor;
        if (cursor) {
          paginationDetected = true; // Server used pagination
          
          if (this.options.verbose) {
            console.error(
              `[VERBOSE] Tools: fetched page ${pagesRetrieved} ` +
              `(${tools.length} items), nextCursor present, continuing...`
            );
          }
        }

        // Safety check to prevent infinite loops
        if (pagesRetrieved >= maxPages) {
          console.error(
            `[WARNING] Tools: reached maximum page limit (${maxPages}), ` +
            `stopping pagination. Retrieved ${allItems.length} items so far.`
          );
          break;
        }
      } while (cursor);

      if (this.options.verbose && paginationDetected) {
        console.error(
          `[VERBOSE] Tools: completed pagination, ` +
          `${pagesRetrieved} pages, ${allItems.length} total items`
        );
      }

      return {
        items: allItems,
        paginationDetected,
        pagesRetrieved,
        totalItems: allItems.length
      };
    } catch (error) {
      if (this.options.verbose) {
        console.error(`[VERBOSE] listTools error: code=${(error as any).code}, message=${(error as Error).message}`);
      }
      // Tools might not be supported, return empty result
      if (this.isMethodNotSupported(error)) {
        return {
          items: [],
          paginationDetected: false,
          pagesRetrieved: 0,
          totalItems: 0
        };
      }
      throw new MCPProtocolError(
        `Failed to list tools: ${(error as Error).message}`,
        'LIST_TOOLS_FAILED',
        error
      );
    }
  }

  /**
   * List all resources
   */
  async listResources(): Promise<Resource[]> {
    const result = await this.listResourcesComplete();
    return result.items;
  }

  /**
   * List all resources with pagination support (exhaustive fetch)
   */
  async listResourcesComplete(): Promise<PaginationResult<Resource>> {
    const allItems: Resource[] = [];
    let cursor: string | undefined = undefined;
    let paginationDetected = false;
    let pagesRetrieved = 0;
    const maxPages = 1000;

    try {
      do {
        const params: any = {
          ...(cursor ? { cursor } : {}),
          ...(this.options.pageSize ? { pageSize: this.options.pageSize } : {})
        };
        const response = await this.client.listResources(params);
        
        const resources = response.resources as Resource[];
        allItems.push(...resources);
        pagesRetrieved++;
        
        cursor = (response as any).nextCursor;
        if (cursor) {
          paginationDetected = true;
          
          if (this.options.verbose) {
            console.error(
              `[VERBOSE] Resources: fetched page ${pagesRetrieved} ` +
              `(${resources.length} items), nextCursor present, continuing...`
            );
          }
        }

        if (pagesRetrieved >= maxPages) {
          console.error(
            `[WARNING] Resources: reached maximum page limit (${maxPages}), ` +
            `stopping pagination. Retrieved ${allItems.length} items so far.`
          );
          break;
        }
      } while (cursor);

      if (this.options.verbose && paginationDetected) {
        console.error(
          `[VERBOSE] Resources: completed pagination, ` +
          `${pagesRetrieved} pages, ${allItems.length} total items`
        );
      }

      return {
        items: allItems,
        paginationDetected,
        pagesRetrieved,
        totalItems: allItems.length
      };
    } catch (error) {
      if (this.options.verbose) {
        console.error(`[VERBOSE] listResources error: code=${(error as any).code}, message=${(error as Error).message}`);
      }
      if (this.isMethodNotSupported(error)) {
        return {
          items: [],
          paginationDetected: false,
          pagesRetrieved: 0,
          totalItems: 0
        };
      }
      throw new MCPProtocolError(
        `Failed to list resources: ${(error as Error).message}`,
        'LIST_RESOURCES_FAILED',
        error
      );
    }
  }

  /**
   * List all resource templates
   */
  async listResourceTemplates(): Promise<ResourceTemplate[]> {
    const result = await this.listResourceTemplatesComplete();
    return result.items;
  }

  /**
   * List all resource templates with pagination support (exhaustive fetch)
   */
  async listResourceTemplatesComplete(): Promise<PaginationResult<ResourceTemplate>> {
    const allItems: ResourceTemplate[] = [];
    let cursor: string | undefined = undefined;
    let paginationDetected = false;
    let pagesRetrieved = 0;
    const maxPages = 1000;

    try {
      do {
        const params: any = {
          ...(cursor ? { cursor } : {}),
          ...(this.options.pageSize ? { pageSize: this.options.pageSize } : {})
        };
        const response = await this.client.listResourceTemplates(params);
        
        const templates = response.resourceTemplates as ResourceTemplate[];
        allItems.push(...templates);
        pagesRetrieved++;
        
        cursor = (response as any).nextCursor;
        if (cursor) {
          paginationDetected = true;
          
          if (this.options.verbose) {
            console.error(
              `[VERBOSE] Resource templates: fetched page ${pagesRetrieved} ` +
              `(${templates.length} items), nextCursor present, continuing...`
            );
          }
        }

        if (pagesRetrieved >= maxPages) {
          console.error(
            `[WARNING] Resource templates: reached maximum page limit (${maxPages}), ` +
            `stopping pagination. Retrieved ${allItems.length} items so far.`
          );
          break;
        }
      } while (cursor);

      if (this.options.verbose && paginationDetected) {
        console.error(
          `[VERBOSE] Resource templates: completed pagination, ` +
          `${pagesRetrieved} pages, ${allItems.length} total items`
        );
      }

      return {
        items: allItems,
        paginationDetected,
        pagesRetrieved,
        totalItems: allItems.length
      };
    } catch (error) {
      if (this.options.verbose) {
        console.error(`[VERBOSE] listResourceTemplates error: code=${(error as any).code}, message=${(error as Error).message}`);
      }
      if (this.isMethodNotSupported(error)) {
        return {
          items: [],
          paginationDetected: false,
          pagesRetrieved: 0,
          totalItems: 0
        };
      }
      throw new MCPProtocolError(
        `Failed to list resource templates: ${(error as Error).message}`,
        'LIST_RESOURCE_TEMPLATES_FAILED',
        error
      );
    }
  }

  /**
   * List all prompts
   */
  async listPrompts(): Promise<Prompt[]> {
    const result = await this.listPromptsComplete();
    return result.items;
  }

  /**
   * List all prompts with pagination support (exhaustive fetch)
   */
  async listPromptsComplete(): Promise<PaginationResult<Prompt>> {
    const allItems: Prompt[] = [];
    let cursor: string | undefined = undefined;
    let paginationDetected = false;
    let pagesRetrieved = 0;
    const maxPages = 1000;

    try {
      do {
        const params: any = {
          ...(cursor ? { cursor } : {}),
          ...(this.options.pageSize ? { pageSize: this.options.pageSize } : {})
        };
        const response = await this.client.listPrompts(params);
        
        const prompts = response.prompts as Prompt[];
        allItems.push(...prompts);
        pagesRetrieved++;
        
        cursor = (response as any).nextCursor;
        if (cursor) {
          paginationDetected = true;
          
          if (this.options.verbose) {
            console.error(
              `[VERBOSE] Prompts: fetched page ${pagesRetrieved} ` +
              `(${prompts.length} items), nextCursor present, continuing...`
            );
          }
        }

        if (pagesRetrieved >= maxPages) {
          console.error(
            `[WARNING] Prompts: reached maximum page limit (${maxPages}), ` +
            `stopping pagination. Retrieved ${allItems.length} items so far.`
          );
          break;
        }
      } while (cursor);

      if (this.options.verbose && paginationDetected) {
        console.error(
          `[VERBOSE] Prompts: completed pagination, ` +
          `${pagesRetrieved} pages, ${allItems.length} total items`
        );
      }

      return {
        items: allItems,
        paginationDetected,
        pagesRetrieved,
        totalItems: allItems.length
      };
    } catch (error) {
      if (this.options.verbose) {
        console.error(`[VERBOSE] listPrompts error: code=${(error as any).code}, message=${(error as Error).message}`);
      }
      if (this.isMethodNotSupported(error)) {
        return {
          items: [],
          paginationDetected: false,
          pagesRetrieved: 0,
          totalItems: 0
        };
      }
      throw new MCPProtocolError(
        `Failed to list prompts: ${(error as Error).message}`,
        'LIST_PROMPTS_FAILED',
        error
      );
    }
  }

  /**
   * List roots (if server requests them)
   */
  async listRoots(): Promise<Root[]> {
    try {
      // This would be called if the server sends a roots/list request
      // For now, we return empty array as this is client-initiated
      return [];
    } catch (error) {
      // Roots might not be applicable, return empty array
      return [];
    }
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    if (this.connected) {
      try {
        // Close the client connection first
        await this.client.close();
        
        // Explicitly close the transport to ensure cleanup
        if (this.transport) {
          await this.transport.close();
          this.transport = null;
        }
      } catch (error) {
        console.error('Error closing connection:', error);
      }
      this.connected = false;
    }
  }
}
