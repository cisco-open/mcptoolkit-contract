// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Renderer for generating documentation from MCP descriptions
 */

import Handlebars from 'handlebars';
import { readFile } from 'fs/promises';
import { parse as yamlParse } from 'yaml';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { isMcpDescDocument, isContractDump } from './mcpdesc-converter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface RenderOptions {
  /** Template name or path to custom template file */
  template?: string;
  /** Data to render (MCP description / dump) */
  data: any;
}

export type MarkdownEngine = 'marked' | 'markdown-it' | 'snarkdown';

export class Renderer {
  private handlebars: typeof Handlebars;
  private templatesDir: string;
  private markdownEngine: MarkdownEngine;
  private markdownRender?: (text: string) => string;

  constructor(options?: { markdownEngine?: MarkdownEngine }) {
    this.handlebars = Handlebars.create();
    // Templates directory is at project root
    this.templatesDir = join(__dirname, '..', '..', 'templates');
    this.markdownEngine = options?.markdownEngine || 'marked';
    this.registerHelpers();
  }

  /**
   * Register custom Handlebars helpers
   */
  private registerHelpers(): void {
    // Helper to join array elements
    this.handlebars.registerHelper('join', (array: any[], separator: string) => {
      if (!Array.isArray(array)) {
        return '';
      }
      return array.join(separator);
    });

    // Helper for equality comparison
    this.handlebars.registerHelper('eq', (a: any, b: any) => {
      return a === b;
    });

    // Helper for inequality comparison
    this.handlebars.registerHelper('ne', (a: any, b: any) => {
      return a !== b;
    });

    // Helper to check if value exists
    this.handlebars.registerHelper('exists', function (this: any, value: any, options: Handlebars.HelperOptions) {
      return value !== undefined && value !== null ? options.fn(this) : options.inverse(this);
    });

    // Helper to count array items
    this.handlebars.registerHelper('count', (array: any[]) => {
      return Array.isArray(array) ? array.length : 0;
    });

    // Helper for conditional OR (works both as block and subexpression)
    this.handlebars.registerHelper('or', function (this: any, ...args: any[]) {
      const options = args[args.length - 1];
      const values = args.slice(0, -1);
      const result = values.some((v) => !!v);
      // When used as subexpression (or a b), options.fn is undefined
      if (typeof options === 'object' && typeof options.fn === 'function') {
        return result ? options.fn(this) : options.inverse(this);
      }
      // Subexpression mode: return boolean
      return result;
    });

    // Helper for conditional AND (works both as block and subexpression)
    this.handlebars.registerHelper('and', function (this: any, ...args: any[]) {
      const options = args[args.length - 1];
      const values = args.slice(0, -1);
      const result = values.every((v) => !!v);
      // When used as subexpression (and a b), options.fn is undefined
      if (typeof options === 'object' && typeof options.fn === 'function') {
        return result ? options.fn(this) : options.inverse(this);
      }
      // Subexpression mode: return boolean
      return result;
    });

    // Helper to stringify JSON
    this.handlebars.registerHelper('json', (obj: any, indent?: number) => {
      return new this.handlebars.SafeString(JSON.stringify(obj, null, indent || 2));
    });

    // Helper for pluralization
    this.handlebars.registerHelper('plural', (count: number, singular: string, plural: string) => {
      return count === 1 ? singular : plural;
    });

    // Note: HTML escaping is disabled globally since we generate Markdown/text output
    // (see constructor: this.handlebars.Utils.escapeExpression)

    // Helper to add numbers
    this.handlebars.registerHelper('add', (...args: any[]) => {
      // Remove the Handlebars options object from the end
      const numbers = args.slice(0, -1);
      return numbers.reduce((sum: number, num: number) => sum + num, 0);
    });

    // Helper to uppercase text
    this.handlebars.registerHelper('uppercase', (str: string) => {
      return str ? str.toUpperCase() : '';
    });

    // Helper to capitalize text
    this.handlebars.registerHelper('capitalize', (str: string) => {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1);
    });

    // Helper for greater than comparison
    this.handlebars.registerHelper('gt', (a: any, b: any) => {
      return a > b;
    });

    // Changelog-specific helpers
    
    // Category icon helper
    this.handlebars.registerHelper('categoryIcon', (category: string) => {
      const icons: Record<string, string> = {
        breaking: '⚠️',
        new: '✨',
        update: '🔄',
        deleted: '🗑️'
      };
      return icons[category] || '';
    });

    // Impact badge helper
    this.handlebars.registerHelper('impactBadge', (level: string) => {
      const badges: Record<string, string> = {
        high: '🔴',
        medium: '🟡',
        low: '🟢'
      };
      return badges[level] || '';
    });

