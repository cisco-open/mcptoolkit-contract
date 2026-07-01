# Decision 002: x-cisco-metadata v0.2.0 Structure and Version Signaling

**Date**: 2026-03-17  
**Status**: Accepted

## Context

The Cisco extension `x-cisco-metadata` currently includes dump provenance fields at the top level (for example `sourceFormat`, `sourceSchemaVersion`, `dumpDetails`).

A design discussion considered whether to:

1. keep source-dump schema provenance (`sourceSchemaVersion`),
2. add a nested `dumpSchema` URI for future modularity, or
3. simplify to a single extension version with a modular object structure.

Current direction is to stop relying on the historical dump-schema URI as the primary provenance mechanism for this extension.

## Options Considered

### Option A: Keep dump schema provenance as primary

Continue to use dump-oriented fields such as:

```yaml
x-cisco-metadata:
  sourceFormat: mcpcontract-dump
  sourceSchemaVersion: https://developer.cisco.com/mcp_contract_dump/schema/0.3.6
  dumpDetails: ...
```

### Option B: Introduce `dumpSchema` now

Use a nested object and require a module-specific schema URI:

```yaml
x-cisco-metadata:
  dump:
    dumpSchema: https://developer.cisco.com/mcp/extensions/x-cisco-metadata/dump/0.1.0
    dumpDetails: ...
```

### Option C: Single extension version + modular payload (selected)

Use one authoritative extension version and a modular structure without module schema URIs for now:

```yaml
x-cisco-metadata:
  version: "0.2.0"
  dump:
    toolName: ...
    toolVersion: ...
    createdAt: ...
    runtimeObservations: ...
    cors: ...
```

## Decision

Adopt **Option C** for `x-cisco-metadata` **v0.2.0**.

### Accepted rules

1. `x-cisco-metadata.version` is the authoritative version signal for the extension payload.
2. Introduce a nested `dump` object for dump-related metadata.
3. Do **not** require `dumpSchema` in v0.2.0.
4. Do **not** rely on legacy `sourceSchemaVersion` as a required or primary field in v0.2.0.
5. `_generated` will be removed from Cisco extension examples; provenance is carried by top-level dump fields (`x-cisco-metadata.dump.toolName`, `toolVersion`, `createdAt`).

## Rationale

1. **Simplicity now**: one version authority avoids dual-version drift (`version` vs `dumpSchema`).
2. **Future-proof shape**: modular nesting (`dump`) keeps room for future module families.
3. **Avoid premature indirection**: module-level schema URIs can be added later when modules actually diverge.
4. **Cleaner migration path**: explicit extension versioning communicates contract changes clearly.

## Trade-offs accepted

1. No independent versioning of `dump` in v0.2.0.
2. If future modules evolve independently, a later version may introduce per-module schema/version fields.

## Implementation Notes

1. Create extension schema `extensions/x-cisco-metadata/schemas/v0.2.0/x-cisco-metadata.schema.json`.
2. Define top-level `version: "0.2.0"` and nested `dump` object.
3. Move/rename legacy dump-related fields into `dump` substructure as part of migration.
4. Update extension README examples to v0.2.0 shape.
5. Remove `_generated` from `with-cisco-extension` examples.
6. Keep v0.1.0 schema available for backward compatibility.

## Follow-up Trigger

Introduce module-level schema references (such as `dumpSchema`) only when there is a concrete case of independent module lifecycle/versioning.
