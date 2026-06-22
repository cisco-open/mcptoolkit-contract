# mcpcontract Tool Architecture

> **See also:** [design-decisions.md](design-decisions.md) — consolidated rationale for architectural choices (pagination, CORS, rules engine, schema versioning, deferred designs). This file is the diagrammatic overview; that file is the *why*.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          mcpcontract CLI Tool                            │
│                      (4 Commands, Modular Design)                        │
└─────────────────────────────────────────────────────────────────────────┘

                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
           ┌────────▼────────┐ ┌───▼────┐ ┌────────▼────────┐
           │  1. DUMP        │ │2.MANIF │ │  3. VALIDATE    │
           │                 │ │ -EST   │ │                 │
           │ Extract runtime │ │        │ │ Schema checking │
           │  capabilities   │ │Generate│ │  (dump or       │
           │  from live MCP  │ │server  │ │   manifest)     │
           │  server         │ │.json   │ │                 │
           └────────┬────────┘ └───┬────┘ └────────┬────────┘
                    │              │               │
                    │              │               │
           ┌────────▼────────┐     │               │
           │  4. DOCUMENT    │     │               │
           │                 │     │               │
           │ Generate human- │     │               │
           │  readable docs  │     │               │
           │  from manifest  │     │               │
           └─────────────────┘     │               │
                                   │               │
                                   │               │

┌──────────────────────────────────────────────────────────────────────────┐
│                           DATA FLOW DIAGRAM                               │
└──────────────────────────────────────────────────────────────────────────┘

    ┌─────────────┐
    │  Live MCP   │
    │   Server    │
    └──────┬──────┘
           │
           │ Connect & Query
           │
    ┌──────▼──────────┐
    │ 1. DUMP COMMAND │
    └──────┬──────────┘
           │
           │ Produces
           │
    ┌──────▼──────────────────┐
    │  capabilities-dump.json │  ◄── Conforms to dump-schema.json
    │                         │
    │ • serverInfo            │
    │ • tools (9)             │
    │ • resources (1)         │
    │ • prompts (1)           │
    │ • resourceTemplates (1) │
    └──────┬──────────────────┘
           │
           │ +
           │
    ┌──────▼──────────────────┐
    │   server-info.json      │  ◄── Conforms to manifest-info-schema.json
    │                         │
    │ • reverseDnsName        │      (NEW schema we created)
    │ • repository            │
    │ • packages[]            │
    │   - npm package info    │
    │   - environment vars    │
    │   - arguments           │
    └──────┬──────────────────┘
           │
           │ Both inputs
           │
    ┌──────▼──────────────┐
    │ 2. MANIFEST COMMAND │
    │                     │
    │ ManifestBuilder     │
    │ • Merge data        │
    │ • Validate versions │
    │ • Transform format  │
    │ • Add metadata      │
    └──────┬──────────────┘
           │
           │ Generates
           │
    ┌──────▼──────────────────┐
    │     server.json         │  ◄── Conforms to server.schema.json
    │                         │      (MCP Registry format)
    │ • name (reverse-DNS)    │
    │ • description           │
    │ • version               │
    │ • repository            │
    │ • packages[]            │
    │ • _meta (optional)      │
    │   - discoveredCapabs    │
    └──────┬──────────────────┘
           │
           │
           ├─────────────────────────────┐
           │                             │
           │                             │
    ┌──────▼──────────────┐   ┌──────────▼────────────┐
    │ 3. VALIDATE COMMAND │   │  4. DOCUMENT COMMAND  │
    │                     │   │                       │
    │ Ajv Schema Check    │   │ Handlebars Template   │
    │ • Required fields   │   │ • default.md.hbs      │
    │ • Type validation   │   │ • registry-ready      │
    │ • Format checks     │   │ • custom templates    │
    └──────┬──────────────┘   └──────────┬────────────┘
           │                             │
           │                             │
    ┌──────▼──────────────┐   ┌──────────▼──────────┐
    │ Validation Report   │   │   MANIFEST.md       │
    │                     │   │                     │
    │ ✓ Valid             │   │ # OpenAPI Analyzer  │
    │                     │   │                     │
    │ OR                  │   │ **Version**: 0.3.0  │
    │                     │   │                     │
    │ ❌ Errors found     │   │ ## Installation     │
    │ - List of issues    │   │ ```bash             │
    └─────────────────────┘   │ npm install -g ...  │
                              │ ```                 │
                              └─────────────────────┘


┌──────────────────────────────────────────────────────────────────────────┐
│                       MODULE DEPENDENCY DIAGRAM                           │
└──────────────────────────────────────────────────────────────────────────┘

    src/index.ts  (CLI Entry Point with Commander)
         │
         ├─── commands/dump.ts ───────────────┐
         │                                    │
         ├─── commands/manifest.ts ───────┐   │
         │                                │   │
         ├─── commands/validate.ts ────┐  │   │
         │                             │  │   │
         └─── commands/render.ts ───┐  │  │   │
                                    │  │  │   │
                                    │  │  │   │
         ┌──────────────────────────┴──┴──┴───┴─────┐
         │                                           │
         │            lib/ (Shared Logic)            │
         │                                           │
         ├─── client.ts (from mcpcontract-dump)    │
         ├─── dumper.ts (from mcpcontract-dump)    │
         ├─── config.ts (from mcpcontract-dump)    │
         ├─── formatters.ts (from mcpcontract-dump)│
         │                                           │
         ├─── manifest-builder.ts (NEW)             │
         ├─── validator.ts (NEW)                    │
         └─── renderer.ts (NEW)                     │
                                                     │
         ┌───────────────────────────────────────────┘
         │
         ├─── types.ts (Type Definitions)
         │
         └─── schemas/ (JSON Schemas)
              ├─── dump-schema.json (existing)
              ├─── server.schema.json (downloaded)
              └─── manifest-info-schema.json (NEW)


