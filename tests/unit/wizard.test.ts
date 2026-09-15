// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from '@jest/globals';
import {
  buildCommandArgs,
  buildCommandInvocation,
  formatCommand,
  type WizardAnswers
} from '../../src/commands/wizard.js';

describe('dump wizard command execution', () => {
  it('keeps user input as raw arguments and quotes only the displayed command', () => {
    const answers: WizardAnswers = {
      transport: 'http',
      serverName: 'Webflow production',
      url: 'https://mcp.webflow.com/mcp?source=one&mode=two',
      auth: 'auto',
      format: 'yaml',
      output: 'webflow contract.yaml',
      headers: 'Authorization: Bearer token with spaces'
    };

    const args = buildCommandArgs(answers);

    expect(args).toContain('Webflow production');
    expect(args).toContain('Authorization: Bearer token with spaces');
    expect(args).not.toContain('"Webflow production"');
    expect(formatCommand(args)).toContain("'Webflow production'");
    expect(formatCommand(args)).toContain("'webflow contract.yaml'");
  });

  it('spawns Node directly without a shell', () => {
    const invocation = buildCommandInvocation(
      ['--server-name', 'name; echo unsafe'],
      '/opt/mcp contract/build/index.js',
      '/usr/bin/node'
    );

    expect(invocation).toEqual({
      command: '/usr/bin/node',
      args: [
        '/opt/mcp contract/build/index.js',
        'dump',
        '--server-name',
        'name; echo unsafe'
      ],
      options: { stdio: 'inherit' }
    });
    expect(invocation.options).not.toHaveProperty('shell');
  });
});