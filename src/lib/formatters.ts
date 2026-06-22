// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Output formatters for different formats: JSON, YAML, Markdown
 */

import { Document, visit } from 'yaml';
import { ContractDump, Tool, Resource, ResourceTemplate, Prompt } from './types.js';

/**
 * Regex matching YAML 1.1 implicit timestamp patterns (!!timestamp).
 * 
 * YAML 1.1 parsers (PyYAML, Ruby Psych, SnakeYAML 1.x) auto-convert these
 * to date/datetime objects, breaking consumers that expect strings.
 * YAML 1.2 removed this implicit tag, but YAML 1.1 parsers remain widely used
 * (PyYAML alone has ~300M monthly downloads).
 * 
 * Matches:
 *   - Dates:     2025-06-18
 *   - Datetimes: 2025-06-18T10:37:47Z, 2025-06-18T10:37:47.843Z
 *   - Datetime with offset: 2025-06-18T10:37:47+05:30
 *   - Space-separated: 2025-06-18 10:37:47
 * 
 * See: https://yaml.org/type/timestamp.html
 */
const YAML11_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}(:\d{2})?)?)?$/;

/**
 * Format dump as JSON
 */
export function formatJSON(dump: ContractDump, pretty?: boolean): string;
export function formatJSON(data: unknown, pretty?: boolean): string;
export function formatJSON(data: unknown, pretty: boolean = true): string {
  if (pretty) {
    return JSON.stringify(data, null, 2);
  }
  return JSON.stringify(data);
}

/**
 * Format dump as YAML
 * 
 * Quotes string values that match YAML 1.1 timestamp patterns to ensure
 * interoperability with YAML 1.1 parsers (e.g., PyYAML) that would otherwise
 * auto-convert them to date/datetime objects.
 */
export function formatYAML(dump: ContractDump): string;
export function formatYAML(data: unknown): string;
export function formatYAML(data: unknown): string {
  const doc = new Document(data);
  
  // Quote strings that YAML 1.1 parsers would interpret as timestamps
  visit(doc, {
    Scalar(_key, node) {
      if (typeof node.value === 'string' && YAML11_TIMESTAMP_RE.test(node.value)) {
        node.type = 'QUOTE_DOUBLE';
      }
    }
  });
  
  return doc.toString({ indent: 2, lineWidth: 0, minContentWidth: 0 });
}

/**
 * Format dump as Markdown documentation
 */
