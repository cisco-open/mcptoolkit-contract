// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

import { ConfigurationError } from '../types.js';

export interface ResourceMetadata {
  resource: string;
  authorization_servers: string[];
  scopes_supported?: string[];
  bearer_methods_supported?: string[];
}

export interface AuthorizationServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  response_types_supported: string[];
  grant_types_supported: string[];
  code_challenge_methods_supported?: string[];
  token_endpoint_auth_methods_supported?: string[];
  scopes_supported?: string[];
}

export interface OAuthDiscoveryResult {
  resource: ResourceMetadata;
  authorizationServer: AuthorizationServerMetadata;
  resourceMetadataUrl: string;
  authorizationMetadataUrl: string;
  challengeScopes?: string[];
}

interface ResourceMetadataResult {
  metadata: ResourceMetadata;
  metadataUrl: URL;
  challengeScopes?: string[];
}

interface AuthorizationMetadataResult {
  metadata: AuthorizationServerMetadata;
  metadataUrl: URL;
}

const WELL_KNOWN_RESOURCE_SEGMENT = '/.well-known/oauth-protected-resource';
const WELL_KNOWN_OAUTH_SEGMENT = '/.well-known/oauth-authorization-server';
const WELL_KNOWN_OPENID_SEGMENT = '/.well-known/openid-configuration';

async function fetchJson(url: URL, init: RequestInit | undefined, log?: (message: string) => void): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();
  log?.(`-> ${method} ${url.toString()}`);
  
  // Add 5-second timeout to prevent hangs (especially with SSE)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  
  const fetchInit: RequestInit = {
    ...init,
    signal: controller.signal
  };
  
  if (init?.body) {
    if (typeof init.body === 'string') {
      for (const line of init.body.split('\n')) {
        log?.(`>- ${line}`);
      }
    } else if (init.body instanceof URLSearchParams) {
      log?.(`>- ${init.body.toString()}`);
    } else {
      log?.('>- [body omitted: non-text]');
    }
  }

  try {
    const response = await fetch(url, fetchInit);
    clearTimeout(timeoutId);
    const statusLine = `${response.status} ${response.statusText || ''}`.trim();
    log?.(`<-${statusLine}`);
    try {
      const preview = await response.clone().text();
      const content = preview.length ? preview : '(empty body)';
      for (const line of content.split('\n')) {
        log?.(`<- ${line}`);
      }
    } catch {
      log?.('<- [response body unavailable]');
    }
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    const message = (error as Error).message;
    if (message.includes('aborted')) {
      throw new ConfigurationError(
        `Request to ${url.toString()} timed out after 5 seconds`
      );
    }
    throw new ConfigurationError(
      `Failed to fetch ${url.toString()}: ${message}`
    );
  }
}

function normalizePath(path: string): string {
  if (!path || path === '/') {
    return '';
  }

  const collapsed = path.replace(/\/+/g, '/');
  const withoutTrailing = collapsed.endsWith('/') ? collapsed.slice(0, -1) : collapsed;
  if (!withoutTrailing) {
    return '';
  }
  return withoutTrailing.startsWith('/') ? withoutTrailing : `/${withoutTrailing}`;
}

function parseAuthenticateHeader(value: string | null): { resourceMetadata?: string; scopes?: string[] } {
  if (!value) {
    return {};
  }

  const resourceMatch = value.match(/resource_metadata="([^"]+)"/i);
  const scopeMatch = value.match(/scope="([^"]+)"/i);

  return {
    resourceMetadata: resourceMatch ? resourceMatch[1] : undefined,
    scopes: scopeMatch ? scopeMatch[1].split(/\s+/).filter(Boolean) : undefined
  };
}

