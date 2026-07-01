# mcpcontract — Architecture & Design Decisions

This document consolidates the architectural and design rationale that accumulated across per-feature implementation specs during the v0.1 → v1.0 development cycle. It is the canonical reference for **why** mcpcontract is shaped the way it is; for **what** each command does, see [AGENTS.md](../../../AGENTS.md), and for release-level history see [CHANGELOG.md](../../../CHANGELOG.md).

Companion design doc: [architecture.md](architecture.md) (module-level overview).

---

## 1. Scope and Two-Artifact Model

mcpcontract works with two related but distinct artifacts:

| Artifact | Schema | Produced by | Purpose |
|---|---|---|---|
| **Dump** | `dump/0.3.8` (internal) | `mcpcontract dump` | Snapshot of a live server at time *T* |
| **MCP Description** (mcpdesc) | `mcp-description/0.7.0` (external spec) | `mcpcontract dump`, `mcpcontract convert` | Formal capability declaration ("OpenAPI for MCP") |

**Arbitration: why two schemas instead of one?**

- **Ownership separation.** mcpdesc is an external specification we contribute to; the dump is an internal observation record we control.
- **Concern separation.** Dump is *observational* (what was answered when we asked), mcpdesc is *declarative* (what the server claims to offer).
- **Update cadence.** Dumps evolve with the MCP protocol; mcpdesc evolves with tooling needs. Coupling them would slow both.

A standalone alternative to the ADL-profile-based mcpdesc was explored (see `dust/.../36-MCP-DESCRIPTION-STANDALONE.md`) but rejected: building on the IETF ADL draft reuses its envelope (lifecycle, data_classification, security) and gains future interop, at the cost of a thin profile layer.

> **Note:** Registry/manifest (`server.json`) support was removed before GA. mcpcontract focuses on dump, document, and change tracking (diff/breaking/changelog); registry submission is out of scope.

---

## 2. Foundation & CLI Architecture

**Stack:** TypeScript (ES modules with `.js` import extensions), Node.js ≥18, Commander.js for subcommands, Ajv (JSON Schema draft-07) for validation, Handlebars for templates, Jest with `--experimental-vm-modules` for tests, `@modelcontextprotocol/sdk` for client transport.

**Arbitrations made:**

- **Commander over yargs/oclif.** Wanted a `git`-style nested subcommand UX without oclif's plugin scaffolding. Commander is a thin layer over Node's `process.argv` and is easy to extend with custom help.
- **Ajv over Zod.** MCP schemas are authored in JSON Schema; Ajv validates them directly. Zod would require duplicating each schema as a TypeScript declaration.
- **Handlebars over EJS.** Logic-less templates discourage embedding business rules in documentation. We accept Handlebars' verbosity (`{{#each}}`/`{{#if}}`) for that constraint.
- **ES modules with `.js` extensions.** Required by Node's ESM resolution. Painful in TypeScript editor experience but eliminates the dual-build CJS/ESM complexity.
- **Layered structure.** [src/commands/](../../../src/commands/) holds Commander wiring + argument parsing only; all logic lives in [src/lib/](../../../src/lib/). This makes commands trivially shellable from other commands (e.g., `breaking` calls into the rules engine).

---

## 3. The Pipeline: dump → validate → document → diff → breaking → changelog

Each command takes structured input and produces a versioned artifact that the next command in the pipeline can consume. Artifacts are **immutable JSON/YAML**, designed for CI/CD checkpointing.

### 3.1 dump

Extracts every capability surface (tools, resources, resource templates, prompts) plus protocol metadata from a live server.

**Key implementation choices:**

- **Pagination is exhaustive** (see §6). Before v0.19.0, only the first page of paginated `list*` calls was captured, silently truncating large servers. Now `listToolsComplete()` etc. loop on `nextCursor` until exhausted, recording `pagesRetrieved` and `totalItems` in `dumpExecution.paginationSupport`.
- **Passive feature detection.** CORS, session headers, ping, and pagination are all observed during normal operation. No extra discovery calls.
- **Wizard mode (`--wizard`)** uses `@inquirer/prompts` for guided dumps. Triggered automatically when `dump` is invoked with no args.
- **Direct mcpdesc output.** Since v0.25.0, `dump` outputs mcpdesc format natively (not the legacy ContractDump format that needed a separate `convert` step). The legacy format and `convert` command are retained for backward compat.

### 3.2 validate

Schema validation backed by Ajv. Supports `dump`, `mcpdesc`, `diff`, `diff-breaking`, `dump-split` schemas.

**Decisions:**

