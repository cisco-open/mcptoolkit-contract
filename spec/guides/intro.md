# MCP Description Specification — Overview

> **Current version**: 0.7.0 (Draft) — March 2026

## Introduction

The **MCP Description Specification** defines a standard, machine-readable document that describes the capabilities of a **Model Context Protocol (MCP) server**.

An MCP Description provides a **structured declaration of the tools, resources, prompts, transports, and capabilities offered by an MCP server**, enabling clients, agents, developer tools, and platforms to discover and interact with MCP services in a consistent and interoperable way.

The specification borrows design principles from **OpenAPI** — the successful standard for describing HTTP APIs — while using **MCP-native structures** directly for tools, resources, and prompts.

This means an MCP Description document can be generated from a live MCP server's responses without translation, and developers familiar with the API ecosystem can adopt the format quickly.

---

# Problem Statement

The MCP ecosystem currently relies on **runtime discovery** through protocol initialization and capability inspection.

While this mechanism works for dynamic interactions, it presents several limitations:

### 1. Lack of a portable server description

Today, MCP servers typically expose their capabilities only at runtime. This means:

* tools cannot inspect capabilities without connecting to the server
* offline tooling is difficult
* documentation must be generated dynamically

### 2. Limited interoperability between platforms

Different MCP tools and platforms often implement their own ways of representing MCP server capabilities, leading to:

* inconsistent documentation formats
* limited compatibility between MCP tooling ecosystems
* difficulty sharing MCP server metadata

### 3. No standard contract for MCP servers

Unlike REST APIs (OpenAPI) or event systems (AsyncAPI), the MCP ecosystem lacks a standard **contract document** that can represent an MCP server independently of a running instance.

This makes it difficult to support:

* governance
* automated validation
* contract-based development
* static documentation
* offline discovery

---

# Goals of the MCP Description Specification

The MCP Description specification addresses these limitations by defining a **portable contract format for MCP servers**.

The specification enables:

### Standardized server descriptions

An MCP Description document provides a consistent structure for declaring:

* server metadata
* transport configuration
* available tools
* resources and resource templates
* prompts
* server capabilities
* hierarchical tag taxonomy

### Offline discoverability

MCP servers can publish a description document without requiring a client to connect to the server.

This enables:

* documentation portals
* agent registries
* package repositories
* static validation

### Tooling interoperability

A standard description format enables consistent tooling across the MCP ecosystem, including:

* documentation generators
* testing frameworks
* agent discovery tools
* IDE integrations
* governance platforms

### Contract-driven development

Teams can define and validate MCP server capabilities before deployment, enabling workflows similar to **API-first development** used in modern API platforms.

---

# Relationship to the MCP Protocol

The MCP Description specification does **not replace the MCP protocol**.

Instead, it complements the protocol by providing a **static description format** for server capabilities.

| MCP Protocol          | MCP Description      |
| --------------------- | -------------------- |
| runtime communication | static declaration   |
| initialize handshake  | server metadata      |
| tool invocation       | tool definitions     |
| resource fetching     | resource definitions |

In other words:

```
MCP Protocol = runtime behavior
MCP Description = server contract
```

---

# Design Principles

The MCP Description specification follows several core design principles.

### 1. Alignment with existing API ecosystem standards

The specification adopts structures familiar to API developers, including concepts inspired by OpenAPI:

* `info` object for server metadata
* `security` definitions
* reusable schema structures
* declarative capability descriptions

This reduces the learning curve and enables reuse of existing tooling patterns.

---

### 2. MCP-native structures

While borrowing patterns from OpenAPI, the specification uses **MCP protocol structures directly** for capability declarations:

* Tools use MCP's `inputSchema` / `outputSchema` format (not OpenAPI's Operation Object)
* Resources use MCP's `uri` / `mimeType` pattern
* Prompts use MCP's `arguments` array format
* Capabilities map directly to MCP's `InitializeResult.capabilities`

This means an MCP Description document can be generated from a live MCP server's responses without translation.

---

### 3. Explicit capability declarations

The document explicitly describes server capabilities such as:

* tools
* resources
* prompts
* transports

This ensures clients can understand server functionality without executing protocol calls.

---

### 4. Support for vendor extensions

The specification allows **vendor-specific extensions** using the `x-` prefix convention.

This allows vendors and platforms to attach additional metadata without modifying the core specification.

---

### 5. Strict core schema

The core specification defines a strict schema to ensure:

* predictable structure
* strong validation
* consistent tooling behavior

At the same time, vendor extensions remain flexible.

---

### 6. Separation of contract and observation

The specification distinguishes between:

| Concept             | Example                                |
| ------------------- | -------------------------------------- |
| contract            | tools, resources, prompts, tags        |
| runtime observation | latency, CORS support                  |
| vendor metadata     | platform-specific extensions (`x-...`) |

This separation ensures that MCP Description documents remain stable and portable. Runtime observation data and platform-specific metadata belong in vendor extensions, not the core specification.

---

# Typical Use Cases

The MCP Description specification enables several common scenarios in the MCP ecosystem.

### MCP server documentation

Platforms can generate human-readable documentation describing MCP servers.

### Agent discovery

AI agents can use MCP Description documents to identify available tools and resources before connecting to servers.

### MCP registries

Organizations can maintain registries of MCP servers similar to API catalogs.

### Contract validation

CI pipelines can validate MCP server capabilities against a schema.

### Governance

Organizations can enforce standards for MCP server design.

---

# Vendor Extensions

The specification allows vendors to attach additional metadata through specification extensions.

Extensions follow the naming convention:

```
x-{organization}-{feature}
```

Example:

```
x-cisco-metadata
```

These extensions may include:

* runtime observations
* generation metadata
* platform-specific annotations
* governance attributes

The core specification does not define the structure of these extensions, allowing vendors to evolve them independently.

---

# Benefits for the MCP Ecosystem

Adopting a standardized MCP Description format provides several ecosystem-wide benefits.

### Improved interoperability

Tools and platforms can exchange MCP server descriptions using a common format.

### Better developer experience

Developers can understand server capabilities without connecting to the server.

### Stronger tooling ecosystem

Standardized descriptions enable richer tooling, including:

* MCP documentation generators
* agent discovery platforms
* IDE integrations

### Governance and compliance

Organizations can define validation rules for MCP servers using a standard schema.

### Ecosystem growth

A standard contract format makes it easier for new tools and platforms to integrate with MCP servers.

---

# Summary

The MCP Description specification (currently v0.6.0, Draft) provides a **portable, machine-readable contract format for MCP servers**, enabling consistent discovery, documentation, and integration across the MCP ecosystem.

By standardizing how MCP servers declare their capabilities — using MCP-native structures and OpenAPI-inspired design patterns — the specification helps establish a foundation for a **mature and interoperable MCP tooling ecosystem**, similar to the role that OpenAPI plays in the HTTP API ecosystem.
