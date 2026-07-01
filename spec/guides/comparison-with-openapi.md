# MCP Description vs OpenAPI — Conceptual Comparison

This guide maps MCP Description concepts to OpenAPI for developers familiar with the API ecosystem.

## Quick Mapping

| OpenAPI Concept | MCP Description Equivalent | Notes |
|----------------|---------------------------|-------|
| `openapi: "3.1.0"` | `mcpdesc: "0.6.0"` | Specification version |
| `info` | `info` | Nearly identical structure |
| `servers` | `transports` | Connection endpoints |
| `paths` + operations | `tools` | Server capabilities |
| `webhooks` | — | No equivalent (MCP uses notifications) |
| `components/schemas` | `inputSchema` / `outputSchema` | Inline per-tool |
| `security` / `securitySchemes` | `security` | Same structure |
| `tags` | `tags` on tools/resources/prompts | Per-entity tagging |
| — | `resources` | No direct OpenAPI equivalent |
| — | `prompts` | No direct OpenAPI equivalent |
| `x-` extensions | `x-` extensions | Same convention |

## Detailed Comparison

### Info Object

Both specifications use a nearly identical `info` object:

**OpenAPI:**
```json
{
  "info": {
    "title": "Chess Coach API",
    "version": "2.1.0",
    "description": "Chess analysis and rating API",
    "contact": { "name": "Team", "email": "team@example.com" },
    "license": { "name": "MIT" }
  }
}
```

**MCP Description:**
```json
{
  "info": {
    "name": "chess-coach",
    "title": "Chess Coach MCP Server",
    "version": "2.1.0",
    "description": "Chess analysis and rating server",
    "contact": { "name": "Team", "email": "team@example.com" },
    "license": { "name": "MIT" }
  }
}
```

Key difference: MCP Description has both `name` (programmatic identifier, required) and `title` (human-readable, optional).

### Endpoints vs Transports

OpenAPI describes HTTP endpoints. MCP Description describes transport mechanisms:

**OpenAPI:**
```json
{
  "servers": [
    { "url": "https://api.example.com/v2" }
  ]
}
```

**MCP Description:**
```json
{
  "transports": [
    { "type": "streamable-http", "url": "https://example.com/mcp" },
    { "type": "stdio", "command": "chess-coach", "args": ["mcp"] }
  ]
}
```

MCP servers can be local processes (stdio), not just HTTP endpoints.

### Operations vs Tools

OpenAPI models HTTP operations (GET, POST, etc.). MCP Description models tools:

**OpenAPI:**
```json
{
  "paths": {
    "/games/{id}/analyze": {
      "post": {
        "operationId": "analyzeGame",
        "summary": "Analyze a chess game",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "depth": { "type": "integer" }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

**MCP Description:**
```json
{
  "tools": [
    {
      "name": "analyze_game",
      "description": "Analyze a chess game",
      "inputSchema": {
        "type": "object",
        "properties": {
          "pgn": { "type": "string" },
          "depth": { "type": "integer" }
        },
        "required": ["pgn"]
      }
    }
  ]
}
```

MCP tools are simpler — no HTTP verbs, path parameters, or content negotiation. Just a name, description, and input schema.

### Security

Both use the same security scheme structure (MCP Description adopted it from OpenAPI 3.1):

```json
{
  "security": [
    {
      "type": "http",
      "scheme": "bearer",
      "bearerFormat": "JWT"
    }
  ]
}
```

### What MCP Description Has That OpenAPI Doesn't

| Feature | Description |
|---------|-------------|
| **Resources** | Named data sources with URIs — no equivalent in REST (closest: well-known URLs) |
| **Resource Templates** | Parameterized URI templates for dynamic resources |
| **Prompts** | Server-side prompt templates with arguments |
| **Capabilities** | Feature flags (subscriptions, notifications, completions) |
| **Tool Annotations** | Behavioral hints (readOnly, destructive, idempotent) |

### What OpenAPI Has That MCP Description Doesn't

| Feature | Notes |
|---------|-------|
| **Path-based routing** | MCP tools are flat, not organized by path |
| **HTTP methods** | MCP uses tool names, not GET/POST/PUT/DELETE |
| **Content negotiation** | MCP uses structured JSON, not multiple media types |
| **Response codes** | MCP uses protocol-level success/error, not HTTP status codes |
| **Components/reuse** | MCP Description doesn't have `$ref` or shared components (yet) |
| **Webhooks** | MCP uses notifications within the protocol |

## When to Use Which

| Use Case | Format |
|----------|--------|
| HTTP REST API | OpenAPI |
| MCP server | MCP Description |
| Server exposing both REST and MCP | Both — OpenAPI for HTTP endpoints, MCP Description for MCP capabilities |
