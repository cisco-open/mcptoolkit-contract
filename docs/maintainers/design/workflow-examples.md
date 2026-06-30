# Complete Workflow Examples

This document provides end-to-end examples of using `mcpcontract` for different scenarios.

## Workflow 1: Local NPM Package Server

**Goal**: Publish a local MCP server to the registry.

### Step 1: Extract Capabilities

First, ensure your server is running and accessible. Then dump its capabilities:

```bash
# Start your MCP server
node dist/index.js &

# Dump capabilities
mcpcontract dump \
  --server-name "openapi-analyzer" \
  --transport streamable-http \
  --url "http://localhost:3001/mcp" \
  --output capabilities-dump.json \
  --pretty
```

**Output**: `capabilities-dump.json` containing all tools, resources, prompts, etc.

### Step 2: Create Server Info File

Create a `server-info.json` with package and repository information:

```json
{
  "reverseDnsName": "io.example.developer/openapi-analyzer",
  "title": "OpenAPI Analyzer",
  "description": "MCP server for OpenAPI document analysis and validation",
  "repository": {
    "url": "https://github.com/example-org/openapi-analyzer-mcp",
    "source": "github"
  },
  "packages": [{
    "registryType": "npm",
    "registryBaseUrl": "https://registry.npmjs.org",
    "identifier": "@example-org/openapi-analyzer-mcp",
    "runtimeHint": "npx",
    "transport": {
      "type": "stdio"
    },
    "environmentVariables": [{
      "name": "PORT",
      "description": "HTTP server port",
      "default": "3001",
      "format": "number"
    }]
  }]
}
```

### Step 3: Generate Manifest

```bash
mcpcontract manifest \
  --mcpdesc capabilities-dump.json \
  --info server-info.json \
  --output server.json \
  --add-capabilities-meta \
  --validate \
  --pretty
```

**Output**: `server.json` conforming to MCP registry schema.

**Console Output**:
```
✓ Loaded capability dump (9 tools, 1 resource, 1 prompt)
✓ Loaded server info
✓ Version match: 0.3.0
⚠ Warning: Package transport (stdio) differs from dump transport (streamable-http)
✓ Generated manifest
✓ Validated against server.schema.json
✓ Wrote manifest to server.json
```

### Step 4: Validate Manifest

```bash
mcpcontract validate server.json --schema manifest
```

**Output**:
```
✓ Valid manifest: server.json

Validation Summary:
- Schema: server.schema.json (2025-10-17)
- Required fields: PASS
- Field types: PASS
- Format validation: PASS

No issues found.
```

### Step 5: Generate Documentation

```bash
mcpcontract render server.json \
  --template-name default \
  --output MANIFEST.md
```

**Output**: `MANIFEST.md` - Human-readable documentation.

### Step 6: Submit to Registry

```bash
# Clone registry repo
git clone https://github.com/modelcontextprotocol/registry
cd registry

# Add your server
cp ../server.json servers/example/openapi-analyzer/server.json

# Create PR
git checkout -b add-openapi-analyzer
git add servers/example/openapi-analyzer/server.json
git commit -m "Add OpenAPI Analyzer MCP Server"
git push origin add-openapi-analyzer
```

---

## Workflow 2: Cloud-Hosted Remote Server

**Goal**: Create manifest for a hosted MCP service.

### Step 1: Dump Capabilities

```bash
mcpcontract dump \
  --server-name "hosted-search-service" \
  --transport streamable-http \
  --url "https://mcp.example.com/search" \
  --headers "X-API-Key:${API_KEY}" \
  --output hosted-search-dump.json \
  --pretty
```

### Step 2: Create Remote Server Info

```json
{
  "reverseDnsName": "com.example.cloud/hosted-search",
  "title": "Hosted Search Service",
  "description": "Cloud-hosted MCP server for federated search",
  "websiteUrl": "https://developer.example.com/hosted-search",
  "remotes": [{
    "type": "streamable-http",
    "url": "https://mcp.example.com/search",
    "headers": [{
      "name": "X-API-Key",
      "description": "Service API key",
      "isRequired": true,
      "isSecret": true
    }]
  }]
}
```

