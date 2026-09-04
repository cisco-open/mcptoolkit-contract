// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from '@jest/globals';
import { ContractDumper } from '../../src/lib/dumper.js';
import type { MCPClient } from '../../src/lib/client.js';
import type { PaginationResult, ServerConfig } from '../../src/lib/types.js';

const emptyPage = <T>(): PaginationResult<T> => ({
  items: [],
  paginationDetected: false,
  pagesRetrieved: 0,
  totalItems: 0,
});

describe('ContractDumper', () => {
  it('uses the canonical session header when raw header inspection is unavailable', async () => {
    const config: ServerConfig = {
      name: 'miro',
      transport: {
        type: 'streamable-http',
        url: 'https://mcp.miro.com/',
      },
    };
    const dumper = new ContractDumper(config);
    const client = {
      connect: async () => undefined,
      initialize: async () => ({
        name: 'miro',
        version: '1.0.0',
        protocolVersion: '2025-06-18',
        capabilities: {},
      }),
      getProtocolEra: () => 'modern' as const,
      getClientCapabilities: () => ({}),
      getSessionId: () => 'session-id',
      getSessionIdHeader: () => undefined,
      getOptions: () => ({ skipCorsCheck: true }),
      listToolsComplete: async () => emptyPage(),
      listResourcesComplete: async () => emptyPage(),
      listResourceTemplatesComplete: async () => emptyPage(),
      listPromptsComplete: async () => emptyPage(),
      listRoots: async () => [],
      close: async () => undefined,
    } as unknown as MCPClient;

    (dumper as unknown as { client: MCPClient }).client = client;

    const dump = await dumper.dump();

    expect(dump.dumpDetails.dumpExecution.sessionIdSupported).toBe(true);
    expect(dump.dumpDetails.dumpExecution.sessionIdHeader).toBe('Mcp-Session-Id');
  });
});