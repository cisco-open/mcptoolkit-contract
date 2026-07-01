# Microsoft Learn MCP Server — example data

Sample artifacts captured from the public **[Microsoft Learn MCP Server](https://learn.microsoft.com/api/mcp)**
(`streamable-http`). They power the [quick start](../../../quick-start.md) and the
[complete workflow tutorial](../../tutorials/complete-workflow.md) so you can try
the full pipeline without standing up your own server.

| File | Role |
|------|------|
| `ms-learn-dump.yaml` | Current capability dump (mcpdesc) — 3 tools |
| `ms-learn-dump-v1.0.0-2025-11-20.yaml` | Earlier snapshot — use as the `--from` baseline |
| `ms-learn-dump-v1.0.0-2026-06-30.yaml` | Later snapshot — use as the `--to` target |
| `ms-learn-documentation.md` | Rendered docs (`document` command output) |

## Try it

```bash
D=docs/users/examples/microsoft-learn

# Render documentation from a dump
mcpcontract document $D/ms-learn-dump.yaml --template reference-documentation --output REFERENCE.md

# Compare the two historical snapshots and analyze breaking changes
mcpcontract diff --from $D/ms-learn-dump-v1.0.0-2025-11-20.yaml \
                 --to   $D/ms-learn-dump-v1.0.0-2026-06-30.yaml --output diff.json
mcpcontract breaking --diff diff.json --suggest-version --output diff-breaking.json
mcpcontract changelog --diff diff-breaking.json --format release --output CHANGELOG.md
```

Comparing the two snapshots yields **8 changes (4 breaking)** and a recommended
**MAJOR** version bump — a realistic, reproducible example.

The server exposes only three tools, so for a larger, multi-service example see
[split-example.md](../split-example.md).
