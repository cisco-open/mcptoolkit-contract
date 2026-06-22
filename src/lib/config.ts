// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Configuration parser with environment variable interpolation
 */

import { readFile } from 'node:fs/promises';
import { ServerConfig, TransportConfig, ConfigurationError, CLIOptions } from './types.js';

/**
 * Example config file content to show users
 */
const EXAMPLE_CONFIG = `{
  "mcpServers": {
    "my-http-server": {
      "type": "streamable-http",
      "url": "https://api.example.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    },
    "my-sse-server": {
      "type": "sse",
      "url": "http://localhost:3000/sse"
    },
    "my-stdio-server": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-everything"],
      "env": {
        "API_KEY": "secret"
      }
    }
  }
}`;

/**
 * Interpolates environment variables in a string
 * Supports ${VAR_NAME} and $VAR_NAME formats
 */
export function interpolateEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}|\$([A-Z_][A-Z0-9_]*)/g, (_match, braced, unbraced) => {
    const varName = braced || unbraced;
    const envValue = process.env[varName];
    
    if (envValue === undefined) {
      throw new ConfigurationError(
        `Environment variable ${varName} is not defined`
      );
    }
    
    return envValue;
  });
}

/**
 * Recursively interpolates environment variables in an object
 */
export function interpolateEnvVarsInObject<T>(obj: T): T {
  if (typeof obj === 'string') {
    return interpolateEnvVars(obj) as T;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => interpolateEnvVarsInObject(item)) as T;
  }
  
  if (obj !== null && typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = interpolateEnvVarsInObject(value);
    }
    return result as T;
  }
  
  return obj;
}

/**
 * Loads and parses configuration from a JSON file
 */
export async function loadConfigFromFile(filePath: string, serverName?: string): Promise<ServerConfig> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    
    // Support both direct config and mcpServers format
    let config: any;
    if (parsed.mcpServers) {
      const serverNames = Object.keys(parsed.mcpServers);
      if (serverNames.length === 0) {
        throw new ConfigurationError('No servers defined in mcpServers');
      }
      
      // Check if multiple servers and no selection
      if (serverNames.length > 1 && !serverName) {
        const exampleServer = serverNames[0];
        throw new ConfigurationError(
          `Multiple MCP servers found in configuration file.\n\n` +
          `Available servers:\n${serverNames.map(name => `  - ${name}`).join('\n')}\n\n` +
          `Please specify which server to use with the --mcp-server option.\n\n` +
          `Example:\n  mcpcontract dump --config ${filePath} --mcp-server ${exampleServer}`
        );
      }
      
      // Use provided server name or first server
      const selectedServerName = serverName || serverNames[0];
      
      // Validate selected server exists
      if (!parsed.mcpServers[selectedServerName]) {
        throw new ConfigurationError(
          `Server "${selectedServerName}" not found in configuration file.\n\n` +
          `Available servers:\n${serverNames.map(name => `  - ${name}`).join('\n')}`
        );
      }
      
      const serverDef = parsed.mcpServers[selectedServerName];
      
      config = {
        name: selectedServerName,
        transport: parseTransportConfig(serverDef)
      };
    } else {
      // Direct config format
      config = parsed;
    }
    
    // Interpolate environment variables
    config = interpolateEnvVarsInObject(config);
    
    return validateServerConfig(config);
  } catch (error) {
    if (error instanceof ConfigurationError) {
      throw error;
    }
    throw new ConfigurationError(
      `Failed to load config from ${filePath}: ${(error as Error).message}`
    );
  }
}

/**
 * Parses transport configuration from various formats
 */
