# CLI Compatibility Display

## Situation

`mcpcontract validate --show-compatibility` works without an input file. Its
default output used to be a condensed release history. That history is curated,
not an inventory of all releases. It previously omitted CLI 1.2.4 and 2.0.5, the recommended
releases for historical processing and conversion. The old text table also
showed an empty Dump column and omitted preview and metadata schema fields.

## Decision

- Default text output answers what the installed CLI can process, emit,
  migrate, and project. Highlight the installed CLI, the stable conversion
  bridge (2.0.5), and the stable historical processor (1.2.4) by task, not by
  SemVer milestone. Use the same defaults,
  supported formats, selectors, and legacy guidance as the command logic.
- `--display full` in text mode shows all recorded rows, all recorded schema
  fields, and complete notes, including prereleases for reproducing retired
  snapshots. Label it as curated history, not a release index.
- JSON remains the machine-readable history. The default `short` mode keeps
  its existing schema-change filtering; `--display full` returns the complete
  stored object. Keep its fields, row order, and `--output` behavior unchanged.
- No changes to validation or MCP Description format support. Keep the README,
  focused agent guides, and shell candidates aligned. Help-parity testing is a
  separate design decision.

The current summary is useful offline and reflects the installed build rather
than whichever README a user happens to find. Keeping history explicit retains
context for retired snapshots without making it the first answer users see.