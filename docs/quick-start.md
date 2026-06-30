# Quick Start Guide

Get started with `mcpcontract` in 5 minutes using the Microsoft Learn MCP Server.

## Prerequisites

```bash
# Install from npm (recommended)
npm install -g @cisco_open/mcptoolkit-contract

# Or clone and build from source
git clone https://github.com/cisco-open/mcptoolkit-contract.git
cd mcptoolkit-contract
npm install && npm run build
npm install -g .

# Verify installation
mcpcontract --version
```

## 5-Minute Walkthrough

### 1. Extract Capabilities

**Option A: Interactive Wizard (Recommended for first-time users)**

```bash
# Launch interactive wizard
mcpcontract dump --wizard
# or simply:
mcpcontract dump
```

**Option B: Direct Command Line**

```bash
mcpcontract dump \
  --server-name "microsoft-learn" \
  --transport streamable-http \
  --url https://learn.microsoft.com/api/mcp \
  --format yaml \
  --output docs/users/quickstart/ms-learn-dump.yaml

# Tip: Use --verbose for debugging connection issues
mcpcontract dump --transport http --url https://example.com/mcp --verbose
```

### 2. Validate the Dump

```bash
# Validate dump file (auto-detects schema version)
mcpcontract validate docs/users/quickstart/ms-learn-dump.yaml --schema dump

# View CLI-schema compatibility matrix
mcpcontract validate --show-compatibility

# Show all versions (not just schema changes)
mcpcontract validate --show-compatibility --display full
```

### 3. Create Server Info File

Create `docs/users/quickstart/ms-learn-info.yaml`:

```yaml
reverseDnsName: com.microsoft.learn/mcp
description: MCP server for Microsoft Learn documentation and API reference
repository:
  url: https://github.com/microsoft/learn-mcp
  source: github
homepage: https://learn.microsoft.com
license: Apache-2.0
categories:
  - Documentation
  - Learning
keywords:
  - microsoft
  - learn
  - documentation
  - api
packages:
  - registryType: npm
    identifier: "@microsoft/learn-mcp"
    runtimeHint: npx
    transport:
      type: streamable-http
      url: https://learn.microsoft.com/api/mcp
```

### 4. Generate Documentation

```bash
mcpcontract manifest \
  --mcpdesc docs/users/quickstart/ms-learn-dump.yaml \
  --info docs/users/quickstart/ms-learn-info.yaml \
  --add-capabilities-meta \
  --validate \
  --format yaml \
  --output docs/users/quickstart/ms-learn-manifest.yaml

mcpcontract document docs/users/quickstart/ms-learn-manifest.yaml \
  --template registry-ready \
  --output docs/users/quickstart/ms-learn-documentation.md
```

### 5. Track Changes Between Versions (Optional)

```bash
# Compare two versions to detect changes
mcpcontract diff \
  --from docs/users/quickstart/old-dump.yaml \
  --to docs/users/quickstart/new-dump.yaml \
  --output docs/users/quickstart/changes.json

# Analyze for breaking changes with version suggestion
mcpcontract breaking \
  --diff docs/users/quickstart/changes.json \
  --suggest-version \
  --output docs/users/quickstart/analysis.json

# Generate human-readable changelog
mcpcontract changelog \
  --analysis docs/users/quickstart/analysis.json \
  --format release \
  --output docs/users/quickstart/CHANGELOG.md
```

**Changelog formats:**
- `release` (default) - Comprehensive with categorization and migration guidance
- `compact` - Brief one-line summaries with icons

## What You Just Did

✅ **Extracted** capabilities from a live MCP server  
✅ **Validated** the capability dump against the schema  
✅ **Generated** a registry-ready manifest with validation  
✅ **Rendered** human-readable documentation  
✅ **Tracked** changes and generated release notes (optional)

**Generated files:**
- `docs/users/quickstart/ms-learn-dump.yaml` - Extracted capabilities
- `docs/users/quickstart/ms-learn-manifest.yaml` - Registry-ready manifest
- `docs/users/quickstart/ms-learn-documentation.md` - Human-readable documentation
- `docs/users/quickstart/changes.json` - Structural diff (optional)
- `docs/users/quickstart/analysis.json` - Breaking change analysis (optional)
- `docs/users/quickstart/CHANGELOG.md` - Release notes (optional)

## Next Steps

### Learn More

- **[Command Reference](README.md)** - Full CLI documentation
- **[Tutorials](docs/users/tutorials/)** - Full workflow walkthrough, changelog, rules, and split deep-dives
- **[MCP Specification](https://spec.modelcontextprotocol.io/)** - Model Context Protocol docs

### Try These Commands

```bash
# View all available commands
mcpcontract --help

# List available templates
mcpcontract document --list docs/users/quickstart/ms-learn-manifest.yaml

# Validate with strict mode
mcpcontract validate docs/users/quickstart/ms-learn-manifest.yaml --schema manifest --strict

# Generate detailed documentation
mcpcontract document docs/users/quickstart/ms-learn-manifest.yaml \
  --template default \
  --output docs/users/quickstart/ms-learn-documentation-detailed.md

# Generate compact changelog
mcpcontract changelog \
  --analysis docs/users/quickstart/analysis.json \
  --format compact \
  --output CHANGELOG-compact.md

# Browse compatibility rules catalog
mcpcontract rules list
mcpcontract rules show tool-removed
```

### Common Workflows

**Test with your own server:**
```bash
mcpcontract dump \
  --transport streamable-http \
  --url http://localhost:3000/mcp \
  --format yaml \
  --output docs/users/quickstart/my-dump.yaml
```

**Use a config file for repeated operations:**
```yaml
# config.yaml
mcpServers:
  my-server:
    url: http://localhost:3000/mcp
    transport:
      type: streamable-http
```

```bash
mcpcontract dump --config config.yaml --output dump.yaml --format yaml
```

## Need Help?

```bash
# Get help for any command
mcpcontract dump --help
mcpcontract manifest --help
mcpcontract validate --help
mcpcontract document --help
```

**Documentation:**
- [Repository](https://github.com/cisco-open/mcptoolkit-contract) - Source code and issues

---

**Ready for more?** Browse the [tutorials](docs/users/tutorials/) for changelog generation, rules catalog, and splitting large dumps.
