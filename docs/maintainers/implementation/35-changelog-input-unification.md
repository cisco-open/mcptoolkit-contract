# 35 — Changelog Input Unification & CI-First Workflow

## Motivation

The changelog workflow required three steps with a different input flag at every
hop, and the `changelog` command accepted three aliases (`--diff`, `--breaking`,
`--analysis`) for the same input slot. This made the README quickstart harder to
follow than necessary.

The primary audience is **CI**, where the value is the exit code of the
`breaking` command (`0` compatible, `1` breaking, `2` error). The decision was to
keep the staged commands (so CI can gate on `breaking`'s exit code), unify the
`changelog` input on a single `--diff` flag, and document the CI flow with an
explicit exit-code example plus an optional human-friendly wrapper script.

## Decision

- Keep `diff`, `breaking`, and `changelog` as separate commands (CI needs the
  `breaking` exit code as a gate).
- `changelog` takes a single, required `--diff <file>` input. It accepts either a
  structural diff (from `diff`) or an annotated diff (from `breaking`); breaking
  annotations are rendered when present.
- Remove the `--breaking <file>` and `--analysis <file>` aliases outright (no
  deprecation period).
- Standardize the annotated-diff artifact name on `diff-breaking.json`.
- Document the CI pipeline with the `breaking` exit code as the build gate.
- Provide `scripts/changelog.sh` as a non-gating human shortcut.

### Canonical CI flow

```bash
mcpcontract diff --from v1.json --to v2.json --output diff.json
breaking_status=0
mcpcontract breaking --diff diff.json --output diff-breaking.json || breaking_status=$?
mcpcontract changelog --diff diff-breaking.json --output CHANGELOG.md
# gate on $breaking_status: 0 = compatible, 1 = breaking, 2 = error
```

## Options Considered

- **Option A** — Unify on `--diff`; `breaking` enriches the diff in place.
- **Option B** — Add a boolean `--breaking` to `changelog` that runs the rules
  engine inline (fewest steps).
- **Option C** — Fully combined command (`changelog --from --to [--breaking]`).
  Rejected: it overloads `changelog` with diff + analysis responsibilities, grows
  the flag surface to ~13 flags across three concerns, and either deletes the
  `breaking` CI-gating exit code (C1) or introduces a dual input-mode validation
  matrix (C2).

Chosen: **A**, with the CLI input unified on `--diff` and the breaking exit code
preserved as the CI gate. A wrapper script covers the human one-liner instead of
a combined command.

## Implementation Tasks

### Code
1. `src/commands/changelog.ts` — replace `--diff`/`--breaking`/`--analysis` with a
   single required `--diff <file>`; update help INPUT FILE block and examples;
   simplify the action handler (drop alias fallback and the dead required check).
2. `src/commands/diff.ts` — fix the help example to
   `changelog --diff diff-breaking.json --output CHANGELOG.md`.
3. `src/commands/breaking.ts` — update help example to `--diff diff-breaking.json`.
4. `src/commands/completion.ts` — bash: update both `changelog)` opt strings to
   drop `--breaking` and list the real options; fish: remove the `-l breaking`
   completion for changelog.
5. `src/commands/agents.ts` — replace `changelog --analysis analysis.json`
   occurrences with `changelog --diff diff-breaking.json`.

### Docs
6. `README.md` — replace the 3-step quickstart with the CI exit-code example; fix
   remaining `--breaking analysis.json` references.
7. `docs/quick-start.md`, `docs/users/examples/microsoft-learn/README.md`,
   `docs/users/tutorials/complete-workflow.md`,
   `docs/users/tutorials/splitting-large-dumps.md`,
   `docs/maintainers/design/workflow-examples.md`, `templates/README.md` —
   update changelog invocations to `--diff diff-breaking.json`.

### New file
8. `scripts/changelog.sh` — non-gating human shortcut (diff → breaking → changelog).

### Tests
9. `tests/unit/completion.test.ts` — update the regex asserting the changelog opts.

### Changelog
10. `CHANGELOG.md` — record the removed aliases, unified `--diff` input, CI
    example, and new wrapper script.

## Out of Scope

- No "lite enrichment" path to give a *plain* diff full changelog detail. The CI
  and script flows always run `breaking` first, so `changelog` always receives an
  annotated diff.

## Follow-up Fix

- `changelog` previously exited with the breaking-change exit code (`1`), which
  aborted `set -e` CI scripts at the changelog step. It is a pure renderer, so it
  now exits `0` on a successful render; gating remains the responsibility of
  `breaking`.