    // Capability icon helper
    this.handlebars.registerHelper('capabilityIcon', (type: string) => {
      const icons: Record<string, string> = {
        tools: '🔧',
        resources: '📦',
        prompts: '💬',
        resourceTemplates: '📋',
        server: '⚙️',
        serverInfo: '⚙️'
      };
      return icons[type] || '';
    });

    // Semantic version bump helper
    this.handlebars.registerHelper('semverBump', (categorization: any) => {
      if (!categorization) return 'PATCH';
      
      if (categorization.breaking && categorization.breaking.length > 0) {
        return 'MAJOR';
      }
      if ((categorization.new && categorization.new.length > 0) || 
          (categorization.deleted && categorization.deleted.length > 0)) {
        return 'MINOR';
      }
      return 'PATCH';
    });

    // Change count helper
    this.handlebars.registerHelper('changeCount', (category: string, changes: any[]) => {
      if (!Array.isArray(changes)) return 0;
      return changes.filter((c: any) => c.changeCategory === category).length;
    });

    // Format date for changelog (returns YYYY-MM-DD if no arg, or formats provided date)
    this.handlebars.registerHelper('formatDate', (dateString?: string | object) => {
      // Handle Handlebars context object when called without parameters
      if (!dateString || typeof dateString === 'object') {
        // No date provided - return current date in YYYY-MM-DD format
        return new Date().toISOString().split('T')[0];
      }
      
      try {
        const date = new Date(dateString);
        // Check if we want short format (YYYY-MM-DD) or long format
        if (dateString.includes('T') || dateString.includes('-')) {
          // ISO format - return YYYY-MM-DD
          return date.toISOString().split('T')[0];
        }
        // Long format for display
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      } catch (error) {
        return dateString;
      }
    });

    // Array contains helper (for checking if array contains value)
    this.handlebars.registerHelper('contains', (array: any[], value: any) => {
      if (!Array.isArray(array)) return false;
      return array.includes(value);
    });

    // Convert newlines to <br> for use inside markdown table cells.
    // Also escapes pipe characters so they don't break table columns.
    // Use with triple-stash {{{tableBr value}}} to avoid HTML-encoding.
    this.handlebars.registerHelper('tableBr', (text: string) => {
      if (!text) return '';
      return text
        .replace(/\|/g, '\\|')
        .replace(/\n/g, '<br>');
    });

    // Singularize category label (Tools -> Tool, Prompts -> Prompt, etc.)
    this.handlebars.registerHelper('singularLabel', (pluralLabel: string) => {
      const singularMap: Record<string, string> = {
        'Tools': 'Tool',
        'Prompts': 'Prompt',
        'Resources': 'Resource',
        'Resource Templates': 'Resource Template',
        'Server Info': 'Server'
      };
      return singularMap[pluralLabel] || pluralLabel;
    });

    // Phase 1: JSON Schema constraint helpers

    // Format number constraints (min/max)
    this.handlebars.registerHelper('formatNumberConstraints', (schema: any) => {
      if (!schema) return '';
      const parts: string[] = [];
      
      if (schema.minimum !== undefined || schema.maximum !== undefined) {
        const min = schema.minimum ?? schema.exclusiveMinimum;
        const max = schema.maximum ?? schema.exclusiveMaximum;
        const minOp = schema.exclusiveMinimum !== undefined ? '>' : '≥';
        const maxOp = schema.exclusiveMaximum !== undefined ? '<' : '≤';
        
        if (min !== undefined && max !== undefined) {
          parts.push(`Range: ${min}${minOp === '>' ? '+' : ''}-${max}`);
        } else if (min !== undefined) {
          parts.push(`Minimum: ${minOp} ${min}`);
        } else if (max !== undefined) {
          parts.push(`Maximum: ${maxOp} ${max}`);
        }
      }
      
      if (schema.multipleOf !== undefined) {
        parts.push(`Multiple of: ${schema.multipleOf}`);
      }
      
      return parts.length > 0 ? parts.join(', ') : '';
    });

    // Format string constraints (length, pattern, format)
    this.handlebars.registerHelper('formatStringConstraints', (schema: any) => {
      if (!schema) return '';
      const parts: string[] = [];
      
      if (schema.minLength !== undefined || schema.maxLength !== undefined) {
        if (schema.minLength !== undefined && schema.maxLength !== undefined) {
          parts.push(`Length: ${schema.minLength}-${schema.maxLength}`);
        } else if (schema.minLength !== undefined) {
          parts.push(`Min length: ${schema.minLength}`);
        } else if (schema.maxLength !== undefined) {
          parts.push(`Max length: ${schema.maxLength}`);
        }
      }
      
      if (schema.pattern) {
        parts.push(`Pattern: \`${schema.pattern}\``);
      }
      
      if (schema.format) {
        parts.push(`Format: ${schema.format}`);
      }
      
      return parts.length > 0 ? parts.join(', ') : '';
    });

