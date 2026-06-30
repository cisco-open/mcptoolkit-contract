#!/usr/bin/env bash
#
# Copyright 2026 Cisco Systems, Inc. and its affiliates
#
# SPDX-License-Identifier: Apache-2.0
#
# Human-friendly shortcut that runs the full changelog pipeline:
#   diff -> breaking (non-gating) -> changelog
#
# For CI gating, call the commands directly and branch on the exit code of
# `mcpcontract breaking` (0 = compatible, 1 = breaking, 2 = error).
#
# Usage:
#   scripts/changelog.sh <from> <to> [output]
#
# Example:
#   scripts/changelog.sh v1.json v2.json CHANGELOG.md

set -euo pipefail

if [[ $# -lt 2 || $# -gt 3 ]]; then
  echo "Usage: $0 <from> <to> [output]" >&2
  exit 2
fi

from=$1
to=$2
out=${3:-CHANGELOG.md}

mcpcontract diff --from "$from" --to "$to" --output diff.json
mcpcontract breaking --diff diff.json --output diff-breaking.json || true   # don't gate humans
mcpcontract changelog --diff diff-breaking.json --output "$out"

echo "Wrote $out"
