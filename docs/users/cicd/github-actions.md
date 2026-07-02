# GitHub Actions Workflow Templates

Copy-pasteable workflow templates for contract compatibility gating on GitHub Actions.

## Prerequisites

Both variants assume:
- `prev.json` — baseline dump from the previous release (see [README.md](README.md#seeding-the-baseline-prevjson) for strategies)
- `mcp.json` — MCP server config file used by `mcpcontract dump`

## Variant A — one-step `compare` (simple gate + human report)

Recommended for most repos: one step, one gate, changelog as an artifact.

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

      - name: Fetch previous release contract
        run: cp contracts/previous-release.json prev.json

      - name: Dump current contract
        run: mcpcontract dump --config mcp.json --output next.json

      - name: Compare — gate on breaking, write changelog
        run: |
          mcpcontract compare --from prev.json --to next.json \
            --suggest-version --output CHANGELOG.pr.md

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: contract-report
          path: CHANGELOG.pr.md
```

`compare` exits `1` on breaking changes — GitHub Actions treats non-zero as a
failed step, which is what you want. The changelog is written before the exit, so
the artifact upload (`if: always()`) captures it even when the step fails.

## Variant B — staged pipeline (advanced CD: per-step artifacts + precise gating)

Use this when you need the intermediate `diff.json` / `diff-breaking.json` as CI
checkpoints, want to run report generation in a separate job, or need fine-grained
control over the gate step.

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

      - name: Fetch previous release contract
        run: cp contracts/previous-release.json prev.json

      - name: Dump current contract
        run: mcpcontract dump --config mcp.json --output next.json

      - name: Structural diff
        run: mcpcontract diff --from prev.json --to next.json --output diff.json

      - name: Breaking-change analysis
        id: breaking
        run: |
          status=0
          mcpcontract breaking --diff diff.json --suggest-version \
            --output diff-breaking.json || status=$?
          echo "status=$status" >> "$GITHUB_OUTPUT"
          [ "$status" = 2 ] && exit 2   # hard error always propagates
          exit 0                        # keep going so changelog is always rendered

      - name: Generate changelog
        run: mcpcontract changelog --diff diff-breaking.json --output CHANGELOG.pr.md

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: contract-report
          path: |
            diff.json
            diff-breaking.json
            CHANGELOG.pr.md

      - name: Fail on breaking changes
        if: steps.breaking.outputs.status == '1'
        run: |
          echo "::error::Breaking contract changes detected — bump MAJOR or resolve."
          exit 1
```

## Posting the changelog as a PR comment

Add this step after the artifact upload in either variant (requires
`pull-requests: write` permission):

```yaml
      - name: Post changelog as PR comment
        if: always() && github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const body = fs.existsSync('CHANGELOG.pr.md')
              ? fs.readFileSync('CHANGELOG.pr.md', 'utf8')
              : '_No changelog generated._';
            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: `## Contract comparison\n\n${body}`
            });
```
