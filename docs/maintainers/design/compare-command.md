# Design: `compare` command + CI/CD guide (v1.1)

**Status:** Proposed — targeting **v1.1** (additive to 1.0, non-breaking).
**Author:** design note for maintainers.
**Related:** [design-decisions.md](design-decisions.md) §3 (the pipeline),
[implementation/35-changelog-input-unification.md](../implementation/35-changelog-input-unification.md),
[workflow-examples.md](workflow-examples.md).

---

## 1. Motivation

Today the human path to a changelog is a three-command pipeline
(`diff` → `breaking` → `changelog`) plus a shell wrapper,
[`scripts/changelog.sh`](../../../scripts/changelog.sh), that stitches them
together. The wrapper works but is unsatisfying:

- **It lives outside the CLI.** Users must know the repo layout, or copy the
  script, to get the convenience. It is not on `PATH`, not discoverable via
  `--help`, not shell-completed, and not covered by the CLI's own tests.
- **It duplicates orchestration** that the CLI could own natively, and it will
  drift from the commands it wraps (it already hard-codes artifact names and the
  `|| true` gating decision).
- **It is bash-only.** Windows users without a POSIX shell can't run it.

The proposal: promote a first-class **`compare`** command that runs the full
comparison in one invocation and emits a human-oriented report (including the
changelog), using the embedded default compatibility rules unless overridden.
The staged `diff` / `breaking` / `changelog` commands remain the CI/CD contract
(fine-grained, checkpointed, gate on `breaking`'s exit code). Once `compare`
ships, **`scripts/changelog.sh` is removed.**

This keeps everything in the CLI, consistent and testable, and gives us a clean
story: **`compare` for people, the staged pipeline for pipelines.**

---

## 2. Evaluation & challenges to the proposal

The core idea is sound and worth doing. A few points from the request deserve
pushback or sharpening before we build it.

### 2.1 Don't make `compare` a "never-gates" special case — share `breaking`'s exit contract

The request frames `compare` as the human command and says CI users "should use
`diff`, `breaking`, `changelog`." That positioning is right, **but the exit-code
behavior should not be a separate philosophy.** The toolkit currently has exactly
one gating contract — `breaking`'s `0 / 1 / 2` — and consistency is more valuable
than a human/CI split baked into exit codes.

Recommendation: **`compare` reuses `breaking`'s exit-code contract verbatim**
(`0` compatible, `1` breaking, `2` error), with an explicit `--exit-zero` opt-out
for `set -e` scripts and interactive users who never want a non-zero. Rationale:

- A non-zero exit is **harmless in an interactive shell** — the user still gets
  the full report on stdout/disk. It only matters inside `set -e` scripts, which
  is exactly where an opt-out belongs.
- One exit-code contract across `breaking` and `compare` is easier to teach and
  document than "the staged command gates, the combined one doesn't."
- It makes `compare` genuinely usable in **simple** CI (one step, gate on exit),
  while the staged pipeline remains for **advanced** CD (per-stage artifacts,
  custom gating, separate report/publish steps). We get both audiences instead of
  fencing `compare` off from CI.

The mental model becomes: *`compare` is the staged pipeline collapsed into one
command with a combined report; it gates exactly like `breaking` unless you say
`--exit-zero`.* This is strictly more capable than the `|| true` wrapper it
replaces, and still lets us **recommend** the staged pipeline for real CD.

### 2.2 `compare` vs `diff` — the name will invite confusion

`diff` already "compares two versions." Users may reach for `compare` expecting a
lighter/heavier `diff`, or vice-versa. We should either accept the overlap and
disambiguate hard in help text, or pick a name that signals "human report":

| Name | Pro | Con |
|---|---|---|
| `compare` (requested) | Natural verb, reads well | Overlaps semantically with `diff` |
| `review` | Signals human judgement/report | Less obvious it produces a file |
| `report` | Signals the output artifact | Vague about *what* is reported |
| `changes` | Matches the changelog domain | Noun, weaker as a verb |

Recommendation: keep **`compare`**, and make the distinction explicit everywhere:

> `diff` produces a machine artifact (structural diff JSON). `compare` produces a
> human report (diff **+** breaking analysis **+** changelog) in one step.

We should state this in `compare --help`, the `agents` guide, and the README so
the overlap is a feature (familiar verb) not a trap.

### 2.3 Scope: `compare` orchestrates existing dump files — it does **not** dump live servers

The two inputs (`--from` / `--to`) are **dump files that already exist**;
`compare` never talks to a live server. "Dump generation along the pipeline"
belongs in the **CI/CD guide as GitHub Actions templates**, not inside `compare`.
`compare` is a pure function of its inputs (`--from`, `--to`, rules) with no
network I/O:

- Mixing live-server extraction (`dump`, which needs transport/auth/OAuth) into
  `compare` would balloon its flag surface and couple a deterministic reporting
  command to network failure modes.
- Determinism matters: `compare` must be reproducible from the two input files
  for auditability. Dumping is inherently time-dependent (§design-decisions "Dump
  is *observational*").

So: `compare --from a.json --to b.json`. Producing `a.json`/`b.json` is **not**
`compare`'s job and never will be — the CI job dumps both versions with
`mcpcontract dump` (or supplies committed dump files) **before** invoking
`compare`. There is **no** `--from-config` / `--to-config` on `compare`; it is a
deliberate **non-goal**, not a deferral. If a one-shot "point at two live servers"
UX is ever wanted, it belongs in a separate command, not here.

### 2.4 Output channels: changelog → stdout, report → stderr (staged convention)

`compare` follows the **same stdout/stderr convention as every other command** in
the toolkit:

- **The changelog goes to stdout** (the primary artifact), so it can be redirected
  or captured like any other command's output. `--output <file>` writes it to a
  file instead; **default is stdout** (no file is written unless asked).
- **The report goes to stderr.** The verbose, human-facing narration —
  compatibility verdict, breaking/new/updated/deleted counts, and the recommended
  version bump (with `--suggest-version`) — goes to stderr, exactly like the
  `🔍 Comparing…` / `✅ …` progress lines the staged commands already print.
  `--quiet` suppresses it.

This keeps `compare` consistent with `diff` / `breaking` / `changelog` (stdout =
artifact, stderr = narration) and avoids the case-insensitive-filesystem footgun
of a default `changelog.md` clobbering a repo's `CHANGELOG.md`. The common cases:

```bash
# See the changelog in the terminal, report narration alongside it
mcpcontract compare --from prev.json --to next.json

# Capture just the changelog to a file; narration still shows on stderr
mcpcontract compare --from prev.json --to next.json --output CHANGELOG.md
mcpcontract compare --from prev.json --to next.json > CHANGELOG.md
```

### 2.5 Removing `changelog.sh`

Agreed, and it's the right call — a native command makes the wrapper redundant
and removes a drift source. Do it **in the same release that introduces
`compare`**, and:

- Note the removal in `CHANGELOG.md` under `### Removed` with the one-liner
  replacement (`mcpcontract compare --from … --to … --exit-zero`).
- Grep the docs for `changelog.sh` references and repoint them at `compare`
  (link checker `npm run test:links` will catch stragglers).

---

## 3. Command design

### 3.1 Synopsis

```text
mcpcontract compare --from <file> --to <file> [options]
```

Runs, internally: structural diff → breaking-change analysis (default rules
unless `--rules`) → changelog rendering. Writes the changelog to stdout (or
`--output <file>`) and prints a verbose human report to stderr. Equivalent to the
staged pipeline collapsed into one command.

### 3.2 Options

| Flag | Required | Default | Purpose |
|---|---|---|---|
| `--from <file>` | ✅ | — | Source version (mcpdesc/dump, JSON/YAML) — same inputs as `diff` |
| `--to <file>` | ✅ | — | Target version (mcpdesc/dump, JSON/YAML) |
| `--output <file>` | — | stdout | Write the **changelog** to a file instead of stdout |
| `--rules <file>` | — | embedded `breaking-changes.yaml` | Custom compatibility rules |
| `--format <type>` | — | `release` | Changelog format: `release` \| `compact` (mirrors `changelog`) |
| `--suggest-version` | — | `false` | Include the semver bump recommendation in the report |
| `--exit-zero` | — | `false` | Always exit `0` on success (don't gate on breaking) |
| `--quiet` | — | `false` | Suppress the stderr report |
| `--emit-diff <file>` | — | — | *(optional, advanced)* Also persist the raw structural diff JSON |
| `--emit-breaking <file>` | — | — | *(optional, advanced)* Also persist the raw annotated (breaking) diff JSON |

The **changelog goes to stdout** (or `--output`); the **report goes to stderr**.
`--emit-diff` / `--emit-breaking` are optional escape hatches for users who want
the raw intermediate JSON the staged pipeline produces (auditability); off by
default to keep the working directory clean.

Flag names are deliberately **borrowed from the staged commands** (`--from` /
`--to` from `diff`; `--rules` / `--suggest-version` from `breaking`; `--output` /
`--format` from `changelog`) so there is nothing new to learn.

### 3.3 Exit codes (the important part)

`compare` shares `breaking`'s contract:

| Code | Meaning | Notes |
|---|---|---|
| `0` | Success, **no breaking changes** (backward compatible) | Also the code when `--exit-zero` is set and the run succeeded |
| `1` | Success, **breaking changes detected** | Report is still produced. Suppressed to `0` by `--exit-zero` |
| `2` | **Error** (bad/missing input, parse failure, rules error, IO) | Never suppressed by `--exit-zero` |

Design rules:

- **The changelog (stdout/`--output`) and the stderr report are always produced
  on `0` and `1`.** The exit code is an *extra* signal, never a reason to withhold
  output. Only `2` (a genuine error) may skip them.
- **`--exit-zero` never masks `2`.** Errors are not "changes"; they must remain
  observable so a `set -e` script fails loudly on malformed input.
- This makes `compare` drop-in usable both ways:

  ```bash
  # Simple CI: one step, gate on breaking (changelog to stdout, report to stderr)
  mcpcontract compare --from prev.json --to next.json --output CHANGELOG.md

  # Human / non-gating: same outputs, never fails the shell
  mcpcontract compare --from prev.json --to next.json --exit-zero
  ```

### 3.4 Output shape

**Changelog** (stdout, or `--output <file>`) — the `changelog` render; `--format`
controls `release` vs `compact`. Byte-for-byte what the staged `changelog` command
would emit for the same annotated diff.

**Report** (stderr) — verbose human narration, in order:

1. **Verdict banner** — compatible / breaking, and (with `--suggest-version`) the
   recommended semver bump `X.Y.Z → X'.Y'.Z'`.
2. **Summary counts** — breaking / new / updates / deleted (reusing the
   `breaking` categorization).
3. **Output pointer** — where the changelog went (stdout, or the `--output` path).

The changelog is produced by reusing the existing `Renderer` + changelog
templates; the stderr report is a thin "verdict + summary" render. No new
rendering engine.

### 3.5 Implementation shape (for later — not now)

- New `src/commands/compare.ts`: Commander wiring + flag parsing only.
- **No new business logic.** It composes the existing libraries in-process:
  `Differ` → `RulesEngine` → `Renderer`. Per design-decisions §2, logic lives in
  `src/lib/`; commands are shellable. `compare` is literally the staged commands
  called as functions, sharing one process.
- Rules resolution copies `breaking`'s embedded-vs-`--rules` logic (extract to a
  small shared helper so both commands agree on the default path).
- Register in `src/index.ts`; add bash/zsh/fish completions; add a
  `COMPARE_GUIDE` to `src/commands/agents.ts` and a decision-tree entry
  ("Human-readable comparison report → `compare`").
- Tests: unit (exit-code matrix incl. `--exit-zero`, rules override, changelog on
  stdout by default and to `--output` when set, report on stderr) + one
  integration test (from/to fixtures → changelog + report).

---

## 4. Relationship to the existing pipeline

```text
              ┌─────────────────── staged (CI/CD, advanced) ───────────────────┐
  from.json ─▶│ diff ─▶ diff.json ─▶ breaking ─▶ diff-breaking.json ─▶ changelog │─▶ CHANGELOG.md
  to.json   ─▶│           (exit 0/2)      (exit 0/1/2, the gate)     (exit 0/2)   │
              └────────────────────────────────────────────────────────────────┘

              ┌──────────────── compare (humans + simple CI) ──────────────────┐
  from.json ─▶│                    compare  (exit 0/1/2, --exit-zero opt-out)   │─▶ changelog → stdout / --output
  to.json   ─▶│         diff ∘ breaking ∘ changelog, in one process            │   verbose report → stderr
              └────────────────────────────────────────────────────────────────┘
```

Guidance we will document:

- **Use the staged pipeline** when you need the intermediate artifacts as CI
  checkpoints, want to gate precisely on `breaking`, or run report generation in
  a separate job/step from the gate.
- **Use `compare`** for local review, PR summaries, and simple single-step CI
  where one changelog + a readable report + one gate is enough.

---

## 5. CI/CD documentation plan

Deliver a user-facing guide under **`docs/users/cicd/`** (a CI/CD guide is
user-facing, and the docs tree already splits `docs/users/` for usage vs
`docs/maintainers/` for internals). Register the new folder in the docs README
index and the link checker.

Proposed contents:

- `docs/users/cicd/README.md` — overview: the two paths (staged vs `compare`),
  exit-code contract, when to use which.
- `docs/users/cicd/github-actions.md` — copy-pasteable GitHub Actions workflow
  **templates** (below), with notes on caching, artifact upload, and PR comments.
- `docs/users/cicd/gitlab-and-others.md` *(optional/stretch)* — the same recipe
  translated to a generic `set -e` script for non-GitHub runners.

### 5.1 Proposed GitHub Actions workflow (contract compatibility gate)

The recipe: on each PR, dump the server, compare it against the **previous
release's** published mcpdesc, gate on breaking changes, and on success attach the
generated changelog. Two variants — pick one in the guide.

**Variant A — staged pipeline (recommended for CD; precise gating + artifacts):**

```yaml
name: contract-check
on: pull_request

jobs:
  compatibility:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm install -g @cisco_open/mcptoolkit-contract

      # Baseline: the mcpdesc from the last release (artifact, tag, or committed file)
      - name: Fetch previous release contract
        run: cp contracts/previous-release.json prev.json

      # Current: dump the server this PR builds (adjust to your start command)
      - name: Dump current contract
        run: mcpcontract dump --config mcp.json --output next.json

      - name: Structural diff
        run: mcpcontract diff --from prev.json --to next.json --output diff.json

      - name: Breaking-change gate
        id: breaking
        run: |
          status=0
          mcpcontract breaking --diff diff.json --suggest-version \
            --output diff-breaking.json || status=$?
          echo "status=$status" >> "$GITHUB_OUTPUT"
          [ "$status" = 2 ] && exit 2   # hard error
          exit 0                        # keep going so we always render the changelog

      - name: Generate changelog
        run: mcpcontract changelog --diff diff-breaking.json --output CHANGELOG.pr.md

      - uses: actions/upload-artifact@v4
        with:
          name: contract-report
          path: |
            diff.json
            diff-breaking.json
            CHANGELOG.pr.md

      - name: Fail the check if breaking
        if: steps.breaking.outputs.status == '1'
        run: |
          echo "::error::Breaking contract changes detected — bump MAJOR or resolve."
          exit 1
```

**Variant B — one-step `compare` (simple gate + human report):**

```yaml
      - name: Compare against previous release
        run: |
          # Changelog → CHANGELOG.pr.md; report narration → stderr (step log).
          # exit 1 here fails the job on breaking changes; changelog is still written.
          mcpcontract compare --from prev.json --to next.json \
            --suggest-version --output CHANGELOG.pr.md
      - uses: actions/upload-artifact@v4
        with: { name: contract-report, path: CHANGELOG.pr.md }
```

The guide will also cover: seeding/rotating the `prev.json` baseline (commit it
on release, or pull the prior tag's artifact), posting the generated changelog as
a PR comment, and using `--exit-zero` when the changelog is informational rather
than a gate.

---

## 6. Migration & release checklist (when v1.1 is cut)

- [ ] Add `src/commands/compare.ts` + register in `src/index.ts`.
- [ ] Extract shared rules-path resolution used by `breaking` and `compare`.
- [ ] Add the stderr "verdict + summary" report render; reuse changelog templates
      for the stdout/`--output` changelog.
- [ ] Shell completions (bash/zsh/fish) for `compare`.
- [ ] `agents.ts`: `COMPARE_GUIDE` + decision-tree/workflow entries.
- [ ] Unit + integration tests (exit-code matrix, `--exit-zero`, `--rules`,
      changelog on stdout by default + `--output` to file).
- [ ] `docs/users/cicd/` guide (README + github-actions.md) with both variants;
      register the folder in the docs README index + link checker.
- [ ] **Remove `scripts/changelog.sh`**; repoint docs; `npm run test:links`.
- [ ] `CHANGELOG.md`: `### Added` compare, `### Removed` changelog.sh.
- [ ] Bump MINOR (`1.0.x` → `1.1.0`) per semver — additive command, no breaking.

---

## 7. Decisions & non-goals

All design-review questions are resolved; recorded here for the record.

**Decisions:**

- **Exit codes** shared with `breaking` (`0` compatible / `1` breaking / `2`
  error), with `--exit-zero` opt-out that never masks `2` (§2.1).
- **Name:** `compare`, with hard disambiguation from `diff` in help/guide (§2.2).
- **Output channels:** changelog → stdout (or `--output`), report → stderr — the
  same convention as every other command (§2.4).
- **Formats:** Markdown only for v1.1; `--format release|compact` covers changelog
  styling. No HTML/JSON report formats (revisit later if asked).
- **Docs:** land in `docs/users/cicd/` (§5).

**Non-goals (explicitly will-not-do):**

- **No live-server dumping in `compare`.** There is no `--from-config` /
  `--to-config`. `compare` only ever consumes two dump files that already exist;
  generating them (e.g. `mcpcontract dump`) is the CI job's responsibility,
  performed *before* `compare` runs. A one-shot "point at two live servers" UX, if
  ever wanted, would be a separate command — not part of this design.
- **No default file write.** `compare` never writes a file unless `--output` is
  given (avoids clobbering a repo's `CHANGELOG.md` on case-insensitive
  filesystems).