    // Format array constraints
    this.handlebars.registerHelper('formatArrayConstraints', (schema: any) => {
      if (!schema) return '';
      const parts: string[] = [];
      
      if (schema.minItems !== undefined || schema.maxItems !== undefined) {
        if (schema.minItems !== undefined && schema.maxItems !== undefined) {
          parts.push(`Items: ${schema.minItems}-${schema.maxItems}`);
        } else if (schema.minItems !== undefined) {
          parts.push(`Min items: ${schema.minItems}`);
        } else if (schema.maxItems !== undefined) {
          parts.push(`Max items: ${schema.maxItems}`);
        }
      }
      
      if (schema.uniqueItems === true) {
        parts.push('Unique values required');
      }
      
      return parts.length > 0 ? parts.join(', ') : '';
    });

    // Inline enum display (for short enums)
    this.handlebars.registerHelper('inlineEnum', (enumArray: any[]) => {
      if (!Array.isArray(enumArray) || enumArray.length === 0) return '';
      
      // Use inline format if 3 or fewer items and all are short strings
      if (enumArray.length <= 3 && enumArray.every(v => typeof v === 'string' && v.length <= 20)) {
        return enumArray.map(v => `"${v}"`).join(' | ');
      }
      
      return ''; // Fall back to list format
    });

    // Phase 2: Enrichment metadata helpers

    // Group items by first tag
    this.handlebars.registerHelper('groupByTag', (items: any[]) => {
      if (!Array.isArray(items)) return {};
      
      const grouped: Record<string, any[]> = {};
      const uncategorized: any[] = [];
      
      items.forEach(item => {
        if (item.tags && Array.isArray(item.tags) && item.tags.length > 0) {
          const category = item.tags[0];
          if (!grouped[category]) {
            grouped[category] = [];
          }
          grouped[category].push(item);
        } else {
          uncategorized.push(item);
        }
      });
      
      // Add uncategorized items if any
      if (uncategorized.length > 0) {
        grouped['Other'] = uncategorized;
      }
      
      return grouped;
    });

    // Format examples inline
    this.handlebars.registerHelper('formatExamples', (examples: any[]) => {
      if (!Array.isArray(examples) || examples.length === 0) return '';
      
      const formatted = examples.map(ex => {
        if (typeof ex === 'string') return `"${ex}"`;
        return JSON.stringify(ex);
      }).join(', ');
      
      return formatted;
    });

    // Deprecation badge
    this.handlebars.registerHelper('deprecatedBadge', (deprecated: boolean) => {
      return deprecated === true ? '⚠️ DEPRECATED' : '';
    });

    // First sentence extraction
    this.handlebars.registerHelper('firstSentence', (text: string) => {
      if (!text) return '';
      
      // Extract first sentence (ends with . ! or ?)
      const match = text.match(/^[^.!?]*[.!?]/);
      if (match) {
        return match[0].trim();
      }
      
      // If no sentence ending found, take first line or first 100 chars
      const firstLine = text.split('\n')[0];
      if (firstLine.length <= 100) {
        return firstLine.trim();
      }
      
      return firstLine.substring(0, 100).trim() + '...';
    });

