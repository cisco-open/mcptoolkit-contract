// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Unit tests for Splitter
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { Splitter } from '../../src/lib/splitter.js';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES_DIR = resolve(__dirname, '../fixtures/split');

describe('Splitter', () => {
  let splitter: Splitter;

  beforeEach(() => {
    splitter = new Splitter();
  });

  describe('loadMcpDescription', () => {
    it('should load a valid JSON dump file', async () => {
      const mcpdescPath = resolve(FIXTURES_DIR, 'test-federation-dump.json');
      const dump = await splitter.loadMcpDescription(mcpdescPath);

      expect(dump).toBeDefined();
      expect(dump.tools).toHaveLength(8);
      expect(dump.serverInfo.name).toBe('test-federation-server');
    });

    it('should throw error for invalid dump file', async () => {
      const invalidPath = resolve(FIXTURES_DIR, 'nonexistent.json');
      
      await expect(splitter.loadMcpDescription(invalidPath)).rejects.toThrow();
    });
  });

  describe('loadConfig', () => {
    it('should load a valid YAML config file', async () => {
      const configPath = resolve(FIXTURES_DIR, 'split-config-basic.yaml');
      const config = await splitter.loadConfig(configPath);

      expect(config).toBeDefined();
      expect(config.categories).toHaveLength(2);
      expect(config.categories[0].name).toBe('platform-identity');
    });

    it('should throw error for invalid regex pattern', async () => {
      const configPath = resolve(FIXTURES_DIR, 'split-config-invalid-regex.yaml');
      
      await expect(splitter.loadConfig(configPath)).rejects.toThrow(/Invalid regex pattern/);
    });
  });

  describe('split', () => {
    it('should split dump into multiple categories', async () => {
      const mcpdescPath = resolve(FIXTURES_DIR, 'test-federation-dump.json');
      const configPath = resolve(FIXTURES_DIR, 'split-config-basic.yaml');

      const { results, stats } = await splitter.split({
        mcpdescPath,
        configPath,
        includeUnmatched: true,
      });

      // Should have 2 main categories + unmatched
      expect(results).toHaveLength(3);

      // Check platform-identity category
      const platformIdentity = results.find(r => r.category === 'platform-identity');
      expect(platformIdentity).toBeDefined();
      expect(platformIdentity!.matchedTools).toBe(3);
      expect(platformIdentity!.dump.tools).toHaveLength(3);
      expect(platformIdentity!.dump.tools.every(t => t.name.startsWith('platform-identity_'))).toBe(true);

      // Check secure-access-networks category
      const secureAccess = results.find(r => r.category === 'secure-access-networks');
      expect(secureAccess).toBeDefined();
      expect(secureAccess!.matchedTools).toBe(3);
      expect(secureAccess!.dump.tools).toHaveLength(3);
      expect(secureAccess!.dump.tools.every(t => t.name.startsWith('secure-access-networks_'))).toBe(true);

      // Check unmatched category
      const unmatched = results.find(r => r.category === 'unmatched');
      expect(unmatched).toBeDefined();
      expect(unmatched!.matchedTools).toBe(2);

      // Check stats
      expect(stats.totalTools).toBe(8);
      expect(stats.matchedTools).toBe(6);
      expect(stats.unmatchedTools).toBe(2);
    });

    it('should preserve dump metadata in split outputs', async () => {
      const mcpdescPath = resolve(FIXTURES_DIR, 'test-federation-dump.json');
      const configPath = resolve(FIXTURES_DIR, 'split-config-basic.yaml');

      const { results } = await splitter.split({
        mcpdescPath,
        configPath,
      });

      for (const result of results) {
        // Check splitOperation is present in dumpExecution
        expect(result.dump.dumpDetails.dumpExecution.splitOperation).toBeDefined();
        const splitOp = result.dump.dumpDetails.dumpExecution.splitOperation!;
        
        // Check split tool identification
        expect(splitOp.toolName).toBe('mcpcontract');
        expect(splitOp.toolVersion).toBeDefined();
        expect(splitOp.toolVersion).toMatch(/^\d+\.\d+\.\d+$/); // Semantic version format
        expect(splitOp.createdAt).toBeDefined();
        
        // Check split configuration
        expect(splitOp.splitConfig.sourceFile).toBe('test-federation-dump.json');
        expect(splitOp.splitConfig.category).toBe(result.category);
        expect(splitOp.splitConfig.configFile).toBe('split-config-basic.yaml');
        expect(splitOp.splitConfig.schemaVersion).toBeDefined();
        
        // Check split execution details
        expect(splitOp.splitExecution.originalCounts.tools).toBe(8);
        expect(splitOp.splitExecution.filteredCounts.tools).toBe(result.matchedTools);
        expect(splitOp.splitExecution.filterRules).toBeDefined();

        // Check original serverInfo is preserved
        expect(result.dump.serverInfo.name).toBe('test-federation-server');
        expect(result.dump.serverInfo.version).toBe('1.0.0');
        
        // Check original dumpExecution fields are preserved
        expect(result.dump.dumpDetails.dumpExecution.mcpProtocolUsed).toBe('2025-06-18');
      }
    });

    it('should handle no matches correctly', async () => {
      const mcpdescPath = resolve(FIXTURES_DIR, 'test-federation-dump.json');
      const configPath = resolve(FIXTURES_DIR, 'split-config-no-matches.yaml');

      const { results, stats } = await splitter.split({
        mcpdescPath,
        configPath,
      });

      expect(results).toHaveLength(1);
      expect(results[0].matchedTools).toBe(0);
      expect(stats.matchedTools).toBe(0);
      expect(stats.unmatchedTools).toBe(8);
    });

    it('should track multiple matches correctly', async () => {
      // Create a config where tools can match multiple categories
      const mcpdescPath = resolve(FIXTURES_DIR, 'test-federation-dump.json');
      
      // Load and modify config to create overlaps
      const configContent = `
schemaVersion: https://developer.cisco.com/mcpcontract/schema/dump-split/1.0.0
info:
  version: "1.0.0"
  name: "Overlap test"
categories:
  - name: "all-platform"
    outputFile: "dump-all-platform"
    filters:
      tools:
        - type: "name-pattern"
          pattern: "^platform-"
  - name: "identity-tools"
    outputFile: "dump-identity"
    filters:
      tools:
        - type: "name-pattern"
          pattern: "_.*[Ss]ubscription"
`;
      
      // Write temporary config
      const tmpConfigPath = resolve(FIXTURES_DIR, 'split-config-overlap.yaml');
      const { writeFile } = await import('node:fs/promises');
      await writeFile(tmpConfigPath, configContent);

      const { stats } = await splitter.split({
        mcpdescPath,
        configPath: tmpConfigPath,
      });

      // Should have some multiple matches
      expect(stats.multipleMatches.length).toBeGreaterThan(0);

      // Cleanup
      const { unlink } = await import('node:fs/promises');
      await unlink(tmpConfigPath);
    });

    it('should set empty arrays for non-tool capabilities (Phase 1)', async () => {
      const mcpdescPath = resolve(FIXTURES_DIR, 'test-federation-dump.json');
      const configPath = resolve(FIXTURES_DIR, 'split-config-basic.yaml');

      const { results } = await splitter.split({
        mcpdescPath,
        configPath,
      });

      for (const result of results) {
        // Phase 1: prompts, resources, resourceTemplates should be empty
        expect(result.dump.prompts).toEqual([]);
        expect(result.dump.resources).toEqual([]);
        expect(result.dump.resourceTemplates).toEqual([]);
      }
    });
  });

  describe('regex pattern matching', () => {
    it('should match exact prefixes', async () => {
      const mcpdescPath = resolve(FIXTURES_DIR, 'test-federation-dump.json');
      const configPath = resolve(FIXTURES_DIR, 'split-config-basic.yaml');

      const { results } = await splitter.split({
        mcpdescPath,
        configPath,
      });

      const platformTools = results.find(r => r.category === 'platform-identity')!.dump.tools;
      
      expect(platformTools.some(t => t.name === 'platform-identity_getSubscription')).toBe(true);
      expect(platformTools.some(t => t.name === 'platform-identity_listSubscriptions')).toBe(true);
      expect(platformTools.some(t => t.name === 'platform-identity_updateSubscription')).toBe(true);
    });

    it('should not match tools without the prefix', async () => {
      const mcpdescPath = resolve(FIXTURES_DIR, 'test-federation-dump.json');
      const configPath = resolve(FIXTURES_DIR, 'split-config-basic.yaml');

      const { results } = await splitter.split({
        mcpdescPath,
        configPath,
      });

      const platformTools = results.find(r => r.category === 'platform-identity')!.dump.tools;
      
      // These should NOT be in platform-identity
      expect(platformTools.some(t => t.name === 'secure-access-networks_jwtLogin')).toBe(false);
      expect(platformTools.some(t => t.name === 'other-service_doSomething')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty tools array', async () => {
      // Create a dump with no tools
      const emptyDumpContent = {
        version: "https://developer.cisco.com/mcp_contract_dump/schema/0.3.1",
        dumpDetails: {
          toolName: "mcpcontract",
          toolVersion: "0.13.1",
          description: "Empty dump",
          createdAt: "2025-12-15T10:00:00.000Z",
          mcpServerConfig: { name: "test", transport: "sse" },
          dumpExecution: { mcpProtocolUsed: "2025-06-18" }
        },
        serverInfo: {
          name: "empty-server",
          version: "1.0.0",
          protocolVersion: "2025-06-18",
          capabilities: {}
        },
        tools: [],
        resources: [],
        resourceTemplates: [],
        prompts: []
      };

      const tmpMcpdescPath = resolve(FIXTURES_DIR, 'empty-dump.json');
      const { writeFile } = await import('node:fs/promises');
      await writeFile(tmpMcpdescPath, JSON.stringify(emptyDumpContent));

      const configPath = resolve(FIXTURES_DIR, 'split-config-basic.yaml');

      const { stats } = await splitter.split({
        mcpdescPath: tmpMcpdescPath,
        configPath,
      });

      expect(stats.totalTools).toBe(0);
      expect(stats.matchedTools).toBe(0);
      
      // Cleanup
      const { unlink } = await import('node:fs/promises');
      await unlink(tmpMcpdescPath);
    });

    it('should handle category with no filters', async () => {
      const configContent = `
schemaVersion: https://developer.cisco.com/mcpcontract/schema/dump-split/1.0.0
info:
  version: "1.0.0"
  name: "No filters test"
categories:
  - name: "empty-category"
    outputFile: "dump-empty"
    filters: {}
`;
      
      const tmpConfigPath = resolve(FIXTURES_DIR, 'split-config-no-filters.yaml');
      const { writeFile } = await import('node:fs/promises');
      await writeFile(tmpConfigPath, configContent);

      const mcpdescPath = resolve(FIXTURES_DIR, 'test-federation-dump.json');

      const { results, stats } = await splitter.split({
        mcpdescPath,
        configPath: tmpConfigPath,
      });

      expect(results[0].matchedTools).toBe(0);
      expect(stats).toBeDefined();

      // Cleanup
      const { unlink } = await import('node:fs/promises');
      await unlink(tmpConfigPath);
    });
  });
});