async function probeAuthenticateHeader(
  serverUrl: URL,
  init: RequestInit | undefined,
  skipProbe: boolean,
  log?: (message: string) => void
): Promise<{ resourceMetadataUrl?: URL; scopes?: string[] }> {
  if (skipProbe) {
    log?.('[DISCOVERY] Step 1.1: Skipping WWW-Authenticate probe (not applicable for this transport)');
    log?.('[DISCOVERY] Will use well-known URI pattern directly (RFC 9728 Section 3)');
    return {};
  }
  
  log?.('[DISCOVERY] Step 1.1: Probing for WWW-Authenticate header (RFC 9728 Section 5.1)');
  log?.('[DISCOVERY] Attempting GET on server URL to check for 401 Unauthorized response');
  log?.('[DISCOVERY] Looking for: WWW-Authenticate header with resource_metadata parameter');
  
  const requestInit: RequestInit = {
    ...init,
    method: init?.method ?? 'GET'
  };

  const response = await fetchJson(serverUrl, requestInit, log);
  const authenticate = response.status === 401 ? response.headers.get('www-authenticate') : null;
  
  if (response.status === 401) {
    log?.('[DISCOVERY] Received 401 Unauthorized - checking for WWW-Authenticate header');
  } else {
    log?.(`[DISCOVERY] Received ${response.status} ${response.statusText} - not 401, will fall back to well-known URI`);
  }
  
  response.body?.cancel().catch(() => undefined);

  const { resourceMetadata, scopes } = parseAuthenticateHeader(authenticate);
  let resourceMetadataUrl: URL | undefined;

  if (resourceMetadata) {
    log?.('[DISCOVERY] ✓ Found resource_metadata in WWW-Authenticate header');
    log?.(`[DISCOVERY] Resource Metadata URL: ${resourceMetadata}`);
    try {
      resourceMetadataUrl = new URL(resourceMetadata);
    } catch (error) {
      throw new ConfigurationError(
        `Invalid resource_metadata URL provided by server: ${resourceMetadata}`
      );
    }
  } else {
    log?.('[DISCOVERY] ✗ No resource_metadata found in WWW-Authenticate header');
    log?.('[DISCOVERY] Will try well-known URI pattern as fallback (RFC 9728 Section 3)');
  }

  if (scopes && scopes.length > 0) {
    log?.(`[DISCOVERY] Challenge scopes found in header: ${scopes.join(' ')}`);
  }

  return { resourceMetadataUrl, scopes };
}

function buildResourceMetadataCandidates(serverUrl: URL, headerUrl?: URL): URL[] {
  const candidates: URL[] = [];
  const seen = new Set<string>();
  const push = (candidate: URL | undefined) => {
    if (!candidate) {
      return;
    }
    const key = candidate.toString();
    if (!seen.has(key)) {
      candidates.push(candidate);
      seen.add(key);
    }
  };

  if (headerUrl) {
    push(headerUrl);
  }

  const normalizedPath = normalizePath(serverUrl.pathname);
  if (normalizedPath) {
    // Path-specific well-known: /.well-known/oauth-protected-resource{path}
    push(new URL(`${WELL_KNOWN_RESOURCE_SEGMENT}${normalizedPath}`, `${serverUrl.protocol}//${serverUrl.host}`));
  }

  // Root well-known: /.well-known/oauth-protected-resource
  push(new URL(WELL_KNOWN_RESOURCE_SEGMENT, `${serverUrl.protocol}//${serverUrl.host}`));

  return candidates;
}

