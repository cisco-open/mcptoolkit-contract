# rules/

Compatibility rules used by `mcpcontract breaking` to classify diff changes as breaking or non-breaking.

## Files

| File / directory | Purpose |
|---|---|
| `breaking-changes.yaml` | **Default rules** — 35 rules across 5 categories (tools, prompts, resources, resourceTemplates, serverInfo). Ships with the CLI. |
| `strict-compatibility.yaml` | Example of stricter custom rules (treats enum additions as breaking). |
| `catalog/` | Human-readable documentation for each default rule (33 catalog entries in YAML). Browseable via `mcpcontract rules list`. |
| `strict-compatibility-catalog/` | Catalog documenting the strict-compatibility example rules. |

## Rule categories

Each rules file groups rules under five top-level keys:
- `tools` — tool additions, removals, parameter changes, schema changes
- `prompts` — prompt additions, removals, argument changes
- `resources` — resource additions, removals, URI changes
- `resourceTemplates` — template additions, removals, URI template changes
- `serverInfo` — server name/version changes

## Using custom rules

```bash
# Run breaking-change analysis with your own rules
mcpcontract breaking --diff diff.json --rules rules/my-rules.yaml --output analysis.json

# Browse the default catalog
mcpcontract rules list

# Browse a custom catalog
mcpcontract rules list --catalog rules/my-rules-catalog
```

## Writing rules

Each rule entry has:

```yaml
tools:
  - changeType: tool-removed      # matches diff changeType field
    breaking: true                # true = breaking, false = compatible
    severity: critical            # critical | major | minor | info
    message: "Removing a tool is a breaking change"
    rationale: "Clients expecting the tool will fail"
    mitigation: "Deprecate first, then remove in next major version"
```

For the full list of supported `changeType` values, run `mcpcontract rules list`.

## Catalog structure

`catalog/` contains one YAML file per rule, organized into subdirectories by category. Each entry follows `catalog/catalog-schema.json`. Auto-generated tests in `tests/unit/catalog-generated.test.ts` validate every catalog example.