function parseTransportConfig(serverDef: any): TransportConfig {
  // Determine transport type
  let transportType: string;
  if (serverDef.type) {
    transportType = serverDef.type;
  } else if (serverDef.transport) {
    transportType = serverDef.transport;
  } else if (serverDef.url) {
    transportType = 'streamable-http';
  } else if (serverDef.command) {
    transportType = 'stdio';
  } else {
    throw new ConfigurationError(
      `Cannot determine transport type from config.\n\n` +
      `Expected config file format (JSON):\n${EXAMPLE_CONFIG}`
    );
  }
  
  if (transportType === 'streamable-http' || transportType === 'http') {
    if (!serverDef.url) {
      throw new ConfigurationError('HTTP transport requires url property');
    }
    return {
      type: 'streamable-http',
      url: serverDef.url,
      headers: serverDef.headers
    };
  } else if (transportType === 'sse') {
    if (!serverDef.url) {
      throw new ConfigurationError('SSE transport requires url property');
    }
    return {
      type: 'sse',
      url: serverDef.url,
      headers: serverDef.headers
    };
  } else if (transportType === 'stdio') {
    if (!serverDef.command) {
      throw new ConfigurationError('stdio transport requires command property');
    }
    return {
      type: 'stdio',
      command: serverDef.command,
      args: serverDef.args,
      env: serverDef.env
    };
  } else {
    throw new ConfigurationError(
      `Unsupported transport type: ${transportType}. Supported types: stdio, streamable-http, sse`
    );
  }
}

/**
 * Creates server config from CLI options
 */
export function createConfigFromCLI(options: CLIOptions): ServerConfig {
  if (!options.transport) {
    throw new ConfigurationError('Transport type is required');
  }
  
  let transport: TransportConfig;
  let serverName: string;
  
  if (options.transport === 'streamable-http' || options.transport === 'http') {
    if (!options.url) {
      throw new ConfigurationError('URL is required for HTTP transport');
    }
    
    // Parse headers if provided (curl-style array)
    let headers: Record<string, string> | undefined;
    if (options.header && Array.isArray(options.header) && options.header.length > 0) {
      headers = {};
      for (const h of options.header) {
        const colonIndex = h.indexOf(':');
        if (colonIndex <= 0) {
          throw new ConfigurationError(
            `Invalid header format: "${h}". Expected "Key: Value" (curl-style)`
          );
        }
        const key = h.substring(0, colonIndex).trim();
        const value = h.substring(colonIndex + 1).trim();
        if (!key || !value) {
          throw new ConfigurationError(`Invalid header format: "${h}"`);
        }
        headers[key] = value;
      }
    }
    
    transport = {
      type: 'streamable-http',
      url: interpolateEnvVars(options.url),
      headers: headers ? interpolateEnvVarsInObject(headers) : undefined
    };
    
    // Auto-generate name from URL if not provided
    serverName = options.serverName || new URL(options.url).hostname;
  } else if (options.transport === 'sse') {
    if (!options.url) {
      throw new ConfigurationError('URL is required for SSE transport');
    }
    
    // Parse headers if provided (curl-style array)
    let headers: Record<string, string> | undefined;
    if (options.header && Array.isArray(options.header) && options.header.length > 0) {
      headers = {};
      for (const h of options.header) {
        const colonIndex = h.indexOf(':');
        if (colonIndex <= 0) {
          throw new ConfigurationError(
            `Invalid header format: "${h}". Expected "Key: Value" (curl-style)`
          );
        }
        const key = h.substring(0, colonIndex).trim();
        const value = h.substring(colonIndex + 1).trim();
        if (!key || !value) {
          throw new ConfigurationError(`Invalid header format: "${h}"`);
        }
        headers[key] = value;
      }
    }
    
    transport = {
      type: 'sse',
      url: interpolateEnvVars(options.url),
      headers: headers ? interpolateEnvVarsInObject(headers) : undefined
    };
    
    // Auto-generate name from URL if not provided
    serverName = options.serverName || new URL(options.url).hostname;
  } else if (options.transport === 'stdio') {
    if (!options.command) {
      throw new ConfigurationError('Command is required for stdio transport');
    }
    
    // Parse env if it's a string
    let env: Record<string, string> | undefined;
    if (options.env) {
      if (typeof options.env === 'string') {
        const envPairs = options.env.split(',');
        env = {};
        for (const pair of envPairs) {
          const [key, value] = pair.split('=');
          if (key && value) {
            env[key.trim()] = value.trim();
          }
        }
      } else {
        env = options.env;
      }
    }
    
    // Process args - support both space-separated and comma-separated formats
    // e.g., ["--args", "-m", "weather"] or ["--args", "-m,weather"]
    let processedArgs: string[] | undefined;
    if (options.args && options.args.length > 0) {
      processedArgs = [];
      for (const arg of options.args) {
        // If an argument contains a comma, split it
        if (arg.includes(',')) {
          processedArgs.push(...arg.split(','));
        } else {
          processedArgs.push(arg);
        }
      }
    }
    
    transport = {
      type: 'stdio',
      command: interpolateEnvVars(options.command),
      args: processedArgs ? interpolateEnvVarsInObject(processedArgs) : undefined,
      env: env ? interpolateEnvVarsInObject(env) : undefined
    };
    
    // Auto-generate name from command if not provided
    serverName = options.serverName || options.command;
  } else {
    throw new ConfigurationError(`Unsupported transport type: ${options.transport}`);
  }
  
  return {
    name: serverName,
    transport
  };
}