async function fetchResourceMetadata(
  candidates: URL[],
  init: RequestInit | undefined,
  challengeScopes: string[] | undefined,
  log?: (message: string) => void
): Promise<ResourceMetadataResult | null> {
  log?.('[DISCOVERY] Step 1.2: Attempting to fetch Protected Resource Metadata');
  log?.(`[DISCOVERY] Trying ${candidates.length} candidate URL(s) in order:`);
  candidates.forEach((c, i) => log?.(`[DISCOVERY]   ${i + 1}. ${c.toString()}`));
  
  const errors: string[] = [];

  for (const candidate of candidates) {
    log?.(`[DISCOVERY] Attempting: ${candidate.toString()}`);
    const response = await fetchJson(candidate, init, log);

    if (response.status === 404) {
      log?.('[DISCOVERY] 404 Not Found - trying next candidate');
      continue;
    }

    if (!response.ok) {
      const errorMsg = `${candidate.toString()} -> ${response.status} ${response.statusText}`;
      log?.(`[DISCOVERY] Failed: ${errorMsg}`);
      errors.push(errorMsg);
      continue;
    }

    log?.('[\u2713 DISCOVERY] Successfully retrieved Protected Resource Metadata');
    const metadata = await response.json() as ResourceMetadata;

    if (!metadata.authorization_servers?.length) {
      log?.('[DISCOVERY] \u2717 Metadata missing authorization_servers array');
      errors.push(`${candidate.toString()} -> missing authorization_servers array`);
      continue;
    }
    
    log?.(`[DISCOVERY] Resource: ${metadata.resource}`);
    log?.(`[DISCOVERY] Authorization Servers: ${metadata.authorization_servers.join(', ')}`);
    log?.(`[DISCOVERY] Scopes Supported: ${metadata.scopes_supported?.join(', ') || 'none'}`);

    return { metadata, metadataUrl: candidate, challengeScopes };
  }

  if (errors.length) {
    throw new ConfigurationError(
      `Failed to retrieve protected resource metadata. Attempts:\n${errors.join('\n')}`
    );
  }

  return null;
}

function buildAuthorizationMetadataCandidates(issuer: URL): URL[] {
  const candidates: URL[] = [];
  const seen = new Set<string>();
  const push = (candidate: URL) => {
    const key = candidate.toString();
    if (!seen.has(key)) {
      candidates.push(candidate);
      seen.add(key);
    }
  };

  const origin = `${issuer.protocol}//${issuer.host}`;
  const normalizedPath = normalizePath(issuer.pathname);

  if (normalizedPath) {
    push(new URL(`${WELL_KNOWN_OAUTH_SEGMENT}${normalizedPath}`, origin));
    push(new URL(`${WELL_KNOWN_OPENID_SEGMENT}${normalizedPath}`, origin));
    push(new URL(`${normalizedPath}${WELL_KNOWN_OPENID_SEGMENT}`, origin));
    push(new URL(WELL_KNOWN_OAUTH_SEGMENT, origin));
    push(new URL(WELL_KNOWN_OPENID_SEGMENT, origin));
  } else {
    push(new URL(WELL_KNOWN_OAUTH_SEGMENT, origin));
    push(new URL(WELL_KNOWN_OPENID_SEGMENT, origin));
  }

  return candidates;
}

