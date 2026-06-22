// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Dump Command - Extract capabilities from a live MCP server
 */

import { Command } from 'commander';
import { writeFile, readFile } from 'node:fs/promises';
import {
  loadConfigFromFile,
  createConfigFromCLI
} from '../lib/config.js';
import { ContractDumper } from '../lib/dumper.js';
import { formatJSON, formatYAML, formatMarkdown } from '../lib/formatters.js';
import {
  ConfigurationError,
  UnsupportedProtocolVersionError,
  MCPProtocolError,
  type CLIOptions
} from '../lib/types.js';
import { contractDumpToMcpDescription, applyEnrichment, type EnrichmentInfo } from '../lib/mcpdesc-converter.js';
import { parse as yamlParse } from 'yaml';

// ANSI color codes
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

/**
 * Log helper - respects quiet flag
 */
function log(message: string, options: CLIOptions): void {
  if (!options.quiet) {
    console.error(`${GREEN}[LOG]${RESET} ${message}`);
  }
}

/**
 * Verbose log helper - only shows when verbose flag is set
 */
function verboseLog(message: string, options: CLIOptions): void {
  if (options.verbose && !options.quiet) {
    console.error(`${GREEN}[VERBOSE]${RESET} ${message}`);
  }
}

/**
 * Error handler
 */
function handleError(error: unknown): void {
  if (error instanceof UnsupportedProtocolVersionError) {
    console.error('\n❌ ERROR: Unsupported MCP Protocol Version');
    console.error(`   Received: ${error.receivedVersion}`);
    console.error(`   Expected: ${error.expectedVersion}`);
    console.error('\n   This tool only supports MCP protocol version 2025-06-18.');
    console.error('   The server is using a different protocol version.');
  } else if (error instanceof ConfigurationError) {
    console.error('\n❌ Configuration Error:');
    console.error(`   ${error.message}`);
  } else if (error instanceof MCPProtocolError) {
    console.error('\n❌ MCP Protocol Error:');
    console.error(`   ${error.message}`);
    if (error.code) {
      console.error(`   Code: ${error.code}`);
    }
    if (error.details) {
      console.error(`   Details: ${JSON.stringify(error.details, null, 2)}`);
    }
  } else if (error instanceof Error) {
    console.error('\n❌ Unexpected Error:');
    console.error(`   ${error.message}`);
    console.error(`\n   Stack: ${error.stack}`);
  } else {
    console.error('\n❌ Unknown Error:');
    console.error(`   ${String(error)}`);
  }
}

/** * Collector function for repeatable options
 */
