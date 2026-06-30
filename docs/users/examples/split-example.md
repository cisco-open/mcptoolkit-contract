# Split Command Example

This example demonstrates how to split a large MCP federation server dump into focused subsets.

## Input Files

### 1. Federation Dump (`test-federation-dump.json`)

A dump file containing tools from multiple backend services:
- 3 Platform Identity tools (prefixed with `platform-identity_`)
- 3 Secure Access Networks tools (prefixed with `secure-access-networks_`)
- 2 miscellaneous tools from other services

**Total**: 8 tools

### 2. Split Configuration (`split-config-basic.yaml`)

Defines two categories to split the dump:

```yaml
schemaVersion: https://developer.cisco.com/mcpcontract/schema/dump-split/1.0.0

info:
  version: "1.0.0"
  name: "Service-based split"
  description: "Split federation server dump by backend service"
  created: "2025-12-15"

categories:
  - name: "platform-identity"
    description: "Platform Identity APIs"
    outputFile: "dump-platform-identity"
    filters:
      tools:
        - type: "name-pattern"
          pattern: "^platform-identity_"

  - name: "secure-access-networks"
    description: "Secure Access Networks APIs"
    outputFile: "dump-secure-access-networks"
    filters:
      tools:
        - type: "name-pattern"
          pattern: "^secure-access-networks_"

unmatchedItems:
  action: "separate-file"
  outputFile: "dump-unmatched"
```

## Running the Split Command

### Dry Run (Preview)

```bash
mcpcontract split test-federation-dump.json \
  --config split-config-basic.yaml \
  --dry-run
```

**Output**:
```
Validating split configuration: split-config-basic.yaml
✓ Split configuration is valid

Loading dump: test-federation-dump.json
✓ Loaded dump: test-federation-dump.json (8 tools, 0 prompts, 0 resources)
✓ Loaded split config: split-config-basic.yaml (2 categories)

Splitting by category:

  [platform-identity]
  ✓ Matched 3 tools
  [secure-access-networks]
  ✓ Matched 3 tools
  [unmatched]
  ✓ Matched 2 tools

[DRY RUN] Would create the following files:
  - dump-platform-identity (3 tools)
  - dump-secure-access-networks (3 tools)
  - dump-unmatched (2 tools)

Summary:
  Total tools:     8
  Matched:         6 (75.0%)
  Unmatched:       2 (25.0%)
  Output files:    3
```

### Actual Split with Validation

```bash
mcpcontract split test-federation-dump.json \
  --config split-config-basic.yaml \
  --output-dir ./split-output \
  --validate
```

**Output**:
```
Validating split configuration: split-config-basic.yaml
✓ Split configuration is valid

Loading dump: test-federation-dump.json
✓ Loaded dump: test-federation-dump.json (8 tools, 0 prompts, 0 resources)
✓ Loaded split config: split-config-basic.yaml (2 categories)

Splitting by category:

  [platform-identity]
  ✓ Matched 3 tools
  → Writing: ./split-output/dump-platform-identity.json
  [secure-access-networks]
  ✓ Matched 3 tools
  → Writing: ./split-output/dump-secure-access-networks.json
  [unmatched]
  ✓ Matched 2 tools
  → Writing: ./split-output/dump-unmatched.json

Validating output files...
✓ All output files are valid

⚠ 2 tools did not match any category
  Configure unmatchedItems in split config to handle these

Summary:
  Total tools:     8
  Matched:         6 (75.0%)
  Unmatched:       2 (25.0%)
  Output files:    3

✓ Split completed successfully
```

## Output Files

### `dump-platform-identity.json`

Contains only Platform Identity tools:
- `platform-identity_getSubscription`
- `platform-identity_listSubscriptions`
- `platform-identity_updateSubscription`

Includes split metadata:
```json
{
  "x-cisco-metadata": {
    "version": "0.2.0",
    "dump": {
      "splitOperation": {
        "splitConfig": {
          "sourceFile": "test-federation-dump.json",
          "category": "platform-identity",
          "configFile": "split-config-basic.yaml"
        },
        "splitExecution": {
          "originalCounts": {
            "tools": 8,
            "prompts": 0,
            "resources": 0,
            "resourceTemplates": 0
          },
          "filteredCounts": {
            "tools": 3,
            "prompts": 0,
            "resources": 0,
            "resourceTemplates": 0
          }
        }
      }
    }
  }
}
```

### `dump-secure-access-networks.json`

Contains only Secure Access Networks tools:
- `secure-access-networks_jwtLogin`
- `secure-access-networks_getDevices`
- `secure-access-networks_updateDevice`

### `dump-unmatched.json`

Contains tools that didn't match any category:
- `other-service_doSomething`
- `helper_utilityFunction`

## Using Split Dumps with Other Commands

All split dumps are fully compatible with existing mcpcontract commands:

### Generate Documentation
```bash
mcpcontract document \
  --input dump-platform-identity.json \
  --output platform-identity-docs.md
```

### Compare Versions
```bash
# Split v1 and v2 dumps
mcpcontract split dump-v1.json --config split-config.yaml --output-dir v1
mcpcontract split dump-v2.json --config split-config.yaml --output-dir v2

# Compare platform-identity changes
mcpcontract diff \
  --old v1/dump-platform-identity.json \
  --new v2/dump-platform-identity.json \
  --output diff-platform-identity.json
```

## Key Features

1. **Regex-based Filtering**: Use ECMAScript regular expressions for flexible pattern matching
2. **Multiple Categories**: Split into as many categories as needed
3. **Unmatched Items Handling**: Configure what to do with tools that don't match any category
4. **Metadata Preservation**: Original server info and capabilities are preserved in each split
5. **Split Tracking**: Each output includes metadata about the split operation
6. **Format Support**: Works with both JSON and YAML inputs/outputs
7. **Validation**: Optional schema validation of output files

## Phase 1 Limitations

Current implementation (Phase 1) only filters **tools**. Prompts, resources, and resource templates are set to empty arrays in split outputs.

Future phases will extend filtering to all capability types.
