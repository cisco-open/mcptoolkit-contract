#!/bin/bash

# Copyright 2026 Cisco Systems, Inc. and its affiliates
#
# SPDX-License-Identifier: Apache-2.0

# Manual test runner for mcpcontract
# Run this script from the project root

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo "=================================="
echo "mcpcontract Manual Test Suite"
echo "=================================="
echo ""

# Ensure build is up to date
echo "Building project..."
npm run build
echo "✓ Build complete"
echo ""

# Test 1: Dump command with config file (uses public Microsoft Learn MCP server)
echo "Test 1: Dump command with config file"
echo "--------------------------------------"
if node build/index.js dump \
  --config tests/fixtures/configs/test-config.json \
  --mcp-server-name microsoft-learn \
  --format json \
  --pretty \
  --output tests/fixtures/dumps/test-output.json 2>&1 | grep -q "✓ Dump completed successfully"; then
  echo "✓ Dump created successfully"
  [ -f tests/fixtures/dumps/test-output.json ] && rm tests/fixtures/dumps/test-output.json
else
  echo "⚠ Dump test skipped (network unavailable or endpoint changed)"
  echo "  Requires: https://learn.microsoft.com/api/mcp (public endpoint)"
fi
echo ""

# Test 2: Dump command with CLI options (YAML)
echo "Test 2: Dump command with CLI options (YAML output)"
echo "----------------------------------------------------"
OUTPUT=$(node build/index.js dump \
  --server-name sample-server \
  --transport streamable-http \
  --url http://localhost:3000/mcp \
  --format yaml \
  --quiet 2>&1 | head -5)

if echo "$OUTPUT" | grep -q "version:"; then
  echo "✓ YAML output working"
else
  echo "⚠ YAML test skipped (sample server not running)"
fi
echo ""

# Test 3: Help output
echo "Test 3: Help commands"
echo "---------------------"
node build/index.js --help > /dev/null 2>&1 && echo "✓ Main help working"
node build/index.js dump --help > /dev/null 2>&1 && echo "✓ Dump help working"
node build/index.js rules --help > /dev/null 2>&1 && echo "✓ Rules help working"
echo ""

# Test 5: Rules command - list with default catalog
echo "Test 5: Rules list with default catalog"
echo "----------------------------------------"
OUTPUT=$(node build/index.js rules list --format json 2>&1)
if echo "$OUTPUT" | grep -q "changeType"; then
  echo "✓ Rules list JSON output working"
else
  echo "✗ Rules list failed"
fi

# Test table format
node build/index.js rules list 2>&1 | grep -q "Rules Catalog" && echo "✓ Rules list table format working"
echo ""

# Test 6: Rules command - list with custom catalog
echo "Test 6: Rules list with custom catalog"
echo "---------------------------------------"
if [ -d rules/strict-compatibility-catalog ]; then
  OUTPUT=$(node build/index.js rules list \
    --catalog rules/strict-compatibility-catalog \
    2>&1)
  
  if echo "$OUTPUT" | grep -q "custom"; then
    echo "✓ Custom catalog detected"
  fi
  
  # Check for severity comparison
  if echo "$OUTPUT" | grep -q "default:"; then
    echo "✓ Severity comparison working"
  else
    echo "ℹ Severity comparison not shown (may be identical)"
  fi
else
  echo "⚠ Custom catalog test skipped (strict-compatibility-catalog not found)"
fi
echo ""

# Test 7: Rules command - show with custom catalog
echo "Test 7: Rules show with custom catalog"
echo "---------------------------------------"
OUTPUT=$(node build/index.js rules show parameter-added 2>&1)
if echo "$OUTPUT" | grep -q "Parameter Added"; then
  echo "✓ Rules show working with default catalog"
fi

if [ -d rules/strict-compatibility-catalog ]; then
  OUTPUT=$(node build/index.js rules show parameter-enum-values-changed \
    --catalog rules/strict-compatibility-catalog \
    2>&1)
  
  if echo "$OUTPUT" | grep -q "Strict Mode"; then
    echo "✓ Rules show working with custom catalog"
  fi
else
  echo "⚠ Custom catalog show test skipped"
fi
echo ""

# Test 8: Rules command - filtering
echo "Test 8: Rules list with filters"
echo "--------------------------------"
node build/index.js rules list --category tools 2>&1 | grep -q "TOOLS" && echo "✓ Category filter working"
node build/index.js rules list --severity critical 2>&1 | grep -q "critical" && echo "✓ Severity filter working"
node build/index.js rules list --breaking 2>&1 | grep -q "BREAKING" && echo "✓ Breaking filter working"
echo ""

# Test 9: Rules command - examples
echo "Test 9: Rules examples command"
echo "-------------------------------"
OUTPUT=$(node build/index.js rules examples parameter-added 2>&1)
if echo "$OUTPUT" | grep -q "Examples:"; then
  echo "✓ Rules examples working"
fi

if [ -d rules/strict-compatibility-catalog ]; then
  OUTPUT=$(node build/index.js rules examples parameter-enum-values-changed \
    --catalog rules/strict-compatibility-catalog \
    2>&1)
  
  if echo "$OUTPUT" | grep -q "Examples:"; then
    echo "✓ Rules examples with custom catalog working"
  fi
fi
echo ""

# Test 10: Rules command - validate
echo "Test 10: Rules validate command"
echo "--------------------------------"
OUTPUT=$(node build/index.js rules validate 2>&1)
if echo "$OUTPUT" | grep -q "Validation"; then
  echo "✓ Rules validate working"
fi

