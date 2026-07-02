# CI/CD Guide

This guide explains how to use `mcpcontract` in automated pipelines to detect
breaking changes, gate releases, and produce changelogs.

## Two paths

| Path | Best for | Key command |
|---|---|---|
| **One-step `compare`** | Local review, PR summaries, simple single-step CI | `mcpcontract compare` |
| **Staged pipeline** | Advanced CD: per-step artifacts, precise gating, separate report/publish steps | `diff` → `breaking` → `changelog` |

Both paths share the same exit-code contract (from `breaking`):

| Code | Meaning |
|---|---|
| `0` | Success — no breaking changes |
| `1` | Success — breaking changes detected |
| `2` | Error (bad input, parse failure, IO) |

`--exit-zero` on `compare` or `changelog` suppresses exit `1` → `0` but never
masks `2`.

## One-step `compare`

```bash
# Changelog → stdout; report → stderr; gates on breaking (exit 1 if breaking)
mcpcontract compare --from prev.json --to next.json

# Write changelog to file
mcpcontract compare --from prev.json --to next.json --output CHANGELOG.md

# Interactive / non-gating
mcpcontract compare --from prev.json --to next.json --exit-zero

# With version recommendation
mcpcontract compare --from prev.json --to next.json --suggest-version
```

See [compare command reference](../../../README.md#compare) or
`mcpcontract compare --help` for all options.

## Staged pipeline

```bash
#!/usr/bin/env bash
set -euo pipefail

# 1. Structural diff
mcpcontract diff --from prev.json --to next.json --output diff.json

# 2. Breaking-change gate — exit code is the contract
breaking_status=0
mcpcontract breaking --diff diff.json --suggest-version \
  --output diff-breaking.json || breaking_status=$?

# 3. Always render the changelog
mcpcontract changelog --diff diff-breaking.json --output CHANGELOG.md

# 4. Act on the gate
case "$breaking_status" in
  0) echo "✅ Compatible" ;;
  1) echo "⛔ Breaking changes — bump MAJOR"; exit 1 ;;
  *) echo "❌ Error"; exit 2 ;;
esac
```

## GitHub Actions workflows

See [github-actions.md](github-actions.md) for copy-pasteable workflow templates
(both one-step and staged variants).

## Seeding the baseline (`prev.json`)

`compare` and `diff` both need a baseline dump of the previous release. Common
strategies:

1. **Committed file** — commit `contracts/latest.json` to the repo on every
   release. Simple, no network required in CI.
2. **GitHub Release asset** — upload the dump as a release artifact when tagging,
   download it in CI with `gh release download`.
3. **Published npm package** — if the server ships as an npm package, download
   the prior version and run `mcpcontract dump` against it.
