# Migrating Legacy Inputs to Current mcpdesc

> **Deprecated.** `mcpcontract convert` exists only to migrate older capability
> dumps and mcpdesc 0.7.0 documents to the current mcpdesc format. It prints a
> deprecation warning and will be removed in a future release. New dumps from
> `mcpcontract dump` are already current and do not need conversion.

## Background

Dumps created before v0.25.0 used a Cisco-specific *capability dump* schema
(top-level `version` / `dumpDetails` / `serverInfo`). Later releases emitted
mcpdesc 0.7.0. `mcpcontract dump` now emits [mcpdesc](schemas.md) 0.8.0
directly. Use `convert` only to bring either legacy format forward.

## Usage

```bash
# Auto-detect the input format and convert (outputs to stdout)
mcpcontract convert legacy-dump.json

# Write to a file (JSON or YAML)
mcpcontract convert legacy-dump.json -o server.mcpdesc.yaml -f yaml

# Migrate a validated mcpdesc 0.7.0 document to v0.8
mcpcontract convert server-0.7.yaml -o server.mcpdesc.yaml
```

For mcpdesc 0.7.0 input, conversion first validates against the frozen 0.7.0
schema, then performs the shared `@mcpdesc/core` migration. Invalid legacy input
is rejected rather than interpreted as the latest format. Inline legacy security
schemes may produce warnings when deterministic component names are generated or
identical schemes are deduplicated.

To add metadata not present in a legacy dump (contact, license, tags), prefer
re-dumping the live server with `mcpcontract dump --info enrichment.yaml` rather
than converting.

## Field mapping (summary)

| Legacy dump | mcpdesc | Notes |
|---|---|---|
| *(new)* | `mcpdesc` | Always the current spec version |
| `serverInfo.{name,version,title,description}` | `info.*` | Identity metadata |
| `serverInfo.protocolVersion` | `protocolVersions[0]` | Observed MCP revision |
| `dumpDetails.mcpServerConfig` | `transports[0]` | `transport`→`type`, plus `url`/`command`/`args` |
| `serverInfo.capabilities` | `capabilities[0]` | One observed capability view |
| `tools` / `resources` / `resourceTemplates` / `prompts` | *(same)* | Identity mapping — no field renames |
| `version`, `roots`, `dumpDetails.*` | *(dropped)* | Legacy capture metadata is not emitted |

`info.contact`, `info.license`, `info.id`, and `tags` have no source in a legacy
dump — they come from `--info` enrichment.

## Related

- [schemas.md](schemas.md) — MCP Description schema versions
- [complete-workflow.md](../tutorials/complete-workflow.md) — the current dump workflow
