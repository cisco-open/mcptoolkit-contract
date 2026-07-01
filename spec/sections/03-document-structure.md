## 3. Document Structure

### 3.1 Format

An MCP Description document MUST be a JSON document encoded in UTF-8.

The RECOMMENDED file extension is `.mcpdesc.json`. Implementations MAY also accept `.mcp-description.json`.

The RECOMMENDED media type is `application/mcp-description+json`.

### 3.2 Root Object

The root of an MCP Description document is a JSON object with the following structure:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `$schema` | string | No | JSON Schema reference for IDE validation |
| `mcpdesc` | string | **Yes** | Specification version (e.g., `"0.7.0"`) |
| `info` | [Info Object](#5-info-object) | **Yes** | Server metadata |
| `transports` | array\<[Transport Object](#6-transports)\> | **Yes** | Supported transports (at least one) |
| `security` | array\<[Security Object](#7-security)\> | No | Security schemes |
| `capabilities` | [Capabilities Object](#8-capabilities) | No | Server capability flags |
| `tools` | array\<[Tool Object](#9-tools)\> | Conditional | Tools exposed by the server |
| `resources` | array\<[Resource Object](#10-resources)\> | Conditional | Resources exposed by the server |
| `resourceTemplates` | array\<[Resource Template Object](#10-resources)\> | Conditional | Resource templates |
| `prompts` | array\<[Prompt Object](#11-prompts)\> | Conditional | Prompts exposed by the server |
| `tags` | array\<[Tag Object](#12-tags)\> | No | Flat tag list for categorization |

### 3.3 Required Capabilities Constraint

An MCP Description document MUST include at least one of:

- `tools`
- `resources`
- `resourceTemplates`
- `prompts`

A document with none of these properties is invalid, as it describes a server with no discoverable capabilities.

### 3.4 Property Ordering

Property ordering within JSON objects is not significant. Implementations MUST NOT depend on property order.

### 3.5 Specification Extensions

Any property at the root level whose name matches the pattern `^x-` is a specification extension. See [Section 13: Specification Extensions](#13-specification-extensions) for details.

### 3.6 Additional Properties

Properties not defined in this specification and not matching the `x-` extension pattern MUST NOT appear at the root level. Implementations SHOULD reject documents containing unknown root-level properties.

### 3.7 Example

A minimal valid MCP Description document:

```json
{
  "mcpdesc": "0.7.0",
  "info": {
    "name": "chess-rating-server",
    "version": "1.0.0"
  },
  "transports": [
    { "type": "stdio", "command": "chess-rating", "args": ["serve"] }
  ],
  "tools": [
    {
      "name": "get_player_rating",
      "description": "Get the current Elo rating for a chess player",
      "inputSchema": {
        "type": "object",
        "properties": {
          "player_id": { "type": "string", "description": "Player identifier" }
        },
        "required": ["player_id"]
      }
    }
  ]
}
```