- **`validateFormats: false`.** URI templates contain placeholders like `{PORT}` which fail strict URI validation. We accept the trade-off (no format validation for `uri`/`email` fields) because the formal correctness those checks provide is less valuable than allowing parameterized URLs.
- **Version-aware.** The validator auto-detects schema version from the document's `version`/`$schema` field and loads the matching historical schema from `schemas/<type>/<version>.json`. Old dumps validate without re-dumping.
- **Compatibility matrix.** `mcpcontract validate --show-compatibility` reads `schemas/cli-schema-compatibility.json` to tell users which CLI version matches which schema.

### 3.3 document

Handlebars templating with dump-specific variants (`mcpdesc-documentation`, `reference-documentation`, `card-view`).

**Decisions:**

- **Auto-detect input.** dump vs mcpdesc is detected from the schema-version field, so users typically don't need `--template`.
- **Helpers are minimal but composable.** `json`, `eq`, `capitalize`, `count`, `groupBy`, `contains`. Adding more helpers is discouraged; complex transforms should happen upstream.
- **Custom templates** are paths, not names — to avoid a plugin system.

### 3.4 diff

Structural diff between two dumps, normalizing across format differences.

**Key implementation choices:**

- **Schema version compatibility is enforced.** Comparing across major schema versions is an error; across minor versions a warning. Output bumps `diff/1.0.0`.
- **MCP-aware change names.** Instead of generic JSON Patch, we emit named change types like `tool-removed`, `parameter-enum-values-changed`, `resource-uri-changed`. These names are the join key against the rules catalog.
- **Stable output schema.** Diff JSON is consumed by `breaking` and `changelog`. Its shape is part of the public contract.

### 3.5 breaking

Applies a YAML rules catalog to a diff artifact to classify each change as breaking / non-breaking / informational with a severity.

**Design rationale:**

- **Postel's Law as default.** Enum additions, optional parameter additions, new tools, new capabilities are **not** breaking. Clients are expected to ignore unknown fields. This is encoded in `rules/breaking-changes.yaml`.
- **Conditional rules.** A rule can carry operators (`equals`, `notEquals`, `hasAdditions`, `hasRemovals`, `onlyAdditions`, `onlyRemovals`) that examine the diff's `before`/`after`/`added`/`removed` arrays. Same change type can produce different conclusions depending on the change shape.
- **YAML over code.** Rules are authored in YAML so they can be audited, version-controlled, and overridden by organizations without forking the CLI.
- **Exit codes are part of the contract.** `0` compatible, `1` breaking found, `2` error. Designed for `breaking --diff x.json || alert-pipeline.sh`.

### 3.6 changelog

Renders a human-readable changelog from a diff (and optional breaking analysis) via Handlebars templates.

**Decisions:**

- **Three formats:** `release` (comprehensive release notes), `compact` (brief), `detailed`/`summary`/`stats` (legacy, retained for backward compat).
- **Version recommendation.** With `--suggest-version`, the changelog includes a SemVer bump suggestion derived from the breaking analysis: any `critical` → MAJOR; any `info`/`minor` additions → MINOR; only fixes → PATCH.
- **Server-rename detection.** Changes in `serverInfo.name` between versions produce an explicit "Server renamed" entry in compact/release output.

---

## 4. Rules Catalog System

Compatibility rules live in two parallel structures:

- `rules/breaking-changes.yaml` — the **operational** rules consumed by `breaking` (35 rules across tools/prompts/resources/resourceTemplates/serverInfo).
- `rules/catalog/<category>/<change>.yaml` — **documentation** entries with pass/fail examples, rationale, and migration guidance (34 entries today).

**Design arbitrations:**

- **Documentation entries are programmatically executable.** Each pass/fail example is a self-contained diff fragment, so test generation reads the catalog and produces ~47 auto-generated tests (`tests/unit/catalog-generated.test.ts`). This means catalog drift breaks the build immediately.
- **Custom catalogs by convention.** `rules/my-rules.yaml` is paired with `rules/my-rules-catalog/` automatically. `--catalog <dir>` overrides this. Falling back to the default catalog when an entry is missing was rejected — it would mask configuration errors.
- **Severity comparison.** When using a custom catalog, `rules list --catalog ...` annotates each rule with `Severity: major (default: info)` so reviewers see organizational deviations from MCP defaults at a glance.
- **Variants.** A single change type can have multiple outcomes (e.g., `parameter-enum-values-changed` has separate variants for additions-only vs removals); these are first-class in the schema rather than encoded in the message string.

---

## 5. Split Command

`mcpcontract split` takes a federation dump (often 100+ tools aggregated from backend services) and produces multiple focused dumps based on regex name filters.

**Design choices:**

