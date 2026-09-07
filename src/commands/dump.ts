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
  MCPProtocolError,
  type CLIOptions
} from '../lib/types.js';
import { contractDumpToMcpDescription, applyEnrichment, type EnrichmentInfo } from '../lib/mcpdesc-converter.js';
import { parse as yamlParse } from 'yaml';
import { validateMcpDescription } from '@mcpdesc/validator';

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
  if (error instanceof ConfigurationError) {
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

function parseProtocol(value: string): CLIOptions['protocol'] {
  if (value === 'legacy' || value === 'auto' || value === '2026-07-28') {
    return value;
  }
  throw new ConfigurationError(
    `Invalid protocol mode: ${value}. Expected legacy, auto, or 2026-07-28`
  );
}

function logImplicitAuthDefault(options: CLIOptions): void {
  if (options.quiet || options.authSpecified) {
    return;
  }

  if ((options.transport === 'streamable-http' || options.transport === 'http' || options.transport === 'sse') && options.auth === 'none') {
    log('Authentication mode not specified; defaulting to no authentication.', options);
    log('Use --auth auto to probe for OAuth, or --auth oauth to require OAuth.', options);
    log('', options);
  }
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
    logImplicitAuthDefault(options);
    
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
  const mcpdesc = contractDumpToMcpDescription(dump, {
    onUnsupportedServerCapabilities: (capabilities) => {
      console.error(
        `[WARN] Server capabilities not representable in MCP Description were omitted: ${capabilities.join(', ')}. ` +
        'Use experimental or extensions when the capability belongs to one of those MCP mechanisms.'
      );
    },
  });

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

  const validation = validateMcpDescription(mcpdesc, {
    specification: '0.8.0-rc.2',
  });
  if (!validation.valid) {
    const diagnostics = validation.diagnostics
      .map((diagnostic) => `${diagnostic.path.join('/') || '/'}: ${diagnostic.message}`)
      .join('\n');
    throw new MCPProtocolError(
      `Captured server description is not valid MCP Description 0.8.0 RC.2:\n${diagnostics}`,
      'INVALID_MCP_DESCRIPTION'
    );
  }
  for (const diagnostic of validation.diagnostics) {
    if (diagnostic.severity === 'warning') {
      console.error(
        `[WARN] [${diagnostic.code}] at ${diagnostic.path.join('/') || '/'}: ${diagnostic.message}`
      );
    }
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
    .option('--protocol <mode>', 'Protocol mode: legacy, auto, or 2026-07-28', parseProtocol, 'auto')
    .option('--auth <mode>', 'Authentication mode for HTTP/SSE: none, auto, or oauth (omitted => none)', 'none')
    .option('--oauth-scope <scope>', 'Additional OAuth scope (repeatable)', collectScopes, [])
    .option('--oauth-resource <uri>', 'Override OAuth resource value discovered from server')
    .option('--oauth-callback-port <port>', 'Local port to bind the OAuth callback listener (default: 6274)', parseNumber)
    .option('--oauth-callback-url <url>', 'Override the full OAuth redirect URI, e.g. https://tunnel.example.com/oauth/callback (non-loopback must use HTTPS)')
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

QUICK START
  $ mcpcontract dump
  $ mcpcontract dump --config mcp.json -o dump.json
  $ mcpcontract dump --transport streamable-http --url https://api.example.com/mcp
  $ mcpcontract dump --transport stdio --command npx --args -y @modelcontextprotocol/server-everything

CONNECTION
  -w, --wizard                  Launch the interactive setup (also used when no connection is given)
  -c, --config <path>           Path to MCP server config file (JSON/YAML)
  -s, --mcp-server <name>       Select a server when the config defines multiple servers
  -n, --server-name <name>      Override the inferred server name
  -t, --transport <type>        streamable-http (or http), sse, or stdio
  -u, --url <url>               Server URL for streamable-http or SSE
  -H, --header <header>         HTTP header, repeatable ("Key: Value")
  --command <command>           Command to execute for stdio
  --args <args...>              Command arguments for stdio
  --env <env>                   Environment variables for stdio ("KEY=VALUE,KEY2=VALUE2")

OUTPUT
  -o, --output <path>           Output file path (default: stdout)
  -f, --format <format>         Output format: json, yaml, or markdown (default: "json")
  --compact                     Emit compact JSON
  -i, --info <path>             Enrich output from a JSON/YAML metadata file
  -q, --quiet                   Suppress progress messages
  -v, --verbose                 Show detailed diagnostics

PROTOCOL AND AUTHENTICATION
  --protocol <mode>             legacy, auto, or 2026-07-28 (default: "auto")
  --auth <mode>                 none, auto, or oauth (default: "none")
  --oauth-scope <scope>         Request additional OAuth scope (repeatable)
  --oauth-resource <uri>        Override discovered OAuth resource parameter
  --oauth-callback-port <port>  Local OAuth callback port (default: 6274)
  --oauth-callback-url <url>    Override the full OAuth redirect URI
  --oauth-client-id <id>        Use a pre-registered OAuth client ID
  --oauth-client-secret <secret> Use a confidential OAuth client secret

DIAGNOSTICS
  --skip-cors-check             Skip browser CORS support detection
  --cors-origin <origin>        Origin used for CORS testing (default: "http://localhost:3000")
  --page-size <number>          Page-size hint for pagination testing
  -h, --help                    Display help for command

For advanced workflows and behavior details:
  mcpcontract agents --command dump
`;
      }
    })
    .action(async (options: CLIOptions, command: Command) => {
      try {
        options.authSpecified = command.getOptionValueSource('auth') === 'cli';

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
        process.exit(0);
      } catch (error) {
        handleError(error);
        process.exit(1);
      }
    });
  
  return cmd;
}
