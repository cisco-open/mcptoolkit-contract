# Decision 004: Remove the `lifecycle` Object

**Date**: 2026-03-20  
**Status**: Accepted  
**Spec version**: 0.6.0

## Context

The root-level `lifecycle` object in MCP Description v0.5.x declared the server's operational status:

```json
{
  "lifecycle": {
    "status": "active",
    "effectiveDate": "2026-01-15"
  }
}
```

The `status` field accepted one of four values: `"draft"`, `"active"`, `"deprecated"`, `"retired"`.

During a design review, the question was raised: does lifecycle state belong in a static capability description document?

## Analysis

### Not in OpenAPI

OpenAPI does not include lifecycle status. API lifecycle management is handled by API management platforms, registries, and governance tools — not by the API specification document itself.

### Not in MCP protocol

The MCP protocol's `Implementation` type has no lifecycle concept. There is no `status` field in `initialize` responses.

### Operational vs. structural

MCP Description is a **capability description format** — it describes *what* a server offers (tools, resources, prompts, transports). Lifecycle status describes *where* a server is in its operational journey, which is:

- **Dynamic**: Status changes over time (draft → active → deprecated → retired) while the capability description may remain unchanged.
- **Environment-specific**: A server may be "active" in production and "draft" in staging — the same description document serves both.
- **Registry concern**: Platforms and registries that track many servers are the natural home for lifecycle metadata, not individual description documents.

### Server manifest

A server manifest (deployment descriptor) is a better home for lifecycle state, alongside other operational metadata like deployment region, environment, health endpoints, and SLAs.

## Decision

**Remove the `lifecycle` object entirely** from the root document structure.

## Rationale

1. **Separation of concerns**: A capability description should describe capabilities, not operational state. Lifecycle is an operational concern.
2. **No precedent**: Neither OpenAPI nor the MCP protocol include lifecycle status in their description/specification formats.
3. **Better homes exist**: Server manifests, API registries, and governance platforms are purpose-built for tracking lifecycle state across environments.
4. **Avoids staleness**: A lifecycle status baked into a static document risks becoming stale. Registries can update status independently of the description document.

## Alternatives Considered

1. **Keep as-is**: Rejected — mixes operational state with capability description.
2. **Move to vendor extension**: Possible, but lifecycle is generic enough that if it were needed, it should be in the core. Since it's not needed in the core, it shouldn't be anywhere in the document.
3. **Move to server manifest**: Recommended path for implementations that need lifecycle tracking.

## Migration

Implementations that relied on `lifecycle` should:
- Track lifecycle status in their registry or governance platform
- Use a server manifest format for operational metadata
- Optionally use a vendor extension if lifecycle must travel with the document
