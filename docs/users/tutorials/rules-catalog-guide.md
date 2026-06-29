# Rules Catalog Tutorial - Complete Guide

**Level**: Beginner to Advanced  
**Time**: 30 minutes  
**Version**: 0.9.0+

## Overview

This tutorial provides a complete end-to-end guide to using the `mcpcontract rules` command to browse, explore, and customize MCP backward compatibility rules. You'll learn how to:

1. **Browse the default catalog** - Explore the 33 built-in compatibility rules
2. **Filter and search rules** - Find specific rules by category, severity, or type
3. **View detailed documentation** - Understand rule rationale and migration guidance
4. **Explore test examples** - See pass/fail test cases for each rule
5. **Use custom catalogs** - Browse team-specific rules with severity comparison
6. **Export documentation** - Generate team reference materials
7. **Validate catalogs** - Ensure custom catalogs follow the schema

## Prerequisites

- mcpcontract CLI installed (version 0.9.0 or later)
- Basic understanding of MCP (Model Context Protocol)
- Terminal/command line access

**Installation**:
```bash
# Install from npm (recommended)
npm install -g @cisco_open/mcptoolkit-contract

# Or clone and build from source
git clone https://github.com/cisco-open/mcptoolkit-contract.git
cd mcptoolkit-contract
npm install
npm run build
npm install -g .
```

**Verify installation**:
```bash
mcpcontract --version
# Should output: 0.9.0 or later
```

## Part 1: Exploring the Default Catalog

### Step 1: List All Rules

The default catalog contains 33 backward compatibility rules across 5 categories.

```bash
mcpcontract rules list
```

**Output**:
```
📋 Rules Catalog

📂 Catalog: rules/catalog (default)
📜 Rules File: rules/breaking-changes.yaml
📊 Total Rules: 34

================================================================================
Category: PROMPTS
================================================================================

🟢 COMPATIBLE prompt-added
  Prompt Added
  Variants: 1 (0 breaking, 1 compatible)
  Severity: info
  Detects when a new prompt is added to an MCP server. Adding prompts is...

🔴 BREAKING prompt-argument-added
  Prompt Argument Added
  Variants: 2 (1 breaking, 1 compatible)
  Severity: info|major
  Detects when a new argument is added to a prompt. Compatibility depend...

[... more rules ...]
```

