// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

import type { ClientMetadata } from 'openid-client';
import {
  authorizationCodeGrant,
  buildAuthorizationUrl,
  randomPKCECodeVerifier,
  calculatePKCECodeChallenge,
  randomState,
  refreshTokenGrant,
  Configuration,
  ClientSecretBasic,
  ClientSecretPost,
  None
} from 'openid-client';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { Buffer } from 'node:buffer';
import { CLIENT_METADATA, TOKEN_REFRESH_THRESHOLD_SECONDS } from './constants.js';
import { discoverOAuthMetadata, OAuthDiscoveryResult } from './discovery.js';
import { TokenStorage, StoredToken } from './token-storage.js';
import { ClientRegistrar, ClientIdentity } from './registration.js';
import { CLIOptions, ConfigurationError, ServerConfig } from '../types.js';

const AUTH_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

interface LoopbackResult {
  params: Record<string, string>;
}

class LoopbackListener {
  private server?: ReturnType<typeof createServer>;
  private port?: number;
  private resolveParams?: (result: LoopbackResult) => void;
  private rejectParams?: (error: Error) => void;
  private paramsPromise: Promise<LoopbackResult>;

  constructor(private requestedPort?: number) {
    this.paramsPromise = new Promise<LoopbackResult>((resolve, reject) => {
      this.resolveParams = resolve;
      this.rejectParams = reject;
    });
  }

  async start(): Promise<void> {
    if (this.server) {
      return;
    }

    this.server = createServer(this.handleRequest.bind(this));

    await new Promise<void>((resolve, reject) => {
      this.server!.on('error', reject);
      this.server!.listen(this.requestedPort ?? 0, '127.0.0.1', () => {
        const address = this.server!.address() as AddressInfo;
        this.port = address.port;
        resolve();
      });
    });
  }

  getRedirectUri(): string {
    if (!this.port) {
      throw new Error('Loopback listener not started');
    }
    return `http://127.0.0.1:${this.port}/callback`;
  }

  async waitForParams(timeoutMs: number = AUTH_TIMEOUT_MS): Promise<LoopbackResult> {
    const timeout = new Promise<LoopbackResult>((_, reject) => {
      setTimeout(() => reject(new Error('OAuth authentication timed out')), timeoutMs);
    });

    return Promise.race([this.paramsPromise, timeout]);
  }

  async close(): Promise<void> {
    if (!this.server) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.server!.close(() => resolve());
    });
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    if (!this.resolveParams || !this.rejectParams || !this.port) {
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end('<html><body><h1>OAuth callback not ready.</h1></body></html>');
      return;
    }

    if (!req.url) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<html><body><h1>Invalid OAuth callback.</h1></body></html>');
      return;
    }

    const url = new URL(req.url, `http://127.0.0.1:${this.port}`);

    if (url.pathname !== '/callback') {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<html><body><h1>Not Found</h1></body></html>');
      return;
    }

    const params = Object.fromEntries(url.searchParams.entries());

    if (params.error) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(
        `<html><body><h1>Authentication Failed</h1><p>${params.error_description || params.error}</p></body></html>`
      );
      this.rejectParams(new ConfigurationError(`OAuth error: ${params.error_description || params.error}`));
      return;
    }

    if (!params.code) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<html><body><h1>Missing authorization code.</h1></body></html>');
      this.rejectParams(new ConfigurationError('OAuth callback missing authorization code'));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body><h1>Authentication successful.</h1><p>You may close this window.</p></body></html>');
    this.resolveParams({ params });
  }
}

function normalizeScopes(scopes: Iterable<string>): string[] {
  const unique = new Set<string>();
  for (const scope of scopes) {
    if (scope && scope.trim().length > 0) {
      unique.add(scope.trim());
    }
  }
  return Array.from(unique);
}

export class OAuthManager {
  private tokenStorage = new TokenStorage();
  private clientRegistrar = new ClientRegistrar();
  private discoveryResult: OAuthDiscoveryResult | null | undefined;
  private clientIdentity: ClientIdentity | null = null;
  private resolvedHeader: Record<string, string> | null = null;

  constructor(private config: ServerConfig, private options: CLIOptions) { }

