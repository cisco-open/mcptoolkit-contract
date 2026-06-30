// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Agents Command - AI coding assistant reference guide
 * 
 * Provides markdown-formatted documentation optimized for AI coding assistants
 * like GitHub Copilot, Claude, ChatGPT, etc.
 */

import { Command } from 'commander';

// ============================================================================
// OVERVIEW - Main agent guide with all workflows
// ============================================================================

const OVERVIEW = `# mcpcontract - AI Coding Assistants Reference

CLI toolkit for MCP (Model Context Protocol) server contract management.

## Purpose
Helps developers document MCP servers, track version changes, and analyze breaking changes.

## When to Use This Command
- AI coding assistant (Copilot, Claude, ChatGPT, etc.) needs help with mcpcontract CLI
- User asks how to use specific commands
- Need to understand workflows for MCP server documentation

## Basic Usage

### Get Command-Specific Help
\`\`\`bash
# Get help for a specific command (~500-1000 tokens each)
mcpcontract agents --command dump
mcpcontract agents --command changelog
mcpcontract agents --command breaking
\`\`\`

### Get All Workflows
\`\`\`bash
# Show all end-to-end workflows
mcpcontract agents --workflows
\`\`\`

### Get Complete Reference
\`\`\`bash
# Get all commands in one document (~7,367 tokens)
mcpcontract agents --all
\`\`\`

## Common Patterns

### Pattern 1: User Asks "How Do I...?"
\`\`\`bash
# User: "How do I create a changelog?"
# AI runs:
mcpcontract agents --command changelog

# Gets: ~639 tokens of focused help with examples
# AI responds with exact commands from the guide
\`\`\`

### Pattern 2: User Wants Complete Workflow
\`\`\`bash
# User: "Show me the full version upgrade process"
# AI runs:
mcpcontract agents --workflows

# Gets: All workflows with step-by-step examples
# AI walks user through Version Upgrade Check workflow
\`\`\`

### Pattern 3: User Needs Parameter Details
\`\`\`bash
# User: "What parameters does breaking take?"
# AI runs:
mcpcontract agents --command breaking

# Gets: Command-specific help with all parameters
# AI explains: --diff, --rules, --suggest-version, etc.
\`\`\`

## Key Parameters

- \`--command <name>\` - Get help for specific command
  - Available: dump, split, validate, diff, breaking, changelog, document, rules, completion
- \`--workflows\` - Show all end-to-end workflows
- \`--all\` - Output complete reference in single document

## Available Commands

**dump** - Extract capabilities from a live MCP server
→ Use when: You have a running MCP server and need to document its capabilities

**split** - Split large MCP descriptions into focused subsets
→ Use when: You have a large federation MCP description and need to organize it by category

**validate** - Validate files against JSON schemas (mcpdesc, dump, diff)
→ Use when: You want to verify schema compliance before publication

**diff** - Compare two versions and generate structural diff
→ Use when: Tracking changes between server versions

**breaking** - Analyze diff for backward compatibility issues
→ Use when: Determining if changes require major version bump

**changelog** - Generate human-readable release notes from analysis
→ Use when: Creating version changelogs for users

**document** - Render documentation from MCP descriptions
→ Use when: Generating human-readable API documentation

**rules** - Browse and explore backward compatibility rules catalog
→ Use when: Understanding what changes are considered breaking

**completion** - Generate shell completion scripts (bash, zsh, fish)
→ Use when: Setting up autocompletion for the CLI

## What You Get

- **Markdown format** - Optimized for LLM consumption
- **Token-efficient** - Modular help saves 85-90% tokens vs full docs
- **Example-rich** - Real command sequences you can use directly
- **Context-aware** - Includes when/why/how for each command

## Next Steps

1. **For specific commands**: Use \`mcpcontract agents --command <name>\`
2. **For workflows**: Use \`mcpcontract agents --workflows\`
3. **For complete reference**: Use \`mcpcontract agents --all\`
4. **For shell completion**: Run \`mcpcontract completion bash|zsh|fish\`

## Tips for AI Agents

1. **Start narrow**: Get command-specific help first, not \`--all\`
2. **Use workflows**: Common scenarios are already documented
3. **Pipe context**: Include command output in follow-up questions
4. **Validate after**: Always suggest validation steps to users
5. **Check errors**: Use \`mcpcontract validate\` to catch issues early
`;

// ============================================================================
// WORKFLOWS - Common end-to-end workflows
// ============================================================================

