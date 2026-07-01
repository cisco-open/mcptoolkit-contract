# MCP Description Specification — Project Plan

## Executive Summary

This plan proposes a project structure and authoring roadmap for the **MCP Description Specification** — a portable, machine-readable contract format for MCP servers. The specification is designed to be **vendor-neutral at its core** while supporting Cisco-specific extensions, making it suitable for both internal use and industry sharing.

---

## Proposed Folder Structure

```
mcp-description/
│
├── README.md                              # Project landing page
├── LICENSE                                # Open-source license (Apache-2.0 recommended)
├── CONTRIBUTING.md                        # Contribution guidelines
├── GOVERNANCE.md                          # Decision-making and versioning process
├── CHANGELOG.md                           # Specification version history
├── CODE_OF_CONDUCT.md                     # Community standards
├── SPECIFICATION_PLAN.md                  # This file
│
├── spec/                                  # ── THE SPECIFICATION (normative) ──
│   │
│   ├── mcp-description.md                 # Full assembled specification document
│   │
│   └── sections/                          # Modular authoring (assembled into above)
│       ├── 00-front-matter.md             #   Title, abstract, status, editors
│       ├── 01-introduction.md             #   Scope, goals, audience
│       ├── 02-terminology.md              #   Key terms & conventions (MUST/SHOULD/MAY)
│       ├── 03-document-structure.md       #   Top-level format, required fields, MIME type
│       ├── 04-versioning.md               #   Spec versioning (mcpdesc field)
│       ├── 05-info-object.md              #   Server metadata (info)
│       ├── 06-transports.md                #   Transport array (streamable-http, stdio, sse)
│       ├── 07-security.md                 #   Security schemes (OpenAPI-aligned)
│       ├── 08-capabilities.md             #   Server capabilities object
│       ├── 09-tools.md                    #   Tool definitions
│       ├── 10-resources.md                #   Resources and resource templates
│       ├── 11-prompts.md                  #   Prompt definitions
│       ├── 12-lifecycle.md                #   Lifecycle status management
│       ├── 13-metadata.md                 #   Additional metadata (authors, tags, etc.)
│       ├── 14-generated.md                #   Provenance (_generated object)
│       ├── 15-specification-extensions.md #   x- extension mechanism
│       ├── 16-serialization.md            #   JSON serialization rules
│       └── 17-conformance.md              #   Conformance requirements
│
├── schemas/                               # ── JSON SCHEMAS (normative) ──
│   │
│   ├── v0.5.0/
│   │   └── mcp-description.schema.json   #   Current schema
│   ├── v0.4.0/
│   │   └── mcp-description.schema.json   #   Historical
│   ├── v0.2.0/
│   │   └── mcp-description.schema.json   #   Historical
│   ├── v0.1.0/
│   │   └── mcp-description.schema.json   #   Historical
│   └── latest.json                        #   Copy or symlink to latest version
│
├── extensions/                            # ── VENDOR EXTENSIONS ──
│   │
│   └── x-cisco-metadata/                  #   Cisco's official extension
│       ├── README.md                      #     Overview, purpose, usage
│       ├── x-cisco-metadata-spec.md       #     Extension specification
│       └── schemas/
│           └── v0.1.0/
│               └── x-cisco-metadata.schema.json
│
├── examples/                              # ── EXAMPLES (informative) ──
│   │
│   ├── minimal.json                       #   Minimum valid document (~20 lines)
│   ├── stdio-server.json                  #   stdio transport, tools only
│   ├── http-server.json                   #   streamable-http with security
│   ├── multi-transport.json               #   Multiple transports, full capabilities
│   ├── full-featured.json                 #   All fields populated
│   └── with-cisco-extension.json          #   Using x-cisco-metadata extension
│
├── docs/                                  # ── GUIDES & REFERENCES (informative) ──
│   │
│   ├── getting-started.md                 #   How to write your first MCP Description
│   ├── design-principles.md              #   Design rationale & philosophy
│   ├── relationship-to-mcp.md             #   How this complements the MCP protocol
│   ├── comparison-with-openapi.md         #   Conceptual mapping for API developers
│   ├── vendor-extensions-guide.md         #   How to create vendor extensions
│   ├── use-cases.md                       #   Discovery, registries, governance, etc.
│   ├── schema-evolution.md                #   How the schema evolved (0.1 → 0.4)
│   └── faq.md                             #   Frequently asked questions
│
├── implementations/                       # ── KNOWN IMPLEMENTATIONS ──
│   │
│   └── README.md                          #   Links to tools, validators, generators
│
├── ref/                                   # ── REFERENCE MATERIALS (internal) ──
│   │
│   └── mcp-contract/                      #   Reference tooling (existing, unchanged)
│
└── .github/                               # ── GITHUB CONFIGURATION ──
    │
    ├── ISSUE_TEMPLATE/
    │   ├── spec-change-proposal.md        #   Template for proposing spec changes
    │   └── bug-report.md                  #   Schema or doc bugs
    └── PULL_REQUEST_TEMPLATE.md           #   PR template for spec contributions
```

