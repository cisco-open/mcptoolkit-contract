---
title: MCP Description Specification
version: 0.7.0
status: Draft
date: 2026-03-23
editors:
  - name: Cisco DevNet
    url: https://developer.cisco.com
---

# MCP Description Specification

**Version**: 0.7.0

**Status**: Draft

**Date**: March 23, 2026

## Abstract

This specification defines the **MCP Description** format — a portable, machine-readable document that describes the capabilities of a [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server.

An MCP Description declares the tools, resources, prompts, transports, security requirements, and metadata of an MCP server in a static JSON document, enabling offline discovery, documentation generation, contract validation, and [interoperable tooling](implementations.md) across the MCP ecosystem.

## Status of This Document

This document is a **Draft** specification. It is intended for review and feedback. The specification may change before reaching a stable release.

## 1. Introduction

### 1.1 Purpose

The MCP Description Specification defines a standard format for describing the capabilities of a Model Context Protocol (MCP) server as a static, curated document.

The MCP ecosystem currently relies on runtime discovery through protocol initialization and capability inspection. While effective for dynamic interactions, this approach limits offline tooling, cross-platform interoperability, and contract-driven development workflows.

This specification addresses these limitations by providing a **portable contract format** for MCP servers — analogous to the role OpenAPI plays for HTTP APIs.

### 1.2 Goals

An MCP Description document enables:

- **Standardized server descriptions** — a consistent structure for declaring server metadata, transports, tools, resources, prompts, and capabilities.
- **Offline discoverability** — platforms can index and display server capabilities without establishing a runtime connection.
- **Tooling interoperability** — documentation generators, testing frameworks, agent discovery tools, IDE integrations, and governance platforms can operate on a common format.
- **Contract-driven development** — teams can define and validate MCP server capabilities before deployment.

### 1.3 Audience

This specification is intended for:

- MCP server developers who publish capability descriptions
- MCP client and agent developers who consume server descriptions
- Platform developers building registries, documentation portals, and governance tools
- Tool authors creating validators, generators, and IDE integrations

### 1.4 Relationship to the MCP Protocol

The MCP Description Specification does **not** replace the MCP protocol. It complements the protocol by providing a static description format for server capabilities.

| MCP Protocol | MCP Description |
|---|---|
| Runtime communication | Static declaration |
| Initialize handshake | Server metadata |
| Tool invocation | Tool definitions |
| Resource fetching | Resource definitions |

The MCP protocol defines **runtime behavior**. An MCP Description defines the **server contract**.

### 1.5 Scope

This specification defines:

- The structure and semantics of an MCP Description document
- JSON Schema validation rules for MCP Description documents
- The specification extension mechanism for vendor-specific metadata

This specification does NOT define:

- The MCP protocol itself
- Runtime behavior of MCP servers or clients
- The content or structure of vendor extensions (these are defined independently by extension authors)

## 2. Terminology

### 2.1 Key Words

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

### 2.2 Definitions

**MCP Description Document**
A JSON document conforming to this specification that describes the capabilities of an MCP server.

**MCP Server**
A server implementing the Model Context Protocol, exposing tools, resources, and/or prompts to MCP clients.

**MCP Client**
An application that connects to an MCP server using the MCP protocol.

**Tool**
A server-side function that an MCP client can invoke with structured input parameters and receive structured output.

**Resource**
A server-side data source identified by a URI that an MCP client can read.

**Resource Template**
A parameterized resource definition using a URI template (RFC 6570) that can produce resource URIs when template variables are provided.

**Prompt**
A server-side prompt template that an MCP client can invoke with arguments to generate messages.

**Transport**
The communication mechanism used to connect to an MCP server (e.g., stdio, streamable-http, SSE).

**Specification Extension**
A property in an MCP Description document whose name begins with `x-` that provides vendor-specific metadata outside the core specification.

**Capability**
A feature or behavior supported by an MCP server, declared in the `capabilities` object.

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

## 4. Versioning

### 4.1 The `mcpdesc` Field

Every MCP Description document MUST include a `mcpdesc` property at the root level. This property declares which version of this specification the document conforms to.

```json
{
  "mcpdesc": "0.7.0"
}
```

### 4.2 Version Format

The `mcpdesc` value MUST be a string matching a published version of this specification. The current version is `"0.7.0"`.

The specification uses [Semantic Versioning](https://semver.org/) for its own version numbers:

- **Major** version changes indicate breaking changes to the document structure
- **Minor** version changes add new optional features in a backward-compatible manner
- **Patch** version changes address errata or clarifications without structural changes

### 4.3 Version Compatibility

Implementations SHOULD support the latest specification version. Implementations MAY support multiple versions.

When processing a document, implementations MUST check the `mcpdesc` value and:

- Accept documents with a recognized `mcpdesc` version
- Reject documents with an unrecognized `mcpdesc` version or provide a clear warning

### 4.4 Forward Compatibility

Implementations SHOULD ignore unknown properties within known objects. This allows documents authored against a newer minor version to be partially processed by implementations supporting an older minor version of the same major version.

### 4.5 Relationship to MCP Protocol Versions

The `mcpdesc` version is independent of the MCP protocol version. The MCP protocol version implemented by a server is declared in `info.protocolVersion`.

A single MCP Description specification version MAY support documents describing servers implementing different MCP protocol versions.

## 5. Info Object

The `info` object provides metadata about the MCP server. It is REQUIRED.

The `info` object combines OpenAPI-style metadata (`contact`, `license`) with fields from the MCP `Implementation` type returned in the `initialize` response (`serverInfo`). The MCP-sourced fields — `name`, `title`, `description`, `version`, `icons`, and `websiteUrl` — allow an MCP Description document to faithfully represent the same information a server would advertise at runtime.

### 5.1 Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | **Yes** | Programmatic server name (identifier). MUST be non-empty. Maps to `Implementation.name` (MCP `BaseMetadata`). |
| `version` | string | **Yes** | Server version. Semver RECOMMENDED. MUST be non-empty. Maps to `Implementation.version`. |
| `title` | string | No | Human-readable display name for UI contexts. Falls back to `name` if not provided. Maps to `Implementation.title` (MCP `BaseMetadata`, since 2025-06-18). |
| `description` | string | No | Brief description of what the server does. Maps to `Implementation.description` (MCP, since 2025-06-18). |
| `protocolVersion` | string | No | MCP protocol version implemented by this server. |
| `id` | string | No | Unique server identifier (URI, DID, or URN). |
| `icons` | array\<[Icon](#icon-object)\> | No | Icons for UI display. Maps to `Implementation.icons` (MCP, since 2025-11-25). |
| `websiteUrl` | string (URI) | No | URL of the server's website. Maps to `Implementation.websiteUrl` (MCP, since 2025-11-25). |
| `contact` | [Contact Object](#53-contact-object) | No | Contact information (OpenAPI-style, not part of MCP `Implementation`). |
| `license` | [License Object](#54-license-object) | No | License information (OpenAPI-style, not part of MCP `Implementation`). |

### 5.2 Protocol Version

The `protocolVersion` property, when present, MUST be one of the following recognized MCP protocol versions:

- `"2024-11-05"`
- `"2025-03-26"`
- `"2025-06-18"`
- `"2025-11-25"`

This value indicates which version of the MCP protocol the server implements. It is independent of the MCP Description specification version (`mcpdesc`).

### 5.3 Contact Object

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | Organization or maintainer name |
| `url` | string (URI) | Contact URL |
| `email` | string (email) | Contact email address |

### 5.4 License Object

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | **Yes** | License name (e.g., `"Apache-2.0"`, `"MIT"`) |
| `url` | string (URI) | No | URL to the license text |

### 5.5 Example

```json
{
  "info": {
    "name": "chess-coach",
    "title": "Chess Coach MCP Server",
    "version": "2.1.0",
    "description": "Analyze chess games, track player ratings, and review game history",
    "protocolVersion": "2025-06-18",
    "id": "urn:mcp:chess-coach",
    "icons": [
      {
        "src": "https://chess-coach.example.com/icons/icon-48.png",
        "mimeType": "image/png",
        "sizes": ["48x48"]
      },
      {
        "src": "https://chess-coach.example.com/icons/icon.svg",
        "mimeType": "image/svg+xml",
        "sizes": ["any"],
        "theme": "light"
      }
    ],
    "websiteUrl": "https://chess-coach.example.com",
    "contact": {
      "name": "Chess Coach Team",
      "url": "https://example.com/chess-coach",
      "email": "chess@example.com"
    },
    "license": {
      "name": "MIT",
      "url": "https://opensource.org/licenses/MIT"
    }
  }
}
```

## 6. Transports

The `transports` property declares one or more communication mechanisms supported by the MCP server. It is REQUIRED and MUST contain at least one transport object.

### 6.1 Overview

MCP servers can be accessed through different transport mechanisms. The `transports` array allows a single MCP Description document to declare all supported transports, enabling clients to select the most appropriate one.

### 6.2 Transport Types

Each transport object MUST include a `type` property. The following transport types are defined:

#### 6.2.1 Streamable HTTP Transport

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `"streamable-http"` | **Yes** | Transport type identifier |
| `url` | string (URI) | **Yes** | MCP endpoint URL |

The streamable HTTP transport connects to an MCP server over HTTP with streaming response support. This is the RECOMMENDED transport for remote MCP servers.

```json
{
  "type": "streamable-http",
  "url": "https://chess-coach.example.com/mcp"
}
```

#### 6.2.2 stdio Transport

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `"stdio"` | **Yes** | Transport type identifier |
| `command` | string | **Yes** | Command to launch the server |
| `args` | array\<string\> | No | Command arguments |
| `env` | object | No | Environment variables (string values) |

The stdio transport launches the MCP server as a subprocess and communicates over standard input/output.

```json
{
  "type": "stdio",
  "command": "chess-coach",
  "args": ["mcp", "--level", "advanced"],
  "env": {
    "CHESS_DB_PATH": "/data/games.db"
  }
}
```

#### 6.2.3 SSE Transport (Legacy)

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `"sse"` | **Yes** | Transport type identifier |
| `url` | string (URI) | **Yes** | SSE endpoint URL |

The Server-Sent Events transport is a legacy transport type retained for backward compatibility. New implementations SHOULD use `streamable-http` instead.

```json
{
  "type": "sse",
  "url": "https://chess-coach.example.com/sse"
}
```

### 6.3 Multiple Transports

A server MAY support multiple transports. Clients SHOULD select the most appropriate transport based on their environment and capabilities.

```json
{
  "transports": [
    { "type": "streamable-http", "url": "https://chess-coach.example.com/mcp" },
    { "type": "stdio", "command": "chess-coach", "args": ["mcp"] }
  ]
}
```

### 6.4 Transport-Scoped Security

Each transport object MAY include a `security` property containing an array of security scheme objects (see Section 7). When present, this transport-level security overrides the root-level `security` for that transport.

| Scenario | Effective security |
|----------|-------------------|
| Root `security` defined, transport `security` omitted | Inherits root security |
| Root `security` defined, transport `security` is `[]` (empty) | Explicitly no authentication |
| Root `security` defined, transport `security` defined | Transport's own security |
| Root `security` omitted, transport `security` omitted | No authentication |

This mechanism allows a single MCP Description document to declare different security requirements for different transports. For example, an HTTP transport typically requires bearer authentication while a stdio transport relies on OS-level process isolation:

```json
{
  "transports": [
    {
      "type": "streamable-http",
      "url": "https://chess-coach.example.com/mcp",
      "security": [
        { "type": "http", "scheme": "bearer", "bearerFormat": "JWT" }
      ]
    },
    {
      "type": "stdio",
      "command": "chess-coach",
      "args": ["mcp"],
      "security": []
    }
  ]
}
```

### 6.5 Extensibility

Transport objects MUST NOT contain additional properties beyond those defined for their type (plus the optional `security` property). Vendor-specific transport metadata SHOULD be placed in specification extensions at the root level.

## 7. Security

The `security` property declares the authentication and authorization schemes supported by the server. It is OPTIONAL.

### 7.1 Overview

The security array describes how clients authenticate with the MCP server. The structure is aligned with [OpenAPI 3.1 Security Scheme Objects](https://spec.openapis.org/oas/v3.1.0#security-scheme-object), enabling reuse of existing security tooling and patterns.

When `security` is omitted or an empty array, the server does not require authentication.

Root-level `security` acts as the default for all transports. Individual transports MAY override this default by including their own `security` property (see Section 6.4).

### 7.2 Security Scheme Object

Each security scheme object MUST include a `type` property.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | string | **Yes** | Scheme type: `"http"`, `"apiKey"`, `"oauth2"`, or `"openIdConnect"` |
| `scheme` | string | Conditional | HTTP auth scheme (e.g., `"bearer"`, `"basic"`). REQUIRED when `type` is `"http"`. |
| `bearerFormat` | string | No | Bearer token format hint (e.g., `"JWT"`). |
| `name` | string | Conditional | API key name. REQUIRED when `type` is `"apiKey"`. |
| `in` | string | Conditional | API key location: `"header"`, `"query"`, or `"cookie"`. REQUIRED when `type` is `"apiKey"`. |
| `flows` | [OAuth Flows Object](#73-oauth-flows-object) | Conditional | OAuth2 flows. REQUIRED when `type` is `"oauth2"`. |
| `openIdConnectUrl` | string (URI) | Conditional | OpenID Connect discovery URL. REQUIRED when `type` is `"openIdConnect"`. |
| `description` | string | No | Human-readable description of the security scheme. |

### 7.3 OAuth Flows Object

| Property | Type | Description |
|----------|------|-------------|
| `implicit` | [OAuth Flow Object](#74-oauth-flow-object) | Configuration for the OAuth2 implicit flow |
| `password` | [OAuth Flow Object](#74-oauth-flow-object) | Configuration for the resource owner password flow |
| `clientCredentials` | [OAuth Flow Object](#74-oauth-flow-object) | Configuration for the client credentials flow |
| `authorizationCode` | [OAuth Flow Object](#74-oauth-flow-object) | Configuration for the authorization code flow |

### 7.4 OAuth Flow Object

| Property | Type | Description |
|----------|------|-------------|
| `authorizationUrl` | string (URI) | Authorization endpoint URL |
| `tokenUrl` | string (URI) | Token endpoint URL |
| `refreshUrl` | string (URI) | Refresh token endpoint URL |
| `scopes` | object | Available scopes (key: scope name, value: description) |

### 7.5 Examples

**Bearer token authentication:**

```json
{
  "security": [
    {
      "type": "http",
      "scheme": "bearer",
      "bearerFormat": "JWT",
      "description": "JWT token issued by the chess platform"
    }
  ]
}
```

**API key authentication:**

```json
{
  "security": [
    {
      "type": "apiKey",
      "name": "X-Chess-API-Key",
      "in": "header",
      "description": "API key for accessing the chess rating service"
    }
  ]
}
```

**OAuth2 with authorization code flow:**

```json
{
  "security": [
    {
      "type": "oauth2",
      "flows": {
        "authorizationCode": {
          "authorizationUrl": "https://auth.example.com/authorize",
          "tokenUrl": "https://auth.example.com/token",
          "scopes": {
            "games:read": "Read game history",
            "games:write": "Submit new games",
            "ratings:read": "View player ratings"
          }
        }
      }
    }
  ]
}
```

## 8. Capabilities

The `capabilities` object declares the server's supported features as reported during MCP initialization. It is OPTIONAL.

### 8.1 Overview

Capabilities provide hints about the server's feature set beyond the tools, resources, and prompts it exposes. These correspond to the capabilities returned in the MCP `InitializeResult`.

### 8.2 Properties

| Property | Type | Description |
|----------|------|-------------|
| `tools` | object | Tool-related capabilities |
| `tools.listChanged` | boolean | Whether the server sends `notifications/tools/list_changed` |
| `resources` | object | Resource-related capabilities |
| `resources.subscribe` | boolean | Whether the server supports resource subscriptions |
| `resources.listChanged` | boolean | Whether the server sends `notifications/resources/list_changed` |
| `prompts` | object | Prompt-related capabilities |
| `prompts.listChanged` | boolean | Whether the server sends `notifications/prompts/list_changed` |
| `completions` | object | Present if the server supports argument autocompletion (MCP 2025-03-26+) |
| `logging` | object | Present if the server supports sending log messages to the client |
| `tasks` | object | Present if the server supports task-augmented requests (MCP 2025-11-25+) |
| `experimental` | object | Experimental, non-standard capabilities |

### 8.3 Tasks Capability

The `tasks` object, when present, indicates the server supports long-running task management:

| Property | Type | Description |
|----------|------|-------------|
| `tasks.list` | object | Server supports listing active tasks |
| `tasks.cancel` | object | Server supports cancelling tasks |
| `tasks.requests.tools.call` | object | Tool calls can be task-augmented |

### 8.4 Extensibility

The `capabilities` object allows additional properties beyond those defined here. Implementations SHOULD preserve unknown capability properties when processing documents.

### 8.5 Example

```json
{
  "capabilities": {
    "tools": { "listChanged": true },
    "resources": { "subscribe": true, "listChanged": true },
    "prompts": { "listChanged": false },
    "completions": {},
    "logging": {}
  }
}
```

## 9. Tools

The `tools` array declares the tools exposed by the MCP server. Each tool represents a server-side function that clients can invoke.

### 9.1 Tool Object

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | **Yes** | Programmatic tool name (identifier). |
| `title` | string | No | Human-readable display name for UI contexts. Since MCP 2025-06-18. |
| `description` | string | No | Human-readable tool description. |
| `inputSchema` | object | No | JSON Schema for tool input parameters. |
| `outputSchema` | object | No | JSON Schema for structured tool output. Since MCP 2025-06-18. |
| `annotations` | [Tool Annotations Object](#93-tool-annotations) | No | Behavioral hints. Since MCP 2025-03-26. |
| `execution` | [Execution Object](#94-execution-object) | No | Execution properties. Since MCP 2025-11-25. |
| `icons` | array\<Icon\> | No | Icons for UI display. Since MCP 2025-11-25. |
| `tags` | array\<string\> | No | Categorization tags. When a root-level `tags` array is present, values MUST reference declared tag names (see [Section 12.3](#123-tag-references)). |
| `deprecated` | boolean | No | Whether the tool is deprecated. |
| `_meta` | object | No | Protocol-reserved metadata. Since MCP 2025-06-18. |

### 9.2 Input and Output Schemas

The `inputSchema` property, when present, MUST be a valid JSON Schema object describing the tool's input parameters. It typically has `"type": "object"` with `properties` and `required` fields.

The `outputSchema` property, when present, MUST be a valid JSON Schema object describing the tool's structured output. It defaults to JSON Schema 2020-12 dialect when no explicit `$schema` is provided.

Both schemas MAY include an explicit `$schema` property to declare the JSON Schema dialect (since MCP 2025-11-25).

### 9.3 Tool Annotations

Tool annotations provide hints about tool behavior. These are advisory — implementations MUST NOT rely on annotations being accurate.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `title` | string | — | Human-readable title for the tool |
| `readOnlyHint` | boolean | `false` | Tool does not modify its environment |
| `destructiveHint` | boolean | `true` | Tool may perform destructive updates |
| `idempotentHint` | boolean | `false` | Repeated calls with same arguments have no additional effect |
| `openWorldHint` | boolean | `true` | Tool may interact with external entities |

The annotations object allows additional properties for forward compatibility.

### 9.4 Execution Object

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `taskSupport` | string | `"forbidden"` | Whether the tool supports task-augmented execution: `"forbidden"`, `"optional"`, or `"required"` |

### 9.5 Example

```json
{
  "tools": [
    {
      "name": "analyze_game",
      "title": "Analyze Chess Game",
      "description": "Analyze a chess game from PGN notation and return evaluation scores",
      "inputSchema": {
        "type": "object",
        "properties": {
          "pgn": {
            "type": "string",
            "description": "Game in Portable Game Notation (PGN) format"
          },
          "depth": {
            "type": "integer",
            "description": "Analysis depth in half-moves",
            "minimum": 1,
            "maximum": 40
          }
        },
        "required": ["pgn"]
      },
      "outputSchema": {
        "type": "object",
        "properties": {
          "evaluation": { "type": "number", "description": "Centipawn evaluation" },
          "best_move": { "type": "string", "description": "Best move in algebraic notation" },
          "blunders": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "move_number": { "type": "integer" },
                "move": { "type": "string" },
                "evaluation_loss": { "type": "number" }
              }
            }
          }
        }
      },
      "annotations": {
        "readOnlyHint": true,
        "destructiveHint": false,
        "idempotentHint": true
      },
      "tags": ["analysis", "chess"]
    },
    {
      "name": "get_player_rating",
      "title": "Get Player Rating",
      "description": "Get the current Elo rating and rating history for a chess player",
      "inputSchema": {
        "type": "object",
        "properties": {
          "player_id": {
            "type": "string",
            "description": "Unique player identifier"
          },
          "rating_type": {
            "type": "string",
            "enum": ["classical", "rapid", "blitz", "bullet"],
            "description": "Type of rating to retrieve"
          }
        },
        "required": ["player_id"]
      },
      "annotations": {
        "readOnlyHint": true,
        "destructiveHint": false
      },
      "tags": ["rating", "player"]
    },
    {
      "name": "record_game_result",
      "title": "Record Game Result",
      "description": "Record the result of a chess game and update player ratings",
      "inputSchema": {
        "type": "object",
        "properties": {
          "white_player_id": { "type": "string", "description": "White player identifier" },
          "black_player_id": { "type": "string", "description": "Black player identifier" },
          "result": {
            "type": "string",
            "enum": ["1-0", "0-1", "1/2-1/2"],
            "description": "Game result in standard notation"
          },
          "pgn": { "type": "string", "description": "Full game PGN (optional)" },
          "time_control": { "type": "string", "description": "Time control (e.g., '10+0', '3+2')" }
        },
        "required": ["white_player_id", "black_player_id", "result"]
      },
      "annotations": {
        "readOnlyHint": false,
        "destructiveHint": false,
        "idempotentHint": false
      },
      "tags": ["rating", "game"]
    }
  ]
}
```

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

## 14. Serialization

### 14.1 JSON Format

An MCP Description document MUST be serialized as a JSON document conforming to [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259).

### 14.2 Character Encoding

MCP Description documents MUST be encoded in UTF-8.

### 14.3 Numeric Values

JSON numbers SHOULD be used for numeric values. Implementations MUST support IEEE 754 double-precision floating-point numbers.

### 14.4 Null Values

Properties with `null` values SHOULD be omitted from the document rather than included with a `null` value, unless the property explicitly permits `null`.

### 14.5 Empty Arrays and Objects

Properties whose values are empty arrays or empty objects MAY be omitted. Implementations MUST treat an omitted array property as equivalent to an empty array, and an omitted object property as equivalent to an empty object, unless the property is required.

### 14.6 String Values

String values MUST be valid JSON strings. URI values MUST conform to [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986). Email values SHOULD conform to [RFC 5322](https://www.rfc-editor.org/rfc/rfc5322). Date values MUST conform to ISO 8601.

### 14.7 Schema Reference

MCP Description documents SHOULD include a `$schema` property referencing the appropriate JSON Schema for IDE validation and tooling support:

```json
{
  "$schema": "https://developer.cisco.com/mcp-description/schema/0.7.0",
  "mcpdesc": "0.7.0"
}
```

## 15. Conformance

### 15.1 Document Conformance

A conforming MCP Description document MUST:

1. Be a valid JSON document (Section 14).
2. Include the `mcpdesc` property with a recognized specification version (Section 4).
3. Include the `info` object with at least `name` and `version` (Section 5).
4. Include the `transports` array with at least one transport object (Section 6).
5. Include at least one of: `tools`, `resources`, `resourceTemplates`, or `prompts` (Section 3.3).
6. Validate against the JSON Schema for the declared `mcpdesc` version.
7. Not contain unknown properties at the root level except specification extensions matching `^x-`.

### 15.2 Implementation Conformance

A conforming implementation (tool, validator, or platform) MUST:

1. Accept and correctly parse documents conforming to this specification.
2. Reject documents that fail the requirements in Section 15.1.
3. Ignore unrecognized specification extensions without error (Section 13.4).
4. Preserve specification extensions when processing and re-serializing documents (Section 13.4).

A conforming implementation SHOULD:

1. Support at least the current specification version.
2. Provide clear error messages when rejecting non-conforming documents.
3. Support JSON Schema validation against the published schema.

### 15.3 Partial Conformance

Implementations that support only a subset of the specification (e.g., only tools, or only a specific transport type) SHOULD document their limitations clearly.

### 15.4 Versioned Conformance

Conformance is assessed against a specific specification version. An implementation claiming conformance MUST state which `mcpdesc` version(s) it supports.

---

## Appendix A: Icon Object

The Icon object is used throughout the specification for UI display.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `src` | string (URI) | **Yes** | URI pointing to an icon resource (HTTP/HTTPS URL or `data:` URI). |
| `mimeType` | string | No | MIME type override (e.g., `"image/png"`, `"image/svg+xml"`). |
| `sizes` | array\<string\> | No | Sizes at which the icon can be used (e.g., `"48x48"`, `"96x96"`, `"any"`). |
| `theme` | string | No | Theme this icon is designed for: `"light"` or `"dark"`. |

Clients MUST support `image/png` and `image/jpeg`. Clients SHOULD also support `image/svg+xml` and `image/webp`.

---

## Appendix B: Complete Example

See [examples/full-featured.yaml](examples/full-featured.yaml) for a complete MCP Description document demonstrating all features of this specification.

---

## Appendix C: JSON Schema

The normative JSON Schema for this specification version is available at:

- [../schemas/mcp-description/0.7.0.json](../schemas/mcp-description/0.7.0.json)
- `https://developer.cisco.com/mcp-description/schema/0.7.0`

---

## Appendix D: References

### Normative References

- **[RFC 2119]** Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", RFC 2119, March 1997.
- **[RFC 3986]** Berners-Lee, T., Fielding, R., and L. Masinter, "Uniform Resource Identifier (URI): Generic Syntax", RFC 3986, January 2005.
- **[RFC 6570]** Gregorio, J., Fielding, R., Hadley, M., Nottingham, M., and D. Orchard, "URI Template", RFC 6570, March 2012.
- **[RFC 8259]** Bray, T., "The JavaScript Object Notation (JSON) Data Interchange Format", RFC 8259, December 2017.
- **[JSON Schema]** Wright, A., Andrews, H., Hutton, B., "JSON Schema: A Media Type for Describing JSON Documents", draft-bhutton-json-schema-01, June 2022.

### Informative References

- **[MCP Protocol]** Anthropic, "Model Context Protocol Specification", https://modelcontextprotocol.io
- **[OpenAPI 3.1]** OpenAPI Initiative, "OpenAPI Specification v3.1.0", https://spec.openapis.org/oas/v3.1.0
- **[Semantic Versioning]** Preston-Werner, T., "Semantic Versioning 2.0.0", https://semver.org