const WORKFLOWS = `# Common Workflows

## Workflow 1: Version Upgrade Check

**Goal**: Determine if changes between versions are breaking.

\`\`\`bash
# 1. Create dumps for both versions
mcpcontract dump --config old-mcp.json --output old-dump.json
mcpcontract dump --config new-mcp.json --output new-dump.json

# 2. Compare versions
mcpcontract diff --from old-dump.json --to new-dump.json --output diff.json

# 3. Check for breaking changes with version recommendation
mcpcontract breaking --diff diff.json --suggest-version --output analysis.json

# 4. Generate release notes
mcpcontract changelog --analysis analysis.json --format release --output CHANGELOG.md
\`\`\`

## Workflow 2: Quick Validation Pipeline

\`\`\`bash
# Dump → Validate in one pipeline
mcpcontract dump --config mcp.json --output dump.json
mcpcontract validate dump.json --schema dump

# Then generate documentation
mcpcontract document dump.json --output docs/API.md
\`\`\`

### Check Single Change for Breaking Issues
\`\`\`bash
# Compare two dump files directly
mcpcontract diff --from old-dump.json --to new-dump.json | \\
  mcpcontract breaking --diff - --suggest-version
\`\`\`

## Decision Tree

**I need to...**
- Document a new MCP server → Start with \`dump\`
- Split a large MCP description into categories → Use \`split\`
- Check if my files are valid → Use \`validate\`
- See what changed between versions → Use \`diff\`
- Know if changes are breaking → Use \`breaking\` (after \`diff\`)
- Create release notes → Use \`changelog\` (after \`breaking\`)
- Generate API documentation → Use \`document\`
- Understand compatibility rules → Use \`rules\`
- Set up shell autocompletion → Use \`completion\`

## File Types Reference

- **dump.json** - Server capabilities extracted from live server
- **diff.json** - Structural differences between versions
- **analysis.json** - Breaking change analysis with severity ratings

## Output Formats

Most commands support multiple output formats:
- \`--format json\` - Machine-readable JSON (default for most)
- \`--format yaml\` - Human-friendly YAML
- \`--format markdown\` - Documentation format

## Next Steps

For command-specific help: \`mcpcontract agents <command>\`
For human-readable help: \`mcpcontract help <command>\`
For all workflows: \`mcpcontract agents --workflows\`
`;

// ============================================================================
// COMMAND-SPECIFIC GUIDES
// ============================================================================

const DUMP_GUIDE = `# dump - Extract MCP Server Capabilities

## Purpose
Connects to a live MCP server and extracts all capabilities (tools, resources, prompts, resourceTemplates) along with server metadata.

## When to Use
- You have a running MCP server
- Need to document what the server offers
- Tracking changes over time
- Starting the documentation workflow

## Basic Usage
\`\`\`bash
mcpcontract dump --config mcp.json --output dump.json
\`\`\`

## Common Patterns

### From MCP Config File (Recommended)
\`\`\`bash
# Using standard MCP configuration file
mcpcontract dump --config mcp.json --output dump.json
\`\`\`

### Direct Server Connection (stdio)
\`\`\`bash
mcpcontract dump \\
  --server-name "my-server" \\
  --transport stdio \\
  --command "node" \\
  --args "server.js" \\
  --output dump.json
\`\`\`

### HTTP Transport with Bearer Token (Most Common)
\`\`\`bash
# Using environment variable for token (recommended)
export TOKEN="your-secret-token-here"
mcpcontract dump \\
  --transport streamable-http \\
  --url https://api.example.com/mcp \\
  -H "Authorization: Bearer $TOKEN" \\
  --output dump.json

# Or using config file (better for multiple servers)
mcpcontract dump \\
  --config http-with-auth-config.yaml \\
  --mcp-server my-api-server \\
  --output dump.json
\`\`\`

### HTTP Transport with Custom Headers
\`\`\`bash
mcpcontract dump \\
  --transport streamable-http \\
  --url https://api.example.com/mcp \\
  -H "Authorization: Bearer TOKEN" \\
  -H "X-API-Key: KEY" \\
  -H "X-Client-ID: mcpcontract" \\
  --output dump.json
\`\`\`

### Output to YAML (Human-Readable)
\`\`\`bash
mcpcontract dump --config mcp.json --format yaml --output dump.yaml
\`\`\`

### Pipe to Next Command
\`\`\`bash
# Dump and immediately validate
mcpcontract dump --config mcp.json --output dump.json
mcpcontract validate dump.json --schema dump
\`\`\`

### Quiet Mode (No Progress Messages)
\`\`\`bash
mcpcontract dump --config mcp.json --quiet --output dump.json
\`\`\`

## Key Parameters

### Required (choose one approach)
- \`--config <file>\` - MCP server configuration file (recommended)
- \`--server-name <name>\` + \`--transport\` - Direct connection

### Optional
- \`--output <file>\` - Output file (default: stdout)
- \`--format <type>\` - Output format: json, yaml, markdown (default: json)
- \`--quiet\` - Suppress progress messages
- \`-H, --header <header>\` - HTTP header for streamable-http/sse (repeatable, format: "Key: Value")
- \`--command <cmd>\` - Server command (for stdio transport)
- \`--args <args>\` - Server arguments (for stdio transport)
- \`--url <url>\` - Server URL (for streamable-http/sse transport)
- \`--env <vars>\` - Environment variables (for stdio transport, format: "KEY=VALUE,KEY2=VALUE2")

## What You Get

A dump file containing:
- **serverInfo** - Name, version, protocol version, capabilities array
- **tools** - Available tools with input schemas
- **resources** - Static resources with URI patterns
- **resourceTemplates** - Dynamic resource templates
- **prompts** - Available prompts with argument schemas

Example dump.json structure:
\`\`\`json
{
  "serverInfo": {
    "name": "my-server",
    "version": "1.0.0",
    "protocolVersion": "2024-11-05",
    "capabilities": ["tools", "resources", "prompts"]
  },
  "tools": [
    {
      "name": "search",
      "description": "Search for items",
      "inputSchema": { ... }
    }
  ]
}
\`\`\`

## Next Steps After Dump

1. **Validate the dump**: \`mcpcontract validate dump.json --schema dump\`
2. **Generate docs**: \`mcpcontract document dump.json --output API.md\`
3. **Compare versions**: \`mcpcontract diff --from old-dump.json --to dump.json\`

## Troubleshooting

### Server won't connect
- Verify server command in config file
- Test server manually first: \`node server.js\`
- Check server logs for startup errors
- Ensure server implements MCP protocol correctly

### Protocol version mismatch
- Error: "Unsupported MCP Protocol Version"
- Tool supports MCP protocol 2024-11-05
- Update server or tool version to match

### Missing capabilities
- Server may not implement all MCP features
- Check server documentation for supported capabilities
- Empty arrays are normal if server doesn't offer that capability type

### Connection timeout
- Server may be slow to start
- Increase timeout (not yet configurable, file an issue)
- Check server isn't stuck waiting for input
`;

