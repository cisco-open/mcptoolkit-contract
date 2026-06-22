# OAuth Best Practices for MCP CLI Tools (November 2025 Specification)

**Status**: Design Guidance  
**Created**: 2026-01-19  
**Target Version**: v0.18.0+  
**Specification**: MCP November 2025 Authorization Updates  
**Related**: [33-oauth-authentication.md](33-oauth-authentication.md)

## Executive Summary

This document provides authoritative guidance for implementing OAuth authentication in `mcpcontract` CLI based on the **November 2025 MCP specification** authorization updates. It corrects common misunderstandings and establishes the correct mental model for CLI-based OAuth in the MCP ecosystem.

## 1️⃣ Problem Framing: CLI + MCP + OAuth

### What `mcpcontract` Is (from OAuth perspective)

The `mcpcontract` CLI tool is:
- ✅ **A public OAuth client** (no client secrets)
- ✅ **Running on a developer machine** (not in a browser, not in a server)
- ✅ **Talking to MCP servers** acting as OAuth resource servers
- ✅ **Very often NOT pre-registered** with authorization servers

### Key MCP Principles

**Principle 1**: MCP does not invent OAuth  
- MCP defines how discovery, tokens, and client identity fit together
- Standard OAuth 2.0 flows apply

**Principle 2**: CLI owns OAuth, MCP client uses tokens  
- Your CLI obtains OAuth tokens
- MCP client receives tokens as bearer credentials
- Clean separation of concerns

**Principle 3**: Discovery is mandatory  
- Never hardcode authorization endpoints
- Always discover from the MCP server or authorization server

## 2️⃣ Discovery Flow (Mandatory)

### Step 1: Discover Authorization Metadata from MCP Server

Per MCP November 2025 specification, discovery follows this order:

#### Primary: OAuth 2.0 Protected Resource Metadata (RFC 8707)

```http
GET https://mcp.example.com/.well-known/oauth-protected-resource
```

**Expected Response**:
```json
{
  "resource": "https://mcp.example.com",
  "authorization_servers": [
    "https://auth.example.com"
  ],
  "scopes_supported": [
    "mcp:read",
    "mcp:write",
    "mcp:admin"
  ],
  "bearer_methods_supported": ["header"]
}
```

#### Secondary: Follow Links to Authorization Server

```http
GET https://auth.example.com/.well-known/oauth-authorization-server
```

**Expected Response**:
```json
{
  "issuer": "https://auth.example.com",
  "authorization_endpoint": "https://auth.example.com/oauth/authorize",
  "token_endpoint": "https://auth.example.com/oauth/token",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "registration_endpoint": "https://auth.example.com/register"
}
```

#### Optional: OpenID Connect Discovery (Explicitly Allowed in November 2025)

```http
GET https://auth.example.com/.well-known/openid-configuration
```

### Critical Rules

🚫 **DO NOT** hardcode auth endpoints  
🚫 **DO NOT** assume a single identity provider  
🚫 **DO NOT** skip discovery

✅ **Always** fetch metadata from MCP server first  
✅ **Always** follow `authorization_servers` links  
✅ **Always** respect discovered endpoints

### Implementation in mcpcontract

```typescript
// src/lib/oauth-discovery.ts

export interface ResourceMetadata {
  resource: string;
  authorization_servers: string[];
  scopes_supported?: string[];
  bearer_methods_supported?: string[];
}

export interface AuthServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  response_types_supported: string[];
  grant_types_supported: string[];
  code_challenge_methods_supported: string[];
  token_endpoint_auth_methods_supported?: string[];
}

export class OAuthDiscovery {
  /**
   * Discover OAuth metadata from MCP server
   */
  async discover(mcpServerUrl: string): Promise<{
    resource: ResourceMetadata;
    authServer: AuthServerMetadata;
  }> {
    // Step 1: Fetch protected resource metadata
    const resourceUrl = new URL('.well-known/oauth-protected-resource', mcpServerUrl);
    const resourceResp = await fetch(resourceUrl.toString());
    
    if (!resourceResp.ok) {
      throw new Error(
        `Failed to discover OAuth metadata from MCP server: ${resourceResp.statusText}\n` +
        `Tried: ${resourceUrl.toString()}\n` +
        `Ensure server supports OAuth 2.0 Protected Resource Metadata (RFC 8707)`
      );
    }
    
    const resource = await resourceResp.json() as ResourceMetadata;
    
    // Step 2: Follow authorization_servers link
    if (!resource.authorization_servers || resource.authorization_servers.length === 0) {
      throw new Error('No authorization servers found in resource metadata');
    }
    
    const authServerIssuer = resource.authorization_servers[0];
    const authServerUrl = new URL('.well-known/oauth-authorization-server', authServerIssuer);
    const authServerResp = await fetch(authServerUrl.toString());
    
    if (!authServerResp.ok) {
      throw new Error(`Failed to discover authorization server metadata: ${authServerResp.statusText}`);
    }
    
    const authServer = await authServerResp.json() as AuthServerMetadata;
    
    // Validate PKCE support (required for CLI)
    if (!authServer.code_challenge_methods_supported?.includes('S256')) {
      throw new Error(
        'Authorization server does not support PKCE with S256. ' +
        'This is required for CLI OAuth flows.'
      );
    }
    
    return { resource, authServer };
  }
}
```

