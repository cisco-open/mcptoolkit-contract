# Converting Dump to MCP Description (mcpdesc)

This guide explains how to convert a legacy ContractDump file to the MCP Description (mcpdesc) format — either using the `mcpcontract convert` command or by manually mapping fields.

## Background

The `mcpcontract dump` command now outputs **mcpdesc format directly**. However, older dumps (created before v0.25.0) use the legacy ContractDump schema. This guide covers converting those legacy files.

**mcpdesc version**: 0.6.0  
**x-cisco-metadata version**: 0.2.0

---

## Option 1: Using `mcpcontract convert` (Recommended)

The fastest way — auto-detects input format and converts bidirectionally.

### Dump → mcpdesc

```bash
# Auto-detect and convert (outputs to stdout)
mcpcontract convert my-server-dump.json

# Write to file
mcpcontract convert my-server-dump.json -o my-server.mcpdesc.json

# Output as YAML
mcpcontract convert my-server-dump.json -o my-server.mcpdesc.yaml -f yaml

# Compact JSON (no indentation)
mcpcontract convert my-server-dump.json --compact
```

### mcpdesc → Dump (reverse)

```bash
mcpcontract convert my-server.mcpdesc.json -o my-server-dump.json
```

### With enrichment (add contact, license, security, tags)

If you need to add metadata not present in the dump, use `--info` on the `dump` command instead:

```bash
mcpcontract dump --config server-config.json --info enrichment.yaml -o my-server.mcpdesc.json
```

---

## Option 2: Manual Field Mapping

If you need to convert by hand (e.g., in a script or different language), here's the complete field mapping.

### Top-Level Structure

| **Dump (ContractDump)** | **mcpdesc 0.6.0** | Notes |
|---|---|---|
| *(new field)* | `mcpdesc` | Always `"0.6.0"` |
| `serverInfo.*` | `info` | See Info mapping below |
| `dumpDetails.mcpServerConfig` | `transports` | Array of transport objects |
| `serverInfo.capabilities` | `capabilities` | Direct copy |
| `tools` | `tools` | Direct copy (identity mapping) |
| `resources` | `resources` | Direct copy |
| `resourceTemplates` | `resourceTemplates` | Direct copy |
| `prompts` | `prompts` | Direct copy |
| *(new field)* | `tags` | Optional; added via `--info` enrichment |
| `dumpDetails.*` + runtime data | `x-cisco-metadata` | See extension mapping below |
| `version` | *(dropped)* | Dump schema version, not needed in mcpdesc |
| `roots` | *(dropped)* | Client capability, not server description |

### Info Object Mapping

The mcpdesc `info` object maps from `serverInfo`:

| **Dump field** | **mcpdesc `info` field** | Required |
|---|---|---|
| `serverInfo.name` | `info.name` | Yes |
| `serverInfo.version` | `info.version` | Yes |
| `serverInfo.title` | `info.title` | No |
| `serverInfo.description` | `info.description` | No |
| `serverInfo.protocolVersion` | `info.protocolVersion` | No |
| `serverInfo.websiteUrl` | `info.websiteUrl` | No |
| `serverInfo.icons` | `info.icons` | No |
| *(enrichment only)* | `info.id` | No |
| *(enrichment only)* | `info.contact` | No |
| *(enrichment only)* | `info.license` | No |

> **Note**: `info.contact`, `info.license`, and `info.id` come from enrichment (`--info` file), not from the dump.

### Transports Mapping

The dump's single server config becomes an array of transports:

```
dumpDetails.mcpServerConfig  →  transports[0]
```

| **Dump field** | **mcpdesc `transports[0]` field** |
|---|---|
| `mcpServerConfig.transport` | `type` (`"stdio"`, `"streamable-http"`, or `"sse"`) |
| `mcpServerConfig.url` | `url` (for streamable-http/sse) |
| `mcpServerConfig.command` | `command` (for stdio) |
| `mcpServerConfig.args` | `args` (for stdio) |

**Fields NOT mapped to transports** (carried in `x-cisco-metadata` instead):
- `mcpServerConfig.name` → `x-cisco-metadata.dump.serverConfig.name`
- `mcpServerConfig.env` → `x-cisco-metadata.dump.serverConfig.env`

### Capability Arrays (Identity Mapping)

Tools, resources, resourceTemplates, and prompts are copied verbatim — no field renames:

