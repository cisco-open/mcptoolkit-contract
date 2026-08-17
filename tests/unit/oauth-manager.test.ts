// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { createServer, type Server } from 'node:http';
import { OAuthManager } from '../../src/lib/oauth/manager.js';
import type { CLIOptions, ServerConfig } from '../../src/lib/types.js';
import {
  DEFAULT_OAUTH_CALLBACK_PATH,
  DEFAULT_OAUTH_CALLBACK_PORT
} from '../../src/lib/oauth/constants.js';

function createManager(options: CLIOptions = {}): OAuthManager {
  const config: ServerConfig = {
    name: 'test-server',
    transport: {
      type: 'streamable-http',
      url: 'https://api.example.com/mcp'
    }
  };

  return new OAuthManager(config, {
    auth: 'oauth',
    quiet: false,
    ...options
  });
}

async function listen(server: Server, port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

describe('OAuthManager callback handling', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses /oauth/callback as the default loopback redirect path', () => {
    const manager = createManager();

    expect((manager as any).resolveRedirectUri()).toBe(
      `http://127.0.0.1:${DEFAULT_OAUTH_CALLBACK_PORT}${DEFAULT_OAUTH_CALLBACK_PATH}`
    );
    expect((manager as any).resolveListenerPath()).toBe(DEFAULT_OAUTH_CALLBACK_PATH);
  });

  it('uses the path from --oauth-callback-url when provided', () => {
    const manager = createManager({
      oauthCallbackUrl: 'https://abc.ngrok.io/custom/oauth/callback'
    });

    expect((manager as any).resolveRedirectUri()).toBe('https://abc.ngrok.io/custom/oauth/callback');
    expect((manager as any).resolveListenerPath()).toBe('/custom/oauth/callback');
  });

  it('falls back to a random loopback port when the default callback port is busy', async () => {
    let blocker: Server | undefined = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('busy');
    });
    try {
      await listen(blocker, DEFAULT_OAUTH_CALLBACK_PORT);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== 'EADDRINUSE') {
        throw error;
      }
      blocker = undefined;
    }

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const manager = createManager();

    const prepared = await (manager as any).prepareLoopbackListener();

    try {
      const redirectUri = new URL(prepared.redirectUri);
      expect(redirectUri.hostname).toBe('127.0.0.1');
      expect(redirectUri.pathname).toBe(DEFAULT_OAUTH_CALLBACK_PATH);
      expect(redirectUri.port).not.toBe(String(DEFAULT_OAUTH_CALLBACK_PORT));
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(`OAuth callback port ${DEFAULT_OAUTH_CALLBACK_PORT} is already in use`)
      );
    } finally {
      await prepared.listener.close();
      if (blocker) {
        await close(blocker);
      }
    }
  });
});