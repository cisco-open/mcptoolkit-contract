## 10. Resources and Resource Templates

### 10.1 Resources

The `resources` array declares the static resources exposed by the MCP server. Each resource represents a data source identified by a URI.

#### 10.1.1 Resource Object

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `uri` | string | **Yes** | Resource URI. |
| `name` | string | **Yes** | Programmatic resource name (identifier). |
| `title` | string | No | Human-readable display name for UI contexts. Since MCP 2025-06-18. |
| `description` | string | No | Human-readable resource description. |
| `mimeType` | string | No | MIME type of the resource content. |
| `size` | number | No | Size of the raw resource content in bytes. |
| `annotations` | object | No | Resource annotations. |
| `icons` | array\<Icon\> | No | Icons for UI display. Since MCP 2025-11-25. |
| `tags` | array\<string\> | No | Categorization tags. When a root-level `tags` array is present, values MUST reference declared tag names (see [Section 12.3](#123-tag-references)). |
| `deprecated` | boolean | No | Whether the resource is deprecated. |
| `_meta` | object | No | Protocol-reserved metadata. Since MCP 2025-06-18. |

#### 10.1.2 Resource URI

The `uri` property identifies the resource. It SHOULD be a valid URI. The URI scheme is not constrained — servers MAY use custom URI schemes appropriate to their domain.

### 10.2 Resource Templates

The `resourceTemplates` array declares parameterized resource definitions using URI templates ([RFC 6570](https://www.rfc-editor.org/rfc/rfc6570)).

#### 10.2.1 Resource Template Object

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `uriTemplate` | string | **Yes** | URI template (RFC 6570). |
| `name` | string | **Yes** | Programmatic template name (identifier). |
| `title` | string | No | Human-readable display name for UI contexts. Since MCP 2025-06-18. |
| `description` | string | No | Human-readable template description. |
| `mimeType` | string | No | MIME type of the resource content. |
| `annotations` | object | No | Resource template annotations. |
| `icons` | array\<Icon\> | No | Icons for UI display. Since MCP 2025-11-25. |
| `tags` | array\<string\> | No | Categorization tags. When a root-level `tags` array is present, values MUST reference declared tag names (see [Section 12.3](#123-tag-references)). |
| `deprecated` | boolean | No | Whether the template is deprecated. |
| `_meta` | object | No | Protocol-reserved metadata. Since MCP 2025-06-18. |

### 10.3 Examples

**Static resources for chess game history:**

```json
{
  "resources": [
    {
      "uri": "chess://leaderboard/classical",
      "name": "classical_leaderboard",
      "title": "Classical Leaderboard",
      "description": "Current top-100 classical chess ratings leaderboard",
      "mimeType": "application/json",
      "tags": ["leaderboard", "rating"]
    },
    {
      "uri": "chess://leaderboard/rapid",
      "name": "rapid_leaderboard",
      "title": "Rapid Leaderboard",
      "description": "Current top-100 rapid chess ratings leaderboard",
      "mimeType": "application/json",
      "tags": ["leaderboard", "rating"]
    },
    {
      "uri": "chess://rules/fide-2024",
      "name": "fide_rules",
      "title": "FIDE Rules 2024",
      "description": "Official FIDE Laws of Chess (2024 edition)",
      "mimeType": "text/markdown",
      "tags": ["rules", "reference"]
    }
  ]
}
```

**Resource templates for parameterized access:**

```json
{
  "resourceTemplates": [
    {
      "uriTemplate": "chess://games/{game_id}",
      "name": "game_detail",
      "title": "Game Detail",
      "description": "Full details of a specific chess game including PGN, moves, and analysis",
      "mimeType": "application/json",
      "tags": ["game", "history"]
    },
    {
      "uriTemplate": "chess://players/{player_id}/games?from={start_date}&to={end_date}",
      "name": "player_game_history",
      "title": "Player Game History",
      "description": "Game history for a specific player within an optional date range",
      "mimeType": "application/json",
      "tags": ["game", "history", "player"]
    },
    {
      "uriTemplate": "chess://players/{player_id}/rating-history",
      "name": "player_rating_history",
      "title": "Player Rating History",
      "description": "Historical rating progression for a player",
      "mimeType": "application/json",
      "tags": ["rating", "history", "player"]
    }
  ]
}
```

