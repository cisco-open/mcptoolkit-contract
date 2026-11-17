# Versions and Selectors: CLI Policy & Design

Status: implemented in the 2.1.0 development branch, 2026-11-05. This document
is the source of truth for the CLI's version and selector policy. Historical
CLI releases retain their documented behavior.

For the user-facing summary, see [Versions and Selectors](../../versions-and-selectors.md).

## Scope and Ownership

The MCP Description specification owns format semantics, schemas, and validation rules.

Core and validator implement those rules.

The CLI owns its supported operations, format support matrix, input selection policy, and default output format.

This policy must not redefine an upstream snapshot or modify historical
schemas to make an input pass.

Use the public APIs and metadata of the pinned `@mcpdesc/core` and
`@mcpdesc/validator` releases. Do not copy their snapshot implementations or
access private configuration files at runtime.

## Three Distinct Identities

- `mcpdesc` is required on every input MCP Description and identifies its format,
  such as `0.7.0`, `0.8.0`, or `0.9.0`. Missing, invalid, or unsupported values
  fail; neither `$schema` nor a selector substitutes for this property.
- `$schema` is optional and identifies a recognized schema for that format.
  Under CLI policy, it also selects associated rules unless explicitly overridden.
- A selector identifies exact validation and operation rules, for example
  `0.9.0-rc.3` or `0.8.0-rev.20261021`. An explicit
  `--selector` is a deliberate pin, subject to CLI and operation support.

The server's `info.version`, the CLI/package version, and the MCP protocol
revision are separate. In particular, `--protocol-version` chooses an MCP
revision within a description; it does not choose an mcpdesc selector.

## Input Resolution

After requiring the declared format and checking identity consistency, resolve
rules in this order: explicit selector, authored schema identity, format default.

| Input | Resolution |
| --- | --- |
| No `$schema`, no selector | Use the maintained default for the declared format. |
| Recognized same-format `$schema`, no selector | Use the supported selector associated with that identity. |
| No `$schema`, explicit selector | Use the explicit selector if compatible with the declared format. |
| Recognized same-format `$schema`, explicit selector | Explicit selector wins, including over a different snapshot of the same format. |
| Unknown or malformed `$schema` | Error, even when a selector is supplied. |
| Cross-format disagreement between identities | Error; do not reinterpret or convert the input. |

An explicit override is not permission to ignore an unknown schema URI. A
recognized identity is also not a promise of current CLI support. If an identity
selects a retired snapshot and no compatible explicit override is supplied,
report unsupported selection rather than silently falling back to newer rules.

Both the CLI and the requested operation must support the resolved selection.
Validation support alone does not establish support for native projection or
another processing operation. Resolve once and reuse the result throughout an
operation, including post-operation validation.

### Shared Schema Identities

A URI may identify multiple selectors. Select the maintained selector among
those sharing that URI; do not choose a default with a different URI. If public
metadata does not establish an unambiguous maintained choice, require an
explicit selector rather than guessing.

Specifically, `0.8.0` and `0.8.0-rev.20261021` share the canonical `0.8.0.json`
URI and schema bytes. That URI selects maintained `0.8.0-rev.20261021` behavior.
An explicit `--selector 0.8.0` requests the original behavior while the CLI
supports it. RC.3 is the only currently supported 0.9.0 identity; earlier
drafts and RCs have been retired.

### Difference From Upstream Default Resolution

In the upstream RC.1 package intake, `schemaPins: false` is a maintainer-owned
configuration for both the `0.8.0` and `0.9.0` formats. It is not a CLI flag or
an option activated by omitting a selector. Upstream resolution consequently
uses the format default even when a recognized historical schema is authored.

The CLI deliberately gives authored schema identity precedence over that
default. Resolve the identity with public metadata and pass the resulting
selector explicitly to core/validator. Do not change upstream configuration.
When neither a schema nor selector is supplied, use the library's maintained
format default, provided the CLI and operation support it.

Validator's `schemaPolicyIfPresent` and `fallbackIfSelectorIsUnknown` options
are intentionally not surfaced by this CLI. The CLI owns its documented
selector precedence, and falling back from an unavailable selector would hide a
retired or mistyped ruleset instead of reporting it.

Record resolution origin as explicit, schema-derived, or default in relevant
reports. Passing a schema-derived selector explicitly to a library must not be
reported to users as if they supplied `--selector` themselves.

## Command Contracts

| Command | Intent and selection behavior |
| --- | --- |
| `validate` | Check supported modern input using the resolution policy. Redirect `0.7.0` to a historical CLI. |
| `document`, hidden `render` alias | Describe the input under its resolved rules; do not upgrade it. |
| `project --view effective` | Project the input to an MCP revision using its resolved rules. |
| `project --view native` | Export native declarations using resolved rules, only where the operation supports them. |
| `split` | Select subsets using resolved rules; use the same selection for output validation and preserve format and authored schema identity. |
| `diff` | Resolve each input independently. An explicit selector applies to both and must be compatible with both. |
| `compare` | Apply the same input policy as `diff`; compatibility analysis rules are a separate choice. |
| `dump` | Create a document in the default or requested output format; use that format's maintained default unless explicitly pinned. |
| `convert` | Display historical CLI guidance only. Do not read inputs or write converted files. |
| `migrate` | Resolve source rules independently. The maintained migration target chooses its default rules; `--selector` pins destination rules, not source rules. |
| `breaking`, `changelog` | Consume their own diff/analysis artifacts, not mcpdesc selector inputs. |
| `rules` | Browse the CLI compatibility catalog, not the specification validation-rule catalog. |
| `completion`, `agents` | Describe the CLI; no input document resolution. |