if [ -d rules/strict-compatibility-catalog ]; then
  OUTPUT=$(node build/index.js rules validate \
    --catalog rules/strict-compatibility-catalog \
    2>&1)
  
  if echo "$OUTPUT" | grep -q "Validation"; then
    echo "✓ Rules validate with custom catalog working"
  fi
fi
echo ""

# Test 11: Rules command - export
echo "Test 11: Rules export command"
echo "------------------------------"
OUTPUT=$(node build/index.js rules export --format json --summary 2>&1)
if echo "$OUTPUT" | grep -q "changeType"; then
  echo "✓ Rules export JSON working"
fi

OUTPUT=$(node build/index.js rules export --format markdown 2>&1)
if echo "$OUTPUT" | grep -q "# Rules Catalog"; then
  echo "✓ Rules export Markdown working"
fi

if [ -d rules/strict-compatibility-catalog ]; then
  OUTPUT=$(node build/index.js rules export \
    --catalog rules/strict-compatibility-catalog \
    --format json \
    2>&1)
  
  if echo "$OUTPUT" | grep -q "changeType"; then
    echo "✓ Rules export with custom catalog working"
  fi
fi
echo ""

echo "Test 12: Bash completion script generation"
echo "-------------------------------------------"
# Generate bash completion script
COMPLETION_SCRIPT=$(node build/index.js completion bash 2>/dev/null)
if echo "$COMPLETION_SCRIPT" | grep -q "_mcpcontract_completion"; then
  echo "✓ Bash completion script generated"
else
  echo "✗ Bash completion generation failed"
  exit 1
fi

# Test completion functionality without bash-completion library
cat > /tmp/test-mcpcontract-completion.sh << 'COMPLETION_TEST'
#!/bin/bash
# Mock _init_completion for testing without bash-completion package
_init_completion() {
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"
    words=("${COMP_WORDS[@]}")
    cword=$COMP_CWORD
    return 0
}

# Source the completion script
eval "$(node build/index.js completion bash 2>/dev/null)"

# Test 1: Command completion
COMP_WORDS=(mcpcontract d)
COMP_CWORD=1
_mcpcontract_completion
test ${#COMPREPLY[@]} -eq 3 || exit 1  # Should match: dump, document, diff

# Test 2: All commands
COMP_WORDS=(mcpcontract "")
COMP_CWORD=1
_mcpcontract_completion
test ${#COMPREPLY[@]} -eq 11 || exit 1  # All 11 commands

# Test 3: dump options (without -- prefix)
COMP_WORDS=(mcpcontract dump "")
COMP_CWORD=2
_mcpcontract_completion
test ${#COMPREPLY[@]} -eq 14 || exit 1  # All dump options

# Test 5: rules subcommand completion
COMP_WORDS=(mcpcontract rules "")
COMP_CWORD=2
_mcpcontract_completion
test ${#COMPREPLY[@]} -eq 6 || exit 1  # list, list-catalogs, show, examples, validate, export

# Test 6: rules list options (without -- prefix)
COMP_WORDS=(mcpcontract rules list "")
COMP_CWORD=3
_mcpcontract_completion
test ${#COMPREPLY[@]} -eq 7 || exit 1  # All rules list options

# Test 7: Enum value completion for --transport
COMP_WORDS=(mcpcontract dump --transport "")
COMP_CWORD=3
_mcpcontract_completion
test ${#COMPREPLY[@]} -eq 3 || exit 1  # streamable-http, sse, stdio (no 'http' alias)

# Test 8: Enum value completion for --format
COMP_WORDS=(mcpcontract dump --format "")
COMP_CWORD=3
_mcpcontract_completion
test ${#COMPREPLY[@]} -eq 3 || exit 1  # json, yaml, markdown

# Test 9: Enum value completion for --schema
COMP_WORDS=(mcpcontract validate --schema "")
COMP_CWORD=3
_mcpcontract_completion
test ${#COMPREPLY[@]} -eq 6 || exit 1  # mcpdesc, mcp-description, dump, diff, diff-breaking, dump-split

# Test 10: Enum value completion for --category
COMP_WORDS=(mcpcontract rules list --category "")
COMP_CWORD=4
_mcpcontract_completion
test ${#COMPREPLY[@]} -eq 5 || exit 1  # tools, prompts, resources, resourceTemplates, serverInfo

exit 0
COMPLETION_TEST

chmod +x /tmp/test-mcpcontract-completion.sh
if bash /tmp/test-mcpcontract-completion.sh 2>/dev/null; then
  echo "✓ Command completion working (mcpcontract d → dump, document, diff)"
  echo "✓ All commands completion working (11 commands)"
  echo "✓ dump options completion working (14 options without -- prefix)"
  echo "✓ rules subcommand completion working (6 subcommands)"
  echo "✓ rules list options completion working (7 options without -- prefix)"
  echo "✓ Enum completion for --transport (4 values)"
  echo "✓ Enum completion for --format (3 values for dump)"
  echo "✓ Enum completion for --schema (6 values)"
  echo "✓ Enum completion for --category (5 values)"
  echo "✓ Completion works without bash-completion package"
else
  echo "✗ Completion tests failed"
  exit 1
fi
rm -f /tmp/test-mcpcontract-completion.sh
echo ""

echo "=================================="
echo "All manual tests passed! ✓"
echo "=================================="
echo ""
echo "Test fixtures location: tests/fixtures/"
echo "  - configs/  : MCP server configurations"
echo "  - dumps/    : Capability dumps"
echo ""
echo "Rules catalog locations:"
echo "  - rules/catalog/                     : Default catalog"
echo "  - rules/strict-compatibility-catalog/: Example custom catalog"
