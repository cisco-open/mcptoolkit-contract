# MCP Toolkit: Server Contract

The `mcpcontract` CLI dumps capabilities from live MCP servers, and lets you create changelogs, detect breaking changes, and generate documentation.

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Status: pre-release](https://img.shields.io/badge/status-2.1.0--rc.2-orange.svg)](CHANGELOG.md)
[![Node.js: >=22.x](https://img.shields.io/badge/Node.js-%3E%3D22.x-brightgreen.svg)](https://nodejs.org/)
[![mcpdesc: 0.8.0 + 0.9.0 RC.3](https://img.shields.io/badge/mcpdesc-0.8.0%20%2B%200.9.0--rc.3-blue.svg)](https://mcpdesc.org)

- **Getting Started:** jump to the [Quick Start](#-quick-start) — install and run your first dump
- **Backward Compatibility:** [backward compatibility](#-backward-compatibility-analysis) for MCP servers - spot breaking changes
- **MCP Description specification:** [mcpdesc.org](https://mcpdesc.org/format/) — format documentation and the current specification
- **CLI Commands:** mcpcontract [dump, diff, changelog, compare, document...](#-commands)

This CLI generates stable **MCP Description 0.8.0** dumps by default and
explicitly migrates to **0.9.0 RC.3** by default. Input rules follow explicit selectors, authored schema
identities, then maintained defaults. See [Versions and Selectors](docs/versions-and-selectors.md).

## MCP Description Compatibility

| MCP Description Version | Latest Matching CLI | Status |
| --- | --- | --- |
| `0.7.0` | [`1.2.4`](https://www.npmjs.com/package/@cisco_open/mcptoolkit-contract/v/1.2.4) | Historical format; 1.x maintenance line |
| `0.8.0` | `2.1.0-rc.2` | Stable dump default; maintained revision rules. Published 0.8-only CLI: [`2.0.5`](https://www.npmjs.com/package/@cisco_open/mcptoolkit-contract/v/2.0.5) |
| `0.9.0-rc.3` | Unreleased | Preview; migration default and opt-in for dumps in this development build |

Install an exact historical CLI without changing your global installation:

```bash
npx --package @cisco_open/mcptoolkit-contract@1.2.4 mcpcontract --help
npx --package @cisco_open/mcptoolkit-contract@2.0.5 mcpcontract --help
```

Each CLI release pins its library dependencies; it never fetches rules at runtime.
`project`, `document`, `diff`, `compare`, and `split` process supported 0.8.0 and
0.9.0 input under its selected rules. Native projection requires 0.9.0.
0.7.0 inputs are rejected with historical CLI guidance. Use CLI 2.0.5 to
convert 0.7.0 to 0.8.0; CLI 1.2.4 only processes the historical 0.7.0 format.
Supported 0.8.0 inputs receive a non-blocking recommendation on stderr to use
`migrate`, except when already running `migrate`.
Unsupported input versions produce guidance rather than implicit upgrades.
Commands such as `breaking` and `changelog` continue to consume their own diff schemas.

An explicit `--selector` wins over a recognized same-format `$schema`; without
either, the library's maintained format default applies. The shared `0.8.0.json`
identity selects `0.8.0-rev.20261021`; explicitly pin `0.8.0` for original rules.
The RC.3 schema identity selects the maintained preview snapshot. Earlier drafts
and RCs are retired from this dependency line; use a matching historical CLI to
reproduce their behavior.
Missing format versions, unknown schema identities, and cross-format conflicts fail.
Pin the CLI version in automation; dependency upgrades can advance maintained
defaults. Retired drafts/RCs require an older matching CLI release.

## 🚀 Quick Start

```bash
# Install the current stable CLI (0.8.0 support; see the compatibility table)
npm install -g @cisco_open/mcptoolkit-contract

# Verify installation
mcpcontract --version

# Extract the capabilities from a live MCP server 
mcpcontract dump --transport streamable-http --url "https://learn.microsoft.com/api/mcp" --format yaml --output "dump.yaml"

# Generate documentation in markdown format
mcpcontract document dump.yaml --template reference-documentation --output doc.md
```

**Next:** the [101 Tutorial](docs/101-tutorial.md) — a five-minute guided walkthrough that then leads into the [complete workflow](docs/users/tutorials/complete-workflow.md) tutorial for the full pipeline.


## 🔍 Backward Compatibility Analysis

Create dumps for two releases of an MCP server, then compare them in one step:

```bash
mcpcontract compare \
  --from v1.json \
  --to v2.json \
  --suggest-version \
  --output CHANGELOG.md
```

The `compare` command runs the full pipeline (diff → breaking analysis → changelog) in-process. The changelog goes to `--output` (or stdout), a human-readable verdict goes to stderr, and exit codes follow the same contract as `breaking`: `0` (compatible), `1` (breaking changes found), `2` (error). Use `--exit-zero` to suppress the exit-1 gate (e.g. when you always want the changelog regardless of result).

> For **CI pipelines** that need per-step artifacts, configurable gating, or separate report/changelog steps, see the [CI/CD guide](docs/users/cicd/README.md) — it covers both the one-step `compare` path and the staged `diff → breaking → changelog` pipeline.

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


## 📄 The MCP Description (`mcpdesc`) Specification

`mcpcontract` reads and writes documents in the **MCP Description** format
(`mcpdesc`) — a portable, machine-readable contract that declares everything an
MCP server offers (tools, resources, prompts, transports, security), much like
OpenAPI does for REST APIs. Every `dump`, `diff`, `document`, and `breaking`
operation is built on this format.

The current specification is published at
[mcpdesc.org](https://mcpdesc.org/format/) and developed and maintained in the
canonical
[`mcpdesc/mcpdesc-specification`](https://github.com/mcpdesc/mcpdesc-specification)
repository.

- **Read the v0.8 specification:** [mcpdesc.org/docs/specification/0.8.0](https://mcpdesc.org/docs/specification/0.8.0/)
- **Contribute to the format:** [mcpdesc/mcpdesc-specification](https://github.com/mcpdesc/mcpdesc-specification)
- **Browse versioned schemas:** [schemas/mcp-description](https://github.com/mcpdesc/mcpdesc-specification/tree/main/schemas/mcp-description)
- **Bundled legacy material:** the local [`spec/`](spec/) tree and `mcpdesc` 0.7.0 [schema](schemas/mcp-description/0.7.0.json) remain archived historical material, not active validation or migration support

This development CLI emits stable MCP Description 0.8.0 by default from `dump`;
use `dump --to-version 0.9.0` to opt into preview rules. `migrate` targets
0.9.0 with maintained preview rules, currently RC.3. Use CLI 2.0.5 for legacy conversion and CLI 1.2.4 for
historical 0.7.0 processing without upgrading.
New dumps do not include `x-cisco-metadata`.

The format is versioned **independently of this CLI**. `mcpcontract` targets a
specific `mcpdesc` version and is kept in sync as the specification advances,
providing explicit migration paths for supported older documents.
Companion tools — `mcpeditor`, `mcpmock`, and
`mcptest` — consume the same independently maintained format.


## 📖 Commands

### ✅ dump - Generate an MCP description from a live server

Connects to a live MCP server and extract its description (transport, tools, prompts, resources)

> **Note**: the command supports three transports:
> - `streamable-http` or `http` (accepted as alias)
> - `stdio`
> - `sse` (legacy - deprecated transport for MCP servers)
>
> Protocol negotiation defaults to `--protocol auto`, which probes modern MCP
> `2026-07-28` discovery and falls back to legacy initialization. Use
> `--protocol legacy` to skip discovery or `--protocol 2026-07-28` to require
> modern discovery without fallback.

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
# Authored multi-version descriptions require one effective view
mcpcontract document spec.yaml --protocol-version 2026-07-28 --output README.md
```

### ✅ project - Export a protocol-specific view

Export an Effective Protocol View as an MCP Description document, or project a
native MCP declaration for one protocol revision.

```bash
mcpcontract project spec.yaml --view effective \
  --protocol-version 2026-07-28 --output spec-2026.yaml
mcpcontract project spec.yaml --view native --kind tool --identifier search \
  --protocol-version 2026-07-28 --key-order document
```

### ✅ normalize - Normalize MCP Description serialization

Reorder known MCP Description members to the document-oriented profile and
serialize JSON or YAML without changing the document's values. This is a
formatting operation, not a validation step.
YAML uses core's Section 15.9 normalized presentation. Key ordering is
independently selectable as `document` (default), `preserve`, or `sorted`.
The same YAML presentation is used by `dump`, `split`, `migrate`, and `project`,
without changing their ordering defaults or JSON output.

```bash
mcpcontract normalize spec.yaml --output normalized.yaml
mcpcontract normalize spec.json --key-order preserve --output unchanged-order.json
```

Modern MCP Description input uses JSON scalar recognition with a string
fallback, not YAML Core resolution: plain `0o12`, `0x12`, `012`, `TRUE`, and
`~` remain strings. Use JSON spellings for actual numbers, booleans, and nulls.
These rules also apply to enrichment and migration-fix files, independently
of output presentation.

### ✅ convert - Show historical conversion guidance

This command no longer converts files. Normal invocations print guidance on
stderr and exit nonzero without reading or writing files; `--guide` prints
guidance and succeeds. Use the verified historical bridge release:

```bash
npx --package=@cisco_open/mcptoolkit-contract@2.0.5 mcpcontract convert \
  spec-0.7.yaml --output spec-0.8.yaml
```

### ✅ migrate - Upgrade MCP Description versions

The installed CLI's maintained migration target is 0.9.0, using RC.3 preview
rules by default. Input must use 0.8.0 or 0.9.0. First convert 0.7.0 with
CLI 2.0.5. Review blockers and apply only explicitly requested fixes.

```bash
# Upgrade with the maintained rules; optionally normalize the key order
mcpcontract migrate spec-0.8.yaml --output spec-0.9.yaml
mcpcontract migrate spec-0.8.yaml --key-order document --output normalized.yaml
# Optionally pin exact supported destination rules
mcpcontract migrate spec-0.8.yaml --selector 0.9.0-rc.3 --output pinned.yaml
```

Preview rules may change between snapshots. `migrate` never guesses
URI values, rounds numbers, or removes properties unless a fix is supplied.
Reports list each upgrade step. `--patch patch.json` always applies to the
original input document; key ordering is serialization and does not change the
patch. `--key-order` accepts `preserve` (default), `document` (the same
ordering as `normalize`), or `sorted`. Ordering preserves values and array
order, not comments, whitespace, quoting, or original bytes. JSON is the default
on stdout; an output path ending in `.yaml` or `.yml` selects YAML unless
`--format` overrides it.
Fix paths refer to the 0.8.0 document at the 0.8-to-0.9 step. Failed migrations
can write a diagnostic report, but never a partial final document or patch.
Already-current input is validated and reported as unchanged; it is not
implicitly converted between preview snapshots. `migrate` no longer accepts
`--to-version`; omit it to use the maintained target. Pin the CLI version for
reproducible automation.

### ✅ diff - Compare two releases of an MCP server

Generate structural diff between two MCP descriptions.

```bash
mcpcontract diff --from dump-v1.json --to dump-v2.json --output diff.json
# Authored multi-version descriptions require one effective view
mcpcontract diff --from v1.json --to v2.json --protocol-version 2026-07-28
```

### ✅ breaking - Detect Breaking Changes

Apply compatibility rules to identify breaking changes. The output analysis file contains both the original diff data and severity annotations.

```bash
mcpcontract breaking --diff diff.json --rules rules/breaking-changes.yaml --output diff-breaking.json
```

**Exit Codes**: 0 (compatible), 1 (breaking), 2 (error)  
**Note**: The analysis file includes the complete diff with added severity ratings, so changelog can use it as a standalone input.

### ✅ changelog - Generate Human-Readable Changelogs

Render markdown changelogs from a structural diff or an annotated diff. Run `breaking` first to highlight breaking changes.

```bash
# Comprehensive release notes (default)
mcpcontract changelog --diff diff-breaking.json --output CHANGELOG.md --format release

# Brief one-line-per-change summary
mcpcontract changelog --diff diff-breaking.json --output CHANGELOG.md --format compact
```

**Input**: `--diff <file>` — the structural diff from `diff`, or the annotated diff from `breaking` (e.g. `diff-breaking.json`). Run `breaking` first to highlight breaking changes. The command is a pure renderer and always exits `0` on success.

### ✅ compare - Run the Full Comparison Pipeline in One Step

Runs `diff → breaking analysis → changelog` in a single command. Useful for ad-hoc comparisons and simple CI steps where per-step artifacts are not needed.

```bash
# Compare two versions, render a changelog, and gate on breaking changes
mcpcontract compare --from v1.json --to v2.json --output CHANGELOG.md

# Include a SemVer recommendation in the report
mcpcontract compare --from v1.json --to v2.json --suggest-version --output CHANGELOG.md

# Compact format; exit 0 regardless of breaking changes (changelog always written)
mcpcontract compare --from v1.json --to v2.json --format compact --exit-zero --output CHANGELOG.md

# Escape hatches: also write the intermediate diff and breaking-analysis files
mcpcontract compare --from v1.json --to v2.json \
  --emit-diff diff.json \
  --emit-breaking diff-breaking.json \
  --output CHANGELOG.md
```

**Exit Codes**: `0` (compatible), `1` (breaking changes found), `2` (error) — same contract as `breaking`. `--exit-zero` suppresses the `1→0` promotion but never masks `2`.

> For fine-grained CI control (per-step artifacts, separate gate and report jobs), see the [CI/CD guide](docs/users/cicd/README.md).

### ✅ rules - Browse Compatibility Rules Catalog

Browse and explore the backward compatibility rules catalog with comprehensive documentation and examples.

```bash
# List all rules (default catalog)
mcpcontract rules list

# Discover available catalogs in the rules/ directory
mcpcontract rules list-catalogs

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

**Catalog**: 34 documented rules across tools (12), prompts (8), resources (6), resourceTemplates (3), serverInfo (5) — each with rationale, migration guidance, and pass/fail examples. Custom team catalogs are supported via `--catalog`, which also shows how severities differ from the defaults. See the [rules catalog tutorial](docs/users/tutorials/rules-catalog.md).

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
mcpcontract validate preview.yaml --selector 0.9.0-rc.3 --format json
```

## 🏗️ Project Structure

For a detailed file/module map see [AGENTS.md](AGENTS.md). High-level layout:

```
mcpcontract/
├── src/
│   ├── commands/        # Commander subcommands (thin argument-parsing layer)
│   ├── lib/             # Core logic (dumper, differ, rules-engine, splitter, …)
│   └── index.ts         # CLI entry point
├── spec/                # Archived MCP Description v0.7 specification material
├── schemas/             # JSON schemas (versioned: mcp-description/, diff/, …)
├── rules/               # Compatibility rules (YAML) + documentation catalog
├── templates/           # Handlebars templates (dumps, changelogs)
├── scripts/             # Helper scripts (badge sync)
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

- **[101 Tutorial](docs/101-tutorial.md)** — Install & generate your first dump in five minutes
- **[Full Tour Tutorial](docs/users/tutorials/complete-workflow.md)** — End-to-end tutorial
- **[User docs](docs/users/)** — Schemas, compatibility guidelines, examples
- **[Maintainer docs](docs/maintainers/README.md)** — Architecture and design decisions

## License

This software is licensed under the Apache License 2.0. See [LICENSE](LICENSE) for details.
