#!/usr/bin/env node

// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Catalog Test Generator
 * 
 * Automatically generates Jest test suites from catalog YAML files.
 * Extracts pass/fail examples from each variant and creates executable tests.
 * 
 * Usage:
 *   npm run test:generate
 *   node tests/generators/catalog-test-generator.ts
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const CATALOG_DIR = path.join(__dirname, '../../rules/catalog');
const OUTPUT_FILE = path.join(__dirname, '../unit/catalog-generated.test.ts');

interface CatalogExample {
  name: string;
  description: string;
  change: {
    id: string;
    category: string;
    changeType: string;
    path: string;
    description: string;
    from?: any;
    to?: any;
    diff?: any;
  };
  expectedResult: {
    breaking: boolean;
    severity: string;
    ruleMessage?: string;
    matchesThisVariant?: boolean;
  };
}

interface Examples {
  pass?: CatalogExample[];
  fail?: CatalogExample[];
}

interface Variant {
  id?: string;
  conditions?: any[];
  breaking: boolean;
  severity: string;
  message: string;
  examples?: Examples;
}

interface CatalogEntry {
  changeType: string;
  category: string;
  title: string;
  description: string;
  variants?: Variant[];
  breaking?: boolean;
  severity?: string;
  message?: string;
  examples?: Examples;
}

interface GeneratedTest {
  category: string;
  changeType: string;
  variantIndex: number;
  exampleIndex: number;
  description: string;
  expected: 'pass' | 'fail';
  expectedBreaking?: boolean;
  expectedSeverity?: string;
  from?: any;
  to?: any;
  diff?: any;
}

/**
 * Discover all catalog YAML files
 */
async function discoverCatalogFiles(): Promise<string[]> {
  const categories = ['tools', 'prompts', 'resources', 'resourceTemplates', 'serverInfo'];
  const files: string[] = [];
  
  for (const category of categories) {
    const categoryDir = path.join(CATALOG_DIR, category);
    try {
      const entries = await fs.readdir(categoryDir);
      for (const entry of entries) {
        if (entry.endsWith('.yaml')) {
          files.push(path.join(categoryDir, entry));
        }
      }
    } catch (error) {
      // Category directory might not exist
      console.warn(`Warning: Cannot read ${category} directory`);
    }
  }
  
  return files;
}

/**
 * Parse catalog YAML file
 */
async function parseCatalogFile(filePath: string): Promise<CatalogEntry> {
  const content = await fs.readFile(filePath, 'utf-8');
  return yaml.parse(content);
}

/**
 * Extract tests from catalog entry
 */
function extractTests(entry: CatalogEntry): GeneratedTest[] {
  const tests: GeneratedTest[] = [];
  
  // Handle simple format (no variants)
  if (entry.examples && !entry.variants) {
    // Process pass examples
    if (entry.examples.pass) {
      entry.examples.pass.forEach((example, exampleIndex) => {
        tests.push({
          category: entry.category,
          changeType: entry.changeType,
          variantIndex: 0,
          exampleIndex,
          description: example.description,
          expected: 'pass',
          expectedBreaking: example.expectedResult.breaking,
          expectedSeverity: example.expectedResult.severity,
          from: example.change.from,
          to: example.change.to,
          diff: example.change.diff
        });
      });
    }
    
    // TODO: Process fail examples - currently skipped (see variants section for details)
    // if (entry.examples.fail) {
    //   entry.examples.fail.forEach((example, exampleIndex) => {
    //     tests.push({
    //       category: entry.category,
    //       changeType: entry.changeType,
    //       variantIndex: 0,
    //       exampleIndex: exampleIndex + (entry.examples?.pass?.length || 0),
    //       description: example.description,
    //       expected: 'fail',
    //       expectedBreaking: example.expectedResult.breaking,
    //       expectedSeverity: example.expectedResult.severity,
    //       from: example.change.from,
    //       to: example.change.to,
    //       diff: example.change.diff
    //     });
    //   });
    // }
  }
  
  // Handle variants format
  if (entry.variants) {
    entry.variants.forEach((variant, variantIndex) => {
      if (variant.examples) {
        // Process pass examples
        if (variant.examples.pass) {
          variant.examples.pass.forEach((example, exampleIndex) => {
            tests.push({
              category: entry.category,
              changeType: entry.changeType,
              variantIndex,
              exampleIndex,
              description: example.description,
              expected: 'pass',
              expectedBreaking: example.expectedResult.breaking,
              expectedSeverity: example.expectedResult.severity,
              from: example.change.from,
              to: example.change.to,
              diff: example.change.diff
            });
          });
        }
        
        // TODO: Process fail examples - currently skipped
        // These test variant matching logic and need more sophisticated assertions
        // The fail examples verify that changes DON'T match a specific variant
        // but DO match a different variant with different breaking/severity values.
        // Issue tracked in tests/generators/catalog-test-generator.ts
        // 
        // if (variant.examples.fail) {
        //   variant.examples.fail.forEach((example, exampleIndex) => {
        //     tests.push({
        //       category: entry.category,
        //       changeType: entry.changeType,
        //       variantIndex,
        //       exampleIndex: exampleIndex + (variant.examples?.pass?.length || 0),
        //       description: example.description,
        //       expected: 'fail',
        //       expectedBreaking: example.expectedResult.breaking,
        //       expectedSeverity: example.expectedResult.severity,
        //       from: example.change.from,
        //       to: example.change.to,
        //       diff: example.change.diff
        //     });
        //   });
        // }
      }
    });
  }
  
  return tests;
}