const SPLIT_GUIDE = `# split - Split Large MCP Descriptions into Subsets

## Purpose
Splits a large MCP description into multiple focused subsets based on filtering rules (e.g., by tool name patterns).

## When to Use
- You have a large federation MCP description with many tools
- Need to organize capabilities by category or team
- Want to create focused documentation per service area
- Managing multi-service MCP servers

## Basic Usage
\`\`\`bash
mcpcontract split dump.json --config split-config.yaml --output-dir ./split-output
\`\`\`

## Common Patterns

### Split by Tool Name Patterns
\`\`\`bash
# Using a config file with regex patterns
mcpcontract split federation-dump.json \\
  --config split-config.yaml \\
  --output-dir ./by-category
\`\`\`

### Dry Run (Preview Split)
\`\`\`bash
# See what would be created without writing files
mcpcontract split dump.json \\
  --config split-config.yaml \\
  --dry-run
\`\`\`

### YAML Output
\`\`\`bash
# Output split files as YAML
mcpcontract split dump.json \\
  --config split-config.yaml \\
  --format yaml \\
  --output-dir ./split-output
\`\`\`

### Validate After Splitting
\`\`\`bash
# Auto-validate split outputs against schema
mcpcontract split dump.json \\
  --config split-config.yaml \\
  --validate \\
  --output-dir ./split-output
\`\`\`

## Key Parameters

### Required
- \`<mcpdesc>\` - Input MCP description file (JSON or YAML)
- \`--config <file>\` - Split configuration file (JSON or YAML)

### Optional
- \`--output-dir <path>\` - Output directory for split files (default: .)
- \`--format <type>\` - Output format: json, yaml (default: auto-detect from input)
- \`--pretty\` - Pretty-print JSON output (default: true)
- \`--no-pretty\` - Compact JSON output
- \`--dry-run\` - Show what would be split without writing files
- \`--validate\` - Validate split outputs against schema after generation
- \`--quiet\` - Suppress progress messages

## Split Configuration Structure

Create a split config file (YAML or JSON):

\`\`\`yaml
categories:
  - name: networking
    outputFile: networking-tools
    filters:
      tools:
        namePatterns:
          - "^network_.*"
          - "^route_.*"
          - ".*_network$"
  
  - name: storage
    outputFile: storage-tools
    filters:
      tools:
        namePatterns:
          - "^storage_.*"
          - "^disk_.*"
          - ".*_storage$"
  
  - name: compute
    outputFile: compute-tools
    filters:
      tools:
        namePatterns:
          - "^vm_.*"
          - "^container_.*"

unmatchedItems:
  action: separate-file  # or: ignore, warn, error
  outputFile: other-tools
\`\`\`

## What You Get

Multiple output files, one per category:
- \`networking-tools.json\` - All tools matching networking patterns
- \`storage-tools.json\` - All tools matching storage patterns
- \`compute-tools.json\` - All tools matching compute patterns
- \`other-tools.json\` - Unmatched tools (if action: separate-file)

Each split output contains:
- Original serverInfo
- Filtered tools matching the category
- Split metadata in \`dumpExecution.splitOperation\`:
  - Source file, category, filter rules
  - Original vs filtered counts
  - Tool name, version, timestamps

## Next Steps After Split

1. **Validate splits**: Automatically with \`--validate\` flag
2. **Generate docs**: \`mcpcontract document networking-tools.json --output NETWORKING.md\`
3. **Version tracking**: Use split outputs for focused version comparisons

## Troubleshooting

### No tools matched patterns
- Check regex patterns in config file
- Use \`--dry-run\` to see matching results
- Test patterns separately with regex tools
- Verify tool names in original MCP description

### Multiple matches warning
- Tool matched multiple categories
- First match wins (order matters in config)
- Reorganize categories or make patterns more specific

### Unmatched tools
- Configure \`unmatchedItems.action\` in config:
  - \`ignore\` - Silently skip
  - \`warn\` - Show warning (default)
  - \`error\` - Fail with error
  - \`separate-file\` - Create separate output

### Validation fails
- Ensure original MCP description is valid
- Check split config schema compliance
- Review filter patterns for syntax errors
`;