**What you see**:
- 🟢 = Compatible change (won't break clients)
- 🔴 = Breaking change (may break clients)
- **Variants**: Some rules have multiple variants with different conditions
- **Severity**: `info` (low), `major` (moderate), `critical` (high)

### Step 2: Filter by Category

Focus on a specific MCP category:

```bash
# View only tool-related rules
mcpcontract rules list --category tools

# View only prompt-related rules
mcpcontract rules list --category prompts

# View only resource-related rules
mcpcontract rules list --category resources
```

**Available categories**:
- `tools` - Tool additions, removals, parameter changes (12 rules)
- `prompts` - Prompt changes and argument modifications (8 rules)
- `resources` - Resource URI and content changes (6 rules)
- `resourceTemplates` - Resource template changes (3 rules)
- `serverInfo` - Server capability and protocol changes (5 rules)

### Step 3: Filter by Severity

Find high-priority rules:

```bash
# Show only critical breaking changes
mcpcontract rules list --severity critical

# Show major severity issues
mcpcontract rules list --severity major

# Show informational changes
mcpcontract rules list --severity info
```

### Step 4: Show Only Breaking Rules

Focus on changes that break backward compatibility:

```bash
# Show all breaking rules
mcpcontract rules list --breaking

# Combine filters: breaking + critical + tools
mcpcontract rules list --breaking --severity critical --category tools
```

### Step 5: JSON Output for Scripting

Export as JSON for programmatic processing:

```bash
# Get all rules as JSON
mcpcontract rules list --format json > all-rules.json

# Filter and export
mcpcontract rules list --category tools --breaking --format json > breaking-tools.json
```

## Part 2: Viewing Rule Documentation

### Step 6: Show Detailed Documentation

Each rule has comprehensive documentation including rationale, migration guidance, and examples.

```bash
# View documentation for parameter-added rule
mcpcontract rules show parameter-added
```

**Output**:
```
================================================================================
📋 Parameter Added
================================================================================

Change Type: parameter-added
Category: tools
Version: 1.0.0
Introduced: v0.5.0
Rules File: rules/breaking-changes.yaml

Description:
Detects when a new parameter is added to a tool. Compatibility depends on
whether the new parameter is optional or required.

Variants: 2

────────────────────────────────────────────────────────────────────────────────
Variant 1: parameter-added-optional
────────────────────────────────────────────────────────────────────────────────

Status: 🟢 COMPATIBLE
Severity: ℹ️ info
Message: Adding an optional parameter is backward compatible

Rationale:
Old clients don't send the new parameter, and the server uses its default value.
This allows servers to extend tool capabilities while maintaining compatibility.

The server must handle the absence of the parameter gracefully.

Migration Guidance:
null

Conditions:
  - to.required equals false

Examples: 1 pass, 1 fail

────────────────────────────────────────────────────────────────────────────────
Variant 2: parameter-added-required
────────────────────────────────────────────────────────────────────────────────

Status: 🔴 BREAKING
Severity: 🔥 critical
Message: Adding a required parameter breaks existing clients

Rationale:
Old clients don't send the required parameter and will fail validation.
This is a breaking change that forces all clients to update their code.

Migration Guidance:
To add a required parameter safely:
1. Add as optional parameter first (MINOR version)
2. Update documentation showing it will become required
3. Give clients time to adopt (at least one major version cycle)
4. Make it required in next MAJOR version

Alternative: Create a new tool version (e.g., send_email_v2).

Conditions:
  - to.required equals true

Examples: 1 pass, 1 fail

Related Rules:
  - parameter-removed
  - parameter-made-required
  - prompt-argument-added

References:
  - JSON Schema - Required Properties: https://json-schema.org/understanding-json-schema/reference/object.html#required-properties
  - API Evolution Best Practices: https://cloud.google.com/apis/design/compatibility

Tags: parameters, additions, required-vs-optional, schema-evolution

================================================================================

💡 Use 'mcpcontract rules examples parameter-added' to see examples
```

### Step 7: Explore Common Rules

**Key rules to understand**:

```bash
# Enum value changes (MCP treats additions as compatible)
mcpcontract rules show parameter-enum-values-changed

# Tool and prompt removals (always breaking)
mcpcontract rules show tool-removed
mcpcontract rules show prompt-removed

# Parameter type changes (breaking)
mcpcontract rules show parameter-type-changed

# Resource URI changes (breaking - clients use URIs directly)
mcpcontract rules show resource-uri-changed
```

## Part 3: Viewing Test Examples

### Step 8: View Pass/Fail Examples

Each rule variant includes test examples showing what changes match the rule.

```bash
# View examples for parameter-added rule
mcpcontract rules examples parameter-added
```

**Output**:
```
================================================================================
📝 Examples: parameter-added
================================================================================

Variant: parameter-added-optional
Status: 🟢 COMPATIBLE (info)

✅ PASS Examples (should match this variant):

  1. Optional parameter added
     Adding an optional parameter is compatible

     Change:
     {
       "id": "550e8400-e29b-41d4-a716-446655440005",
       "category": "tools",
       "changeType": "parameter-added",
       "path": "tools[get_weather].parameters.properties.units",
       "description": "Optional parameter 'units' added",
       "to": {
         "required": false,
         "type": "string",
         "enum": ["celsius", "fahrenheit"]
       }
     }

     Expected Result:
     {
       "breaking": false,
       "severity": "info",
       "matchesThisVariant": true
     }

❌ FAIL Examples (should NOT match this variant):

  1. Required parameter should not match
     Required parameters should match different variant

     Change:
     {
       "id": "550e8400-e29b-41d4-a716-446655440006",
       "category": "tools",
       "changeType": "parameter-added",
       "path": "tools[send_email].parameters.properties.to",
       "description": "Required parameter 'to' added",
       "to": {
         "required": true,
         "type": "string"
       }
     }

     Expected Result:
     {
       "breaking": true,
       "severity": "critical",
       "matchesThisVariant": false
     }

[... more variants and examples ...]
```

### Step 9: Filter Examples by Variant

Some rules have multiple variants. View examples for a specific variant:

```bash
# Show only enum additions variant
mcpcontract rules examples parameter-enum-values-changed --variant enum-additions-only

# Show only required parameter variant
mcpcontract rules examples parameter-added --variant parameter-added-required
```

## Part 4: Using Custom Catalogs

Custom catalogs allow teams to define their own compatibility rules with different severities or conditions.

### Step 10: Browse a Custom Catalog

The toolkit includes an example strict compatibility catalog:

```bash
# List rules from strict catalog (shows severity comparison)
mcpcontract rules list --catalog rules/strict-compatibility-catalog
```

**Output**:
```
📋 Rules Catalog

📂 Catalog: rules/strict-compatibility-catalog (custom)
📜 Rules File: rules/breaking-changes.yaml
📊 Total Rules: 1

================================================================================
Category: TOOLS
================================================================================

🔴 BREAKING parameter-enum-values-changed
  Parameter Enum Values Changed (Strict Mode)
  Variants: 1 (1 breaking, 0 compatible)
  Severity: major (default: info|critical)  ← COMPARISON WITH DEFAULT!
  STRICT MODE: In strict compatibility mode, ANY change to enum values...
```

**Key difference**: Notice `Severity: major (default: info|critical)`
- **Custom catalog**: Treats enum changes as `major` breaking
- **Default catalog**: Treats additions as `info` compatible, removals as `critical` breaking

### Step 11: Understand Severity Comparison

The severity comparison shows how your custom rules differ from MCP defaults:

```
Severity: major (default: info|critical)
          ^^^^^           ^^^^^^^^^^^^^^^
          Your custom     Default MCP
          catalog         catalog
```

**Why this matters**:
- **Default MCP**: Follows Postel's Law - "be liberal in what you accept"
  - Enum additions = Compatible (clients should ignore unknown values)
  - Enum removals = Breaking (clients using removed values fail)
  
- **Strict Mode**: More conservative approach
  - ANY enum change = Breaking (requires explicit approval)
  - Useful for regulated environments or strict validation requirements

### Step 12: View Custom Catalog Documentation

```bash
# Show documentation from strict catalog
mcpcontract rules show parameter-enum-values-changed \
  --catalog rules/strict-compatibility-catalog
```

**Output shows**:
- Custom rationale explaining strict mode philosophy
- Migration guidance specific to strict environments
- Examples demonstrating strict validation

### Step 13: Catalog Auto-Discovery

The toolkit automatically discovers catalogs based on naming convention:

```bash
# Using custom rules file (auto-discovers catalog)
mcpcontract rules list --rules rules/strict-compatibility.yaml

# Auto-discovers: rules/strict-compatibility-catalog/
# Convention: {basename}-catalog/
```

**Discovery pattern**:
```
rules/breaking-changes.yaml → rules/catalog/
rules/strict-compatibility.yaml → rules/strict-compatibility-catalog/
rules/my-team-rules.yaml → rules/my-team-rules-catalog/
```

## Part 5: Creating a Custom Catalog (Advanced)

### Step 14: Custom Catalog Structure

Create your own catalog following the convention:

```bash
# Directory structure
rules/
├── my-team-rules.yaml                # Your custom rules
└── my-team-rules-catalog/            # Catalog documentation
    ├── catalog-schema.json           # Copy from rules/catalog/
    └── tools/                        # Category subdirectories
        ├── custom-rule-1.yaml
        └── custom-rule-2.yaml
```

**Example custom catalog entry** (`rules/my-team-rules-catalog/tools/my-custom-rule.yaml`):

```yaml
changeType: my-custom-rule
category: tools
version: 1.0.0
introduced: 1.0.0
rulesFile: rules/my-team-rules.yaml
title: My Custom Rule
description: |
  Custom compatibility rule for our team's specific requirements.

variants:
  - id: my-custom-rule-variant
    breaking: true
    severity: major
    message: Custom rule violated
    rationale: |
      Our team requires explicit approval for this type of change.
    migration: |
      Follow team change control process.
    examples:
      pass:
        - name: Example that matches rule
          description: Description of scenario
          change:
            id: "550e8400-e29b-41d4-a716-446655440000"
            category: tools
            changeType: my-custom-rule
            path: tools[example].property
            description: "Example change"
          expectedResult:
            breaking: true
            severity: major
            matchesThisVariant: true

relatedRules: []
references: []
tags:
  - custom
  - team-specific
```

### Step 15: Validate Custom Catalog

Ensure your catalog follows the schema:

```bash
# Validate catalog structure
mcpcontract rules validate --catalog rules/my-team-rules-catalog
```

**Output**:
```
================================================================================
🔍 Validating Catalog
================================================================================

Rules File: rules/breaking-changes.yaml
Catalog Directory: rules/my-team-rules-catalog
Custom Catalog: Yes

✅ Validation Passed

   Schema: ✓ All entries valid
   Completeness: ✓ All rules documented
```

**Validation checks**:
- ✅ All YAML files valid
- ✅ Follow catalog-schema.json structure
- ✅ All changeTypes from rules file have catalog entries
- ✅ No orphaned catalog entries
- ✅ Examples have valid structure

### Step 16: Export Custom Catalog Documentation

Generate team reference documentation:

```bash
# Export as Markdown (for wikis, docs sites)
mcpcontract rules export \
  --catalog rules/my-team-rules-catalog \
  --format markdown \
  --output docs/TEAM_COMPATIBILITY_RULES.md

# Export as JSON (for programmatic processing)
mcpcontract rules export \
  --catalog rules/my-team-rules-catalog \
  --format json \
  --output team-rules.json

# Export summary without examples (smaller file)
mcpcontract rules export \
  --catalog rules/my-team-rules-catalog \
  --format json \
  --summary \
  --output team-rules-summary.json
```

## Part 6: Real-World Workflows

### Workflow 1: Understanding a Breaking Change

You've detected a breaking change and want to understand why:

```bash
# 1. List breaking rules in the category
mcpcontract rules list --category tools --breaking

# 2. Find your specific change type (e.g., parameter-type-changed)
mcpcontract rules show parameter-type-changed

# 3. View examples to confirm
mcpcontract rules examples parameter-type-changed

# 4. Review migration guidance in documentation
# (Shown in the 'show' command output)
```

### Workflow 2: Comparing Default vs Strict Catalogs

Your team is considering strict mode and wants to see differences:

```bash
# 1. View default catalog rule
mcpcontract rules show parameter-enum-values-changed

# 2. View strict catalog rule
mcpcontract rules show parameter-enum-values-changed \
  --catalog rules/strict-compatibility-catalog

# 3. Compare side-by-side
mcpcontract rules list --category tools | grep "parameter-enum"
mcpcontract rules list --category tools --catalog rules/strict-compatibility-catalog | grep "parameter-enum"

# Output comparison:
# Default: Severity: info|critical (2 variants: additions=compatible, removals=breaking)
# Strict:  Severity: major (default: info|critical) (1 variant: ANY change=breaking)
```

### Workflow 3: Creating Team Documentation

Generate comprehensive team compatibility guide:

```bash
# 1. Export default rules as baseline
mcpcontract rules export --format markdown --output docs/MCP_COMPATIBILITY_BASELINE.md

# 2. Export team custom rules
mcpcontract rules export \
  --catalog rules/team-rules-catalog \
  --format markdown \
  --output docs/TEAM_COMPATIBILITY_RULES.md

# 3. Create diff to highlight differences
diff docs/MCP_COMPATIBILITY_BASELINE.md docs/TEAM_COMPATIBILITY_RULES.md

# 4. Share with team via wiki or docs site
```

### Workflow 4: CI/CD Integration

Validate custom catalogs in CI pipeline:

```bash
#!/bin/bash
# .github/workflows/validate-rules.sh

set -e

echo "Validating custom rules catalog..."
mcpcontract rules validate --catalog rules/team-rules-catalog

if [ $? -eq 0 ]; then
  echo "✅ Catalog validation passed"
  exit 0
else
  echo "❌ Catalog validation failed"
  exit 1
fi
```

## Part 7: Best Practices

### Naming Conventions

**Rules Files**:
```
✅ Good:
  rules/breaking-changes.yaml         (default)
  rules/strict-compatibility.yaml     (descriptive)
  rules/team-policies.yaml            (clear purpose)

❌ Avoid:
  rules/rules.yaml                    (redundant)
  rules/v1.yaml                       (version in name)
  my-rules.yaml                       (outside rules/ directory)
```

**Catalog Directories**:
```
✅ Good:
  rules/catalog/                      (default)
  rules/strict-compatibility-catalog/ (matches rules file)
  rules/team-policies-catalog/        (matches rules file)

❌ Avoid:
  rules/docs/                         (unclear purpose)
  rules/strict-catalog/               (doesn't match rules file naming)
```

### Severity Guidelines

Choose appropriate severity levels:

| Severity | When to Use | Example |
|----------|-------------|---------|
| `info` | Informational, compatible changes | Description updates, optional parameter additions |
| `major` | Significant but manageable changes | Deprecations, capability additions |
| `critical` | Breaking changes requiring immediate action | Required parameter additions, tool removals |

### Catalog Maintenance

**Keep catalogs in sync**:
1. When adding a rule to YAML, create matching catalog entry
2. Run `mcpcontract rules validate` before committing
3. Version catalog entries with rules file versions
4. Document migration paths for breaking changes

**Update frequency**:
- Review catalog quarterly for accuracy
- Update examples when edge cases discovered
- Enhance rationale based on team feedback
- Cross-reference with MCP spec updates

## Summary

You've learned how to:

✅ Browse and filter the default rules catalog  
✅ View detailed documentation for specific rules  
✅ Explore pass/fail test examples  
✅ Use custom catalogs with severity comparison  
✅ Validate custom catalog structure  
✅ Export rules as documentation  
✅ Integrate rules into team workflows  

## Next Steps

- **Apply to real projects**: Run `mcpcontract diff` and `breaking` on your MCP server versions
- **Create team catalog**: Document your team's custom compatibility rules
- **Integrate with CI/CD**: Add catalog validation to your pipeline
- **Share with team**: Export and publish your team's compatibility guidelines

## Troubleshooting

### Issue: "Catalog directory does not exist"

```bash
⚠️  Specified catalog directory does not exist: rules/my-catalog
   Falling back to auto-discovery.
```

**Solution**: Verify directory path and ensure it contains `catalog-schema.json`

### Issue: Catalog validation fails

```bash
❌ Validation Failed

Errors:
  [schema] rules/my-catalog/tools/rule.yaml
    Schema validation failed: missing required property 'changeType'
```

**Solution**: Check catalog entry against `catalog-schema.json`, ensure all required fields present

### Issue: No severity comparison shown

**Expected**: `Severity: major (default: info|critical)`  
**Actual**: `Severity: major`

**Solution**: This is normal when:
- Using default catalog (no comparison needed)
- Severities are identical between custom and default
- Default catalog entry doesn't exist for this changeType

## Additional Resources

- [MCP Compatibility Guidelines](../build/implementation/16-MCP-COMPATIBILITY-GUIDELINES.md) - Philosophy and best practices
- [Rules Catalog Implementation](../build/implementation/17-rules-catalog.md) - Technical documentation
- [Custom Catalog Implementation](../build/implementation/19-custom-catalog.md) - Implementation details
- [CHANGELOG.md](../../CHANGELOG.md) - Version history and feature additions

## Feedback

Have questions or suggestions for this tutorial? Open an issue or contribute improvements!
