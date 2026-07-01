# Decision 001: Multi-Transport Array vs One-Document-Per-Transport

**Date**: 2026-03-17  
**Status**: Accepted   

## Context

When an MCP server supports multiple transport mechanisms (e.g., both `streamable-http` and `stdio`), the specification needs to define how to represent this. Two approaches were evaluated.

## Options Considered

### Option A: Multi-transport array (single document)

One MCP Description document contains a `transports` array listing all supported transport mechanisms. Capabilities (`tools`, `resources`, `prompts`) are declared once.

```json
{
  "mcpdesc": "0.5.0",
  "info": { "name": "chess-coach", "version": "1.0.0" },
  "transports": [
    {
      "type": "streamable-http",
      "url": "https://example.com/mcp",
      "security": [{ "type": "http", "scheme": "bearer" }]
    },
    {
      "type": "stdio",
      "command": "chess-coach",
      "args": ["mcp"],
      "security": []
    }
  ],
  "tools": [...]
}
```

### Option B: One document per transport

Each transport gets its own MCP Description file. An optional registry/index document lists all variants.

```json
// chess-coach-http.mcpdesc.json
{
  "mcpdesc": "0.5.0",
  "info": { "name": "chess-coach", "version": "1.0.0" },
  "transport": { "type": "streamable-http", "url": "https://example.com/mcp" },
  "security": [{ "type": "http", "scheme": "bearer" }],
  "tools": [...]
}

// chess-coach-stdio.mcpdesc.json  (duplicate of tools/resources/prompts)
{
  "mcpdesc": "0.5.0",
  "info": { "name": "chess-coach", "version": "1.0.0" },
  "transport": { "type": "stdio", "command": "chess-coach" },
  "tools": [...]
}
```

## Evaluation

| Dimension | Option A (array) | Option B (one-per-transport) |
|---|---|---|
| **Single source of truth** | One file per server — no drift risk | N files can diverge when tools/resources change |
| **Duplication** | None — capabilities declared once | Full duplication of tools, resources, prompts across N files |
| **Discovery** | One file to find | Must find all variants, or need a registry index (new concept) |
| **Security scoping** | Solved via transport-level `security` override | Clean by default — each file has its own security |
| **Client simplicity** | Client picks a transport from the array | Client picks a file; no transport selection logic |
| **Validation** | One schema, one validation pass | Same schema per file, N validation passes |
| **OpenAPI precedent** | `servers` is an array (same pattern) | No direct precedent |
| **CI/governance** | One file to lint, approve, gate | N files to keep in sync |
| **Tooling generation** | `mcpcontract dump` → one file | Generator must produce N files or split as post-processing |
| **File management** | 1 file per server | N files per server + optional registry |

## The Security Problem

The strongest argument for Option B was **security scoping**: `stdio` and `streamable-http` transports have fundamentally different authentication models. With a single `security` array at root level, there was no way to express "bearer auth for HTTP, no auth for stdio."

**Resolution**: Transport-scoped security within Option A. Each transport object MAY include a `security` property that overrides the root-level default:

| Root `security` | Transport `security` | Effective security |
|---|---|---|
| Defined | Omitted | Inherits root |
| Defined | `[]` (empty array) | Explicitly none |
| Defined | Defined | Transport's own |
| Omitted | Omitted | None |

This follows the same pattern as OpenAPI, where `security` can appear at the operation level to override the global default.

## Multi-Transport Use Cases

Real-world scenarios where a server supports multiple transports:

1. **Local dev + cloud deployment** — `stdio` for local development, `streamable-http` for production. Same server binary.
2. **SSE → streamable-http migration** — During transition, both legacy and modern transports are advertised for backward compatibility.
3. **Sidecar + remote** — `stdio` for local sidecar in Kubernetes, `streamable-http` through an ingress.
4. **Air-gapped vs connected** — Government/enterprise environments where some clients reach HTTP and others must use stdio.
5. **Docker + native** — `stdio` via `docker run ...` for containerized use, plus `streamable-http` for when the container is running as a service.

## Decision

**Option A: Multi-transport array with transport-scoped security.**

### Rationale

1. **No drift** — A single document is the source of truth for one server's capabilities. When you add a tool, you update one file.
2. **No duplication** — Tools, resources, and prompts are declared exactly once.
3. **The security concern is solved** — Transport-level `security` provides clean scoping without separate files.
4. **Consistent with OpenAPI** — `servers` is an array; `security` can be overridden at operation level. Our pattern mirrors this.
5. **Simpler tooling** — One `mcpcontract dump` → one file. No registry index spec needed.
6. **One file for governance** — CI pipelines, approval workflows, and API governance tools operate on a single artifact.

### Trade-offs accepted

- Clients must implement transport selection logic (minor — they already need it for MCP protocol negotiation).
- The schema is slightly more complex with `security` allowed on transport objects.
- The one-per-transport model's "simplicity per document" is sacrificed in favor of system-level simplicity.

## Implementation

- Field renamed from `transport` to `transports` (plural, consistent with `tools`, `resources`, `prompts`).
- Each transport type in the schema gains an optional `security` property.
- Root-level `security` becomes the default; transport-level `security` overrides it.
- A shared `securitySchemes` definition in the JSON Schema avoids duplication between root and transport security.
- Section 6.4 in the spec documents the inheritance model.
- Section 7.1 references the transport override mechanism.
