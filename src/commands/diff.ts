// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * diff command - Generate structural diff between two MCP descriptions
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as yaml from 'yaml';
import { Differ } from '../lib/differ.js';
import { parseAsContractDump, isMcpDescDocument } from '../lib/mcpdesc-converter.js';

export const diffCommand = new Command('diff')
  .description('Generate a structural diff between two MCP descriptions')
  .requiredOption('--from <file>', 'Source version (MCP description, JSON/YAML)')
  .requiredOption('--to <file>', 'Target version (MCP description, JSON/YAML)')
  .option('--output <file>', 'Structural diff output file (default: stdout)')
  .option('--detect-renames', 'Use similarity scoring to detect renames (not yet implemented)', false)
  .option('--quiet', 'Suppress informational messages', false)
  .configureHelp({
    formatHelp: (cmd, helper) => {
      return `Usage: mcpcontract diff --from <file> --to <file> [options]

${helper.commandDescription(cmd)}

Options:
  --from <file>                 Source version (MCP description, JSON/YAML) [required]
  --to <file>                   Target version (MCP description, JSON/YAML) [required]
  --output <file>               Structural diff output file (default: stdout)
  --detect-renames              Use similarity scoring to detect renames (default: false)
  --quiet                       Suppress informational messages (default: false)
  -h, --help                    Display help for command

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXAMPLES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Example 1: To generate a changelog
  $ mcpcontract diff --from v1.json --to v2.json --output diff.json
  $ mcpcontract changelog --diff diff.json --output CHANGELOG.md

  Example 2: To generate a changelog with mention of breaking changes
  $ mcpcontract diff --from v1.json --to v2.json --output diff.json
  $ mcpcontract breaking --diff diff.json --output diff-breaking.json
  $ mcpcontract changelog --diff diff.json --breaking diff-breaking.json --output CHANGELOG.md
`;
    }
  })
  .action(async (options) => {
    try {
      const { from: fromFile, to: toFile, output, detectRenames, quiet } = options;

      if (!quiet) {
        console.error(`🔍 Comparing ${fromFile} → ${toFile}...`);
      }

      // Read and parse source file
      if (!fs.existsSync(fromFile)) {
        console.error(`❌ Error: Source file not found: ${fromFile}`);
        process.exit(2);
      }

      // Read and parse target file
      if (!fs.existsSync(toFile)) {
        console.error(`❌ Error: Target file not found: ${toFile}`);
        process.exit(2);
      }

      const fromContent = fs.readFileSync(fromFile, 'utf-8');
      const toContent = fs.readFileSync(toFile, 'utf-8');

      // Parse based on file extension
      let fromData: any;
      let toData: any;

      try {
        if (fromFile.endsWith('.yaml') || fromFile.endsWith('.yml')) {
          fromData = yaml.parse(fromContent);
        } else {
          fromData = JSON.parse(fromContent);
        }
      } catch (error) {
        console.error(`❌ Error parsing source file: ${(error as Error).message}`);
        process.exit(2);
      }

      try {
        if (toFile.endsWith('.yaml') || toFile.endsWith('.yml')) {
          toData = yaml.parse(toContent);
        } else {
          toData = JSON.parse(toContent);
        }
      } catch (error) {
        console.error(`❌ Error parsing target file: ${(error as Error).message}`);
        process.exit(2);
      }

      // Require MCP description (mcpdesc) format; convert to the internal model for processing
      for (const [label, data] of [['source', fromData], ['target', toData]] as const) {
        if (!isMcpDescDocument(data as Record<string, unknown>)) {
          console.error(
            `❌ Error: ${label} file is not an MCP description (mcpdesc) document.\n` +
            `   Legacy capability dumps are no longer supported. Convert first: mcpcontract convert <file>`
          );
          process.exit(2);
        }
      }
      fromData = parseAsContractDump(fromData);
      toData = parseAsContractDump(toData);

      // Create differ and compare
      const differ = new Differ({ detectRenames });
      
      let diffResult;
      try {
        diffResult = await differ.compare(fromData, toData, fromFile, toFile);
      } catch (error) {
        console.error(`❌ ${(error as Error).message}`);
        process.exit(2);
      }

      // Output result
      const diffJson = JSON.stringify(diffResult, null, 2);

      if (output) {
        fs.writeFileSync(output, diffJson, 'utf-8');
        if (!quiet) {
          console.error(`✅ Diff written to ${output}`);
          console.error(`   Changes: ${diffResult.changes.length}`);
          console.error(`   Tools: +${diffResult.statistics.tools.added} -${diffResult.statistics.tools.removed} ~${diffResult.statistics.tools.modified}`);
          console.error(`   Prompts: +${diffResult.statistics.prompts.added} -${diffResult.statistics.prompts.removed} ~${diffResult.statistics.prompts.modified}`);
          console.error(`   Resources: +${diffResult.statistics.resources.added} -${diffResult.statistics.resources.removed} ~${diffResult.statistics.resources.modified}`);
        }
      } else {
        // Output to stdout
        console.log(diffJson);
      }

      process.exit(0);
    } catch (error) {
      console.error(`❌ Unexpected error: ${(error as Error).message}`);
      if ((error as Error).stack) {
        console.error((error as Error).stack);
      }
      process.exit(2);
    }
  });