`dump` uses `--to-version` to choose output format `0.8.0` (default) or
`0.9.0`. `migrate` targets the maintained migration version, currently `0.9.0`.
It does not accept `--to-version`. `--selector` pins destination rules;
it does not change the format choice. Do not confuse JSON/YAML serialization
options with an mcpdesc format version.

Cross-format `diff`/`compare` support requires verified comparison semantics;
independent selector resolution alone does not prove equivalence. If unsupported,
require an explicit reviewed migration first. Never use a selector as conversion.
The current comparison path projects each modern-format input to an effective
MCP revision before comparing; regression tests cover equivalent stable/RC views
and changed declarations. Select the same MCP revision for meaningful comparisons.

## Default Output and Conversion

The default dump output format is stable `0.8.0` until final `0.9.0` is adopted
as latest stable by the CLI. The migration destination is separately maintained
as `0.9.0`. The dependency's default for a format is not a choice of default
output format across formats.

The `0.9.0` output format, without an exact selector, uses its maintained
default: currently `0.9.0-rc.3`. Dependency upgrades can advance that choice
through approved RCs to final. Changing the maintained migration destination
requires an explicit CLI policy decision and reviewed conversion path.

Migration is an explicit reviewed operation, not a side effect of processing.
Support reviewed `0.8.0 -> 0.9.0` migration, source/result checks,
conversion blockers, explicit fixes, reports, and original-input patches.
Redirect `0.7.0` to CLI 2.0.5's `convert` for the bridge to 0.8.0; CLI 1.2.4
is only for historical processing and does not emit 0.8.0. Do not invent conversions
between draft/RC snapshots solely because they share `mcpdesc: "0.9.0"`.

A `0.9.0` source is validated under independently resolved source and
destination rules and reported unchanged. Selecting rules does not itself
authorize a downgrade, preview-snapshot conversion, or rewrite.

## Output Identity and Reporting

Reading, rendering, or selecting subsets must not silently relabel the input's
format or schema. Preserve absence of `$schema` for operations whose upstream
contract preserves it, including version conversion. For newly created documents,
or converted documents with a schema identity, emit the identity appropriate to
the resolved destination rules.

A shared schema URI cannot fully encode an exact semantic selector. Reports
should expose the actual selector and its resolution origin. Reproducible
automation should pin the CLI release and, where needed, an explicit selector.

Keep the CLI validation report envelope compatible unless a separate change is
approved. Preserve upstream diagnostic rule identities, protocol attribution,
structured detail and related locations, and rule-result statuses and reasons.
RC.3 uses validation result format `1.4.0`; 0.8 selectors retain their existing
diagnostic contract. The CLI's breaking-change catalog is unrelated and must not
be rewritten for this.

## Support Lifecycle and Maintenance

The CLI intentionally exposes a narrower support set than core and validator.
Once final replaces drafts and RCs, a new CLI release may remove their support
and CLI-specific code. Underlying library availability does not imply CLI
availability. Users needing retired rules must pin a former CLI release that
supports them.

Keep a small explicit CLI support/capability policy, not separate copied
implementations for every snapshot. Historical `0.7.0` validation and migration
are removed by an explicit compatibility decision; the archived schemas remain
historical material. `convert` is retained only to show actionable guidance.

Modern MCP Description readers use core's parser, including JSON scalar
recognition with string fallback. Enrichment and migration-fix files use those
scalar rules too; unrelated CLI formats retain their own parsers. At the input
boundary, 0.8.0 receives a non-blocking stderr recommendation to migrate,
except in `migrate`. The recommendation does not change
validation results, exit status, or the input document.

YAML document output delegates to core's Section 15.9 normalized presentation,
without adopting RC.4 validation or changing JSON output. Ordering is separate:
`normalize` and `migrate` accept document, preserve, and sorted policies;
`migrate` defaults to preserve. Other producers keep their established ordering
defaults. Ordering does not alter migration patches. Write normalized strings directly so stdout
and files retain exactly one final LF. Do not silently drop non-JSON runtime
values to make serialization succeed.

The current CLI supports original stable `0.8.0` and the maintained defaults for
`0.8.0` and `0.9.0` (currently RC.3). Retired drafts and earlier RCs are not
exposed even when historical packages support them. Native projection requires
`0.9.0`. The maintained defaults come from public package metadata, so approved
default advances do not require new RC constants.

Document retirements, affected operations, and matching historical CLI releases
in the changelog and compatibility guidance. Reject unsupported selections with
actionable guidance; never silently replace an explicit or schema-derived pin.

Dependency updates can change default validation and processing behavior. Pin
core/validator dependencies compatibly, check default-selector agreement, and
test identity precedence, shared identities, operation capabilities, historical
paths, output identities, and reports. The goal is to avoid routine per-RC code
edits, not to skip review and regression tests on dependency upgrades.

The validator's RC.3 result format is `1.4.0`. Structured diagnostic fields
are preserved in JSON reports and rendered in text output; they are not CLI
schema extensions.

## References

- [User guide](../../versions-and-selectors.md)
- [Developer guide](../../../AGENTS.md)
- [CLI compatibility mapping](../../../schemas/cli-schema-compatibility.json)
- [Published MCP Description format](https://mcpdesc.org/format/)
- [Core and validator repository](https://github.com/mcpdesc/core)
