// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Catalog Discovery
 * 
 * Discovers catalog directories for rules files using convention-based approach.
 * Convention: rules/{basename}-catalog/ where basename is the rules file name without extension.
 * Falls back to rules/catalog/ if custom catalog not found.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface CatalogDiscoveryResult {
  catalogDir: string;
  isCustom: boolean;
  rulesFile: string;
  warnings: string[];
}

/**
 * Discover catalog directory for a given rules file
 * 
 * @param rulesFile Path to the rules file (e.g., "rules/breaking-changes.yaml" or "rules/strict-compatibility.yaml")
 * @param catalogDirOverride Optional manual catalog directory override
 * @returns Discovery result with catalog directory, custom status, and warnings
 */
export function discoverCatalog(rulesFile: string, catalogDirOverride?: string): CatalogDiscoveryResult {
  const warnings: string[] = [];
  
  // If catalog override provided, use it directly
  if (catalogDirOverride) {
    if (!fs.existsSync(catalogDirOverride)) {
      warnings.push(`⚠️  Specified catalog directory does not exist: ${catalogDirOverride}`);
      warnings.push(`   Falling back to auto-discovery.`);
    } else if (!fs.statSync(catalogDirOverride).isDirectory()) {
      warnings.push(`⚠️  Specified catalog path is not a directory: ${catalogDirOverride}`);
      warnings.push(`   Falling back to auto-discovery.`);
    } else {
      return {
        catalogDir: catalogDirOverride,
        isCustom: !catalogDirOverride.endsWith('/catalog'),
        rulesFile,
        warnings: []
      };
    }
  }
  
  // Extract basename without extension
  const basename = path.basename(rulesFile, path.extname(rulesFile));
  
  // Check for custom catalog: rules/{basename}-catalog/
  const rulesDir = path.dirname(rulesFile);
  const customCatalog = path.join(rulesDir, `${basename}-catalog`);
  
  if (fs.existsSync(customCatalog) && fs.statSync(customCatalog).isDirectory()) {
    return {
      catalogDir: customCatalog,
      isCustom: true,
      rulesFile,
      warnings: []
    };
  }
  
  // Check if this is a custom rules file (not breaking-changes.yaml)
  if (basename !== 'breaking-changes') {
    warnings.push(`⚠️  Custom rules file specified but no catalog found at ${customCatalog}`);
    warnings.push(`   Using default catalog. Custom rule documentation may not be accurate.`);
    warnings.push(`   To fix: Create ${customCatalog}/ with catalog entries for your custom rules.`);
  }
  
  // Fall back to default catalog
  const defaultCatalog = path.join(rulesDir, 'catalog');
  
  if (!fs.existsSync(defaultCatalog)) {
    warnings.push(`⚠️  Default catalog not found at ${defaultCatalog}`);
    warnings.push(`   Catalog features will be unavailable.`);
  }
  
  return {
    catalogDir: defaultCatalog,
    isCustom: false,
    rulesFile,
    warnings
  };
}

/**
 * Check if catalog directory exists and is valid
 */
export function validateCatalogDirectory(catalogDir: string): { valid: boolean; error?: string } {
  if (!fs.existsSync(catalogDir)) {
    return {
      valid: false,
      error: `Catalog directory does not exist: ${catalogDir}`
    };
  }
  
  if (!fs.statSync(catalogDir).isDirectory()) {
    return {
      valid: false,
      error: `Catalog path is not a directory: ${catalogDir}`
    };
  }
  
  // Check for catalog schema
  const schemaPath = path.join(catalogDir, 'catalog-schema.json');
  if (!fs.existsSync(schemaPath)) {
    return {
      valid: false,
      error: `Catalog schema not found: ${schemaPath}`
    };
  }
  
  return { valid: true };
}

/**
 * List all catalog entries in a directory
 */
export function listCatalogEntries(catalogDir: string): string[] {
  const entries: string[] = [];
  
  if (!fs.existsSync(catalogDir)) {
    return entries;
  }
  
  function scan(dir: string): void {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      
      if (item.isDirectory()) {
        scan(fullPath);
      } else if (item.isFile() && (item.name.endsWith('.yaml') || item.name.endsWith('.yml'))) {
        // Skip schema files
        if (!item.name.includes('schema')) {
          entries.push(fullPath);
        }
      }
    }
  }
  
  scan(catalogDir);
  return entries;
}
