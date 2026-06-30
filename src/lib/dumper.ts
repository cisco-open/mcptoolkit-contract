// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Contract dumper - extracts all capabilities from an MCP server
 */

import { readFile } from 'node:fs/promises';
import { MCPClient } from './client.js';
import { ServerConfig, ContractDump, DumpServerConfig, CLIOptions } from './types.js';

// Extract version from package.json
const getToolVersion = async (): Promise<string> => {
  // From build/lib/dumper.js, go up two levels to reach package.json at root
  const packageJsonPath = new URL('../../package.json', import.meta.url).pathname;
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
  return packageJson.version;
};

export class ContractDumper {
  private client: MCPClient;
  private config: ServerConfig;

  constructor(config: ServerConfig, options: CLIOptions = {}) {
    this.config = config;
    this.client = new MCPClient(config, options);
  }

  /**
   * Perform the complete dump operation
   */
  async dump(): Promise<ContractDump> {
    try {
      // Connect to the server
      await this.client.connect();

      // Initialize and verify protocol version
      const serverInfo = await this.client.initialize();

      // Get client capabilities
      const clientCapabilities = this.client.getClientCapabilities();

      // Get session info (only for HTTP streaming transport)
      const sessionId = this.client.getSessionId();
      const sessionIdSupported = sessionId !== undefined ? true : 
                                 this.config.transport.type === 'streamable-http' ? false : 
                                 undefined;
      const sessionIdHeader = this.client.getSessionIdHeader();

      // Detect CORS support (only for HTTP/SSE transports, unless skipped)
      let corsSupport = undefined;
      if (!this.client.getOptions().skipCorsCheck) {
        corsSupport = await this.client.detectCorsSupport();
      }

      // Test ping support and measure latency
      const pingResult = await this.client.testPing();

      // Extract all capabilities and versions in parallel for efficiency
      // Use complete methods to get ALL items and track pagination
      const [toolsResult, resourcesResult, resourceTemplatesResult, promptsResult, roots, toolVersion] = await Promise.all([
        this.client.listToolsComplete(),
        this.client.listResourcesComplete(),
        this.client.listResourceTemplatesComplete(),
        this.client.listPromptsComplete(),
        this.client.listRoots(),
        getToolVersion()
      ]);

      // Build runtime findings
      const dumpExecution: any = {
        mcpProtocolUsed: serverInfo.protocolVersion
      };
      if (sessionIdSupported !== undefined) {
        dumpExecution.sessionIdSupported = sessionIdSupported;
        
        // sessionIdHeader is REQUIRED when sessionIdSupported is true
        if (sessionIdSupported) {
          if (!sessionIdHeader) {
            // Fail-fast: cannot proceed without header name
            throw new Error(
              'Session ID is supported but header name could not be determined. ' +
              'HTTP response header inspection failed. Run with --verbose for details.'
            );
          }
          dumpExecution.sessionIdHeader = sessionIdHeader;
        }
      }
      // Include client capabilities sent during initialization
      if (clientCapabilities) {
        dumpExecution.clientCapabilitiesSent = clientCapabilities;
      }
      // Include CORS support detection (if performed)
      if (corsSupport) {
        dumpExecution.corsSupport = corsSupport;
      }
      // Include ping support test results
      dumpExecution.pingSupported = pingResult.supported;
      if (pingResult.latencyMs !== undefined) {
        dumpExecution.pingLatencyMs = pingResult.latencyMs;
      }
      
      // Include pagination detection results
      const paginationSupport: any = {};
      if (toolsResult.paginationDetected) {
        paginationSupport.tools = {
          paginationDetected: true,
          pagesRetrieved: toolsResult.pagesRetrieved,
          totalItems: toolsResult.totalItems
        };
      }
      if (resourcesResult.paginationDetected) {
        paginationSupport.resources = {
          paginationDetected: true,
          pagesRetrieved: resourcesResult.pagesRetrieved,
          totalItems: resourcesResult.totalItems
        };
      }
      if (resourceTemplatesResult.paginationDetected) {
        paginationSupport.resourceTemplates = {
          paginationDetected: true,
          pagesRetrieved: resourceTemplatesResult.pagesRetrieved,
          totalItems: resourceTemplatesResult.totalItems
        };
      }
      if (promptsResult.paginationDetected) {
        paginationSupport.prompts = {
          paginationDetected: true,
          pagesRetrieved: promptsResult.pagesRetrieved,
          totalItems: promptsResult.totalItems
        };
      }
      
      // Only include paginationSupport if at least one capability uses pagination
      if (Object.keys(paginationSupport).length > 0) {
        dumpExecution.paginationSupport = paginationSupport;
      }

      // Build the dump
      const dump: ContractDump = {
        version: '',
        dumpDetails: {
          toolName: 'mcpcontract',
          toolVersion: toolVersion,
          description: 'This dump was generated by connecting to a live MCP server instance and extracting its capabilities.',
          createdAt: new Date().toISOString(),
          mcpServerConfig: this.buildServerConfig(),
          dumpExecution
        },
        serverInfo,
        tools: toolsResult.items,
        resources: resourcesResult.items,
        resourceTemplates: resourceTemplatesResult.items,
        prompts: promptsResult.items
      };

      // Only include roots if we have any
      if (roots && roots.length > 0) {
        dump.roots = roots;
      }

      return dump;
    } finally {
      // Always close the connection
      await this.client.close();
    }
  }

  /**
   * Build sanitized server config for the dump
   * (removes sensitive information)
   */
  private buildServerConfig(): DumpServerConfig {
    // Normalize transport type: 'http' -> 'streamable-http' (official MCP spec value)
    const transportType = this.config.transport.type === 'http' ? 'streamable-http' : this.config.transport.type;
    
    const config: DumpServerConfig = {
      name: this.config.name,
      transport: transportType
    };

    if (this.config.transport.type === 'streamable-http' || this.config.transport.type === 'http') {
      config.url = this.config.transport.url;
      // Include headers but mask sensitive values
      if (this.config.transport.headers) {
        config.headers = this.maskSensitiveHeaders(this.config.transport.headers);
      }
    } else if (this.config.transport.type === 'stdio') {
      config.command = this.config.transport.command;
      config.args = this.config.transport.args;
      // Include env but mask sensitive values
      if (this.config.transport.env) {
        config.env = this.maskSensitiveEnv(this.config.transport.env);
      }
    }

    return config;
  }

  /**
   * Mask sensitive header values (tokens, keys, etc.)
   */
  private maskSensitiveHeaders(headers: Record<string, string>): Record<string, string> {
    const sensitivePatterns = [
      /token/i,
      /key/i,
      /secret/i,
      /password/i,
      /auth/i,
      /bearer/i,
      /credential/i
    ];

    const masked: Record<string, string> = {};

    for (const [key, value] of Object.entries(headers)) {
      const isSensitive = sensitivePatterns.some(pattern => pattern.test(key));
      masked[key] = isSensitive ? '***REDACTED***' : value;
    }

    return masked;
  }

  /**
   * Mask sensitive environment variable values
   */
  private maskSensitiveEnv(env: Record<string, string>): Record<string, string> {
    const sensitivePatterns = [
      /token/i,
      /key/i,
      /secret/i,
      /password/i,
      /auth/i,
      /credential/i,
      /api[_-]?key/i
    ];

    const masked: Record<string, string> = {};

    for (const [key, value] of Object.entries(env)) {
      const isSensitive = sensitivePatterns.some(pattern => pattern.test(key));
      masked[key] = isSensitive ? '***REDACTED***' : value;
    }

    return masked;
  }
}
