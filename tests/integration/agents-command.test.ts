// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Integration tests for the agents command
 * Tests AI agent-optimized help system
 */

import { execSync } from 'child_process';
import { describe, it, expect } from '@jest/globals';

const CLI_PATH = 'node build/index.js';

describe('Agents Command Integration Tests', () => {
  describe('Overview Mode (Default)', () => {
    it('should output overview with usage section', () => {
      const result = execSync(`${CLI_PATH} agents`).toString();
      
      expect(result).toContain('# mcpcontract - AI Coding Assistants Reference');
      expect(result).toContain('## Purpose');
      expect(result).toContain('## When to Use This Command');
      expect(result).toContain('## Basic Usage');
      expect(result).toContain('## Common Patterns');
      expect(result).toContain('## Available Commands');
    });

    it('should include all command descriptions', () => {
      const result = execSync(`${CLI_PATH} agents`).toString();
      
      const commands = ['dump', 'validate', 'diff', 'breaking', 'changelog', 'document', 'rules', 'completion'];
      commands.forEach(cmd => {
        expect(result).toContain(`**${cmd}**`);
      });
    });

    it('should include decision tree', () => {
      const result = execSync(`${CLI_PATH} agents`).toString();
      
      expect(result).toContain('## Available Commands');
      expect(result).toContain('Use when:');
    });

    it('should include common workflows', () => {
      const result = execSync(`${CLI_PATH} agents`).toString();
      
      expect(result).toContain('## Common Patterns');
      expect(result).toContain('Pattern');
    });

    it('should be token-efficient (under 7000 chars)', () => {
      const result = execSync(`${CLI_PATH} agents`).toString();
      
      // Overview should be concise, not include all command details
      expect(result.length).toBeLessThan(7000);
      expect(result.length).toBeGreaterThan(3000);
    });
  });

  describe('Command-Specific Help', () => {
    const commands = ['dump', 'validate', 'diff', 'breaking', 'changelog', 'document', 'rules', 'completion'];

    commands.forEach(cmd => {
      it(`should output ${cmd} command guide`, () => {
        const result = execSync(`${CLI_PATH} agents --command ${cmd}`).toString();
        
        expect(result).toContain(`# ${cmd} -`);
        expect(result).toContain('## Purpose');
        expect(result).toContain('## When to Use');
        expect(result).toContain('## Basic Usage');
        
        // Rules command has "Subcommands" instead of "Common Patterns"
        if (cmd !== 'rules') {
          expect(result).toContain('## Common Patterns');
        }
      });
    });

    it('should be token-efficient for single commands', () => {
      const result = execSync(`${CLI_PATH} agents --command dump`).toString();
      
      // Single command should be focused, not include other commands
      expect(result.length).toBeLessThan(5000);
      expect(result.length).toBeGreaterThan(1500);
      
      // Should NOT contain other command names in headers
      expect(result).not.toContain('# validate -');
    });
  });

  describe('Workflows Mode', () => {
    it('should output all workflows', () => {
      const result = execSync(`${CLI_PATH} agents --workflows`).toString();
      
      expect(result).toContain('# Common Workflows');
      expect(result).toContain('Workflow');
      expect(result).toContain('Version Upgrade Check');
    });

    it('should include step-by-step examples', () => {
      const result = execSync(`${CLI_PATH} agents --workflows`).toString();
      
      expect(result).toContain('```bash');
      expect(result).toContain('mcpcontract dump');
      expect(result).toContain('mcpcontract breaking');
    });
  });

  describe('Complete Reference Mode (--all)', () => {
    it('should output complete documentation with --all flag', () => {
      const result = execSync(`${CLI_PATH} agents --all`).toString();
      
      // Should include overview
      expect(result).toContain('# mcpcontract - AI Coding Assistants Reference');
      
      // Should include workflows
      expect(result).toContain('# Common Workflows');
      
      // Should include all command guides
      expect(result).toContain('# dump - Extract MCP Server Capabilities');
      expect(result).toContain('# validate - Validate Files Against Schemas');
      expect(result).toContain('# diff - Compare Server Versions');
      expect(result).toContain('# breaking - Detect Breaking Changes');
      expect(result).toContain('# changelog - Generate Release Notes');
      expect(result).toContain('# document - Generate Documentation');
      expect(result).toContain('# rules - Browse Compatibility Rules');
      expect(result).toContain('# completion - Shell Autocompletion');
    });

    it('should be comprehensive (over 30000 chars)', () => {
      const result = execSync(`${CLI_PATH} agents --all`).toString();
      
      // Complete reference should be much larger
      expect(result.length).toBeGreaterThan(30000);
    });

    it('should include section separators', () => {
      const result = execSync(`${CLI_PATH} agents --all`).toString();
      
      // Should have separators between sections
      expect(result).toContain('\n---\n');
    });
  });

  describe('Error Handling', () => {
    it('should show helpful error for unknown command', () => {
      try {
        execSync(`${CLI_PATH} agents --command invalidcommand`, { stdio: 'pipe' });
        fail('Should have thrown an error');
      } catch (error: any) {
        const stderr = error.stderr.toString();
        expect(stderr).toContain('Unknown command: invalidcommand');
        expect(stderr).toContain('Available commands:');
        expect(stderr).toContain('dump, split, validate');
        expect(stderr).toContain('Usage: mcpcontract agents --command <name>');
      }
    });

    it('should exit with code 1 for unknown command', () => {
      try {
        execSync(`${CLI_PATH} agents --command badcommand`, { stdio: 'pipe' });
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.status).toBe(1);
      }
    });
  });

  describe('Help Integration', () => {
    it('should show agents command in main help', () => {
      const result = execSync(`${CLI_PATH} --help`).toString();
      
      expect(result).toContain('agents');
      expect(result).toContain('Agent-optimized help');
    });

    it('should show help for agents command', () => {
      const result = execSync(`${CLI_PATH} agents --help`).toString();
      
      expect(result).toContain('Usage:');
      expect(result).toContain('--command');
      expect(result).toContain('--workflows');
      expect(result).toContain('--all');
      expect(result).toContain('Output all commands in single document');
    });
  });

  describe('Token Efficiency Validation', () => {
    it('should demonstrate efficiency gain', () => {
      const overviewResult = execSync(`${CLI_PATH} agents`).toString();
      const singleResult = execSync(`${CLI_PATH} agents --command changelog`).toString();
      const allResult = execSync(`${CLI_PATH} agents --all`).toString();
      
      // Approximate token counts (1 token ≈ 4 chars)
      const overviewTokens = Math.floor(overviewResult.length / 4);
      const singleTokens = Math.floor(singleResult.length / 4);
      const allTokens = Math.floor(allResult.length / 4);
      
      // Overview should be around 1,000-1,500 tokens
      expect(overviewTokens).toBeGreaterThan(800);
      expect(overviewTokens).toBeLessThan(2000);
      
      // Single command should be around 500-1,000 tokens
      expect(singleTokens).toBeGreaterThan(400);
      expect(singleTokens).toBeLessThan(1500);
      
      // All should be around 7,000-10,000 tokens
      expect(allTokens).toBeGreaterThan(7000);
      expect(allTokens).toBeLessThan(10000);
      
      // Efficiency: single command should be 10-15x smaller than --all
      const efficiencyRatio = allTokens / singleTokens;
      expect(efficiencyRatio).toBeGreaterThan(10);
      expect(efficiencyRatio).toBeLessThan(15);
    });
  });

  describe('Content Quality', () => {
    it('should include practical examples in command guides', () => {
      const result = execSync(`${CLI_PATH} agents --command dump`).toString();
      
      expect(result).toContain('```bash');
      expect(result).toContain('mcpcontract dump');
      expect(result).toContain('--config');
      expect(result).toContain('--output');
    });

    it('should explain when to use each command', () => {
      const result = execSync(`${CLI_PATH} agents --command breaking`).toString();
      
      expect(result).toContain('## When to Use');
      expect(result).toContain('After');
    });

    it('should provide troubleshooting guidance', () => {
      const result = execSync(`${CLI_PATH} agents --command dump`).toString();
      
      expect(result).toContain('## Troubleshooting');
    });

    it('should explain next steps', () => {
      const result = execSync(`${CLI_PATH} agents --command dump`).toString();
      
      expect(result).toContain('## Next Steps');
    });
  });
});
