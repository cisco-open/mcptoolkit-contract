## 13. Specification Extensions

MCP Description documents support vendor-specific metadata through specification extensions.

### 13.1 Extension Naming

Specification extension properties MUST match the pattern `^x-`. The RECOMMENDED naming convention is:

```
x-{organization}-{feature}
```

Examples:

- `x-cisco-metadata`
- `x-acme-deployment`
- `x-myorg-governance`

### 13.2 Extension Placement

Specification extensions MAY appear at the root level of an MCP Description document. Extensions MUST NOT appear within objects defined by this specification (e.g., within `info`, `transports` items, or tool objects) unless the object explicitly allows additional properties.

### 13.3 Extension Values

Extension values MAY be of any JSON type: object, array, string, number, boolean, or null.

### 13.4 Processing Rules

Implementations that do not recognize a specification extension MUST ignore it and MUST NOT reject the document.

Implementations SHOULD preserve unrecognized extensions when processing and re-serializing MCP Description documents.

### 13.5 Extension Documentation

Extension authors SHOULD publish a specification for their extension, including:

- A JSON Schema defining the extension's structure
- Documentation of the extension's purpose and semantics
- Versioning information

### 13.6 Example

```json
{
  "mcpdesc": "0.7.0",
  "info": {
    "name": "chess-coach",
    "version": "2.1.0"
  },
  "transports": [
    { "type": "stdio", "command": "chess-coach", "args": ["mcp"] }
  ],
  "tools": [
    {
      "name": "analyze_game",
      "description": "Analyze a chess game from PGN notation"
    }
  ],
  "x-cisco-metadata": {
    "version": "0.2.0",
    "dump": {
      "toolName": "mcpcontract",
      "toolVersion": "0.8.0",
      "createdAt": "2026-03-15T14:30:00Z"
    }
  },
  "x-acme-deployment": {
    "region": "us-west-2",
    "tier": "production"
  }
}
```

