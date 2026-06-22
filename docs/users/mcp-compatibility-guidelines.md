# MCP Compatibility Guidelines

**Version**: 1.0.0  
**Last Updated**: 2025-11-26

## Purpose

This document defines backward compatibility expectations for MCP (Model Context Protocol) servers and clients, establishing a contract that enables safe schema evolution while maintaining interoperability.

---

## Guiding Principles

### 1. Postel's Law (Robustness Principle)

> **"Be conservative in what you send, be liberal in what you accept"**

**For MCP Servers**:
- Strictly validate your own output
- Accept and gracefully handle unexpected input from clients
- Ignore unknown parameters rather than failing

**For MCP Consumers (Clients)**:
- Handle unknown values in enums gracefully
- Ignore unknown capabilities, tools, resources, and prompts
- Don't assume exhaustive knowledge of server capabilities

### 2. Open-World Assumption

MCP operates under an **open-world assumption**:
- The schema can evolve over time
- New capabilities, tools, and values can be added
- Clients discover capabilities at runtime via introspection
- Unknown elements should be ignored, not rejected

### 3. Semantic Versioning Alignment

Version bumps should follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html):

- **MAJOR** (X.0.0): Breaking changes that require client updates
- **MINOR** (0.X.0): New capabilities added (backward compatible)
- **PATCH** (0.0.X): Bug fixes, documentation updates

---

## Backward Compatibility Rules

### Adding Capabilities (Compatible ✅)

#### Safe Additions:
- ✅ Adding new tools
- ✅ Adding new prompts  
- ✅ Adding new resources
- ✅ Adding new resource templates
- ✅ Adding optional parameters to existing tools
- ✅ Adding enum values to parameters
- ✅ Adding capabilities (e.g., notifications support)
- ✅ Making required parameters optional

**Rationale**: Clients ignore unknown elements and only use capabilities they understand.

**Version Bump**: MINOR (0.X.0)

---

### Removing Capabilities (Breaking ⚠️)

#### Breaking Removals:
- ⚠️ Removing tools
- ⚠️ Removing prompts
- ⚠️ Removing resources
- ⚠️ Removing enum values from parameters
- ⚠️ Removing parameters (if clients depend on them)
- ⚠️ Making optional parameters required
- ⚠️ Disabling capabilities (e.g., turning off notifications)

**Rationale**: Clients using removed features will experience errors.

**Version Bump**: MAJOR (X.0.0)

**Best Practice**: Deprecate features first, maintain for at least one major version, then remove.

---

### Enum Value Handling

#### Enum Additions (Compatible ✅)

Adding enum values is **backward compatible** under MCP's design philosophy:

```yaml
# v1.0.0
enum: ["API", "SDK", "GROUP"]

# v1.1.0 - MINOR version bump
enum: ["API", "SDK", "MCP", "GROUP"]
```

**Why this is safe**:
1. **Clients don't enumerate exhaustively**: MCP clients should not assume they know all possible values
2. **Unknown values are ignored**: Well-designed clients handle unexpected enum values gracefully
3. **Server-driven discovery**: Clients discover available options through server capabilities
4. **Forward compatibility**: Older clients continue working with known values

**Client Implementation Pattern**:
```javascript
// ✅ GOOD: Defensive enum handling
function handleKind(kind) {
  switch (kind) {
    case 'API':
      return handleAPI();
    case 'SDK':
      return handleSDK();
    case 'GROUP':
      return handleGroup();
    default:
      // Gracefully handle unknown values
      console.warn(`Unknown kind: ${kind}, treating as generic`);
      return handleGeneric();
  }
}

// ❌ BAD: Strict validation that breaks on new values
function validateKind(kind) {
  const allowed = ['API', 'SDK', 'GROUP'];
  if (!allowed.includes(kind)) {
    throw new Error(`Invalid kind: ${kind}`);  // Breaks on new values!
  }
}
```

#### Enum Removals (Breaking ⚠️)

Removing enum values is **breaking**:

```yaml
# v1.0.0
enum: ["API", "SDK", "LEGACY", "GROUP"]

# v2.0.0 - MAJOR version bump required
enum: ["API", "SDK", "GROUP"]  # Removed "LEGACY"
```

