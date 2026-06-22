// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { discoverOAuthMetadata } from '../../src/lib/oauth/discovery.js';

type FetchArgs = Parameters<typeof global.fetch>;

const createJsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init
  });

const createEmptyResponse = (status: number, headers?: Record<string, string>) =>
  new Response(null, {
    status,
    headers
  });

const toUrlString = (input: FetchArgs[0]): string => {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  if (input instanceof Request) {
    return input.url;
  }
  return String(input);
};

describe('OAuth discovery', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.resetAllMocks();
  });

  describe('protected resource discovery', () => {
    it('prefers resource metadata URL advertised via WWW-Authenticate and captures challenge scopes', async () => {
      const fetchMock = jest.fn(async (...args: FetchArgs) => {
        const url = toUrlString(args[0]);

        if (url === 'https://api.example.com/public/mcp') {
          return createEmptyResponse(401, {
            'WWW-Authenticate': 'Bearer resource_metadata="https://auth.example.com/meta.json", scope="files:read files:write"'
          });
        }

        if (url === 'https://auth.example.com/meta.json') {
          return createJsonResponse({
            resource: 'https://api.example.com/public/mcp',
            authorization_servers: ['https://login.example.com'],
            scopes_supported: ['mcp:read']
          });
        }

        if (url === 'https://login.example.com/.well-known/oauth-authorization-server') {
          return createJsonResponse({
            issuer: 'https://login.example.com',
            authorization_endpoint: 'https://login.example.com/authorize',
            token_endpoint: 'https://login.example.com/token',
            code_challenge_methods_supported: ['S256'],
            response_types_supported: ['code'],
            grant_types_supported: ['authorization_code']
          });
        }

        return createEmptyResponse(404);
      });

      global.fetch = fetchMock as unknown as typeof global.fetch;

      const result = await discoverOAuthMetadata('https://api.example.com/public/mcp');

      expect(result).not.toBeNull();
      expect(result?.challengeScopes).toEqual(['files:read', 'files:write']);
      expect(result?.resourceMetadataUrl).toBe('https://auth.example.com/meta.json');
      expect(result?.authorizationMetadataUrl).toBe(
        'https://login.example.com/.well-known/oauth-authorization-server'
      );

      const firstCallInit = fetchMock.mock.calls[0]?.[1];
      expect(fetchMock.mock.calls[0]?.[0]).toEqual(new URL('https://api.example.com/public/mcp'));
      expect(firstCallInit).toMatchObject({ method: 'GET' });
    });

    it('falls back to path-specific and root well-known resource metadata locations', async () => {
      const fetchMock = jest.fn(async (...args: FetchArgs) => {
        const url = toUrlString(args[0]);

        if (url === 'https://api.example.com/public/mcp') {
          return createEmptyResponse(401);
        }

        if (url === 'https://api.example.com/.well-known/oauth-protected-resource/public/mcp') {
          return createEmptyResponse(404);
        }

        if (url === 'https://api.example.com/.well-known/oauth-protected-resource') {
          return createJsonResponse({
            resource: 'https://api.example.com/public/mcp',
            authorization_servers: ['https://login.example.com']
          });
        }

        if (url === 'https://login.example.com/.well-known/oauth-authorization-server') {
          return createJsonResponse({
            issuer: 'https://login.example.com',
            authorization_endpoint: 'https://login.example.com/authorize',
            token_endpoint: 'https://login.example.com/token',
            code_challenge_methods_supported: ['S256'],
            response_types_supported: ['code'],
            grant_types_supported: ['authorization_code']
          });
        }

        return createEmptyResponse(404);
      });

      global.fetch = fetchMock as unknown as typeof global.fetch;

      const result = await discoverOAuthMetadata('https://api.example.com/public/mcp');

      expect(result).not.toBeNull();
      const requestedUrls = fetchMock.mock.calls.map((call) => toUrlString(call[0]!));
      expect(requestedUrls[1]).toBe('https://api.example.com/.well-known/oauth-protected-resource/public/mcp');
      expect(requestedUrls[2]).toBe('https://api.example.com/.well-known/oauth-protected-resource');
    });
  });

  describe('authorization server discovery', () => {
    it('tries OAuth and OpenID configuration endpoints for issuers with path components', async () => {
      const fetchMock = jest.fn(async (...args: FetchArgs) => {
        const url = toUrlString(args[0]);

        if (url === 'https://api.example.com/public/mcp') {
          return createEmptyResponse(401);
        }

        if (url === 'https://api.example.com/.well-known/oauth-protected-resource/public/mcp') {
          return createJsonResponse({
            resource: 'https://api.example.com/public/mcp',
            authorization_servers: ['https://login.example.com/tenant1']
          });
        }

        if (url === 'https://login.example.com/.well-known/oauth-authorization-server/tenant1') {
          return createEmptyResponse(404);
        }

        if (url === 'https://login.example.com/.well-known/openid-configuration/tenant1') {
          return createJsonResponse({
            issuer: 'https://login.example.com/tenant1',
            authorization_endpoint: 'https://login.example.com/tenant1/authorize',
            token_endpoint: 'https://login.example.com/tenant1/token',
            code_challenge_methods_supported: ['S256'],
            response_types_supported: ['code'],
            grant_types_supported: ['authorization_code']
          });
        }

        return createEmptyResponse(404);
      });

      global.fetch = fetchMock as unknown as typeof global.fetch;

      const result = await discoverOAuthMetadata('https://api.example.com/public/mcp');

      expect(result).not.toBeNull();
      expect(result?.authorizationMetadataUrl).toBe(
        'https://login.example.com/.well-known/openid-configuration/tenant1'
      );
    });

    it('falls back to alternative authorization servers when earlier ones fail', async () => {
      const fetchMock = jest.fn(async (...args: FetchArgs) => {
        const url = toUrlString(args[0]);

        if (url === 'https://api.example.com/public/mcp') {
          return createEmptyResponse(401);
        }

        if (url === 'https://api.example.com/.well-known/oauth-protected-resource') {
          return createJsonResponse({
            resource: 'https://api.example.com/public/mcp',
            authorization_servers: ['https://bad.example.com', 'https://login.example.com']
          });
        }

        if (url === 'https://bad.example.com/.well-known/oauth-authorization-server') {
          return createJsonResponse({
            issuer: 'https://bad.example.com',
            authorization_endpoint: 'https://bad.example.com/authorize',
            token_endpoint: 'https://bad.example.com/token',
            code_challenge_methods_supported: []
          });
        }

        if (url === 'https://bad.example.com/.well-known/openid-configuration') {
          return createEmptyResponse(404);
        }

        if (url === 'https://login.example.com/.well-known/oauth-authorization-server') {
          return createJsonResponse({
            issuer: 'https://login.example.com',
            authorization_endpoint: 'https://login.example.com/authorize',
            token_endpoint: 'https://login.example.com/token',
            code_challenge_methods_supported: ['S256'],
            response_types_supported: ['code'],
            grant_types_supported: ['authorization_code']
          });
        }

        return createEmptyResponse(404);
      });

      global.fetch = fetchMock as unknown as typeof global.fetch;

      const result = await discoverOAuthMetadata('https://api.example.com/public/mcp');

      expect(result).not.toBeNull();
      expect(result?.authorizationServer.issuer).toBe('https://login.example.com');
      expect(result?.authorizationMetadataUrl).toBe(
        'https://login.example.com/.well-known/oauth-authorization-server'
      );
    });
  });
});