  async getAuthorizationHeader(): Promise<Record<string, string> | undefined> {
    if (this.resolvedHeader) {
      this.verbose('Reusing OAuth authorization header for current session');
      return this.resolvedHeader;
    }

    if (!this.shouldAttemptOAuth()) {
      this.verbose('Authentication mode set to "none"; skipping OAuth handshake');
      return undefined;
    }

    const transport = this.config.transport;
    if (transport.type !== 'streamable-http' && transport.type !== 'sse') {
      return undefined;
    }

    this.verbose(`OAuth enabled for transport ${transport.type} targeting ${transport.url}`);

    const requestInit = transport.headers ? { headers: transport.headers } : undefined;
    const discovery = await this.ensureDiscovery(transport.url, transport.headers, transport.type);
    if (!discovery) {
      this.verbose('Server did not expose OAuth discovery metadata; continuing without OAuth');
      return undefined;
    }

    this.verbose('[OAUTH FLOW] Step 2: Discovery Complete');
    this.verbose(
      `Discovered authorization server ${discovery.authorizationServer.issuer}`
    );
    this.verbose(`Protected resource metadata URL: ${discovery.resourceMetadataUrl}`);
    this.verbose(`Authorization server metadata URL: ${discovery.authorizationMetadataUrl}`);
    this.verbose(`[OAUTH FLOW] Resource: ${discovery.resource.resource}`);
    this.verbose(`[OAUTH FLOW] Auth Servers: ${JSON.stringify(discovery.resource.authorization_servers)}`);
    this.verbose(`[OAUTH FLOW] Scopes Supported: ${JSON.stringify(discovery.resource.scopes_supported || [])}`);
    this.verbose(`[OAUTH FLOW] Registration Endpoint: ${discovery.authorizationServer.registration_endpoint || 'none'}`);

    const client = await this.ensureClientIdentity(discovery, requestInit);
    this.verbose(`[OAUTH FLOW] Step 3: Client Identity Resolved`);
    this.verbose(`[OAUTH FLOW] Client ID: ${client.clientId}`);
    this.verbose(`[OAUTH FLOW] Client Type: ${client.dynamic ? 'Dynamic' : 'Static'}`);
    this.verbose(`[OAUTH FLOW] Auth Method: ${client.tokenEndpointAuthMethod}`);
    this.verbose(`[OAUTH FLOW] Has Secret: ${!!client.clientSecret}`);
    if (client.dynamic) {
      this.verbose(`Using dynamically registered OAuth client ${client.clientId}`);
      if (client.clientSecret) {
        if (client.clientSecretExpiresAt && client.clientSecretExpiresAt > 0) {
          const remaining = client.clientSecretExpiresAt - Math.floor(Date.now() / 1000);
          if (remaining > 0) {
            this.verbose(`Client secret expires in ${remaining} seconds`);
          } else {
            this.verbose('Client secret reported as expired; registration will refresh automatically when needed');
          }
        } else {
          this.verbose('Client secret issued via dynamic registration; stored securely for reuse');
        }
      }
    } else if (discovery.authorizationServer.registration_endpoint) {
      this.verbose('Authorization server advertises registration_endpoint; falling back to built-in client identity');
    }

    const resource = this.resolveResource(discovery, transport.url);
    this.verbose(`[OAUTH FLOW] Step 4: Resource & Scopes`);
    this.verbose(`Using OAuth resource parameter: ${resource}`);
    const scopes = this.resolveScopes(discovery);
    this.verbose(`Requesting OAuth scopes: ${scopes.join(' ')}`);
    this.verbose(`[OAUTH FLOW] Scopes: ${JSON.stringify(scopes)}`);
    const cacheKey = this.buildCacheKey(discovery.authorizationServer.issuer, resource, scopes, client.clientId);
    this.verbose(`[OAUTH FLOW] Token Cache Key: ${cacheKey}`);

    const baseConfig = await this.buildConfiguration(discovery, client);
    this.verbose(`[OAUTH FLOW] Step 5: Building OAuth Configuration`);
    this.verbose(`[OAUTH FLOW] Token Endpoint: ${discovery.authorizationServer.token_endpoint}`);
    this.verbose(`[OAUTH FLOW] Authorization Endpoint: ${discovery.authorizationServer.authorization_endpoint}`);

    this.verbose(`[OAUTH FLOW] Step 6: Token Acquisition`);
    const token = await this.obtainToken({
      cacheKey,
      config: baseConfig,
      discovery,
      resource,
      scopes,
      client
    });

    this.verbose(`[OAUTH FLOW] Step 7: Token Acquired Successfully`);
    this.verbose(`OAuth access token acquired (masked): ${this.maskToken(token)}`);
    this.verbose(`[OAUTH FLOW] Token Length: ${token.length} chars`);
    this.resolvedHeader = { Authorization: `Bearer ${token}` };
    this.verbose('OAuth authorization header prepared for client transport');
    this.verbose('[OAUTH FLOW] ========================================');
    this.verbose('[OAUTH FLOW] OAuth Flow Complete');
    this.verbose('[OAUTH FLOW] ========================================');
    return this.resolvedHeader;
  }

