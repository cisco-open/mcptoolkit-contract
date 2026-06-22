// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Rules Command
 * 
 * Browse and explore backward compatibility rules catalog.
 * Provides documentation, examples, and validation for rules.
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as YAML from 'yaml';
import { CatalogValidator, CatalogEntry } from '../lib/catalog-validator.js';
import { discoverCatalog, listCatalogEntries } from '../lib/catalog-discovery.js';

/**
 * Helper function to load catalog entries from a directory
 */
function loadCatalogEntries(catalogDir: string): Map<string, CatalogEntry> {
  const entriesMap = new Map<string, CatalogEntry>();
  const catalogFiles = listCatalogEntries(catalogDir);
  
  for (const file of catalogFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const entry = YAML.parse(content) as CatalogEntry;
      entriesMap.set(entry.changeType, entry);
    } catch (error) {
      // Skip invalid entries
      console.error(`Warning: Failed to load ${file}`);
    }
  }
  
  return entriesMap;
}

/**
 * Helper function to get severity summary with comparison to default catalog
 */
function getSeveritySummary(
  entry: CatalogEntry, 
  defaultEntry?: CatalogEntry
): string {
  const currentSeverities = [...new Set(entry.variants.map(v => v.severity))];
  const currentSevStr = currentSeverities.join('|');
  
  if (!defaultEntry || defaultEntry === entry) {
    return currentSevStr;
  }
  
  const defaultSeverities = [...new Set(defaultEntry.variants.map(v => v.severity))];
  const defaultSevStr = defaultSeverities.join('|');
  
  if (currentSevStr === defaultSevStr) {
    return currentSevStr;
  }
  
  return `${currentSevStr} (default: ${defaultSevStr})`;
}

/**
 * List subcommand - Display all rules in a table
 */
async function listCommand(options: {
  category?: string;
  severity?: string;
  breaking?: boolean;
  rules?: string;
  catalog?: string;
  format?: string;
}): Promise<void> {
  try {
    const rulesFile = options.rules || 'rules/breaking-changes.yaml';
    const discovery = discoverCatalog(rulesFile, options.catalog);
    
    // Show warnings if any
    discovery.warnings.forEach(w => console.error(w));
    
    // Load current catalog entries
    const catalogFiles = listCatalogEntries(discovery.catalogDir);
    
    if (catalogFiles.length === 0) {
      console.log('No catalog entries found.');
      return;
    }
    
    // Load and parse entries
    const entries: Array<{ entry: CatalogEntry; file: string }> = [];
    
    for (const file of catalogFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const entry = YAML.parse(content) as CatalogEntry;
      entries.push({ entry, file });
    }
    
    // Load default catalog for comparison (if using custom catalog)
    let defaultCatalog: Map<string, CatalogEntry> | undefined;
    if (discovery.isCustom) {
      const defaultDiscovery = discoverCatalog('rules/breaking-changes.yaml');
      if (fs.existsSync(defaultDiscovery.catalogDir)) {
        defaultCatalog = loadCatalogEntries(defaultDiscovery.catalogDir);
      }
    }
    
    // Filter entries
    let filtered = entries;
    
    if (options.category) {
      filtered = filtered.filter(e => e.entry.category === options.category);
    }
    
    if (options.severity) {
      filtered = filtered.filter(e => 
        e.entry.variants.some(v => v.severity === options.severity)
      );
    }
    
    if (options.breaking !== undefined) {
      filtered = filtered.filter(e =>
        e.entry.variants.some(v => v.breaking === options.breaking)
      );
    }
    
    if (filtered.length === 0) {
      console.log('No rules match the specified filters.');
      return;
    }
    
    // Sort by category then changeType
    filtered.sort((a, b) => {
      if (a.entry.category !== b.entry.category) {
        return a.entry.category.localeCompare(b.entry.category);
      }
      return a.entry.changeType.localeCompare(b.entry.changeType);
    });
    
    // Display based on format
    if (options.format === 'json') {
      console.log(JSON.stringify(filtered.map(f => f.entry), null, 2));
      return;
    }
    
    // Table format (default)
    console.log('\n📋 Rules Catalog\n');
    
    if (discovery.isCustom) {
      console.log(`📂 Catalog: ${discovery.catalogDir} (custom)`);
    } else {
      console.log(`📂 Catalog: ${discovery.catalogDir} (default)`);
    }
    
    console.log(`📜 Rules File: ${rulesFile}`);
    console.log(`📊 Total Rules: ${filtered.length}\n`);
    
    // Group by category
    const byCategory = new Map<string, typeof filtered>();
    for (const item of filtered) {
      const cat = item.entry.category;
      if (!byCategory.has(cat)) {
        byCategory.set(cat, []);
      }
      byCategory.get(cat)!.push(item);
    }
    
    // Display each category
    for (const [category, items] of byCategory) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`Category: ${category.toUpperCase()}`);
      console.log(`${'='.repeat(80)}\n`);
      
      for (const { entry } of items) {
        const breakingVariants = entry.variants.filter(v => v.breaking);
        const compatibleVariants = entry.variants.filter(v => !v.breaking);
        
        const status = breakingVariants.length > 0 ? '🔴 BREAKING' : '🟢 COMPATIBLE';
        
        // Get severity with comparison to default catalog
        const defaultEntry = defaultCatalog?.get(entry.changeType);
        const severitySummary = getSeveritySummary(entry, defaultEntry);
        
        console.log(`${status} ${entry.changeType}`);
        console.log(`  ${entry.title}`);
        console.log(`  Variants: ${entry.variants.length} (${breakingVariants.length} breaking, ${compatibleVariants.length} compatible)`);
        console.log(`  Severity: ${severitySummary}`);
        
        if (entry.description) {
          const desc = entry.description.split('\n')[0]; // First line only
          console.log(`  ${desc.substring(0, 70)}${desc.length > 70 ? '...' : ''}`);
        }
        
        console.log('');
      }
    }
    
    console.log(`\n💡 Use 'mcpcontract rules show <changeType>' for detailed documentation\n`);
    
  } catch (error: any) {
    console.error('Error listing rules:', error.message);
    process.exit(1);
  }
}

