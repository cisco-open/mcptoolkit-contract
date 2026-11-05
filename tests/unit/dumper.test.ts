// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { ContractDumper } from '../../src/lib/dumper.js';
import { dumpCommand } from '../../src/commands/dump.js';
import type { MCPClient } from '../../src/lib/client.js';
import type { ContractDump, PaginationResult, ServerConfig } from '../../src/lib/types.js';

const emptyPage = <T>(): PaginationResult<T> => ({
  items: [],
  paginationDetected: false,
  pagesRetrieved: 0,
  totalItems: 0,
});

describe('ContractDumper', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    [[], '0.8.0', '0.8.0'],
    [['--to-version', '0.9.0'], '0.9.0', '0.9.0-rc.1'],
    [['--to-version', '0.9.0', '--selector', '0.9.0-draft.4'], '0.9.0', '0.9.0-draft.4'],
  ] as const)('generates the requested output with flags %j', async (flags, version, selector) => {
    jest.spyOn(ContractDumper.prototype, 'dump').mockResolvedValue({
      version: '0.3.8',
      dumpDetails: {
        toolName: 'test', toolVersion: '1.0.0', createdAt: '2026-11-05T00:00:00Z',
        mcpServerConfig: { transport: 'stdio', command: 'server' }, dumpExecution: {},
      },
      serverInfo: { name: 'capture-test', version: '1.0.0', protocolVersion: '2026-07-28', capabilities: { tools: {} } },
      tools: [{ name: 'lookup', inputSchema: { type: 'object' } }], resources: [], resourceTemplates: [], prompts: [],
    } as ContractDump);
    const output = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const exit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    await dumpCommand().parseAsync(['--transport', 'stdio', '--command', 'server', '--quiet', ...flags], { from: 'user' });
    expect(exit).toHaveBeenCalledWith(0);
    expect(JSON.parse(output.mock.calls[0][0])).toMatchObject({
      mcpdesc: version, $schema: `https://mcpdesc.org/schema/mcp-description/${selector}.json`,
    });
  });

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