const VALIDATE_GUIDE = `# validate - Validate Files Against Schemas

## Purpose
Validates dump or diff files against their JSON schemas to ensure correctness.

## When to Use
- After generating dumps
- In CI/CD pipelines
- Debugging schema issues
- Ensuring compatibility

## Basic Usage
\`\`\`bash
# Auto-detect schema type
mcpcontract validate dump.json

# Explicit schema type
mcpcontract validate dump.json --schema dump
\`\`\`

## Common Patterns

### Validate Dump
\`\`\`bash
mcpcontract validate dump.json --schema dump
\`\`\`

### Validate Diff
\`\`\`bash
mcpcontract validate diff.json --schema diff
\`\`\`

### Validate from stdin
\`\`\`bash
mcpcontract dump --config mcp.json | mcpcontract validate --schema dump -
\`\`\`

### Quiet Validation (Exit Code Only)
\`\`\`bash
if mcpcontract validate dump.json --quiet; then
  echo "Valid!"
fi
\`\`\`

## Key Parameters

### Required
- \`<file>\` - File to validate (or \`-\` for stdin)

### Optional
- \`--schema <type>\` - Schema type: mcpdesc, dump, diff, diff-breaking, dump-split
- \`--quiet\` - Suppress output (exit code only)

## Schema Types

- \`dump\` or \`mcpdesc\` - Validates capability dumps / MCP descriptions
- \`diff\` - Validates structural diff files
- \`diff-breaking\` - Validates breaking change analysis files
- \`dump-split\` - Validates split configuration files

## Exit Codes

- \`0\` - Validation passed
- \`1\` - Validation failed

## Next Steps After Validation

### If validation passes
- Proceed with next workflow step
- Generate documentation

### If validation fails
- Review error messages
- Check schema requirements
- Fix structural issues
- Re-validate

## Troubleshooting

### Unknown properties
- Schema may have changed
- Remove extra fields not in schema
- Check schema version compatibility

### Missing required fields
- Add required fields to your file
- Check schema documentation
- Review example files

### Type mismatches
- Ensure values match expected types (string, number, array, object)
- Check for proper JSON/YAML syntax
- Validate nested objects
`;

const DIFF_GUIDE = `# diff - Compare Server Versions

## Purpose
Generates a structural diff between two MCP descriptions, showing added, removed, and modified capabilities.

## When to Use
- Tracking changes between versions
- Before releasing updates
- Understanding impact of changes
- Preparing changelogs
- Input for breaking change analysis

## Basic Usage
\`\`\`bash
mcpcontract diff \\
  --from old-dump.json \\
  --to new-dump.json \\
  --output diff.json
\`\`\`

## Common Patterns

### Compare Two Versions
\`\`\`bash
mcpcontract diff --from v1.json --to v2.json --output diff.json
\`\`\`

### Compare Dumps
\`\`\`bash
mcpcontract diff --from old-dump.json --to new-dump.json --output diff.json
\`\`\`

### Pretty-Print Diff
\`\`\`bash
mcpcontract diff --from old.json --to new.json --pretty
\`\`\`

### YAML Output
\`\`\`bash
mcpcontract diff --from old.json --to new.json --format yaml
\`\`\`

### Pipe to Breaking Analysis
\`\`\`bash
mcpcontract diff --from old.json --to new.json | \\
  mcpcontract breaking --diff - --suggest-version
\`\`\`

## Key Parameters

### Required
- \`--from <file>\` - Older version file
- \`--to <file>\` - Newer version file

### Optional
- \`--output <file>\` - Output file (default: stdout)
- \`--format <type>\` - Output format: json, yaml (default: json)
- \`--pretty\` - Pretty-print JSON output

## What You Get

A diff file containing changes in these categories:

### serverInfo
- Name changes
- Version changes
- Protocol version changes
- Capabilities array changes

### tools
- \`added\` - New tools
- \`removed\` - Deleted tools
- \`modified\` - Changed tools with details

### resources
- \`added\` - New resources
- \`removed\` - Deleted resources
- \`modified\` - Changed resources

### prompts
- \`added\` - New prompts
- \`removed\` - Deleted prompts
- \`modified\` - Changed prompts

### resourceTemplates
- \`added\` - New templates
- \`removed\` - Deleted templates
- \`modified\` - Changed templates

## Next Steps After Diff

1. **Analyze for breaking changes**: \`mcpcontract breaking --diff diff.json\`
2. **Generate changelog**: \`mcpcontract changelog --analysis analysis.json\`
3. **Review changes manually**: Open diff.json and inspect

## Troubleshooting

### No differences found
- Files may be identical
- Check you're comparing correct versions
- Verify files loaded successfully

### Unexpected differences
- Check field ordering (shouldn't matter but might affect detection)
- Verify files are the same format (both dumps)
- Review serverInfo changes carefully
`;