- **Phase 1 = tools only.** Prompts, resources, and resource templates are deferred until concrete need surfaces. Filtering all four with the same pattern model is trivial; we resisted shipping it without a user with that need.
- **Metadata via `additionalProperties`.** Split provenance lives in `dumpExecution.splitOperation` (`toolName`, `toolVersion`, `createdAt`, `splitConfig`, `splitExecution.filterRules`). This required **no schema version bump** because the dump schema already permits `additionalProperties: true` on `dumpExecution`. Two-level provenance is preserved (original dump tool → split tool).
- **Original description preservation.** v0.14.2 removed earlier behavior that modified the dump description on split. The original is untouched; split context lives only in metadata.
- **Unmatched items** have four policies: `ignore`, `warn`, `error`, `separate-file`. Default `separate-file` makes data loss impossible.
- **Pattern matching is deliberately simple.** Regex over name only. Tag-based and description-based filtering are listed for post-1.0 (Phase 7.3).

---

## 6. Protocol & Transport Detection

Dump captures several MCP protocol features beyond the basic capability surface. Each feature ships as an optional field in `dumpExecution` (forward-compatible), with passive detection during normal operation.

### 6.1 Pagination (v0.19.0)

**Problem:** Pre-v0.19.0 `dump` called `listTools()` / `listResources()` / `listPrompts()` once and stored the result. MCP supports cursor-based pagination via `nextCursor`. For large servers, **dumps were silently truncated** to the first page (typically 50 items).

**Fix:** Introduced exhaustive list methods in [client.ts](../../../src/lib/client.ts) (`listToolsComplete`, etc.) that loop on `nextCursor` until null, accumulating items. Per-capability records are written to `dumpExecution.paginationSupport`:

```json
{
  "tools":     { "paginationDetected": true,  "pagesRetrieved": 3, "totalItems": 142 },
  "prompts":   { "paginationDetected": false, "pagesRetrieved": 1, "totalItems": 5 },
  "resources": { "paginationDetected": true,  "pagesRetrieved": 2, "totalItems": 67 }
}
```

**Detection is passive:** `paginationDetected` is `true` iff more than one page was needed. No extra request is issued to "test" pagination. `--page-size` controls the requested page size for diagnostics.

### 6.2 CORS Support (v0.17.0)

**Why:** Browser-based tools (MCP Inspector and others) need to know whether a streamable-http server can be reached cross-origin.

