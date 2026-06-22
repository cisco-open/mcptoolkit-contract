// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Wizard Command - Interactive dump creation
 */

import { Command } from 'commander';
import { input, select, confirm } from '@inquirer/prompts';
import { spawn } from 'node:child_process';

// ANSI color codes
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

interface WizardAnswers {
  transport: 'stdio' | 'http' | 'sse';
  serverName: string;
  format: 'json' | 'yaml';
  output: string;
  
  // Stdio-specific
  command?: string;
  args?: string;
  env?: string;
  
  // HTTP/SSE-specific
  url?: string;
  headers?: string;
}

/**
 * Main wizard execution (exported for use by dump command)
 */
export async function runWizardInteractive(): Promise<void> {
  console.log(`\n${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
  console.log(`${BOLD}${CYAN}  MCP Contract Dump Wizard${RESET}`);
  console.log(`${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n`);
  
  const answers: WizardAnswers = {} as WizardAnswers;
  
  // Step 1: Transport type
  answers.transport = await select({
    message: 'Select transport type:',
    choices: [
      { name: 'HTTP (streamable-http) - Recommended for HTTP-based servers', value: 'http' },
      { name: 'STDIO - For command-line servers (npx, python, etc.)', value: 'stdio' },
      { name: 'SSE (Server-Sent Events) - Deprecated, use HTTP instead', value: 'sse' }
    ],
    default: 'http'
  });
  
  console.log();
  
  // Step 2: Transport-specific configuration
  if (answers.transport === 'stdio') {
    answers.command = await input({
      message: 'Enter command to execute:',
      default: 'npx',
      validate: (value) => value.length > 0 || 'Command is required'
    });
    
    answers.args = await input({
      message: 'Enter command arguments (comma or space separated):',
      default: '-y @modelcontextprotocol/server-everything'
    });
    
    const hasEnv = await confirm({
      message: 'Add environment variables?',
      default: false
    });
    
    if (hasEnv) {
      answers.env = await input({
        message: 'Enter environment variables (KEY=VALUE,KEY2=VALUE2):',
        validate: (value) => {
          if (!value) return true;
          const pairs = value.split(',');
          for (const pair of pairs) {
            if (!pair.includes('=')) {
              return 'Format should be KEY=VALUE,KEY2=VALUE2';
            }
          }
          return true;
        }
      });
    }
  } else {
    // HTTP or SSE
    answers.url = await input({
      message: `Enter server URL:`,
      default: answers.transport === 'http' ? 'https://api.example.com/mcp' : 'http://localhost:3000/sse',
      validate: (value) => {
        try {
          new URL(value);
          return true;
        } catch {
          return 'Please enter a valid URL';
        }
      }
    });
    
    const hasHeaders = await confirm({
      message: 'Add HTTP headers (e.g., Authorization)?',
      default: false
    });
    
    if (hasHeaders) {
      const headers: string[] = [];
      let addMore = true;
      
      while (addMore) {
        const header = await input({
          message: 'Enter header (Key: Value):',
          validate: (value) => {
            if (!value) return true;
            return value.includes(':') || 'Format should be "Key: Value"';
          }
        });
        
        if (header) {
          headers.push(header);
        }
        
        addMore = await confirm({
          message: 'Add another header?',
          default: false
        });
      }
      
      if (headers.length > 0) {
        answers.headers = headers.join('|||'); // Use special separator
      }
    }
  }
  
  console.log();
  
  // Step 3: Server name
  answers.serverName = await input({
    message: 'Enter server name:',
    default: 'MCP Server'
  });
  
  // Step 4: Output format
  answers.format = await select({
    message: 'Select output format:',
    choices: [
      { name: 'JSON (default)', value: 'json' },
      { name: 'YAML', value: 'yaml' }
    ],
    default: 'json'
  });
  
  // Step 5: Output filename
  const defaultFilename = answers.format === 'yaml' ? 'dump.yaml' : 'dump.json';
  answers.output = await input({
    message: 'Enter output filename:',
    default: defaultFilename
  });
  
  // Build the command
  console.log();
  console.log(`${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n`);
  
  const cmdArgs = buildCommandArgs(answers);
  const commandLine = `mcpcontract dump ${cmdArgs.join(' ')}`;
  
  console.log(`${BOLD}Generated Command:${RESET}`);
  console.log(`${YELLOW}${commandLine}${RESET}\n`);
  
  const shouldRun = await confirm({
    message: 'Execute this command now?',
    default: true
  });
  
  if (shouldRun) {
    console.log();
    console.log(`${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n`);
    console.log(`${GREEN}Executing dump command...${RESET}\n`);
    
    // Execute the command
    await executeCommand(cmdArgs);
  } else {
    console.log(`\n${YELLOW}Command not executed. You can copy and run it manually.${RESET}\n`);
  }
}

/**
 * Build command arguments from wizard answers
 */
function buildCommandArgs(answers: WizardAnswers): string[] {
  const args: string[] = [
    '--server-name', `"${answers.serverName}"`,
    '--transport', answers.transport === 'http' ? 'streamable-http' : answers.transport,
    '--verbose'
  ];
  
  if (answers.transport === 'stdio') {
    args.push('--command', `"${answers.command}"`);
    
    if (answers.args) {
      // Split args properly - support both comma and space separation
      const argParts = answers.args.split(/[\s,]+/).filter(a => a.length > 0);
      if (argParts.length > 0) {
        args.push('--args');
        argParts.forEach(arg => args.push(`"${arg}"`));
      }
    }
    
    if (answers.env) {
      args.push('--env', `"${answers.env}"`);
    }
  } else {
    args.push('--url', `"${answers.url}"`);
    
    if (answers.headers) {
      const headerList = answers.headers.split('|||');
      headerList.forEach(header => {
        args.push('-H', `"${header}"`);
      });
    }
  }
  
  args.push('--format', answers.format);
  args.push('--output', `"${answers.output}"`);
  
  return args;
}

/**
 * Execute the dump command
 */
async function executeCommand(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    // Get the path to the mcpcontract binary
    const cliPath = process.argv[1]; // Path to current executable
    
    // Spawn the dump command
    const child = spawn(cliPath, ['dump', ...args], {
      stdio: 'inherit',
      shell: true
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command exited with code ${code}`));
      }
    });
    
    child.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Create wizard command
 */
export function wizardCommand(): Command {
  const cmd = new Command('wizard');
  
  cmd
    .description('Interactive wizard for creating contract dumps')
    .action(async () => {
      try {
        await runWizardInteractive();
      } catch (error) {
        if (error && typeof error === 'object' && 'message' in error) {
          console.error(`\n${BOLD}Error:${RESET} ${error.message}\n`);
        } else {
          console.error(`\n${BOLD}Error:${RESET} ${String(error)}\n`);
        }
        process.exit(1);
      }
    });
  
  return cmd;
}