---

## What Goes Where — Design Rationale

| Directory | Audience | Purpose | Normative? |
|-----------|----------|---------|------------|
| `spec/` | Implementers, standards bodies | The specification text itself | **Yes** |
| `schemas/` | Tooling, validators, IDEs | Machine-readable JSON Schemas | **Yes** |
| `extensions/` | Vendors, platforms | Vendor-specific extension specs | Per vendor |
| `examples/` | Developers, evaluators | Real-world document samples | No |
| `docs/` | Everyone | Guides, rationale, tutorials | No |
| `implementations/` | Developers | Known tools and libraries | No |
| `ref/` | Internal contributors | Source tooling for reference | No |

---

## Industry-Ready vs Cisco-Internal Separation

The structure cleanly separates **vendor-neutral core** from **Cisco-specific content**:

### Vendor-neutral (shareable as-is)
- `spec/` — The full specification text
- `schemas/` — Core JSON Schemas
- `examples/` (most) — Generic examples
- `docs/` — General guides
- `README.md`, `LICENSE`, `CONTRIBUTING.md`

### Cisco-specific (can be included or excluded)
- `extensions/x-cisco-metadata/` — Cisco's vendor extension
- `examples/with-cisco-extension.json` — Cisco extension example
- `ref/mcp-contract/` — Cisco's reference implementation
- `implementations/` — May reference Cisco tooling

**For industry sharing**: The `extensions/` and `ref/` directories can be excluded or presented as "example extensions" and "reference implementations" respectively. The core specification stands alone.

---

## Authoring Phases

### Phase 1 — Foundation (Project Setup)

**Goal**: Establish the project structure and migrate existing content.

| # | Task | Source | Target |
|---|------|--------|--------|
| 1 | Create project `README.md` | New | `README.md` |
| 2 | Add `LICENSE` (Apache-2.0) | New | `LICENSE` |
| 3 | Move current schema | `mcpdesc-0.4.0.json` | `schemas/v0.4.0/mcp-description.schema.json` |
| 4 | Copy historical schemas from ref | `ref/.../mcp-description/*.json` | `schemas/v{N}/` |
| 5 | Move Cisco extension schema | `dump-0.1.0.json` | `extensions/x-cisco-metadata/schemas/v0.1.0/` |
| 6 | Create `CHANGELOG.md` | Schema diffs | `CHANGELOG.md` |

### Phase 2 — Specification Authoring

**Goal**: Write the normative specification text from `intro.md` and the schema.

| # | Section | Content Source | Notes |
|---|---------|---------------|-------|
| 1 | Front Matter | New | Title, status, editors, abstract |
| 2 | Introduction | `intro.md` (Goals, Problem) | Formalize into RFC-style |
| 3 | Terminology | New | Define key terms, RFC 2119 keywords |
| 4 | Document Structure | Schema `required` + top-level `properties` | Root object layout |
| 5 | Versioning | Schema `mcpdesc` field | How versions work |
| 6 | Info Object | Schema `info` property | Server metadata details |
| 7 | Transport | Schema `transports` property | Each transport type |
| 8 | Security | Schema `security` property | OpenAPI alignment story |
| 9 | Capabilities | Schema `capabilities` property | Feature flags |
| 10 | Tools | Schema `tools` property | Including annotations, outputSchema |
| 11 | Resources | Schema `resources` + `resourceTemplates` | URI templates, content types |
| 12 | Prompts | Schema `prompts` property | Arguments definition |
| 13 | Lifecycle | Schema `lifecycle` property | Status transitions |
| 14 | Metadata | Schema `metadata` property | Authors, tags, docs |
| 15 | Generated | Schema `_generated` property | Provenance tracking |
| 16 | Extensions | Schema `patternProperties` (x-) | Extension rules |
| 17 | Serialization | New | JSON format requirements |
| 18 | Conformance | New | What "compliant" means |