```json
// Dump
{
  "tools": [
    {
      "name": "search",
      "description": "Search for items",
      "inputSchema": { "type": "object", "properties": { ... } }
    }
  ]
}

// mcpdesc (identical)
{
  "tools": [
    {
      "name": "search",
      "description": "Search for items",
      "inputSchema": { "type": "object", "properties": { ... } }
    }
  ]
}
```

This applies to all MCP fields: `name`, `description`, `inputSchema`, `outputSchema`, `annotations`, `uri`, `uriTemplate`, `mimeType`, `arguments`, `tags`, `deprecated`, `title`, `icons`, `execution`, `_meta`, `size`.

### x-cisco-metadata Extension Mapping

Runtime observations and provenance data that don't belong in the core mcpdesc schema are stored in the `x-cisco-metadata` extension:

```json
{
  "x-cisco-metadata": {
    "version": "0.2.0",
    "dump": {
      "toolName": "...",
      "toolVersion": "...",
      "createdAt": "...",
      "serverConfig": { ... },
      "runtimeObservations": { ... },
      "cors": { ... },
      "paginationDetection": { ... },
      "clientCapabilities": { ... },
      "splitOperation": { ... }
    }
  }
}
```

| **Dump field** | **x-cisco-metadata field** |
|---|---|
| `dumpDetails.toolName` | `dump.toolName` |
| `dumpDetails.toolVersion` | `dump.toolVersion` |
| `dumpDetails.createdAt` | `dump.createdAt` |
| `dumpDetails.mcpServerConfig.name` | `dump.serverConfig.name` |
| `dumpDetails.mcpServerConfig.transport` | `dump.serverConfig.transport` |
| `dumpDetails.mcpServerConfig.url` | `dump.serverConfig.url` |
| `dumpDetails.mcpServerConfig.command` | `dump.serverConfig.command` |
| `dumpDetails.mcpServerConfig.args` | `dump.serverConfig.args` |
| `dumpDetails.mcpServerConfig.env` | `dump.serverConfig.env` |
| `dumpDetails.dumpExecution.mcpProtocolUsed` | `dump.runtimeObservations.mcpProtocolUsed` |
| `dumpDetails.dumpExecution.sessionIdSupported` | `dump.runtimeObservations.sessionIdSupported` |
| `dumpDetails.dumpExecution.sessionIdHeader` | `dump.runtimeObservations.sessionIdHeader` |
| `dumpDetails.dumpExecution.pingSupported` | `dump.runtimeObservations.pingSupported` |
| `dumpDetails.dumpExecution.pingLatencyMs` | `dump.runtimeObservations.pingLatencyMs` |
| `serverInfo.instructions` | `dump.runtimeObservations.instructions` |
| `dumpDetails.dumpExecution.corsSupport.browserReady` | `dump.cors.browserReady` |
| `dumpDetails.dumpExecution.corsSupport.responseHeaders` | `dump.cors.responseHeaders` |
| `dumpDetails.dumpExecution.corsSupport.preflight` | `dump.cors.preflight` |
| `dumpDetails.dumpExecution.paginationSupport` | `dump.paginationDetection` |
| `dumpDetails.dumpExecution.clientCapabilitiesSent` | `dump.clientCapabilities` |
| `dumpDetails.dumpExecution.splitOperation` | `dump.splitOperation` |

### Fields That Are Dropped

These dump fields have no equivalent in mcpdesc and are intentionally omitted:

| **Dump field** | **Reason** |
|---|---|
| `version` | Dump schema version — mcpdesc has its own version (`mcpdesc: "0.6.0"`) |
| `dumpDetails.description` | Dump-level description; `info.description` is the server's own description |
| `roots` | Client-side capability, not a server description field |

---

## Complete Example

### Input: Legacy ContractDump

```json
{
  "version": "https://developer.cisco.com/mcp_contract_dump/schema/0.3.8",
  "dumpDetails": {
    "toolName": "mcpcontract",
    "toolVersion": "0.28.0",
    "createdAt": "2026-03-21T10:00:00Z",
    "mcpServerConfig": {
      "name": "chess-coach",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@example/chess-coach"]
    },
    "dumpExecution": {
      "mcpProtocolUsed": "2025-06-18",
      "sessionIdSupported": false,
      "pingSupported": true,
      "pingLatencyMs": 42
    }
  },
  "serverInfo": {
    "name": "chess-coach",
    "version": "0.7.0",
    "title": "Chess Coach MCP Server",
    "description": "AI-powered chess training coach",
    "protocolVersion": "2025-06-18",
    "capabilities": {
      "tools": { "listChanged": false }
    },
    "instructions": "You are a helpful chess coach."
  },
  "tools": [
    {
      "name": "analyze-position",
      "description": "Analyze a chess position from FEN notation",
      "inputSchema": {
        "type": "object",
        "properties": {
          "fen": { "type": "string", "description": "FEN string" }
        },
        "required": ["fen"]
      }
    }
  ],
  "resources": [],
  "resourceTemplates": [],
  "prompts": []
}
```

