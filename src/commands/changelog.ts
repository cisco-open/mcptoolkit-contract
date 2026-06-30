// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * changelog command - Generate human-readable changelog from analysis JSON
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Renderer } from '../lib/renderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Group an array of changes by their capability name for sub-headings.
 * Returns an array of { name, changes } objects.
 */
function groupByCapabilityName(changes: any[]): Array<{ name: string; changes: any[] }> {
  if (!changes || changes.length === 0) return [];
  
  const map = new Map<string, any[]>();
  for (const change of changes) {
    const name = change.details?.capabilityName || 'unknown';
    if (!map.has(name)) {
      map.set(name, []);
    }
    map.get(name)!.push(change);
  }
  
  return Array.from(map.entries()).map(([name, items]) => ({ name, changes: items }));
}

export const changelogCommand = new Command('changelog')
  .description('Generate a human-readable changelog from a structural diff or annotated diff')
  .requiredOption('--diff <file>', 'Diff from \'diff\', or annotated diff from \'breaking\'')
  .requiredOption('--output <file>', 'Changelog output file')
  .option('--format <type>', 'Template format: release (default), compact', 'release')
  .option('--template <file>', 'Custom Handlebars template file')
  .option('--omit-zeros', 'Hide categories with 0 entries from summary', false)
  .option('--sort <order>', 'Sort order for changes: original (default), alphabetical', 'original')
  .option('--show-diff-reasoning', 'Show impact badges and rationale in detailed changes', false)
  .option('--quiet', 'Suppress informational messages', false)
  .configureHelp({
    formatHelp: (cmd, helper) => {
      return `Usage: ${helper.commandUsage(cmd)}

${helper.commandDescription(cmd)}

Creates a markdown changelog from a diff, with categorized changes. When the diff
has been annotated by 'breaking', breaking changes are highlighted.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INPUT FILE (Required):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  --diff <file>                 Diff from 'diff', or annotated diff from
                                'breaking' (e.g., diff-breaking.json). Run
                                'breaking' first to highlight breaking changes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT OPTIONS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  --output <file>               Changelog output file (required)
                                Recommended: CHANGELOG.md
  --format <type>               Template format (default: "release")
                                • release  - Full release notes with categorization
                                • compact  - Brief summary with change lists
  --template <file>             Custom Handlebars template file
                                (overrides --format)
  --omit-zeros                  Hide categories with 0 entries from summary
  --sort <order>                Sort order: original (default), alphabetical
  --show-diff-reasoning          Show impact badges and rationale in details
  --quiet                       Suppress informational messages (default: false)
  -h, --help                    Display help for command

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXAMPLES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  # Generate full release changelog
  $ mcpcontract changelog \\
      --diff diff-breaking.json \\
      --output CHANGELOG.md

  # Generate compact changelog
  $ mcpcontract changelog \\
      --diff diff-breaking.json \\
      --output CHANGELOG-compact.md \\
      --format compact

  # Use custom template
  $ mcpcontract changelog \\
      --diff diff-breaking.json \\
      --template my-template.hbs \\
      --output CHANGELOG.md
`;
    }
  })
  .action(async (options) => {
    try {
      const { diff: inputFile, output, format, template: customTemplate, omitZeros, sort, showDiffReasoning, quiet } = options;

      if (!quiet) {
        console.error(`📝 Generating changelog from ${inputFile}...`);
      }

      // Read input JSON
      if (!fs.existsSync(inputFile)) {
        console.error(`❌ Error: Input file not found: ${inputFile}`);
        process.exit(2);
      }

      const inputContent = fs.readFileSync(inputFile, 'utf-8');
      let inputData: any;

      try {
        inputData = JSON.parse(inputContent);
      } catch (error) {
        console.error(`❌ Error: Invalid JSON: ${(error as Error).message}`);
        process.exit(2);
      }

      // Use input data as-is (modern analysis format)
      const analysisData = inputData;

      // === Pre-processing: group, sort, and enrich for template ===

      // Pass CLI options to template
      analysisData.options = {
        omitZeros: omitZeros || false,
        showDiffReasoning: showDiffReasoning || false,
        sort: sort || 'original'
      };

      // Sort changes if requested
      if (sort === 'alphabetical' && Array.isArray(analysisData.changes)) {
        analysisData.changes.sort((a: any, b: any) => {
          // Primary sort: category order (tools, prompts, resources, resourceTemplates, serverInfo)
          const categoryOrder: Record<string, number> = { tools: 0, prompts: 1, resources: 2, resourceTemplates: 3, serverInfo: 4 };
          const catDiff = (categoryOrder[a.category] ?? 99) - (categoryOrder[b.category] ?? 99);
          if (catDiff !== 0) return catDiff;
          // Secondary sort: alphabetical by capabilityName
          const nameA = a.details?.capabilityName || a.path || '';
          const nameB = b.details?.capabilityName || b.path || '';
          return nameA.localeCompare(nameB);
        });
      }

      // Pre-compute grouped structure for template
      const capabilityOrder = ['tools', 'prompts', 'resources', 'resourceTemplates', 'serverInfo'];
      
      const grouped: Record<string, Record<string, any[]>> = {};
      for (const cap of capabilityOrder) {
        grouped[cap] = { breaking: [], new: [], updates: [], deleted: [] };
      }

      if (Array.isArray(analysisData.changes)) {
        for (const change of analysisData.changes) {
          const cap = change.category || 'serverInfo';
          const changeCat = change.changeCategory || 'update';
          // Map changeCategory values to grouped keys
          const groupKey = changeCat === 'update' ? 'updates' : changeCat === 'new' ? 'new' : changeCat;
          if (grouped[cap] && grouped[cap][groupKey]) {
            grouped[cap][groupKey].push(change);
          }
        }
      }

      // Build grouped array with metadata for template iteration
      analysisData.grouped = capabilityOrder
        .map(cap => {
          const capChanges = grouped[cap];
          const totalCount = Object.values(capChanges).reduce((sum: number, arr: any[]) => sum + arr.length, 0);
          return {
            category: cap,
            label: { tools: 'Tools', prompts: 'Prompts', resources: 'Resources', resourceTemplates: 'Resource Templates', serverInfo: 'Server Info' }[cap] || cap,
            totalCount,
            breaking: capChanges.breaking,
            new: capChanges.new,
            updates: capChanges.updates,
            deleted: capChanges.deleted,
            // Group all changes by capability name (for detailed section)
            allByCapability: groupByCapabilityName([
              ...capChanges.breaking,
              ...capChanges.new,
              ...capChanges.updates,
              ...capChanges.deleted
            ]),
            // Group by category then capability (for legacy templates)
            updatesByCapability: groupByCapabilityName(capChanges.updates),
            breakingByCapability: groupByCapabilityName(capChanges.breaking),
            newByCapability: groupByCapabilityName(capChanges.new),
            deletedByCapability: groupByCapabilityName(capChanges.deleted)
          };
        })
        .filter(g => g.totalCount > 0);

      // Validate format
      const validFormats = ['release', 'compact'];
      if (!customTemplate && !validFormats.includes(format)) {
        console.error(`❌ Error: Invalid format '${format}'. Must be: release or compact`);
        process.exit(2);
      }

      // Load template
      let templatePath: string;
      if (customTemplate) {
        if (!fs.existsSync(customTemplate)) {
          console.error(`❌ Error: Template file not found: ${customTemplate}`);
          process.exit(2);
        }
        templatePath = customTemplate;
      } else {
        // Use built-in template
        const templatesDir = path.join(__dirname, '../../templates');
        templatePath = path.join(templatesDir, `changelog-${format}.md.hbs`);
        
        if (!fs.existsSync(templatePath)) {
          console.error(`❌ Error: Built-in template not found: ${templatePath}`);
          process.exit(2);
        }
      }

      // Use Renderer to compile and render template with all helpers
      const renderer = new Renderer();
      const changelog = await renderer.render({
        template: templatePath,
        data: analysisData
      });

      // Write output
      fs.writeFileSync(output, changelog, 'utf-8');

      if (!quiet) {
        console.error(`✅ Changelog written to ${output}`);
        console.error(`   Format: ${format}`);
        console.error(`   Version: ${analysisData.metadata?.oldVersion || 'unknown'} → ${analysisData.metadata?.newVersion || 'unknown'}`);
        console.error(`   Status: ${analysisData.summary?.breakingChanges > 0 ? 'BREAKING CHANGES' : 'BACKWARD COMPATIBLE'}`);
        console.error(`   Total changes: ${analysisData.summary?.totalChanges || 0}`);
      }

      // changelog is a pure renderer: a successful render always exits 0.
      // Gating on breaking changes is the responsibility of the 'breaking'
      // command, whose exit code (0/1/2) is the CI contract.
      process.exit(0);
    } catch (error) {
      console.error(`❌ Unexpected error: ${(error as Error).message}`);
      if ((error as Error).stack) {
        console.error((error as Error).stack);
      }
      process.exit(2);
    }
  });
