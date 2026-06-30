# Quick Start

Get going with `mcpcontract` in five minutes using the public
[Microsoft Learn MCP Server](https://learn.microsoft.com/api/mcp).

## Install

```bash
# From npm (recommended)
npm install -g @cisco_open/mcptoolkit-contract

# …or from source
git clone https://github.com/cisco-open/mcptoolkit-contract.git
cd mcptoolkit-contract && npm install && npm run build && npm install -g .

mcpcontract --version
```

## 1. Extract capabilities

```bash
# Interactive wizard (easiest first run)
mcpcontract dump

# …or directly
mcpcontract dump \
  --transport streamable-http \
  --url https://learn.microsoft.com/api/mcp \
  --format yaml \
  --output ms-learn-dump.yaml
```

Add `--verbose` to debug connection issues. The output is an
[mcpdesc](users/reference/schemas.md) document describing every tool the server
exposes.

## 2. Validate

```bash
mcpcontract validate ms-learn-dump.yaml          # auto-detects schema + version
mcpcontract validate --show-compatibility        # CLI ↔ schema matrix
```

## 3. Generate documentation

```bash
mcpcontract document ms-learn-dump.yaml \
  --template reference-documentation \
  --output ms-learn-documentation.md
```

## 4. Track changes between versions

This repo ships two historical snapshots of the Microsoft Learn server so you can
run a real comparison without dumping twice:

```bash
D=docs/users/examples/microsoft-learn

# Structural diff (old → new)
mcpcontract diff \
  --from $D/ms-learn-dump-v1.0.0-2025-11-20.yaml \
  --to   $D/ms-learn-dump-v1.0.0-2026-06-30.yaml \
  --output changes.json

# Classify changes and suggest a SemVer bump
mcpcontract breaking --diff changes.json --suggest-version --output analysis.json

# Render a human-readable changelog
mcpcontract changelog --breaking analysis.json --format release --output CHANGELOG.md
```

You'll see **8 changes (4 breaking)** and a recommended **MAJOR** bump
(`1.0.0 → 2.0.0`) — new tool output schemas and capability changes, with the
deprecated `question` parameter removed. `breaking` exits `1` when breaking
changes are found, which is handy for gating CI. Use `--format compact` for a
brief one-line-per-change summary.

## What you just did

- **Extracted** capabilities from a live MCP server
- **Validated** the dump against the mcpdesc schema
- **Rendered** human-readable documentation
- **Compared** two versions and generated release notes

## Next steps

- [Complete workflow tutorial](users/tutorials/complete-workflow.md) — the full pipeline in depth
- [Rules catalog](users/tutorials/rules-catalog.md) — understand and customize compatibility rules
- [Splitting large dumps](users/tutorials/splitting-large-dumps.md) — organize multi-service servers
- [Command reference](../README.md) — every command and flag
- [mcpdesc schema](users/reference/schemas.md) — the document format
