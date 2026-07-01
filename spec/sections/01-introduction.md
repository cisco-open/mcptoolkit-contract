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

