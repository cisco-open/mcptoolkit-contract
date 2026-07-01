## 12. Tags

The root-level `tags` array defines a flat list of tags for the MCP server. It is OPTIONAL.

When present, `tags` declares all valid tags that MAY be referenced by tools, resources, resource templates, and prompts. The array order determines display priority — tags appearing earlier in the array SHOULD be presented first in UIs and documentation.

### 12.1 Tag Object

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | **Yes** | Tag identifier. MUST be unique across all tags. |
| `description` | string | No | Human-readable description of the tag's purpose. |

### 12.2 Tag Uniqueness

Tag names MUST be unique across all tags in the array. Implementations MUST reject documents containing duplicate tag names.

### 12.3 Tag References

Per-entity `tags` arrays (on tools, resources, resource templates, and prompts) contain plain strings referencing tag names. When a root-level `tags` array is present:

- Every tag referenced by an entity MUST be declared in the root `tags` array.
- Implementations MUST treat a reference to an undeclared tag as a validation error.
- Per-entity tag arrays MUST NOT contain duplicate values.

When the root-level `tags` array is absent, per-entity tags are unconstrained strings (backward-compatible behavior).

### 12.4 Example

Flat tag list with entity references:

```json
{
  "tags": [
    { "name": "analysis", "description": "Game analysis tools" },
    { "name": "rating", "description": "Player and game rating tools" },
    { "name": "history", "description": "Game history and records" },
    { "name": "leaderboard", "description": "Ranking leaderboards" },
    { "name": "player", "description": "Player-specific data" }
  ],
  "tools": [
    {
      "name": "analyze_game",
      "tags": ["analysis"]
    },
    {
      "name": "get_player_rating",
      "tags": ["rating", "player"]
    }
  ],
  "resources": [
    {
      "uri": "chess://leaderboards/classical",
      "name": "classical_leaderboard",
      "tags": ["leaderboard", "rating"]
    }
  ]
}
```

