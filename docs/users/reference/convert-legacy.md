# Converting Legacy Dumps to mcpdesc

> **Deprecated.** `mcpcontract convert` exists only to migrate older capability
> dumps to the current mcpdesc format. It prints a deprecation warning and will be
> removed in a future release. New dumps from `mcpcontract dump` are already in
> mcpdesc format — you do not need `convert` for them.

## Background

Dumps created before v0.25.0 used a Cisco-specific *capability dump* schema
(top-level `version` / `dumpDetails` / `serverInfo`). `mcpcontract dump` now emits
[mcpdesc](schemas.md) directly. Use `convert` only to bring an old file forward.

## Usage

```bash
# Auto-detect the input format and convert (outputs to stdout)
mcpcontract convert legacy-dump.json

# Write to a file (JSON or YAML)
mcpcontract convert legacy-dump.json -o server.mcpdesc.yaml -f yaml

# Reverse direction (mcpdesc → legacy dump), if ever needed
mcpcontract convert server.mcpdesc.json -o legacy-dump.json
```

To add metadata not present in a legacy dump (contact, license, tags), prefer
re-dumping the live server with `mcpcontract dump --info enrichment.yaml` rather
than converting.

## Field mapping (summary)

| Legacy dump | mcpdesc | Notes |
|---|---|---|
| *(new)* | `mcpdesc` | Always the current spec version |
| `serverInfo.{name,version,title,description,protocolVersion}` | `info.*` | Identity metadata |
| `dumpDetails.mcpServerConfig` | `transports[0]` | `transport`→`type`, plus `url`/`command`/`args` |
| `serverInfo.capabilities` | `capabilities` | Direct copy |
| `tools` / `resources` / `resourceTemplates` / `prompts` | *(same)* | Identity mapping — no field renames |
| `dumpDetails.*` + runtime data | `x-cisco-metadata.dump` | Capture provenance (see [schemas.md](schemas.md)) |
| `version`, `roots`, `dumpDetails.description` | *(dropped)* | No mcpdesc equivalent |

`info.contact`, `info.license`, `info.id`, and `tags` have no source in a legacy
dump — they come from `--info` enrichment.

## Related

- [schemas.md](schemas.md) — the mcpdesc schema and `x-cisco-metadata` extension
- [complete-workflow.md](../tutorials/complete-workflow.md) — the current dump workflow
