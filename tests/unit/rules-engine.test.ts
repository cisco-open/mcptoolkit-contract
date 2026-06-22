// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Manual Unit Tests for RulesEngine
 * 
 * Tests the core rules engine functionality including:
 * - Condition operators (equals, contains, hasAdditions, etc.)
 * - Rule matching logic
 * - Variant selection
 * - Breaking change classification
 */

import { describe, it, expect } from '@jest/globals';
import { RulesEngine } from '../../src/lib/rules-engine.js';
import type { Change } from '../../src/lib/differ.js';

describe('RulesEngine', () => {
  const engine = new RulesEngine('rules/breaking-changes.yaml');

  describe('Condition Operators', () => {
    it('should evaluate onlyAdditions operator correctly', () => {
      const change: Change = {
        id: 'test-1',
        category: 'tools',
        changeType: 'parameter-enum-values-changed',
        path: 'tools[test].param.enum',
        description: 'Test enum addition',
        from: { enum: ['a', 'b'] },
        to: { enum: ['a', 'b', 'c'] },
      };

      const results = engine.applyRules([change]);
      expect(results[0].breaking).toBe(false);
      expect(results[0].severity).toBe('info');
    });

    it('should evaluate hasRemovals operator correctly', () => {
      const change: Change = {
        id: 'test-2',
        category: 'tools',
        changeType: 'parameter-enum-values-changed',
        path: 'tools[test].param.enum',
        description: 'Test enum removal',
        from: { enum: ['a', 'b', 'c'] },
        to: { enum: ['a', 'b'] },
      };

      const results = engine.applyRules([change]);
      expect(results[0].breaking).toBe(true);
      expect(results[0].severity).toBe('critical');
    });

    it('should detect mixed additions and removals as breaking', () => {
      const change: Change = {
        id: 'test-3',
        category: 'tools',
        changeType: 'parameter-enum-values-changed',
        path: 'tools[test].param.enum',
        description: 'Test enum replacement',
        from: { enum: ['a', 'b'] },
        to: { enum: ['c', 'd'] },
      };

      const results = engine.applyRules([change]);
      expect(results[0].breaking).toBe(true);
      expect(results[0].severity).toBe('critical');
    });
  });

  describe('Rule Matching', () => {
    it('should match simple rules without conditions', () => {
      const change: Change = {
        id: 'test-4',
        category: 'tools',
        changeType: 'tool-removed',
        path: 'tools[test]',
        description: 'Test tool removal',
        from: { name: 'test' },
        to: null,
      };

      const results = engine.applyRules([change]);
      expect(results[0].breaking).toBe(true);
      expect(results[0].severity).toBe('critical');
      expect(results[0].ruleMessage).toBeDefined();
    });

    it('should match tool-added as compatible', () => {
      const change: Change = {
        id: 'test-5',
        category: 'tools',
        changeType: 'tool-added',
        path: 'tools[newTool]',
        description: 'Test tool addition',
        from: null,
        to: { name: 'newTool' },
      };

      const results = engine.applyRules([change]);
      expect(results[0].breaking).toBe(false);
      expect(results[0].severity).toBe('info');
    });
  });

  describe('Variant Selection', () => {
    it('should select correct variant based on conditions - optional parameter', () => {
      const change: Change = {
        id: 'test-6',
        category: 'tools',
        changeType: 'parameter-added',
        path: 'tools[test].params.newParam',
        description: 'Test optional parameter addition',
        from: null,
        to: { required: false, type: 'string' },
      };

      const results = engine.applyRules([change]);
      expect(results[0].breaking).toBe(false);
      expect(results[0].severity).toBe('info');
    });

    it('should select correct variant based on conditions - required parameter', () => {
      const change: Change = {
        id: 'test-7',
        category: 'tools',
        changeType: 'parameter-added',
        path: 'tools[test].params.newParam',
        description: 'Test required parameter addition',
        from: null,
        to: { required: true, type: 'string' },
      };

      const results = engine.applyRules([change]);
      expect(results[0].breaking).toBe(true);
      expect(results[0].severity).toBe('critical');
    });
  });

  describe('Multiple Changes', () => {
    it('should process multiple changes correctly', () => {
      const changes: Change[] = [
        {
          id: 'test-8',
          category: 'tools',
          changeType: 'tool-added',
          path: 'tools[newTool]',
          description: 'Add new tool',
          from: null,
          to: { name: 'newTool' },
        },
        {
          id: 'test-9',
          category: 'tools',
          changeType: 'tool-removed',
          path: 'tools[oldTool]',
          description: 'Remove old tool',
          from: { name: 'oldTool' },
          to: null,
        },
      ];

      const results = engine.applyRules(changes);
      expect(results).toHaveLength(2);
      expect(results[0].breaking).toBe(false); // tool-added
      expect(results[1].breaking).toBe(true);  // tool-removed
    });
  });

  describe('Prompt Rules', () => {
    it('should classify prompt additions as compatible', () => {
      const change: Change = {
        id: 'test-10',
        category: 'prompts',
        changeType: 'prompt-added',
        path: 'prompts[newPrompt]',
        description: 'Add new prompt',
        from: null,
        to: { name: 'newPrompt' },
      };

      const results = engine.applyRules([change]);
      expect(results[0].breaking).toBe(false);
    });

    it('should classify prompt removals as breaking', () => {
      const change: Change = {
        id: 'test-11',
        category: 'prompts',
        changeType: 'prompt-removed',
        path: 'prompts[oldPrompt]',
        description: 'Remove prompt',
        from: { name: 'oldPrompt' },
        to: null,
      };

      const results = engine.applyRules([change]);
      expect(results[0].breaking).toBe(true);
    });
  });

  describe('Resource Rules', () => {
    it('should classify resource additions as compatible', () => {
      const change: Change = {
        id: 'test-12',
        category: 'resources',
        changeType: 'resource-added',
        path: 'resources[newResource]',
        description: 'Add new resource',
        from: null,
        to: { uri: 'file://test' },
      };

      const results = engine.applyRules([change]);
      expect(results[0].breaking).toBe(false);
    });

    it('should classify resource removals as breaking', () => {
      const change: Change = {
        id: 'test-13',
        category: 'resources',
        changeType: 'resource-removed',
        path: 'resources[oldResource]',
        description: 'Remove resource',
        from: { uri: 'file://test' },
        to: null,
      };

      const results = engine.applyRules([change]);
      expect(results[0].breaking).toBe(true);
    });
  });

  describe('ServerInfo Rules', () => {
    it('should classify capability additions as compatible', () => {
      const change: Change = {
        id: 'test-14',
        category: 'serverInfo',
        changeType: 'capability-added',
        path: 'serverInfo.capabilities.newCapability',
        description: 'Add new capability',
        from: null,
        to: { enabled: true },
      };

      const results = engine.applyRules([change]);
      expect(results[0].breaking).toBe(false);
    });

    it('should classify capability removals as breaking', () => {
      const change: Change = {
        id: 'test-15',
        category: 'serverInfo',
        changeType: 'capability-removed',
        path: 'serverInfo.capabilities.oldCapability',
        description: 'Remove capability',
        from: { enabled: true },
        to: null,
      };

      const results = engine.applyRules([change]);
      expect(results[0].breaking).toBe(true);
    });
  });

  describe('Unknown Changes', () => {
    it('should handle unknown change types gracefully', () => {
      const change: Change = {
        id: 'test-16',
        category: 'tools',
        changeType: 'unknown-change-type',
        path: 'tools[test]',
        description: 'Unknown change',
        from: null,
        to: null,
      };

      const results = engine.applyRules([change]);
      expect(results).toHaveLength(1);
      // Unknown changes get default heuristic: breaking=true for non-additions/non-descriptions
      expect(results[0].breaking).toBe(true);
      expect(results[0].ruleMessage).toContain('No specific rule found');
    });
  });

  describe('Capability Name Extraction', () => {
    it('should extract names from bracket notation correctly', () => {
      const change: Change = {
        id: 'test-bracket-1',
        category: 'resources',
        changeType: 'resource-added',
        path: 'resources[ai-defense-management-api.json]',
        description: 'Resource with .json extension',
        from: null,
        to: {
          name: 'ai-defense-management-api.json',
          uri: 'openapi://uuid',
          mimeType: 'application/json'
        },
      };

      const results = engine.applyRules([change]);
      expect(results[0].details?.what).toContain('ai-defense-management-api.json');
      expect(results[0].details?.what).not.toContain('json]');
    });

    it('should extract names with URI schemes correctly', () => {
      const change: Change = {
        id: 'test-bracket-2',
        category: 'resources',
        changeType: 'resource-added',
        path: 'resources[schema://API]',
        description: 'Resource with URI scheme',
        from: null,
        to: {
          name: 'schema://API',
          uri: 'schema://type/API',
          mimeType: 'application/json'
        },
      };

      const results = engine.applyRules([change]);
      expect(results[0].details?.what).toContain('schema://API');
    });

    it('should handle parameter paths with dots correctly', () => {
      // Test that parameter changes extract the last segment correctly
      const change: Change = {
        id: 'test-param',
        category: 'tools',
        changeType: 'parameter-type-changed',
        path: 'tools[search].inputSchema.properties.query.type',
        description: 'Parameter type changed',
        from: 'string',
        to: 'number',
      };

      const results = engine.applyRules([change]);
      // For parameter-type-changed, the message format includes the parameter name
      expect(results[0].details?.what).toBeDefined();
      // Should mention the tool name (search) not be corrupted
      expect(results[0].details?.what).not.toContain('type]');
    });

    it('should include MIME type in resource descriptions', () => {
      const change: Change = {
        id: 'test-mime',
        category: 'resources',
        changeType: 'resource-added',
        path: 'resources[openapi-spec]',
        description: 'Resource with MIME type',
        from: null,
        to: {
          name: 'openapi-spec',
          uri: 'openapi://uuid',
          mimeType: 'application/json'
        },
      };

      const results = engine.applyRules([change]);
      expect(results[0].details?.what).toContain('openapi-spec');
      expect(results[0].details?.what).toContain('(application/json)');
    });

    it('should handle resources without MIME type gracefully', () => {
      const change: Change = {
        id: 'test-no-mime',
        category: 'resources',
        changeType: 'resource-added',
        path: 'resources[documents]',
        description: 'Resource without MIME type',
        from: null,
        to: {
          name: 'documents',
          uri: 'documents://list'
        },
      };

      const results = engine.applyRules([change]);
      expect(results[0].details?.what).toContain('documents');
      expect(results[0].details?.what).not.toContain('(undefined)');
      expect(results[0].details?.what).not.toContain('(null)');
    });

    it('should handle tool names with hyphens correctly', () => {
      const change: Change = {
        id: 'test-tool',
        category: 'tools',
        changeType: 'tool-added',
        path: 'tools[search-inventory]',
        description: 'Tool with hyphenated name',
        from: null,
        to: {
          name: 'search-inventory',
          description: 'Search the inventory'
        },
      };

      const results = engine.applyRules([change]);
      expect(results[0].details?.what).toContain('search-inventory');
    });
  });
});
