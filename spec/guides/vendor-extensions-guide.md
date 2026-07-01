# Vendor Extensions Guide

This guide explains how to create and use specification extensions in MCP Description documents.

## What Are Specification Extensions?

Specification extensions allow vendors, platforms, and organizations to attach custom metadata to MCP Description documents without modifying the core specification.

## Naming Convention

Extension properties MUST start with `x-`. The recommended format is:

```
x-{organization}-{feature}
```

Examples:
- `x-cisco-metadata` — Cisco runtime observations
- `x-acme-deployment` — deployment metadata
- `x-myorg-compliance` — governance tags

## Where Extensions Go

Extensions appear at the **root level** of the MCP Description document:

```json
{
  "mcpdesc": "0.6.0",
  "info": { "name": "my-server", "version": "1.0.0" },
  "transports": [{ "type": "stdio", "command": "my-server" }],
  "tools": [{ "name": "my_tool", "description": "A tool" }],

  "x-myorg-compliance": {
    "approved": true,
    "reviewDate": "2026-03-01",
    "owner": "platform-team"
  }
}
```

## Creating Your Own Extension

### Step 1: Define the Schema

Create a JSON Schema for your extension:

```json
{
  "$id": "https://example.com/mcp/extensions/x-myorg-deployment/0.1.0",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "My Org Deployment Extension",
  "type": "object",
  "properties": {
    "environment": {
      "type": "string",
      "enum": ["development", "staging", "production"]
    },
    "region": {
      "type": "string",
      "description": "Deployment region"
    },
    "healthCheckUrl": {
      "type": "string",
      "format": "uri"
    }
  },
  "required": ["environment"]
}
```

### Step 2: Document It

Write clear documentation covering:
- **Purpose** — What problem does this extension solve?
- **Properties** — What fields are available and what do they mean?
- **Examples** — Show realistic usage
- **Versioning** — How the extension evolves

### Step 3: Publish

Make the schema and documentation available at a stable URL. Include the `$id` in the schema so tools can reference it.

## Processing Rules

Implementations that encounter extensions they don't recognize:

- **MUST** ignore unknown extensions (no errors)
- **SHOULD** preserve them when re-serializing
- **MUST NOT** modify extension values they don't understand

## Known Extensions

| Extension | Maintainer | Purpose |
|-----------|-----------|---------|
| `x-cisco-metadata` | Cisco DevNet | Runtime observations, CORS detection, dump provenance |

See [extensions/](../extensions/) for full specifications of registered extensions.

## Best Practices

1. **Version your extension schema** — use `$id` with version in the URL
2. **Keep it focused** — one extension per concern (don't combine deployment + governance)
3. **Document thoroughly** — other implementations may want to support your extension
4. **Use standard formats** — ISO 8601 for dates, URIs for URLs, etc.
5. **Don't duplicate core fields** — if it's in the spec, don't also put it in an extension