### Step 3: Generate & Validate

```bash
# Generate manifest
mcpcontract manifest \
  --mcpdesc hosted-search-dump.json \
  --info hosted-search-remote-info.json \
  --output hosted-search-server.json \
  --add-capabilities-meta \
  --validate

# Validate
mcpcontract validate hosted-search-server.json --schema manifest

# Render docs
mcpcontract document hosted-search-server.json \
  --template registry-ready \
  --output REGISTRY-SUBMISSION.md
```

---

## Workflow 3: Multi-Package Server (NPM + Docker)

**Goal**: Server distributed via both npm and Docker Hub.

### Step 1: Dump Capabilities

```bash
mcpcontract dump \
  --config local-server-config.json \
  --output filesystem-dump.json \
  --pretty
```

### Step 2: Create Multi-Package Info

```json
{
  "reverseDnsName": "io.github.example/filesystem",
  "title": "Filesystem Server",
  "description": "MCP server for secure filesystem operations",
  "repository": {
    "url": "https://github.com/example/filesystem-mcp",
    "source": "github"
  },
  "packages": [
    {
      "registryType": "npm",
      "identifier": "@example/filesystem-mcp",
      "runtimeHint": "npx",
      "transport": {"type": "stdio"},
      "packageArguments": [{
        "type": "positional",
        "valueHint": "target_dir",
        "description": "Directory to allow access",
        "isRequired": true
      }]
    },
    {
      "registryType": "oci",
      "identifier": "docker.io/example/filesystem-mcp:1.0.0",
      "transport": {"type": "stdio"},
      "runtimeArguments": [{
        "type": "named",
        "name": "-v",
        "value": "{host_path}:/mnt/data",
        "description": "Mount directory"
      }]
    }
  ]
}
```

### Step 3: Generate with Multiple Packages

```bash
mcpcontract manifest \
  --mcpdesc filesystem-dump.json \
  --info filesystem-multipackage-info.json \
  --output filesystem-server.json \
  --validate \
  --pretty
```

---

## Workflow 4: CI/CD Integration

**Goal**: Automated manifest generation and validation in GitHub Actions.

### `.github/workflows/update-manifest.yml`

```yaml
name: Update MCP Manifest

on:
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'package.json'
  workflow_dispatch:

jobs:
  update-manifest:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build project
        run: npm run build
      
      - name: Install mcpcontract
        run: npm install -g @cisco_open/mcptoolkit-contract
      
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
            --output capabilities-dump.json \
            --pretty
      
      - name: Generate manifest
        run: |
          mcpcontract manifest \
            --mcpdesc capabilities-dump.json \
            --info .mcp/server-info.json \
            --output server.json \
            --add-capabilities-meta \
            --validate \
            --pretty
      
      - name: Validate manifest
        run: |
          mcpcontract validate server.json --schema manifest --strict
      
      - name: Render documentation
        run: |
          mcpcontract render server.json \
            --template-name default \
            --output docs/MANIFEST.md
      
      - name: Check for changes
        id: git-check
        run: |
          git diff --exit-code server.json docs/MANIFEST.md || echo "changed=true" >> $GITHUB_OUTPUT
      
      - name: Commit updates
        if: steps.git-check.outputs.changed == 'true'
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add server.json docs/MANIFEST.md
          git commit -m "chore: update MCP manifest and docs [skip ci]"
          git push
```

### Project Structure

```
your-mcp-server/
├── .mcp/
│   └── server-info.json       # Static metadata
├── src/
│   └── index.ts
├── docs/
│   └── MANIFEST.md            # Auto-generated
├── server.json                # Auto-generated
├── capabilities-dump.json     # Auto-generated
└── .github/
    └── workflows/
        └── update-manifest.yml
```

---

## Workflow 5: Validation in Pre-commit Hook

**Goal**: Ensure manifest stays valid before commits.

### `.husky/pre-commit`

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "Validating MCP manifest..."

# Check if server.json exists
if [ ! -f "server.json" ]; then
  echo "⚠️  No server.json found, skipping validation"
  exit 0
