# Tutorial: Complete `mcpcontract` Workflow

This tutorial walks through the full pipeline — **dump → validate → document → diff → breaking → changelog** — for any MCP server.

For demonstration the examples use placeholder names (`my-server`, `http://localhost:3000/mcp`). Substitute your own server name, URL, and transport.

## What You'll Learn

- Extract capabilities from a running MCP server
- Validate capability dumps against the schema
- Render human-readable documentation
- Compare two versions and generate a changelog with breaking-change analysis

## Prerequisites

`mcpcontract` installed (`npm install -g @cisco_open/mcptoolkit-contract`) and an MCP server reachable on a known transport (streamable-http, SSE, or stdio).

---

## Step 1: Extract Server Capabilities

**Interactive wizard (recommended for first time):**

```bash
mcpcontract dump --wizard
# or just: mcpcontract dump
```

**Direct command:**

```bash
mcpcontract dump \
  --transport streamable-http \
  --url http://localhost:3000/mcp \
  --format yaml \
  --output dump.yaml
```

Add `--verbose` to debug connection problems. Use `--info enrichment.yaml` to embed contact, license, and distribution metadata at dump time.

**Other transport examples:**

```bash
# SSE
mcpcontract dump --transport sse --url http://localhost:3000/sse \
  -H "Authorization: Bearer TOKEN"

# STDIO (Python module)
mcpcontract dump --transport stdio --command python --args "-m,my_server" \
  --env "API_KEY=key"
```

See [http-with-auth-config.yaml](../examples/http-with-auth-config.yaml) for a complete config-file example with Bearer-token authentication.

---

## Step 2: Validate the Dump

```bash
mcpcontract validate dump.yaml --schema mcpdesc
```

The validator auto-detects the schema type when `--schema` is omitted. Use `--strict` to treat warnings as errors (recommended in CI). Check version compatibility with `mcpcontract validate --show-compatibility`.

---

## Step 3: Generate Documentation

```bash
# Readable reference format:
mcpcontract document dump.yaml \
  --template reference-documentation \
  --output REFERENCE.md

# Full mcpdesc documentation:
mcpcontract document dump.yaml \
  --template mcpdesc-documentation \
  --output CAPABILITIES.md

# Interactive HTML card view:
mcpcontract document dump.yaml \
  --template card-view \
  --output capabilities.html
```

List all available templates: `mcpcontract document --list dump.yaml`

---

## Step 4: Compare Two Versions

When a new release of the server ships, dump it again and compare the two dumps to produce a structural diff:

```bash
mcpcontract diff --from dump-v1.yaml --to dump-v2.yaml --output diff.json
```

---

## Step 5: Detect Breaking Changes

Apply compatibility rules to the diff. The output combines the diff data with severity annotations:

```bash
mcpcontract breaking \
  --diff diff.json \
  --rules rules/breaking-changes.yaml \
  --output analysis.json
```

Exit codes: `0` (compatible), `1` (breaking changes found), `2` (error) — useful for gating CI.

---

## Step 6: Generate a Changelog

```bash
mcpcontract changelog --breaking analysis.json --format release --output CHANGELOG.md
```

Use `--format compact` for a brief one-line-per-change summary.

---

## Complete Workflow Script

```bash
#!/bin/bash
set -e

mcpcontract dump \
  --url http://localhost:3000/mcp \
  --transport streamable-http \
  --format yaml \
  --output dump.yaml

mcpcontract validate dump.yaml --schema mcpdesc --strict

mcpcontract document dump.yaml \
  --template reference-documentation \
  --output REFERENCE.md

# Compare against a previous dump and produce a changelog
mcpcontract diff --from dump-v1.yaml --to dump.yaml --output diff.json
mcpcontract breaking --diff diff.json --output analysis.json
mcpcontract changelog --breaking analysis.json --format release --output CHANGELOG.md

echo "Done: dump → REFERENCE.md + CHANGELOG.md"
```

---

## CI/CD Integration

```yaml
# .github/workflows/docs.yml
name: Generate MCP Documentation
on:
  push:
    branches: [main]

jobs:
  docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '18' }
      - run: npm install -g @cisco_open/mcptoolkit-contract
      - name: Start server
        run: npm install && npm start &
      - run: sleep 5
      - name: Generate docs
        run: |
          mcpcontract dump --url http://localhost:3000/mcp \
            --transport streamable-http --output dump.yaml
          mcpcontract document dump.yaml --template reference-documentation --output REFERENCE.md
      - name: Commit
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add REFERENCE.md
          git commit -m "docs: update MCP documentation" || exit 0
          git push
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Connection refused` | Server not running or wrong port | `curl http://localhost:3000/mcp` to check |
| Validation error in dump | Dump does not match schema | Run `mcpcontract validate dump.yaml --schema mcpdesc` for details |
| `Version mismatch` warning | Dump schema version differs from CLI | Regenerate the dump with the current CLI version |
| No changes detected in diff | Dumps are identical | Confirm `--from` and `--to` point at different versions |

---

## Next Steps

- [Changelog tutorial](changelog-tutorial.md) — compare versions and detect breaking changes
- [Rules catalog guide](rules-catalog-guide.md) — understand and customize compatibility rules
- [Splitting large dumps](splitting-large-dumps.md) — organize federation servers by service