  private shouldAttemptOAuth(): boolean {
    if (this.options.auth === 'none') {
      return false;
    }
    return true;
  }

  private async ensureDiscovery(
    serverUrl: string,
    headers?: Record<string, string>,
    transportType?: string
  ): Promise<OAuthDiscoveryResult | null> {
    if (this.discoveryResult !== undefined) {
      if (this.discoveryResult) {
        this.verbose('Using cached OAuth discovery metadata');
      } else {
        this.verbose('OAuth discovery previously determined to be unavailable');
      }
      return this.discoveryResult;
    }

    const requestInit = headers ? { headers } : undefined;

      try {
        this.verbose('[OAUTH FLOW] ========================================');
        this.verbose('[OAUTH FLOW] Starting OAuth Authorization Flow');
        this.verbose('[OAUTH FLOW] ========================================');
        this.verbose('[OAUTH FLOW] Step 1: Discovery');
        this.verbose('Attempting OAuth discovery via RFC 8707 protected resource metadata');
        const discovery = await discoverOAuthMetadata(serverUrl, requestInit, (message) => {
          this.verbose(message);
        }, transportType);
      if (!discovery && this.options.auth === 'oauth') {
        throw new ConfigurationError('OAuth authentication requested but server did not expose discovery metadata');
      }
      if (discovery) {
        this.verbose(
          `Protected resource metadata found; authorization server issuer: ${discovery.authorizationServer.issuer}`
        );
      } else {
        this.verbose('OAuth discovery metadata not found; falling back to unauthenticated request');
      }
      this.discoveryResult = discovery;
      return discovery;
    } catch (error) {
      if (this.options.auth === 'oauth') {
        this.verbose(`OAuth discovery failed: ${(error as Error).message}`);
        throw error;
      }
      this.verbose(`OAuth discovery failed: ${(error as Error).message}`);
      this.discoveryResult = null;
      return null;
    }
  }

  private async ensureClientIdentity(
    discovery: OAuthDiscoveryResult,
    requestInit?: RequestInit
  ): Promise<ClientIdentity> {
    if (this.clientIdentity) {
      this.verbose('Using cached OAuth client registration metadata');
      return this.clientIdentity;
    }

    const identity = await this.clientRegistrar.resolve({
      discovery,
      requestInit,
      customClientId: this.options.oauthClientId,
      customClientSecret: this.options.oauthClientSecret,
      log: (message) => {
        this.verbose(message);
      }
    });
    this.clientIdentity = identity;
    if (identity.dynamic && identity.registeredAt) {
      this.verbose(`Dynamic client registration completed at ${new Date(identity.registeredAt * 1000).toISOString()}`);
    }
    return identity;
  }

  private resolveResource(discovery: OAuthDiscoveryResult, defaultUrl: string): string {
    if (this.options.oauthResource) {
      return this.options.oauthResource;
    }
    if (discovery.resource.resource) {
      return discovery.resource.resource;
    }
    return new URL(defaultUrl).origin;
  }

  private resolveScopes(discovery: OAuthDiscoveryResult): string[] {
    if (this.options.oauthScope && this.options.oauthScope.length > 0) {
      return normalizeScopes(this.options.oauthScope);
    }

    if (discovery.challengeScopes?.length) {
      this.verbose(
        `Using scopes from WWW-Authenticate challenge: ${discovery.challengeScopes.join(' ')}`
      );
      return normalizeScopes(discovery.challengeScopes);
    }

    const advertisedScopes = discovery.resource.scopes_supported;
    if (advertisedScopes && advertisedScopes.length > 0) {
      this.verbose(`Using scopes from protected resource metadata: ${advertisedScopes.join(' ')}`);
      return normalizeScopes(advertisedScopes);
    }

    this.verbose('Authorization server did not advertise scopes; omitting scope parameter');
    return [];
  }

