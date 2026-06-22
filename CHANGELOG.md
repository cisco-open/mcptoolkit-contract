# Changelog

All notable changes to mcpcontract will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- toc -->

- [[Unreleased]](#unreleased)
- [[1.0.0-rc1] - 2026-06-04](#100-rc1---2026-06-04)

<!-- tocstop -->

## [Unreleased]

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
