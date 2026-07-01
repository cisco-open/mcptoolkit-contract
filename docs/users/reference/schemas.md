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

> The normative specification for the `mcpdesc` format — including its full
> version history — is maintained in this repository under
> [`spec/`](../../../spec/). The `schemas/mcp-description/` directory holds the
> versioned JSON Schemas (0.1.0–0.7.0) referenced by that specification.

## Full field reference

The authoritative field-by-field reference is the MCP Description specification
maintained in this repository:

- **[Assembled specification](../../../spec/mcp-description.md)** — full
  normative text (all sections in one document)
- **Section-by-section reference:**
  - [Document structure](../../../spec/sections/03-document-structure.md)
  - [info](../../../spec/sections/05-info-object.md)
  - [transports](../../../spec/sections/06-transports.md)
  - [capabilities](../../../spec/sections/08-capabilities.md)
  - [tools](../../../spec/sections/09-tools.md) · [resources](../../../spec/sections/10-resources.md) · [prompts](../../../spec/sections/11-prompts.md) · [tags](../../../spec/sections/12-tags.md)
- **[x-cisco-metadata extension](../../../spec/extensions/x-cisco-metadata/README.md)** —
  capture-provenance extension fields (`dump`, `runtimeObservations`, `cors`, …)

For a hands-on authoring walkthrough, see the
[getting-started guide](../../../spec/guides/getting-started.md).

## Best practices

1. **Always validate** — run `mcpcontract validate <file> --schema mcpdesc`.
2. **Include a description** — set `info.description` to document the server's purpose.
3. **Preserve history** — keep snapshots from major versions for comparison.

## Related

- [convert-legacy.md](convert-legacy.md) — migrating legacy dump files to mcpdesc
- [complete-workflow.md](../tutorials/complete-workflow.md) — end-to-end example
- [MCP Description Specification](../../../spec/mcp-description.md) — normative format specification
- Schema files: [mcp-description/0.7.0.json](../../../schemas/mcp-description/0.7.0.json) · [dump-extension/0.2.0.json](../../../schemas/dump-extension/0.2.0.json)