  private buildCacheKey(issuer: string, resource: string, scopes: string[], clientId: string): string {
    return `${issuer}|${resource}|${clientId}|${normalizeScopes(scopes).sort().join(' ')}`;
  }

  private async buildConfiguration(
    discovery: OAuthDiscoveryResult,
    client: ClientIdentity,
    redirectUri?: string
  ): Promise<Configuration> {
    const serverMetadata = {
      issuer: discovery.authorizationServer.issuer,
      authorization_endpoint: discovery.authorizationServer.authorization_endpoint,
      token_endpoint: discovery.authorizationServer.token_endpoint,
      response_types_supported: discovery.authorizationServer.response_types_supported,
      grant_types_supported: discovery.authorizationServer.grant_types_supported,
      code_challenge_methods_supported: discovery.authorizationServer.code_challenge_methods_supported,
      token_endpoint_auth_methods_supported: discovery.authorizationServer.token_endpoint_auth_methods_supported
    };

    const redirectUris = new Set<string>();
    const metadataRedirects = client.metadata.redirect_uris;
    if (Array.isArray(metadataRedirects)) {
      for (const uri of metadataRedirects) {
        if (typeof uri === 'string') {
          redirectUris.add(uri);
        }
      }
    }
    if (redirectUris.size === 0) {
      for (const fallback of CLIENT_METADATA.redirectUris) {
        redirectUris.add(fallback);
      }
    }
    if (redirectUri) {
      redirectUris.add(redirectUri);
    }

    const clientMetadata = {
      ...client.metadata,
      redirect_uris: Array.from(redirectUris),
      token_endpoint_auth_method: client.tokenEndpointAuthMethod,
      client_name: client.metadata.client_name ?? CLIENT_METADATA.clientName,
      application_type: client.metadata.application_type ?? CLIENT_METADATA.applicationType,
      software_id: client.metadata.software_id ?? CLIENT_METADATA.softwareId
    } as Partial<ClientMetadata>;

    const clientAuth = this.resolveClientAuthentication(client);

    this.verbose(`Preparing OAuth configuration with token endpoint ${serverMetadata.token_endpoint}`);
    if (redirectUri) {
      this.verbose(`Including loopback redirect URI ${redirectUri}`);
    }

    return new Configuration(serverMetadata, client.clientId, clientMetadata, clientAuth);
  }

  private resolveClientAuthentication(client: ClientIdentity) {
    const method = client.tokenEndpointAuthMethod?.toLowerCase();
    switch (method) {
      case undefined:
      case null:
      case 'none':
        return None();
      case 'client_secret_post':
        if (!client.clientSecret) {
          throw new ConfigurationError('Authorization server requires client_secret_post but did not issue a client_secret');
        }
        return ClientSecretPost(client.clientSecret);
      case 'client_secret_basic':
        if (!client.clientSecret) {
          throw new ConfigurationError('Authorization server requires client_secret_basic but did not issue a client_secret');
        }
        return ClientSecretBasic(client.clientSecret);
      default:
        throw new ConfigurationError(
          `Unsupported token_endpoint_auth_method returned by authorization server: ${client.tokenEndpointAuthMethod}`
        );
    }
  }

  private async obtainToken(params: {
    cacheKey: string;
    config: Configuration;
    discovery: OAuthDiscoveryResult;
    resource: string;
    scopes: string[];
    client: ClientIdentity;
  }): Promise<string> {
    const cached = await this.tokenStorage.load(params.cacheKey);

    if (cached) {
      this.verbose('Found cached OAuth token; evaluating freshness');
      const access = await this.tryUseCachedToken(params, cached);
      if (access) {
        this.verbose('Using cached OAuth access token');
        return access;
      }
      this.verbose('Cached token expired or refresh failed; performing interactive authorization');
    } else {
      this.verbose('No cached OAuth token found; performing interactive authorization');
    }

    return this.performAuthorizationCodeFlow({
      cacheKey: params.cacheKey,
      discovery: params.discovery,
      resource: params.resource,
      scopes: params.scopes,
      client: params.client
    });
  }

