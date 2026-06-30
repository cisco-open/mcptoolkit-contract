# Maintainer Documentation

This folder contains documentation for **mcpcontract** maintainers and contributors. Most users do not need to read these.

If you are looking for usage docs, see [../users/](../users/).

## Contents

### `design/`

- [`architecture.md`](design/architecture.md) — high-level architecture and module overview
- [`design-decisions.md`](design/design-decisions.md) — consolidated design rationale and arbitrations (pagination, CORS, rules engine, schema versioning, deferred designs)
- [`workflow-examples.md`](design/workflow-examples.md) — end-to-end workflow examples (CI/CD, scripts)

### `implementation/`

- [`mcp-auth-explained.md`](implementation/mcp-auth-explained.md) — MCP authorization primer (OAuth 2.1 flows)
- [`33-oauth-best-practices.md`](implementation/33-oauth-best-practices.md) — OAuth implementation guidance for the CLI
- [`34-wsl-oauth-browser.md`](implementation/34-wsl-oauth-browser.md) — OAuth browser handshake from WSL2

See [AGENTS.md](../../AGENTS.md) for the developer guide (build, test, release procedures, conventions).