**Detection:** An `OPTIONS` preflight to the server URL. Captures `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, and crucially whether the session ID header is listed in `Access-Control-Expose-Headers`. Records:

```json
"corsSupport": {
  "browserReady": true | false | null,
  "corsHeaders": { ... },
  "preflight": { "status": 204, "allowOrigin": "*", ... },
  "sessionHeaderExposed": true
}
```

`browserReady` is a heuristic boolean: true requires permissive Access-Control-Allow-Origin **and** session-header exposure. `null` means we couldn't determine (server didn't respond to OPTIONS). Skip with `--skip-cors-check`; override origin with `--cors-origin`.

### 6.3 Session ID Header (v0.15.x)

MCP streamable-http servers issue a session ID via a response header. The SDK normalizes this header internally, but the **exact casing varies** across server implementations (`Mcp-Session-Id` vs `MCP-Session-Id` vs `mcp-session-id`). Dump records the casing observed in the actual response, falling back to the canonical name when unavailable, in `dumpExecution.sessionIdHeader`.

### 6.4 Streamable HTTP Auth Headers (v0.14.3)

Custom HTTP headers (Bearer tokens, API keys) are passed through to the SDK's `StreamableHTTPClientTransport` via its `requestInit.headers` option. Achieves parity with SSE transport header support. **Full OAuth flows are deferred to a Phase 2** pending real-world requirements for token refresh, storage, and PKCE — see `dust/.../33-oauth-best-practices.md` for the deferred design.

### 6.5 Ping Detection (v0.18.1)

Issues a single `ping` request after `initialize` with a 5-second timeout. Records `pingSupported: boolean` and `pingLatencyMs: number` in `dumpExecution`. Useful as a baseline performance signal and as a discoverability check for proxy/gateway implementations.

### 6.6 Cross-Cutting: Forward Compatibility

All detection fields above are **optional in the schema**. Older CLIs reading newer dumps simply ignore them. Newer CLIs reading older dumps treat their absence as "unknown", not "unsupported". This is enforced by `additionalProperties: true` on `dumpExecution`.

---

## 7. Schema Versioning Strategy

**Approach:** Immutable historical schemas, no migration tooling.

- Each schema type has a directory of versioned files (e.g. `schemas/mcp-description/0.7.0.json`, `schemas/diff/1.0.0.json`).
- `schemas/latest.json` is a small JSON map from schema type → current version, read at build time and by `--show-compatibility`.
- `schemas/cli-schema-compatibility.json` tracks CLI ↔ schema version pairs back to v0.14.0. Earlier CLIs are unsupported.
- **No migration tool.** Users upgrade the CLI and re-dump. Dumps are cheap to regenerate; migration logic would be expensive to maintain across many schema-version pairs and would create a second source of truth.

**Versioning rules:**

- New optional field → patch bump.
- New required field, removed field, type change → schema major bump + CLI compatibility matrix entry.
- Internal restructuring without contract change → patch bump.

This is more conservative than typical "add fields freely" patterns because dumps are consumed by downstream tools we don't control.

---

## 8. Testing Strategy

**Three layers:**

1. **Auto-generated unit tests** (`tests/unit/catalog-generated.test.ts`, 47 tests). Generated from `rules/catalog/*.yaml` by `tests/generators/catalog-test-generator.ts`. Every catalog example is a test case. Drift between rules engine and catalog breaks the build.
2. **Hand-written unit tests** (`tests/unit/`, 15+ tests). Cover the rules engine, splitter, completion script generation, and the HTTP header passthrough.
3. **Integration tests** (`tests/integration/`, 11+ tests). End-to-end workflows: dump fixtures → validate → diff → breaking → changelog.

**Plus:**

- `tests/run-manual-tests.sh` — shell-driven smoke tests of the built CLI binary. Exercises completion scripts, output formats, exit codes.
- `tests/check-doc-links.sh` — validates every markdown link in `docs/`. Wired into `npm run prerelease` to prevent broken-link releases.

**Trade-off accepted:** No live-server integration tests (mocking the SDK is fragile, real servers are environment-dependent). Manual tests fill this gap.

---

## 9. Agent Experience

mcpcontract is designed to be operable by AI coding assistants (Copilot, Claude, etc.) as well as humans.

- **`mcpcontract agents`** prints AI-optimized command guides (separate from `--help`, which targets humans). `--command <name>`, `--workflows`, `--all` selectors.
- **AGENTS.md** at the repo root is the canonical onboarding doc for AI agents working on the codebase, complementing `README.md` for humans.
- **Shell completions** (`mcpcontract completion bash|zsh|fish`) cover all subcommands and flag values (e.g., `--transport <TAB>` suggests `streamable-http sse stdio`).
- **`--quiet` and JSON output** on every command for scripting.

The split between `--help` (Commander-generated, terse) and `agents` (curated, workflow-oriented) was an explicit arbitration: cramming agent-style guidance into `--help` made it noisy for human CLI users.

---

## 10. Deferred and Rejected Designs

Captured here so we don't re-litigate them.

- **mcpmock** (mock server tool). Three-command design (`run`/`record`/`build`) for replaying dumps as fake MCP servers. **Deferred** — not blocking core contract toolkit work. Useful as a separate companion tool.
- **Standalone MCP Description spec repository.** An early plan published the `mcpdesc` format as a separate, formally governed spec repo. Rejected as too heavyweight for the current stage: the specification now lives in this repository under [`spec/`](../../../spec/), making `mcptoolkit-contract` the single source of truth for both the format and its reference tooling. Consuming tools vendor one schema version from [`schemas/mcp-description/`](../../../schemas/mcp-description/) and upgrade as the format advances.
- **OAuth Phase 2** (full token-refresh + secure storage for streamable-http auth). Deferred until requirements solidify. Today: pass Bearer tokens via `--headers`.
- **Active feature probing.** Considered for CORS, ping, pagination. Rejected in favor of passive detection — keeps dumps cheap and avoids hammering production servers during routine scans.
- **JSON Patch output for `diff`.** Considered. Rejected because MCP-aware change names are needed for the rules engine and human-readable changelogs.
- **Plugin system for templates and rules.** Considered. Rejected as over-engineering for v1.0 — file-path overrides (`--template ./my.hbs`, `--catalog ./my-catalog`) cover the same use cases.

---

## 11. Status (v1.0.0-rc1)

| Schema | Current Version |
|---|---|
| dump | 0.3.8 |
| mcp-description | 0.7.0 |
| diff | 1.0.0 |
| diff-breaking | 2.0.0 |
| split-config | 1.0.0 |

**Test count:** 73+ tests (47 auto-generated from catalog, 15 unit, 11 integration) plus shell-driven smoke tests and link-checker.

**Public contracts:** CLI subcommands, exit codes, schema JSON files, rules YAML, template names. All require deprecation cycles to change.
