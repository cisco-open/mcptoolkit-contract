// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

import { Command } from 'commander';
import { LEGACY_CONVERSION_GUIDANCE } from '../lib/mcpdesc-target.js';

export function convertCommand(): Command {
  const guidance = `${LEGACY_CONVERSION_GUIDANCE}\n` +
    'For supported MCP Description 0.8.0 input, use:\n' +
    'mcpcontract migrate <input> --output <new-file>\n';

  return new Command('convert')
    .description('Show historical CLI guidance for legacy conversion (no files are converted)')
    .argument('[input]', 'Historical input path (not read by this CLI)')
    .option('--to-format <format>', 'Historical option; use CLI 2.0.5')
    .option('--to-version <version>', 'Historical option; use migrate for supported documents')
    .option('--selector <selector>', 'Historical option; use migrate for supported documents')
    .option('-o, --output <path>', 'Historical output path (no file will be written)')
    .option('-f, --format <format>', 'Historical serialization option')
    .option('--compact', 'Historical formatting option')
    .option('-q, --quiet', 'Guidance is still displayed')
    .option('--guide', 'Print historical conversion guidance and exit successfully')
    .addHelpText('after', `\n${guidance}`)
    .action((_input: string | undefined, options: { guide?: boolean }) => {
      if (options.guide) {
        process.stdout.write(guidance);
      } else {
        process.stderr.write(`Conversion is no longer performed by this CLI.\n${guidance}`);
        process.exitCode = 1;
      }
    });
}