const BREAKING_GUIDE = `# breaking - Detect Breaking Changes

## Purpose
Analyzes a structural diff using backward compatibility rules to identify breaking changes and suggest semantic version bumps.

## When to Use
- After generating a diff
- Before releasing updates
- In CI/CD to block breaking PRs
- Determining next version number
- Understanding compatibility impact

## Basic Usage
\`\`\`bash
mcpcontract breaking \\
  --diff diff.json \\
  --suggest-version \\
  --output analysis.json
\`\`\`

## Common Patterns

### Standard Analysis with Version Suggestion
\`\`\`bash
mcpcontract breaking --diff diff.json --suggest-version
\`\`\`

### From Piped Diff
\`\`\`bash
mcpcontract diff --from old.json --to new.json | \\
  mcpcontract breaking --diff - --suggest-version
\`\`\`

### Custom Rules
\`\`\`bash
mcpcontract breaking \\
  --diff diff.json \\
  --rules custom-rules.yaml \\
  --output analysis.json
\`\`\`

### Pretty-Print Analysis
\`\`\`bash
mcpcontract breaking --diff diff.json --pretty
\`\`\`

### Exit Code Check (CI/CD)
\`\`\`bash
if mcpcontract breaking --diff diff.json; then
  echo "No breaking changes!"
else
  echo "Breaking changes detected!"
  exit 1
fi
\`\`\`

## Key Parameters

### Required
- \`--diff <file>\` - Diff file from \`diff\` command (or \`-\` for stdin)

### Optional
- \`--output <file>\` - Output file (default: stdout)
- \`--rules <file>\` - Custom rules file (default: built-in rules)
- \`--suggest-version\` - Add semantic version recommendation
- \`--format <type>\` - Output format: json, yaml (default: json)
- \`--pretty\` - Pretty-print JSON output

## Exit Codes

- \`0\` - No breaking changes (backward compatible)
- \`1\` - Breaking changes detected
- \`2\` - Error occurred

## What You Get

Analysis file containing:
- \`compatible\` - Boolean: are changes backward compatible?
- \`suggestedVersion\` - Recommended version bump (if --suggest-version)
- \`changes\` - Array of all detected changes with:
  - \`category\` - tools, prompts, resources, etc.
  - \`changeType\` - Specific type of change
  - \`breaking\` - Is this change breaking?
  - \`severity\` - info, minor, major, critical
  - \`message\` - Human-readable explanation
  - \`path\` - Location of change

## Version Recommendations

- \`PATCH\` (0.0.X) - Bug fixes, no API changes
- \`MINOR\` (0.X.0) - New features, backward compatible
- \`MAJOR\` (X.0.0) - Breaking changes

## Common Breaking Changes

- Tool removed
- Tool parameter removed
- Parameter made required
- Parameter type changed
- Enum values removed
- Resource removed
- Prompt removed

## Next Steps After Analysis

1. **Generate changelog**: \`mcpcontract changelog --analysis analysis.json\`
2. **Review breaking changes**: Open analysis.json and assess impact
3. **Update version**: Use suggestedVersion in package.json

## Troubleshooting

### False positives
- Review rules with \`mcpcontract rules show <rule-id>\`
- Create custom rules file with adjusted severity
- File an issue if rule is incorrect

### Missing detections
- Ensure diff file is complete
- Check rules catalog: \`mcpcontract rules list\`
- Verify change type is covered by rules
`;