  private async tryUseCachedToken(
    params: {
      cacheKey: string;
      config: Configuration;
      discovery: OAuthDiscoveryResult;
      resource: string;
      scopes: string[];
      client: ClientIdentity;
    },
    cached: StoredToken
  ): Promise<string | null> {
    const now = Math.floor(Date.now() / 1000);

    if (cached.expiresAt && cached.expiresAt - TOKEN_REFRESH_THRESHOLD_SECONDS > now) {
      const remaining = cached.expiresAt - now;
      this.verbose(`Cached access token valid for another ${remaining} seconds; reusing`);
      this.verbose(`Cached OAuth token preview (masked): ${this.maskToken(cached.accessToken)}`);
      return cached.accessToken;
    }

    if (!cached.refreshToken) {
      this.verbose('Cached token expired and no refresh token available');
      return null;
    }

    try {
      this.verbose('Attempting OAuth refresh token grant');
      const tokenEndpoint = params.discovery.authorizationServer.token_endpoint;
      this.verbose(`-> POST ${tokenEndpoint}`);
      const refreshEntries: Array<[string, string | undefined]> = [
        ['grant_type', 'refresh_token'],
        ['refresh_token', cached.refreshToken],
        ['resource', params.resource]
      ];
      if (params.client.tokenEndpointAuthMethod !== 'client_secret_basic') {
        refreshEntries.push(['client_id', params.client.clientId]);
      }
      if (params.client.tokenEndpointAuthMethod === 'client_secret_post' && params.client.clientSecret) {
        refreshEntries.push(['client_secret', params.client.clientSecret]);
      }
      for (const [key, value] of refreshEntries) {
        if (value !== undefined) {
          this.verbose(`>- ${key}=${value}`);
        }
      }
      if (params.client.tokenEndpointAuthMethod === 'client_secret_basic' && params.client.clientSecret) {
        const basic = Buffer.from(`${params.client.clientId}:${params.client.clientSecret}`).toString('base64');
        this.verbose(`>- Authorization: Basic ${basic}`);
      }
      const refreshed = await refreshTokenGrant(
        params.config,
        cached.refreshToken,
        { resource: params.resource }
      );
      this.logTokenEndpointResponse(refreshed as Record<string, unknown>);

      const refreshedExpiresAt = typeof refreshed.expires_at === 'number'
        ? refreshed.expires_at
        : typeof refreshed.expires_at === 'string'
          ? Number.parseInt(refreshed.expires_at, 10)
          : undefined;

      const refreshedExpiresIn = typeof refreshed.expires_in === 'number'
        ? refreshed.expires_in
        : typeof refreshed.expires_in === 'string'
          ? Number.parseInt(refreshed.expires_in, 10)
          : undefined;

      const updated: StoredToken = {
        accessToken: refreshed.access_token!,
        refreshToken: refreshed.refresh_token ?? cached.refreshToken,
        expiresAt: refreshedExpiresAt ?? (refreshedExpiresIn ? now + refreshedExpiresIn : undefined),
        scope: typeof refreshed.scope === 'string' ? refreshed.scope : cached.scope,
        resource: params.resource,
        issuer: params.discovery.authorizationServer.issuer,
        tokenEndpoint: params.discovery.authorizationServer.token_endpoint,
        clientId: params.client.clientId
      };

      await this.tokenStorage.save(params.cacheKey, updated);
      const refreshedLifetime = updated.expiresAt ? updated.expiresAt - now : undefined;
      if (typeof refreshedLifetime === 'number') {
        this.verbose(`Refresh succeeded; new token valid for ${refreshedLifetime} seconds`);
      } else {
        this.verbose('Refresh succeeded; no explicit expiry provided by authorization server');
      }
      this.verbose(`Refreshed OAuth token preview (masked): ${this.maskToken(updated.accessToken)}`);
      return updated.accessToken;
    } catch (error) {
      const err = error as { code?: string; message?: string; response?: { statusCode?: number; status?: number; body?: unknown }; name?: string };
      const status = err?.response?.statusCode ?? err?.response?.status;
      const details = status ? ` (status ${status})` : '';
      this.verbose(`Token refresh failed${details}, falling back to interactive login: ${err?.message || 'unknown error'}`);
      await this.tokenStorage.clear(params.cacheKey);
      return null;
    }
  }

