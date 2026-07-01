#!/bin/bash

# Copyright 2026 Cisco Systems, Inc. and its affiliates
#
# SPDX-License-Identifier: Apache-2.0

# Check for broken markdown links in docs/ folder
# Run from project root: ./tests/check-doc-links.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo "=================================="
echo "Documentation Link Checker"
echo "=================================="
echo ""

errors=0

check() {
  if [ ! -e "$1" ]; then
    echo "❌ BROKEN: $1${2:+ ($2)}"
    errors=$((errors+1))
  fi
}

# User-facing entry points (referenced from README.md / quick-start.md / SUPPORT.md)
echo "Checking user-facing docs..."
check "docs/quick-start.md"
check "docs/users/README.md"
check "docs/users/reference/schemas.md"
check "docs/users/reference/compatibility.md"
check "docs/users/reference/convert-legacy.md"

# Tutorials referenced from user docs and each other
echo "Checking tutorials..."
check "docs/users/tutorials/complete-workflow.md"
check "docs/users/tutorials/rules-catalog.md"
check "docs/users/tutorials/splitting-large-dumps.md"

# Example artifacts referenced from tutorials and README
echo "Checking example artifacts..."
for file in \
    http-with-auth-config.yaml \
    split-federation-services.yaml \
    split-example.md \
    microsoft-learn/README.md \
    microsoft-learn/ms-learn-dump.yaml \
    microsoft-learn/ms-learn-documentation.md; do
  check "docs/users/examples/$file"
done

# Maintainer docs referenced from AGENTS.md / cross-linked
echo "Checking maintainer docs..."
check "docs/maintainers/README.md"
check "docs/maintainers/design/architecture.md"
check "docs/maintainers/design/design-decisions.md"
check "docs/maintainers/design/workflow-examples.md"

# MCP Description specification (canonical source of truth, referenced from README/AGENTS)
echo "Checking specification..."
check "spec/README.md"
check "spec/mcp-description.md"
check "spec/CHANGELOG.md"
check "spec/GOVERNANCE.md"
check "spec/implementations.md"
check "spec/guides/getting-started.md"
check "spec/extensions/x-cisco-metadata/README.md"
check "spec/examples/full-featured.yaml"
check "schemas/mcp-description/0.7.0.json"

# Root-level docs
echo "Checking project root docs..."
check "README.md"
check "CHANGELOG.md"
check "CONTRIBUTING.md"
check "CODE_OF_CONDUCT.md"
check "SECURITY.md"
check "MAINTAINERS.md"
check "SUPPORT.md"
check "LICENSE"
check "AGENTS.md"

echo ""
if [ $errors -eq 0 ]; then
  echo "✅ All documentation links are valid!"
  exit 0
else
  echo "❌ Found $errors broken link(s)"
  echo ""
  echo "Fix broken links before releasing."
  exit 1
fi
