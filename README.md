# MCP Toolkit: Server Contract

The `mcpcontract` CLI dumps capabilities from live MCP servers, and lets you create changelogs, detect breaking changes, and generate documentation.

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Status: pre-release](https://img.shields.io/badge/status-1.0.0--rc.4-orange.svg)](CHANGELOG.md)
[![Node.js: >=20.x](https://img.shields.io/badge/Node.js-%3E%3D20.x-brightgreen.svg)](https://nodejs.org/)

- **Quick start:** [docs/quick-start.md](docs/quick-start.md)
- **Full walkthrough:** [docs/users/tutorials/complete-workflow.md](docs/users/tutorials/complete-workflow.md)
- **All user docs:** [docs/users/](docs/users/)

## 🚀 Quick Start

```bash
# Install from npm (recommended)
npm install -g @cisco_open/mcptoolkit-contract

# Verify installation
mcpcontract --version

# Extract the capabilities from a live MCP server 
mcpcontract dump --transport streamable-http --url "https://learn.microsoft.com/api/mcp" --format yaml --output "dump.yaml"

# Generate documentation in markdown format
mcpcontract document dump.yaml --template reference-documentation --output doc.md
```

**For a complete walkthrough**, check the [complete workflow](docs/users/tutorials/complete-workflow.md) tutorial.

## 🔍 Backward Compatibility Analysis

Create dumps for various releases of an MCP server, then compare releases and generate a changelog 

```bash
# Compare two dumps => creates a diff document
mcpcontract diff --from v1.json --to v2.json --output diff.json
# Add breaking changes => creates an enriched diff document
mcpcontract breaking --diff diff.json --output analysis.json
# Generate a changelog that includes breaking changes if any
mcpcontract changelog --breaking analysis.json --output CHANGELOG.md
```

**Key Features**:
- **20+ Change Types**: Tool/prompt/resource additions, removals, renames, parameter changes
- **35 Default Rules**: Based on MCP compatibility guidelines and Postel's Law
- **Customizable Rules**: YAML-based rules with conditional matching
- **Exit Codes**: 0 (compatible), 1 (breaking), 2 (error)
- **Changelog Formats**: `release` (comprehensive notes), `compact` (brief), plus legacy `detailed`/`summary`/`stats`

**Compatibility Philosophy**:
- **Enum Additions are Compatible**: Following the open-world assumption, adding enum values is backward compatible
- **Postel's Law**: "Be liberal in what you accept" - clients should handle unknown values gracefully
- **Customizable**: Teams can override with stricter rules if needed (see `rules/strict-compatibility.yaml`)

📘 **[Read the full MCP Compatibility Guidelines](docs/users/reference/compatibility.md)** for detailed philosophy, patterns, and best practices.

**Documentation**:
- [MCP Compatibility Guidelines](docs/users/reference/compatibility.md) — Philosophy and best practices
- [Example Artifacts](docs/users/examples/)

## 📖 Commands

### ✅ dump - Generate an MCP description from a live server

Connects to a live MCP server and extract its description (transport, tools, prompts, resources)

> **Note**: the command supports three transports:
> - `streamable-http` or `http` (accepted as alias)
> - `stdio`
> - `sse` (legacy - deprecated transport for MCP servers)

```bash
# Dump capabilities using a config file
mcpcontract dump --config server-config.json --output dump.json

#  Dump capabilities using CLI options - HTTP transport 
mcpcontract dump \
  --transport streamable-http \
  --url "http://localhost:3000/mcp" \
  --output dump.json

# Dump capabilities using CLI options - STDIO transport (server name auto-generated from command)
mcpcontract dump \
  --transport stdio \
  --command "npx" \
  --args "-y" "@modelcontextprotocol/server-everything" \
  --output dump.json
```

### ✅ document - Generate documentation

Generate human-readable documentation from an MCP description.

```bash
mcpcontract document dump.yaml --template reference-documentation --output doc.md
mcpcontract document dump.yaml --template mcpdesc-documentation --output README.md
```

### ✅ diff - Compare two releases of an MCP server

Generate structural diff between two MCP descriptions.

```bash
mcpcontract diff --from dump-v1.json --to dump-v2.json --output diff.json
```

### ✅ breaking - Detect Breaking Changes

Apply compatibility rules to identify breaking changes. The output analysis file contains both the original diff data and severity annotations.

```bash
mcpcontract breaking --diff diff.json --rules rules/breaking-changes.yaml --output diff-breaking.json
```

**Exit Codes**: 0 (compatible), 1 (breaking), 2 (error)  
**Note**: The analysis file includes the complete diff with added severity ratings, so changelog can use it as a standalone input.

### ✅ changelog - Generate Human-Readable Changelogs

Render markdown changelogs from structural diff or breaking change analysis.

```bash
# Comprehensive release notes (default)
mcpcontract changelog --breaking diff-breaking.json --output CHANGELOG.md --format release

# Brief one-line-per-change summary
mcpcontract changelog --breaking diff-breaking.json --output CHANGELOG.md --format compact
```

**Input Options**:
- `--breaking <file>` (recommended): analysis file with diff + severity annotations
- `--diff <file>`: raw structural diff (no severity ratings)

### ✅ rules - Browse Compatibility Rules Catalog

Browse and explore the backward compatibility rules catalog with comprehensive documentation and examples.

```bash
# List all rules (default catalog)
mcpcontract rules list

# List rules from custom catalog (shows severity comparison)
mcpcontract rules list --catalog rules/strict-compatibility-catalog
mcpcontract rules list --catalog rules/my-team-catalog

# Filter rules
mcpcontract rules list --category tools --breaking
mcpcontract rules list --severity critical

# Show detailed documentation for a rule
mcpcontract rules show parameter-enum-values-changed
mcpcontract rules show tool-removed

# Show documentation from custom catalog
mcpcontract rules show parameter-enum-values-changed --catalog rules/strict-compatibility-catalog

# Display pass/fail examples
mcpcontract rules examples parameter-added
mcpcontract rules examples parameter-enum-values-changed --variant enum-additions-only

# Display examples from custom catalog
mcpcontract rules examples parameter-added --catalog rules/my-team-catalog

# Validate catalog completeness
mcpcontract rules validate
mcpcontract rules validate --rules rules/strict-compatibility.yaml
mcpcontract rules validate --catalog rules/my-team-catalog

# Export catalog
mcpcontract rules export --output catalog.json
mcpcontract rules export --format markdown --output RULES.md
mcpcontract rules export --catalog rules/strict-compatibility-catalog --format markdown
```

**Catalog**: 33 documented rules across tools (12), prompts (8), resources (6), resourceTemplates (3), serverInfo (5) — each with rationale, migration guidance, and pass/fail examples. Custom team catalogs are supported via `--catalog`, which also shows how severities differ from the defaults. See the [rules catalog tutorial](docs/users/tutorials/rules-catalog.md).

### ✅ split - Split Large Dumps into Focused Subsets

Organize large federation server dumps by service or domain using regex-based filtering.

```bash
# Split by service prefix patterns
mcpcontract split federation-dump.json \
  --config split-config.yaml \
  --output-dir ./split-dumps \
  --validate

# Preview without creating files
mcpcontract split federation-dump.json \
  --config split-config.yaml \
  --dry-run
```

**Key Features**:
- Regex-based name pattern matching (Phase 1: tools only)
- Multiple output categories from single input
- Overlap support (tools can match multiple categories)
- Unmatched items handling (ignore/warn/error/separate-file)
- Split metadata tracking in outputs
- JSON and YAML format support

**Status**: ✅ Fully implemented and tested (Phase 1: tools filtering only)

### ✅ validate - Check compliance with specifications

Check a document is compliant with the MCP Description specification.

```bash
# Validate an MCP description
mcpcontract validate dump.yaml --schema mcpdesc --strict
```

## 🏗️ Project Structure

For a detailed file/module map see [AGENTS.md](AGENTS.md). High-level layout:

```
mcpcontract/
├── src/
│   ├── commands/        # Commander subcommands (thin argument-parsing layer)
│   ├── lib/             # Core logic (dumper, differ, rules-engine, splitter, …)
│   └── index.ts         # CLI entry point
├── schemas/             # JSON schemas (versioned: mcp-description/, diff/, …)
├── rules/               # Compatibility rules (YAML) + documentation catalog
├── templates/           # Handlebars templates (dumps, changelogs)
├── tests/               # Jest unit + integration tests, shell smoke tests
└── docs/
    ├── users/           # User guides, tutorials, examples
    └── maintainers/     # Architecture, design decisions, internal notes
```

## 📖 Example Artifacts

See **[docs/users/examples/](docs/users/examples/)** for working examples:

- `microsoft-learn/` — real dumps from the public Microsoft Learn MCP server, including two historical snapshots for diff/changelog
- `http-with-auth-config.yaml` — MCP server config with Bearer-token authentication
- `split-federation-services.yaml` + `split-example.md` — splitting a federation dump by service
- `html/` — sample HTML output from `mcpcontract document`


## 🔧 Maintenance

```bash
# Build
npm run build

# Watch mode (auto-rebuild on changes)
npm run watch

# Clean build directory
npm run clean

# Run tests 
npm test

# Test coverage
npm run test:coverage
```

## 📚 Documentation

- **[Quick Start](docs/quick-start.md)** — Install & generate your first dump in five minutes
- **[Full Tour Tutorial](docs/users/tutorials/complete-workflow.md)** — End-to-end tutorial
- **[User docs](docs/users/)** — Schemas, compatibility guidelines, examples
- **[Maintainer docs](docs/maintainers/README.md)** — Architecture and design decisions

## License

This software is licensed under the Apache License 2.0. See [LICENSE](LICENSE) for details.