## 3️⃣ Choose the Correct OAuth Flow

### ✅ Use: Authorization Code + PKCE

This is the **ONLY** correct flow for CLI tools in MCP November 2025.

**Why Authorization Code + PKCE?**
- ✅ Standardized for native/public clients (RFC 7636, RFC 8252)
- ✅ User authenticates in their own browser (familiar, secure)
- ✅ No client secrets needed
- ✅ Supported by all modern authorization servers

### ❌ DO NOT Use These Flows

| Flow | Why NOT for CLI |
|------|----------------|
| **Client Credentials** | CLI ≠ confidential client<br>No client secrets in CLI tools<br>Meant for server-to-server |
| **Implicit Flow** | Deprecated (OAuth 2.1)<br>Insecure for native apps |
| **Resource Owner Password** | Never allowed in modern OAuth<br>Breaks SSO, MFA, federation |
| **Device Code Flow** | Worse UX than Auth Code + PKCE<br>Requires typing codes<br>Not needed for CLIs with browsers |

### Clarification vs. Previous Document

**33-oauth-authentication.md** (written before this guidance) proposed Device Code Flow as primary. This was incorrect for MCP November 2025.

**Corrected Approach**:
- Authorization Code + PKCE is the **primary** flow
- Device Code Flow is **not recommended** for MCP CLIs
- Client Credentials is **only** for server-to-server (non-interactive)

## 4️⃣ Client Identity: November 2025 Changes (Critical)

This is the **biggest difference** from June 2025 → November 2025.

### June 2025 Mindset (Old)

- Dynamic Client Registration was **strongly encouraged**
- Many implementations tried to auto-register CLIs
- **Painful in practice**: race conditions, rate limits, user confusion

### November 2025 Mindset (New)

You have **three valid options**, in priority order:

---

### ✅ Option A: Client ID Metadata Document (CIMD) — **RECOMMENDED**

**What is CIMD?**

Your CLI ships with:
- A static, globally unique `client_id`
- A publicly hosted metadata document describing the client

**Example `client_id`**:
```
com.cisco.devnet.mcpcontract
```

**Metadata Document** (hosted at stable HTTPS URL):
```json
{
  "client_id": "com.cisco.devnet.mcpcontract",
  "client_name": "mcpcontract CLI",
  "client_uri": "https://github.com/cisco-open/mcptoolkit-contract",
  "application_type": "native",
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "redirect_uris": [
    "http://127.0.0.1/callback",
    "http://localhost/callback"
  ],
  "token_endpoint_auth_method": "none",
  "software_id": "mcpcontract-cli",
  "software_version": "0.18.0"
}
```

**Where to Host**:
```
https://developer.cisco.com/docs/mcpcontract/.well-known/client-id-metadata.json
```

**Benefits**:
- ✅ No runtime registration required
- ✅ Authorization servers can pre-validate client identity
- ✅ Perfect for open-source CLIs
- ✅ User sees consistent client name/branding
- ✅ Simplifies enterprise policy management

**Implementation**:
```typescript
// src/lib/oauth-client-identity.ts

export const CLIENT_METADATA = {
  clientId: 'com.cisco.devnet.mcpcontract',
  clientMetadataUri: 'https://developer.cisco.com/docs/mcpcontract/.well-known/client-id-metadata.json',
  redirectUris: [
    'http://127.0.0.1/callback',
    'http://localhost/callback'
  ]
};

export async function getClientMetadata(): Promise<ClientMetadata> {
  // Optionally fetch and validate our own metadata
  const response = await fetch(CLIENT_METADATA.clientMetadataUri);
  return await response.json();
}
```

