# Tutorial: Complete `mcpcontract` Workflow

This tutorial walks through the full pipeline — **dump → validate → manifest → document** — for any MCP server.

For demonstration the examples use placeholder names (`my-server`, `http://localhost:3000/mcp`). Substitute your own server name, URL, and transport.

## What You'll Learn

- Extract capabilities from a running MCP server
- Validate capability dumps against the schema
- Produce a registry-ready manifest from a dump + metadata file
- Render human-readable documentation

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
mcpcontract validate dump.yaml --schema dump
```

The validator auto-detects the schema version in the file, so old dumps validate without upgrading. Use `--strict` to treat warnings as errors (recommended in CI). Check version compatibility with `mcpcontract validate --show-compatibility`.

---

## Step 3: Create Server Metadata (`server-info.json`)

The manifest needs complementary metadata — installation, repository, environment variables — that can't be extracted from a running server. Create `server-info.json`:

```json
{
  "reverseDnsName": "com.example/my-server",
  "description": "A short description of what the server does.",
  "repository": { "url": "https://github.com/example-org/my-server", "source": "github" },
  "license": "Apache-2.0",
  "categories": ["Development Tools"],
  "packages": [
    {
      "registryType": "npm",
      "identifier": "@example/my-server",
      "runtimeHint": "npx",
      "transport": { "type": "streamable-http", "url": "http://localhost:{PORT}/mcp" },
      "environmentVariables": [
        { "name": "PORT", "description": "HTTP port", "default": "3000", "isRequired": false }
      ]
    }
  ]
}
```

Run `mcpcontract manifest --info-template > server-info.json` to bootstrap this file with all available fields.

---

## Step 4: Generate the Manifest

```bash
mcpcontract manifest \
  --mcpdesc dump.yaml \
  --info server-info.json \
  --add-capabilities-meta \
  --validate \
  --format yaml \
  --output manifest.yaml
```

`--add-capabilities-meta` embeds tool/resource/prompt counts in the manifest for registry display. `--validate` runs schema validation before writing.

---

## Step 5: Validate the Manifest

```bash
mcpcontract validate manifest.yaml --schema manifest
# Strict mode for CI/CD:
mcpcontract validate manifest.yaml --schema manifest --strict
```

---

## Step 6: Generate Documentation

```bash
# Registry-ready format (concise, for submission):
mcpcontract document manifest.yaml \
  --template registry-ready \
  --output README.md

# Full reference format:
mcpcontract document manifest.yaml \
  --template default \
  --output MANIFEST.md
```

List all available templates: `mcpcontract document --list manifest.yaml`

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

mcpcontract validate dump.yaml --schema dump

mcpcontract manifest \
  --mcpdesc dump.yaml \
  --info server-info.json \
  --add-capabilities-meta \
  --validate \
  --format yaml \
  --output manifest.yaml

mcpcontract validate manifest.yaml --schema manifest --strict

mcpcontract document manifest.yaml \
  --template registry-ready \
  --output README.md

echo "Done: dump → manifest → README.md"
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
          mcpcontract manifest --mcpdesc dump.yaml --info server-info.json \
            --validate --output manifest.yaml
          mcpcontract document manifest.yaml --template registry-ready --output README.md
      - name: Commit
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add README.md manifest.yaml
          git commit -m "docs: update MCP documentation" || exit 0
          git push
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Connection refused` | Server not running or wrong port | `curl http://localhost:3000/mcp` to check |
| Validation error at `/packages/0/transport/url` | Missing required field | Check info JSON for all required fields |
| `Version mismatch` warning | Info file version ≠ dump version | Remove version from info to inherit from dump |
| Capabilities missing from docs | Forgot `--add-capabilities-meta` | Re-run `manifest` with that flag |

---

## Next Steps

- [Changelog tutorial](changelog-tutorial.md) — compare versions and detect breaking changes
- [Rules catalog guide](rules-catalog-guide.md) — understand and customize compatibility rules
- [Splitting large dumps](splitting-large-dumps.md) — organize federation servers by service
