# MCP Description (mcpdesc) Schema Documentation

## Overview

`mcpcontract dump` writes a capability snapshot in the **MCP Description (mcpdesc)**
format — a standalone, MCP-native declaration of everything a server exposes:
tools, resources, prompts, transports, and protocol metadata. Provenance about how
the snapshot was captured is carried in the **`x-cisco-metadata`** specification
extension.

> **Note:** Earlier releases produced a Cisco-specific *capability dump* format
> (top-level `version` / `dumpDetails` / `serverInfo`). That on-disk format has been
> removed. Older files can be migrated with the deprecated
> [`mcpcontract convert`](dump-to-mcpdesc.md) command.

## Purpose

The mcpdesc snapshot serves several purposes:

1. **Server Discovery** — captures the complete API surface of an MCP server
2. **Version Tracking** — enables comparison between server versions to detect breaking changes
3. **Change Analysis** — foundation for `diff`, `breaking`, and `changelog` generation
4. **Testing & Validation** — a reference for client implementations
5. **Documentation** — source of truth for generating human-readable API docs

## Schema Versions

The format is versioned independently of the CLI:

- **mcpdesc**: `0.7.0` — `schemas/mcp-description/0.7.0.json`
  (`$id: https://developer.cisco.com/mcp-description/schema/0.7.0`)
- **x-cisco-metadata extension**: `0.2.0` — `schemas/dump-extension/0.2.0.json`

`schemas/latest.json` maps each schema type to its current version, and
`schemas/cli-schema-compatibility.json` records which CLI versions emit which
schema versions.

## Basic Structure

An mcpdesc document has the following top-level shape:

```json
{
  "$schema": "https://developer.cisco.com/mcp-description/schema/0.7.0",
  "mcpdesc": "0.7.0",
  "info": { /* server identity and protocol metadata */ },
  "transports": [ /* one or more supported transports */ ],
  "security": [ /* optional: auth requirements */ ],
  "capabilities": { /* advertised server capabilities */ },
  "tools": [ /* array of tool definitions */ ],
  "resources": [ /* array of resource definitions */ ],
  "resourceTemplates": [ /* array of URI templates */ ],
  "prompts": [ /* array of prompt definitions */ ],
  "tags": [ /* optional: classification tags */ ],
  "x-cisco-metadata": { /* capture provenance (see below) */ }
}
```

**Required**: `mcpdesc`, `info`, `transports`.

## Core Sections

### 1. mcpdesc

```json
{ "mcpdesc": "0.7.0" }
```

- **Required**: Yes
- **Purpose**: Identifies the MCP Description specification version this file conforms to.

### 2. Info

Server identity and protocol metadata (OpenAPI-aligned `info` object):

```json
{
  "info": {
    "name": "example-server",
    "title": "Example Server",
    "description": "What the server does",
    "version": "1.2.3",
    "protocolVersion": "2025-06-18"
  }
}
```

**Key Fields**:
- `name` — programmatic server identifier (required)
- `version` — server version, semver recommended (required)
- `title` — human-readable display name (MCP `BaseMetadata`, 2025-06-18+)
- `protocolVersion` — MCP protocol version implemented by the server

### 3. Transports

One or more transport configurations the server supports:

```json
{
  "transports": [
    { "type": "streamable-http", "url": "https://example.com/mcp" }
  ]
}
```

### 4. Capabilities

Capabilities advertised by the server during initialization:

```json
{
  "capabilities": {
    "tools": { "listChanged": true },
    "resources": { "subscribe": true, "listChanged": true },
    "prompts": { "listChanged": false },
    "logging": {}
  }
}
```

### 5. Tools / Resources / Resource Templates / Prompts

Arrays describing the server's exposed capabilities. Each tool entry carries its
`name`, optional `description`, and a JSON Schema `inputSchema`; resources and
prompts follow the corresponding MCP shapes.

### 6. x-cisco-metadata (capture provenance)

The `x-cisco-metadata` extension records how the snapshot was produced:

```json
{
  "x-cisco-metadata": {
    "version": "0.2.0",
    "dump": {
      "toolName": "mcpcontract",
      "toolVersion": "1.0.0",
      "createdAt": "2026-01-22T10:30:00Z",
      "serverConfig": {
        "name": "My MCP Server",
        "transport": "streamable-http",
        "url": "https://example.com/mcp"
      },
      "runtimeObservations": { /* protocol, session, ping, ... */ },
      "cors": { /* browser compatibility */ },
      "paginationDetection": { /* pagination findings */ },
      "clientCapabilities": { /* capabilities sent by the client */ }
    }
  }
}
```

**Key Fields**:
- `version` — extension payload version (`0.2.0`)
- `dump.toolName` / `dump.toolVersion` — which tool created the snapshot
- `dump.createdAt` — capture timestamp
- `dump.serverConfig` — connection details (transport, URL, headers, …)
- `dump.runtimeObservations`, `dump.cors`, `dump.paginationDetection`,
  `dump.clientCapabilities` — runtime discoveries about the server

## Best Practices

1. **Always validate** — run `mcpcontract validate <file> --schema mcpdesc` to ensure conformance.
2. **Include a description** — set `info.description` to document the server's purpose.
3. **Preserve history** — keep snapshots from major versions for comparison.
4. **Document changes** — record schema/contract changes in the changelog.

## Related Documentation

- [dump-to-mcpdesc.md](dump-to-mcpdesc.md) — converting legacy dump files to mcpdesc format
- [schemas.md](schemas.md) — schema overview
- [../quick-start.md](../quick-start.md) — quick start guide
- [Tutorials](tutorials/) — step-by-step guides for common workflows

## Schema Location

- **mcpdesc schema**: [schemas/mcp-description/0.7.0.json](../../schemas/mcp-description/0.7.0.json)
- **x-cisco-metadata extension**: [schemas/dump-extension/0.2.0.json](../../schemas/dump-extension/0.2.0.json)