function collectHeaders(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

function collectScopes(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

function parseNumber(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new ConfigurationError(`Expected a number value but received: ${value}`);
  }
  return parsed;
}

/** * Main dump execution
 */
async function runDump(options: CLIOptions): Promise<void> {
  // Show helpful message about --quiet flag when outputting to stdout
  if (!options.output && !options.quiet) {
    log('Tip: Use --quiet flag to suppress these messages when piping output', options);
    log('', options);
  }

  // Load configuration
  let config;
  
  if (options.config) {
    log(`Loading configuration from: ${options.config}`, options);
    if (options.mcpServer) {
      log(`Selecting server: ${options.mcpServer}`, options);
    }
    config = await loadConfigFromFile(options.config, options.mcpServer);
    verboseLog(`Loaded config: ${JSON.stringify(config, null, 2)}`, options);
  } else {
    log('Creating configuration from CLI options', options);
    verboseLog(`Transport type: ${options.transport}`, options);
    
    // Parse environment variables if provided
    if (options.env) {
      if (typeof options.env === 'string') {
        const envPairs = options.env.split(',');
        const envObj: Record<string, string> = {};
        for (const pair of envPairs) {
          const [key, value] = pair.split('=');
          if (key && value) {
            envObj[key.trim()] = value.trim();
          }
        }
        options.env = envObj;
      }
    }

    config = await createConfigFromCLI(options);
    
    // Verbose logging for stdio transport
    if (config.transport.type === 'stdio') {
      verboseLog(`Command: ${config.transport.command}`, options);
      verboseLog(`Args: ${JSON.stringify(config.transport.args || [])}`, options);
      if (config.transport.env) {
        verboseLog(`Env vars: ${Object.keys(config.transport.env).join(', ')}`, options);
      }
    }
    // Verbose logging for HTTP/SSE transport
    else if (config.transport.type === 'streamable-http' || config.transport.type === 'sse') {
      verboseLog(`URL: ${config.transport.url}`, options);
      if (config.transport.headers) {
        verboseLog(`Headers: ${Object.keys(config.transport.headers).join(', ')}`, options);
      }
    }
  }

  log('', options);
  verboseLog('Starting connection to MCP server...', options);

  // Perform the dump
  const dumper = new ContractDumper(config, options);
  const startTime = Date.now();
  const dump = await dumper.dump();
  const duration = Date.now() - startTime;

  log('✓ Server information retrieved', options);
  verboseLog(`Server: ${dump.serverInfo.name} v${dump.serverInfo.version}`, options);
  verboseLog(`Protocol: ${dump.serverInfo.protocolVersion}`, options);
  verboseLog(`Connection time: ${duration}ms`, options);
  
  // Show session header info in verbose mode
  if (dump.dumpDetails.dumpExecution.sessionIdSupported) {
    const headerName = dump.dumpDetails.dumpExecution.sessionIdHeader;
    verboseLog(`Session ID header: ${headerName || 'not detected'}`, options);
  }
  
  // Show CORS support info
  if (dump.dumpDetails.dumpExecution.corsSupport) {
    const cors = dump.dumpDetails.dumpExecution.corsSupport;
    if (cors.browserReady !== null) {
      const status = cors.browserReady ? '✓ Browser-ready (CORS enabled)' : '✗ Not browser-ready (CORS issues detected)';
      log(status, options);
      if (!cors.browserReady && options.verbose) {
        verboseLog('  CORS issues detected. Server may not be usable from browser-based MCP clients.', options);
      }
    }
  }
  
  log(`✓ Found ${dump.tools.length} tool(s)`, options);
  log(`✓ Found ${dump.resources.length} resource(s)`, options);
  log(`✓ Found ${dump.resourceTemplates.length} resource template(s)`, options);
  log(`✓ Found ${dump.prompts.length} prompt(s)`, options);
  
  if (dump.roots) {
    log(`✓ Found ${dump.roots.length} root(s)`, options);
  }

  // Convert to mcpdesc format
  const mcpdesc = contractDumpToMcpDescription(dump);

  // Apply enrichment from --info file if provided
  if (options.info) {
    log(`Applying enrichment from: ${options.info}`, options);
    const infoContent = await readFile(options.info as string, 'utf-8');
    let info: EnrichmentInfo;
    try {
      info = JSON.parse(infoContent);
    } catch {
      try {
        info = yamlParse(infoContent) as EnrichmentInfo;
      } catch (yamlError) {
        throw new ConfigurationError(`Failed to parse info file as JSON or YAML: ${(yamlError as Error).message}`);
      }
    }
    applyEnrichment(mcpdesc, info);
    log('✓ Enrichment applied', options);
  }

  // Format output
  let output: string;
  const format = options.format || 'json';
  
  switch (format.toLowerCase()) {
    case 'json':
      // Pretty-print by default unless --compact is specified
      const prettyPrint = !options.compact;
      output = formatJSON(mcpdesc, prettyPrint);
      break;
    case 'yaml':
    case 'yml':
      output = formatYAML(mcpdesc);
      break;
    case 'markdown':
    case 'md':
      output = formatMarkdown(dump);
      break;
    default:
      throw new ConfigurationError(`Unsupported format: ${format}`);
  }

  // Write output
  if (options.output) {
    await writeFile(options.output, output, 'utf-8');
    log('', options);
    log(`✓ Dump written to: ${options.output}`, options);
  } else {
    // Write to stdout (actual output, not stderr)
    console.log(output);
  }

  log('', options);
  log('✓ Dump completed successfully', options);
}

/**
 * Create dump command
 */
export function dumpCommand(): Command {
  const cmd = new Command('dump');
  
  cmd
    .description('Extract capabilities from a live MCP server')
    .addHelpText('before', '\n💡 Tip: Run "mcpcontract dump" (no args) or "mcpcontract dump --wizard" for interactive mode\n')
    .option('-w, --wizard', 'Launch interactive wizard mode')
    .option('-c, --config <path>', 'Path to MCP server config file (JSON/YAML)')
    .option('-s, --mcp-server <name>', 'Select specific server (only required when multiple servers defined)')
    .option('-n, --server-name <name>', 'Server name (required for command line)')
    .option('-t, --transport <type>', 'Transport type: "streamable-http" (or "http"), "sse", or "stdio" (required for command line)')
    .option('-u, --url <url>', 'Server URL (required for HTTP/SSE transport)')
    .option('-H, --header <header>', 'HTTP header (repeatable, curl-style: "Key: Value")', collectHeaders, [])
    .option('--command <command>', 'Command to execute (required for stdio transport)')
    .option('--args <args...>', 'Command arguments (optional)')
    .option('--env <env>', 'Environment variables (optional, format: "KEY=VALUE,KEY2=VALUE2")')
    .option('-o, --output <path>', 'Output file path (default: stdout)')
    .option('-f, --format <format>', 'Output format: json, yaml, or markdown', 'json')
    .option('--compact', 'Compact JSON output (single line)', false)
    .option('-q, --quiet', 'Suppress progress messages', false)
    .option('-v, --verbose', 'Show detailed debugging information', false)
    .option('--auth <mode>', 'Authentication mode: none (default), auto, or oauth', 'none')
    .option('--oauth-scope <scope>', 'Additional OAuth scope (repeatable)', collectScopes, [])
    .option('--oauth-resource <uri>', 'Override OAuth resource value discovered from server')
    .option('--oauth-callback-port <port>', 'Local port to bind the OAuth callback listener', parseNumber)
    .option('--oauth-client-id <id>', 'Pre-registered OAuth client ID (overrides default)')
    .option('--oauth-client-secret <secret>', 'Pre-registered OAuth client secret (for confidential clients)')
    .option('--skip-cors-check', 'Skip CORS support detection for HTTP/SSE transports', false)
    .option('--cors-origin <origin>', 'Origin header for CORS preflight testing (default: http://localhost:3000)', 'http://localhost:3000')
    .option('--page-size <number>', 'Request specific page size for pagination (hint to server, not guaranteed)', parseNumber)
    .option('-i, --info <path>', 'Enrichment info file (JSON/YAML) — adds contact, license, security, and other metadata')
    .configureHelp({
      formatHelp: (cmd, helper) => {
        return `Usage: ${helper.commandUsage(cmd)}

${helper.commandDescription(cmd)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INTERACTIVE MODE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -w, --wizard                  Launch interactive wizard mode (guided setup)

There are two methods to configure the MCP server connection:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
METHOD 1: CONFIG FILE (Recommended):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -c, --config <path>           Path to MCP server config file (JSON/YAML)
  -s, --mcp-server <name>       Select specific server (only required when
                                multiple servers are defined in config file)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
METHOD 2A: COMMAND LINE - HTTP Transport:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -n, --server-name <name>      Server name (optional, defaults to hostname from URL)
  -t, --transport <type>        Transport type: "streamable-http" (or "http") (required)
  -u, --url <url>               Server URL (required)
  -H, --header <header>         HTTP header (repeatable, format: "Key: Value")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
METHOD 2B: COMMAND LINE - SSE Transport:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -n, --server-name <name>      Server name (optional, defaults to hostname from URL)
  -t, --transport <type>        Transport type: "sse" (required)
  -u, --url <url>               Server SSE endpoint URL (required)
  -H, --header <header>         HTTP header (repeatable, format: "Key: Value")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
METHOD 2C: COMMAND LINE - STDIO Transport:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -n, --server-name <name>      Server name (optional, defaults to command name)
  -t, --transport <type>        Transport type: "stdio" (required)
  --command <command>           Command to execute (required)
  --args <args...>              Command arguments (optional)
  --env <env>                   Environment variables (optional, format: "KEY=VALUE,KEY2=VALUE2")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT OPTIONS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -o, --output <path>           Output file path (default: stdout)
  -f, --format <format>         Output format: json, yaml, or markdown (default: "json")
  --compact                     Compact JSON output (default: pretty-printed)
  -i, --info <path>             Enrichment info file (JSON/YAML) — adds contact,
                                license, security, and other metadata to output
  -q, --quiet                   Suppress progress messages (default: false)
  -v, --verbose                 Show detailed debugging information (default: false)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTHENTICATION OPTIONS (HTTP/SSE transports):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  --auth <mode>                 Authentication mode: "none" (default), "auto", or "oauth"
  --oauth-scope <scope>         Request additional OAuth scope (repeatable)
  --oauth-resource <uri>        Override discovered OAuth resource parameter
  --oauth-callback-port <port>  Bind OAuth callback server to a specific port (default: auto)
  --oauth-client-id <id>        Pre-registered OAuth client ID (overrides default)
  --oauth-client-secret <secret> Pre-registered OAuth client secret (for confidential clients)
  
  Note: OAuth authentication requires manual browser interaction. The CLI will display
  an authorization URL that you must copy and paste into your browser. Some OAuth
  providers (e.g., Figma) require pre-registration - register your application in
  their developer portal to obtain client credentials.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORS DETECTION OPTIONS (HTTP/SSE transports only):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  --skip-cors-check             Skip CORS support detection (default: false)
  --cors-origin <origin>        Origin header for CORS preflight testing
                                (default: "http://localhost:3000")

  Note: CORS detection checks if the server can be used from browser-based
  MCP clients (like MCP Inspector). It tests:
  - Session header exposure via Access-Control-Expose-Headers
  - Preflight OPTIONS request handling
  - CORS headers configuration
  Results are included in dump under dumpDetails.dumpExecution.corsSupport

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PAGINATION TESTING OPTIONS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  --page-size <number>          Request specific page size for pagination testing
                                (hint to server, not guaranteed)

  Note: Forces small page sizes to test pagination behavior. Useful for:
  - Testing pagination with servers that have few items
  - Discovering if server supports pagination
  - Validating exhaustive fetch logic during development
  - Server may ignore this hint (behavior depends on implementation)
  Results are included in dump under dumpDetails.dumpExecution.paginationSupport

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HELP:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -h, --help                    Display help for command

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXAMPLES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  # Method 1: Config file with single server
  $ mcpcontract dump --config ~/.config/mcp/servers.json

  # Method 1: Config file with multiple servers (must specify which one)
  $ mcpcontract dump --config servers.json --mcp-server my-api

  # Method 2a: Command line - HTTP transport (with explicit name)
  $ mcpcontract dump \\
      --server-name "My API Server" \\
      --transport streamable-http \\
      --url "https://api.example.com/mcp" \\
      -H "Authorization: Bearer TOKEN"

  # Method 2a: Command line - HTTP transport (name auto-generated from URL)
  $ mcpcontract dump \\
      --transport streamable-http \\
      --url "https://api.example.com/mcp" \\
      -H "Authorization: Bearer TOKEN" \\
      -H "X-API-Key: secret123"

  # Method 2b: Command line - SSE transport (Server-Sent Events)
  $ mcpcontract dump \\
      --transport sse \\
      --url "http://localhost:3000/sse"

  # Method 2c: Command line - STDIO transport (name auto-generated from command)
  $ mcpcontract dump \\
      --transport stdio \\
      --command "npx" \\
      --args "-y" "@modelcontextprotocol/server-everything"

  # Interactive wizard (no arguments or --wizard flag)
  $ mcpcontract dump
  $ mcpcontract dump --wizard
  # Both launch the interactive wizard to guide you through the process

  # Save to file with formatting
  $ mcpcontract dump --config config.json -o dump.yaml --format yaml
  
  # Pipe to other tools (use --quiet to suppress progress messages)
  $ mcpcontract dump --config config.json --quiet | jq '.tools | length'

  # Test pagination with small page size (forces pagination for testing)
  $ mcpcontract dump --config config.json --page-size 5 --verbose
`;
      }
    })
    .action(async (options: CLIOptions) => {
      try {
        // Check if wizard mode should be launched
        const hasAnyOption = options.config || options.transport || options.serverName || 
                            options.url || options.command;
        
        if (options.wizard || !hasAnyOption) {
          // Dynamically import wizard to avoid circular dependencies
          const { runWizardInteractive } = await import('./wizard.js');
          await runWizardInteractive();
          return;
        }
        
        await runDump(options);
      } catch (error) {
        handleError(error);
        process.exit(1);
      }
    });
  
  return cmd;
}