export function formatMarkdown(dump: ContractDump): string {
  const lines: string[] = [];

  // Title and metadata
  lines.push(`# MCP Server Contract: ${dump.dumpDetails.mcpServerConfig.name}`);
  lines.push('');
  lines.push(`**Schema:** ${dump.version}`); // Legacy dump schema version — remove at v1.0
  lines.push(`**Dump Date:** ${new Date(dump.dumpDetails.createdAt).toLocaleString()}`);
  lines.push(`**MCP Protocol Used:** ${dump.dumpDetails.dumpExecution.mcpProtocolUsed}`);
  lines.push(`**Dump Tool:** ${dump.dumpDetails.toolName} v${dump.dumpDetails.toolVersion}`);
  lines.push('');

  // Server Information
  lines.push('## Server Information');
  lines.push('');
  lines.push(`- **Name:** ${dump.serverInfo.name}`);
  lines.push(`- **Version:** ${dump.serverInfo.version}`);
  lines.push(`- **Protocol Version:** ${dump.serverInfo.protocolVersion}`);
  if (dump.serverInfo.instructions) {
    lines.push(`- **Instructions:** ${dump.serverInfo.instructions}`);
  }
  lines.push('');

  // Connection Configuration
  lines.push('## Connection Configuration');
  lines.push('');
  lines.push(`- **Transport:** ${dump.dumpDetails.mcpServerConfig.transport}`);
  
  if (dump.dumpDetails.mcpServerConfig.url) {
    lines.push(`- **URL:** ${dump.dumpDetails.mcpServerConfig.url}`);
  }
  
  if (dump.dumpDetails.mcpServerConfig.headers && Object.keys(dump.dumpDetails.mcpServerConfig.headers).length > 0) {
    lines.push('- **Headers:**');
    for (const [key, value] of Object.entries(dump.dumpDetails.mcpServerConfig.headers)) {
      lines.push(`  - \`${key}\`: ${value}`);
    }
  }
  
  if (dump.dumpDetails.mcpServerConfig.command) {
    lines.push(`- **Command:** \`${dump.dumpDetails.mcpServerConfig.command}\``);
    if (dump.dumpDetails.mcpServerConfig.args && dump.dumpDetails.mcpServerConfig.args.length > 0) {
      lines.push(`- **Arguments:** \`${dump.dumpDetails.mcpServerConfig.args.join(' ')}\``);
    }
  }
  lines.push('');

  // Session Information (HTTP streaming only)
  if (dump.dumpDetails.dumpExecution.sessionIdSupported !== undefined) {
    lines.push('## Session Information');
    lines.push('');
    if (dump.dumpDetails.dumpExecution.sessionIdSupported) {
      lines.push('- **Session Management:** ✓ Stateful (requires `Mcp-Session-Id` header)');
      lines.push('  - Server returned a session ID during initialization');
      lines.push('  - All subsequent requests must include the `Mcp-Session-Id` header');
    } else {
      lines.push('- **Session Management:** ✗ Stateless (no session required)');
      lines.push('  - Server does not use session IDs');
      lines.push('  - Requests can be made without session management');
    }
    lines.push('');
  }

  // Server Capabilities
  lines.push('## Server Capabilities');
  lines.push('');
  
  const caps = dump.serverInfo.capabilities;
  
  if (caps.tools) {
    lines.push('### Tools');
    if (caps.tools.listChanged) {
      lines.push('- ✓ Supports `listChanged` notifications');
    }
    lines.push('');
  }
  
  if (caps.resources) {
    lines.push('### Resources');
    if (caps.resources.subscribe) {
      lines.push('- ✓ Supports subscriptions');
    }
    if (caps.resources.listChanged) {
      lines.push('- ✓ Supports `listChanged` notifications');
    }
    lines.push('');
  }
  
  if (caps.prompts) {
    lines.push('### Prompts');
    if (caps.prompts.listChanged) {
      lines.push('- ✓ Supports `listChanged` notifications');
    }
    lines.push('');
  }
  
  if (caps.logging) {
    lines.push('### Logging');
    lines.push('- ✓ Logging capability enabled');
    lines.push('');
  }

  // Client Capabilities (from dumpExecution)
  const clientCaps = dump.dumpDetails.dumpExecution.clientCapabilitiesSent;
  if (clientCaps) {
    lines.push('## Client Capabilities Sent');
    lines.push('');
    
    if (clientCaps.roots) {
      lines.push('### Roots');
      if (clientCaps.roots.listChanged) {
        lines.push('- ✓ Supports `listChanged` notifications');
      }
      lines.push('');
    }
    
    if (clientCaps.sampling) {
      lines.push('### Sampling');
      lines.push('- ✓ Sampling capability enabled');
      lines.push('');
    }
  }

  // Tools
  lines.push('## Tools');
  lines.push('');
  
  if (dump.tools.length === 0) {
    lines.push('*No tools available*');
    lines.push('');
  } else {
    lines.push(`**Total:** ${dump.tools.length} tool(s)`);
    lines.push('');
    
    for (const tool of dump.tools) {
      lines.push(...formatToolMarkdown(tool));
    }
  }

  // Resources
  lines.push('## Resources');
  lines.push('');
  
  if (dump.resources.length === 0) {
    lines.push('*No resources available*');
    lines.push('');
  } else {
    lines.push(`**Total:** ${dump.resources.length} resource(s)`);
    lines.push('');
    
    for (const resource of dump.resources) {
      lines.push(...formatResourceMarkdown(resource));
    }
  }

  // Resource Templates
  lines.push('## Resource Templates');
  lines.push('');
  
  if (dump.resourceTemplates.length === 0) {
    lines.push('*No resource templates available*');
    lines.push('');
  } else {
    lines.push(`**Total:** ${dump.resourceTemplates.length} template(s)`);
    lines.push('');
    
    for (const template of dump.resourceTemplates) {
      lines.push(...formatResourceTemplateMarkdown(template));
    }
  }

  // Prompts
  lines.push('## Prompts');
  lines.push('');
  
  if (dump.prompts.length === 0) {
    lines.push('*No prompts available*');
    lines.push('');
  } else {
    lines.push(`**Total:** ${dump.prompts.length} prompt(s)`);
    lines.push('');
    
    for (const prompt of dump.prompts) {
      lines.push(...formatPromptMarkdown(prompt));
    }
  }

  // Roots
  if (dump.roots && dump.roots.length > 0) {
    lines.push('## Roots');
    lines.push('');
    lines.push(`**Total:** ${dump.roots.length} root(s)`);
    lines.push('');
    
    for (const root of dump.roots) {
      lines.push(`### ${root.name || root.uri}`);
      lines.push('');
      lines.push(`- **URI:** \`${root.uri}\``);
      if (root.name) {
        lines.push(`- **Name:** ${root.name}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

function formatToolMarkdown(tool: Tool): string[] {
  const lines: string[] = [];
  
  lines.push(`### ${tool.name}`);
  lines.push('');
  
  if (tool.description) {
    lines.push(tool.description);
    lines.push('');
  }
  
  lines.push('**Input Schema:**');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(tool.inputSchema, null, 2));
  lines.push('```');
  lines.push('');
  
  return lines;
}

function formatResourceMarkdown(resource: Resource): string[] {
  const lines: string[] = [];
  
  lines.push(`### ${resource.name}`);
  lines.push('');
  
  if (resource.description) {
    lines.push(resource.description);
    lines.push('');
  }
  
  lines.push(`- **URI:** \`${resource.uri}\``);
  
  if (resource.mimeType) {
    lines.push(`- **MIME Type:** \`${resource.mimeType}\``);
  }
  
  if (resource.annotations) {
    lines.push('- **Annotations:**');
    lines.push('  ```json');
    lines.push('  ' + JSON.stringify(resource.annotations, null, 2).split('\n').join('\n  '));
    lines.push('  ```');
  }
  
  lines.push('');
  return lines;
}

function formatResourceTemplateMarkdown(template: ResourceTemplate): string[] {
  const lines: string[] = [];
  
  lines.push(`### ${template.name}`);
  lines.push('');
  
  if (template.description) {
    lines.push(template.description);
    lines.push('');
  }
  
  lines.push(`- **URI Template:** \`${template.uriTemplate}\``);
  
  if (template.mimeType) {
    lines.push(`- **MIME Type:** \`${template.mimeType}\``);
  }
  
  if (template.annotations) {
    lines.push('- **Annotations:**');
    lines.push('  ```json');
    lines.push('  ' + JSON.stringify(template.annotations, null, 2).split('\n').join('\n  '));
    lines.push('  ```');
  }
  
  lines.push('');
  return lines;
}

function formatPromptMarkdown(prompt: Prompt): string[] {
  const lines: string[] = [];
  
  lines.push(`### ${prompt.name}`);
  lines.push('');
  
  if (prompt.description) {
    lines.push(prompt.description);
    lines.push('');
  }
  
  if (prompt.arguments && prompt.arguments.length > 0) {
    lines.push('**Arguments:**');
    lines.push('');
    
    for (const arg of prompt.arguments) {
      const required = arg.required ? '(required)' : '(optional)';
      lines.push(`- **\`${arg.name}\`** ${required}`);
      if (arg.description) {
        lines.push(`  ${arg.description}`);
      }
    }
    lines.push('');
  }
  
  return lines;
}
