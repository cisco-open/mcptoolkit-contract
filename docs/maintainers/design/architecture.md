# mcpcontract Tool Architecture

> **See also:** [design-decisions.md](design-decisions.md) — consolidated rationale for architectural choices (pagination, CORS, rules engine, schema versioning, deferred designs). This file is the diagrammatic overview; that file is the *why*.

## Command Overview

`mcpcontract` is a modular CLI. Commands are thin argument-parsing layers in `src/commands/`; all real logic lives in `src/lib/`.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          mcpcontract CLI Tool                            │
└─────────────────────────────────────────────────────────────────────────┘

  Capability extraction & documentation        Change tracking
  ──────────────────────────────────────       ──────────────────────────
   dump      Extract live server → mcpdesc       diff       Structural diff
   convert   Legacy dump ⇄ mcpdesc               breaking   Apply compat rules
   split     Partition a federation dump         changelog  Human-readable notes
   validate  Schema-check an mcpdesc
   document  Render human-readable docs          rules      Browse rules catalog
                                                 agents     AI command reference
```

## Data Flow

```
    ┌─────────────┐
    │  Live MCP   │
    │   Server    │
    └──────┬──────┘
           │ Connect & Query
           ▼
    ┌──────────────────┐
    │  dump command    │
    └──────┬───────────┘
           │ Produces
           ▼
    ┌─────────────────────────┐
    │  capabilities.mcpdesc    │  ◄── Conforms to mcp-description schema
    │                         │
    │ • info (name, version)  │
    │ • tools                 │
    │ • resources             │
    │ • prompts               │
    │ • resourceTemplates     │
    │ • dumpDetails           │
    └──────┬──────────────────┘
           │
           ├──────────────┬──────────────┬──────────────┐
           ▼              ▼              ▼              ▼
    ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
    │  validate  │ │  document  │ │   split    │ │    diff    │
    │            │ │            │ │            │ │ (v1 vs v2) │
    │ Ajv schema │ │ Handlebars │ │ pattern-   │ │ structural │
    │  checking  │ │ templates  │ │ based      │ │  delta     │
    └────────────┘ └────────────┘ └────────────┘ └─────┬──────┘
                                                       │
                                                       ▼
                                                 ┌────────────┐
                                                 │  breaking  │
                                                 │ apply rules│
                                                 └─────┬──────┘
                                                       ▼
                                                 ┌────────────┐
                                                 │ changelog  │
                                                 │ release /  │
                                                 │ compact    │
                                                 └────────────┘
```

## Module Dependencies

```
    src/index.ts  (CLI Entry Point with Commander)
         │
         ├─── commands/dump.ts ──────────┐
         ├─── commands/convert.ts        │
         ├─── commands/split.ts          │
         ├─── commands/validate.ts       │
         ├─── commands/document.ts       │
         ├─── commands/diff.ts           │
         ├─── commands/breaking.ts       │
         ├─── commands/changelog.ts      │
         ├─── commands/rules.ts          │
         └─── commands/agents.ts         │
                                         │
         ┌───────────────────────────────┘
         │            lib/ (Shared Logic)
         │
         ├─── client.ts            MCP client wrapper
         ├─── dumper.ts            Capability extraction
         ├─── config.ts            Config parsing
         ├─── formatters.ts        JSON/YAML/Markdown output
         ├─── mcpdesc-converter.ts dump ⇄ mcpdesc
         ├─── splitter.ts          Dump splitting logic
         ├─── validator.ts         Ajv schema validation
         ├─── renderer.ts          Handlebars rendering
         ├─── differ.ts            Structural diff engine
         ├─── rules-engine.ts      Breaking-change analysis
         ├─── catalog-validator.ts Catalog validation
         └─── catalog-discovery.ts Catalog directory discovery
                 │
                 └─── schemas/ (JSON Schemas)
                      ├─── mcp-description/  (mcpdesc / dump)
                      ├─── dump-extension/   (x-cisco-metadata)
                      ├─── diff/
                      ├─── diff-breaking/
                      └─── split-config/
```

## Key Design Principles

1. **Separation of concerns** — `dump` is runtime discovery (what a server can do); `diff`/`breaking`/`changelog` track how that changes over time; `document` renders it for humans.
2. **Composability** — Each command outputs data usable by the next, so they chain cleanly in scripts and CI pipelines.
3. **Schema-driven** — All data formats are validated against versioned JSON schemas, giving clear contracts between commands.
4. **Extensibility** — Custom Handlebars templates and custom rule catalogs are supported; multiple output formats (JSON, YAML, Markdown, HTML).
5. **Developer experience** — Clear errors, helpful warnings, good defaults, and embedded `--help` (including an `agents` command for AI assistants).
