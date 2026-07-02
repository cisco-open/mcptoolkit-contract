// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * compare command - Human-oriented comparison: diff + breaking + changelog in one step
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Differ } from '../lib/differ.js';
import { RulesEngine } from '../lib/rules-engine.js';
import { Renderer } from '../lib/renderer.js';
import { parseAsContractDump, isMcpDescDocument } from '../lib/mcpdesc-converter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Group an array of changes by their capability name for sub-headings.
 */
function groupByCapabilityName(changes: any[]): Array<{ name: string; changes: any[] }> {
  if (!changes || changes.length === 0) return [];
  const map = new Map<string, any[]>();
  for (const change of changes) {
    const name = change.details?.capabilityName || 'unknown';
    if (!map.has(name)) map.set(name, []);
    map.get(name)!.push(change);
  }
  return Array.from(map.entries()).map(([name, items]) => ({ name, changes: items }));
}

export const compareCommand = new Command('compare')
  .description('Human-readable comparison report: diff + breaking analysis + changelog in one step')
  .requiredOption('--from <file>', 'Source version (MCP description, JSON/YAML)')
  .requiredOption('--to <file>', 'Target version (MCP description, JSON/YAML)')
  .option('--output <file>', 'Write the changelog to a file instead of stdout')
  .option('--rules <file>', 'Custom compatibility rules YAML file (default: built-in breaking-changes.yaml)')
  .option('--format <type>', 'Changelog format: release (default), compact', 'release')
  .option('--suggest-version', 'Include the semver bump recommendation in the report', false)
  .option('--exit-zero', 'Always exit 0 on success (suppress the exit-1 gate on breaking changes)', false)
  .option('--quiet', 'Suppress the stderr report', false)
  .option('--emit-diff <file>', 'Also persist the raw structural diff JSON')
  .option('--emit-breaking <file>', 'Also persist the annotated (breaking) diff JSON')
  .configureHelp({
    formatHelp: (cmd, helper) => {
      return `Usage: ${helper.commandUsage(cmd)}

${helper.commandDescription(cmd)}

Equivalent to the staged pipeline (diff → breaking → changelog) collapsed into one
command. Changelog goes to stdout (or --output). Verbose report goes to stderr.
Exit codes follow the 'breaking' contract: 0 compatible, 1 breaking, 2 error.
Use --exit-zero in interactive shells or non-gating CI steps.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INPUT FILES (Required):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  --from <file>                 Source version (MCP description, JSON/YAML)
  --to <file>                   Target version (MCP description, JSON/YAML)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT OPTIONS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  --output <file>               Write changelog to a file (default: stdout)
  --format <type>               Changelog format (default: "release")
                                • release  - Full release notes
                                • compact  - Brief summary
  --emit-diff <file>            Also write the raw structural diff JSON
  --emit-breaking <file>        Also write the annotated diff JSON

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULES OPTIONS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  --rules <file>                Custom compatibility rules YAML file
                                (default: built-in breaking-changes.yaml)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BEHAVIOUR OPTIONS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  --suggest-version             Include the semver bump recommendation
  --exit-zero                   Always exit 0 on success (never gate on
                                breaking changes). Does not suppress exit 2.
  --quiet                       Suppress the stderr report
  -h, --help                    Display help for command

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXIT CODES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  0   Success, no breaking changes (or --exit-zero was set)
  1   Success, breaking changes detected (suppressed by --exit-zero)
  2   Error — never suppressed by --exit-zero

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXAMPLES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  # See changelog in terminal; gates on breaking changes (exit 1 if breaking)
  $ mcpcontract compare --from prev.json --to next.json

  # Write changelog to file; still gates on breaking (use in simple CI)
  $ mcpcontract compare --from prev.json --to next.json --output CHANGELOG.md

  # Human / interactive use — never exits non-zero on breaking
  $ mcpcontract compare --from prev.json --to next.json --exit-zero

  # With version recommendation
  $ mcpcontract compare --from prev.json --to next.json --suggest-version

  # Also save intermediate artifacts for auditing
  $ mcpcontract compare --from prev.json --to next.json \\
      --output CHANGELOG.md \\
      --emit-diff diff.json \\
      --emit-breaking diff-breaking.json

  # Use custom compatibility rules
  $ mcpcontract compare --from prev.json --to next.json \\
      --rules my-rules.yaml \\
      --output CHANGELOG.md
`;
    }
  })
  .action(async (options) => {
    const {
      from: fromFile,
      to: toFile,
      output,
      rules: customRules,
      format,
      suggestVersion,
      exitZero,
      quiet,
      emitDiff,
      emitBreaking,
    } = options;

    // ── Validate format early ─────────────────────────────────────────────
    const validFormats = ['release', 'compact'];
    if (!validFormats.includes(format)) {
      console.error(`❌ Error: Invalid format '${format}'. Must be: release or compact`);
      process.exit(2);
    }

    // ── Step 1: Load and parse input files ────────────────────────────────
    if (!quiet) {
      console.error(`🔍 Comparing ${fromFile} → ${toFile}...`);
    }

    if (!fs.existsSync(fromFile)) {
      console.error(`❌ Error: Source file not found: ${fromFile}`);
      process.exit(2);
    }
    if (!fs.existsSync(toFile)) {
      console.error(`❌ Error: Target file not found: ${toFile}`);
      process.exit(2);
    }

    const fromContent = fs.readFileSync(fromFile, 'utf-8');
    const toContent = fs.readFileSync(toFile, 'utf-8');

    let fromData: any;
    let toData: any;

    try {
      fromData = fromFile.endsWith('.yaml') || fromFile.endsWith('.yml')
        ? yaml.parse(fromContent)
        : JSON.parse(fromContent);
    } catch (error) {
      console.error(`❌ Error parsing source file: ${(error as Error).message}`);
      process.exit(2);
    }

    try {
      toData = toFile.endsWith('.yaml') || toFile.endsWith('.yml')
        ? yaml.parse(toContent)
        : JSON.parse(toContent);
    } catch (error) {
      console.error(`❌ Error parsing target file: ${(error as Error).message}`);
      process.exit(2);
    }

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

    // ── Step 2: Structural diff ───────────────────────────────────────────
    const differ = new Differ({ detectRenames: false });
    let diffResult: any;
    try {
      diffResult = await differ.compare(fromData, toData, fromFile, toFile);
    } catch (error) {
      console.error(`❌ ${(error as Error).message}`);
      process.exit(2);
    }

    if (emitDiff) {
      try {
        fs.writeFileSync(emitDiff, JSON.stringify(diffResult, null, 2), 'utf-8');
        if (!quiet) console.error(`   Diff written to ${emitDiff}`);
      } catch (error) {
        console.error(`❌ Error writing diff to ${emitDiff}: ${(error as Error).message}`);
        process.exit(2);
      }
    }

    // ── Step 3: Breaking-change analysis ─────────────────────────────────
    let rulesPath: string;
    if (customRules) {
      rulesPath = customRules;
      if (!fs.existsSync(rulesPath)) {
        console.error(`❌ Error: Rules file not found: ${rulesPath}`);
        process.exit(2);
      }
      if (!quiet) console.error(`📋 Using custom rules: ${rulesPath}`);
    } else {
      const moduleDir = path.dirname(new URL(import.meta.url).pathname);
      rulesPath = path.join(moduleDir, '../../rules/breaking-changes.yaml');
      if (!fs.existsSync(rulesPath)) {
        console.error(`❌ Error: Default rules file not found at ${rulesPath}`);
        process.exit(2);
      }
    }

    const engine = new RulesEngine(rulesPath);
    const analysis = engine.analyze(diffResult, fromFile, rulesPath);

    if (emitBreaking) {
      try {
        fs.writeFileSync(emitBreaking, JSON.stringify(analysis, null, 2), 'utf-8');
        if (!quiet) console.error(`   Breaking analysis written to ${emitBreaking}`);
      } catch (error) {
        console.error(`❌ Error writing breaking analysis to ${emitBreaking}: ${(error as Error).message}`);
        process.exit(2);
      }
    }

    // ── Step 4: Changelog rendering ───────────────────────────────────────
    // Preprocess analysis data for templates (mirrors changelog.ts logic)
    const analysisData: any = { ...analysis };

    analysisData.options = {
      omitZeros: false,
      showDiffReasoning: false,
      sort: 'original',
    };

    const capabilityOrder = ['tools', 'prompts', 'resources', 'resourceTemplates', 'serverInfo'];
    const grouped: Record<string, Record<string, any[]>> = {};
    for (const cap of capabilityOrder) {
      grouped[cap] = { breaking: [], new: [], updates: [], deleted: [] };
    }

    if (Array.isArray(analysisData.changes)) {
      for (const change of analysisData.changes) {
        const cap = change.category || 'serverInfo';
        const changeCat = change.changeCategory || 'update';
        const groupKey = changeCat === 'update' ? 'updates' : changeCat === 'new' ? 'new' : changeCat;
        if (grouped[cap] && grouped[cap][groupKey]) {
          grouped[cap][groupKey].push(change);
        }
      }
    }

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
          allByCapability: groupByCapabilityName([
            ...capChanges.breaking,
            ...capChanges.new,
            ...capChanges.updates,
            ...capChanges.deleted,
          ]),
          updatesByCapability: groupByCapabilityName(capChanges.updates),
          breakingByCapability: groupByCapabilityName(capChanges.breaking),
          newByCapability: groupByCapabilityName(capChanges.new),
          deletedByCapability: groupByCapabilityName(capChanges.deleted),
        };
      })
      .filter(g => g.totalCount > 0);

    const templatesDir = path.join(__dirname, '../../templates');
    const templatePath = path.join(templatesDir, `changelog-${format}.md.hbs`);
    if (!fs.existsSync(templatePath)) {
      console.error(`❌ Error: Built-in template not found: ${templatePath}`);
      process.exit(2);
    }

    const renderer = new Renderer();
    let changelog: string;
    try {
      changelog = await renderer.render({ template: templatePath, data: analysisData });
    } catch (error) {
      console.error(`❌ Error rendering changelog: ${(error as Error).message}`);
      process.exit(2);
    }

    // ── Step 5: Write changelog ────────────────────────────────────────────
    if (output) {
      try {
        fs.writeFileSync(output, changelog, 'utf-8');
      } catch (error) {
        console.error(`❌ Error writing changelog to ${output}: ${(error as Error).message}`);
        process.exit(2);
      }
    } else {
      process.stdout.write(changelog);
    }

    // ── Step 6: Print stderr report ───────────────────────────────────────
    if (!quiet) {
      const isBreaking = analysis.summary.exitCode === 1;
      const verdict = isBreaking ? '⚠️  Breaking changes detected' : '✅ Backward compatible';

      console.error('');
      console.error(`${verdict}`);

      if (suggestVersion) {
        const bump = analysis.versioningSuggestion?.recommendedBump?.toUpperCase();
        const reason = analysis.versioningSuggestion?.reason;
        const old = analysis.metadata?.old?.version;
        const suggested = analysis.versioningSuggestion?.suggestedVersion;
        console.error(`🔢 Recommended bump: ${bump}${reason ? ` — ${reason}` : ''}`);
        if (old && suggested) {
          console.error(`   Version: ${old} → ${suggested}`);
        }
      }

      console.error('');
      console.error(`📊 Summary:`);
      console.error(`   ⚠️  Breaking: ${analysis.categorization.breaking.length}`);
      console.error(`   ✨ New:      ${analysis.categorization.new.length}`);
      console.error(`   🔄 Updates: ${analysis.categorization.updates.length}`);
      console.error(`   🗑️  Deleted: ${analysis.categorization.deleted.length}`);

      if (output) {
        console.error(`📝 Changelog written to ${output}`);
      } else {
        console.error(`📝 Changelog written to stdout`);
      }
    }

    // ── Step 7: Exit code ─────────────────────────────────────────────────
    const exitCode = analysis.summary.exitCode as number; // 0 or 1 from RulesEngine
    if (exitCode === 1 && exitZero) {
      process.exit(0);
    }
    process.exit(exitCode);
  });