/**
 * Validates server configuration structure
 */
function validateServerConfig(config: any): ServerConfig {
  if (!config.name || typeof config.name !== 'string') {
    throw new ConfigurationError(
      `Server name must be a non-empty string.\n\n` +
      `Expected config file format (JSON):\n${EXAMPLE_CONFIG}`
    );
  }
  
  if (!config.transport || typeof config.transport !== 'object') {
    throw new ConfigurationError(
      `Transport configuration is required.\n\n` +
      `Expected config file format (JSON):\n${EXAMPLE_CONFIG}`
    );
  }
  
  const transport = config.transport;
  
  if (transport.type === 'streamable-http') {
    if (!transport.url || typeof transport.url !== 'string') {
      throw new ConfigurationError(
        `HTTP transport requires a valid url.\n\n` +
        `Expected config file format (JSON):\n${EXAMPLE_CONFIG}`
      );
    }
    if (transport.headers && typeof transport.headers !== 'object') {
      throw new ConfigurationError(
        `HTTP headers must be an object.\n\n` +
        `Expected config file format (JSON):\n${EXAMPLE_CONFIG}`
      );
    }
  } else if (transport.type === 'sse') {
    if (!transport.url || typeof transport.url !== 'string') {
      throw new ConfigurationError(
        `SSE transport requires a valid url.\n\n` +
        `Expected config file format (JSON):\n${EXAMPLE_CONFIG}`
      );
    }
    if (transport.headers && typeof transport.headers !== 'object') {
      throw new ConfigurationError(
        `SSE headers must be an object.\n\n` +
        `Expected config file format (JSON):\n${EXAMPLE_CONFIG}`
      );
    }
  } else if (transport.type === 'stdio') {
    if (!transport.command || typeof transport.command !== 'string') {
      throw new ConfigurationError(
        `stdio transport requires a valid command.\n\n` +
        `Expected config file format (JSON):\n${EXAMPLE_CONFIG}`
      );
    }
    if (transport.args && !Array.isArray(transport.args)) {
      throw new ConfigurationError(
        `stdio args must be an array.\n\n` +
        `Expected config file format (JSON):\n${EXAMPLE_CONFIG}`
      );
    }
    if (transport.env && typeof transport.env !== 'object') {
      throw new ConfigurationError(
        `stdio env must be an object.\n\n` +
        `Expected config file format (JSON):\n${EXAMPLE_CONFIG}`
      );
    }
  } else {
    throw new ConfigurationError(
      `Unknown transport type: ${transport.type}.\n\n` +
      `Expected config file format (JSON):\n${EXAMPLE_CONFIG}`
    );
  }
  
  return config as ServerConfig;
}

/**
 * Parse headers from command line string format
 * Supports: "Key1:Value1,Key2:Value2" or "Key1=Value1,Key2=Value2"
 */
export function parseHeaderString(headerString: string): Record<string, string> {
  const headers: Record<string, string> = {};
  
  const pairs = headerString.split(',').map(s => s.trim());
  for (const pair of pairs) {
    const separatorIndex = pair.search(/[:=]/);
    if (separatorIndex === -1) {
      throw new ConfigurationError(
        `Invalid header format: "${pair}". Expected "Key:Value" or "Key=Value"`
      );
    }
    
    const key = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    
    if (!key || !value) {
      throw new ConfigurationError(`Invalid header format: "${pair}"`);
    }
    
    headers[key] = value;
  }
  
  return headers;
}