/**
 * Show subcommand - Display detailed documentation for a rule
 */
async function showCommand(changeType: string, options: { rules?: string; catalog?: string }): Promise<void> {
  try {
    const rulesFile = options.rules || 'rules/breaking-changes.yaml';
    const discovery = discoverCatalog(rulesFile, options.catalog);
    
    // Show warnings if any
    discovery.warnings.forEach(w => console.error(w));
    
    // Find the catalog entry
    const catalogFiles = listCatalogEntries(discovery.catalogDir);
    let entry: CatalogEntry | null = null;
    
    for (const file of catalogFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const candidate = YAML.parse(content) as CatalogEntry;
      
      if (candidate.changeType === changeType) {
        entry = candidate;
        break;
      }
    }
    
    if (!entry) {
      console.error(`❌ Rule not found: ${changeType}`);
      console.log(`\n💡 Use 'mcpcontract rules list' to see available rules`);
      process.exit(1);
    }
    
    // Display detailed documentation
    console.log('\n' + '='.repeat(80));
    console.log(`📋 ${entry.title}`);
    console.log('='.repeat(80));
    console.log('');
    
    console.log(`Change Type: ${entry.changeType}`);
    console.log(`Category: ${entry.category}`);
    console.log(`Version: ${entry.version}`);
    console.log(`Introduced: v${entry.introduced}`);
    if (entry.rulesFile) {
      console.log(`Rules File: ${entry.rulesFile}`);
    }
    console.log('');
    
    console.log('Description:');
    console.log(entry.description);
    console.log('');
    
    // Display variants
    console.log(`Variants: ${entry.variants.length}`);
    console.log('');
    
    for (let i = 0; i < entry.variants.length; i++) {
      const variant = entry.variants[i];
      
      console.log(`${'─'.repeat(80)}`);
      console.log(`Variant ${i + 1}: ${variant.id}`);
      console.log(`${'─'.repeat(80)}`);
      console.log('');
      
      const breakingStatus = variant.breaking ? '🔴 BREAKING' : '🟢 COMPATIBLE';
      const severityEmoji = variant.severity === 'critical' ? '🔥' : variant.severity === 'major' ? '⚠️' : 'ℹ️';
      
      console.log(`Status: ${breakingStatus}`);
      console.log(`Severity: ${severityEmoji} ${variant.severity}`);
      console.log(`Message: ${variant.message}`);
      console.log('');
      
      console.log('Rationale:');
      console.log(variant.rationale);
      console.log('');
      
      if (variant.migration) {
        console.log('Migration Guidance:');
        console.log(variant.migration);
        console.log('');
      }
      
      if (variant.conditions && variant.conditions.length > 0) {
        console.log('Conditions:');
        for (const condition of variant.conditions) {
          console.log(`  - ${condition.field} ${condition.operator} ${JSON.stringify(condition.value)}`);
        }
        console.log('');
      }
      
      console.log(`Examples: ${variant.examples.pass.length} pass, ${variant.examples.fail?.length || 0} fail`);
      console.log('');
    }
    
    // Related rules
    if (entry.relatedRules && entry.relatedRules.length > 0) {
      console.log('Related Rules:');
      entry.relatedRules.forEach(rule => console.log(`  - ${rule}`));
      console.log('');
    }
    
    // References
    if (entry.references && entry.references.length > 0) {
      console.log('References:');
      entry.references.forEach(ref => {
        if (ref.url) {
          console.log(`  - ${ref.title}: ${ref.url}`);
        } else {
          console.log(`  - ${ref.title}`);
        }
      });
      console.log('');
    }
    
    // Tags
    if (entry.tags && entry.tags.length > 0) {
      console.log(`Tags: ${entry.tags.join(', ')}`);
      console.log('');
    }
    
    console.log('='.repeat(80));
    console.log(`\n💡 Use 'mcpcontract rules examples ${changeType}' to see examples\n`);
    
  } catch (error: any) {
    console.error('Error showing rule:', error.message);
    process.exit(1);
  }
}

