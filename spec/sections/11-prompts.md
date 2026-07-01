## 11. Prompts

The `prompts` array declares the prompt templates exposed by the MCP server. Each prompt is a server-side template that clients can invoke with arguments to generate messages.

### 11.1 Prompt Object

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | **Yes** | Programmatic prompt name (identifier). |
| `title` | string | No | Human-readable display name for UI contexts. Since MCP 2025-06-18. |
| `description` | string | No | Human-readable prompt description. |
| `arguments` | array\<[Prompt Argument](#112-prompt-argument-object)\> | No | Prompt arguments. |
| `icons` | array\<Icon\> | No | Icons for UI display. Since MCP 2025-11-25. |
| `tags` | array\<string\> | No | Categorization tags. When a root-level `tags` array is present, values MUST reference declared tag names (see [Section 12.3](#123-tag-references)). |
| `deprecated` | boolean | No | Whether the prompt is deprecated. |
| `_meta` | object | No | Protocol-reserved metadata. Since MCP 2025-06-18. |

### 11.2 Prompt Argument Object

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | **Yes** | Programmatic argument name (identifier). |
| `title` | string | No | Human-readable display name for UI contexts. Since MCP 2025-06-18. |
| `description` | string | No | Argument description. |
| `required` | boolean | No | Whether the argument is required. |

### 11.3 Example

```json
{
  "prompts": [
    {
      "name": "analyze_position",
      "title": "Analyze Position",
      "description": "Generate a detailed positional analysis for a chess position",
      "arguments": [
        {
          "name": "fen",
          "title": "FEN String",
          "description": "Position in Forsyth-Edwards Notation",
          "required": true
        },
        {
          "name": "perspective",
          "title": "Analysis Perspective",
          "description": "Analyze from white or black perspective",
          "required": false
        }
      ],
      "tags": ["analysis", "position"]
    },
    {
      "name": "game_summary",
      "title": "Game Summary",
      "description": "Generate a narrative summary of a completed chess game",
      "arguments": [
        {
          "name": "game_id",
          "title": "Game ID",
          "description": "Identifier of the game to summarize",
          "required": true
        },
        {
          "name": "detail_level",
          "title": "Detail Level",
          "description": "Level of detail: 'brief', 'standard', or 'comprehensive'",
          "required": false
        }
      ],
      "tags": ["game", "summary"]
    },
    {
      "name": "opening_guide",
      "title": "Opening Repertoire Guide",
      "description": "Generate a study guide for a specific chess opening",
      "arguments": [
        {
          "name": "opening_name",
          "title": "Opening Name",
          "description": "Name of the chess opening (e.g., 'Sicilian Defense', 'Queen's Gambit')",
          "required": true
        },
        {
          "name": "player_rating",
          "title": "Player Rating",
          "description": "Player's approximate rating to tailor complexity",
          "required": false
        }
      ],
      "tags": ["opening", "study"]
    }
  ]
}
```

