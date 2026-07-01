# Design Principles

The MCP Description Specification follows several core design principles that guide its structure and evolution.

## 1. Alignment with Existing API Ecosystem Standards

The specification adopts structures familiar to API developers, drawing from [OpenAPI](https://www.openapis.org/):

- **`info` object** with `name`, `version`, `contact`, and `license` — directly modeled after OpenAPI's Info Object
- **`security` schemes** using OpenAPI 3.1 Security Scheme Object structure
- **Declarative capability descriptions** — the document describes *what* the server offers, not *how* it works internally

This reduces the learning curve for developers already familiar with the API ecosystem.

## 2. MCP-Native Structures

While borrowing patterns from OpenAPI, the specification uses **MCP protocol structures directly** for capabilities:

- Tools use MCP's `inputSchema` / `outputSchema` format (not OpenAPI's Operation Object)
- Resources use MCP's `uri` / `mimeType` pattern
- Prompts use MCP's `arguments` array format
- Capabilities map directly to MCP's `InitializeResult.capabilities`

This means an MCP Description document can be generated from a live MCP server's responses without translation.

## 3. Explicit Capability Declarations

The document explicitly describes server capabilities:

| Capability | What's Declared |
|-----------|----------------|
| Tools | Names, input/output schemas, behavioral annotations |
| Resources | URIs, content types, descriptions |
| Resource Templates | URI templates, parameters |
| Prompts | Names, arguments, descriptions |
| Capabilities | Feature flags (subscriptions, notifications) |
| Transports | Connection methods and endpoints |

Clients can understand server functionality without executing protocol calls.

## 4. Vendor Extensions

The specification allows vendor-specific metadata using the `x-` prefix convention (borrowed from OpenAPI and HTTP headers). This enables:

- Runtime observation metadata
- Platform-specific annotations
- Governance and compliance attributes
- Generation provenance

The core specification remains vendor-neutral while extensions evolve independently.

## 5. Strict Core, Flexible Extensions

The core specification defines a strict schema ensuring:

- Predictable document structure
- Strong validation
- Consistent tooling behavior

Extensions remain unrestricted in their value structure — they can be objects, arrays, strings, or any JSON value.

## 6. Separation of Contract and Observation

The specification distinguishes between:

| Layer | Purpose | Example |
|-------|---------|---------|
| **Contract** | What the server offers | Tools, resources, prompts |
| **Metadata** | Who built it and how | Authors, generation provenance |
| **Observation** | What was discovered at runtime | Latency, CORS support, session behavior |

Contract declarations live in the core spec. Observations belong in vendor extensions (like `x-cisco-metadata`). This ensures MCP Description documents remain stable and portable.

## 7. Offline-First

An MCP Description document is a **static artifact** that can be:

- Stored in a git repository
- Published to a registry
- Indexed by a search engine
- Validated in a CI pipeline
- Displayed in a documentation portal

No running server is needed to read, validate, or process the document.

## 8. Minimal Required Fields

The specification minimizes required fields:

- `mcpdesc` — which specification version
- `info.name` + `info.version` — identity
- `transports` — how to connect (at least one)
- At least one of: `tools`, `resources`, `resourceTemplates`, `prompts`

Everything else is optional. A valid MCP Description can be as short as 15 lines of JSON.
