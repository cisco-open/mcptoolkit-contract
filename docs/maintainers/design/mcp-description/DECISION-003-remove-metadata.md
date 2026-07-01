# Decision 003: Remove the `metadata` Object

**Date**: 2026-03-20  
**Status**: Accepted  
**Spec version**: 0.6.0

## Context

The root-level `metadata` object in MCP Description v0.5.x contained four properties:

```json
{
  "metadata": {
    "authors": ["Alice", "Bob"],
    "documentation": "https://docs.example.com/chess-coach",
    "repository": "https://github.com/example/chess-coach",
    "tags": ["analysis", "rating", "games"]
  }
}
```

During a design review, the value of `metadata` was questioned: most of its fields duplicate information already available elsewhere in the document or in external systems.

## Analysis

| Field | Redundancy |
|-------|-----------|
| `authors` | Covered by `info.contact` (OpenAPI-style contact object with name, url, email) |
| `documentation` | Covered by `info.websiteUrl` (MCP `Implementation` field, since 2025-11-25) |
| `repository` | Not part of MCP protocol or OpenAPI; belongs in vendor extensions or external registries |
| `tags` | Useful for categorization, but the flat `string[]` format was too limited |

### What OpenAPI does

OpenAPI does not have a `metadata` object. Contact info lives in `info.contact`, documentation is the spec document itself, and repository links are not part of the specification. Tags in OpenAPI are a separate root-level concept with their own object structure.

### What MCP protocol provides

The MCP `Implementation` type (returned in `initialize`) provides `name`, `title`, `description`, `version`, `icons`, and `websiteUrl` — already mapped to the `info` object. There is no `metadata` equivalent in the protocol.

## Decision

**Remove the `metadata` object entirely** from the root document structure.

- `authors`, `documentation`, `repository` — redundant with existing fields or out of scope for a capability description format.
- `tags` — promoted to a first-class root-level `tags` array with structured Tag Objects (see Decision 005).

## Rationale

1. **No invented concepts**: The specification should map to MCP protocol structures and established patterns (OpenAPI), not invent new metadata containers.
2. **Single source of truth**: Author and documentation info should not exist in two places (`info.contact` vs `metadata.authors`).
3. **Tags deserve more**: The flat `string[]` tags inside `metadata` were too limited for real-world categorization needs. Promoting tags to their own root-level structure enables hierarchy, descriptions, and validation.
4. **Leaner documents**: Removing redundant fields keeps MCP Description documents focused on their primary purpose — describing server capabilities.

## Migration

- `metadata.authors` → use `info.contact`
- `metadata.documentation` → use `info.websiteUrl`
- `metadata.repository` → use a vendor extension (e.g., `x-cisco-metadata`) or omit
- `metadata.tags` → use root-level `tags` array (see Decision 004)