/**
 * Generate TypeScript test code
 */
function generateTestCode(tests: GeneratedTest[]): string {
  const imports = `/**
 * AUTO-GENERATED TEST FILE
 * 
 * Generated from catalog YAML files by tests/generators/catalog-test-generator.ts
 * DO NOT EDIT MANUALLY - changes will be overwritten
 * 
 * To regenerate: npm run test:generate
 */

import { describe, it, expect } from '@jest/globals';
import { RulesEngine } from '../../src/lib/rules-engine.js';
import type { Change } from '../../src/lib/differ.js';

`;

  // Group tests by category
  const categories = new Map<string, GeneratedTest[]>();
  tests.forEach(test => {
    if (!categories.has(test.category)) {
      categories.set(test.category, []);
    }
    categories.get(test.category)!.push(test);
  });

  let code = imports;

  // Generate test suites by category
  for (const [category, categoryTests] of categories) {
    code += `describe('${category} - Auto-generated Catalog Tests', () => {\n`;
    
    // Group by changeType
    const changeTypes = new Map<string, GeneratedTest[]>();
    categoryTests.forEach(test => {
      if (!changeTypes.has(test.changeType)) {
        changeTypes.set(test.changeType, []);
      }
      changeTypes.get(test.changeType)!.push(test);
    });
    
    for (const [changeType, changeTests] of changeTypes) {
      code += `  describe('${changeType}', () => {\n`;
      
      changeTests.forEach((test, index) => {
        const testName = `${test.description} [${test.expected}]`;
        
        code += `    it('${escapeString(testName)}', () => {\n`;
        
        // For enum changes, wrap arrays in { enum: [...] } objects to match differ output
        const isEnumChange = changeType.includes('enum');
        const fromValue = test.from != null 
          ? (isEnumChange && Array.isArray(test.from) ? { enum: test.from } : test.from)
          : null;
        const toValue = test.to != null
          ? (isEnumChange && Array.isArray(test.to) ? { enum: test.to } : test.to)
          : null;
        
        // Generate change object
        code += `      const change: Change = {\n`;
        code += `        id: 'test-${category}-${changeType}-${index}',\n`;
        code += `        category: '${category}',\n`;
        code += `        changeType: '${changeType}',\n`;
        code += `        path: 'test.path',\n`;
        code += `        description: '${escapeString(test.description)}',\n`;
        code += `        from: ${JSON.stringify(fromValue)},\n`;
        code += `        to: ${JSON.stringify(toValue)},\n`;
        code += `      };\n\n`;
        
        // Create rules engine and analyze
        code += `      const engine = new RulesEngine('rules/breaking-changes.yaml');\n`;
        code += `      const results = engine.applyRules([change]);\n\n`;
        
        // Assertions
        code += `      expect(results).toHaveLength(1);\n`;
        code += `      const result = results[0];\n\n`;
        
        if (test.expected === 'pass') {
          code += `      expect(result.breaking).toBe(${test.expectedBreaking ?? false});\n`;
        } else {
          // For 'fail' tests, we expect the rule matching to produce the opposite result
          // This tests that the variant conditions work correctly
          code += `      expect(result.breaking).not.toBe(${test.expectedBreaking ?? false});\n`;
        }
        
        if (test.expectedSeverity) {
          code += `      expect(result.severity).toBeDefined();\n`;
        }
        
        code += `    });\n\n`;
      });
      
      code += `  });\n\n`;
    }
    
    code += `});\n\n`;
  }

  return code;
}

/**
 * Escape string for TypeScript
 */
function escapeString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Main execution
 */
async function main() {
  console.log('🔍 Discovering catalog files...');
  const catalogFiles = await discoverCatalogFiles();
  console.log(`   Found ${catalogFiles.length} catalog files`);
  
  console.log('\n📖 Parsing catalog entries...');
  const allTests: GeneratedTest[] = [];
  
  for (const filePath of catalogFiles) {
    const entry = await parseCatalogFile(filePath);
    const tests = extractTests(entry);
    allTests.push(...tests);
    console.log(`   ${path.basename(filePath)}: ${tests.length} tests`);
  }
  
  console.log(`\n✅ Total tests extracted: ${allTests.length}`);
  
  console.log('\n🔧 Generating test code...');
  const code = generateTestCode(allTests);
  
  console.log('\n💾 Writing to', path.relative(process.cwd(), OUTPUT_FILE));
  await fs.writeFile(OUTPUT_FILE, code, 'utf-8');
  
  console.log(`\n🎉 Successfully generated ${allTests.length} tests!`);
  console.log('\n📊 Test breakdown:');
  
  // Count by category
  const categories = new Map<string, number>();
  allTests.forEach(test => {
    categories.set(test.category, (categories.get(test.category) || 0) + 1);
  });
  
  for (const [category, count] of categories) {
    console.log(`   ${category}: ${count} tests`);
  }
  
  console.log('\n🚀 Run tests with: npm test');
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
