# Versions and Selectors User Guide

Applies to the 2.1.0 development CLI. Historical releases retain their documented
behavior. Check your installed CLI's `--help` and release compatibility guidance
before relying on an option or supported selector.

## Which Version Is Which?

An MCP Description always declares its format:

```yaml
mcpdesc: "0.9.0"
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
`0.8.0-rev.20261021` or `0.9.0`. It does not convert the document to another
format. The required `mcpdesc` property cannot be replaced by a selector or schema.

## How Rules Are Chosen

The CLI chooses rules in this order:

1. An explicit `--selector`, if supplied and supported by the command.
2. The selector associated with an authored, recognized `$schema` URI.
3. The maintained default for the document's declared format.

Neither `$schema` nor `--selector` is required when the format has a supported
default. A schema-less `0.9.0` document uses the stable `0.9.0` rules.

To select rules through the document itself, include a recognized schema URI:

```yaml
$schema: https://mcpdesc.org/schema/mcp-description/0.9.0.json
mcpdesc: "0.9.0"
```

This fragment selects stable 0.9.0 rules. An explicit compatible selector wins
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
| `dump` | Choose rules for a newly generated document's output format. |
| `convert` | Show historical CLI guidance only; no conversion is performed. |
| `migrate` | Upgrade to the installed CLI's maintained destination; `--selector` pins destination rules. Source rules are resolved separately. |

Not every operation supports every format or selector. In particular, validation
support does not guarantee native projection support. Cross-format comparison
also requires command support; otherwise migrate explicitly before comparing.

`--protocol-version` chooses an MCP protocol revision, not an mcpdesc selector.
JSON/YAML output options choose serialization, not the mcpdesc format version.

`breaking`, `changelog`, and `rules` concern the CLI's separate compatibility
analysis artifacts and catalog; they do not select mcpdesc validation rules.
`completion` and `agents` describe the CLI and do not resolve input documents.

## Output and Migration Defaults

New dumps and `migrate` default to stable `0.9.0`. Use `--to-version 0.8.0` to
explicitly emit the previous stable format.

Use `--to-version` on `dump` to choose the output format:

```bash
# Stable 0.9.0 output by default
mcpcontract dump --config mcp.json --output stable.yaml
# Explicitly emit the previous stable format
mcpcontract dump --config mcp.json --to-version 0.8.0 --output previous.yaml
# Migrate 0.8.0 input to stable 0.9.0
mcpcontract migrate previous.yaml --output stable.yaml
```

Running `migrate` expresses an upgrade to the installed CLI's maintained
destination. A selector pins its rules, not a different format. `migrate` no
longer accepts `--to-version`; omit it to use the maintained target. A `0.9.0` input is validated
under source and destination rules and reported unchanged; no conversion
between stable specification snapshots is inferred.

Reading or splitting a document preserves its authored identity. Generated or
migrated schema identities reflect destination rules, with schema omission
preserved where the conversion contract requires it. Reports identify the rules
actually used and whether selection was explicit, schema-derived, or default.

## Compatibility and Reproducibility

CLI support is intentionally narrower than the underlying libraries. This CLI
supports stable 0.9.0 and retires draft and RC identities. Use a matching older
CLI release when those rules are needed; a recognized URI does not guarantee
continued support. Unsupported selections fail rather than silently adopting
different rules.

This CLI supports original `0.8.0`, its maintained revision, and stable `0.9.0`.
Drafts and RCs are retired by the current upstream packages; use a matching
historical CLI to reproduce them.
Native projection requires `0.9.0`.

Pin the CLI version in automation. Add an explicit selector when exact rule
behavior matters, particularly when a schema URI is shared. This CLI rejects
`0.7.0` inputs. Use CLI 1.2.4 for historical processing or CLI 2.0.5 to convert
0.7.0 to 0.8.0:

```bash
npx --package=@cisco_open/mcptoolkit-contract@2.0.5 mcpcontract convert \
  old.yaml --output stable.yaml
mcpcontract migrate stable.yaml --output upgraded.yaml
```

Commands reading 0.8.0 recommend migration to stable 0.9.0 on stderr,
without upgrading input or changing success status. `migrate` does not repeat
the recommendation. Quiet mode suppresses progress, not this recommendation.

## Parsing and Normalized YAML

Modern MCP Description readers share core's JSON scalar recognition with a
string fallback. Plain `0o12`, `0x12`, `012`, `TRUE`, and `~` remain strings;
actual nulls, booleans, and numbers must use JSON spellings. Unresolved tags,
non-finite numbers, overflow, and duplicate keys produce parse errors. The same
rules apply to enrichment and migration-fix files. Unrelated configuration and
analysis formats keep their own parsing.

YAML document output uses core's Section 15.9 normalized presentation, separate
from specification selection and validation. This does not add an RC.4 selector.
`normalize --key-order document|preserve|sorted` selects ordering independently.
`migrate` supports the same policies, defaulting to `preserve`; use
`--key-order document` to combine migration and document-oriented ordering.
Ordering does not alter values or migration patches. Other commands preserve
their existing ordering choices.

For shared-identity resolution, upstream `schemaPins` behavior, command contracts,
and retirement rationale, read the
[maintainer design](maintainers/design/versions-and-selectors.md).