  private async performAuthorizationCodeFlow(params: {
    cacheKey: string;
    discovery: OAuthDiscoveryResult;
    resource: string;
    scopes: string[];
    client: ClientIdentity;
  }): Promise<string> {
    this.verbose('[OAUTH FLOW] ========================================');
    this.verbose('[OAUTH FLOW] Starting Authorization Code Flow');
    this.verbose('[OAUTH FLOW] ========================================');
    
    const codeVerifier = randomPKCECodeVerifier();
    const codeChallenge = await calculatePKCECodeChallenge(codeVerifier);
    const state = randomState();
    this.verbose('[OAUTH FLOW] Step 1: Generated PKCE parameters');
    this.verbose(`[OAUTH FLOW] Code Verifier Length: ${codeVerifier.length}`);
    this.verbose(`[OAUTH FLOW] Code Challenge: ${codeChallenge}`);
    this.verbose(`[OAUTH FLOW] State: ${state}`);
    this.verbose('Generated PKCE verifier and state for OAuth authorization request');

    const listener = new LoopbackListener(this.options.oauthCallbackPort);
    await listener.start();
    const redirectUri = listener.getRedirectUri();
    this.verbose('[OAUTH FLOW] Step 2: Loopback listener started');
    this.verbose(`OAuth loopback listener started at ${redirectUri}`);
    this.verbose(`[OAUTH FLOW] Redirect URI: ${redirectUri}`);

    const config = await this.buildConfiguration(params.discovery, params.client, redirectUri);
    this.verbose('[OAUTH FLOW] Step 3: Configuration built');
    this.verbose(`Authorization server configuration loaded from ${params.discovery.authorizationServer.issuer}`);
    this.verbose(`Token endpoint for authorization code exchange: ${params.discovery.authorizationServer.token_endpoint}`);
    this.verbose(`[OAUTH FLOW] Client ID: ${params.client.clientId}`);
    this.verbose(`[OAUTH FLOW] Client Auth Method: ${params.client.tokenEndpointAuthMethod}`);
    this.verbose(`[OAUTH FLOW] Has Client Secret: ${!!params.client.clientSecret}`);

    const scopes = normalizeScopes(params.scopes);
    const scopeParam = scopes.length ? scopes.join(' ') : undefined;
    const authorizationParams: Record<string, string> = {
      resource: params.resource,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      redirect_uri: redirectUri,
      state
    };
    if (scopeParam) {
      authorizationParams.scope = scopeParam;
    }
    const authorizationUrl = buildAuthorizationUrl(config, authorizationParams);

    const authorizationUrlString = authorizationUrl.toString();
    
    this.verbose('[OAUTH FLOW] Step 4: Authorization URL constructed');
    this.verbose(`[OAUTH FLOW] Authorization Endpoint: ${params.discovery.authorizationServer.authorization_endpoint}`);
    this.verbose(`[OAUTH FLOW] Parameters:`);
    this.verbose(`[OAUTH FLOW]   - resource: ${authorizationParams.resource}`);
    this.verbose(`[OAUTH FLOW]   - code_challenge: ${authorizationParams.code_challenge}`);
    this.verbose(`[OAUTH FLOW]   - code_challenge_method: ${authorizationParams.code_challenge_method}`);
    this.verbose(`[OAUTH FLOW]   - redirect_uri: ${authorizationParams.redirect_uri}`);
    this.verbose(`[OAUTH FLOW]   - state: ${authorizationParams.state}`);
    this.verbose(`[OAUTH FLOW]   - scope: ${authorizationParams.scope || '(none)'}`);
    this.verbose(`[OAUTH FLOW] Full URL: ${authorizationUrlString}`);

    this.log('OAuth authentication required for MCP server.', true);
    this.verbose(
      `Authorization request scopes: ${scopes.length ? scopes.join(' ') : '(none)'}`
    );

    // Always require manual browser interaction (browser auto-launch is unreliable)
    this.log('Open this URL in your browser to continue:', true);
    this.log(authorizationUrlString, true);

    let loopbackResult: LoopbackResult;
    try {
      this.verbose('[OAUTH FLOW] Step 5: Waiting for authorization callback...');
      loopbackResult = await listener.waitForParams();
      this.verbose('[OAUTH FLOW] Step 6: Authorization callback received');
      this.verbose('Received OAuth callback with authorization code');
      this.verbose(`[OAUTH FLOW] Authorization Code: ${loopbackResult.params.code?.substring(0, 20)}...`);
      this.verbose(`[OAUTH FLOW] State Returned: ${loopbackResult.params.state}`);
    } finally {
      await listener.close();
      this.verbose('OAuth loopback listener closed');
    }

    try {
      this.verbose('[OAUTH FLOW] Step 7: Exchanging authorization code for tokens');
      this.verbose('Exchanging authorization code for tokens');
      this.verbose(`OAuth token request resource parameter: ${params.resource}`);
      const tokenEndpoint = params.discovery.authorizationServer.token_endpoint;
      this.verbose(`-> POST ${tokenEndpoint}`);
      this.verbose('[OAUTH FLOW] Token Request Parameters:');
      const requestEntries: Array<[string, string | undefined]> = [
        ['grant_type', 'authorization_code'],
        ['code', loopbackResult.params.code],
        ['redirect_uri', redirectUri],
        ['code_verifier', codeVerifier],
        ['resource', params.resource]
      ];
      if (params.client.tokenEndpointAuthMethod !== 'client_secret_basic') {
        requestEntries.push(['client_id', params.client.clientId]);
      }
      if (params.client.tokenEndpointAuthMethod === 'client_secret_post' && params.client.clientSecret) {
        requestEntries.push(['client_secret', '[REDACTED]']);
      }
      for (const [key, value] of requestEntries) {
        if (value !== undefined) {
          this.verbose(`>- ${key}=${key === 'code' || key === 'code_verifier' ? value.substring(0, 20) + '...' : value}`);
          this.verbose(`[OAUTH FLOW]   - ${key}: ${key === 'code' || key === 'code_verifier' || key === 'client_secret' ? '[REDACTED]' : value}`);
        }
      }
      if (params.client.tokenEndpointAuthMethod === 'client_secret_basic' && params.client.clientSecret) {
        this.verbose(`>- Authorization: Basic [REDACTED]`);
        this.verbose(`[OAUTH FLOW]   - Authorization: Basic [REDACTED]`);
      }
      
      const tokenResponse = await authorizationCodeGrant(
        config,
        new URL(redirectUri + '?' + new URLSearchParams(loopbackResult.params).toString()),
        {
          expectedState: state,
          pkceCodeVerifier: codeVerifier
        },
        { resource: params.resource }
      );

      this.verbose('[OAUTH FLOW] Step 8: Token response received');

      this.logTokenEndpointResponse(tokenResponse as Record<string, unknown>);

      await this.persistToken({
        cacheKey: params.cacheKey,
        discovery: params.discovery,
        resource: params.resource,
        client: params.client
      }, tokenResponse);
      const hasRefresh = tokenResponse.refresh_token ? 'yes' : 'no';
      this.verbose(`Authorization code exchange succeeded (refresh token: ${hasRefresh})`);
      if (tokenResponse.access_token) {
        this.verbose(`New OAuth token preview (masked): ${this.maskToken(tokenResponse.access_token)}`);
      }
      return tokenResponse.access_token!;
    } catch (error) {
      const err = error as { code?: string; message?: string; response?: { statusCode?: number; status?: number; body?: unknown }; name?: string };
      const status = err?.response?.statusCode ?? err?.response?.status;
      const responseBody = err?.response?.body;
      if (status || responseBody || err?.code || err?.name) {
        const summary = [
          status ? `status ${status}` : null,
          err?.code ? `code ${err.code}` : null,
          err?.name && err.name !== err?.code ? `name ${err.name}` : null
        ].filter(Boolean).join(', ');
        let bodySummary: string | undefined;
        if (typeof responseBody === 'string') {
          bodySummary = responseBody;
        } else if (responseBody) {
          try {
            bodySummary = JSON.stringify(responseBody);
          } catch {
            bodySummary = String(responseBody);
          }
        }
        if (bodySummary && bodySummary.length > 500) {
          bodySummary = `${bodySummary.slice(0, 500)}…`;
        }
        const detail = bodySummary ? ` response body: ${bodySummary}` : '';
        this.verbose(`Authorization code exchange failed (${summary || 'no metadata'})${detail}`);
      } else {
        this.verbose(`Authorization code exchange failed: ${(error as Error).message}`);
      }
      await this.tokenStorage.clear(params.cacheKey);
      throw new ConfigurationError(`OAuth token exchange failed: ${(error as Error).message}`);
    }
  }

