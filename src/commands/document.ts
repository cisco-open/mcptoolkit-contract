// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Document command - Generate documentation from MCP descriptions
 */

import { Command } from 'commander';
import { readFile, writeFile } from 'fs/promises';
import { parse as yamlParse } from 'yaml';
import { Renderer, type MarkdownEngine } from '../lib/renderer.js';

export interface DocumentCommandOptions {
  template?: string;
  output?: string;
  type?: 'mcpdesc' | 'dump' | 'auto';
  rendering?: 'full' | 'reference';
  list?: boolean;
  quiet?: boolean;
  showExtractionDetails?: boolean;
  markdownEngine?: MarkdownEngine;
}

export function createDocumentCommand(): Command {
  const command = new Command('document');

  command
    .description('Generate documentation from an MCP description file')
    .argument('[file]', 'Path to MCP description file')
    .option('-t, --template <name>', 'Template: mcpdesc-documentation, reference-documentation, card-view (or path to .hbs file)')
    .option('-r, --rendering <mode>', 'Rendering mode: full (detailed) or reference (concise)', 'full')
    .option('-o, --output <path>', 'Output file path (prints to stdout if not specified)')
    .option('--type <type>', 'Input file type: mcpdesc, dump (legacy), or auto (auto-detect)', 'auto')
    .option('--list', 'List available built-in templates')
    .option('--show-extraction-details', 'Show session, CORS, and extraction information sections', false)
    .option('--markdown-engine <engine>', 'Markdown engine for HTML templates: marked (default), markdown-it, snarkdown', 'marked')
    .option('-q, --quiet', 'Suppress progress messages', false)
    .action(async (file: string | undefined, options: DocumentCommandOptions) => {
      try {
        await documentCommand(file, options);
      } catch (error) {
        if (error instanceof Error) {
          console.error(`\n❌ Error: ${error.message}\n`);
        } else {
          console.error(`\n❌ Error: ${String(error)}\n`);
        }
        process.exit(1);
      }
    });

  return command;
}

async function documentCommand(file: string | undefined, options: DocumentCommandOptions): Promise<void> {
  const renderer = new Renderer({ markdownEngine: options.markdownEngine });

  // List templates if requested
  if (options.list) {
    const templates = renderer.getAvailableTemplates();
    console.log('\n📋 Available Templates:\n');
    templates.forEach((template) => {
      const padding = ' '.repeat(Math.max(1, 20 - template.name.length));
      console.log(`  • ${template.name}${padding}- ${template.description}`);
    });
    console.log();
    return;
  }

  // Validate that file is provided for non-list operations
  if (!file) {
    throw new Error('File argument is required when not using --list');
  }

  // Progress messages
  const log = (message: string) => {
    if (!options.quiet) {
      console.log(message);
    }
  };

  log(`\n🎨 Rendering documentation...`);
  log(`  File: ${file}`);

  // Auto-detect file type if needed
  let fileType = options.type;
  if (fileType === 'auto') {
    try {
      const content = await readFile(file, 'utf-8');
      
      // Try to parse as JSON or YAML
      let data: any;
      try {
        data = JSON.parse(content);
      } catch {
        try {
          data = yamlParse(content);
        } catch (yamlError) {
          throw new Error(`Failed to parse file as JSON or YAML: ${(yamlError as Error).message}`);
        }
      }

      // Detect based on structure - improved logic
      if (data.mcpdesc || (data.dumpDetails && data.serverInfo && data.version)) {
        fileType = 'mcpdesc';
        log(`  Detected: MCP description`);
      } else {
        throw new Error('Unable to auto-detect file type. Please specify --type');
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('parse')) {
        throw error;
      }
      throw new Error(`Failed to read file: ${(error as Error).message}`);
    }
  } else {
    log(`  Type: ${fileType}`);
  }

  // Determine template based on file type if not explicitly specified
  let templateToUse = options.template;
  if (!templateToUse) {
    // Auto-select template based on rendering mode
    templateToUse = options.rendering === 'reference' ? 'reference-documentation' : 'mcpdesc-documentation';
  }
  
  log(`  Template: ${templateToUse}`);

  // Render based on type
  let output: string;
  try {
    if (fileType === 'mcpdesc' || fileType === 'dump') {
      output = await renderer.renderMcpDescription(file, templateToUse, {
        showDumpInformation: options.showExtractionDetails || false,
      });
    } else {
      throw new Error(`Invalid file type: ${fileType}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Rendering failed: ${error.message}`);
    }
    throw error;
  }

  // Write output
  if (options.output) {
    await writeFile(options.output, output, 'utf-8');
    log(`\n✅ Documentation written to: ${options.output}\n`);
  } else {
    // Print to stdout
    if (!options.quiet) {
      console.log(); // Extra line for separation
    }
    console.log(output);
  }
}
