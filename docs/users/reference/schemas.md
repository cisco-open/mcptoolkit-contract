# The mcpdesc Schema

`mcpcontract` uses the **mcpdesc** (MCP Description) schema to fully describe what
an MCP server offers. Think of it as the MCP equivalent of an OpenAPI spec for a
REST API: a standalone, MCP-native declaration of every tool, resource, prompt,
and transport a server exposes. Provenance about *how* a snapshot was captured is
carried in the **`x-cisco-metadata`** specification extension.

| | **mcpdesc** (MCP Description) |
|--|------|
| **Answers** | *What does this server offer?* |
| **Contains** | Tools, resources, prompts with full input schemas; transports; protocol version; auth |
| **Produced by** | `mcpcontract dump` |
| **Analogy** | `openapi.yaml` |

```
 Live MCP Server
       │  mcpcontract dump
       ▼
 server.mcpdesc.json         ← "what this server offers"
   info: name, version
   tools: [{ name, inputSchema, ... }]
   resources, prompts, ...
```

> **Note:** Earlier releases produced a Cisco-specific *capability dump* format
> (top-level `version` / `dumpDetails` / `serverInfo`). That on-disk format has
> been removed. Older files can be migrated with the deprecated
> [`mcpcontract convert`](convert-legacy.md) command.

## Why it matters

1. **Server discovery** — captures the complete API surface of an MCP server.
2. **Version tracking** — enables comparison between server versions to detect breaking changes.
3. **Change analysis** — foundation for `diff`, `breaking`, and `changelog`.
4. **Documentation** — source of truth for generating human-readable API docs.

## Schema versions

The format is versioned independently of the CLI:

- **mcpdesc**: `0.7.0` — `schemas/mcp-description/0.7.0.json`
  (`$id: https://developer.cisco.com/mcp-description/schema/0.7.0`)
- **x-cisco-metadata extension**: `0.2.0` — `schemas/dump-extension/0.2.0.json`

`schemas/latest.json` maps each schema type to its current version, and
`schemas/cli-schema-compatibility.json` records which CLI versions emit which
schema versions.

## Document structure

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

### info

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

- `name` — programmatic server identifier (required)
- `version` — server version, semver recommended (required)
- `title` — human-readable display name (MCP `BaseMetadata`, 2025-06-18+)
- `protocolVersion` — MCP protocol version implemented by the server

### transports

One or more transport configurations the server supports:

```json
{ "transports": [ { "type": "streamable-http", "url": "https://example.com/mcp" } ] }
```

### capabilities

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

### tools / resources / resourceTemplates / prompts

Arrays describing the server's exposed capabilities. Each tool entry carries its
`name`, optional `description`, and a JSON Schema `inputSchema`; resources and
prompts follow the corresponding MCP shapes.

### x-cisco-metadata (capture provenance)

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

- `version` — extension payload version (`0.2.0`)
- `dump.toolName` / `dump.toolVersion` — which tool created the snapshot
- `dump.createdAt` — capture timestamp
- `dump.serverConfig` — connection details (transport, URL, headers, …)
- `dump.runtimeObservations`, `dump.cors`, `dump.paginationDetection`,
  `dump.clientCapabilities` — runtime discoveries about the server

## Best practices

1. **Always validate** — run `mcpcontract validate <file> --schema mcpdesc`.
2. **Include a description** — set `info.description` to document the server's purpose.
3. **Preserve history** — keep snapshots from major versions for comparison.

## Related

- [convert-legacy.md](convert-legacy.md) — migrating legacy dump files to mcpdesc
- [complete-workflow.md](../tutorials/complete-workflow.md) — end-to-end example
- Schema files: [mcp-description/0.7.0.json](../../../schemas/mcp-description/0.7.0.json) · [dump-extension/0.2.0.json](../../../schemas/dump-extension/0.2.0.json)
