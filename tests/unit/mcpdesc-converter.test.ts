// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Unit tests for mcpdesc-converter — tag handling
 */

import { describe, it, expect, jest } from '@jest/globals';
import { validateMcpDescription } from '@mcpdesc/validator';
import {
  contractDumpToMcpDescription,
  mcpDescriptionToContractDump,
  migrateMcpDescription07ToRc3,
  parseAsContractDump,
  applyEnrichment,
  McpDescTag,
  type McpDescDocument,
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

describe('mcpdesc-converter', () => {
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
    it('emits a valid RC.3 observed protocol view without vendor metadata', () => {
      const dump = minimalDump();
      dump.serverInfo.instructions = 'Use tool_a for test operations.';
      const doc = contractDumpToMcpDescription(dump);

      expect(doc).toMatchObject({
        $schema: 'https://mcpdesc.org/schema/mcp-description/0.8.0-rc.3.json',
        mcpdesc: '0.8.0',
        protocolVersions: ['2025-06-18'],
        instructions: 'Use tool_a for test operations.',
        capabilities: [{ tools: {} }],
      });
      expect(doc.info).not.toHaveProperty('protocolVersion');
      expect(doc).not.toHaveProperty('x-cisco-metadata');

      const validation = validateMcpDescription(doc, {
        specification: '0.8.0-rc.3',
      });
      expect(validation.diagnostics).toEqual([]);
      expect(validation.valid).toBe(true);
    });

    it('reports and omits server capabilities that MCP Description cannot represent', () => {
      const dump = minimalDump();
      dump.serverInfo.capabilities = {
        tools: {},
        extensions: { 'io.modelcontextprotocol/ui': {} },
        futureCapability: {},
        protocolVersions: ['2026-07-28'],
      } as typeof dump.serverInfo.capabilities;
      const onUnsupportedServerCapabilities = jest.fn();

      const doc = contractDumpToMcpDescription(dump, { onUnsupportedServerCapabilities });

      expect(doc.capabilities).toEqual([{
        tools: {},
        extensions: { 'io.modelcontextprotocol/ui': {} },
      }]);
      expect(onUnsupportedServerCapabilities).toHaveBeenCalledWith([
        'futureCapability',
        'protocolVersions',
      ]);
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

  describe('RC.2 protocol view projection', () => {
    const multiVersionDocument = {
      $schema: 'https://mcpdesc.org/schema/mcp-description/0.8.0-rc.2.json',
      mcpdesc: '0.8.0',
      info: { name: 'scoped-server', version: '1.0.0' },
      protocolVersions: ['2025-11-25', '2026-07-28'],
      tools: [
        {
          name: 'run_job',
          description: 'Legacy behavior',
          protocolVersions: ['2025-11-25'],
          inputSchema: { type: 'object' },
        },
        {
          name: 'run_job',
          description: 'Modern behavior',
          protocolVersions: ['2026-07-28'],
          inputSchema: { type: 'object' },
        },
      ],
    };

    it('requires an explicit selection for a multi-version document', () => {
      expect(() => parseAsContractDump(multiVersionDocument)).toThrow(
        /select one with --protocol-version/
      );
    });

    it('retains only declarations effective for the selected protocol revision', () => {
      const dump = parseAsContractDump(multiVersionDocument, '2026-07-28');

      expect(dump.serverInfo.protocolVersion).toBe('2026-07-28');
      expect(dump.tools).toEqual([
        expect.objectContaining({
          name: 'run_job',
          description: 'Modern behavior',
        }),
      ]);
      expect(dump.tools[0]).not.toHaveProperty('protocolVersions');
    });
  });

  describe('MCP Description 0.7.0 migration', () => {
    const legacyDocument: McpDescDocument = {
      mcpdesc: '0.7.0',
      info: {
        name: 'legacy-server',
        version: '1.0.0',
        protocolVersion: '2025-11-25',
      },
      transports: [{ type: 'stdio', command: 'legacy-server' }],
      capabilities: { tools: { listChanged: true } },
      tools: [{ name: 'search', inputSchema: { type: 'object' } }],
    };

    it('validates the legacy source and delegates migration to core', async () => {
      const result = await migrateMcpDescription07ToRc3(legacyDocument, 'legacy.json');

      expect(result.document).toMatchObject({
        $schema: 'https://mcpdesc.org/schema/mcp-description/0.8.0-rc.3.json',
        mcpdesc: '0.8.0',
        protocolVersions: ['2025-11-25'],
        capabilities: [{ tools: { listChanged: true } }],
      });
      expect(result.document.info).not.toHaveProperty('protocolVersion');
      expect(legacyDocument.info).toHaveProperty('protocolVersion', '2025-11-25');
    });

    it('rejects a legacy source that does not satisfy the frozen schema', async () => {
      const invalid = {
        ...legacyDocument,
        info: { ...legacyDocument.info, name: '' },
      };

      await expect(migrateMcpDescription07ToRc3(invalid, 'invalid.json')).rejects.toThrow(
        /0\.7\.0 validation failed/
      );
    });
  });
});