**Why this breaks clients**:
- Clients sending the removed value will fail validation
- Requires code changes to migrate away from removed values

**Migration Path**:
1. Document deprecation in v1.X
2. Add warnings/errors when deprecated value is used
3. Remove in v2.0.0 with clear upgrade guide

---

## Change Type Classification

### Parameter Changes

| Change Type | Compatible? | Severity | Version Bump |
|-------------|------------|----------|--------------|
| Add optional parameter | ✅ Yes | info | MINOR |
| Add required parameter | ⚠️ No | critical | MAJOR |
| Remove unused parameter | ✅ Yes* | info | MINOR |
| Remove used parameter | ⚠️ No | critical | MAJOR |
| Change parameter type | ⚠️ No | critical | MAJOR |
| Make parameter optional | ✅ Yes | info | MINOR |
| Make parameter required | ⚠️ No | critical | MAJOR |
| Add enum values | ✅ Yes | info | MINOR |
| Remove enum values | ⚠️ No | critical | MAJOR |
| Change description | ✅ Yes | info | PATCH |

\* Only if server ignores unknown parameters

### Tool Changes

| Change Type | Compatible? | Severity | Version Bump |
|-------------|------------|----------|--------------|
| Add tool | ✅ Yes | info | MINOR |
| Remove tool | ⚠️ No | critical | MAJOR |
| Rename tool | ⚠️ No | critical | MAJOR |
| Change description | ✅ Yes | info | PATCH |

### Resource Changes

| Change Type | Compatible? | Severity | Version Bump |
|-------------|------------|----------|--------------|
| Add resource | ✅ Yes | info | MINOR |
| Remove resource | ⚠️ No | major | MAJOR |
| Change URI | ⚠️ No | critical | MAJOR |
| Change MIME type | ⚠️ No | major | MAJOR |
| Change description | ✅ Yes | info | PATCH |

---

## Customizing Rules

Teams with **stricter compatibility requirements** can customize the rules by creating a custom rules file:

### Example: Strict Enum Policy

```yaml
# rules/strict-compatibility.yaml
version: "1.0.0"
description: "Strict compatibility rules - treat enum additions as breaking"

rules:
  tools:
    - changeType: "parameter-enum-values-changed"
      breaking: true
      severity: "major"
      message: "Any enum change is considered breaking in strict mode"
      rationale: "Our clients use strict validation and cannot handle new enum values"
```

**Usage**:
```bash
mcpcontract breaking \
  --diff diff.json \
  --rules rules/strict-compatibility.yaml \
  --output analysis.json
```

---

## Testing for Compatibility

### Automated Testing

```bash
# 1. Generate dumps from two versions
mcpcontract dump --config server-v1.yaml --output dump-v1.json
mcpcontract dump --config server-v2.yaml --output dump-v2.json

# 2. Compare and analyze
mcpcontract diff --from dump-v1.json --to dump-v2.json --output diff.json
mcpcontract breaking --diff diff.json --output analysis.json

# 3. Check exit code
# Exit code 0 = backward compatible (safe for MINOR/PATCH)
# Exit code 1 = breaking changes detected (requires MAJOR)
```

### CI/CD Integration

```yaml
# .github/workflows/compatibility-check.yml
name: Compatibility Check

on: [pull_request]

jobs:
  check-compatibility:
    runs-on: ubuntu-latest
    steps:
      - name: Check for breaking changes
        run: |
          mcpcontract diff --from main-dump.json --to pr-dump.json --output diff.json
          mcpcontract breaking --diff diff.json --output analysis.json
          
          # Fail PR if breaking changes detected without version bump
          if [ $? -eq 1 ]; then
            echo "⚠️ Breaking changes detected - MAJOR version bump required"
            exit 1
          fi
```

---

## References

- [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html)
- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [Postel's Law (RFC 1122)](https://datatracker.ietf.org/doc/html/rfc1122#page-12)
- [JSON Schema Evolution](https://json-schema.org/understanding-json-schema/reference/generic.html#annotations)

---

## Changelog

### v1.0.0 (2025-11-26)
- Initial release
- Defined enum addition as compatible
- Established Postel's Law as guiding principle
- Documented open-world assumption for MCP
