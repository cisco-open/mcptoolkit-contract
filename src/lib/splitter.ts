// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Split large MCP descriptions into focused subsets based on filtering rules
 */

import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { parse as yamlParse } from 'yaml';
import type {
  ContractDump,
  Tool,
  SplitConfig,
  SplitCategory,
  SplitResult,
  SplitStats,
} from './types.js';
import { parseAsContractDump } from './mcpdesc-converter.js';

export interface SplitOptions {
  mcpdescPath: string;
  configPath: string;
  format?: 'json' | 'yaml';
  includeUnmatched?: boolean;
}

export class Splitter {
  private dump!: ContractDump;
  private config!: SplitConfig;
  private stats: SplitStats = {
    totalTools: 0,
    matchedTools: 0,
    unmatchedTools: 0,
    categories: [],
    multipleMatches: [],
  };

  /**
   * Load MCP description file
   */
  async loadMcpDescription(filePath: string): Promise<ContractDump> {
    const content = await readFile(filePath, 'utf-8');
    
    let rawData: unknown;
    try {
      // Try JSON first
      rawData = JSON.parse(content);
    } catch {
      // If JSON fails, try YAML
      try {
        rawData = yamlParse(content);
      } catch (yamlError) {
        throw new Error(`Failed to parse MCP description file as JSON or YAML: ${(yamlError as Error).message}`);
      }
    }
    // Auto-detect format: mcpdesc or ContractDump
    const dump = parseAsContractDump(rawData as Record<string, unknown>);

    this.dump = dump;
    this.stats.totalTools = dump.tools?.length || 0;
    return dump;
  }

  /**
   * Load split configuration file
   */
  async loadConfig(filePath: string): Promise<SplitConfig> {
    const content = await readFile(filePath, 'utf-8');
    
    let config: SplitConfig;
    try {
      // Try JSON first
      config = JSON.parse(content);
    } catch {
      // If JSON fails, try YAML
      try {
        config = yamlParse(content);
      } catch (yamlError) {
        throw new Error(`Failed to parse config file as JSON or YAML: ${(yamlError as Error).message}`);
      }
    }

    // Validate regex patterns
    this.validateRegexPatterns(config);
    
    this.config = config;
    return config;
  }

  /**
   * Validate all regex patterns in the configuration
   */
  private validateRegexPatterns(config: SplitConfig): void {
    for (const category of config.categories) {
      if (category.filters.tools) {
        for (const filter of category.filters.tools) {
          if (filter.type === 'name-pattern') {
            try {
              new RegExp(filter.pattern);
            } catch (error) {
              throw new Error(
                `Invalid regex pattern in category '${category.name}' (tools):\n` +
                `  Pattern: '${filter.pattern}'\n` +
                `  Error: ${(error as Error).message}`
              );
            }
          }
        }
      }
      // Phase 1: Only validate tools filters
      // Future: Validate prompts, resources, resourceTemplates filters
    }
  }

