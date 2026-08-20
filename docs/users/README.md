# User Documentation

This folder contains user-facing documentation for **mcpcontract**.

## Start here

- [../101-tutorial.md](../101-tutorial.md) — 5-minute getting-started walkthrough
- [../../README.md](../../README.md) — project overview and command reference

## CI/CD

See [cicd/](cicd/):

- [README.md](cicd/README.md) — overview: the two paths (compare vs staged pipeline), exit-code contract, seeding the baseline
- [github-actions.md](cicd/github-actions.md) — copy-pasteable GitHub Actions workflow templates (one-step and staged variants)

## Reference

See [reference/](reference/):

- [schemas.md](reference/schemas.md) — the mcpdesc schema and field reference
- [compatibility.md](reference/compatibility.md) — backward-compatibility philosophy and rules
- [exit-codes.md](reference/exit-codes.md) — normative exit code reference for all commands
- [convert-legacy.md](reference/convert-legacy.md) — migrating legacy dump files to mcpdesc

## Tutorials

See [tutorials/](tutorials/):

- [complete-workflow.md](tutorials/complete-workflow.md) — full dump → validate → document → diff → breaking → changelog
- [rules-catalog.md](tutorials/rules-catalog.md) — browse and customize the rules catalog
- [splitting-large-dumps.md](tutorials/splitting-large-dumps.md) — split federation dumps into focused subsets

## Examples and sample data

See [examples/](examples/):

- [microsoft-learn/](examples/microsoft-learn/) — sample dumps used by the quick start and tutorials
- [split-example.md](examples/split-example.md) — splitting a federation server by service
- [html/](examples/html/) — rendered HTML card-view output
