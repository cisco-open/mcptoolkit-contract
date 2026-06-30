# Complete Workflow Examples

This document provides end-to-end examples of using `mcpcontract` for different scenarios.

## Workflow 1: Document a Live Server

**Goal**: Extract a server's capabilities and publish human-readable documentation.

### Step 1: Extract Capabilities

```bash
# Start your MCP server (if local)
node dist/index.js &

# Dump capabilities → mcpdesc
mcpcontract dump \
  --server-name "openapi-analyzer" \
  --transport streamable-http \
  --url "http://localhost:3001/mcp" \
  --output capabilities.mcpdesc.json \
  --pretty
```

**Output**: `capabilities.mcpdesc.json` containing all tools, resources, prompts, etc.

### Step 2: Validate the Dump

```bash
mcpcontract validate capabilities.mcpdesc.json --schema mcpdesc --strict
```

### Step 3: Render Documentation

```bash
# Markdown reference
mcpcontract document capabilities.mcpdesc.json \
  --template reference-documentation \
  --output REFERENCE.md

# Interactive HTML card view
mcpcontract document capabilities.mcpdesc.json \
  --template card-view \
  --output capabilities.html
```

---

## Workflow 2: Authenticated Remote Server

**Goal**: Document a hosted MCP service that requires an API key.

```bash
mcpcontract dump \
  --server-name "hosted-search-service" \
  --transport streamable-http \
  --url "https://mcp.example.com/search" \
  --headers "X-API-Key:${API_KEY}" \
  --output hosted-search.mcpdesc.json \
  --pretty

mcpcontract validate hosted-search.mcpdesc.json --schema mcpdesc

mcpcontract document hosted-search.mcpdesc.json \
  --template reference-documentation \
  --output hosted-search.md
```

> Bearer tokens and other headers are passed with `--headers "Name:Value"` for both SSE and streamable-http transports. Never hardcode secrets — read them from environment variables.

---

## Workflow 3: Track Changes Between Versions

**Goal**: Detect breaking changes and generate release notes when a server evolves.

```bash
# 1. Dump the new version
mcpcontract dump --url https://mcp.example.com --transport streamable-http \
  --output v2.mcpdesc.json

# 2. Structural diff against the previous dump
mcpcontract diff --from v1.mcpdesc.json --to v2.mcpdesc.json --output diff.json

# 3. Classify breaking changes (and suggest a SemVer bump)
mcpcontract breaking --diff diff.json --suggest-version --output analysis.json

# 4. Generate a human-readable changelog
mcpcontract changelog --breaking analysis.json --format release --output CHANGELOG.md
```

`breaking` exits `0` (compatible), `1` (breaking changes found), or `2` (error) — gate your CI on the exit code.

---

## Workflow 4: Split a Large Federation Dump

**Goal**: Partition a federation server's tools into focused, per-service subsets.

```bash
# 1. Dump the federation server
mcpcontract dump --url https://federation.example.com/mcp \
  --transport streamable-http --output federation.mcpdesc.json

# 2. Split by service using a config file
mcpcontract split federation.mcpdesc.json \
  --config split-by-service.yaml \
  --output-dir ./by-service

# 3. Document each subset
mcpcontract document --input by-service/dump-platform-identity.json \
  --output docs/platform-identity.md
```

See [splitting-large-dumps.md](../../users/tutorials/splitting-large-dumps.md) for split-config syntax and pattern matching.

---

## Workflow 5: CI/CD Documentation Pipeline

**Goal**: Regenerate documentation automatically in GitHub Actions.

```yaml
name: Update MCP Documentation

on:
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'package.json'
  workflow_dispatch:

jobs:
  update-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '18' }
      - run: npm ci && npm run build
      - run: npm install -g @cisco_open/mcptoolkit-contract
      - name: Start MCP server
        run: |
          node dist/index.js &
          sleep 5
      - name: Dump capabilities
        run: |
          mcpcontract dump \
            --server-name "my-server" \
            --transport streamable-http \
            --url "http://localhost:3001/mcp" \
            --output capabilities.mcpdesc.json --pretty
      - name: Validate
        run: mcpcontract validate capabilities.mcpdesc.json --schema mcpdesc --strict
      - name: Render documentation
        run: |
          mcpcontract document capabilities.mcpdesc.json \
            --template reference-documentation \
            --output docs/REFERENCE.md
      - name: Commit updates
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add docs/REFERENCE.md
          git commit -m "chore: update MCP docs [skip ci]" || exit 0
          git push
```

---

## Workflow 6: Custom Template for Internal Documentation

**Goal**: Generate documentation matching an internal style guide.

### Step 1: Create a Custom Template

**`templates/internal-docs.md.hbs`:**

```handlebars
---
title: {{info.name}}
category: MCP Servers
version: {{info.version}}
---

# {{info.name}}

## Tools

{{#each tools}}
### `{{name}}`

{{description}}
{{/each}}
```

### Step 2: Render with the Custom Template

```bash
mcpcontract document capabilities.mcpdesc.json \
  --template templates/internal-docs.md.hbs \
  --output docs/mcp-servers/openapi-analyzer.md
```

Custom templates are passed as file paths (not registered names). Available helpers are registered in [src/lib/renderer.ts](../../../src/lib/renderer.ts).

---

## Troubleshooting

### Issue: Connection refused

```
Error: connect ECONNREFUSED 127.0.0.1:3001
```

**Solution**: Ensure the server is running and reachable. Try `curl http://localhost:3001/mcp`.

### Issue: Schema Validation Failure

```
❌ Validation failed
```

**Solution**: Run `mcpcontract validate <file> --schema mcpdesc` for the full error list. If the dump was created with an older CLI, regenerate it with the current version.

### Issue: Missing Capabilities in Dump

```
✓ Loaded capability dump (0 tools, 0 resources, 0 prompts)
```

**Solution**: Ensure the server was running and accessible during the dump. Check server logs and authentication headers.