const CHANGELOG_GUIDE = `# changelog - Generate Release Notes

## Purpose
Generates human-readable changelogs from breaking change analysis, formatted for users and documentation.

## When to Use
- After breaking change analysis
- Creating release notes
- Documenting version changes
- Communicating updates to users

## Basic Usage
\`\`\`bash
mcpcontract changelog \\
  --analysis analysis.json \\
  --format release \\
  --output CHANGELOG.md
\`\`\`

## Common Patterns

### Release Format (Comprehensive)
\`\`\`bash
mcpcontract changelog \\
  --analysis analysis.json \\
  --format release \\
  --output CHANGELOG.md
\`\`\`

### Compact Format (Brief)
\`\`\`bash
mcpcontract changelog \\
  --analysis analysis.json \\
  --format compact \\
  --output RELEASE_NOTES.md
\`\`\`

### From Piped Analysis
\`\`\`bash
mcpcontract breaking --diff diff.json --suggest-version | \\
  mcpcontract changelog --analysis - --format release
\`\`\`

### Complete Pipeline
\`\`\`bash
mcpcontract diff --from old.json --to new.json | \\
  mcpcontract breaking --diff - --suggest-version | \\
  mcpcontract changelog --analysis - --format release --output CHANGELOG.md
\`\`\`

## Key Parameters

### Required
- \`--analysis <file>\` - Analysis file from \`breaking\` command (or \`-\` for stdin)

### Optional
- \`--output <file>\` - Output file (default: stdout)
- \`--format <type>\` - Template: release, compact (default: release)
- \`--template <file>\` - Custom Handlebars template
- \`--omit-zeros\` - Hide categories with 0 entries from summary
- \`--sort <order>\` - Sort order: original (default), alphabetical
- \`--show-diff-reasoning\` - Show impact badges and rationale (hidden by default)

## Changelog Formats

### release (Comprehensive)
- Version recommendation
- Summary categorized by change type (Breaking, New, Updates, Deleted)
- Detailed changes grouped by capability name
- Before/After tables for visual diff
- Impact assessment (with \`--show-diff-reasoning\`)
- Migration guidance

### compact (Brief)
- Bullet-point list
- Breaking changes highlighted
- Concise descriptions
- Good for release notes

## What You Get

Markdown changelog with sections:
- **Version Recommendation** - Suggested semantic version
- **Breaking Changes** - Critical changes requiring attention
- **New Features** - Added capabilities
- **Updates** - Modified features
- **Removed** - Deleted capabilities
- **Compatibility** - Overall status

## Next Steps After Changelog

1. **Review and edit**: Add human context, examples, migration guides
2. **Publish**: Add to CHANGELOG.md or release notes
3. **Update version**: Apply suggested version to package.json

## Troubleshooting

### Empty changelog
- No changes detected in analysis
- Verify analysis.json has changes array
- Check diff wasn't empty

### Template errors
- Verify custom template syntax (Handlebars)
- Check template has required helpers
- Use built-in templates as reference
`;

const DOCUMENT_GUIDE = `# document - Generate Documentation [EXPERIMENTAL]

⚠️ **EXPERIMENTAL**: This command is under active development and may change.

## Purpose
Renders human-readable documentation from MCP descriptions using customizable templates.

## When to Use
- Creating API documentation
- Generating user guides
- Publishing server capabilities

## Basic Usage
\`\`\`bash
mcpcontract document dump.json --output README.md
\`\`\`

## Common Patterns

### Default Template
\`\`\`bash
mcpcontract document dump.json --output API.md
\`\`\`

### HTML Card View
\`\`\`bash
mcpcontract document spec.yaml --template card-view --output spec.html
\`\`\`

### From MCP Description File
\`\`\`bash
mcpcontract document dump.yaml --output CAPABILITIES.md
\`\`\`

### Reference (Concise) Mode
\`\`\`bash
mcpcontract document dump.yaml --rendering reference --output REF.md
\`\`\`

### Custom Template
\`\`\`bash
mcpcontract document dump.json \\
  --template custom-template.md.hbs \\
  --output docs/API.md
\`\`\`

### Choose Markdown Engine (for HTML templates)
\`\`\`bash
mcpcontract document spec.yaml \\
  --template card-view \\
  --markdown-engine markdown-it \\
  --output spec.html
\`\`\`

## Key Parameters

### Required
- \`[file]\` - MCP description file (or \`-\` for stdin, default: stdin)

### Optional
- \`--output <file>\` - Output file (default: stdout)
- \`--template <name|file>\` - Built-in template name or path to custom .hbs file
- \`--rendering <mode>\` - Rendering mode: \`full\` (detailed, default) or \`reference\` (concise)
- \`--type <type>\` - Input file type: \`mcpdesc\`, \`dump\` (legacy), or \`auto\` (default)
- \`--markdown-engine <engine>\` - Markdown engine for HTML templates: \`marked\` (default), \`markdown-it\`, \`snarkdown\`
- \`--show-extraction-details\` - Show session, CORS, and extraction information sections
- \`--list\` - List available built-in templates

## Available Templates

Use \`mcpcontract document --list\` to see all templates.

### mcpdesc-documentation (default)
- Detailed MCP description with tools, prompts, and resources

### reference-documentation
- Concise reference format with summary and details sections

### card-view
- **Self-contained HTML page** with interactive card layout
- Collapsible \`<details>/<summary>\` sections for tools, prompts, resources
- Color-coded badges for version, protocol, transports, CORS status, tags
- Schema tables with type pills and constraints
- Inline CSS, no external dependencies
- Supports \`--markdown-engine\` option for rich text rendering
- Output: HTML file (use \`--output spec.html\`)

### Custom Templates
Create Handlebars (.hbs) templates with access to:
- \`info\` - Name, version, description (mcpdesc format)
- \`tools\` - Array of tool definitions
- \`resources\` - Array of resources
- \`prompts\` - Array of prompts
- \`resourceTemplates\` - Array of templates
- \`_meta\` - Alias for \`x-cisco-metadata\` (dump/extraction details)

## Next Steps After Documenting

1. **Review and edit**: Add examples, usage notes
2. **Publish**: Add to repository README

## Troubleshooting

### Template not found
- Check template name spelling
- Verify custom template path exists
- Use absolute or relative path for custom templates

### Missing content
- Verify input file is a complete MCP description
- Check serverInfo and capabilities exist
- Ensure file format is valid JSON/YAML

### Rendering errors
- Check Handlebars syntax in custom templates
- Verify template variables match data structure
- Review built-in templates as examples
`;