**Authorization Request**:
```http
GET /authorize?
  response_type=code
  &client_id=com.cisco.devnet.mcpcontract
  &redirect_uri=http://127.0.0.1/callback
  &scope=mcp:read+mcp:write
  &resource=https://mcp.example.com
  &code_challenge=...
  &code_challenge_method=S256
```

👉 **This is the November 2025 recommended approach for mcpcontract**

---

### 🟡 Option B: Dynamic Client Registration — **Fallback Only**

**When to Use**:
- The MCP server **explicitly requires** it (check `registration_endpoint` in discovery)
- You control both client and server (enterprise context)
- Authorization server doesn't support CIMD

**Implementation**:
```typescript
async function registerClient(
  registrationEndpoint: string,
  metadata: ClientMetadata
): Promise<string> {
  const response = await fetch(registrationEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata)
  });
  
  if (!response.ok) {
    throw new Error(`Dynamic registration failed: ${response.statusText}`);
  }
  
  const result = await response.json();
  return result.client_id;
}
```

**Problems with Dynamic Registration**:
- ❌ Race conditions (multiple CLI instances registering simultaneously)
- ❌ Rate limiting issues
- ❌ Storage complexity (where to save generated client_id?)
- ❌ User confusion (different client_id each time)

**Still allowed, but no longer expected.**

---

### 🟡 Option C: Pre-Registered Client ID — **Enterprise Context**

**When to Use**:
- Internal corporate CLIs
- Enterprise-managed distributions
- Controlled deployment environments

**Example**:
```typescript
// Hardcoded in enterprise build
const CLIENT_ID = 'mcpcontract-enterprise-v1';
```

**Coordination Required**:
- Authorization server admin must pre-register client
- Redirect URIs must be coordinated
- Version management needed

---

## 5️⃣ Token Acquisition Flow (End-to-End)

### Complete Authorization Code + PKCE Flow

#### Step 1: Start Local Callback Listener

```typescript
import { createServer, IncomingMessage, ServerResponse } from 'node:http';

class LocalCallbackServer {
  private server: ReturnType<typeof createServer>;
  private port: number = 0;
  private codePromise: Promise<string>;
  private resolveCode!: (code: string) => void;
  private rejectCode!: (error: Error) => void;
  
  constructor() {
    this.codePromise = new Promise((resolve, reject) => {
      this.resolveCode = resolve;
      this.rejectCode = reject;
    });
    
    this.server = createServer(this.handleRequest.bind(this));
  }
  
  async start(): Promise<number> {
    return new Promise((resolve) => {
      // Use port 0 to get a random available port
      this.server.listen(0, '127.0.0.1', () => {
        const addr = this.server.address();
        this.port = (addr as any).port;
        resolve(this.port);
      });
    });
  }
  
  getRedirectUri(): string {
    return `http://127.0.0.1:${this.port}/callback`;
  }
  
  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url!, `http://127.0.0.1:${this.port}`);
    
    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      
      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`<html><body><h1>Authentication Failed</h1><p>${error}</p></body></html>`);
        this.rejectCode(new Error(`OAuth error: ${error}`));
      } else if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>✅ Authentication Successful</h1><p>You can close this window and return to your terminal.</p></body></html>');
        this.resolveCode(code);
      } else {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>Invalid Request</h1></body></html>');
        this.rejectCode(new Error('No code received'));
      }
    }
  }
  
  async waitForCode(timeoutMs: number = 300000): Promise<string> {
    const timeout = new Promise<string>((_, reject) => {
      setTimeout(() => reject(new Error('OAuth timeout: user did not complete authentication')), timeoutMs);
    });
    
    return Promise.race([this.codePromise, timeout]);
  }
  
  async close(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => resolve());
    });
  }
}
```

#### Step 2: Generate PKCE Parameters

```typescript
import { randomBytes, createHash } from 'node:crypto';

function generateCodeVerifier(): string {
  // 43-128 characters, URL-safe
  return randomBytes(32)
    .toString('base64url')
    .replace(/=/g, '');
}

