// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Unit tests for mcpdesc-converter — tag handling
 */

import { describe, it, expect } from '@jest/globals';
import {
  contractDumpToMcpDescription,
  mcpDescriptionToContractDump,
  applyEnrichment,
  McpDescTag,
} from '../../src/lib/mcpdesc-converter.js';
import type { ContractDump } from '../../src/lib/types.js';

// Minimal valid dump for conversion tests
function minimalDump(overrides: Partial<ContractDump> = {}): ContractDump {
  return {
    version: '0.3.8',
    dumpDetails: {
      toolName: 'test',
      toolVersion: '1.0.0',
      createdAt: '2026-03-23T00:00:00Z',
      mcpServerConfig: {
        transport: 'stdio',
        command: 'node',
        args: ['server.js'],
      },
      dumpExecution: {
        mcpProtocolUsed: '2025-06-18',
      },
    },
    serverInfo: {
      name: 'test-server',
      version: '1.0.0',
      protocolVersion: '2025-06-18',
      capabilities: { tools: {} },
    },
    tools: [
      { name: 'tool_a', description: 'Tool A', inputSchema: { type: 'object' } },
    ],
    resources: [],
    resourceTemplates: [],
    prompts: [],
    ...overrides,
  } as ContractDump;
}

describe('mcpdesc-converter tags', () => {
  describe('McpDescTag interface (v0.7.0 flat tags)', () => {
    it('should accept flat tags without nested tags property', () => {
      const tag: McpDescTag = { name: 'api', description: 'API operations' };
      expect(tag.name).toBe('api');
      expect(tag.description).toBe('API operations');
      // v0.7.0: no 'tags' property on McpDescTag
      expect('tags' in tag).toBe(false);
    });

    it('should not allow nested tags property on McpDescTag', () => {
      // TypeScript compile-time check: McpDescTag should NOT have a tags field
      const tag: McpDescTag = { name: 'parent' };
      const keys = Object.keys(tag);
      expect(keys).not.toContain('tags');
    });
  });

  describe('contractDumpToMcpDescription', () => {
    it('should set mcpdesc version to 0.7.0', () => {
      const dump = minimalDump();
      const doc = contractDumpToMcpDescription(dump);
      expect(doc.mcpdesc).toBe('0.7.0');
    });

    it('should not include root tags when dump has none', () => {
      const dump = minimalDump();
      const doc = contractDumpToMcpDescription(dump);
      expect(doc.tags).toBeUndefined();
    });
  });

  describe('applyEnrichment with flat tags', () => {
    it('should apply flat tags from enrichment info', () => {
      const dump = minimalDump();
      const doc = contractDumpToMcpDescription(dump);

      const enriched = applyEnrichment(doc, {
        tags: [
          { name: 'search', description: 'Search operations' },
          { name: 'analysis', description: 'Analysis tools' },
        ],
      });

      expect(enriched.tags).toHaveLength(2);
      expect(enriched.tags![0].name).toBe('search');
      expect(enriched.tags![1].name).toBe('analysis');
      // Verify flat structure — no nested tags property
      expect((enriched.tags![0] as any).tags).toBeUndefined();
    });

    it('should not overwrite tags with empty array', () => {
      const dump = minimalDump();
      const doc = contractDumpToMcpDescription(dump);
      doc.tags = [{ name: 'existing' }];

      const enriched = applyEnrichment(doc, { tags: [] });
      expect(enriched.tags).toHaveLength(1);
      expect(enriched.tags![0].name).toBe('existing');
    });
  });

  describe('round-trip conversion preserves per-entity tags', () => {
    it('should preserve tool-level string tags through round-trip', () => {
      const dump = minimalDump({
        tools: [
          {
            name: 'search_docs',
            description: 'Search documents',
            tags: ['search', 'documents'],
            inputSchema: { type: 'object' },
          } as any,
        ],
      });

      const doc = contractDumpToMcpDescription(dump);
      expect(doc.tools![0]).toHaveProperty('tags', ['search', 'documents']);

      const restored = mcpDescriptionToContractDump(doc);
      expect(restored.tools[0]).toHaveProperty('tags', ['search', 'documents']);
    });
  });
});