/**
 * Examples subcommand - Display pass/fail examples for a rule
 */
async function examplesCommand(changeType: string, options: { rules?: string; catalog?: string; variant?: string }): Promise<void> {
  try {
    const rulesFile = options.rules || 'rules/breaking-changes.yaml';
    const discovery = discoverCatalog(rulesFile, options.catalog);
    
    // Find the catalog entry
    const catalogFiles = listCatalogEntries(discovery.catalogDir);
    let entry: CatalogEntry | null = null;
    
    for (const file of catalogFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const candidate = YAML.parse(content) as CatalogEntry;
      
      if (candidate.changeType === changeType) {
        entry = candidate;
        break;
      }
    }
    
    if (!entry) {
      console.error(`❌ Rule not found: ${changeType}`);
      process.exit(1);
    }
    
    // Filter variants if specified
    let variants = entry.variants;
    if (options.variant) {
      variants = variants.filter(v => v.id === options.variant);
      if (variants.length === 0) {
        console.error(`❌ Variant not found: ${options.variant}`);
        process.exit(1);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log(`📝 Examples: ${entry.changeType}`);
    console.log('='.repeat(80));
    console.log('');
    
    for (const variant of variants) {
      console.log(`Variant: ${variant.id}`);
      console.log(`Status: ${variant.breaking ? '🔴 BREAKING' : '🟢 COMPATIBLE'} (${variant.severity})`);
      console.log('');
      
      // Pass examples
      if (variant.examples.pass.length > 0) {
        console.log('✅ PASS Examples (should match this variant):');
        console.log('');
        
        for (let i = 0; i < variant.examples.pass.length; i++) {
          const example = variant.examples.pass[i];
          console.log(`  ${i + 1}. ${example.name}`);
          console.log(`     ${example.description}`);
          console.log('');
          console.log('     Change:');
          console.log(JSON.stringify(example.change, null, 6).split('\n').map(line => '     ' + line).join('\n'));
          console.log('');
          console.log('     Expected Result:');
          console.log(JSON.stringify(example.expectedResult, null, 6).split('\n').map(line => '     ' + line).join('\n'));
          console.log('');
        }
      }
      
      // Fail examples
      if (variant.examples.fail && variant.examples.fail.length > 0) {
        console.log('❌ FAIL Examples (should NOT match this variant):');
        console.log('');
        
        for (let i = 0; i < variant.examples.fail.length; i++) {
          const example = variant.examples.fail[i];
          console.log(`  ${i + 1}. ${example.name}`);
          console.log(`     ${example.description}`);
          console.log('');
          console.log('     Change:');
          console.log(JSON.stringify(example.change, null, 6).split('\n').map(line => '     ' + line).join('\n'));
          console.log('');
          console.log('     Expected Result:');
          console.log(JSON.stringify(example.expectedResult, null, 6).split('\n').map(line => '     ' + line).join('\n'));
          console.log('');
        }
      }
      
      console.log('─'.repeat(80));
      console.log('');
    }
    
  } catch (error: any) {
    console.error('Error showing examples:', error.message);
    process.exit(1);
  }
}

/**
 * Validate subcommand - Validate catalog completeness
 */
async function validateCommand(options: { rules?: string; catalog?: string }): Promise<void> {
  try {
    const rulesFile = options.rules || 'rules/breaking-changes.yaml';
    const discovery = discoverCatalog(rulesFile, options.catalog);
    
    console.log('\n' + '='.repeat(80));
    console.log('🔍 Validating Catalog');
    console.log('='.repeat(80));
    console.log('');
    
    console.log(`Rules File: ${rulesFile}`);
    console.log(`Catalog Directory: ${discovery.catalogDir}`);
    console.log(`Custom Catalog: ${discovery.isCustom ? 'Yes' : 'No'}`);
    console.log('');
    
    // Show discovery warnings
    if (discovery.warnings.length > 0) {
      console.log('Discovery Warnings:');
      discovery.warnings.forEach(w => console.log(`  ${w}`));
      console.log('');
    }
    
    // Create validator and validate
    const validator = new CatalogValidator();
    await validator.loadSchema();
    
    // Validate catalog directory
    const catalogResult = validator.validateCatalogDirectory(discovery.catalogDir);
    
    // Validate completeness
    const completenessResult = validator.validateCompleteness(rulesFile, discovery.catalogDir);
    
    // Display results
    if (catalogResult.valid && completenessResult.valid) {
      console.log('✅ Validation Passed\n');
      console.log(`   Schema: ✓ All entries valid`);
      console.log(`   Completeness: ✓ All rules documented`);
      console.log('');
      process.exit(0);
    } else {
      console.log('❌ Validation Failed\n');
      
      // Show errors
      const allErrors = [...catalogResult.errors, ...completenessResult.errors];
      if (allErrors.length > 0) {
        console.log('Errors:');
        for (const error of allErrors) {
          console.log(`  [${error.type}] ${error.file}`);
          console.log(`    ${error.message}`);
          if (error.details) {
            console.log(`    Details: ${JSON.stringify(error.details, null, 2).split('\n').map(l => '    ' + l).join('\n').trim()}`);
          }
        }
        console.log('');
      }
      
      // Show warnings
      const allWarnings = [...catalogResult.warnings, ...completenessResult.warnings];
      if (allWarnings.length > 0) {
        console.log('Warnings:');
        for (const warning of allWarnings) {
          console.log(`  [${warning.type}] ${warning.file}`);
          console.log(`    ${warning.message}`);
        }
        console.log('');
      }
      
      process.exit(1);
    }
    
  } catch (error: any) {
    console.error('Error validating catalog:', error.message);
    process.exit(2);
  }
}

/**
 * Export subcommand - Export catalog as JSON or Markdown
 */
async function exportCommand(options: {
  rules?: string;
  catalog?: string;
  format?: string;
  output?: string;
  summary?: boolean;
}): Promise<void> {
  try {
    const rulesFile = options.rules || 'rules/breaking-changes.yaml';
    const discovery = discoverCatalog(rulesFile, options.catalog);
    const format = options.format || 'json';
    
    // Load all catalog entries
    const catalogFiles = listCatalogEntries(discovery.catalogDir);
    const entries: CatalogEntry[] = [];
    
    for (const file of catalogFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const entry = YAML.parse(content) as CatalogEntry;
      entries.push(entry);
    }
    
    // Sort entries
    entries.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.changeType.localeCompare(b.changeType);
    });
    
    let output = '';
    
    if (format === 'json') {
      // JSON export
      if (options.summary) {
        // Summary: exclude examples
        const summary = entries.map(e => ({
          changeType: e.changeType,
          category: e.category,
          version: e.version,
          introduced: e.introduced,
          title: e.title,
          description: e.description,
          variants: e.variants.map(v => ({
            id: v.id,
            breaking: v.breaking,
            severity: v.severity,
            message: v.message
          })),
          relatedRules: e.relatedRules,
          tags: e.tags
        }));
        output = JSON.stringify(summary, null, 2);
      } else {
        // Full export
        output = JSON.stringify(entries, null, 2);
      }
    } else if (format === 'markdown') {
      // Markdown export
      output = '# Rules Catalog\n\n';
      output += `**Rules File**: ${rulesFile}\n`;
      output += `**Catalog Directory**: ${discovery.catalogDir}\n`;
      output += `**Total Rules**: ${entries.length}\n\n`;
      
      // Group by category
      const byCategory = new Map<string, CatalogEntry[]>();
      for (const entry of entries) {
        if (!byCategory.has(entry.category)) {
          byCategory.set(entry.category, []);
        }
        byCategory.get(entry.category)!.push(entry);
      }
      
      for (const [category, items] of byCategory) {
        output += `## ${category.toUpperCase()}\n\n`;
        
        for (const entry of items) {
          output += `### ${entry.title}\n\n`;
          output += `**Change Type**: \`${entry.changeType}\`\n\n`;
          output += `${entry.description}\n\n`;
          
          output += `**Variants**: ${entry.variants.length}\n\n`;
          
          for (const variant of entry.variants) {
            const status = variant.breaking ? '🔴 BREAKING' : '🟢 COMPATIBLE';
            output += `- **${variant.id}**: ${status} (${variant.severity})\n`;
            output += `  - ${variant.message}\n`;
          }
          
          output += '\n';
          
          if (entry.relatedRules && entry.relatedRules.length > 0) {
            output += `**Related Rules**: ${entry.relatedRules.join(', ')}\n\n`;
          }
          
          if (entry.tags && entry.tags.length > 0) {
            output += `**Tags**: ${entry.tags.join(', ')}\n\n`;
          }
        }
      }
    } else {
      console.error(`❌ Unsupported format: ${format}`);
      console.log('Supported formats: json, markdown');
      process.exit(1);
    }
    
    // Write or display output
    if (options.output) {
      fs.writeFileSync(options.output, output, 'utf-8');
      console.log(`✅ Catalog exported to ${options.output}`);
    } else {
      console.log(output);
    }
    
  } catch (error: any) {
    console.error('Error exporting catalog:', error.message);
    process.exit(1);
  }
}