const RULES_GUIDE = `# rules - Browse Compatibility Rules

## Purpose
Browse, search, and export the catalog of backward compatibility rules used for breaking change detection.

## When to Use
- Understanding what changes are breaking
- Learning compatibility best practices
- Creating custom rule sets
- Documenting team standards
- Debugging breaking change detection

## Basic Usage
\`\`\`bash
# List all rules
mcpcontract rules list

# Show specific rule details
mcpcontract rules show tool-removed
\`\`\`

## Subcommands

### list
List all available rules with filtering.

\`\`\`bash
# All rules
mcpcontract rules list

# Filter by category
mcpcontract rules list --category tools

# Filter by severity
mcpcontract rules list --severity major

# Show both
mcpcontract rules list --category tools --severity major
\`\`\`

### show
Display detailed information about a specific rule.

\`\`\`bash
mcpcontract rules show tool-removed
mcpcontract rules show parameter-required-added
\`\`\`

### examples
Show example scenarios that trigger a rule.

\`\`\`bash
mcpcontract rules examples parameter-type-changed
\`\`\`

### validate
Validate custom rules file syntax.

\`\`\`bash
mcpcontract rules validate custom-rules.yaml
\`\`\`

### export
Export rules catalog as documentation.

\`\`\`bash
# Markdown format
mcpcontract rules export --format markdown --output RULES.md

# JSON format
mcpcontract rules export --format json --output rules.json
\`\`\`

## Key Parameters

### list subcommand
- \`--category <name>\` - Filter: tools, prompts, resources, resourceTemplates, serverInfo
- \`--severity <level>\` - Filter: info, minor, major, critical
- \`--catalog <dir>\` - Use custom catalog directory

### show subcommand
- \`<rule-id>\` - Rule identifier (required)
- \`--catalog <dir>\` - Use custom catalog directory

### examples subcommand
- \`<rule-id>\` - Rule identifier (required)
- \`--catalog <dir>\` - Use custom catalog directory

### validate subcommand
- \`<file>\` - Rules YAML file to validate

### export subcommand
- \`--format <type>\` - Export format: markdown, json (default: markdown)
- \`--output <file>\` - Output file (default: stdout)
- \`--catalog <dir>\` - Use custom catalog directory

## Rule Categories

- **tools** - Tool-related changes (12 rules)
- **prompts** - Prompt-related changes (8 rules)
- **resources** - Resource-related changes (6 rules)
- **resourceTemplates** - Template-related changes (3 rules)
- **serverInfo** - Server metadata changes (5 rules)

## Rule Severity Levels

- **info** - Informational, not breaking
- **minor** - Small change, usually compatible
- **major** - Breaking change
- **critical** - Severe breaking change

## Custom Catalog Support

Use custom rules catalog for team-specific standards:

\`\`\`bash
# Browse custom catalog
mcpcontract rules list --catalog rules/my-team-catalog

# Export custom rules
mcpcontract rules export \\
  --catalog rules/strict-catalog \\
  --format markdown \\
  --output TEAM_RULES.md
\`\`\`

## Next Steps

1. **Learn rules**: Browse catalog to understand compatibility
2. **Create custom**: Write team-specific rules file
3. **Use in analysis**: \`mcpcontract breaking --rules custom.yaml\`

## Troubleshooting

### Rule not found
- Check rule ID spelling
- List all rules: \`mcpcontract rules list\`
- Verify catalog path if using custom

### Catalog validation errors
- Check YAML syntax
- Verify required fields present
- Review catalog-schema.json
`;

