# MCP Toolkit: Server Contract

The MCP server contract CLI (`mcpcontract`) extracts capabilities from live MCP servers, generates registry-ready manifests, detects breaking changes between versions, and renders human-readable documentation.

Follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html). See [CHANGELOG.md](CHANGELOG.md) for release history.

- **Quick start:** [docs/quick-start.md](docs/quick-start.md)
- **Full walkthrough:** [docs/users/tutorials/complete-workflow.md](docs/users/tutorials/complete-workflow.md)
- **All user docs:** [docs/users/](docs/users/)

## 🚀 Quick Start

```bash
# Install from npm (recommended)
npm install -g @cisco-open/mcptoolkit-contract

# Verify installation
mcpcontract --version

# Extract the capabilities of an existing live MCP server
mcpcontract dump --server-name "My Server" --url http://localhost:3000/mcp --transport streamable-http --output dump.json

# Generate documentation
mcpcontract document manifest.json --template registry-ready --output README.md
```

📚 **For a complete walkthrough**, see the [complete workflow tutorial](docs/users/tutorials/complete-workflow.md).

## 🔍 Backward Compatibility Analysis

Analyze changes between MCP server versions to detect breaking changes:

```bash
# Example 1: To generate a changelog
mcpcontract diff --from v1.json --to v2.json --output diff.json
mcpcontract changelog --diff diff.json --output CHANGELOG.md

# Example 2: To generate a changelog with mention of breaking changes
mcpcontract diff --from v1.json --to v2.json --output diff.json
mcpcontract breaking --diff diff.json --output analysis.json
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

📘 **[Read the full MCP Compatibility Guidelines](docs/users/mcp-compatibility-guidelines.md)** for detailed philosophy, patterns, and best practices.

**Documentation**:
- [MCP Compatibility Guidelines](docs/users/mcp-compatibility-guidelines.md) — Philosophy and best practices
- [Example Artifacts](docs/users/examples/)

## �📖 Commands

### ✅ dump - Extract Capabilities from Live MCP Server

Extract complete capabilities from a running MCP server.

> **Note**: Supports three transport types:
> - `streamable-http` (recommended for HTTP, per MCP spec) or `http` (accepted as alias)
> - `sse` (Server-Sent Events)
> - `stdio` (standard input/output)

```bash
# Using config file
mcpcontract dump --config server-config.json --output dump.json

# Using CLI options - HTTP transport (recommended default)
mcpcontract dump \
  --transport streamable-http \
  --url "http://localhost:3000/mcp" \
  --output dump.json

# Using CLI options - SSE transport
mcpcontract dump \
  --transport sse \
  --url "http://localhost:3000/sse" \
  --output dump.json

# Using CLI options - STDIO transport (server name auto-generated from command)
mcpcontract dump \
  --transport stdio \
  --command "npx" \
  --args "-y" "@modelcontextprotocol/server-everything" \
  --output dump.json
```

**Status**: ✅ Fully implemented and tested

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

### ⚠️ manifest - Generate server.json Manifest [EXPERIMENTAL]

Generate MCP registry-compatible manifest from capability dump and metadata.

```bash
mcpcontract manifest \
  --mcpdesc capabilities-dump.json \
  --info server-info.json \
  --output server.json \
  --add-capabilities-meta
```

**Status**: ⚠️ **EXPERIMENTAL** - Under active development, may change

### ✅ validate - Validate Files Against Schemas

Validate dump or manifest files against MCP schemas.

```bash
mcpcontract validate server.json --schema manifest
mcpcontract validate dump.json --schema dump --strict
```

**Status**: ✅ Fully implemented and tested

### ✅ document - Generate Documentation

Generate human-readable documentation from manifests or dumps.

```bash
mcpcontract document server.json --template registry-ready --output README.md
mcpcontract document server.json --template default --output MANIFEST.md
```

**Status**: ✅ Fully implemented and tested

### ✅ diff - Compare Capability Versions

Generate structural diff between two capability dumps or manifests.

```bash
mcpcontract diff --from dump-v1.json --to dump-v2.json --output diff.json
```

**Status**: ✅ Fully implemented and tested

### ✅ breaking - Detect Breaking Changes

Apply compatibility rules to identify breaking changes. The output analysis file contains both the original diff data and severity annotations.

```bash
mcpcontract breaking --diff diff.json --rules rules/breaking-changes.yaml --output diff-breaking.json
```

**Status**: ✅ Fully implemented and tested  
**Exit Codes**: 0 (compatible), 1 (breaking), 2 (error)  
**Note**: The analysis file includes the complete diff with added severity ratings, so changelog can use it as a standalone input.

### ✅ changelog - Generate Human-Readable Changelogs

Render markdown changelogs from structural diff or breaking change analysis.

```bash
mcpcontract changelog --breaking diff-breaking.json --output CHANGELOG.md --format summary
mcpcontract changelog --breaking diff-breaking.json --output RELEASE-NOTES.md --format detailed
mcpcontract changelog --breaking diff-breaking.json --output STATS.md --format stats
```

**Status**: ✅ Fully implemented and tested

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
mcpcontract rules export --summary --output catalog-summary.json
mcpcontract rules export --catalog rules/strict-compatibility-catalog --format markdown
```

