# Tutorial: Splitting Large MCP Dumps

## Overview

When working with federation MCP servers or large-scale deployments that aggregate multiple backend services, you may encounter dumps with hundreds of tools, prompts, and resources. The `split` command helps you organize these capabilities into focused, manageable subsets for better documentation, analysis, and discoverability.

## When to Use Split

Use the split command when you need to:

- **Organize by service**: Split federation server tools by backend service
- **Domain separation**: Create separate documentation for different functional domains
- **Focused analysis**: Compare changes in specific capability subsets
- **Team workflows**: Generate service-specific documentation for different teams
- **Reduce cognitive load**: Work with manageable chunks instead of overwhelming lists

## Prerequisites

- An MCP server dump file (JSON or YAML format)
- Basic understanding of regular expressions (for pattern matching)

## Step-by-Step Guide

### Step 1: Examine Your Dump

First, understand what you're working with:

```bash
# View tool count
mcpcontract document --input federation-dump.json | head -20

# Or use jq to see tool name patterns
jq '.tools[].name' federation-dump.json | head -20
```

**Example output**:
```
"platform-identity_getSubscription"
"platform-identity_listSubscriptions"
"platform-identity_updateSubscription"
"secure-access-networks_jwtLogin"
"secure-access-networks_getDevices"
"secure-access-networks_updateDevice"
...
```

Look for naming patterns (prefixes, suffixes, URI schemes) that can help you define categories.

### Step 2: Create a Split Configuration

Create a `split-config.yaml` file defining your categories and filtering rules:

```yaml
schemaVersion: https://developer.cisco.com/mcpcontract/schema/dump-split/1.0.0

info:
  version: "1.0.0"
  name: "Service-based split"
  description: "Split federation server dump by backend service"
  created: "2025-12-15"
  author: "MCP Toolkit Team"

categories:
  - name: "platform-identity"
    description: "Platform Identity APIs"
    outputFile: "dump-platform-identity"
    filters:
      tools:
        - type: "name-pattern"
          pattern: "^platform-identity_"
          description: "Tools prefixed with platform-identity_"

  - name: "secure-access-networks"
    description: "Secure Access Networks APIs"
    outputFile: "dump-secure-access-networks"
    filters:
      tools:
        - type: "name-pattern"
          pattern: "^secure-access-networks_"
          description: "Tools prefixed with secure-access-networks_"

# Optional: handle tools that don't match any category
unmatchedItems:
  action: "separate-file"  # Options: ignore, warn, error, separate-file
  outputFile: "dump-unmatched"
```