const COMPLETION_GUIDE = `# completion - Shell Autocompletion

## Purpose
Generates shell completion scripts for bash, zsh, or fish to enable tab-completion of mcpcontract commands.

## When to Use
- Setting up development environment
- Improving CLI productivity
- Onboarding new team members

## Basic Usage
\`\`\`bash
# Bash
mcpcontract completion bash > ~/.mcpcontract-completion.bash
echo 'source ~/.mcpcontract-completion.bash' >> ~/.bashrc

# Zsh
mcpcontract completion zsh > ~/.mcpcontract-completion.zsh
echo 'source ~/.mcpcontract-completion.zsh' >> ~/.zshrc

# Fish
mcpcontract completion fish > ~/.config/fish/completions/mcpcontract.fish
\`\`\`

## Common Patterns

### Quick Setup (Bash)
\`\`\`bash
mcpcontract completion bash | sudo tee /etc/bash_completion.d/mcpcontract
\`\`\`

### Quick Setup (Zsh)
\`\`\`bash
mcpcontract completion zsh > "\${fpath[1]}/_mcpcontract"
\`\`\`

### Output to File
\`\`\`bash
mcpcontract completion bash --output ~/.mcpcontract-completion.bash
\`\`\`

## Supported Shells

- \`bash\` - Bourne Again Shell
- \`zsh\` - Z Shell
- \`fish\` - Friendly Interactive Shell

## What You Get

After setup, tab completion works for:
- Commands: \`mcpcontract d<TAB>\` → \`dump\`
- Options: \`mcpcontract dump --f<TAB>\` → \`--format\`
- Values: \`mcpcontract dump --format <TAB>\` → \`json yaml markdown\`

## Troubleshooting

### Completions not working
- Restart shell or source config file
- Verify completion script was sourced
- Check file permissions (should be readable)

### Wrong shell
- Verify \`$SHELL\` environment variable
- Generate for correct shell type
`;

// ============================================================================
// COMMAND IMPLEMENTATION
// ============================================================================

export function agentsCommand(): Command {
  const cmd = new Command('agents');
  
  cmd
    .description('Agent-optimized help (for Copilot, Claude, ChatGPT, etc.)')
    .option('--command <name>', 'Get help for specific command (dump, validate, diff, breaking, changelog, document, rules, completion)')
    .option('--workflows', 'Show all end-to-end workflows')
    .option('--all', 'Output all commands in single document (~7K tokens)')
    .action((options?: { command?: string; workflows?: boolean; all?: boolean }) => {
      // All mode: output complete reference
      if (options?.all) {
        console.log(OVERVIEW);
        console.log('\n---\n');
        console.log(WORKFLOWS);
        console.log('\n---\n');
        
        // Output all command guides
        const allGuides = [
          DUMP_GUIDE,
          SPLIT_GUIDE,
          VALIDATE_GUIDE,
          DIFF_GUIDE,
          BREAKING_GUIDE,
          CHANGELOG_GUIDE,
          DOCUMENT_GUIDE,
          RULES_GUIDE,
          COMPLETION_GUIDE
        ];
        
        allGuides.forEach((guide, idx) => {
          console.log(guide);
          if (idx < allGuides.length - 1) {
            console.log('\n---\n');
          }
        });
        return;
      }
      
      // Short mode (default): modular output
      // No options = show overview
      if (!options?.command && !options?.workflows) {
        console.log(OVERVIEW);
        return;
      }
      
      // Workflows mode
      if (options?.workflows) {
        console.log(WORKFLOWS);
        return;
      }
      
      // Command-specific guides
      if (options?.command) {
        const guides: Record<string, string> = {
          dump: DUMP_GUIDE,
          split: SPLIT_GUIDE,
          validate: VALIDATE_GUIDE,
          diff: DIFF_GUIDE,
          breaking: BREAKING_GUIDE,
          changelog: CHANGELOG_GUIDE,
          document: DOCUMENT_GUIDE,
          rules: RULES_GUIDE,
          completion: COMPLETION_GUIDE
        };
        
        const guide = guides[options.command];
        if (guide) {
          console.log(guide);
        } else {
          console.error(`Unknown command: ${options.command}`);
          console.error('');
          console.error('Available commands:');
          console.error('  dump, split, validate, diff, breaking,');
          console.error('  changelog, document, rules, completion');
          console.error('');
          console.error('Usage: mcpcontract agents --command <name>');
          console.error('       mcpcontract agents --workflows');
          console.error('       mcpcontract agents --all');
          process.exit(1);
        }
      }
    });
  
  return cmd;
}