  private async persistToken(
    params: {
      cacheKey: string;
      discovery: OAuthDiscoveryResult;
      resource: string;
      client: ClientIdentity;
    },
    tokenResponse: {
      access_token?: string;
      refresh_token?: string;
      expires_at?: number;
      expires_in?: number;
      scope?: string;
    }
  ): Promise<void> {
    const expiresAtRaw = typeof tokenResponse.expires_at === 'number'
      ? tokenResponse.expires_at
      : typeof tokenResponse.expires_at === 'string'
        ? Number.parseInt(tokenResponse.expires_at, 10)
        : undefined;
    const expiresInRaw = typeof tokenResponse.expires_in === 'number'
      ? tokenResponse.expires_in
      : typeof tokenResponse.expires_in === 'string'
        ? Number.parseInt(tokenResponse.expires_in, 10)
        : undefined;
    const expiresAt = expiresAtRaw ?? (expiresInRaw ? Math.floor(Date.now() / 1000) + expiresInRaw : undefined);

    const stored: StoredToken = {
      accessToken: tokenResponse.access_token!,
      refreshToken: tokenResponse.refresh_token,
      expiresAt,
      scope: typeof tokenResponse.scope === 'string' ? tokenResponse.scope : undefined,
      resource: params.resource,
      issuer: params.discovery.authorizationServer.issuer,
      tokenEndpoint: params.discovery.authorizationServer.token_endpoint,
      clientId: params.client.clientId
    };

    await this.tokenStorage.save(params.cacheKey, stored);
    const refreshStatus = stored.refreshToken ? 'present' : 'absent';
    const now = Math.floor(Date.now() / 1000);
    let expiryInfo: string;
    if (stored.expiresAt === undefined) {
      expiryInfo = 'no expiry provided';
    } else if (stored.expiresAt >= now) {
      expiryInfo = `expires in ${stored.expiresAt - now} seconds`;
    } else {
      expiryInfo = `expired ${now - stored.expiresAt} seconds ago`;
    }
    this.verbose(`Persisted OAuth token set (${refreshStatus}, ${expiryInfo})`);
    this.verbose(`Stored OAuth token preview (masked): ${this.maskToken(stored.accessToken)}`);
  }