**Status**: ✅ Fully implemented and tested  
**Catalog Entries**: 33 rules documented (40+ variants, 60+ examples)  
**Categories**: tools (12), prompts (8), resources (6), resourceTemplates (3), serverInfo (5)  
**Features**:
- Complete documentation with rationale and migration guidance
- Pass/fail examples for each rule variant
- **Custom catalog support** with `--catalog` option for team-specific rules
- **Severity comparison** when using custom catalogs (shows differences from default)
- Auto-discovery based on rules filename (e.g., `strict-compatibility.yaml` → `strict-compatibility-catalog/`)
- Manual catalog override with `--catalog` flag
- Export as JSON or Markdown
- Searchable by category, severity, breaking status  
**Formats**: detailed, summary, stats  
**Exit Codes**: Inherits from analysis (0=compatible, 1=breaking, 2=error)

**Input Options**:
- `--diff <file>`: Use raw structural diff (no severity ratings)
- `--breaking <file>`: Use analysis file which contains diff + severity annotations (recommended)

## 🏗️ Project Structure

For a detailed file/module map see [AGENTS.md](AGENTS.md). High-level layout:

```
mcpcontract/
├── src/
│   ├── commands/        # Commander subcommands (thin argument-parsing layer)
│   ├── lib/             # Core logic (dumper, differ, rules-engine, splitter, …)
│   └── index.ts         # CLI entry point
├── schemas/             # JSON schemas (versioned: dump/, mcp-description/, diff/, …)
├── rules/               # Compatibility rules (YAML) + documentation catalog
├── templates/           # Handlebars templates (manifests, dumps, changelogs)
├── tests/               # Jest unit + integration tests, shell smoke tests
└── docs/
    ├── users/           # User guides, tutorials, examples
    └── maintainers/     # Architecture, design decisions, internal notes
```

## 📖 Example Artifacts

See **[docs/users/examples/](docs/users/examples/)** for working examples:

- `http-with-auth-config.yaml` — MCP server config with Bearer-token authentication
- `split-federation-services.yaml` + `split-example.md` — splitting a federation dump by service
- `ietf-network-mgmt-mcp-dump.json` + `ietf-network-mgmt.md` — a synthetic dump for the IETF network-management MCP draft, plus its rendered documentation
- `html/` — sample HTML output from `mcpcontract document`


## 🔧 Development Commands

```bash
# Build
npm run build

# Watch mode (auto-rebuild on changes)
npm run watch

# Clean build directory
npm run clean

# Run tests (when implemented)
npm test

# Test coverage (when implemented)
npm run test:coverage
```

## 📚 Documentation

- **[Quick Start](docs/quick-start.md)** — Install + first dump in five minutes
- **[Complete workflow tutorial](docs/users/tutorials/complete-workflow.md)** — End-to-end tutorial
- **[User docs](docs/users/)** — Schemas, compatibility guidelines, examples
- **[Maintainer docs](docs/maintainers/)** — Architecture and design decisions
- **[AGENTS.md](AGENTS.md)** — Developer guide (build, test, release)
- **[Changelog](CHANGELOG.md)** — Version history

## 🔖 Version Management

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html):

- **MAJOR** (X.0.0): Breaking changes to CLI interface or schema structure
- **MINOR** (0.X.0): New commands or features, backward-compatible additions
- **PATCH** (0.0.X): Bug fixes, documentation updates, non-breaking changes

All notable changes are documented in [CHANGELOG.md](CHANGELOG.md). Contributors should update the changelog when implementing new features or fixes.

## 🔗 Related Projects

- **MCP Registry**: https://github.com/modelcontextprotocol/registry
- **MCP Specification**: https://modelcontextprotocol.io

## License

This software is licensed under the Apache License 2.0. See [LICENSE](LICENSE) for details.