┌──────────────────────────────────────────────────────────────────────────┐
│                           WORKFLOW SUMMARY                                │
└──────────────────────────────────────────────────────────────────────────┘

Complete Publishing Workflow:
────────────────────────────────────────────────────────────────────

   Developer's Environment                     MCP Registry
   ──────────────────────                      ────────────

1. Start MCP Server
   node dist/index.js
         │
         ▼
2. mcpcontract dump                    
   --config server-config.json
   --output capabilities-dump.json
         │
         ├─► capabilities-dump.json created
         │
3. Create server-info.json
   (manually or from template)
         │
         ├─► server-info.json ready
         │
4. mcpcontract manifest
   --mcpdesc capabilities-dump.json
   --info server-info.json
   --output server.json
   --validate
         │
         ├─► server.json created
         │
5. mcpcontract validate
   server.json --schema manifest
         │
         ├─► ✓ Valid
         │
6. mcpcontract document
   server.json --output MANIFEST.md
         │
         ├─► MANIFEST.md created
         │
7. Submit to Registry              ───────►  Pull Request
   git add server.json                      to MCP Registry
   git commit                               with server.json
   git push

────────────────────────────────────────────────────────────────────


┌──────────────────────────────────────────────────────────────────────────┐
│                       SCHEMA RELATIONSHIPS                                │
└──────────────────────────────────────────────────────────────────────────┘

                        Input Schemas
                        ─────────────

    dump-schema.json               manifest-info-schema.json
    (EXISTING)                     (NEW - we created this)
         │                                    │
         │                                    │
         │  Validates                         │  Validates
         │                                    │
         ▼                                    ▼
    capabilities-dump.json             server-info.json
    ──────────────────────             ────────────────
    • serverInfo                       • reverseDnsName
      - name: "..."                      - "io.cisco.../..."
      - version: "0.3.0"               • description
      - protocolVersion                • repository
    • tools: [...]                       - url
    • resources: [...]                   - source
    • prompts: [...]                   • packages: [...]
    • dumpDetails                        - registryType
      - mcpServerConfig                  - identifier
      - dumpExecution                    - transport
                                         - environmentVariables
                │                              │
                │                              │
                └──────────┬───────────────────┘
                           │
                           │ Both feed into
                           │
                           ▼
                ┌────────────────────────┐
                │  manifest-builder.ts   │
                │                        │
                │  Merge + Transform     │
                └────────────┬───────────┘
                             │
                             │ Produces
                             ▼

                        Output Schema
                        ─────────────

                   server.schema.json
                   (MCP REGISTRY FORMAT)
                           │
                           │  Validates
                           ▼
                      server.json
                      ───────────
                      • $schema
                      • name (reverse-DNS)
                      • description
                      • version
                      • repository
                      • packages: [...]
                      • remotes: [...]
                      • _meta
                        - publisher-provided
                          - discoveredCapabilities


┌──────────────────────────────────────────────────────────────────────────┐
│                         COMMAND OPTIONS MATRIX                            │
└──────────────────────────────────────────────────────────────────────────┘

Option                 dump  manifest  validate  render
──────────────────────────────────────────────────────────
--config <path>         ✓      -         -         -
--mcp-server-name      ✓      -         -         -
--server-name          ✓      -         -         -
--transport            ✓      -         -         -
--url                  ✓      -         -         -
--command              ✓      -         -         -
--args                 ✓      -         -         -
--env                  ✓      -         -         -
--mcpdesc               -      ✓         -         -
--info                 -      ✓         -         -
--schema               -      -         ✓         -
--template             -      -         -         ✓
--template-name        -      -         -         ✓
--output               ✓      ✓         ✓         ✓
--format               ✓      ✓         ✓         ✓
--pretty               ✓      ✓         -         -
--validate             -      ✓         -         ✓
--strict               -      ✓         ✓         -
--add-capabilities-meta -     ✓         -         -


┌──────────────────────────────────────────────────────────────────────────┐
│                        KEY DESIGN PRINCIPLES                              │
└──────────────────────────────────────────────────────────────────────────┘

1. SEPARATION OF CONCERNS
   • dump = runtime discovery (what server CAN do)
   • manifest = static declaration (how to INSTALL server)
   • validate = schema compliance checking
   • render = human-readable documentation

2. COMPOSABILITY
   • Each command outputs data usable by next command
   • Can be chained in scripts/CI/CD pipelines
   • Each command can work independently

3. SCHEMA-DRIVEN
   • All data formats validated against JSON schemas
   • Clear contracts between commands
   • Type-safe with TypeScript

4. EXTENSIBILITY
   • Custom templates supported
   • Plugin-ready architecture for future
   • Multiple output formats (JSON, YAML, Markdown)

5. DEVELOPER EXPERIENCE
   • Clear error messages
   • Helpful warnings (not just errors)
   • Good defaults (--pretty, built-in templates)
   • Documentation embedded in tool (--help)


═══════════════════════════════════════════════════════════════════════════
End of Architecture Diagram
═══════════════════════════════════════════════════════════════════════════
```