  private logTokenEndpointResponse(response: Record<string, unknown>): void {
    const sanitized: Record<string, unknown> = { ...response };
    if (typeof sanitized.access_token === 'string') {
      sanitized.access_token = this.maskToken(sanitized.access_token);
    }
    if (typeof sanitized.refresh_token === 'string') {
      sanitized.refresh_token = this.maskToken(sanitized.refresh_token as string);
    }
    if (typeof sanitized.id_token === 'string') {
      sanitized.id_token = this.maskToken(sanitized.id_token as string);
    }
    this.logJson('<-', sanitized);
  }

  private logJson(direction: '<-' | '>-', data: unknown): void {
    if (data === undefined || data === null) {
      return;
    }

    let serialized: string;
    try {
      serialized = JSON.stringify(data, null, 2);
    } catch {
      serialized = String(data);
    }

    for (const line of serialized.split('\n')) {
      this.verbose(`${direction} ${line}`);
    }
  }

  private verbose(message: string): void {
    if (this.options.verbose && !this.options.quiet) {
      console.error(`[VERBOSE] ${message}`);
    }
  }

  private maskToken(token: string): string {
    if (!token) {
      return '(empty)';
    }

    if (token.length <= 8) {
      return '*'.repeat(token.length);
    }

    return `${token.slice(0, 4)}…${token.slice(-4)}`;
  }

  private log(message: string, force = false): void {
    if (!this.options.quiet || force) {
      console.error(message);
    }
  }
}

