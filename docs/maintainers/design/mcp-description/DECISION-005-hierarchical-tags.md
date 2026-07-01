# Decision 005: Hierarchical Tags with Global Uniqueness

**Date**: 2026-03-20  
**Status**: Accepted  
**Spec version**: 0.6.0

## Context

After removing `metadata` (Decision 003), tags needed a new home. The flat `string[]` format inside `metadata.tags` was too limited — real-world MCP servers benefit from categorized, hierarchical tag taxonomies with descriptions and validation.

Three design dimensions were evaluated:
1. **Tag structure** — how tags are defined at the root level
2. **Hierarchy** — whether and how tags can be nested
3. **Referencing** — how per-entity tags reference root-level declarations

## Options Considered: Tag Structure

### Option A: OpenAPI-style flat ordered tags

Tags as an ordered array of Tag Objects (name + description), no nesting. Matches OpenAPI's root-level `tags` array.

```json
{
  "tags": [
    { "name": "analysis", "description": "Game analysis tools" },
    { "name": "rating", "description": "Player rating tools" }
  ]
}
```

### Option B: Slash-delimiter hierarchy

Flat tag names with slash-separated paths implying hierarchy:

```json
{
  "tags": [
    { "name": "games/analysis" },
    { "name": "games/history" },
    { "name": "players/rating" }
  ]
}
```

### Option C: Explicit nesting (selected)

Tag Objects with an optional nested `tags` array for hierarchical categorization:

```json
{
  "tags": [
    {
      "name": "games",
      "description": "Game-related capabilities",
      "tags": [
        { "name": "analysis", "description": "Game analysis" },
        { "name": "history", "description": "Game records" }
      ]
    }
  ]
}
```

## Decision: Tag Structure

Adopt **Option C** — explicit nesting via recursive Tag Objects.

### Rationale

1. **Natural hierarchy**: Nested objects directly express parent-child relationships without parsing conventions.
2. **Flat-compatible**: Option C with zero nesting is identical to Option A — servers that don't need hierarchy use flat tags naturally.
3. **Schema-friendly**: Recursive `$ref` in JSON Schema cleanly validates any depth.
4. **No parsing ambiguity**: Unlike slash-delimiters (Option B), there's no question about what `/` means or how to handle edge cases.

## Options Considered: Tag Referencing

Given hierarchical tags, how do per-entity `tags` arrays reference them?

### Option C1: Leaf-only, globally unique names

Entities can only reference leaf (childless) tags. Names must be globally unique.

### Option C2: Qualified path references

Entities reference tags using slash-qualified paths matching the hierarchy: `"games/analysis"`.

### Option C3: Any-level, globally unique names (selected)

Entities can reference tags at **any level** (parent or leaf). Names must be globally unique across the entire tree.

```json
{
  "tags": [
    {
      "name": "games",
      "tags": [
        { "name": "analysis" }
      ]
    }
  ],
  "tools": [
    {
      "name": "analyze_game",
      "tags": ["games", "analysis"]
    }
  ]
}
```

## Decision: Tag Referencing

Adopt **Option C3** — any-level references with globally unique names.

### Rationale

1. **Maximum flexibility**: A tool can be tagged with a broad category (`"games"`) and/or a specific sub-category (`"analysis"`).
2. **Simple references**: Per-entity tags are plain strings — no path syntax to learn or parse.
3. **Global uniqueness is enforceable**: The schema and spec require unique names across the entire tree, preventing ambiguity.
4. **Backward compatible**: When the root `tags` array is absent, per-entity tags remain unconstrained strings.

## Decision: Undeclared Tag Handling

When a root-level `tags` array is present, any per-entity tag that does not match a declared tag name is a **validation error**.

### Rationale

1. **Catch typos**: Strict validation prevents silent tag misspellings.
2. **Intentional taxonomy**: The root `tags` array represents a curated taxonomy. Allowing undeclared references undermines that purpose.
3. **Opt-in strictness**: Servers that don't need validation simply omit the root `tags` array.

## Tag Object Definition

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | **Yes** | Tag identifier. MUST be unique across the entire tag tree. |
| `description` | string | No | Human-readable description of the tag's purpose. |
| `tags` | array\<Tag Object\> | No | Nested child tags for hierarchical categorization. |

## Implementation

- Root-level `tags` is an optional `array<Tag Object>` with recursive nesting.
- Tag `name` values MUST be globally unique across all nesting levels.
- Per-entity `tags` are `array<string>` referencing any declared tag name.
- When root `tags` is present, undeclared references are validation errors.
- When root `tags` is absent, per-entity tags are unconstrained (backward-compatible).
- Array order determines display priority — earlier tags SHOULD be shown first.