/**
 * List-catalogs subcommand - Discover available catalogs in rules directory
 */
async function listCatalogsCommand(): Promise<void> {
  try {
    const rulesDir = 'rules';
    
    if (!fs.existsSync(rulesDir)) {
      console.log('No rules directory found.');
      return;
    }
    
    console.log('📚 Available Catalogs:\n');
    
    // Find all YAML files in rules directory
    const files = fs.readdirSync(rulesDir);
    const yamlFiles = files.filter(f => f.endsWith('.yaml'));
    
    if (yamlFiles.length === 0) {
      console.log('No rules files found in rules/ directory.');
      return;
    }
    
    const catalogs: Array<{ rulesFile: string; catalogDir: string; exists: boolean; entryCount: number }> = [];
    
    for (const file of yamlFiles) {
      const rulesFile = `${rulesDir}/${file}`;
      const discovery = discoverCatalog(rulesFile);
      
      let entryCount = 0;
      if (discovery.catalogDir && fs.existsSync(discovery.catalogDir)) {
        const catalogFiles = listCatalogEntries(discovery.catalogDir);
        entryCount = catalogFiles.length;
      }
      
      catalogs.push({
        rulesFile,
        catalogDir: discovery.catalogDir,
        exists: discovery.catalogDir ? fs.existsSync(discovery.catalogDir) : false,
        entryCount
      });
    }
    
    // Display catalogs
    for (const catalog of catalogs) {
      const status = catalog.exists ? '✅' : '❌';
      const count = catalog.exists ? ` (${catalog.entryCount} entries)` : ' (not found)';
      const isDefault = catalog.rulesFile === 'rules/breaking-changes.yaml' ? ' [DEFAULT]' : '';
      
      console.log(`${status} ${catalog.rulesFile}${isDefault}`);
      console.log(`   Catalog: ${catalog.catalogDir}${count}`);
      console.log();
    }
    
    console.log('💡 To use a catalog:');
    console.log('   mcpcontract rules list --rules <file> --catalog <dir>');
    console.log('   mcpcontract rules list --catalog <dir>  (auto-discovers rules file)');
    
  } catch (error: any) {
    console.error('Error listing catalogs:', error.message);
    process.exit(1);
  }
}

