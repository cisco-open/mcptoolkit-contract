// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from '@jest/globals';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const fixture = resolve('tests/fixtures/dumps/multi-protocol.mcpdesc.json');
const cliArguments = ['build/index.js', 'diff', '--from', fixture, '--to', fixture, '--quiet'];

describe('effective protocol view command selection', () => {
  it('rejects ambiguous multi-version input without a selected view', () => {
    const result = spawnSync('node', cliArguments, { encoding: 'utf8' });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('select one with --protocol-version');
  });

  it('diffs the selected effective protocol view', () => {
    const output = execFileSync(
      'node',
      [...cliArguments, '--protocol-version', '2026-07-28'],
      { encoding: 'utf8' }
    );
    const result = JSON.parse(output);

    expect(result.changes).toEqual([]);
    expect(result.metadata.old.protocolVersion).toBe('2026-07-28');
    expect(result.metadata.new.protocolVersion).toBe('2026-07-28');
  });

  it('compares the selected effective protocol view', () => {
    const output = execFileSync(
      'node',
      [
        'build/index.js',
        'compare',
        '--from',
        fixture,
        '--to',
        fixture,
        '--protocol-version',
        '2026-07-28',
        '--quiet',
        '--exit-zero',
      ],
      { encoding: 'utf8' }
    );

    expect(output).toContain('PATCH release with 0 changes');
  });

  it('requires a selected view when documenting a multi-version description', () => {
    const ambiguous = spawnSync(
      'node',
      ['build/index.js', 'document', fixture, '--quiet'],
      { encoding: 'utf8' }
    );
    expect(ambiguous.status).toBe(1);
    expect(ambiguous.stderr).toContain('select one with --protocol-version');

    const output = execFileSync(
      'node',
      [
        'build/index.js',
        'document',
        fixture,
        '--protocol-version',
        '2026-07-28',
        '--quiet',
      ],
      { encoding: 'utf8' }
    );
    expect(output).toContain('MCP Specifications:** 2026-07-28');
    expect(output).toContain('Modern behavior');
    expect(output).not.toContain('Legacy behavior');
  });
});
