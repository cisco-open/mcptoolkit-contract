# MCP Dump Schema Documentation

## Overview

The **MCP Dump Schema** defines the structure for complete capability snapshots of Model Context Protocol (MCP) servers. A dump is a comprehensive, point-in-time capture of everything an MCP server exposes: tools, resources, prompts, and metadata about how the server was accessed and what it supports.

## Purpose

The dump schema serves several critical purposes:

1. **Server Discovery** - Captures the complete API surface of an MCP server for documentation and analysis
2. **Version Tracking** - Enables comparison between server versions to detect breaking changes
3. **Contract Generation** - Provides the foundation for generating registry-compatible manifests
4. **Testing & Validation** - Serves as a reference for testing client implementations
5. **Documentation** - Acts as the source of truth for generating human-readable API documentation

## Schema Versions

The dump schema follows semantic versioning and is tracked separately from the CLI tool version:

- **Current Version**: `0.3.6` (as of 2026-01-22)
- **Schema Location**: `schemas/dump/0.3.6.json`
- **Schema ID**: `https://developer.cisco.com/mcp_contract_dump/schema/0.3.6`

Historical schemas are preserved in `schemas/dump/` to support validation of older dumps.

## Basic Structure

A dump file consists of seven main sections:

```json
{
  "version": "schema-version-url",
  "dumpDetails": { /* metadata about the dump process */ },
  "serverInfo": { /* server identification and capabilities */ },
  "tools": [ /* array of tool definitions */ ],
  "resources": [ /* array of resource definitions */ ],
  "resourceTemplates": [ /* array of URI templates */ ],
  "prompts": [ /* array of prompt definitions */ ],
  "roots": [ /* optional: root URIs if supported */ ]
}
```

## Core Sections

### 1. Version

```json
{
  "version": "https://developer.cisco.com/mcp_contract_dump/schema/0.3.6"
}
```

- **Required**: Yes
- **Purpose**: Identifies which dump schema version this file conforms to
- **Usage**: Enables schema validation and version-specific processing

### 2. Dump Details

Metadata about how and when the dump was created:

```json
{
  "dumpDetails": {
    "toolName": "mcpcontract",
    "toolVersion": "0.17.0",
    "description": "Optional human-readable description",
    "createdAt": "2026-01-22T10:30:00Z",
    "mcpServerConfig": {
      "name": "My MCP Server",
      "transport": "streamable-http",
      "url": "https://example.com/mcp"
    },
    "dumpExecution": {
      "mcpProtocolUsed": "2025-06-18",
      "sessionIdSupported": true,
      "sessionIdHeader": "Mcp-Session-Id",
      "clientCapabilitiesSent": { /* capabilities */ },
      "corsSupport": { /* browser compatibility */ },
      "pingSupported": true,
      "pingLatencyMs": 45.2,
      "paginationSupport": { /* pagination details */ }
    }
  }
}
```

**Key Fields**:
- `toolName` / `toolVersion` - Which tool created this dump
- `createdAt` - Timestamp for version tracking
- `mcpServerConfig` - Connection details (transport type, URL, headers, etc.)
- `dumpExecution` - Runtime discoveries about the server:
  - MCP protocol version used
  - Session management (HTTP-based transports)
  - CORS support for browser compatibility
  - Ping/keepalive support
  - Pagination detection

### 3. Server Info

Information from the server's initialization response:

```json
{
  "serverInfo": {
    "name": "example-server",
    "version": "1.2.3",
    "protocolVersion": "2025-06-18",
    "capabilities": {
      "tools": { "listChanged": true },
      "resources": { "subscribe": true, "listChanged": true },
      "prompts": { "listChanged": false },
      "logging": {},
      "experimental": {}
    },
    "instructions": "Optional usage instructions from server"
  }
}
```

**Key Fields**:
- `name` / `version` - Server identification
- `protocolVersion` - Which MCP spec the server implements
- `capabilities` - What features the server supports
- `instructions` - Server-provided guidance for clients

### 4. Tools

Array of executable tools exposed by the server:

```json
{
  "tools": [
    {
      "name": "search_files",
      "description": "Search for files matching a pattern",
      "tags": ["filesystem", "search"],
      "deprecated": false,
      "inputSchema": {
        "type": "object",
        "properties": {
          "pattern": {
            "type": "string",
            "description": "Glob pattern to match"
          }
        },
        "required": ["pattern"]
      },
      "outputSchema": { /* optional: response structure */ },
      "responseExamples": [ /* optional: example responses */ ]
    }
  ]
}
```

**Key Fields**:
- `name` - Unique identifier for the tool
- `description` - What the tool does
- `inputSchema` - JSON Schema defining parameters
- `outputSchema` - (Optional) Expected response structure
- `responseExamples` - (Enrichment) Example outputs for documentation

### 5. Resources

Array of static or dynamic data sources:

```json
{
  "resources": [
    {
      "uri": "file:///project/README.md",
      "name": "Project README",
      "description": "Main project documentation",
      "tags": ["documentation"],
      "mimeType": "text/markdown",
      "deprecated": false,
      "contentExamples": [ /* optional: example content */ ],
      "annotations": {
        "audience": ["user"],
        "priority": 0.9
      }
    }
  ]
}
```

**Key Fields**:
- `uri` - Unique identifier for the resource
- `name` / `description` - Human-readable metadata
- `mimeType` - Content type
- `annotations` - Additional metadata (audience, priority)

### 6. Resource Templates

URI templates (RFC 6570) for dynamic resources:

```json
{
  "resourceTemplates": [
    {
      "uriTemplate": "file:///{path}",
      "name": "File Access",
      "description": "Access any file by path",
      "tags": ["filesystem"],
      "mimeType": "application/octet-stream",
      "annotations": {}
    }
  ]
}
```

**Key Fields**:
- `uriTemplate` - RFC 6570 template with variables
- Same metadata fields as resources

### 7. Prompts

Pre-defined prompt templates:

```json
{
  "prompts": [
    {
      "name": "code_review",
      "description": "Review code for best practices",
      "tags": ["code", "review"],
      "deprecated": false,
      "arguments": [
        {
          "name": "language",
          "description": "Programming language",
          "required": true,
          "examples": ["python", "javascript", "rust"]
        }
      ]
    }
  ]
}
```

**Key Fields**:
- `name` - Unique identifier
- `arguments` - Parameters the prompt accepts

## Advanced Features

### Pagination Detection

The schema tracks which capabilities use cursor-based pagination:

```json
{
  "dumpExecution": {
    "paginationSupport": {
      "tools": {
        "paginationDetected": true,
        "pagesRetrieved": 3,
        "totalItems": 127
      }
    }
  }
}
```

This zero-overhead detection happens automatically during dump creation.

### CORS Support Detection

For HTTP-based transports, the schema captures browser compatibility:

```json
{
  "dumpExecution": {
    "corsSupport": {
      "browserReady": true,
      "responseHeaders": {
        "accessControlAllowOrigin": "*",
        "accessControlExposeHeaders": ["Mcp-Session-Id"]
      },
      "preflight": {
        "tested": true,
        "status": 200,
        "accessControlAllowMethods": ["GET", "POST"],
        "accessControlAllowHeaders": ["Content-Type", "Mcp-Session-Id"]
      }
    }
  }
}
```

### Session Management

For stateful HTTP servers:

```json
{
  "dumpExecution": {
    "sessionIdSupported": true,
    "sessionIdHeader": "Mcp-Session-Id"
  }
}
```

## Usage in mcpcontract Workflow

```bash
# 1. Create a dump
mcpcontract dump --config server.json --output server-dump.json

# 2. Validate the dump
mcpcontract validate --type dump --file server-dump.json

# 3. Generate manifest from dump
mcpcontract manifest --mcpdesc server-dump.json --info metadata.yaml --output manifest.json

# 4. Generate documentation
mcpcontract document server-dump.json --output README.md

# 5. Compare versions
mcpcontract diff --old v1-dump.json --new v2-dump.json --output changes.json

# 6. Detect breaking changes
mcpcontract breaking --diff changes.json --output analysis.json
```

## Schema Evolution

The dump schema evolves to support new MCP protocol features:

- **0.3.1** - Initial structure with basic capabilities
- **0.3.2** - Added pagination detection
- **0.3.3** - Added CORS support detection
- **0.3.4** - Enhanced metadata tracking
- **0.3.5** - Added ping support detection
- **0.3.6** - Current version with streamable-http transport support

See [cli-schema-compatibility.json](../schemas/cli-schema-compatibility.json) for version compatibility matrix.

## Best Practices

1. **Always validate dumps** - Use `mcpcontract validate` to ensure schema conformance
2. **Include descriptions** - Add `dumpDetails.description` to document dump context
3. **Preserve history** - Keep dumps from major versions for comparison
4. **Check compatibility** - Verify schema version compatibility before processing
5. **Document changes** - When updating schemas, document rationale in changelog

## Related Documentation

- [dump-to-mcpdesc.md](dump-to-mcpdesc.md) - Converting legacy dump files to mcpdesc format
- [../quick-start.md](../quick-start.md) - Quick start guide
- [AGENTS.md](../AGENTS.md) - Developer guide for extending dump functionality
- [Tutorials](tutorials/) - Step-by-step guides for common workflows

## Schema Location

- **Current Schema**: [schemas/dump/0.3.6.json](../schemas/dump/0.3.6.json)
- **Legacy Symlink**: [schemas/dump-schema.json](../schemas/dump-schema.json)
- **Version Mapping**: [schemas/latest.json](../schemas/latest.json)

---

**Last Updated**: January 22, 2026  
**Schema Version**: 0.3.6  
**CLI Version**: 0.17.0
