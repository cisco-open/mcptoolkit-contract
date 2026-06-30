# MCP Schema: mcpdesc

`mcpcontract` uses the **mcpdesc** (MCP Description) schema to fully describe what an MCP server offers. Think of it as the MCP equivalent of an OpenAPI spec for a REST API.

---

## What mcpdesc Captures

| | **mcpdesc** (MCP Description) |
|--|------|
| **Answers** | *What does this server offer?* |
| **Contains** | Tools, resources, prompts with full input schemas; transport used; protocol version; auth |
| **Produced by** | `mcpcontract dump` |
| **Schema owner** | mcpcontract project |
| **Analogy** | `openapi.yaml` |

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
```

---

## The Pipeline

```bash
# 1. Extract capabilities → outputs mcpdesc
mcpcontract dump --url http://localhost:3000/mcp \
  --transport streamable-http --output server.mcpdesc.json

# 2. Validate
mcpcontract validate server.mcpdesc.json --schema mcpdesc

# 3. Generate documentation
mcpcontract document server.mcpdesc.json --output CAPABILITIES.md
```

---

## Related

- [dump-schema.md](dump-schema.md) — full mcpdesc field reference
- [complete-workflow.md](tutorials/complete-workflow.md) — end-to-end example
