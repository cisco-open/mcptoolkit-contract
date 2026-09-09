# AGENTS.md - Developer Guide for mcpcontract

Quick reference for AI agents and developers extending this CLI tool.

## Project Overview

**mcpcontract** - CLI toolkit for MCP (Model Context Protocol) server contract management.

**Purpose**: Extract capabilities from live MCP servers, validate against schemas, render documentation, and track changes between versions.

**Tech Stack**: TypeScript, Node.js 20+, Commander.js, Ajv, Handlebars, YAML

**Version Management**: Follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html). All changes must be documented in [CHANGELOG.md](CHANGELOG.md) before release.

**Commands**: 
- `dump` - Extract capabilities from live MCP server
- `split` - Split large dumps into focused subsets by filtering rules
- `convert` - **[DEPRECATED]** Convert between the legacy capability-dump format and mcpdesc YAML (bidirectional); retained only to migrate older dumps
- `validate` - Validate files against MCP schemas
- `document` - Generate human-readable documentation
- `diff` - Compare dumps and generate structural diff
- `breaking` - Analyze diff for breaking changes using rules (with --suggest-version for semantic versioning)
- `changelog` - Generate human-readable changelog from breaking analysis (formats: release, compact)
- `completion` - Generate shell completion scripts
- `rules` - Browse and explore compatibility rules catalog
- `agents` - Print optimized command reference for AI coding assistants

## File Structure

```
mcpcontract/
├── src/
│   ├── index.ts              # CLI entry point (Commander setup)
│   ├── commands/             # Command implementations
│   │   ├── dump.ts          # ✅ Extract server capabilities
│   │   ├── split.ts         # ✅ Split large dumps (Phase 1: tools)
│   │   ├── convert.ts       # ✅ Convert between dump and mcpdesc formats
│   │   ├── validate.ts      # ✅ Validate against schemas
│   │   ├── document.ts      # ✅ Generate documentation
│   │   ├── diff.ts          # ✅ Compare dumps, generate structural diff
│   │   ├── breaking.ts      # ✅ Detect breaking changes using rules
│   │   ├── changelog.ts     # ✅ Generate version changelog
│   │   ├── completion.ts    # ✅ Generate shell completions
│   │   ├── rules.ts         # ✅ Browse rules catalog
│   │   └── agents.ts        # ✅ AI-optimized command reference
│   └── lib/                  # Core libraries
│       ├── client.ts         # MCP client wrapper
│       ├── dumper.ts         # Capability extraction
│       ├── config.ts         # Config parser
│       ├── formatters.ts     # JSON/YAML/Markdown output
│       ├── types.ts          # Type definitions
│       ├── validator.ts      # ✅ Schema validation
│       ├── renderer.ts       # ✅ Template rendering
│       ├── differ.ts         # ✅ Structural diff engine (734 lines)
│       ├── splitter.ts       # ✅ Dump splitting logic (330 lines)
│       ├── rules-engine.ts   # ✅ Breaking change analysis (235 lines)
│       ├── catalog-validator.ts  # ✅ Catalog validation (440 lines)
│       └── catalog-discovery.ts  # ✅ Catalog directory discovery (124 lines)
├── schemas/                  # JSON schemas (see schemas/README.md)
│   ├── latest.json          # Version mapping (which schema versions are current)
│   ├── cli-schema-compatibility.json  # CLI-schema compatibility matrix
│   ├── mcp-description/     # Archived mcpdesc schemas 0.1.0–0.7.0
│   ├── dump-extension/      # x-cisco-metadata extension — latest: 0.2.0
│   ├── diff/                # Structural diff — 1.0.0
│   ├── diff-breaking/       # Breaking-change analysis — 2.0.0
│   ├── split-config/        # Split config — 1.0.0
│   ├── adl-mcp-server-profile/  # ADL profile (reserved, planned)
│   ├── diff-schema.json     # Legacy alias
│   ├── diff-breaking-schema.json  # Legacy alias
│   └── split-config-schema.json   # Legacy alias
├── rules/                    # Compatibility rules (YAML)
│   ├── breaking-changes.yaml      # Default MCP compatibility rules (35 rules)
│   ├── strict-compatibility.yaml  # Example strict rules
│   ├── catalog/                   # ✅ Rules documentation (34 entries)
│   │   ├── catalog-schema.json    # JSON Schema for catalog entries
│   │   ├── tools/                 # 12 tool-related rules
│   │   ├── prompts/               # 8 prompt-related rules
│   │   ├── resources/             # 6 resource-related rules
│   │   ├── resourceTemplates/     # 3 template-related rules
│   │   └── serverInfo/            # 5 server info rules
│   └── strict-compatibility-catalog/  # Example custom catalog
├── templates/                # Handlebars templates (see templates/README.md)
│   ├── card-view.html.hbs          # HTML card-view documentation
│   ├── default-dump.md.hbs         # mcpdesc-documentation format
│   ├── reference-dump.md.hbs       # reference-documentation format
│   ├── changelog-release.md.hbs    # Comprehensive release notes
│   ├── changelog-compact.md.hbs    # Brief changelog format
│   ├── changelog-detailed.md.hbs   # Legacy detailed format
│   ├── changelog-summary.md.hbs    # Legacy summary format
│   └── changelog-stats.md.hbs      # Legacy stats format
├── tests/
│   ├── check-doc-links.sh    # ✅ Documentation link validator
│   ├── run-manual-tests.sh   # Manual CLI test suite
│   ├── fixtures/             # Test data
│   │   ├── configs/          # MCP configs
│   │   ├── dumps/            # Capability dumps
│   │   └── split/            # Split configs and dumps
│   ├── generators/           # ✅ Test generators
│   │   └── catalog-test-generator.ts  # Auto-generate from catalog
│   ├── unit/                 # ✅ Unit tests (Jest)
│   │   ├── catalog-generated.test.ts  # 47 auto-generated tests
│   │   ├── rules-engine.test.ts       # 15 manual tests
│   │   └── splitter.test.ts           # 13 split logic tests
│   └── integration/          # ✅ Integration tests (Jest)
│       └── full-workflow.test.ts      # 10 end-to-end tests
└── docs/
    ├── 101-tutorial.md       # 5-minute getting-started walkthrough (Microsoft Learn server)
    ├── users/                # User-facing guides, tutorials, examples
    │   ├── tutorials/        # Walkthroughs (complete-workflow, rules-catalog, splitting)
    │   ├── reference/        # schemas.md, compatibility.md, convert-legacy.md
    │   ├── examples/         # Example artifacts (microsoft-learn/, split, html/)
    │   └── README.md
    └── maintainers/          # Design notes and developer reference
        └── design/           # architecture.md, design-decisions.md, workflow-examples.md
```

