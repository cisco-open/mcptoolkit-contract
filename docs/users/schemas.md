# MCP Schemas: mcpdesc and server.json

`mcpcontract` works with two complementary schemas that together fully describe an MCP server. Think of it as the same separation REST APIs have between an OpenAPI spec and a package.json.

---

## The Two Schemas at a Glance

| | **mcpdesc** (MCP Description) | **server.json** (Registry Manifest) |
|--|------|------|
| **Answers** | *What does this server offer?* | *How do I get and connect to it?* |
| **Contains** | Tools, resources, prompts with full input schemas; transport used; protocol version; auth | All distribution transports (packages + remotes); install metadata; reverse-DNS name |
| **Produced by** | `mcpcontract dump` | `mcpcontract manifest` |
| **Schema owner** | mcpcontract project | MCP Registry (Anthropic) |
| **Size** | Can be large (full schemas) | Small (distribution metadata only) |
| **Analogy** | `openapi.yaml` | `package.json` |

---

## Architecture

```
 Live MCP Server
       │
       │  mcpcontract dump
       ▼
 server.mcpdesc.json         ← "what this server offers"
   info: name, version
   tools: [{ name, inputSchema, ... }]
   resources, prompts, ...
       │
       │  mcpcontract manifest  (+ server-info.json)
       ▼
 server.json                  ← "how to get and connect"
   name: com.example/server
   packages: [{ npm, stdio }]
   remotes:  [{ streamable-http }]
```

---

## The Pipeline

```bash
# 1. Extract capabilities → outputs mcpdesc
mcpcontract dump --url http://localhost:3000/mcp \
  --transport streamable-http --output server.mcpdesc.json

# 2. Generate registry manifest (mcpdesc + your server-info.json)
mcpcontract manifest \
  --mcpdesc server.mcpdesc.json \
  --info server-info.json \
  --validate --output server.json

# 3. Validate both
mcpcontract validate server.mcpdesc.json --schema mcpdesc
mcpcontract validate server.json --schema manifest

# 4. Generate documentation
mcpcontract document server.mcpdesc.json --output CAPABILITIES.md
```

---

## Why Two Schemas?

- **Separate ownership**: `server.json` is an external standard controlled by MCP Registry; mcpdesc evolves with this tooling.
- **Separate concerns**: discovery/installation (small, stable) vs. capability documentation (detailed, tool-specific).
- **Independent update cadence**: mcpdesc can iterate faster than a registry standard.

---

## Related

- [dump-schema.md](dump-schema.md) — full mcpdesc field reference
- [MCP Registry spec](https://github.com/modelcontextprotocol/registry) — server.json schema
- [complete-workflow.md](tutorials/complete-workflow.md) — end-to-end example