  /**
   * Check if a tool name matches any filter in a category
   */
  private matchesCategory(toolName: string, category: SplitCategory): boolean {
    if (!category.filters.tools || category.filters.tools.length === 0) {
      return false;
    }

    for (const filter of category.filters.tools) {
      if (filter.type === 'name-pattern') {
        const regex = new RegExp(filter.pattern);
        if (regex.test(toolName)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Find all categories that match a tool
   */
  private findMatchingCategories(tool: Tool): SplitCategory[] {
    return this.config.categories.filter(category => 
      this.matchesCategory(tool.name, category)
    );
  }

  /**
   * Create a new dump with filtered tools and complete split metadata
   */
  private createFilteredDump(
    category: SplitCategory,
    matchedTools: Tool[],
    sourceFile: string,
    configFile: string
  ): ContractDump {
    // Collect filter rules for this category
    const filterRules: Array<{ capability: string; type: string; pattern: string }> = [];
    if (category.filters.tools) {
      for (const filter of category.filters.tools) {
        filterRules.push({
          capability: 'tools',
          type: filter.type,
          pattern: filter.pattern,
        });
      }
    }
    // Phase 1: Only tools filtering implemented
    // Future: Add prompts, resources, resourceTemplates filters

    // Create new dump structure preserving all original metadata
    const filteredDump: ContractDump = {
      version: this.dump.version, // Internal model field; dropped on mcpdesc output
      dumpDetails: {
        ...this.dump.dumpDetails,
        // Keep original description unchanged - split info is in splitOperation
        // Add complete split metadata to dumpExecution
        dumpExecution: {
          ...this.dump.dumpDetails.dumpExecution,
          splitOperation: {
            // Split tool identification
            toolName: 'mcpcontract',
            toolVersion: '0.24.0',
            createdAt: new Date().toISOString(),
            
            // Split configuration
            splitConfig: {
              sourceFile: basename(sourceFile),
              category: category.name,
              configFile: basename(configFile),
            },
            
            // Split execution details
            splitExecution: {
              originalCounts: {
                tools: this.dump.tools?.length || 0,
                prompts: this.dump.prompts?.length || 0,
                resources: this.dump.resources?.length || 0,
                resourceTemplates: this.dump.resourceTemplates?.length || 0,
              },
              filteredCounts: {
                tools: matchedTools.length,
                prompts: 0, // Phase 1: Not filtered
                resources: 0,
                resourceTemplates: 0,
              },
              filterRules,
            },
          },
        },
      },
      serverInfo: this.dump.serverInfo,
      tools: matchedTools,
      resources: [], // Phase 1: Empty (not filtered)
      resourceTemplates: [], // Phase 1: Empty (not filtered)
      prompts: [], // Phase 1: Empty (not filtered)
    };

    // Preserve roots if present
    if (this.dump.roots) {
      filteredDump.roots = this.dump.roots;
    }

    return filteredDump;
  }

  /**
   * Split the dump according to configuration
   */
  async split(options: SplitOptions): Promise<{
    results: SplitResult[];
    stats: SplitStats;
    unmatchedTools: Tool[];
  }> {
    // Load MCP description and config
    await this.loadMcpDescription(options.mcpdescPath);
    await this.loadConfig(options.configPath);

    const results: SplitResult[] = [];
    const matchedToolsByCategory = new Map<string, Tool[]>();
    const toolMatchCounts = new Map<string, string[]>(); // Tool name -> categories matched
    const unmatchedTools: Tool[] = [];

    // Initialize category arrays
    for (const category of this.config.categories) {
      matchedToolsByCategory.set(category.name, []);
    }

    // Process each tool
    for (const tool of this.dump.tools || []) {
      const matchingCategories = this.findMatchingCategories(tool);

      if (matchingCategories.length === 0) {
        // No matches
        unmatchedTools.push(tool);
      } else {
        // Track matches
        for (const category of matchingCategories) {
          matchedToolsByCategory.get(category.name)!.push(tool);
        }

        // Track multiple matches for stats
        if (matchingCategories.length > 1) {
          toolMatchCounts.set(
            tool.name,
            matchingCategories.map(c => c.name)
          );
        }
      }
    }

    // Create output dumps for each category
    for (const category of this.config.categories) {
      const matchedTools = matchedToolsByCategory.get(category.name)!;

      const filteredDump = this.createFilteredDump(
        category,
        matchedTools,
        options.mcpdescPath,
        options.configPath
      );

      results.push({
        category: category.name,
        outputFile: category.outputFile,
        matchedTools: matchedTools.length,
        dump: filteredDump,
      });

      // Update stats
      this.stats.categories.push({
        name: category.name,
        matchedTools: matchedTools.length,
      });
    }

    // Calculate stats
    const uniqueMatchedTools = new Set<string>();
    for (const tools of matchedToolsByCategory.values()) {
      for (const tool of tools) {
        uniqueMatchedTools.add(tool.name);
      }
    }

    this.stats.matchedTools = uniqueMatchedTools.size;
    this.stats.unmatchedTools = unmatchedTools.length;
    this.stats.multipleMatches = Array.from(toolMatchCounts.entries()).map(
      ([toolName, categories]) => ({ toolName, categories })
    );

    // Handle unmatched items if configured
    if (options.includeUnmatched && unmatchedTools.length > 0) {
      const unmatchedConfig = this.config.unmatchedItems;
      
      if (unmatchedConfig?.action === 'separate-file' && unmatchedConfig.outputFile) {
        const unmatchedDump: ContractDump = {
          version: this.dump.version, // Internal model field; dropped on mcpdesc output
          dumpDetails: {
            ...this.dump.dumpDetails,
            // Keep original description unchanged - split info is in splitOperation
            dumpExecution: {
              ...this.dump.dumpDetails.dumpExecution,
              splitOperation: {
                toolName: 'mcpcontract',
                toolVersion: '0.24.0',
                createdAt: new Date().toISOString(),
                splitConfig: {
                  sourceFile: basename(options.mcpdescPath),
                  category: 'unmatched',
                  configFile: basename(options.configPath),
                },
                splitExecution: {
                  originalCounts: {
                    tools: this.dump.tools?.length || 0,
                    prompts: this.dump.prompts?.length || 0,
                    resources: this.dump.resources?.length || 0,
                    resourceTemplates: this.dump.resourceTemplates?.length || 0,
                  },
                  filteredCounts: {
                    tools: unmatchedTools.length,
                    prompts: 0,
                    resources: 0,
                    resourceTemplates: 0,
                  },
                  filterRules: [],
                },
              },
            },
          },
          serverInfo: this.dump.serverInfo,
          tools: unmatchedTools,
          resources: [],
          resourceTemplates: [],
          prompts: [],
        };

        if (this.dump.roots) {
          unmatchedDump.roots = this.dump.roots;
        }

        results.push({
          category: 'unmatched',
          outputFile: unmatchedConfig.outputFile,
          matchedTools: unmatchedTools.length,
          dump: unmatchedDump,
        });
      }
    }

    return {
      results,
      stats: this.stats,
      unmatchedTools,
    };
  }

  /**
   * Get statistics about the split operation
   */
  getStats(): SplitStats {
    return this.stats;
  }
}