### Output: mcpdesc 0.6.0

```json
{
  "mcpdesc": "0.6.0",
  "info": {
    "name": "chess-coach",
    "version": "0.7.0",
    "title": "Chess Coach MCP Server",
    "description": "AI-powered chess training coach",
    "protocolVersion": "2025-06-18"
  },
  "transports": [
    {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@example/chess-coach"]
    }
  ],
  "capabilities": {
    "tools": { "listChanged": false }
  },
  "tools": [
    {
      "name": "analyze-position",
      "description": "Analyze a chess position from FEN notation",
      "inputSchema": {
        "type": "object",
        "properties": {
          "fen": { "type": "string", "description": "FEN string" }
        },
        "required": ["fen"]
      }
    }
  ],
  "x-cisco-metadata": {
    "version": "0.2.0",
    "dump": {
      "toolName": "mcpcontract",
      "toolVersion": "0.28.0",
      "createdAt": "2026-03-21T10:00:00Z",
      "serverConfig": {
        "name": "chess-coach",
        "transport": "stdio",
        "command": "npx",
        "args": ["-y", "@example/chess-coach"]
      },
      "runtimeObservations": {
        "mcpProtocolUsed": "2025-06-18",
        "pingSupported": true,
        "pingLatencyMs": 42,
        "instructions": "You are a helpful chess coach."
      }
    }
  }
}
```

**Key observations**:
- `serverInfo.*` → `info.*` (near-identity, just the wrapper name changes)
- `tools` copied verbatim — zero field renames
- `dumpDetails` split between `transports` (connection info) and `x-cisco-metadata` (provenance)
- `serverInfo.instructions` moves to `x-cisco-metadata.dump.runtimeObservations.instructions`
- Empty arrays (`resources`, `resourceTemplates`, `prompts`) are omitted
- `version` and `roots` are dropped entirely

---

## Adding Enrichment

To add fields not present in the dump (contact, license, security, tags), create an enrichment info file:

```yaml
# enrichment.yaml
contact:
  name: "Chess Coach Team"
  email: "chess@example.com"
license:
  name: "Apache-2.0"
  url: "https://opensource.org/licenses/Apache-2.0"
security:
  - type: http
    scheme: bearer
tags:
  - name: "games"
    description: "Game-related capabilities"
    tags:
      - name: "analysis"
        description: "Game analysis tools"
  - name: "education"
    description: "Learning capabilities"
```

Then apply via `--info`:

```bash
mcpcontract dump --config server.json --info enrichment.yaml -o output.mcpdesc.json
```

Or on an existing mcpdesc file, use `convert` with the dump command:

```bash
mcpcontract convert legacy-dump.json -o temp.mcpdesc.json
# Then re-dump with enrichment to add contact/license/tags
```

---

## `mcpcontract convert` — Quick Reference

`convert` is the primary tool for format migration. It auto-detects the input format and converts in either direction.

| Goal | Command |
|---|---|
| Legacy dump → mcpdesc (stdout) | `mcpcontract convert old-dump.json` |
| Legacy dump → mcpdesc file | `mcpcontract convert old-dump.json -o server.mcpdesc.yaml -f yaml` |
| mcpdesc → internal dump | `mcpcontract convert server.mcpdesc.yaml -o dump.json` |
| Compact JSON output | `mcpcontract convert old-dump.json --compact` |
| Print full conversion guide | `mcpcontract convert --guide` |

**Auto-detection logic**: if the input contains a `mcpdesc` version key it is treated as mcpdesc; if it contains a `version` string matching the internal dump schema URL it is treated as a legacy dump. Use `--to-format dump` or `--to-format mcpdesc` to override.

**Serialization format**: defaults to match the output file extension (`.json` → JSON, `.yaml` → YAML). Override with `-f yaml` or `-f json`.

---

## See Also

- [dump-schema.md](dump-schema.md) — Full mcpdesc schema reference
- [dump-schema.md](dump-schema.md) — Legacy dump schema field reference
- [mcpdesc specification](../ref/mcp-description/spec/mcp-description.md) — Full mcpdesc 0.6.0 specification
- [x-cisco-metadata extension](../ref/mcp-description/extensions/x-cisco-metadata/README.md) — Extension carrying provenance data
