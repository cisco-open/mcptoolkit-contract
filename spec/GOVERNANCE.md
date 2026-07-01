# Governance

This document describes how the MCP Description Specification is managed and evolved.

## Specification Editors

The specification is currently maintained by **Cisco DevNet**. As the specification matures and gains industry adoption, the governance model may evolve to include additional stakeholders.

## Decision Process

### Minor Changes (Patch)

Typo fixes, clarifications, and non-normative documentation improvements can be merged by any editor after a single review.

### Feature Additions (Minor)

New optional features that don't break existing documents require:

1. An issue with community discussion
2. A pull request with spec text, schema changes, and examples
3. Review and approval by at least one editor
4. A CHANGELOG entry

### Breaking Changes (Major)

Changes that would invalidate existing conforming documents require:

1. An issue with clear justification and migration path
2. Extended discussion period (minimum 30 days)
3. A pull request with complete migration documentation
4. Approval by all active editors

## Versioning Policy

The specification follows [Semantic Versioning](https://semver.org/):

- **Major** versions (1.0.0, 2.0.0) — breaking changes to document structure
- **Minor** versions (0.4.0, 0.5.0) — new features, backward compatible
- **Patch** versions (0.4.1) — errata and clarifications only

The specification is currently in **0.x** (pre-1.0), which means the format is still evolving. Breaking changes may occur between minor versions during this phase.

## Extension Governance

Vendor extensions (`x-` properties) are governed independently by their authors. The core specification does not control extension content or versioning.

Extension authors who wish to list their extension in this repository may submit a PR to add it to the `extensions/` directory.

## Intellectual Property

All contributions to the specification are made under the [Apache License 2.0](../LICENSE).