async function fetchAuthorizationMetadata(
  issuer: string,
  init: RequestInit | undefined,
  log?: (message: string) => void
): Promise<AuthorizationMetadataResult> {
  log?.('[DISCOVERY] Step 1.3: Discovering Authorization Server Metadata');
  log?.(`[DISCOVERY] Issuer: ${issuer}`);
  log?.('[DISCOVERY] Trying OAuth 2.0 and OpenID Connect discovery endpoints');
  
  const issuerUrl = new URL(issuer);
  const candidates = buildAuthorizationMetadataCandidates(issuerUrl);
  
  log?.(`[DISCOVERY] Candidate URLs (${candidates.length}):`);
  candidates.forEach((c, i) => log?.(`[DISCOVERY]   ${i + 1}. ${c.toString()}`));
  
  const errors: string[] = [];

  for (const candidate of candidates) {
    try {
      log?.(`[DISCOVERY] Attempting: ${candidate.toString()}`);
      const response = await fetchJson(candidate, init, log);

      if (response.status === 404) {
        log?.('[DISCOVERY] 404 Not Found - trying next candidate');
        continue;
      }

      if (!response.ok) {
        const errorMsg = `${candidate.toString()} -> ${response.status} ${response.statusText}`;
        log?.(`[DISCOVERY] Failed: ${errorMsg}`);
        errors.push(errorMsg);
        continue;
      }

      log?.('[\u2713 DISCOVERY] Successfully retrieved Authorization Server Metadata');
      const metadata = await response.json() as AuthorizationServerMetadata;

      if (!metadata.authorization_endpoint || !metadata.token_endpoint) {
        log?.('[DISCOVERY] \u2717 Missing required endpoints (authorization_endpoint or token_endpoint)');
        errors.push(`${candidate.toString()} -> missing required endpoints`);
        continue;
      }

      if (metadata.issuer && metadata.issuer !== issuer) {
        log?.(`[DISCOVERY] \u2717 Issuer mismatch: expected ${issuer}, got ${metadata.issuer}`);
        errors.push(`${candidate.toString()} -> issuer mismatch (${metadata.issuer})`);
        continue;
      }

      if (!metadata.code_challenge_methods_supported?.includes('S256')) {
        log?.('[DISCOVERY] \u2717 PKCE S256 not advertised in code_challenge_methods_supported');
        log?.('[DISCOVERY] MCP requires PKCE S256 per OAuth 2.1 and MCP spec');
        errors.push(`${candidate.toString()} -> PKCE S256 not advertised`);
        continue;
      }

      log?.('[DISCOVERY] \u2713 Authorization Server Metadata validated:');
      log?.(`[DISCOVERY]   Issuer: ${metadata.issuer || issuer}`);
      log?.(`[DISCOVERY]   Authorization Endpoint: ${metadata.authorization_endpoint}`);
      log?.(`[DISCOVERY]   Token Endpoint: ${metadata.token_endpoint}`);
      log?.(`[DISCOVERY]   Registration Endpoint: ${metadata.registration_endpoint || 'none'}`);
      log?.(`[DISCOVERY]   PKCE Methods: ${metadata.code_challenge_methods_supported?.join(', ') || 'none'}`);
      log?.(`[DISCOVERY]   Grant Types: ${metadata.grant_types_supported?.join(', ') || 'not specified'}`);

      return { metadata: { ...metadata, issuer }, metadataUrl: candidate };
    } catch (error) {
      errors.push(`${candidate.toString()} -> ${(error as Error).message}`);
    }
  }

  throw new ConfigurationError(
    `Failed to retrieve authorization server metadata for issuer ${issuer}. Attempts:\n${errors.join('\n')}`
  );
}

export async function discoverOAuthMetadata(
  serverUrl: string,
  init?: RequestInit,
  log?: (message: string) => void,
  transportType?: string
): Promise<OAuthDiscoveryResult | null> {
  const server = new URL(serverUrl);
  // Skip WWW-Authenticate probe for SSE (streaming endpoint that returns 200 and hangs)
  const skipProbe = transportType === 'sse';
  const { resourceMetadataUrl: headerUrl, scopes } = await probeAuthenticateHeader(server, init, skipProbe, log);
  const resourceCandidates = buildResourceMetadataCandidates(server, headerUrl);
  const resourceResult = await fetchResourceMetadata(resourceCandidates, init, scopes, log);

  if (!resourceResult) {
    return null;
  }

  const errors: string[] = [];
  for (const issuer of resourceResult.metadata.authorization_servers) {
    try {
      const authorizationResult = await fetchAuthorizationMetadata(issuer, init, log);

      return {
        resource: resourceResult.metadata,
        authorizationServer: authorizationResult.metadata,
        resourceMetadataUrl: resourceResult.metadataUrl.toString(),
        authorizationMetadataUrl: authorizationResult.metadataUrl.toString(),
        challengeScopes: resourceResult.challengeScopes
      };
    } catch (error) {
      errors.push((error as Error).message);
    }
  }

  throw new ConfigurationError(
    `Authorization server discovery failed. Attempts:\n${errors.join('\n')}`
  );
}
