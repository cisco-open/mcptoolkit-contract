# Generating Changelogs from Version Changes

This tutorial shows how to compare two versions of an MCP server and automatically generate human-readable changelogs.

## What You'll Learn

- Compare capability dumps from different versions
- Detect breaking changes using compatibility rules
- Generate changelogs in multiple formats
- Understand semantic versioning recommendations

## Prerequisites

- `mcpcontract` installed and working
- Two capability dumps from different versions of your server

---

## Step 1: Create Two Dumps

Capture your server in two states (e.g., before and after a release):

```bash
# Dump version 1.0.0
mcpcontract dump \
  --url http://localhost:3000/mcp \
  --transport streamable-http \
  --output server-v1.0.0.yaml

# Make changes to your server (deploy v1.1.0)...

# Dump version 1.1.0
mcpcontract dump \
  --url http://localhost:3000/mcp \
  --transport streamable-http \
  --output server-v1.1.0.yaml
```

## Step 2: Generate the Structural Diff

```bash
mcpcontract diff \
  --from server-v1.0.0.yaml \
  --to server-v1.1.0.yaml \
  --output diff.json
```

The diff file lists every detected change with `category`, `changeType`, `path`, and `description` fields. Example shape:

```json
{
  "schemaVersion": "https://developer.cisco.com/mcpcontract/schema/diff/1.0.0",
  "comparison": {
    "from": { "file": "server-v1.0.0.yaml", "serverVersion": "1.0.0" },
    "to":   { "file": "server-v1.1.0.yaml", "serverVersion": "1.1.0" }
  },
  "changes": [
    {
      "category": "tools",
      "changeType": "tool-removed",
      "path": "tools[old-tool]",
      "description": "Tool 'old-tool' was removed"
    }
  ]
}
```

## Step 3: Analyze for Breaking Changes

The diff alone doesn't say whether each change is breaking. The `breaking` command annotates the diff using a YAML rules catalog:

```bash
mcpcontract breaking \
  --diff diff.json \
  --rules rules/breaking-changes.yaml \
  --suggest-version \
  --output analysis.json
```

`--suggest-version` adds a recommended SemVer bump based on the changes.

The analysis adds severity, rationale, and mitigation guidance to each change:

```json
{
  "summary": {
    "totalChanges": 16,
    "breakingChanges": 7,
    "compatibleChanges": 9,
    "status": "BREAKING_CHANGES",
    "exitCode": 1
  },
  "changes": [
    {
      "breaking": true,
      "severity": "critical",
      "message": "Removing a tool is a breaking change",
      "rationale": "Clients expecting the tool will fail",
      "mitigation": "Deprecate the tool first, then remove in next major version"
    }
  ]
}
```

## Step 4: Generate the Changelog

### Option A: Release Format (comprehensive)

Good for GitHub releases and detailed documentation:

```bash
mcpcontract changelog \
  --breaking analysis.json \
  --format release \
  --output CHANGELOG-RELEASE.md
```

You get: breaking-changes section with migration guidance, new-features section, updates section, statistics, and a SemVer recommendation.

### Option B: Compact Format (brief)

Good for quick updates and commit messages:

```bash
mcpcontract changelog \
  --breaking analysis.json \
  --format compact \
  --output CHANGELOG-COMPACT.md
```

You get: one-line summaries with icons, categorized by type (⚠️ breaking, ✨ new, 🔄 updates, 🗑️ removed).

## Step 5: Check Exit Code

```bash
echo $?
```

- **0** — All changes are backward compatible
- **1** — Breaking changes detected
- **2** — Error occurred

---

## Understanding the Change Types

### Breaking Changes (⚠️)

1. **tool-removed** — Removing a tool
2. **parameter-removed** — Removing a required parameter
3. **parameter-made-required** — Making an optional parameter required
4. **parameter-type-changed** — Changing parameter type
5. **prompt-argument-made-required** — Making prompt argument required
6. **resource-removed** — Removing a resource
7. **resource-uri-changed** — Changing resource URI

### Compatible Changes (✅)

1. **tool-added** — Adding a new tool
2. **tool-description-changed** — Updating tool description
3. **parameter-added** (optional) — Adding optional parameter
4. **parameter-description-changed** — Updating parameter description
5. **parameter-made-optional** — Making required parameter optional
6. **prompt-added** — Adding new prompt
7. **prompt-description-changed** — Updating prompt description
8. **resource-added** — Adding new resource
9. **resource-description-changed** — Updating resource description

---

## Advanced: Custom Rules

Use stricter rules for your organization:

```bash
mcpcontract breaking \
  --diff diff.json \
  --rules rules/strict-compatibility.yaml \
  --output analysis.json
```

See the [Rules Catalog Guide](rules-catalog-guide.md) for full details.

---

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Check for Breaking Changes

on:
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install mcpcontract
        run: npm install -g @cisco-open/mcptoolkit-contract

      - name: Capture base version
        run: |
          git checkout main
          npm install && npm start &
          sleep 5
          mcpcontract dump --url http://localhost:3000/mcp \
            --transport streamable-http --output old.yaml
          pkill -f "npm start"

      - name: Capture PR version
        run: |
          git checkout ${{ github.head_ref }}
          npm install && npm start &
          sleep 5
          mcpcontract dump --url http://localhost:3000/mcp \
            --transport streamable-http --output new.yaml

      - name: Check for breaking changes
        run: |
          mcpcontract diff --from old.yaml --to new.yaml --output diff.json
          mcpcontract breaking --diff diff.json --output analysis.json
          if [ $? -eq 1 ]; then
            echo "⚠️ Breaking changes detected!"
            mcpcontract changelog --breaking analysis.json --format compact
            exit 1
          fi
```

---

## Tips & Best Practices

### Version Your Dumps

Keep dumps in a `dumps/` directory:

```
dumps/
├── v1.0.0.yaml
├── v1.1.0.yaml
├── v2.0.0.yaml
└── v2.1.0.yaml
```

### Commit Analysis Files

Track analysis files in git to see breaking changes over time:

```bash
git add analysis.json
git commit -m "docs: Add v1.1.0 breaking-change analysis"
```

### Use Semantic Versioning

Let mcpcontract suggest version bumps:

```bash
mcpcontract breaking --diff diff.json --suggest-version
```

Output:
```
Suggested version: 1.0.0 → 2.0.0 (MAJOR)
Reason: 7 breaking changes detected
```

### Generate Changelogs on Release

Add to your release script:

```bash
#!/bin/bash
VERSION=$1
PREV_VERSION=$2

mcpcontract dump --url http://localhost:3000/mcp --output dump-${VERSION}.yaml
mcpcontract diff --from dump-${PREV_VERSION}.yaml --to dump-${VERSION}.yaml --output diff.json
mcpcontract breaking --diff diff.json --suggest-version --output analysis.json
mcpcontract changelog --breaking analysis.json --format release --output RELEASE-NOTES-${VERSION}.md

echo "Release notes generated: RELEASE-NOTES-${VERSION}.md"
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| No changes detected | Dumps from the same version | Verify the two dumps came from different server versions |
| False positives (changes flagged breaking) | Default rules too strict for your case | Customize rules in `rules/breaking-changes.yaml` |
| Exit code always 0 | `changelog` invoked with `--diff` instead of `--breaking` | Use `--breaking analysis.json` to include severity annotations |

---

## Next Steps

- **Learn about rules**: See [Rules Catalog Guide](rules-catalog-guide.md)
- **Customize rules**: Create your own compatibility rules
- **Automate**: Integrate into your CI/CD pipeline
- **Version tracking**: Maintain a history of capability dumps
