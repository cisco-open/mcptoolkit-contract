// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Integration Tests for Full Workflow
 * 
 * Tests the complete workflow:
 * 1. diff: Compare two capability dumps
 * 2. breaking: Analyze diff for breaking changes
 * 3. changelog: Generate human-readable changelog
 */

import { describe, it, expect } from '@jest/globals';
import { Differ } from '../../src/lib/differ.js';
import { RulesEngine } from '../../src/lib/rules-engine.js';

describe('Full Workflow Integration Tests', () => {
  
  // Test dumps (we'll create these)
  const dump1 = {
    schemaVersion: '1.0.0',
    serverInfo: {
      name: 'test-server',
      version: '1.0.0'
    },
    capabilities: {
      tools: {}
    },
    tools: [
      {
        name: 'get_weather',
        description: 'Get weather information',
        inputSchema: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'City name'
            },
            units: {
              type: 'string',
              enum: ['celsius', 'fahrenheit'],
              description: 'Temperature units'
            }
          },
          required: ['location']
        }
      }
    ],
    prompts: [],
    resources: [],
    resourceTemplates: []
  };

  const dump2 = {
    schemaVersion: '1.0.0',
    serverInfo: {
      name: 'test-server',
      version: '2.0.0'
    },
    capabilities: {
      tools: {}
    },
    tools: [
      {
        name: 'get_weather',
        description: 'Get weather information with enhanced features',
        inputSchema: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'City name or coordinates'
            },
            units: {
              type: 'string',
              enum: ['celsius', 'fahrenheit', 'kelvin'], // Added kelvin
              description: 'Temperature units'
            },
            forecast_days: { // New optional parameter
              type: 'number',
              description: 'Number of forecast days'
            }
          },
          required: ['location'] // Same requirements
        }
      },
      {
        name: 'get_forecast', // New tool
        description: 'Get extended weather forecast',
        inputSchema: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'City name'
            }
          },
          required: ['location']
        }
      }
    ],
    prompts: [],
    resources: [],
    resourceTemplates: []
  };

  describe('Diff Generation', () => {
    it('should detect all changes between dumps', async () => {
      const differ = new Differ();
      const result = await differ.compare(dump1, dump2, 'v1.0.0', 'v2.0.0');

      expect(result.changes).toBeDefined();
      expect(result.changes.length).toBeGreaterThan(0);

      // Should detect: tool-added, tool-description-changed, parameter-added, parameter-enum-values-changed, parameter-description-changed
      const changeTypes = result.changes.map(c => c.changeType);
      expect(changeTypes).toContain('tool-added');
      expect(changeTypes).toContain('tool-description-changed');
      expect(changeTypes).toContain('parameter-enum-values-changed');
    });

    it('should include metadata in diff result', async () => {
      const differ = new Differ();
      const result = await differ.compare(dump1, dump2, 'v1.0.0', 'v2.0.0');

      expect(result.schemaVersion).toBeDefined();
      expect(result.comparison).toBeDefined();
      expect(result.comparison.from.serverVersion).toBe('1.0.0');
      expect(result.comparison.to.serverVersion).toBe('2.0.0');
      
      // Test new metadata fields
      expect(result.metadata).toBeDefined();
      expect(result.metadata.old.name).toBe('test-server');
      expect(result.metadata.old.version).toBe('1.0.0');
      expect(result.metadata.new.name).toBe('test-server');
      expect(result.metadata.new.version).toBe('2.0.0');
    });

    it('should capture protocolVersion and capabilities in metadata', async () => {
      const dumpWithProtocol1 = {
        ...dump1,
        serverInfo: {
          ...dump1.serverInfo,
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            prompts: {}
          }
        }
      };

      const dumpWithProtocol2 = {
        ...dump2,
        serverInfo: {
          ...dump2.serverInfo,
          protocolVersion: '2024-12-01',
          capabilities: {
            tools: {},
            prompts: {},
            logging: {}
          }
        }
      };

      const differ = new Differ();
      const result = await differ.compare(dumpWithProtocol1, dumpWithProtocol2, 'v1.0.0', 'v2.0.0');

      // Check protocolVersion is captured
      expect(result.metadata.old.protocolVersion).toBe('2024-11-05');
      expect(result.metadata.new.protocolVersion).toBe('2024-12-01');

      // Check capabilities array is captured
      expect(result.metadata.old.capabilities).toEqual(['tools', 'prompts']);
      expect(result.metadata.new.capabilities).toEqual(['tools', 'prompts', 'logging']);
    });
  });

  describe('Breaking Change Analysis', () => {
    it('should analyze diff and classify changes correctly', async () => {
      const differ = new Differ();
      const diffResult = await differ.compare(dump1, dump2, 'v1.0.0', 'v2.0.0');

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const annotated = engine.applyRules(diffResult.changes);

      expect(annotated.length).toBeGreaterThan(0);

      // All changes should be compatible in this scenario
      const breakingChanges = annotated.filter(c => c.breaking);
      expect(breakingChanges.length).toBe(0);

      // Should have compatible changes
      const compatibleChanges = annotated.filter(c => !c.breaking);
      expect(compatibleChanges.length).toBeGreaterThan(0);
    });

    it('should detect breaking changes when tool is removed', async () => {
      const dump3 = {
        ...dump2,
        tools: [dump2.tools[1]] // Remove get_weather, keep get_forecast
      };

      const differ = new Differ();
      const diffResult = await differ.compare(dump1, dump3, 'v1.0.0', 'v3.0.0');

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const annotated = engine.applyRules(diffResult.changes);

      const breakingChanges = annotated.filter(c => c.breaking);
      expect(breakingChanges.length).toBeGreaterThan(0);

      const toolRemoval = breakingChanges.find(c => c.changeType === 'tool-removed');
      expect(toolRemoval).toBeDefined();
      expect(toolRemoval?.severity).toBe('critical');
    });

    it('should detect breaking changes when required parameter is added', async () => {
      const dump3 = {
        ...dump1,
        tools: [{
          ...dump1.tools[0],
          inputSchema: {
            ...dump1.tools[0].inputSchema,
            properties: {
              ...dump1.tools[0].inputSchema.properties,
              api_key: {
                type: 'string',
                description: 'API key'
              }
            },
            required: ['location', 'api_key'] // Added required parameter
          }
        }]
      };

      const differ = new Differ();
      const diffResult = await differ.compare(dump1, dump3, 'v1.0.0', 'v3.0.0');

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const annotated = engine.applyRules(diffResult.changes);

      const breakingChanges = annotated.filter(c => c.breaking);
      expect(breakingChanges.length).toBeGreaterThan(0);

      const reqParamAdded = breakingChanges.find(c => 
        c.changeType === 'parameter-added' && c.breaking
      );
      expect(reqParamAdded).toBeDefined();
    });
  });

  describe('End-to-End Workflow', () => {
    it('should complete full workflow: diff → analysis → summary', async () => {
      // Step 1: Generate diff
      const differ = new Differ();
      const diffResult = await differ.compare(dump1, dump2, 'v1.0.0', 'v2.0.0');

      expect(diffResult.changes.length).toBeGreaterThan(0);

      // Step 2: Analyze for breaking changes
      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const analysis = engine.analyze(diffResult, 'test', 'rules/breaking-changes.yaml');

      expect(analysis.summary).toBeDefined();
      expect(analysis.summary.totalChanges).toBeGreaterThan(0);
      expect(analysis.summary.status).toBe('BACKWARD_COMPATIBLE');
      expect(analysis.summary.exitCode).toBe(0);

      // Step 3: Verify all changes are annotated
      expect(analysis.changes.length).toBe(diffResult.changes.length);
      analysis.changes.forEach(change => {
        expect(change.breaking).toBeDefined();
        expect(change.severity).toBeDefined();
        expect(change.ruleMessage).toBeDefined();
      });
    });

    it('should handle breaking changes in full workflow', async () => {
      const dump3 = {
        ...dump1,
        tools: [] // Remove all tools - breaking!
      };

      // Step 1: Generate diff
      const differ = new Differ();
      const diffResult = await differ.compare(dump1, dump3, 'v1.0.0', 'v3.0.0');

      // Step 2: Analyze
      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const analysis = engine.analyze(diffResult, 'test', 'rules/breaking-changes.yaml');

      // Verify breaking status
      expect(analysis.summary.status).toBe('BREAKING_CHANGES');
      expect(analysis.summary.exitCode).toBe(1);
      expect(analysis.summary.breakingChanges).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty dumps', async () => {
      const emptyDump = {
        schemaVersion: '1.0.0',
        serverInfo: { name: 'test', version: '1.0.0' },
        capabilities: {},
        tools: [],
        prompts: [],
        resources: [],
        resourceTemplates: []
      };

      const differ = new Differ();
      const result = await differ.compare(emptyDump, emptyDump, 'v1.0.0', 'v1.0.0');

      expect(result.changes.length).toBe(0);
    });

    it('should handle dump with only additions', async () => {
      const emptyDump = {
        schemaVersion: '1.0.0',
        serverInfo: { name: 'test', version: '1.0.0' },
        capabilities: {},
        tools: [],
        prompts: [],
        resources: [],
        resourceTemplates: []
      };

      const differ = new Differ();
      const result = await differ.compare(emptyDump, dump1, 'v0.0.0', 'v1.0.0');

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const analysis = engine.analyze(result, 'test', 'rules/breaking-changes.yaml');

      // All additions should be compatible
      expect(analysis.summary.status).toBe('BACKWARD_COMPATIBLE');
      expect(analysis.summary.breakingChanges).toBe(0);
    });

    it('should handle dump with only removals', async () => {
      const emptyDump = {
        schemaVersion: '1.0.0',
        serverInfo: { name: 'test', version: '2.0.0' },
        capabilities: {},
        tools: [],
        prompts: [],
        resources: [],
        resourceTemplates: []
      };

      const differ = new Differ();
      const result = await differ.compare(dump1, emptyDump, 'v1.0.0', 'v2.0.0');

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const analysis = engine.analyze(result, 'test', 'rules/breaking-changes.yaml');

      // Removals should be breaking
      expect(analysis.summary.status).toBe('BREAKING_CHANGES');
      expect(analysis.summary.breakingChanges).toBeGreaterThan(0);
    });
  });
});