**Pattern Tips**:
- Use `^` to match at start: `^service_` matches "service_tool" but not "my_service_tool"
- Use `.*` for wildcards: `.*subscription.*` matches "getSubscription", "subscription_list", etc.
- Test patterns online at [regex101.com](https://regex101.com/) with ECMAScript flavor

### Step 3: Validate Your Configuration

Before splitting, validate your configuration:

```bash
mcpcontract validate split-config.yaml --schema dump-split
```

**Success output**:
```
✅ Valid dump-split: split-config.yaml

Validation Summary:
- Schema Type: dump-split
- Errors: 0
- Warnings: 0

No issues found.
```

### Step 4: Preview the Split (Dry Run)

Test your patterns without creating files:

```bash
mcpcontract split federation-dump.json \
  --config split-config.yaml \
  --dry-run
```

**Example output**:
```
Validating split configuration: split-config.yaml
✓ Split configuration is valid

Loading dump: federation-dump.json
✓ Loaded dump: federation-dump.json (150 tools, 0 prompts, 0 resources)
✓ Loaded split config: split-config.yaml (2 categories)

Splitting by category:

  [platform-identity]
  ✓ Matched 45 tools
  [secure-access-networks]
  ✓ Matched 38 tools

[DRY RUN] Would create the following files:
  - dump-platform-identity (45 tools)
  - dump-secure-access-networks (38 tools)
  - dump-unmatched (67 tools)

Summary:
  Total tools:     150
  Matched:         83 (55.3%)
  Unmatched:       67 (44.7%)
  Output files:    3
```

**What to check**:
- ✅ All expected categories found tools
- ✅ Match counts look reasonable
- ⚠️ Unmatched count acceptable (or refine patterns)

### Step 5: Perform the Split

Once satisfied with the preview, create the split dumps:

```bash
mcpcontract split federation-dump.json \
  --config split-config.yaml \
  --output-dir ./split-dumps \
  --validate
```

**Output**:
```
Validating split configuration: split-config.yaml
✓ Split configuration is valid

Loading dump: federation-dump.json
✓ Loaded dump: federation-dump.json (150 tools, 0 prompts, 0 resources)
✓ Loaded split config: split-config.yaml (2 categories)

Splitting by category:

  [platform-identity]
  ✓ Matched 45 tools
  → Writing: split-dumps/dump-platform-identity.json
  [secure-access-networks]
  ✓ Matched 38 tools
  → Writing: split-dumps/dump-secure-access-networks.json
  [unmatched]
  ✓ Matched 67 tools
  → Writing: split-dumps/dump-unmatched.json

Validating output files...
✓ All output files are valid

Summary:
  Total tools:     150
  Matched:         83 (55.3%)
  Unmatched:       67 (44.7%)
  Output files:    3

✓ Split completed successfully
```

### Step 6: Verify Split Metadata

Each split dump includes complete audit trail metadata about its origin in `x-cisco-metadata.dump.splitOperation`:

```bash
jq '.["x-cisco-metadata"].dump.splitOperation' split-dumps/dump-platform-identity.json
```

**Output**:
```json
{
  "toolName": "mcpcontract",
  "toolVersion": "0.14.1",
  "createdAt": "2025-12-15T20:41:32.771Z",
  "splitConfig": {
    "sourceFile": "federation-dump.json",
    "category": "platform-identity",
    "configFile": "split-config.yaml"
  },
  "splitExecution": {
    "originalCounts": {
      "tools": 150,
      "prompts": 0,
      "resources": 0,
      "resourceTemplates": 0
    },
    "filteredCounts": {
      "tools": 45,
      "prompts": 0,
      "resources": 0,
      "resourceTemplates": 0
    },
    "filterRules": [
      {
        "capability": "tools",
        "type": "name-pattern",
        "pattern": "^platform-identity_"
      }
    ]
  }
}
```

This metadata provides:
- **Tool identification**: Which tool performed the split and when
- **Configuration**: Source dump, category, config file, and schema version
- **Execution details**: What was filtered, resulting counts, and exact filter rules applied
- **Complete audit trail**: Two-level provenance (original dump tool → split tool)
- **Original metadata preserved**: Original description, toolName, toolVersion, and dumpExecution fields remain unchanged

The split metadata lives in `dumpExecution` (not a separate field) because schema allows `additionalProperties: true`, making split outputs immediately valid without schema changes.

## Advanced Usage

### Multiple Pattern Matching

Match tools with any of several prefixes:

```yaml
categories:
  - name: "authentication-services"
    outputFile: "dump-auth"
    filters:
      tools:
        # Currently Phase 1 supports one pattern per filter
        # Use regex alternation for multiple patterns
        - type: "name-pattern"
          pattern: "^(platform-identity_|sso-service_|oauth-)"
```

### Overlapping Categories

Tools can match multiple categories - they'll appear in all matching outputs:

```yaml
categories:
  - name: "all-subscription-apis"
    outputFile: "dump-subscriptions"
    filters:
      tools:
        - type: "name-pattern"
          pattern: ".*[Ss]ubscription"
  
  - name: "platform-identity"
    outputFile: "dump-platform-identity"
    filters:
      tools:
        - type: "name-pattern"
          pattern: "^platform-identity_"
```

Tools like `platform-identity_getSubscription` will appear in both outputs. The split command will warn about overlaps.

### YAML Output Format

Generate YAML output instead of JSON:

```bash
mcpcontract split federation-dump.yaml \
  --config split-config.yaml \
  --format yaml \
  --output-dir ./split-yaml
```

### Quiet Mode

Suppress progress messages:

```bash
mcpcontract split federation-dump.json \
  --config split-config.yaml \
  --quiet
```

Useful for scripts and CI/CD pipelines.

## Workflow: Split → Document

Generate separate documentation for each service:

```bash
# 1. Split the dump
mcpcontract split federation-dump.json \
  --config split-config.yaml \
  --output-dir ./split-dumps

# 2. Document each service
mcpcontract document \
  --input split-dumps/dump-platform-identity.json \
  --output docs/platform-identity.md

mcpcontract document \
  --input split-dumps/dump-secure-access-networks.json \
  --output docs/secure-access-networks.md
```

## Workflow: Split → Document

Create service-specific documentation from a federation dump:

```bash
# 1. Split by service
mcpcontract split federation-dump.json \
  --config split-by-service.yaml \
  --output-dir ./by-service

# 2. Generate documentation per service
mcpcontract document \
  --input by-service/dump-platform-identity.json \
  --output docs/platform-identity.md

mcpcontract document \
  --input by-service/dump-secure-access-networks.json \
  --output docs/secure-access-networks.md
```

## Workflow: Compare Service-Specific Changes

Track changes in individual services across versions:

```bash
# Split v1 and v2 dumps
mcpcontract split federation-v1.json \
  --config split-config.yaml \
  --output-dir v1-split

mcpcontract split federation-v2.json \
  --config split-config.yaml \
  --output-dir v2-split

# Compare platform-identity changes
mcpcontract diff \
  --from v1-split/dump-platform-identity.json \
  --to v2-split/dump-platform-identity.json \
  --output diff-platform-identity.json

# Analyze breaking changes
mcpcontract breaking \
  --diff diff-platform-identity.json \
  --output breaking-platform-identity.json

# Generate changelog
mcpcontract changelog \
  --diff diff-platform-identity.json \
  --breaking breaking-platform-identity.json \
  --template release \
  --output CHANGELOG-platform-identity.md
```

## Troubleshooting

### No Matches Found

**Problem**: A category matched 0 tools

**Solutions**:
1. Check pattern syntax (test on regex101.com)
2. Verify tool names in dump match pattern
3. Remove `^` if tools don't start with prefix
4. Add case-insensitive flag: `(?i)^platform` (ECMAScript supports this)

### Invalid Regex Pattern

**Problem**: `Invalid regex pattern in category 'X'`

**Solution**: Fix the regex syntax error shown in message. Common issues:
- Unclosed brackets: `[abc` → `[abc]`
- Unescaped special chars: `service.` → `service\\.`
- Missing closing paren: `(abc` → `(abc)`

### High Unmatched Count

**Problem**: Most tools end up in unmatched file

**Solutions**:
1. Review tool names to find actual patterns
2. Add more categories for common patterns
3. Use broader patterns: `^service-` → `service-`
4. Change unmatchedItems action to `ignore` if acceptable

### Configuration Validation Failed

**Problem**: Split config doesn't validate

**Solution**: Check error message for specific field issues:
- Missing required fields (schemaVersion, info.version, categories)
- Invalid outputFile names (must be alphanumeric + dash/underscore)
- Missing pattern when type is "name-pattern"

## Current Limitations (Phase 1)

**Phase 1** implementation only filters **tools**. The `prompts`, `resources`, and `resourceTemplates` arrays are empty in all split outputs, regardless of the original dump contents.

**Future phases** will extend filtering to all capability types using the same pattern-matching approach.

## Tips and Best Practices

1. **Start with dry-run**: Always preview before creating files
2. **Version your configs**: Track split-config.yaml in version control
3. **Document patterns**: Add `description` to filters for maintainability
4. **Handle unmatched**: Decide strategy (separate-file, warn, or ignore)
5. **Validate outputs**: Use `--validate` flag to catch schema issues early
6. **Test regex patterns**: Use online tools before running split
7. **Monitor overlap warnings**: Review if tools match multiple categories
8. **Consistent naming**: Use clear, descriptive category names

## Related Commands

- [`dump`](./01-basic-dump.md) - Create the initial dump
- [`document`](./02-render-documentation.md) - Generate documentation from split dumps
- [`diff`](./04-comparing-versions.md) - Compare split dumps across versions
- [`validate`](../quick-start.md) - Validate split configurations

## Need Help?

- Check [split-example.md](../examples/split-example.md) for complete working example
- Run `mcpcontract split --help` for quick reference
- See [AGENTS.md](../../AGENTS.md) for AI assistant guidance
- Report issues on GitHub

---

**Next Steps**: After splitting, generate [focused documentation](./02-render-documentation.md) for each category.
