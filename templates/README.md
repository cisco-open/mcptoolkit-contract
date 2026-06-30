# templates/

[Handlebars](https://handlebarsjs.com/) templates used by `mcpcontract document` and `mcpcontract changelog`.

## Document templates

Used with `mcpcontract document --template <name>`:

| File | Template name | Output | Best for |
|---|---|---|---|
| `card-view.html.hbs` | `card-view` | HTML | Interactive browser-rendered documentation with collapsible cards |
| `default-dump.md.hbs` | `mcpdesc-documentation` | Markdown | Readable dump documentation (tools, prompts, resources) |
| `reference-dump.md.hbs` | `reference-documentation` | Markdown | Terse reference format for embedding in wikis |

## Changelog templates

Used with `mcpcontract changelog --format <name>`:

| File | Format name | Best for |
|---|---|---|
| `changelog-release.md.hbs` | `release` | GitHub release notes; full detail with migration guidance |
| `changelog-compact.md.hbs` | `compact` | Quick summaries; one-line per change with icons |
| `changelog-detailed.md.hbs` | `detailed` | _(legacy)_ Verbose per-change breakdown |
| `changelog-summary.md.hbs` | `summary` | _(legacy)_ Short stats-focused summary |
| `changelog-stats.md.hbs` | `stats` | _(legacy)_ Numerical statistics only |

## Custom templates

Pass a path to any `.hbs` file:

```bash
mcpcontract document --template ./my-template.md.hbs dump.yaml
```

Available Handlebars helpers (registered by `src/lib/renderer.ts`): `eq`, `neq`, `and`, `or`, `not`, `contains`, `json`, `yaml`, `markdown`, and `markdownEngine` (swappable via `--markdown-engine`).

## Example

```bash
# Generate HTML docs from a dump
mcpcontract document --template card-view my-server-dump.yaml -o docs.html

# Generate a release changelog
mcpcontract changelog --breaking analysis.json --format release -o CHANGELOG.md
```
