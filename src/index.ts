#!/usr/bin/env node

// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from 'node:fs';
import { Command } from 'commander';
import { dumpCommand } from './commands/dump.js';
import { manifestCommand } from './commands/manifest.js';
import { validateCommand } from './commands/validate.js';
import { createDocumentCommand } from './commands/document.js';
import { diffCommand } from './commands/diff.js';
import { breakingCommand } from './commands/breaking.js';
import { changelogCommand } from './commands/changelog.js';
import { completionCommand } from './commands/completion.js';
import { rulesCommand } from './commands/rules.js';
import { agentsCommand } from './commands/agents.js';
import { splitCommand } from './commands/split.js';
import { convertCommand } from './commands/convert.js';

// Read version from package.json
const packageJsonPath = new URL('../package.json', import.meta.url).pathname;
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const version = packageJson.version;

const program = new Command();

program
  .name('mcpcontract')
  .usage('[command] [options]')
  .description('Comprehensive MCP server contract toolkit - dumps capabilities, generates changelogs and renders documentation')
  .version(version)
  .addHelpText('after', '\nFor AI coding assistants (Copilot, Claude, etc.): Use "mcpcontract agents" for optimized command reference');

// Add commands in logical workflow order
program.addCommand(dumpCommand());
program.addCommand(splitCommand());
program.addCommand(convertCommand());
program.addCommand(createDocumentCommand());
// Register 'render' as hidden alias for backward compatibility
const renderAlias = createDocumentCommand();
renderAlias.name('render');
program.addCommand(renderAlias, { hidden: true });
program.addCommand(diffCommand);
program.addCommand(changelogCommand);
program.addCommand(breakingCommand);
program.addCommand(rulesCommand());
program.addCommand(manifestCommand());
program.addCommand(validateCommand());
program.addCommand(completionCommand());
program.addCommand(agentsCommand());

// Check if dump should be the default command
// If first argument is an option (starts with -) and not a known command, inject 'dump'
// Exception: --help and --version should show main program help/version
const commands = ['dump', 'split', 'convert', 'manifest', 'validate', 'document', 'render', 'diff', 'breaking', 'changelog', 'completion', 'rules', 'agents'];
const firstArg = process.argv[2];
const hasCommand = firstArg && commands.includes(firstArg);
const hasOption = firstArg && firstArg.startsWith('-');
const isHelpOrVersion = firstArg === '--help' || firstArg === '-h' || firstArg === '--version' || firstArg === '-V';

if (!hasCommand && hasOption && !isHelpOrVersion) {
  // Inject 'dump' command
  process.argv.splice(2, 0, 'dump');
}

program.parse();