### Phase 3 — Examples & Documentation

**Goal**: Create practical examples and non-normative guides.

| # | Deliverable | Priority |
|---|-------------|----------|
| 1 | Minimal example (smallest valid document) | High |
| 2 | stdio server example | High |
| 3 | HTTP server with security example | High |
| 4 | Full-featured example | Medium |
| 5 | Getting Started guide | High |
| 6 | Design Principles doc (from `intro.md`) | Medium |
| 7 | OpenAPI comparison guide | Medium |
| 8 | Vendor extensions guide | Medium |
| 9 | FAQ | Low |

### Phase 4 — Extension Specifications

**Goal**: Document the Cisco vendor extension properly.

| # | Deliverable | Notes |
|---|-------------|-------|
| 1 | `x-cisco-metadata` README | Purpose, scope |
| 2 | `x-cisco-metadata` specification | Formal description of all fields |
| 3 | Extension example | MCP Description + x-cisco-metadata |

### Phase 5 — Governance & Community

**Goal**: Prepare for industry sharing and collaboration.

| # | Deliverable | Notes |
|---|-------------|-------|
| 1 | `CONTRIBUTING.md` | How to propose changes |
| 2 | `GOVERNANCE.md` | Versioning policy, decision process |
| 3 | `CODE_OF_CONDUCT.md` | Community standards |
| 4 | GitHub issue/PR templates | Structured contribution flow |
| 5 | `implementations/README.md` | Link to mcpcontract + others |

---

## Specification Conventions

The specification text should follow these conventions to be credible for industry consumption:

- **RFC 2119 keywords**: Use MUST, SHOULD, MAY (capitalized) for normative requirements
- **Schema-first**: Every normative requirement must be traceable to the JSON Schema
- **Versioned examples**: All examples must validate against the corresponding schema version
- **Extension-neutral core**: No vendor-specific content in `spec/` or `schemas/`
- **Clear normative vs informative**: Mark sections explicitly

---

## Naming & URLs

| Item | Convention |
|------|------------|
| Schema `$id` | `https://spec.modelcontextprotocol.io/mcp-description/{version}` |
| MIME type (proposed) | `application/mcp-description+json` |
| File extension (proposed) | `.mcpdesc.json` or `.mcp-description.json` |
| Extension `$id` | `https://developer.cisco.com/mcp/extensions/x-cisco-metadata/{version}` |

---

## Relationship to Reference Implementation

The `ref/mcp-contract/` directory contains the **mcpcontract** toolkit that:
- Originated the MCP Description schema
- Provides `dump` → `manifest` → `document` workflow
- Contains historical schema versions (`0.1.0` through `0.5.0`)
- Serves as the reference implementation for schema validation

The specification should be **independent of any implementation**. The reference tooling demonstrates feasibility but does not define the spec.

---

## Priority Order

1. **Project structure** (Phase 1) — Establishes credibility and navigability
2. **Core spec sections** (Phase 2, items 1–12) — The actual specification
3. **Minimal + key examples** (Phase 3, items 1–3) — Proves the spec works
4. **Getting started guide** (Phase 3, item 5) — Enables adoption
5. **Extension mechanism + Cisco extension** (Phase 4) — Demonstrates extensibility
6. **Remaining docs & governance** (Phase 3 remaining + Phase 5) — Community readiness

---

## Open Questions

These should be resolved before or during authoring:

1. **Spec host URL**: Is `spec.modelcontextprotocol.io` the intended canonical URL, or should this use a different domain for the spec (vs schema)?
2. **License choice**: Apache-2.0 is standard for specs (used by OpenAPI). Confirm.
3. **MCP protocol alignment**: Should the spec formally reference specific MCP protocol versions, or remain version-agnostic?
4. **IANA registration**: Should `application/mcp-description+json` be registered?
5. **Governance model**: Single-vendor initially, moving to multi-stakeholder? (Impacts `GOVERNANCE.md`)
6. **Extension registry**: Should there be a registry of known extensions beyond x-cisco-metadata?
7. **Relationship to MCP Server Manifest** (`server.schema.json`): The ref project documents both — should the spec formally define the relationship?
