// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Unit tests for bash completion script
 */

import { execSync } from 'child_process';
import { describe, it, expect } from '@jest/globals';

describe('Bash Completion', () => {
  const generateCompletion = (): string => {
    return execSync('node build/index.js completion bash 2>/dev/null', {
      encoding: 'utf-8',
      cwd: process.cwd()
    });
  };

  it('should generate bash completion script', () => {
    const script = generateCompletion();
    expect(script).toContain('_mcpcontract_completion');
    expect(script).toContain('complete -F _mcpcontract_completion mcpcontract');
  });

  it('should include all commands in completion', () => {
    const script = generateCompletion();
    const commands = ['dump', 'validate', 'document', 'diff', 'breaking', 'changelog', 'completion', 'rules', 'agents'];
    
    for (const cmd of commands) {
      expect(script).toContain(cmd);
    }
  });

  it('should include fallback for systems without bash-completion', () => {
    const script = generateCompletion();
    expect(script).toContain('declare -F _init_completion');
    expect(script).toContain('# Fallback for systems without bash-completion');
  });

  it('should support completion without dash prefix for all commands', () => {
    const script = generateCompletion();
    expect(script).toContain('# No dash prefix - provide file completion or other context-specific completions');
    
    // Check that key commands have options defined in the no-dash section
    expect(script).toMatch(/dump\)\s+local opts="--config --mcp-server/);
    expect(script).toMatch(/diff\)\s+local opts="--from --to/);
    expect(script).toMatch(/breaking\)\s+local opts="--diff --rules/);
    expect(script).toMatch(/changelog\)\s+local opts="--diff --breaking/);
  });

  it('should include dump command options', () => {
    const script = generateCompletion();
    const dumpOptions = ['--config', '--transport', '--url', '--server-name', '--output', '--format', '--help'];
    
    for (const opt of dumpOptions) {
      expect(script).toContain(opt);
    }
  });

  it('should include rules subcommands', () => {
    const script = generateCompletion();
    const subcommands = ['list', 'list-catalogs', 'show', 'examples', 'validate', 'export'];
    
    for (const subcmd of subcommands) {
      expect(script).toContain(subcmd);
    }
  });

  it('should include rules list options', () => {
    const script = generateCompletion();
    const listOptions = ['--category', '--severity', '--breaking', '--rules', '--catalog', '--format'];
    
    for (const opt of listOptions) {
      expect(script).toContain(opt);
    }
  });

  it('should support agents command options', () => {
    const script = generateCompletion();
    expect(script).toContain('--command');
    expect(script).toContain('--workflows');
    expect(script).toContain('--all');
  });

  it('should support enum value completion for --transport', () => {
    const script = generateCompletion();
    expect(script).toContain('--transport|-t)');
    expect(script).toContain('"streamable-http sse stdio"');
  });

  it('should support enum value completion for --format', () => {
    const script = generateCompletion();
    expect(script).toContain('--format|-f)');
    expect(script).toContain('"json yaml markdown"');
  });

  it('should support enum value completion for --schema', () => {
    const script = generateCompletion();
    expect(script).toContain('--schema)');
    expect(script).toContain('"mcpdesc mcp-description dump diff diff-breaking dump-split"');
  });

  it('should support enum value completion for --category', () => {
    const script = generateCompletion();
    expect(script).toContain('--category)');
    expect(script).toContain('"tools prompts resources resourceTemplates serverInfo"');
  });

  it('should support enum value completion for --severity', () => {
    const script = generateCompletion();
    expect(script).toContain('--severity)');
    expect(script).toContain('"info major critical"');
  });

  it('should support enum value completion for --type', () => {
    const script = generateCompletion();
    expect(script).toContain('--type)');
    expect(script).toContain('"mcpdesc dump auto"');
  });
});

describe('Zsh Completion', () => {
  const generateCompletion = (): string => {
    return execSync('node build/index.js completion zsh 2>/dev/null', {
      encoding: 'utf-8',
      cwd: process.cwd()
    });
  };

  it('should generate zsh completion script', () => {
    const script = generateCompletion();
    expect(script).toContain('#compdef mcpcontract');
    expect(script).toContain('_mcp_contract');
  });

  it('should include command descriptions', () => {
    const script = generateCompletion();
    expect(script).toContain('dump:Extract capabilities from a live MCP server');
    expect(script).toContain('rules:Browse and explore rules catalog');
  });

  it('should include argument specifications', () => {
    const script = generateCompletion();
    expect(script).toContain('_arguments');
    expect(script).toContain("'(-c --config)'{-c,--config}");
    expect(script).toContain("'(-o --output)'{-o,--output}");
  });
});

describe('Fish Completion', () => {
  const generateCompletion = (): string => {
    return execSync('node build/index.js completion fish 2>/dev/null', {
      encoding: 'utf-8',
      cwd: process.cwd()
    });
  };

  it('should generate fish completion script', () => {
    const script = generateCompletion();
    expect(script).toContain('complete -c mcpcontract');
  });

  it('should include all commands', () => {
    const script = generateCompletion();
    expect(script).toContain('complete -c mcpcontract -f -n "__fish_use_subcommand" -a "dump"');
    expect(script).toContain('complete -c mcpcontract -f -n "__fish_use_subcommand" -a "rules"');
    expect(script).toContain('complete -c mcpcontract -f -n "__fish_use_subcommand" -a "agents"');
  });

  it('should include command options', () => {
    const script = generateCompletion();
    expect(script).toContain('complete -c mcpcontract -n "__fish_seen_subcommand_from dump" -s c -l config');
    expect(script).toContain('complete -c mcpcontract -n "__fish_seen_subcommand_from dump" -s t -l transport');
  });

  it('should include rules subcommand options', () => {
    const script = generateCompletion();
    expect(script).toContain('complete -c mcpcontract -f -n "__fish_seen_subcommand_from rules" -a "list"');
    expect(script).toContain('complete -c mcpcontract -n "__fish_seen_subcommand_from rules; and __fish_seen_subcommand_from list" -l category');
  });
});
