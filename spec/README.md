# MCP Description Specification

A portable, machine-readable contract format for [Model Context Protocol (MCP)](https://modelcontextprotocol.io) servers.

> This directory is the **canonical source of truth** for the MCP Description
> (`mcpdesc`) format. It is maintained inside the
> [`mcptoolkit-contract`](../README.md) repository, which also provides the
> reference tooling (`mcpcontract`). Implementations vendor a single schema
> version from [`../schemas/mcp-description/`](../schemas/mcp-description/) and
> upgrade when the format advances.

## Overview

The **MCP Description Specification** defines a standard document format that describes the capabilities of an MCP server — its tools, resources, prompts, transports, and security requirements — without requiring a runtime connection.

Think of it as **OpenAPI for MCP servers**: a static contract that enables discovery, documentation, validation, and governance across the MCP ecosystem.

## Status

| Field | Value |
|-------|-------|
| Current version | **0.7.0** |
| Status | **Draft** |
| Schema | [`../schemas/mcp-description/0.7.0.json`](../schemas/mcp-description/0.7.0.json) |

## Quick Example

```yaml
mcpdesc: 0.7.0
info:
  name: chess-rating-server
  title: Chess Rating MCP Server
  version: 1.0.0
transports:
- type: stdio
  command: chess-rating
  args:
  - serve
tools:
- name: get_player_rating
  description: Get the current Elo rating for a chess player
  inputSchema:
    type: object
    properties:
      player_id:
        type: string
        description: Player identifier
    required:
    - player_id
```

## Directory Structure

```
spec/
  mcp-description.md    Assembled normative specification text
  sections/            Normative specification, section by section
  guides/              Rationale, tutorials, and comparisons (non-normative)
  examples/            Example MCP Description documents
  extensions/          Vendor extension specifications
  implementations.md   Known implementations and tooling
  CHANGELOG.md         Format version history
  GOVERNANCE.md        How the specification evolves
```

Versioned JSON Schemas live at the repository root under
[`../schemas/mcp-description/`](../schemas/mcp-description/), shared with the
`mcpcontract` tooling.

## Getting Started

- **Read the spec**: [mcp-description.md](mcp-description.md)
- **Explore examples**: [examples/](examples/)
- **Try the schema**: [../schemas/mcp-description/0.7.0.json](../schemas/mcp-description/0.7.0.json) (latest — see [../schemas/latest.json](../schemas/latest.json))
- **Write your first description**: [guides/getting-started.md](guides/getting-started.md)

## Key Features

- **MCP-native** — tools, resources, and prompts use MCP protocol structures directly
- **OpenAPI-aligned** — familiar `info`, `security`, and metadata patterns
- **Multi-transport** — declare stdio, streamable-http, and SSE endpoints
- **Extensible** — vendor-specific metadata via the `x-` extension mechanism
- **Versioned** — schema evolution with backward compatibility tracking
- **Offline-first** — no server connection needed to understand capabilities

## Specification Extensions

Vendors can attach additional metadata using the `x-{vendor}-{feature}` convention. See [extensions/](extensions/) for registered extensions.

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for how to propose changes, and
[GOVERNANCE.md](GOVERNANCE.md) for how the specification evolves.

## License

This specification is licensed under [Apache License 2.0](../LICENSE).