function generateCodeChallenge(verifier: string): string {
  return createHash('sha256')
    .update(verifier)
    .digest('base64url')
    .replace(/=/g, '');
}

const codeVerifier = generateCodeVerifier();
const codeChallenge = generateCodeChallenge(codeVerifier);
```

#### Step 3: Open Browser to Authorization Endpoint

```typescript
function buildAuthorizationUrl(
  authEndpoint: string,
  clientId: string,
  redirectUri: string,
  scopes: string[],
  resource: string,
  codeChallenge: string
): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(' '),
    resource: resource,  // ← CRITICAL: RFC 8707 resource parameter
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state: randomBytes(16).toString('hex')
  });
  
  return `${authEndpoint}?${params.toString()}`;
}

async function openBrowser(url: string): Promise<void> {
  const { exec } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execAsync = promisify(exec);
  
  const platform = process.platform;
  let command: string;
  
  if (platform === 'darwin') {
    command = `open "${url}"`;
  } else if (platform === 'win32') {
    command = `start "" "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }
  
  try {
    await execAsync(command);
  } catch (error) {
    console.error('❌ Failed to open browser automatically.');
    console.error(`   Please visit: ${url}`);
  }
}
```

#### Step 4: Exchange Authorization Code for Tokens

```typescript
async function exchangeCodeForToken(
  tokenEndpoint: string,
  clientId: string,
  code: string,
  redirectUri: string,
  codeVerifier: string,
  resource: string
): Promise<TokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    client_id: clientId,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    resource: resource  // ← CRITICAL: RFC 8707 resource parameter
  });
  
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: params.toString()
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `Token exchange failed: ${error.error_description || error.error}`
    );
  }
  
  const tokens = await response.json();
  
  return {
    access_token: tokens.access_token,
    token_type: tokens.token_type,
    expires_in: tokens.expires_in,
    refresh_token: tokens.refresh_token,
    scope: tokens.scope
  };
}
```

### Critical: Resource Parameter (RFC 8707)

📌 **Always include `resource` parameter**

MCP expects **resource-scoped access tokens**. This tells the authorization server:
- Which resource (MCP server) the token is for
- Enables fine-grained access control
- Prevents token misuse across different APIs

**Example**:
```
resource=https://mcp.example.com
```

**Without resource parameter**: Token may be too broadly scoped or rejected by MCP server.

## 6️⃣ Handing Tokens to MCP Client

### Clean Separation of Concerns

**Critical Principle**: MCP stays cleanly separated from OAuth.

| Responsibility | Owner |
|----------------|-------|
| OAuth UI (browser, prompts) | Your CLI (`mcpcontract`) |
| Token acquisition | Your CLI |
| Token storage | Your CLI |
| Token refresh | Your CLI |
| Token usage (Authorization header) | MCP client |
| Authorization checks | MCP server |

### Implementation Pattern

```typescript
// src/lib/oauth-manager.ts

export class OAuthManager {
  async getAccessToken(mcpServerUrl: string): Promise<string> {
    // 1. Check token cache
    const cached = await this.tokenStorage.load(mcpServerUrl);
    if (cached && !this.isExpired(cached)) {
      return cached.access_token;
    }
    
    // 2. Refresh if possible
    if (cached?.refresh_token) {
      return await this.refreshToken(cached);
    }
    
    // 3. Run full OAuth flow
    return await this.runAuthorizationCodeFlow(mcpServerUrl);
  }
}

// src/lib/client.ts

export class MCPClient {
  constructor(config: ServerConfig, oauthManager?: OAuthManager) {
    this.config = config;
    this.oauthManager = oauthManager;
    // ...
  }
  
  async connect(): Promise<void> {
    // Inject OAuth token if available
    if (this.oauthManager) {
      const accessToken = await this.oauthManager.getAccessToken(this.config.transport.url);
      
      // Add Authorization header to transport
      if (this.config.transport.type === 'streamable-http') {
        this.config.transport.headers = this.config.transport.headers || {};
        this.config.transport.headers['Authorization'] = `Bearer ${accessToken}`;
      }
    }
    
    // Continue with normal connection
    await this.connectHttp();
  }
}
```

### What MCP Client Sees

```typescript
// MCP SDK perspective (conceptual)
const mcpClient = new Client(
  { name: 'mcpcontract', version: '0.18.0' },
  { capabilities: { ... } }
);

const transport = new StreamableHTTPClientTransport(
  new URL('https://mcp.example.com'),
  {
    requestInit: {
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJSUzI1NiIs...'  // ← CLI injects this
      }
    }
  }
);

await mcpClient.connect(transport);
```

### 📌 Key Point

- ✅ MCP treats OAuth tokens as **bearer credentials**
- ✅ Token refresh is **CLI's responsibility**, not MCP SDK's
- ✅ MCP client just sends `Authorization` header
- ❌ MCP SDK does **NOT** open browsers
- ❌ MCP SDK does **NOT** manage OAuth state

## 7️⃣ Token Storage & Refresh (CLI Best Practices)

### Secure Storage

#### Option 1: OS Keychain (Recommended)

Use native credential storage:

**macOS**: Keychain
**Windows**: Credential Manager
**Linux**: Secret Service API (libsecret)

```typescript
// Using 'keytar' or '@electron/remote' (if available)
import keytar from 'keytar';

const SERVICE_NAME = 'com.cisco.devnet.mcpcontract';

async function storeToken(mcpServerUrl: string, token: string): Promise<void> {
  await keytar.setPassword(SERVICE_NAME, mcpServerUrl, token);
}

async function retrieveToken(mcpServerUrl: string): Promise<string | null> {
  return await keytar.getPassword(SERVICE_NAME, mcpServerUrl);
}
```

#### Option 2: Encrypted File (Fallback)

If OS keychain unavailable:

```typescript
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

class EncryptedTokenStorage {
  private basePath: string;
  private encryptionKey: Buffer;
  
  constructor() {
    this.basePath = join(homedir(), '.mcpcontract', 'tokens');
    this.encryptionKey = this.getOrCreateKey();
  }
  
  private getOrCreateKey(): Buffer {
    // Derive key from machine-specific data
    // Or prompt user for passphrase (more secure)
    const keyPath = join(this.basePath, '.key');
    
    if (existsSync(keyPath)) {
      return readFileSync(keyPath);
    }
    
    const key = randomBytes(32);
    mkdirSync(this.basePath, { recursive: true, mode: 0o700 });
    writeFileSync(keyPath, key, { mode: 0o600 });
    return key;
  }
  
  async save(serverUrl: string, tokenData: string): Promise<void> {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    
    let encrypted = cipher.update(tokenData, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    
    const payload = JSON.stringify({
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      encrypted
    });
    
    const filePath = this.getTokenPath(serverUrl);
    await writeFile(filePath, payload, { mode: 0o600 });
  }
  
  async load(serverUrl: string): Promise<string | null> {
    const filePath = this.getTokenPath(serverUrl);
    if (!existsSync(filePath)) return null;
    
    const payload = JSON.parse(await readFile(filePath, 'utf-8'));
    
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      Buffer.from(payload.iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(payload.authTag, 'hex'));
    
    let decrypted = decipher.update(payload.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
  
  private getTokenPath(serverUrl: string): string {
    const hash = createHash('sha256').update(serverUrl).digest('hex');
    return join(this.basePath, `${hash.substring(0, 16)}.enc`);
  }
}
```

#### ❌ Never Store Tokens in Plaintext

```typescript
// ❌ NEVER DO THIS
await writeFile('~/.mcpcontract/token.json', JSON.stringify(tokens));
```

**Why?**
- Tokens are credentials
- Plaintext files can leak via backups, logs, git commits
- OS keychain or encryption is mandatory

### Token Refresh

#### Automatic Refresh (Preferred)

```typescript
class TokenManager {
  private refreshThreshold = 300; // 5 minutes before expiry
  
  async getValidToken(serverUrl: string): Promise<string> {
    const stored = await this.storage.load(serverUrl);
    
    if (!stored) {
      throw new Error('No token found. Please run: mcpcontract auth login');
    }
    
    // Check if expired
    const expiresAt = new Date(stored.expires_at);
    const now = new Date();
    
    if (expiresAt <= now) {
      // Expired - must refresh
      if (stored.refresh_token) {
        return await this.refreshToken(stored);
      } else {
        throw new Error('Token expired and no refresh token available. Please re-authenticate.');
      }
    }
    
    // Check if needs refresh (within threshold)
    const secondsUntilExpiry = (expiresAt.getTime() - now.getTime()) / 1000;
    if (secondsUntilExpiry <= this.refreshThreshold && stored.refresh_token) {
      console.error('🔄 Token expiring soon, refreshing...');
      return await this.refreshToken(stored);
    }
    
    return stored.access_token;
  }
  
  private async refreshToken(stored: StoredToken): Promise<string> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: stored.refresh_token,
      client_id: CLIENT_METADATA.clientId,
      resource: stored.resource
    });
    
    const response = await fetch(stored.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    
    if (!response.ok) {
      throw new Error('Token refresh failed. Please re-authenticate.');
    }
    
    const tokens = await response.json();
    
    // Update stored tokens
    stored.access_token = tokens.access_token;
    stored.expires_at = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    if (tokens.refresh_token) {
      stored.refresh_token = tokens.refresh_token;
    }
    
    await this.storage.save(stored.server_url, stored);
    
    return tokens.access_token;
  }
}
```

#### Refresh vs. Re-authenticate

| Scenario | Action |
|----------|--------|
| Token expired + refresh token exists | Refresh automatically |
| Token expired + no refresh token | Prompt user to re-authenticate |
| Refresh fails (invalid_grant) | Clear tokens, re-authenticate |
| Network error during refresh | Retry with backoff |

## 8️⃣ What NOT to Do (Common Mistakes)

### ❌ Mistake 1: Baking OAuth Logic into MCP Server Code

**Wrong**:
```typescript
// In MCP server implementation
app.get('/mcp', async (req, res) => {
  // ❌ MCP server should NOT handle OAuth redirects
  if (!req.headers.authorization) {
    return res.redirect('/oauth/login');
  }
  // ...
});
```

**Right**:
```typescript
// MCP server just validates tokens
app.get('/mcp', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  // Validate token with authorization server
  const valid = await validateToken(token);
  
  if (!valid) {
    return res.status(401).json({ error: 'invalid_token' });
  }
  
  // Proceed with MCP request
});
```

### ❌ Mistake 2: Letting MCP SDK "Magically" Open Browsers

**Wrong**:
```typescript
// ❌ DO NOT expect MCP SDK to handle OAuth UI
const client = new McpClient({
  auth: {
    type: 'oauth',
    // SDK opens browser? NO!
  }
});
```

**Right**:
```typescript
// ✅ CLI handles OAuth, then injects token
const accessToken = await oauthManager.getAccessToken(serverUrl);

const client = new McpClient(/* ... */);
const transport = new StreamableHTTPClientTransport(url, {
  requestInit: {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  }
});
```

### ❌ Mistake 3: Assuming Dynamic Registration Always Exists

**Wrong**:
```typescript
// ❌ Always trying to register
const clientId = await registerClient(registrationEndpoint, metadata);
```

**Right**:
```typescript
// ✅ Use static client_id with CIMD
const clientId = CLIENT_METADATA.clientId;

// Only register if explicitly required
if (authServer.registration_endpoint && !CLIENT_METADATA.clientId) {
  const clientId = await registerClient(authServer.registration_endpoint, metadata);
}
```

### ❌ Mistake 4: Ignoring Resource Parameter

**Wrong**:
```typescript
// ❌ Missing resource parameter
const params = new URLSearchParams({
  grant_type: 'authorization_code',
  code: code,
  client_id: clientId
  // Missing: resource
});
```

**Right**:
```typescript
// ✅ Always include resource (RFC 8707)
const params = new URLSearchParams({
  grant_type: 'authorization_code',
  code: code,
  client_id: clientId,
  resource: 'https://mcp.example.com'  // ← CRITICAL
});
```

### ❌ Mistake 5: Using Client Secrets in CLI

**Wrong**:
```typescript
// ❌ NEVER ship client secrets in CLI
const CLIENT_SECRET = 'super-secret-key-123';
```

**Right**:
```typescript
// ✅ Public client, no secrets
const CLIENT_ID = 'com.cisco.devnet.mcpcontract';
const TOKEN_AUTH_METHOD = 'none';  // Public client
```

## 9️⃣ Mental Model: Separation of Concerns

| Concern | Who Owns It | Why |
|---------|-------------|-----|
| **OAuth UX** | Your CLI (`mcpcontract`) | User interacts with CLI, not MCP |
| **OAuth tokens** | Your CLI | Credentials belong to the tool |
| **Token refresh** | Your CLI | Lifecycle management at CLI level |
| **Token usage** | MCP client | Just passes `Authorization` header |
| **Authorization checks** | MCP server | Server validates tokens |

### Layer Diagram

```
┌─────────────────────────────────────────┐
│         User (Developer)                │
└──────────────┬──────────────────────────┘
               │ Runs command
               ▼
┌─────────────────────────────────────────┐
│    mcpcontract CLI (OAuth Owner)        │
│  - Discovers OAuth metadata             │
│  - Opens browser for auth               │
│  - Exchanges code for token             │
│  - Stores & refreshes tokens            │
└──────────────┬──────────────────────────┘
               │ Injects token
               ▼
┌─────────────────────────────────────────┐
│    MCP Client (Token User)              │
│  - Adds Authorization header            │
│  - Sends MCP requests                   │
└──────────────┬──────────────────────────┘
               │ HTTP + Bearer token
               ▼
┌─────────────────────────────────────────┐
│    MCP Server (Resource Server)         │
│  - Validates token                      │
│  - Enforces permissions                 │
│  - Returns MCP responses                │
└─────────────────────────────────────────┘
```

## 🔟 Node OAuth Client Selection (Headless CLI)

### Evaluation Criteria

- Native Node.js 18+ support with ESM compatibility
- First-class Authorization Code + PKCE coverage
- No dependency on browser globals (works in headless terminals)
- Minimal transitive dependency footprint (keep CLI lean)
- Extensible for refresh tokens, dynamic registration, and discovery hooks

### Candidate Libraries

| Library | Strengths | Drawbacks | Suitability |
|---------|-----------|-----------|-------------|
| `openid-client` | Standards-compliant (OAuth 2.0, OIDC, PKCE), supports dynamic client metadata, built-in discovery helpers, proven in production CLIs | Larger bundle, requires careful tree-shaking to avoid unused OIDC extras | **Preferred** – comprehensive feature set, active maintenance |
| `simple-oauth2` | Light abstraction over token exchange, friendly API | No discovery, limited PKCE helpers, lacks native resource parameter support | Acceptable only with significant custom glue code |
| `client-oauth2` | Minimal footprint, browser-friendly | Stagnant maintenance, lacks PKCE, assumes implicit flow defaults | Not recommended |
| Roll-your-own (`node-fetch` + custom code) | Full control, zero external deps | High security risk, more code to audit, easy to miss edge cases | Avoid unless libraries become untenable |

### Recommendation

- Adopt `openid-client` for the Authorization Code + PKCE implementation. It already exposes:
  - `BaseClient.authorizationUrl` for constructing URLs with PKCE and resource parameters
  - `BaseClient.callback` for code-for-token exchange with PKCE verifiers
  - `ClientMetadata` typing that maps to Client ID Metadata Document
- Create a thin wrapper (`src/lib/oauth-client.ts`) to encapsulate library usage and keep call sites stable.
- Limit imports to needed helpers (authorization code + refresh) to keep bundle size controlled.

### Headless and Non-Interactive Environments

- `openid-client` does not force a UI; we control the browser launch step.
- Provide CLI flags to disable auto-launch (`--no-browser`) and print the login URL for copy/paste.
- For CI or SSH sessions, allow overriding redirect handling with `--oauth-callback-port 0` (auto) or `--oauth-use-device-code` (future fallback if Authorization Code cannot run).
- Document that Authorization Code remains primary; Device Code becomes optional extension.

## 1️⃣1️⃣ Integration Plan for dump Command

### Flow Overview

1. User runs `mcpcontract dump --server https://mcp.example.com`.
2. Transport configuration detects OAuth capability during discovery (RFC 8707 metadata present).
3. `OAuthManager` resolves access token (cached → refresh → full auth flow).
4. Token is injected into `StreamableHTTPClientTransport` headers before the dump execution begins.
5. Dump proceeds exactly as today, now authorized for protected resources.

### CLI UX & Options

- New flags in [src/commands/dump.ts](src/commands/dump.ts#L1-L200):
  - `--auth oauth` (default: auto) – force OAuth Authorization Code flow.
  - `--no-browser` – suppress auto browser launch and print login URL.
  - `--oauth-scope <scope>` (repeatable) – append custom scopes beyond discovery defaults.
  - `--oauth-resource <uri>` – override discovered resource when multiple entries exist.
  - `--oauth-callback-port <port>` – bind local listener to a fixed port for firewall-restricted environments.
- User prompts clearly communicate next steps (open browser, watch console for success, handle timeouts).

### Token Storage & Multi-Server Support

- Cache tokens per MCP server origin in keychain/encrypted storage (see Section 7️⃣).
- Persist `issuer`, `token_endpoint`, and granted scopes with each cache entry to validate reuse.
- Invalidate cache automatically when diff/breaking analysis detects revoked scopes or `invalid_grant`.

### Error Handling

- Discovery failure → fall back to existing unauthenticated dump with warning unless `--auth oauth` is explicit.
- Browser launch failure → print URL and keep listener alive until timeout.
- Token exchange errors (network, invalid_grant) → surface actionable message and clear cache.
- Timeout (default 5 minutes) → stop listener and guide user to retry.

### Headless / SSH-Friendly Flow

- With `--no-browser`, display:
  - Authorization URL (with state, PKCE challenge already embedded).
  - Instructions to paste in any browser and return when finished.
  - Polling message while listener waits for callback.
- If local callback port cannot be opened, fall back to manual copy-paste of authorization response URI.
- Investigate `loopback://` custom scheme only if required by future Platform constraints; not needed initially.

### Testing Strategy

- Unit-test `OAuthManager` with mocked `openid-client` responses (success, refresh, error paths).
- Integration-test `dump` against mock MCP server + mock authorization server (e.g., `openid-client` `Issuer.discover` + `nock`).
- Manual regression: GitHub, Auth0, Okta sandboxes; include Linux headless (WSL/SSH) scenario.
- Ensure non-OAuth servers still operate without regression.

## 1️⃣2️⃣ TL;DR Implementation Checklist

### Essential (v0.18.0)

- [ ] **Use Authorization Code + PKCE** (ONLY correct flow for CLI)
- [ ] **Discover auth metadata** from MCP server (RFC 8707)
- [ ] **Implement Client ID Metadata Document** (November 2025 best practice)
- [ ] **Always request resource-scoped tokens** (RFC 8707)
- [ ] **Inject token into MCP client** (don't mix layers)
- [ ] **Store tokens in OS keychain** (or encrypted file)
- [ ] **Auto-refresh tokens** before expiry
- [ ] **Clean separation**: CLI owns OAuth, MCP uses tokens

### Quality Checks

- [ ] No client secrets in code
- [ ] No hardcoded auth endpoints
- [ ] No plaintext token storage
- [ ] PKCE with S256 method
- [ ] Resource parameter in all token requests
- [ ] Proper error messages (guide user to re-authenticate)
- [ ] Browser fallback (if auto-open fails)

### Testing

- [ ] Test with real authorization server (GitHub, Auth0, Okta)
- [ ] Test token refresh logic
- [ ] Test expired token handling
- [ ] Test concurrent CLI instances (token cache safety)
- [ ] Test network failures (retry logic)

## References

- **MCP Specification**: November 2025 Authorization Updates
- **RFC 8252**: OAuth 2.0 for Native Apps
- **RFC 7636**: Proof Key for Code Exchange (PKCE)
- **RFC 8707**: Resource Indicators for OAuth 2.0
- **RFC 6749**: OAuth 2.0 Authorization Framework
- **Previous Document**: [33-oauth-authentication.md](33-oauth-authentication.md) (Device Code approach - superseded)

## Migration from 33-oauth-authentication.md

### Key Changes

| Aspect | Old (33) | New (33b) |
|--------|----------|-----------|
| **Primary Flow** | Device Code Flow | Authorization Code + PKCE |
| **Client Identity** | Dynamic registration or pre-registration | Client ID Metadata Document (CIMD) |
| **Discovery** | From serverInfo.authentication | OAuth 2.0 Protected Resource Metadata (RFC 8707) |
| **Resource Parameter** | Not emphasized | **Critical** - always required |
| **Mental Model** | CLI as one option | CLI as **the** correct approach |

### Action Items

1. Update [33-oauth-authentication.md](33-oauth-authentication.md) with deprecation notice
2. Implement RFC 8707 discovery in `oauth-discovery.ts`
3. Create Client ID Metadata Document and host it
4. Prioritize Authorization Code + PKCE in implementation
5. Move Device Code Flow to "alternative flows" (rarely needed)

---

**Status**: Ready for implementation review and team feedback.