fi

# Validate manifest
if ! mcpcontract validate server.json --schema manifest; then
  echo "❌ Manifest validation failed!"
  echo "Run: mcpcontract validate server.json --schema manifest"
  exit 1
fi

echo "✓ Manifest is valid"
```

---

## Workflow 6: Custom Template for Internal Documentation

**Goal**: Generate documentation matching internal style guide.

### Step 1: Create Custom Template

**`templates/internal-docs.md.hbs`:**

```handlebars
---
title: {{title}}
category: MCP Servers
version: {{version}}
---

# {{title}}

{{description}}

## Quick Start

{{#if packages}}
{{#each packages}}
{{#if (eq registryType "npm")}}
```bash
npx {{identifier}}
```
{{/if}}
{{/each}}
{{/if}}

## Configuration

{{#if packages}}
{{#each packages}}
{{#if environmentVariables}}
### Environment Variables

{{#each environmentVariables}}
#### `{{name}}`

{{description}}

- **Required**: {{#if isRequired}}Yes{{else}}No{{/if}}
- **Default**: {{#if default}}`{{default}}`{{else}}None{{/if}}
{{#if isSecret}}- **⚠️ Secret**: This is a sensitive value{{/if}}

{{/each}}
{{/if}}
{{/each}}
{{/if}}

## Links

- [Source Code]({{repository.url}})
{{#if websiteUrl}}- [Documentation]({{websiteUrl}}){{/if}}
```

### Step 2: Render with Custom Template

```bash
mcpcontract render server.json \
  --template templates/internal-docs.md.hbs \
  --output docs/mcp-servers/openapi-analyzer.md
```

---

## Tips & Best Practices

### 1. Version Synchronization

Always ensure the version in `server-info.json` matches your actual package version:

```bash
# Extract version from package.json
VERSION=$(node -p "require('./package.json').version")

# Update server-info.json programmatically
cat server-info.json | jq ".version = \"$VERSION\"" > server-info.tmp.json
mv server-info.tmp.json server-info.json
```

### 2. Validation in Package Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "manifest:dump": "mcpcontract dump --config .mcp/config.json --output capabilities-dump.json",
    "manifest:generate": "mcpcontract manifest --mcpdesc capabilities-dump.json --info .mcp/server-info.json --output server.json --validate",
    "manifest:validate": "mcpcontract validate server.json --schema manifest",
    "manifest:render": "mcpcontract render server.json --output docs/MANIFEST.md",
    "manifest:all": "npm run manifest:dump && npm run manifest:generate && npm run manifest:render"
  }
}
```

### 3. Keep Server Info in Version Control

Store `server-info.json` in `.mcp/` directory and version it:

```
.mcp/
├── server-info.json      # Versioned
├── config-dev.json       # Local development
└── config-prod.json      # Production
```

### 4. Use Environment Variables for Secrets

Never hardcode secrets in server-info.json:

```json
{
  "remotes": [{
    "headers": [{
      "name": "X-API-Key",
      "description": "API key (set via environment)",
      "isRequired": true,
      "isSecret": true
      // NO "default" or "value" for secrets!
    }]
  }]
}
```

---

## Troubleshooting

### Issue: Version Mismatch Warning

```
⚠ Warning: Package version (1.0.1) differs from dump version (1.0.0)
```

**Solution**: Update server-info.json or rebuild with correct version.

### Issue: Transport Incompatibility

```
⚠ Warning: Package transport (stdio) differs from dump transport (streamable-http)
```

**Explanation**: This is often expected - the dump connects one way, but users install another way. If intentional, you can ignore this warning.

### Issue: Schema Validation Failure

```
❌ Validation failed: data.name should match pattern "^[a-zA-Z0-9.-]+/[a-zA-Z0-9._-]+$"
```

**Solution**: Ensure reverse-DNS name format: `io.domain.org/server-name`

### Issue: Missing Capabilities in Dump

```
✓ Loaded capability dump (0 tools, 0 resources, 0 prompts)
```

**Solution**: Ensure server was running and accessible during dump. Check server logs.
