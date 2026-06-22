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

# User-facing entry points (referenced from README.md / QUICK_START.md / SUPPORT.md)
echo "Checking user-facing docs..."
check "docs/users/README.md"
check "docs/users/mcp-compatibility-guidelines.md"
check "docs/users/schemas.md"
check "docs/users/dump-schema.md"
check "docs/users/dump-to-mcpdesc.md"

# Tutorials referenced from user docs and each other
echo "Checking tutorials..."
check "docs/users/tutorials/complete-workflow.md"
check "docs/users/tutorials/changelog-tutorial.md"
check "docs/users/tutorials/rules-catalog-guide.md"
check "docs/users/tutorials/splitting-large-dumps.md"

# Example artifacts referenced from tutorials and README
echo "Checking example artifacts..."
for file in \
    http-with-auth-config.yaml \
    split-federation-services.yaml \
    split-example.md \
    ietf-network-mgmt-mcp-dump.json \
    ietf-network-mgmt.md; do
  check "docs/users/examples/$file"
done

# Maintainer docs referenced from AGENTS.md / cross-linked
echo "Checking maintainer docs..."
check "docs/maintainers/README.md"
check "docs/maintainers/design/architecture.md"
check "docs/maintainers/design/design-decisions.md"
check "docs/maintainers/design/workflow-examples.md"

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
