# Changelog

All notable changes to mcpcontract will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- toc -->

- [[Unreleased]](#unreleased)
- [[1.0.0-rc.4] - 2026-06-30](#100-rc4---2026-06-30)
- [[1.0.0-rc.3] - 2026-06-29](#100-rc3---2026-06-29)
- [[1.0.0-rc2] - 2026-06-25](#100-rc2---2026-06-25)
- [[1.0.0-rc1] - 2026-06-04](#100-rc1---2026-06-04)

<!-- tocstop -->

## [Unreleased]

## [1.0.0-rc.4] - 2026-06-30

### Changed

- **Reorganized user documentation** for clarity and to reduce redundancy:
  - Added `docs/users/reference/` — merged `schemas.md` + `dump-schema.md` into a single `schemas.md`, moved the compatibility guidelines to `compatibility.md`, and shrank the deprecated-`convert` guide to a concise `convert-legacy.md` note.
  - Consolidated tutorials — folded the changelog tutorial into `complete-workflow.md` and renamed `rules-catalog-guide.md` to `rules-catalog.md`.
  - Moved the Microsoft Learn sample dumps to `docs/users/examples/microsoft-learn/` and rewrote the quick start around a real `diff`/`breaking`/`changelog` demo using two historical snapshots.
  - Dropped the synthetic IETF example (kept the federation split example) and slimmed the README, removing duplicated command/rules detail.

### Removed

- **MCP server registry/manifest support removed.** Dropped the `manifest` command, the `server` and `manifest-info` schemas, the manifest/registry document templates, and the related `validate --schema` / `document --type` / `document --template` options. mcpcontract now focuses on dump, document, and change tracking (diff/breaking/changelog). Pre-GA removal — no deprecation cycle or migration tooling.
- **Legacy on-disk capability-dump format removed.** `mcpcontract dump` now emits only the MCP Description (mcpdesc) format. The `dump` schema (`schemas/dump/`, `dump-schema.json`) and its `validate --schema dump` option are gone, and `diff`/`document`/`split` reject legacy dump files as input. Convert older files to mcpdesc first with `mcpcontract convert`.

### Deprecated

- **`mcpcontract convert` is deprecated** and will be removed in a future release. It remains available solely to migrate older capability dumps to the mcpdesc format and now prints a deprecation warning.

## [1.0.0-rc.3] - 2026-06-29

### Changed

- Renamed npm scope from `@cisco-open` to `@cisco_open` to match the cisco_open npm organisation; all install instructions updated

## [1.0.0-rc2] - 2026-06-25

### Changed

- **Minimum Node.js version raised to 20+** — dropped Node 18 support; updated `engines.node` in `package.json` to `>=20.0.0` and removed `18.x` from the CI test matrix
- Upgraded all dependencies to latest: Jest 30.4.2, TypeScript 6.0.3, `@types/node` 26, `commander` 15, `marked` 18, `@modelcontextprotocol/sdk` 1.29
- Added `"types": ["node"]` to `tsconfig.json` (required by TypeScript 6)
- Replaced `ts-jest` with `@swc/jest` for Jest transforms — no `ts-jest` release exists for Jest 30; `@swc/jest` provides faster, equivalent ESM transpilation

### Fixed

- Replaced `uuid` package with built-in `crypto.randomUUID` (`node:crypto`) in `differ.ts`

### Security

- Fixed all npm audit vulnerabilities (6 high, 19 moderate, 1 low) via `npm audit fix`
  — upgraded transitive deps: `@hono/node-server` 1.19.14, `hono` 4.12.27, `express-rate-limit` 8.5.2, `ip-address` 10.2.0, `fast-uri` 3.1.2, `path-to-regexp` 8.4.2, `picomatch` 2.3.2, `@babel/core` 7.29.7, `qs` 6.15.2
- Added `overrides.js-yaml: "^4.2.0"` in `package.json` to force a patched `js-yaml` version throughout the dependency tree (GHSA-h67p-54hq-rp68)

### CI

- Removed Node 18.x from the test matrix; now testing on 20.x / 22.x / 24.x
- Bumped GitHub Actions: `actions/checkout` 4 → 7, `actions/setup-node` 4 → 6

## [1.0.0-rc1] - 2026-06-04

First open-source release of `@cisco-open/mcptoolkit-contract`.

This release consolidates pre-1.0 development into a single, stable v1.0 line. Pre-1.0 changelog history is omitted; the published artefact in this release supersedes all prior internal versions.

### Highlights

- **CLI commands**: `dump`, `split`, `manifest`, `validate`, `document`, `diff`, `breaking`, `changelog`, `rules`, `completion`, `agent`, `agents`, `wizard`, `convert`
- **Schemas** (versioned under `schemas/<type>/<version>.json`, latest mapping in `schemas/latest.json`):
  - `mcp-description` 0.7.0 (capability dump format with CORS support, pagination, and `x-cisco-metadata` extension)
  - `manifest-info` 1.0.0
  - `diff` 1.0.0, `diff-breaking` 2.0.0
  - `split-config` 1.0.0
  - `server` 2025-12-11 (MCP registry manifest)
- **Compatibility rules**: 35 default rules in `rules/breaking-changes.yaml` + 33 catalog entries under `rules/catalog/`; custom catalogs supported via `--catalog`
- **Templates**: `card-view` HTML, `default-manifest`, `reference-manifest`, `registry-ready`, `default-dump`, `reference-dump`, plus five changelog formats (release, compact, detailed, summary, stats)
- **Open-source governance**: Apache-2.0 license, `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1), `CONTRIBUTING.md` (DCO sign-off), `SECURITY.md` (coordinated disclosure via GitHub advisories and `oss-security@cisco.com`), `MAINTAINERS.md`, `SUPPORT.md`
- **CI/CD**: `.github/workflows/ci.yml` builds and runs 174 tests on Node 18 / 20 / 22; dependabot configured for weekly npm and monthly GitHub Actions updates
- **Documentation**: reorganised into `docs/users/` (tutorials, examples, schemas reference) and `docs/maintainers/` (design notes, implementation specs)

### Package

- npm: `@cisco-open/mcptoolkit-contract` (public)
- Binary: `mcpcontract`
- License: Apache-2.0
- Repository: `github.com/cisco-open/mcptoolkit-contract`
