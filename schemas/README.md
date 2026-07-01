# schemas/

JSON Schema definitions used by `mcpcontract` for validation and documentation generation.

The `mcp-description/` schemas are the normative, versioned schemas for the
**MCP Description (`mcpdesc`) format**, whose specification lives in
[`../spec/`](../spec/). This repository is the canonical source of truth for the
format; other tools vendor a single schema version from here and upgrade as the
format advances.

## Schema types

| Directory / file | Type | Latest version | Purpose |
|---|---|---|---|
| `mcp-description/` | mcpdesc | 0.7.0 | Capability dump format produced by `mcpcontract dump` |
| `dump-extension/` | x-cisco-metadata | 0.2.0 | Cisco-specific extension block embedded in mcpdesc documents |
| `diff/` | diff | 1.0.0 | Structural diff output from `mcpcontract diff` |
| `diff-breaking/` | diff-breaking | 2.0.0 | Breaking-change analysis from `mcpcontract breaking` |
| `split-config/` | split-config | 1.0.0 | Split configuration for `mcpcontract split` |
| `adl-mcp-server-profile/` | ADL profile | 1.0.0 | ADL MCP Server Profile (reserved — see below) |

Legacy single-file aliases in this directory (e.g. `diff-schema.json`, `split-config-schema.json`) are symlink-style copies of the latest versioned schema for backward compatibility.

## Version management

- `latest.json` — maps each schema type to its current latest version
- `cli-schema-compatibility.json` — records which CLI version ships with which schema versions (append on each release)
- The `mcp-description/` directory retains the **full version history** (0.1.0–0.7.0) as the format's normative record; other schema types keep only the latest, plus older versions when older documents may still be validated

## ADL MCP Server Profile (reserved)

`adl-mcp-server-profile/1.0.0.json` defines a JSON Schema for [ADL](https://github.com/cisco-open/agentd) documents conforming to the MCP Server Profile (`urn:adl:profile:mcp_server:1.0`). ADL export support in `mcpcontract convert` is planned for a future release. The schema is included here for early tooling integration.

## Usage

```bash
# Validate a file against a specific schema
mcpcontract validate --file my-server-dump.yaml --schema mcp-description

# List available schema versions
cat schemas/latest.json
```
