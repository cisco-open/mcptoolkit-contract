## 6. Transports

The `transports` property declares one or more communication mechanisms supported by the MCP server. It is REQUIRED and MUST contain at least one transport object.

### 6.1 Overview

MCP servers can be accessed through different transport mechanisms. The `transports` array allows a single MCP Description document to declare all supported transports, enabling clients to select the most appropriate one.

### 6.2 Transport Types

Each transport object MUST include a `type` property. The following transport types are defined:

#### 6.2.1 Streamable HTTP Transport

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `"streamable-http"` | **Yes** | Transport type identifier |
| `url` | string (URI) | **Yes** | MCP endpoint URL |

The streamable HTTP transport connects to an MCP server over HTTP with streaming response support. This is the RECOMMENDED transport for remote MCP servers.

```json
{
  "type": "streamable-http",
  "url": "https://chess-coach.example.com/mcp"
}
```

#### 6.2.2 stdio Transport

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `"stdio"` | **Yes** | Transport type identifier |
| `command` | string | **Yes** | Command to launch the server |
| `args` | array\<string\> | No | Command arguments |
| `env` | object | No | Environment variables (string values) |

The stdio transport launches the MCP server as a subprocess and communicates over standard input/output.

```json
{
  "type": "stdio",
  "command": "chess-coach",
  "args": ["mcp", "--level", "advanced"],
  "env": {
    "CHESS_DB_PATH": "/data/games.db"
  }
}
```

#### 6.2.3 SSE Transport (Legacy)

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `"sse"` | **Yes** | Transport type identifier |
| `url` | string (URI) | **Yes** | SSE endpoint URL |

The Server-Sent Events transport is a legacy transport type retained for backward compatibility. New implementations SHOULD use `streamable-http` instead.

```json
{
  "type": "sse",
  "url": "https://chess-coach.example.com/sse"
}
```

### 6.3 Multiple Transports

A server MAY support multiple transports. Clients SHOULD select the most appropriate transport based on their environment and capabilities.

```json
{
  "transports": [
    { "type": "streamable-http", "url": "https://chess-coach.example.com/mcp" },
    { "type": "stdio", "command": "chess-coach", "args": ["mcp"] }
  ]
}
```

### 6.4 Transport-Scoped Security

Each transport object MAY include a `security` property containing an array of security scheme objects (see Section 7). When present, this transport-level security overrides the root-level `security` for that transport.

| Scenario | Effective security |
|----------|-------------------|
| Root `security` defined, transport `security` omitted | Inherits root security |
| Root `security` defined, transport `security` is `[]` (empty) | Explicitly no authentication |
| Root `security` defined, transport `security` defined | Transport's own security |
| Root `security` omitted, transport `security` omitted | No authentication |

This mechanism allows a single MCP Description document to declare different security requirements for different transports. For example, an HTTP transport typically requires bearer authentication while a stdio transport relies on OS-level process isolation:

```json
{
  "transports": [
    {
      "type": "streamable-http",
      "url": "https://chess-coach.example.com/mcp",
      "security": [
        { "type": "http", "scheme": "bearer", "bearerFormat": "JWT" }
      ]
    },
    {
      "type": "stdio",
      "command": "chess-coach",
      "args": ["mcp"],
      "security": []
    }
  ]
}
```

### 6.5 Extensibility

Transport objects MUST NOT contain additional properties beyond those defined for their type (plus the optional `security` property). Vendor-specific transport metadata SHOULD be placed in specification extensions at the root level.

