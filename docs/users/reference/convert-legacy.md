# Migrating Legacy Inputs to Current mcpdesc

> **Historical CLI required.** `mcpcontract convert` now only displays guidance.
> It does not read or write files and exits nonzero, except that `--guide`
> prints guidance and succeeds. New dumps already use mcpdesc.

## Background

Dumps created before v0.25.0 used a Cisco-specific *capability dump* schema
(top-level `version` / `dumpDetails` / `serverInfo`). Later releases emitted
mcpdesc 0.7.0. `mcpcontract dump` now emits [mcpdesc](schemas.md) 0.8.0
directly. Use CLI 2.0.5 to bring either legacy format to 0.8.0.
The latest v1 CLI, 1.2.4, supports historical 0.7.0 processing but does not
produce 0.8.0.

## Usage

```bash
# Use the historical bridge release without replacing your global CLI
npx --package=@cisco_open/mcptoolkit-contract@2.0.5 mcpcontract convert \
  server-0.7.yaml --output server-0.8.yaml

# Then use the current CLI for the explicit preview upgrade
mcpcontract migrate server-0.8.yaml --output server-0.9.yaml
```

In CLI 2.0.5, conversion of mcpdesc 0.7.0 first validates against the frozen 0.7.0
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
| *(new)* | `mcpdesc` | 0.8.0 in the bridge release |
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