## MCP Description Specification Ownership

The MCP Description (`mcpdesc`) specification is published at
[mcpdesc.org](https://mcpdesc.org/format/) and developed in the canonical
[`mcpdesc/mcpdesc-specification`](https://github.com/mcpdesc/mcpdesc-specification)
repository. Specification text, governance, proposals, and v0.8+ schemas belong
there, not in this CLI repository.

This repository retains the local [`spec/`](spec/) tree and
[`schemas/mcp-description/`](schemas/mcp-description/) versions 0.1.0–0.7.0 as
historical material for legacy validation and migration. Do not extend those
trees with new specification versions.

### Why it matters

The `mcpdesc` format is consumed beyond this repo. Specification changes must be
proposed and released upstream before this CLI adopts them. A CLI fix must not
silently redefine the format or patch a bundled historical schema.

### Keeping mcpcontract in sync with the spec

`mcpcontract` targets a specific `mcpdesc` version through `@mcpdesc/core` and
`@mcpdesc/validator`. When the specification advances:

- **Track upstream spec releases.** Update the `@mcpdesc/*` dependencies and the
  CLI to emit and validate the released version, then refresh tests, templates,
  docs, and `schemas/cli-schema-compatibility.json`.
- **Preserve backward compatibility whenever possible.** Keep older schema
  versions in `schemas/mcp-description/` so `validate` and `diff` still accept
  legacy documents authored against them. Only drop support when continued
  maintenance is genuinely infeasible, and call it out in the CHANGELOG.
- **Do not silently diverge.** Report format defects upstream. Adopt a fixed,
  released schema or validator version rather than editing the format locally.

## Adding a New Command

### 1. Create Command File

```typescript
// src/commands/newcommand.ts
import { Command } from 'commander';

export function newcommandCommand(): Command {
  const cmd = new Command('newcommand');
  
  cmd
    .description('Description of command')
    .option('-o, --option <value>', 'Option description')
    .action(async (options) => {
      try {
        // Implementation
      } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });
  
  return cmd;
}
```

### 2. Register in CLI Entry Point

```typescript
// src/index.ts
import { newcommandCommand } from './commands/newcommand.js';

program.addCommand(newcommandCommand());
```

### 3. Create Supporting Library (if needed)

```typescript
// src/lib/newfeature.ts
export class NewFeature {
  // Implementation
}
```

### 4. Add Test Fixtures

```bash
# Create test data
tests/fixtures/newcommand/
  ├── input-example.json
  └── expected-output.json
```

### 5. Update Agent Help

Add command-specific guide to `src/commands/agents.ts`:

```typescript
const NEWCOMM_GUIDE = `# newcomm - Brief Description

## Purpose
Detailed explanation of what this command does.

## When to Use
- Scenario 1
- Scenario 2

## Basic Usage
\\\`\\\`\\\`bash
mcpcontract newcomm --option value
\\\`\\\`\\\`

## Common Patterns

### Pattern 1
\\\`\\\`\\\`bash
mcpcontract newcomm --example
\\\`\\\`\\\`

## Key Parameters
- \\\`--option <value>\\\` - Description

## What You Get
Description of output.

## Next Steps After newcomm
1. Step 1
2. Step 2

## Troubleshooting

### Issue 1
Solution 1
\`;

// Add to guides map in agentCommand() action handler:
const guides: Record<string, string> = {
  // ...existing guides...
  newcomm: NEWCOMM_GUIDE
};
```

### 6. Write Tests

```typescript
// tests/unit/newfeature.test.ts
describe('NewFeature', () => {
  it('should work', () => {
    // Test implementation
  });
});
```

### 7. Update Shell Completions (if args changed)

If your command adds new arguments or subcommands, update `src/commands/completion.ts`.

### 8. Update Build Documentation (Major Features Only)

**Only for major new features** - confirm with user before creating. Not needed for:
- Bug fixes
- Minor enhancements
- Documentation updates
- Refactoring

**When required**, create `docs/maintainers/implementation/XX-feature-name.md` documenting:
- Implementation decisions
- Testing results
- Usage examples

## Installation

```bash
# Install from npm (recommended)
npm install -g @cisco_open/mcptoolkit-contract

# Or clone and build from source
git clone https://github.com/cisco-open/mcptoolkit-contract.git
cd mcptoolkit-contract
npm install && npm run build
npm install -g .
```

## Development Workflow

```bash
# Build
npm run build

# Watch mode
npm run watch

# Run all tests
npm test

# Watch mode for tests
npm run test:watch

# Coverage report
npm run test:coverage

# Auto-generate tests from catalog
npm run test:generate

# Manual CLI tests
npm run test:manual

# Check documentation links
npm run test:links

# Pre-release checks (links + build + tests)
npm run prerelease

# Test specific command
node build/index.js <command> --help
```

## Release Process

When implementing features or fixes:

1. **Bump the version** using `npm version` — this updates both `package.json`
   and `package-lock.json` atomically. Use `--no-git-tag-version` so npm doesn't
   create a commit or tag (those happen later, after the PR merges to `main`).
   Follow semantic versioning:
   - MAJOR (X.0.0): Breaking changes to CLI or schema
   - MINOR (0.X.0): New commands/features (backward-compatible)
   - PATCH (0.0.X): Bug fixes, docs (non-breaking)

   ```bash
   # Stable release (let npm calculate the bump type)
   npm version minor --no-git-tag-version

   # Release candidate (explicit version or auto-increment)
   npm version 1.1.0-rc.1 --no-git-tag-version
   npm version prerelease --preid=rc --no-git-tag-version
   ```

2. **Update CHANGELOG.md** with changes under appropriate section:
   - `### Added` - New features
   - `### Changed` - Changes to existing functionality
   - `### Deprecated` - Soon-to-be removed features
   - `### Removed` - Removed features
   - `### Fixed` - Bug fixes
   - `### Security` - Security fixes

3. **MCP Description Version Adoption** (when the CLI changes its target):

   The specification change must already be released from
   [`mcpdesc/mcpdesc-specification`](https://github.com/mcpdesc/mcpdesc-specification).
   Do not create or modify v0.8+ specification text or schemas in this repo.
   - Update `@mcpdesc/core` and `@mcpdesc/validator` to released versions.
   - Update emitted version and schema URI expectations, fixtures, templates,
     and user documentation.
   - Add the CLI-to-format mapping to `schemas/cli-schema-compatibility.json`.
   - Retain the local v0.1.0–v0.7.0 schemas unless legacy support is explicitly
     removed and documented in `CHANGELOG.md`.

   CLI-owned schemas such as diff, breaking analysis, and split configuration
   remain versioned under `schemas/`; update their versioned file,
   `schemas/latest.json`, compatibility mapping, and CLI CHANGELOG when they
   change.

4. **Test thoroughly** before committing:
   ```bash
   npm run prerelease  # Runs link checker, build, and all tests
   ```

5. **Release via a branch and pull request** — never commit releases directly to
   `main`. This lets CI run on the branch, gives reviewers a chance to weigh in,
   and keeps `main` protected. The npm publish is fully automated: pushing a
   `v*` tag triggers [`.github/workflows/publish.yml`](.github/workflows/publish.yml),
   which builds, tests, verifies the tag matches `package.json`, and publishes
   with provenance. Pre-release versions (any version containing `-`, e.g.
   `1.0.0-rc.5`) publish under the `next` dist-tag; stable versions publish under
   `latest`.

   All commits must be signed off under the DCO (`git commit -s`); see
   [CONTRIBUTING.md](CONTRIBUTING.md).

   ```bash
   # 1. Branch off up-to-date main
   git switch main && git pull
   git switch -c release/X.Y.Z

   # 2. Make the release-prep changes (steps 1–4 above), then commit (signed off)
   git add .
   git commit -s -m "Release vX.Y.Z"

   # 3. Push the branch and open a PR
   git push -u origin release/X.Y.Z
   # open a PR against main; wait for CI (ci.yml) to pass and for review

   # 4. Merge the PR (use a merge commit so the reviewed SHA lands in main),
   #    then tag that commit on main — the tag drives the npm publish.
   git switch main && git pull
   git tag vX.Y.Z
   git push origin vX.Y.Z   # triggers publish.yml → npm

   # 5. Confirm the publish workflow succeeded (Actions tab / npm registry).
   #    If it fails, fix forward with a new patch/RC version and tag — do not
   #    force-push or delete a published tag.
   ```

   > **Tag/version must match.** `publish.yml` fails the release if the pushed
   > tag (minus the leading `v`) differs from `package.json`'s `version`. Always
   > bump `package.json` in the release PR so the tag lines up.

   For a step-by-step checklist, use the release skill in
   [`.github/skills/release/SKILL.md`](.github/skills/release/SKILL.md).


## Testing Requirements

**Testing framework complete (v0.8.2)**:
- Jest configured with ES modules support (`jest.config.js`)
- Auto-generated tests from catalog YAML (`npm run test:generate`)
- 73 tests passing: 47 auto-generated + 15 unit + 11 integration
- Run tests: `npm test` (all), `npm run test:watch` (watch mode), `npm run test:coverage` (coverage)
- Documentation link checker: `npm run test:links` - validates all markdown links in docs/

**For new commands/features**:
1. Add test fixtures in `tests/fixtures/` (when applicable)
2. Add manual test in `tests/run-manual-tests.sh` (for CLI commands)
3. Add unit tests in `tests/unit/` (for libraries)
4. Add integration tests in `tests/integration/` (for workflows)

**Documentation link validation**:
- Run `npm run test:links` to check all markdown links
- Automatically runs as part of `npm run prerelease`
- Validates references to tutorials, examples, and build docs
- Prevents broken links before releases

**Build documentation** (`docs/maintainers/implementation/`) is only required for major new features - confirm with user first.

## Key Patterns

### Error Handling
```typescript
import { ConfigurationError, ValidationError } from './types.js';

throw new ConfigurationError('Clear message');
```

### File Paths
Use `new URL()` for ES module paths:
```typescript
const schemaPath = new URL('../../schemas/file.json', import.meta.url).pathname;
```

### Output Formatting
```typescript
import { formatJSON, formatYAML } from './lib/formatters.js';

const output = options.format === 'yaml' 
  ? formatYAML(data) 
  : formatJSON(data, options.pretty);
```

## Future Enhancements

**Post-1.0 Enhancements**:
- Phase 7.3: Advanced split filters (tag-based, description patterns, excludes)
- Web-based catalog browser for compatibility rules
- Interactive documentation interface
- Enhanced discoverability for non-CLI users

## Custom Catalog Support (v0.9.0)

**Overview**: The `rules` command supports browsing custom catalogs with automatic severity comparison against default MCP compatibility rules.

**Key Capabilities**:
- `--catalog <dir>` option on all `rules` subcommands (list, show, examples, validate, export)
- Severity comparison: `Severity: major (default: info|critical)` shows deviations from MCP standards
- Auto-discovery with manual override: `rules/my-rules.yaml` → `rules/my-rules-catalog/`
- Validates directory structure and falls back gracefully with warnings

**Common Usage**:
```bash
# Browse custom catalog with severity comparison
mcpcontract rules list --catalog rules/strict-compatibility-catalog

# Export custom rules as team documentation
mcpcontract rules export --catalog rules/my-team-catalog \
  --format markdown --output TEAM_RULES.md
```

**Implementation**: See `src/lib/catalog-discovery.ts` (catalogDirOverride parameter), `src/commands/rules.ts` (--catalog option), `tests/run-manual-tests.sh` (Tests 5-11)

## Backward Compatibility Rules System

**Overview**: The `breaking` command uses YAML-based rules to determine if changes are backward compatible or breaking.

**Architecture**:
- **Rules Engine** (`src/lib/rules-engine.ts`, 235 lines): Loads YAML rules, matches changes, annotates with severity
- **Default Rules** (`rules/breaking-changes.yaml`): 35 rules across 5 categories (tools, prompts, resources, resourceTemplates, serverInfo)
- **Conditional Rules**: Support operators (equals, notEquals, contains, notContains, hasAdditions, hasRemovals, onlyAdditions, onlyRemovals)
- **Exit Codes**: 0 (compatible), 1 (breaking), 2 (error)

**MCP Compatibility Philosophy** ([compatibility.md](docs/users/reference/compatibility.md)):
- **Postel's Law**: "Be liberal in what you accept" - clients handle unknown values gracefully
- **Open-World Assumption**: Schema evolves over time, unknown elements ignored
- **Semantic Versioning**: MAJOR (breaking), MINOR (new features), PATCH (fixes)

**Customizing Rules**:
```yaml
# rules/custom-rules.yaml
tools:
  - changeType: "parameter-enum-values-changed"
    breaking: true  # Stricter than default
    severity: "major"
    message: "ANY enum change is breaking in our environment"
    rationale: "Our clients use strict validation"
```

**Usage**: `mcpcontract breaking --diff diff.json --rules rules/custom-rules.yaml --output analysis.json`

**See Also**: `rules/strict-compatibility.yaml` for example strict rules

## References

- **MCP Description Specification**: [mcpdesc.org](https://mcpdesc.org/format/) - published format documentation; canonical development and governance live in [`mcpdesc/mcpdesc-specification`](https://github.com/mcpdesc/mcpdesc-specification). The local `spec/` and `schemas/mcp-description/` trees are archived v0.7-era material.
- **Design Documentation**: `docs/maintainers/design/` - Initial architecture and design decisions
- **Enhancement Specifications**: `docs/maintainers/implementation/` - Specs for new features and commands
- **Testing Guide**: `tests/README.md`
- **Version History**: [CHANGELOG.md](CHANGELOG.md)

---

**Keep this file and CHANGELOG.md updated** as new commands and patterns are added.
