---
name: release
description: 'Cut a new release of @cisco_open/mcptoolkit-contract. Use when preparing, tagging, or publishing a release (stable or release candidate) — bumping the version, updating CHANGELOG.md and schemas, opening a release PR, and driving the tag-triggered npm publish. Covers semantic versioning, DCO sign-off, branch/PR flow, and the next vs latest dist-tag policy for pre-releases.'
argument-hint: 'Target version, e.g. 1.0.0 or 1.0.0-rc.6'
---

# Release Workflow

Release `@cisco_open/mcptoolkit-contract` safely: every release goes through a
branch and PR, CI runs on the branch, a maintainer reviews, the PR is merged to
`main` with a merge commit, and a `v*` tag on `main` triggers the automated npm
publish.

## When to Use

- Cutting a stable release (`X.Y.Z`) or a release candidate (`X.Y.Z-rc.N`).
- Bumping the version and rolling up `CHANGELOG.md`.
- Any change that requires a new npm publish.

## Key Facts

- **Publish is tag-driven.** Pushing a tag matching `v*` to the remote triggers
  [`.github/workflows/publish.yml`](../../workflows/publish.yml), which builds,
  tests, checks doc links, verifies the tag matches `package.json`, and runs
  `npm publish --provenance --access public --tag <dist-tag>`.
- **Dist-tag policy is automatic.** Versions containing `-` (e.g.
  `1.0.0-rc.6`) publish under the `next` dist-tag; versions without `-` publish
  under `latest`. This keeps `npm install @cisco_open/mcptoolkit-contract` on the
  latest stable release while RCs are available via `@next`.
- **Tag must match `package.json`.** `publish.yml` fails if the pushed tag
  (minus the leading `v`) differs from the `version` field. Always bump
  `package.json` in the release PR.
- **DCO required.** Every commit must be signed off (`git commit -s`); see
  [CONTRIBUTING.md](../../../CONTRIBUTING.md).
- **Never release directly on `main`.** Use a branch and PR so CI runs and a
  reviewer can approve before publish.

## Semantic Versioning

- **MAJOR (X.0.0)** — breaking CLI or schema changes.
- **MINOR (0.X.0)** — new commands/features, backward-compatible.
- **PATCH (0.0.X)** — bug fixes, docs, non-breaking.
- **Pre-release** — append `-rc.N` (or `-beta.N`) for release candidates; these
  publish under `next`, not `latest`.

## Procedure

### 1. Prepare the release changes

1. Bump `version` in `package.json` to the target version.
2. Update `CHANGELOG.md`: move items from `## [Unreleased]` into a
   new `## [X.Y.Z] - YYYY-MM-DD` section under the right headings (Added,
   Changed, Deprecated, Removed, Fixed, Security). Update the table of contents
   anchor. Leave an empty `[Unreleased]` section.
3. **If any schema changed**, this is a specification change first — follow the
   Schema Version Management steps in
   [AGENTS.md](../../../AGENTS.md#release-process): bump `spec/` front-matter,
   sections, examples, `spec/CHANGELOG.md`, add the new
   `schemas/<type>/<version>.json`, update `schemas/latest.json` and
   `schemas/cli-schema-compatibility.json`.
4. Run the full pre-release gate and confirm it is green:
   ```bash
   npm run prerelease   # sync-badge + link check + build + full test suite
   ```
   `npm run sync-badge` refreshes the README status badge from `package.json`.

### 2. Open the release PR

```bash
# Branch off up-to-date main
git switch main && git pull
git switch -c release/X.Y.Z

# Commit the release-prep changes, signed off (DCO)
git add .
git commit -s -m "Release vX.Y.Z"

# Push and open a PR against main
git push -u origin release/X.Y.Z
```

Open a pull request against `main` (the repo has a
[PR template](../../PULL_REQUEST_TEMPLATE.md)). Wait for:
- [`ci.yml`](../../workflows/ci.yml) to pass (build + test on Node 20/22/24, doc-link check).
- At least one maintainer review/approval.

### 3. Merge, then tag on main

Merge the PR with a **merge commit** (not squash) so the reviewed SHA lands in
`main`'s history and the tag will point into `main`.

```bash
git switch main && git pull   # fast-forward to the merged commit
git tag vX.Y.Z                # tag the merged release commit
git push origin vX.Y.Z        # triggers publish.yml → npm
```

### 4. Verify the publish

- Watch the **Publish to npm** workflow run in the Actions tab; confirm it
  succeeds.
- Confirm the version on npm and its dist-tag:
  ```bash
  npm view @cisco_open/mcptoolkit-contract dist-tags
  # RC → should appear under "next"; stable → under "latest"
  ```

### 5. If publish fails

Do **not** force-push or delete a published tag. Fix forward:
- Correct the problem in a new PR.
- Bump to a new patch/RC version (e.g. `X.Y.Z+1` or `-rc.N+1`).
- Repeat the flow with the new version and tag.

## Checklist

- [ ] `package.json` version bumped to target
- [ ] `CHANGELOG.md` updated (new section + TOC anchor + empty Unreleased)
- [ ] Schema/spec updated together if any schema changed
- [ ] `npm run prerelease` green
- [ ] Branch `release/X.Y.Z` pushed, PR opened, commits DCO-signed
- [ ] CI green on the PR + maintainer approval
- [ ] PR merged with a merge commit
- [ ] `vX.Y.Z` tag pushed to `main`
- [ ] Publish workflow succeeded; correct dist-tag (`next` for RC, `latest` for stable)
