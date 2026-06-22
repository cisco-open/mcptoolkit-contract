// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { ClientRegistrar } from '../../src/lib/oauth/registration.js';
import type { ClientRegistrationStorage, StoredClientRegistration } from '../../src/lib/oauth/client-registration-storage.js';
import type { OAuthDiscoveryResult } from '../../src/lib/oauth/discovery.js';
import { CLIENT_METADATA } from '../../src/lib/oauth/constants.js';

class MemoryRegistrationStorage {
  private records = new Map<string, StoredClientRegistration>();
  readonly clearedKeys: string[] = [];

  async save(identifier: string, registration: StoredClientRegistration): Promise<void> {
    this.records.set(identifier, registration);
  }

  async load(identifier: string): Promise<StoredClientRegistration | null> {
    return this.records.get(identifier) ?? null;
  }

  async clear(identifier: string): Promise<void> {
    this.records.delete(identifier);
    this.clearedKeys.push(identifier);
  }

  get(identifier: string): StoredClientRegistration | undefined {
    return this.records.get(identifier);
  }

  set(identifier: string, registration: StoredClientRegistration): void {
    this.records.set(identifier, registration);
  }

  keys(): string[] {
    return Array.from(this.records.keys());
  }
}

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.resetAllMocks();
});

interface DiscoveryOptions {
  resourceScopes?: string[];
  authorizationScopes?: string[];
  challengeScopes?: string[];
}

function createDiscovery(registrationEndpoint?: string, options: DiscoveryOptions = {}): OAuthDiscoveryResult {
  return {
    resource: {
      resource: 'https://api.example.com/mcp',
      authorization_servers: ['https://login.example.com'],
      scopes_supported: options.resourceScopes
    },
    authorizationServer: {
      issuer: 'https://login.example.com',
      authorization_endpoint: 'https://login.example.com/authorize',
      token_endpoint: 'https://login.example.com/token',
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      registration_endpoint: registrationEndpoint,
      scopes_supported: options.authorizationScopes
    },
    resourceMetadataUrl: 'https://api.example.com/.well-known/oauth-protected-resource',
    authorizationMetadataUrl: 'https://login.example.com/.well-known/oauth-authorization-server',
    challengeScopes: options.challengeScopes
  };
}

describe('ClientRegistrar', () => {
  it('returns static client identity when registration endpoint is absent', async () => {
    const storage = new MemoryRegistrationStorage();
    const registrar = new ClientRegistrar(storage as unknown as ClientRegistrationStorage);
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof global.fetch;

    const identity = await registrar.resolve({ discovery: createDiscovery() });

    expect(identity.dynamic).toBe(false);
    expect(identity.clientId).toBe(CLIENT_METADATA.clientId);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(storage.keys()).toHaveLength(0);
  });

  it('performs dynamic registration when endpoint is advertised', async () => {
    const storage = new MemoryRegistrationStorage();
    const registrar = new ClientRegistrar(storage as unknown as ClientRegistrationStorage);
    const fetchMock = jest.fn(async () =>
      new Response(
        JSON.stringify({
          client_id: 'figma-client-123',
          scope: 'mcp:connect',
          response_types: ['code'],
          grant_types: ['authorization_code'],
          token_endpoint_auth_method: 'none'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    global.fetch = fetchMock as unknown as typeof global.fetch;

    const discovery = createDiscovery('https://api.figma.com/v1/oauth/mcp/register', {
      resourceScopes: ['mcp:connect']
    });
    const identity = await registrar.resolve({ discovery });

    expect(identity.dynamic).toBe(true);
    expect(identity.clientId).toBe('figma-client-123');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const [url, options] = call;
    expect(url).toBe('https://api.figma.com/v1/oauth/mcp/register');
    const body = options && typeof options.body === 'string' ? options.body : undefined;
    expect(typeof body).toBe('string');
    if (typeof body === 'string') {
      const parsed = JSON.parse(body) as Record<string, unknown>;
      expect(parsed.redirect_uris).toEqual(expect.arrayContaining(Array.from(CLIENT_METADATA.redirectUris)));
      expect(parsed.token_endpoint_auth_method).toBe('none');
      expect(parsed.scope).toBe('mcp:connect');
    }

    const storedKeys = storage.keys();
    expect(storedKeys).toHaveLength(1);
    const stored = storage.get(storedKeys[0]!);
    expect(stored?.clientId).toBe('figma-client-123');
    expect(stored?.metadata.redirect_uris).toEqual(expect.arrayContaining(Array.from(CLIENT_METADATA.redirectUris)));
  });

  it('reuses stored registration when still valid', async () => {
    const storage = new MemoryRegistrationStorage();
    const registrar = new ClientRegistrar(storage as unknown as ClientRegistrationStorage);
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof global.fetch;

    const endpoint = 'https://api.figma.com/v1/oauth/mcp/register';
    const key = `https://login.example.com|${endpoint}|${CLIENT_METADATA.softwareId}`;
    storage.set(key, {
      issuer: 'https://login.example.com',
      registrationEndpoint: endpoint,
      clientId: 'cached-client-id',
      metadata: {
        redirect_uris: CLIENT_METADATA.redirectUris,
        grant_types: CLIENT_METADATA.grantTypes,
        response_types: CLIENT_METADATA.responseTypes,
        token_endpoint_auth_method: 'none'
      },
      registeredAt: Math.floor(Date.now() / 1000) - 60,
      tokenEndpointAuthMethod: 'none'
    } as StoredClientRegistration);

    const identity = await registrar.resolve({ discovery: createDiscovery(endpoint) });

    expect(identity.dynamic).toBe(true);
    expect(identity.clientId).toBe('cached-client-id');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(storage.clearedKeys).toHaveLength(0);
  });

  it('re-registers when stored client secret is expired', async () => {
    const storage = new MemoryRegistrationStorage();
    const registrar = new ClientRegistrar(storage as unknown as ClientRegistrationStorage);
    const endpoint = 'https://api.figma.com/v1/oauth/mcp/register';
    const key = `https://login.example.com|${endpoint}|${CLIENT_METADATA.softwareId}`;
    storage.set(key, {
      issuer: 'https://login.example.com',
      registrationEndpoint: endpoint,
      clientId: 'expired-client-id',
      clientSecret: 'secret',
      clientSecretExpiresAt: Math.floor(Date.now() / 1000) - 30,
      metadata: {
        redirect_uris: CLIENT_METADATA.redirectUris,
        grant_types: CLIENT_METADATA.grantTypes,
        response_types: CLIENT_METADATA.responseTypes,
        token_endpoint_auth_method: 'client_secret_post'
      },
      tokenEndpointAuthMethod: 'client_secret_post',
      registeredAt: Math.floor(Date.now() / 1000) - 120
    } as StoredClientRegistration);

    const fetchMock = jest.fn(async () =>
      new Response(
        JSON.stringify({
          client_id: 'fresh-client-id',
          token_endpoint_auth_method: 'none'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    global.fetch = fetchMock as unknown as typeof global.fetch;

    const identity = await registrar.resolve({ discovery: createDiscovery(endpoint) });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(identity.clientId).toBe('fresh-client-id');
    expect(storage.clearedKeys).toContain(key);
    const stored = storage.get(key);
    expect(stored?.clientId).toBe('fresh-client-id');
  });
});