    // Markdown-to-HTML helper for HTML templates
    this.handlebars.registerHelper('markdown', (text: string) => {
      if (!text) return '';
      const html = this.renderMarkdown(text);
      return new this.handlebars.SafeString(html);
    });
  }

  /**
   * Initialize the markdown engine (lazy-loaded)
   */
  private async initMarkdownEngine(): Promise<void> {
    if (this.markdownRender) return;

    switch (this.markdownEngine) {
      case 'markdown-it': {
        try {
          // @ts-ignore — optional peer dependency
          const markdownIt = (await import('markdown-it')).default;
          const md = markdownIt();
          this.markdownRender = (text: string) => md.render(text);
        } catch {
          throw new Error(
            `Markdown engine 'markdown-it' is not installed. Install it with:\n` +
            `  npm install markdown-it\n` +
            `Or use the default engine: --markdown-engine marked`
          );
        }
        break;
      }
      case 'snarkdown': {
        try {
          // @ts-ignore — optional peer dependency
          const snarkdown = (await import('snarkdown')).default;
          this.markdownRender = (text: string) => snarkdown(text);
        } catch {
          throw new Error(
            `Markdown engine 'snarkdown' is not installed. Install it with:\n` +
            `  npm install snarkdown\n` +
            `Or use the default engine: --markdown-engine marked`
          );
        }
        break;
      }
      case 'marked':
      default: {
        const { marked } = await import('marked');
        this.markdownRender = (text: string) => marked.parse(text, { async: false }) as string;
        break;
      }
    }
  }

  /**
   * Render markdown text to HTML (synchronous, requires initMarkdownEngine first)
   */
  private renderMarkdown(text: string): string {
    if (!this.markdownRender) {
      // Fallback: return text with basic paragraph wrapping
      return `<p>${text}</p>`;
    }
    return this.markdownRender(text);
  }

  /**
   * Load a template from file
   */
  private async loadTemplate(templatePath: string): Promise<string> {
    try {
      return await readFile(templatePath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to load template from ${templatePath}: ${error}`);
    }
  }

  /**
   * Get the path to a built-in template
   */
  private getBuiltInTemplatePath(templateName: string): string {
    // Map template names to files
    const templateMap: Record<string, string> = {
      'mcpdesc-documentation': 'default-dump.md.hbs',
      'dump-documentation': 'default-dump.md.hbs',
      'reference-documentation': 'reference-dump.md.hbs',
      'card-view': 'card-view.html.hbs',
    };

    const filename = templateMap[templateName] || `${templateName}.hbs`;
    return join(this.templatesDir, filename);
  }

  /**
   * Render data using a template
   */
  async render(options: RenderOptions): Promise<string> {
    const { template = 'default', data } = options;

    // Determine template path
    let templatePath: string;
    if (template.endsWith('.hbs') || template.includes('/') || template.includes('\\')) {
      // Custom template file path
      templatePath = template;
    } else {
      // Built-in template name
      templatePath = this.getBuiltInTemplatePath(template);
    }

    // Determine if we should disable HTML escaping based on template extension
    // Only disable for Markdown/text templates (.md.hbs), keep enabled for .html.hbs
    const isMarkdownTemplate = templatePath.endsWith('.md.hbs') || 
                               templatePath.endsWith('.txt.hbs') ||
                               templatePath.endsWith('.yaml.hbs') ||
                               templatePath.endsWith('.json.hbs');

    const isHtmlTemplate = templatePath.endsWith('.html.hbs');

    // Initialize markdown engine for HTML templates (needed by {{{markdown}}} helper)
    if (isHtmlTemplate) {
      await this.initMarkdownEngine();
    }
    
    // Load and compile template
    const templateSource = await this.loadTemplate(templatePath);
    
    // Temporarily disable escaping for Markdown/text templates
    const originalEscape = this.handlebars.Utils.escapeExpression;
    if (isMarkdownTemplate) {
      this.handlebars.Utils.escapeExpression = (str: any) => str;
    }
    
    try {
      const compiledTemplate = this.handlebars.compile(templateSource);
      return compiledTemplate(data);
    } finally {
      // Restore original escape function
      this.handlebars.Utils.escapeExpression = originalEscape;
    }
  }

  /**
   * Render an MCP description file.
   * Templates receive mcpdesc-native data. Legacy ContractDump inputs are
   * converted to mcpdesc automatically.
   */
  async renderMcpDescription(filePath: string, templateName?: string, extraContext?: Record<string, any>): Promise<string> {
    const fileContent = await readFile(filePath, 'utf-8');
    
    // Auto-detect format and parse
    let data: any;
    try {
      data = JSON.parse(fileContent);
    } catch {
      try {
        data = yamlParse(fileContent);
      } catch (yamlError) {
        throw new Error(`Failed to parse MCP description as JSON or YAML: ${(yamlError as Error).message}`);
      }
    }

    // Require mcpdesc format (legacy capability dumps are no longer supported)
    if (!isMcpDescDocument(data)) {
      if (isContractDump(data)) {
        throw new Error(
          'Legacy capability dumps are no longer supported. Convert first: mcpcontract convert <file>'
        );
      }
      throw new Error('Input is not an MCP description (mcpdesc) document');
    }

    // Add _meta convenience alias for x-cisco-metadata (avoids bracket notation in templates)
    if (data['x-cisco-metadata']) {
      data._meta = data['x-cisco-metadata'];
    }

    // Merge extra context into data (e.g., showDumpInformation flag)
    if (extraContext) {
      Object.assign(data, extraContext);
    }
    
    return this.render({
      template: templateName || 'default',
      data,
    });
  }

  /**
   * List available built-in templates with descriptions
   */
  getAvailableTemplates(): Array<{ name: string; description: string }> {
    return [
      { name: 'mcpdesc-documentation', description: 'Detailed MCP description with tools, prompts, and resources' },
      { name: 'reference-documentation', description: 'Concise reference format with summary and details sections' },
      { name: 'card-view', description: 'Self-contained HTML card view with collapsible sections' },
    ];
  }
}
