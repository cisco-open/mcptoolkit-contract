## 7. Security

The `security` property declares the authentication and authorization schemes supported by the server. It is OPTIONAL.

### 7.1 Overview

The security array describes how clients authenticate with the MCP server. The structure is aligned with [OpenAPI 3.1 Security Scheme Objects](https://spec.openapis.org/oas/v3.1.0#security-scheme-object), enabling reuse of existing security tooling and patterns.

When `security` is omitted or an empty array, the server does not require authentication.

Root-level `security` acts as the default for all transports. Individual transports MAY override this default by including their own `security` property (see Section 6.4).

### 7.2 Security Scheme Object

Each security scheme object MUST include a `type` property.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | string | **Yes** | Scheme type: `"http"`, `"apiKey"`, `"oauth2"`, or `"openIdConnect"` |
| `scheme` | string | Conditional | HTTP auth scheme (e.g., `"bearer"`, `"basic"`). REQUIRED when `type` is `"http"`. |
| `bearerFormat` | string | No | Bearer token format hint (e.g., `"JWT"`). |
| `name` | string | Conditional | API key name. REQUIRED when `type` is `"apiKey"`. |
| `in` | string | Conditional | API key location: `"header"`, `"query"`, or `"cookie"`. REQUIRED when `type` is `"apiKey"`. |
| `flows` | [OAuth Flows Object](#73-oauth-flows-object) | Conditional | OAuth2 flows. REQUIRED when `type` is `"oauth2"`. |
| `openIdConnectUrl` | string (URI) | Conditional | OpenID Connect discovery URL. REQUIRED when `type` is `"openIdConnect"`. |
| `description` | string | No | Human-readable description of the security scheme. |

### 7.3 OAuth Flows Object

| Property | Type | Description |
|----------|------|-------------|
| `implicit` | [OAuth Flow Object](#74-oauth-flow-object) | Configuration for the OAuth2 implicit flow |
| `password` | [OAuth Flow Object](#74-oauth-flow-object) | Configuration for the resource owner password flow |
| `clientCredentials` | [OAuth Flow Object](#74-oauth-flow-object) | Configuration for the client credentials flow |
| `authorizationCode` | [OAuth Flow Object](#74-oauth-flow-object) | Configuration for the authorization code flow |

### 7.4 OAuth Flow Object

| Property | Type | Description |
|----------|------|-------------|
| `authorizationUrl` | string (URI) | Authorization endpoint URL |
| `tokenUrl` | string (URI) | Token endpoint URL |
| `refreshUrl` | string (URI) | Refresh token endpoint URL |
| `scopes` | object | Available scopes (key: scope name, value: description) |

### 7.5 Examples

**Bearer token authentication:**

```json
{
  "security": [
    {
      "type": "http",
      "scheme": "bearer",
      "bearerFormat": "JWT",
      "description": "JWT token issued by the chess platform"
    }
  ]
}
```

**API key authentication:**

```json
{
  "security": [
    {
      "type": "apiKey",
      "name": "X-Chess-API-Key",
      "in": "header",
      "description": "API key for accessing the chess rating service"
    }
  ]
}
```

**OAuth2 with authorization code flow:**

```json
{
  "security": [
    {
      "type": "oauth2",
      "flows": {
        "authorizationCode": {
          "authorizationUrl": "https://auth.example.com/authorize",
          "tokenUrl": "https://auth.example.com/token",
          "scopes": {
            "games:read": "Read game history",
            "games:write": "Submit new games",
            "ratings:read": "View player ratings"
          }
        }
      }
    }
  ]
}
```

