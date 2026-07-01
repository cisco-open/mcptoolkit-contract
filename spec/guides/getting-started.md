# Getting Started with MCP Description

This guide walks you through creating your first MCP Description document.

## What You'll Build

An MCP Description document for a chess server that:
- Analyzes games and tracks player Elo ratings (tools)
- Exposes leaderboards and game history (resources)
- Provides coaching prompts (prompts)

## Step 1: Start with the Minimum

Every MCP Description needs three things: `mcpdesc`, `info`, and `transports`, plus at least one capability (tools, resources, prompts, or resourceTemplates).

Create a file called `chess-coach.mcpdesc.yaml`:

```yaml
mcpdesc: 0.7.0
info:
  name: chess-rating-server
  title: Chess Rating MCP Server
  version: 1.0.0
transports:
- type: stdio
  command: chess-rating
  args:
  - serve
tools:
- name: get_player_rating
  description: Get the current Elo rating for a chess player
  inputSchema:
    type: object
    properties:
      player_id:
        type: string
        description: Player identifier
    required:
    - player_id
```

That's a valid MCP Description. It declares a server with one tool accessible via stdio.

## Step 2: Add Richer Info

Expand the `info` object with a human-readable title, description, and protocol version:

```yaml
info:
  name: chess-coach
  title: Chess Coach MCP Server
  version: 1.0.0
  description: Analyze chess games, track ratings, and review game history
  protocolVersion: "2025-06-18"
  contact:
    name: Your Team
    email: team@example.com
  license:
    name: MIT
```

## Step 3: Add More Tools

Add tools with input schemas, output schemas, and behavioral annotations:

```yaml
tools:
- name: analyze_game
  title: Analyze Chess Game
  description: Analyze a chess game from PGN notation
  inputSchema:
    type: object
    properties:
      pgn:
        type: string
        description: Game in PGN format
      depth:
        type: integer
        minimum: 1
        maximum: 40
    required:
    - pgn
  annotations:
    readOnlyHint: true
    destructiveHint: false
    idempotentHint: true
  tags:
  - analysis
- name: record_game_result
  title: Record Game Result
  description: Record a game result and update Elo ratings
  inputSchema:
    type: object
    properties:
      white_player_id:
        type: string
      black_player_id:
        type: string
      result:
        type: string
        enum:
        - "1-0"
        - "0-1"
        - "1/2-1/2"
    required:
    - white_player_id
    - black_player_id
    - result
  annotations:
    readOnlyHint: false
    destructiveHint: false
  tags:
  - rating
  - game
```

**Annotation tips:**
- `readOnlyHint: true` — the tool only reads data
- `destructiveHint: false` — the tool doesn't delete anything
- `idempotentHint: true` — same input always gives same result

## Step 4: Add Resources

Resources are data the server exposes. Static resources have fixed URIs; templates have parameters:

```yaml
resources:
- uri: chess://leaderboard/classical
  name: classical_leaderboard
  title: Classical Leaderboard
  description: Top-100 classical chess ratings
  mimeType: application/json
resourceTemplates:
- uriTemplate: "chess://games/{game_id}"
  name: game_detail
  title: Game Detail
  description: Full details of a specific chess game
  mimeType: application/json
- uriTemplate: "chess://players/{player_id}/rating-history"
  name: player_rating_history
  title: Player Rating History
  description: Historical Elo rating progression
  mimeType: application/json
```

## Step 5: Add Prompts

Prompts are server-side templates that generate messages:

```yaml
prompts:
- name: game_summary
  title: Game Summary
  description: Generate a narrative summary of a chess game
  arguments:
  - name: game_id
    description: Game to summarize
    required: true
  - name: detail_level
    description: "'brief', 'standard', or 'comprehensive'"
    required: false
```

## Step 6: Validate

To validate your document, use any JSON Schema validator against the [schema file](../../schemas/mcp-description/0.7.0.json) or the mcpcontract CLI. 

```bash
# Using the mcpcontract CLI
mcpcontract validate --schema mcpdesc chess-coach.mcpdesc.yaml
```



## Next Steps

- See [examples/](../examples/) for complete working examples at different complexity levels
- Read the [full specification](../mcp-description.md)
- Learn about [vendor extensions](vendor-extensions-guide.md) for adding custom metadata
- Compare with [OpenAPI concepts](comparison-with-openapi.md) if you have API background
