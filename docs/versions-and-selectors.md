# Versions and Selectors User Guide

Applies to the 2.1.0 development CLI. Historical releases retain their documented
behavior. Check your installed CLI's `--help` and release compatibility guidance
before relying on an option or supported selector.

## Which Version Is Which?

An MCP Description always declares its format:

```yaml
mcpdesc: "0.8.0"
info:
  name: example-server
  version: "1.0.0"
protocolVersions:
  - "2026-07-28"
```

`mcpdesc` identifies the document format. `info.version` is the server's version,
and `protocolVersions` lists MCP protocol revisions. None of these is the CLI's
package version.

A selector chooses a particular set of rules within a format, such as
`0.8.0-rev.20261021` or `0.9.0-rc.3`. It does not convert the document to another
format. The required `mcpdesc` property cannot be replaced by a selector or schema.

## How Rules Are Chosen

The CLI chooses rules in this order:

1. An explicit `--selector`, if supplied and supported by the command.
2. The selector associated with an authored, recognized `$schema` URI.
3. The maintained default for the document's declared format.

Neither `$schema` nor `--selector` is required when the format has a supported
default. For example, a schema-less `0.9.0` document uses RC.3 rules with the
current upstream releases. After a dependency upgrade, that default can advance
to a later approved RC or final.

To select rules through the document itself, include a recognized schema URI:

```yaml
$schema: https://mcpdesc.org/schema/mcp-description/0.9.0-rc.3.json
mcpdesc: "0.9.0"
```

This fragment selects RC.3 while supported. An explicit compatible selector wins
over the schema's selection. Unknown schema URIs and disagreements across format
versions are errors, even with an explicit selector.

### The Shared 0.8.0 Schema

The canonical `0.8.0.json` schema URI is shared by the original `0.8.0` selector
and maintained `0.8.0-rev.20261021`. It selects the maintained revision. To retain
the original behavior, explicitly request `--selector 0.8.0` in a CLI release
that supports it.

## What Commands Do

| Command | Meaning of selection |
| --- | --- |
| `validate` | Check the input under its selected rules. |
| `document`, `project`, `split` | Process the input under its selected rules, without silently migrating it. |
| `diff`, `compare` | Resolve each input separately; an explicit selector must work for both inputs. |
| `dump`, `convert` | Choose rules for a newly generated document's output format. |
| `migrate` | Choose a destination format; `--selector` pins destination rules. Source rules are resolved separately. |

Not every operation supports every format or selector. In particular, validation
support does not guarantee native projection support. Cross-format comparison
also requires command support; otherwise migrate explicitly before comparing.

`--protocol-version` chooses an MCP protocol revision, not an mcpdesc selector.
JSON/YAML output options choose serialization, not the mcpdesc format version.

`breaking`, `changelog`, and `rules` concern the CLI's separate compatibility
analysis artifacts and catalog; they do not select mcpdesc validation rules.
`completion` and `agents` describe the CLI and do not resolve input documents.

## Stable Output by Default

New documents default to stable `0.8.0` until final `0.9.0` is adopted as latest
stable by the CLI. Requesting output format `0.9.0` instead uses its maintained
default, currently RC.3, unless an exact supported selector is requested.

Use `--to-version` on `dump`, `convert`, and `migrate` to choose the output format:

```bash
# Stable output by default
mcpcontract convert legacy.json --output stable.yaml
# Opt into 0.9.0 using its maintained default (currently RC.3)
mcpcontract convert legacy.json --to-version 0.9.0 --output preview.yaml
# Pin exact preview rules as well as choosing the format
mcpcontract dump --config mcp.json --to-version 0.9.0 \
  --selector 0.9.0-rc.3 --output preview.yaml
```

`migrate --to-version 0.9.0` expresses a format upgrade. A selector alone is not
a migration request. A `0.9.0` input must never be silently downgraded because
the default destination is still `0.8.0`.

Reading or splitting a document preserves its authored identity. Generated or
migrated schema identities reflect destination rules, with schema omission
preserved where the conversion contract requires it. Reports identify the rules
actually used and whether selection was explicit, schema-derived, or default.

## Compatibility and Reproducibility

CLI support is intentionally narrower than the underlying libraries. A new CLI
release may retire drafts and RCs after final is available. Use a matching older
CLI release when those rules are needed; a recognized URI does not guarantee
continued support. Unsupported selections fail rather than silently adopting
different rules.

This CLI supports original `0.8.0`, its maintained revision, and the `0.9.0`
maintained default (currently RC.3). Drafts and earlier RCs are retired by the
current upstream packages; use a matching historical CLI to reproduce them.
Native projection requires `0.9.0`.

Pin the CLI version in automation. Add an explicit selector when exact rule
behavior matters, particularly when a schema URI is shared. Local historical
`0.7.0` validation and supported migration paths remain separate from upstream
modern-format support.

For shared-identity resolution, upstream `schemaPins` behavior, command contracts,
and retirement rationale, read the
[maintainer design](maintainers/design/versions-and-selectors.md).
