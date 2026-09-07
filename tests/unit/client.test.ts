// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { MCPClient } from '../../src/lib/client.js';
import type { ServerConfig } from '../../src/lib/types.js';

const config: ServerConfig = {
  name: 'test-server',
  transport: {
    type: 'stdio',
    command: 'test-server'
  }
};

describe('MCPClient capability handling', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not call prompts/list when the server does not advertise prompts', async () => {
    const client = new MCPClient(config);
    const listPrompts = jest.fn();
    (client as any).client = {
      getServerCapabilities: () => ({}),
      listPrompts
    };

    await expect(client.listPromptsComplete()).resolves.toEqual({
      items: [],
      paginationDetected: false,
      pagesRetrieved: 0,
      totalItems: 0
    });
    expect(listPrompts).not.toHaveBeenCalled();
  });

  it('reports the skipped prompts request only in verbose mode', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const client = new MCPClient(config, { verbose: true });
    (client as any).client = {
      getServerCapabilities: () => ({})
    };

    await client.listPromptsComplete();

    expect(consoleSpy).toHaveBeenCalledWith(
      '[VERBOSE] Server does not advertise prompts capability; skipping prompts/list'
    );
  });
});