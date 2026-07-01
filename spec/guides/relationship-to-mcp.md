# Relationship to the MCP Protocol

## Overview

The MCP Description Specification and the MCP Protocol serve complementary roles in the MCP ecosystem.

## The MCP Protocol

The [Model Context Protocol (MCP)](https://modelcontextprotocol.io) defines **runtime communication** between clients and servers:

- **Initialize handshake** — client and server negotiate capabilities
- **Tool invocation** — clients call server-side tools with parameters
- **Resource fetching** — clients read server-side data sources
- **Prompt execution** — clients invoke server-side prompt templates
- **Notifications** — servers notify clients of changes

The protocol is inherently **dynamic** — it requires a running server and an active connection.

## The MCP Description

The MCP Description Specification defines a **static contract** for an MCP server:

- **Server metadata** — name, version, contact, license
- **Transport configuration** — how to connect
- **Tool definitions** — what tools exist and their schemas
- **Resource catalog** — what data is available
- **Prompt catalog** — what prompts are available
- **Security requirements** — how to authenticate

The description is a **document** — it exists independently of any running server.

## Side-by-Side Comparison

| Aspect | MCP Protocol | MCP Description |
|--------|-------------|-----------------|
| Nature | Wire protocol | Document format |
| When used | Runtime | Design time, build time, documentation |
| Server required | Yes | No |
| Connection required | Yes | No |
| Capabilities | Discovered dynamically | Declared statically |
| Tools | Invoked | Described |
| Resources | Fetched | Cataloged |
| Format | JSON-RPC over transport | JSON document |

## How They Work Together

```
┌─────────────────────────────────────────────────┐
│              Developer Workflow                   │
│                                                   │
│  1. Author MCP Description      (design time)    │
│  2. Validate against schema     (build time)     │
│  3. Generate documentation      (build time)     │
│  4. Publish to registry         (release time)   │
│  5. Client discovers server     (discovery time)  │
│  6. Client connects via MCP     (runtime)         │
│  7. Client uses tools/resources (runtime)         │
│                                                   │
│  Steps 1-5: MCP Description                      │
│  Steps 6-7: MCP Protocol                         │
└─────────────────────────────────────────────────┘
```

## What the Description Does NOT Replace

- **Runtime discovery** — servers still respond to `initialize` with capabilities
- **Tool execution** — the description says what tools exist, not what they return
- **Resource content** — the description catalogs resources, not their data
- **Error handling** — runtime errors are protocol concerns
- **Session management** — sessions are protocol concerns

## Protocol Version Independence

The MCP Description specification version (`mcpdesc`) is independent of the MCP protocol version (`info.protocolVersion`):

- `mcpdesc: "0.6.0"` — the document format version
- `protocolVersion: "2025-06-18"` — the MCP protocol the server implements

A single MCP Description specification version can describe servers implementing different MCP protocol versions.