/**
 * Create rules command with subcommands
 */
export function rulesCommand(): Command {
  const cmd = new Command('rules');
  
  cmd
    .usage('[subcommand] [options]')
    .description('Browse and explore backward compatibility rules catalog')
    .configureHelp({
      formatHelp: (cmd, helper) => {
        const termWidth = helper.padWidth(cmd, helper);
        
        let output = `Usage: ${helper.commandUsage(cmd)}\n\n`;
        output += `${helper.commandDescription(cmd)}\n\n`;
        
        // Options section
        const options = cmd.options;
        if (options.length > 0) {
          output += 'Options:\n';
          options.forEach(opt => {
            output += `  ${helper.optionTerm(opt).padEnd(termWidth)}  ${helper.optionDescription(opt)}\n`;
          });
          output += '\n';
        }
        
        // Subcommands section
        const commands = cmd.commands;
        if (commands.length > 0) {
          output += 'Subcommands:\n';
          commands.forEach(subCmd => {
            output += `  ${helper.subcommandTerm(subCmd).padEnd(termWidth)}  ${helper.subcommandDescription(subCmd)}\n`;
          });
        }
        
        return output;
      }
    })
    .addHelpText('after', `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMMON OPTIONS (available on all subcommands)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  --rules <file>                Custom rules YAML file
                                (default: rules/breaking-changes.yaml)
                                
  --catalog <dir>               Custom catalog directory (overrides auto-discovery)
                                Auto-discovery convention:
                                  rules/my-rules.yaml → rules/my-rules-catalog/
                                When using custom catalog, severity comparison is shown:
                                  Severity: major (default: info|critical)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXAMPLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  # List all rules from default catalog
  $ mcpcontract rules list
  $ mcpcontract rules list --category tools
  $ mcpcontract rules list --severity critical --breaking

  # Show documentation for a specific rule
  $ mcpcontract rules show parameter-added
  $ mcpcontract rules show parameter-enum-values-changed

  # View test examples
  $ mcpcontract rules examples parameter-added
  $ mcpcontract rules examples parameter-enum-values-changed --variant enum-additions-only

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ADVANCED USE CASES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  # Use custom catalog with severity comparison
  $ mcpcontract rules list --catalog rules/strict-compatibility-catalog
  #    note: output shows: Severity: major (default: info|critical)

  $ mcpcontract rules show parameter-enum-values-changed \\
      --catalog rules/strict-compatibility-catalog

  # Team workflow - Export custom rules as documentation
  $ mcpcontract rules export \\
      --catalog rules/team-rules-catalog \\
      --format markdown \\
      --output docs/TEAM_RULES.md

  # Validate custom catalog structure
  $ mcpcontract rules validate --catalog rules/my-team-catalog
`);
  
  // List subcommand
  cmd
    .command('list')
    .description('List all rules in the catalog')
    .option('--category <category>', 'Filter by category (tools, prompts, resources, resourceTemplates, serverInfo)')
    .option('--severity <severity>', 'Filter by severity (info, major, critical)')
    .option('--breaking', 'Show only breaking rules')
    .option('--rules <file>', 'Custom rules file (default: rules/breaking-changes.yaml)')
    .option('--catalog <dir>', 'Custom catalog directory (overrides auto-discovery)')
    .option('--format <format>', 'Output format: table or json (default: table)', 'table')
    .action(listCommand);
  
  // List-catalogs subcommand
  cmd
    .command('list-catalogs')
    .description('Discover available catalogs in rules directory')
    .action(listCatalogsCommand);
  
  // Show subcommand
  cmd
    .command('show <rule>')
    .description('Show detailed documentation for a specific rule')
    .option('--rules <file>', 'Custom rules file (default: rules/breaking-changes.yaml)')
    .option('--catalog <dir>', 'Custom catalog directory (overrides auto-discovery)')
    .action(showCommand);
  
  // Examples subcommand
  cmd
    .command('examples <rule>')
    .description('Show pass/fail examples for a specific rule')
    .option('--rules <file>', 'Custom rules file (default: rules/breaking-changes.yaml)')
    .option('--catalog <dir>', 'Custom catalog directory (overrides auto-discovery)')
    .option('--variant <id>', 'Show examples for specific variant only')
    .action(examplesCommand);
  
  // Validate subcommand
  cmd
    .command('validate')
    .description('Validate catalog completeness and schema compliance')
    .option('--rules <file>', 'Custom rules file (default: rules/breaking-changes.yaml)')
    .option('--catalog <dir>', 'Custom catalog directory (overrides auto-discovery)')
    .action(validateCommand);
  
  // Export subcommand
  cmd
    .command('export')
    .description('Export catalog as JSON or Markdown')
    .option('--rules <file>', 'Custom rules file (default: rules/breaking-changes.yaml)')
    .option('--catalog <dir>', 'Custom catalog directory (overrides auto-discovery)')
    .option('--format <format>', 'Output format: json or markdown (default: json)', 'json')
    .option('--output <file>', 'Output file (default: stdout)')
    .option('--summary', 'Export summary without examples (JSON only)')
    .action(exportCommand);
  
  return cmd;
}
