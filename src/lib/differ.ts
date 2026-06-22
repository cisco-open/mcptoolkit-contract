// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Differ - Generates structural diffs between MCP dumps or manifests
 * 
 * This class compares two MCP contract dumps or manifests and produces a detailed
 * diff describing all changes using MCP-specific terminology (tool-added, 
 * parameter-removed, etc.).
 */

import { v4 as uuidv4 } from 'uuid';
import * as semver from 'semver';

export interface DiffOptions {
  detectRenames?: boolean;
}

export interface ComparisonMetadata {
  from: {
    file: string;
    schemaVersion?: string;
    serverVersion: string;
    sessionIdSupported?: boolean;
    sessionIdHeader?: string;
  };
  to: {
    file: string;
    schemaVersion?: string;
    serverVersion: string;
    sessionIdSupported?: boolean;
    sessionIdHeader?: string;
  };
}

export interface Change {
  id: string;
  category: 'tools' | 'prompts' | 'resources' | 'resourceTemplates' | 'serverInfo';
  changeType: string;
  path: string;
  description: string;
  from: any;
  to: any;
}

export interface DiffStatistics {
  tools: { added: number; removed: number; renamed: number; modified: number };
  prompts: { added: number; removed: number; renamed: number; modified: number };
  resources: { added: number; removed: number; renamed: number; modified: number };
  resourceTemplates: { added: number; removed: number; renamed: number; modified: number };
}

export interface DiffResult {
  schemaVersion: string;
  metadata: {
    old: {
      name: string;
      version: string;
      protocolVersion?: string;
      capabilities?: string[];
    };
    new: {
      name: string;
      version: string;
      protocolVersion?: string;
      capabilities?: string[];
    };
  };
  comparison: ComparisonMetadata;
  changes: Change[];
  statistics: DiffStatistics;
}

export interface Dump {
  version?: string;
  dumpDetails?: {
    dumpExecution?: {
      sessionIdSupported?: boolean;
      sessionIdHeader?: string;
      corsSupport?: {
        browserReady: boolean | null;
        responseHeaders?: {
          accessControlAllowOrigin?: string;
          accessControlExposeHeaders?: string[];
        };
        preflight?: {
          tested: boolean;
          status?: number;
          accessControlAllowOrigin?: string;
          accessControlAllowMethods?: string[];
          accessControlAllowHeaders?: string[];
        };
      };
    };
  };
  serverInfo: {
    name: string;
    version: string;
    title?: string;
    description?: string;
    websiteUrl?: string;
    icons?: unknown[];
    protocolVersion: string;
    capabilities?: {
      tools?: { listChanged?: boolean };
      resources?: { listChanged?: boolean; subscribe?: boolean };
      prompts?: { listChanged?: boolean };
      resourceTemplates?: { listChanged?: boolean };
      logging?: Record<string, unknown>;
      experimental?: Record<string, unknown>;
      [key: string]: any;
    };
  };
  tools: Array<{
    name: string;
    description?: string;
    inputSchema: any;
  }>;
  prompts: Array<{
    name: string;
    description?: string;
    arguments?: any[];
  }>;
  resources: Array<{
    name: string;
    uri: string;
    description?: string;
    mimeType?: string;
  }>;
  resourceTemplates: Array<{
    name: string;
    uriTemplate: string;
    description?: string;
    mimeType?: string;
  }>;
}

export interface Manifest {
  name: string;
  version: string;
  description: string;
  packages?: any[];
  remotes?: any[];
}

export class Differ {
  constructor(_options: DiffOptions = {}) {
    // Options will be used for future features like --detect-renames
  }

  /**
   * Auto-detect if a file is a dump/mcpdesc or manifest
   */
  private detectType(data: any): 'dump' | 'manifest' {
    if (data.mcpdesc || data.dumpDetails || data.serverInfo) {
      return 'dump';
    }
    if (data.packages || data.remotes) {
      return 'manifest';
    }
    // Default to dump if unclear
    return 'dump';
  }

  /**
   * Validate schema version compatibility
   * Returns: { compatible: boolean, warning?: string, error?: string }
   */
  private validateSchemaVersions(fromSchema: string, toSchema: string): {
    compatible: boolean;
    warning?: string;
    error?: string;
  } {
    // Extract version from schema URLs
    const fromMatch = fromSchema.match(/\/schema\/(\d+\.\d+\.\d+)$/);
    const toMatch = toSchema.match(/\/schema\/(\d+\.\d+\.\d+)$/);

    if (!fromMatch || !toMatch) {
      return { compatible: true }; // Can't validate, proceed
    }

    const fromVer = fromMatch[1];
    const toVer = toMatch[1];

    if (fromVer === toVer) {
      return { compatible: true };
    }

    const fromSemver = semver.parse(fromVer);
    const toSemver = semver.parse(toVer);

    if (!fromSemver || !toSemver) {
      return { compatible: true }; // Can't parse, proceed
    }

    // Major version difference - incompatible
    if (fromSemver.major !== toSemver.major) {
      return {
        compatible: false,
        error: `Incompatible schema versions: ${fromVer} vs ${toVer}. Please provide files with compatible schema versions.`
      };
    }

    // Minor or patch difference - proceed with warning
    if (fromSemver.minor !== toSemver.minor || fromSemver.patch !== toSemver.patch) {
      return {
        compatible: true,
        warning: `Detected minor schema version difference: ${fromVer} vs ${toVer}. The command will proceed but may produce inaccurate results.`
      };
    }

    return { compatible: true };
  }

  /**
   * Compare two dumps
   */
  async compareDumps(
    fromDump: Dump,
    toDump: Dump,
    fromFile: string,
    toFile: string
  ): Promise<DiffResult> {
    const changes: Change[] = [];

    // Build comparison metadata
    // Note: schemaVersion here is the legacy dump schema $id — remove at v1.0
    const comparison: ComparisonMetadata = {
      from: {
        file: fromFile,
        schemaVersion: fromDump.version,
        serverVersion: fromDump.serverInfo.version,
        sessionIdSupported: fromDump.dumpDetails?.dumpExecution?.sessionIdSupported,
        sessionIdHeader: fromDump.dumpDetails?.dumpExecution?.sessionIdHeader
      },
      to: {
        file: toFile,
        schemaVersion: toDump.version,
        serverVersion: toDump.serverInfo.version,
        sessionIdSupported: toDump.dumpDetails?.dumpExecution?.sessionIdSupported,
        sessionIdHeader: toDump.dumpDetails?.dumpExecution?.sessionIdHeader
      }
    };

    // Validate schema versions
    if (fromDump.version && toDump.version) {
      const validation = this.validateSchemaVersions(fromDump.version, toDump.version);
      if (!validation.compatible) {
        throw new Error(validation.error);
      }
      if (validation.warning) {
        console.warn(`⚠️  ${validation.warning}`);
      }
    }

    // Check session support changes (breaking change)
    if (comparison.from.sessionIdSupported !== undefined &&
        comparison.to.sessionIdSupported !== undefined &&
        comparison.from.sessionIdSupported !== comparison.to.sessionIdSupported) {
      changes.push({
        id: uuidv4(),
        category: 'serverInfo',
        changeType: 'session-support-changed',
        path: 'dumpDetails.dumpExecution.sessionIdSupported',
        description: `Session support changed from ${comparison.from.sessionIdSupported} to ${comparison.to.sessionIdSupported}`,
        from: comparison.from.sessionIdSupported,
        to: comparison.to.sessionIdSupported
      });
    }

    // Check session header name changes (notable but not breaking)
    if (comparison.from.sessionIdHeader && comparison.to.sessionIdHeader &&
        comparison.from.sessionIdHeader !== comparison.to.sessionIdHeader) {
      changes.push({
        id: uuidv4(),
        category: 'serverInfo',
        changeType: 'session-header-name-changed',
        path: 'dumpDetails.dumpExecution.sessionIdHeader',
        description: `Session header name changed from "${comparison.from.sessionIdHeader}" to "${comparison.to.sessionIdHeader}"`,
        from: comparison.from.sessionIdHeader,
        to: comparison.to.sessionIdHeader
      });
    }

    // Check CORS support changes
    const corsChanges = this.compareCorsSupport(
      fromDump.dumpDetails?.dumpExecution?.corsSupport,
      toDump.dumpDetails?.dumpExecution?.corsSupport
    );
    changes.push(...corsChanges);

    // Compare server capabilities
    const capabilityChanges = this.compareServerCapabilities(
      fromDump.serverInfo,
      toDump.serverInfo
    );
    changes.push(...capabilityChanges);

    // Compare tools
    const toolChanges = this.compareTools(fromDump.tools, toDump.tools);
    changes.push(...toolChanges);

    // Compare prompts
    const promptChanges = this.comparePrompts(fromDump.prompts, toDump.prompts);
    changes.push(...promptChanges);

    // Compare resources
    const resourceChanges = this.compareResources(fromDump.resources, toDump.resources);
    changes.push(...resourceChanges);

    // Compare resource templates
    const resourceTemplateChanges = this.compareResourceTemplates(
      fromDump.resourceTemplates,
      toDump.resourceTemplates
    );
    changes.push(...resourceTemplateChanges);

    // Calculate statistics
    const statistics = this.calculateStatistics(changes);

    // Build metadata
    const metadata = {
      old: {
        name: fromDump.serverInfo.name,
        version: fromDump.serverInfo.version,
        ...(fromDump.serverInfo.title && { title: fromDump.serverInfo.title }),
        ...(fromDump.serverInfo.description && { description: fromDump.serverInfo.description }),
        protocolVersion: fromDump.serverInfo.protocolVersion,
        capabilities: fromDump.serverInfo.capabilities ? Object.keys(fromDump.serverInfo.capabilities) : undefined
      },
      new: {
        name: toDump.serverInfo.name,
        version: toDump.serverInfo.version,
        ...(toDump.serverInfo.title && { title: toDump.serverInfo.title }),
        ...(toDump.serverInfo.description && { description: toDump.serverInfo.description }),
        protocolVersion: toDump.serverInfo.protocolVersion,
        capabilities: toDump.serverInfo.capabilities ? Object.keys(toDump.serverInfo.capabilities) : undefined
      }
    };

    return {
      schemaVersion: 'https://developer.cisco.com/mcpcontract/schema/diff/1.0.0',
      metadata,
      comparison,
      changes,
      statistics
    };
  }

  /**
   * Compare tools
   */
  private compareTools(fromTools: any[], toTools: any[]): Change[] {
    const changes: Change[] = [];
    const fromMap = new Map(fromTools.map(t => [t.name, t]));
    const toMap = new Map(toTools.map(t => [t.name, t]));

    // Check for removals and modifications
    for (const [name, fromTool] of fromMap.entries()) {
      if (!toMap.has(name)) {
        changes.push({
          id: uuidv4(),
          category: 'tools',
          changeType: 'tool-removed',
          path: `tools[${name}]`,
          description: `Tool '${name}' was removed`,
          from: fromTool,
          to: null
        });
      } else {
        const toTool = toMap.get(name)!;
        const toolChanges = this.compareToolDetails(name, fromTool, toTool);
        changes.push(...toolChanges);
      }
    }

    // Check for additions
    for (const [name, toTool] of toMap.entries()) {
      if (!fromMap.has(name)) {
        changes.push({
          id: uuidv4(),
          category: 'tools',
          changeType: 'tool-added',
          path: `tools[${name}]`,
          description: `Tool '${name}' was added`,
          from: null,
          to: toTool
        });
      }
    }

    return changes;
  }

  /**
   * Compare individual tool details
   */
  private compareToolDetails(name: string, fromTool: any, toTool: any): Change[] {
    const changes: Change[] = [];

    // Check description change
    if (fromTool.description !== toTool.description) {
      changes.push({
        id: uuidv4(),
        category: 'tools',
        changeType: 'tool-description-changed',
        path: `tools[${name}].description`,
        description: `Tool '${name}' description changed`,
        from: fromTool.description,
        to: toTool.description
      });
    }

    // Check tags change (enrichment field)
    if (JSON.stringify(fromTool.tags || []) !== JSON.stringify(toTool.tags || [])) {
      changes.push({
        id: uuidv4(),
        category: 'tools',
        changeType: 'tool-tags-changed',
        path: `tools[${name}].tags`,
        description: `Tool '${name}' tags changed`,
        from: fromTool.tags || [],
        to: toTool.tags || []
      });
    }

    // Check deprecated status change (enrichment field)
    if (fromTool.deprecated !== toTool.deprecated) {
      changes.push({
        id: uuidv4(),
        category: 'tools',
        changeType: 'tool-deprecated-changed',
        path: `tools[${name}].deprecated`,
        description: `Tool '${name}' deprecated status changed`,
        from: fromTool.deprecated || false,
        to: toTool.deprecated || false
      });
    }

    // Check outputSchema change (protocol field)
    if (JSON.stringify(fromTool.outputSchema) !== JSON.stringify(toTool.outputSchema)) {
      changes.push({
        id: uuidv4(),
        category: 'tools',
        changeType: 'tool-output-schema-changed',
        path: `tools[${name}].outputSchema`,
        description: `Tool '${name}' output schema changed`,
        from: fromTool.outputSchema || null,
        to: toTool.outputSchema || null
      });
    }

    // Check responseExamples change (enrichment field)
    if (JSON.stringify(fromTool.responseExamples || []) !== JSON.stringify(toTool.responseExamples || [])) {
      changes.push({
        id: uuidv4(),
        category: 'tools',
        changeType: 'tool-response-examples-changed',
        path: `tools[${name}].responseExamples`,
        description: `Tool '${name}' response examples changed`,
        from: fromTool.responseExamples || [],
        to: toTool.responseExamples || []
      });
    }

    // Compare parameters
    const paramChanges = this.compareParameters(name, fromTool.inputSchema, toTool.inputSchema);
    changes.push(...paramChanges);

    return changes;
  }

  /**
   * Compare tool parameters (inputSchema)
   */
  private compareParameters(toolName: string, fromSchema: any, toSchema: any): Change[] {
    const changes: Change[] = [];

    const fromProps = fromSchema?.properties || {};
    const toProps = toSchema?.properties || {};
    const fromRequired = new Set(fromSchema?.required || []);
    const toRequired = new Set(toSchema?.required || []);

    // Check for parameter removals and modifications
    for (const [paramName, fromParam] of Object.entries(fromProps)) {
      if (!toProps[paramName]) {
        changes.push({
          id: uuidv4(),
          category: 'tools',
          changeType: 'parameter-removed',
          path: `tools[${toolName}].inputSchema.properties.${paramName}`,
          description: `Parameter '${paramName}' removed from tool '${toolName}'`,
          from: fromParam,
          to: null
        });
      } else {
        const toParam = toProps[paramName];
        
        // Check type change
        if ((fromParam as any).type !== (toParam as any).type) {
          changes.push({
            id: uuidv4(),
            category: 'tools',
            changeType: 'parameter-type-changed',
            path: `tools[${toolName}].inputSchema.properties.${paramName}.type`,
            description: `Parameter '${paramName}' type changed from ${(fromParam as any).type} to ${(toParam as any).type} in tool '${toolName}'`,
            from: fromParam,
            to: toParam
          });
        }

        // Check required status change
        const wasRequired = fromRequired.has(paramName);
        const isRequired = toRequired.has(paramName);
        
        if (wasRequired !== isRequired) {
          const changeType = isRequired ? 'parameter-made-required' : 'parameter-made-optional';
          changes.push({
            id: uuidv4(),
            category: 'tools',
            changeType,
            path: `tools[${toolName}].inputSchema.required`,
            description: `Parameter '${paramName}' in tool '${toolName}' ${isRequired ? 'is now required' : 'is now optional'}`,
            from: { required: wasRequired, ...(fromParam as object) },
            to: { required: isRequired, ...(toParam as object) }
          });
        }

        // Check description change
        if ((fromParam as any).description !== (toParam as any).description) {
          changes.push({
            id: uuidv4(),
            category: 'tools',
            changeType: 'parameter-description-changed',
            path: `tools[${toolName}].inputSchema.properties.${paramName}.description`,
            description: `Parameter '${paramName}' description changed in tool '${toolName}'`,
            from: fromParam,
            to: toParam
          });
        }

        // Check enum values change
        if ((fromParam as any).enum || (toParam as any).enum) {
          const fromEnum = JSON.stringify((fromParam as any).enum || []);
          const toEnum = JSON.stringify((toParam as any).enum || []);
          if (fromEnum !== toEnum) {
            changes.push({
              id: uuidv4(),
              category: 'tools',
              changeType: 'parameter-enum-values-changed',
              path: `tools[${toolName}].inputSchema.properties.${paramName}.enum`,
              description: `Parameter '${paramName}' enum values changed in tool '${toolName}'`,
              from: fromParam,
              to: toParam
            });
          }
        }

        // Check examples change (enrichment field)
        if ((fromParam as any).examples || (toParam as any).examples) {
          const fromExamples = JSON.stringify((fromParam as any).examples || []);
          const toExamples = JSON.stringify((toParam as any).examples || []);
          if (fromExamples !== toExamples) {
            changes.push({
              id: uuidv4(),
              category: 'tools',
              changeType: 'parameter-examples-changed',
              path: `tools[${toolName}].inputSchema.properties.${paramName}.examples`,
              description: `Parameter '${paramName}' examples changed in tool '${toolName}'`,
              from: fromParam,
              to: toParam
            });
          }
        }
      }
    }

    // Check for parameter additions
    for (const [paramName, toParam] of Object.entries(toProps)) {
      if (!fromProps[paramName]) {
        const isRequired = toRequired.has(paramName);
        changes.push({
          id: uuidv4(),
          category: 'tools',
          changeType: 'parameter-added',
          path: `tools[${toolName}].inputSchema.properties.${paramName}`,
          description: `Parameter '${paramName}' ${isRequired ? '(required)' : '(optional)'} added to tool '${toolName}'`,
          from: null,
          to: { required: isRequired, ...(toParam as object) }
        });
      }
    }

    return changes;
  }

  /**
   * Compare CORS support between two dumps
   */
  private compareCorsSupport(fromCors: any, toCors: any): Change[] {
    const changes: Change[] = [];

    // If CORS support wasn't detected in either dump, skip
    if (!fromCors && !toCors) {
      return changes;
    }

    // CORS detection added (from not detected to detected)
    if (!fromCors && toCors) {
      changes.push({
        id: uuidv4(),
        category: 'serverInfo',
        changeType: 'cors-detection-added',
        path: 'dumpDetails.dumpExecution.corsSupport',
        description: 'CORS detection was added in new dump',
        from: null,
        to: toCors
      });
      return changes; // Don't compare details if it's new
    }

    // CORS detection removed (from detected to not detected)
    if (fromCors && !toCors) {
      changes.push({
        id: uuidv4(),
        category: 'serverInfo',
        changeType: 'cors-detection-removed',
        path: 'dumpDetails.dumpExecution.corsSupport',
        description: 'CORS detection was removed in new dump',
        from: fromCors,
        to: null
      });
      return changes; // Don't compare details if it's removed
    }

    // Both have CORS data, compare browserReady status
    if (fromCors.browserReady !== toCors.browserReady) {
      const fromReady = fromCors.browserReady === true ? 'ready' : 
                       fromCors.browserReady === false ? 'not ready' : 'unknown';
      const toReady = toCors.browserReady === true ? 'ready' : 
                     toCors.browserReady === false ? 'not ready' : 'unknown';
      
      changes.push({
        id: uuidv4(),
        category: 'serverInfo',
        changeType: 'cors-browser-ready-changed',
        path: 'dumpDetails.dumpExecution.corsSupport.browserReady',
        description: `Browser compatibility changed from ${fromReady} to ${toReady}`,
        from: fromCors.browserReady,
        to: toCors.browserReady
      });
    }

    // Compare CORS response headers
    if (fromCors.responseHeaders || toCors.responseHeaders) {
      const fromHeaders = fromCors.responseHeaders || {};
      const toHeaders = toCors.responseHeaders || {};

      // Check Allow-Origin change
      if (fromHeaders.accessControlAllowOrigin !== toHeaders.accessControlAllowOrigin) {
        changes.push({
          id: uuidv4(),
          category: 'serverInfo',
          changeType: 'cors-allow-origin-changed',
          path: 'dumpDetails.dumpExecution.corsSupport.responseHeaders.accessControlAllowOrigin',
          description: `CORS Allow-Origin changed from "${fromHeaders.accessControlAllowOrigin || 'none'}" to "${toHeaders.accessControlAllowOrigin || 'none'}"`,
          from: fromHeaders.accessControlAllowOrigin,
          to: toHeaders.accessControlAllowOrigin
        });
      }

      // Check Expose-Headers changes
      const fromExposeHeaders = fromHeaders.accessControlExposeHeaders || [];
      const toExposeHeaders = toHeaders.accessControlExposeHeaders || [];
      
      if (JSON.stringify(fromExposeHeaders.sort()) !== JSON.stringify(toExposeHeaders.sort())) {
        const added = toExposeHeaders.filter((h: string) => !fromExposeHeaders.includes(h));
        const removed = fromExposeHeaders.filter((h: string) => !toExposeHeaders.includes(h));
        
        if (added.length > 0 || removed.length > 0) {
          changes.push({
            id: uuidv4(),
            category: 'serverInfo',
            changeType: 'cors-expose-headers-changed',
            path: 'dumpDetails.dumpExecution.corsSupport.responseHeaders.accessControlExposeHeaders',
            description: `CORS Expose-Headers changed: ${added.length > 0 ? `added ${added.join(', ')}` : ''}${added.length > 0 && removed.length > 0 ? '; ' : ''}${removed.length > 0 ? `removed ${removed.join(', ')}` : ''}`,
            from: fromExposeHeaders,
            to: toExposeHeaders
          });
        }
      }
    }

    // Compare preflight results (if tested)
    if (fromCors.preflight?.tested && toCors.preflight?.tested) {
      const fromPreflight = fromCors.preflight;
      const toPreflight = toCors.preflight;

      // Check preflight status change
      if (fromPreflight.status !== toPreflight.status) {
        changes.push({
          id: uuidv4(),
          category: 'serverInfo',
          changeType: 'cors-preflight-status-changed',
          path: 'dumpDetails.dumpExecution.corsSupport.preflight.status',
          description: `CORS preflight status changed from ${fromPreflight.status} to ${toPreflight.status}`,
          from: fromPreflight.status,
          to: toPreflight.status
        });
      }

      // Check allowed methods changes
      const fromMethods = fromPreflight.accessControlAllowMethods || [];
      const toMethods = toPreflight.accessControlAllowMethods || [];
      
      if (JSON.stringify(fromMethods.sort()) !== JSON.stringify(toMethods.sort())) {
        changes.push({
          id: uuidv4(),
          category: 'serverInfo',
          changeType: 'cors-allow-methods-changed',
          path: 'dumpDetails.dumpExecution.corsSupport.preflight.accessControlAllowMethods',
          description: `CORS allowed methods changed`,
          from: fromMethods,
          to: toMethods
        });
      }

      // Check allowed headers changes
      const fromHeaders = fromPreflight.accessControlAllowHeaders || [];
      const toHeaders = toPreflight.accessControlAllowHeaders || [];
      
      if (JSON.stringify(fromHeaders.sort()) !== JSON.stringify(toHeaders.sort())) {
        changes.push({
          id: uuidv4(),
          category: 'serverInfo',
          changeType: 'cors-allow-headers-changed',
          path: 'dumpDetails.dumpExecution.corsSupport.preflight.accessControlAllowHeaders',
          description: `CORS allowed headers changed`,
          from: fromHeaders,
          to: toHeaders
        });
      }
    }

    return changes;
  }

  /**
   * Compare server capabilities
   */
  private compareServerCapabilities(fromServerInfo: any, toServerInfo: any): Change[] {
    const changes: Change[] = [];
    const fromCaps = fromServerInfo.capabilities || {};
    const toCaps = toServerInfo.capabilities || {};

    // Check each capability category (tools, resources, prompts, etc.)
    const categories = ['tools', 'resources', 'prompts', 'resourceTemplates', 'logging', 'experimental'];

    for (const category of categories) {
      const fromCat = fromCaps[category];
      const toCat = toCaps[category];

      // Skip if neither has this capability
      if (!fromCat && !toCat) continue;

      // Category added
      if (!fromCat && toCat) {
        changes.push({
          id: uuidv4(),
          category: 'serverInfo',
          changeType: 'capability-added',
          path: `serverInfo.capabilities.${category}`,
          description: `Server capability '${category}' was added`,
          from: null,
          to: toCat
        });
        continue;
      }

      // Category removed
      if (fromCat && !toCat) {
        changes.push({
          id: uuidv4(),
          category: 'serverInfo',
          changeType: 'capability-removed',
          path: `serverInfo.capabilities.${category}`,
          description: `Server capability '${category}' was removed`,
          from: fromCat,
          to: null
        });
        continue;
      }

      // Compare properties within the category
      if (typeof fromCat === 'object' && typeof toCat === 'object') {
        const fromProps = Object.keys(fromCat);
        const toProps = Object.keys(toCat);
        const allProps = new Set([...fromProps, ...toProps]);

        for (const prop of allProps) {
          const fromValue = fromCat[prop];
          const toValue = toCat[prop];

          // Property value changed
          if (fromValue !== toValue) {
            changes.push({
              id: uuidv4(),
              category: 'serverInfo',
              changeType: 'capability-property-changed',
              path: `serverInfo.capabilities.${category}.${prop}`,
              description: `Server capability '${category}.${prop}' changed from ${fromValue} to ${toValue}`,
              from: fromValue,
              to: toValue
            });
          }
        }
      }
    }

    return changes;
  }

  /**
   * Compare prompts
   */
  private comparePrompts(fromPrompts: any[], toPrompts: any[]): Change[] {
    const changes: Change[] = [];
    const fromMap = new Map(fromPrompts.map(p => [p.name, p]));
    const toMap = new Map(toPrompts.map(p => [p.name, p]));

    // Check for removals and modifications
    for (const [name, fromPrompt] of fromMap.entries()) {
      if (!toMap.has(name)) {
        changes.push({
          id: uuidv4(),
          category: 'prompts',
          changeType: 'prompt-removed',
          path: `prompts[${name}]`,
          description: `Prompt '${name}' was removed`,
          from: fromPrompt,
          to: null
        });
      } else {
        const toPrompt = toMap.get(name)!;
        
        // Check description change
        if (fromPrompt.description !== toPrompt.description) {
          changes.push({
            id: uuidv4(),
            category: 'prompts',
            changeType: 'prompt-description-changed',
            path: `prompts[${name}].description`,
            description: `Prompt '${name}' description changed`,
            from: fromPrompt,
            to: toPrompt
          });
        }

        // Check tags change (enrichment field)
        if (JSON.stringify(fromPrompt.tags || []) !== JSON.stringify(toPrompt.tags || [])) {
          changes.push({
            id: uuidv4(),
            category: 'prompts',
            changeType: 'prompt-tags-changed',
            path: `prompts[${name}].tags`,
            description: `Prompt '${name}' tags changed`,
            from: fromPrompt.tags || [],
            to: toPrompt.tags || []
          });
        }

        // Check deprecated status change (enrichment field)
        if (fromPrompt.deprecated !== toPrompt.deprecated) {
          changes.push({
            id: uuidv4(),
            category: 'prompts',
            changeType: 'prompt-deprecated-changed',
            path: `prompts[${name}].deprecated`,
            description: `Prompt '${name}' deprecated status changed`,
            from: fromPrompt.deprecated || false,
            to: toPrompt.deprecated || false
          });
        }

        // Compare arguments
        const argChanges = this.comparePromptArguments(name, fromPrompt.arguments || [], toPrompt.arguments || []);
        changes.push(...argChanges);
      }
    }

    // Check for additions
    for (const [name, toPrompt] of toMap.entries()) {
      if (!fromMap.has(name)) {
        changes.push({
          id: uuidv4(),
          category: 'prompts',
          changeType: 'prompt-added',
          path: `prompts[${name}]`,
          description: `Prompt '${name}' was added`,
          from: null,
          to: toPrompt
        });
      }
    }

    return changes;
  }

  /**
   * Compare prompt arguments
   */
  private comparePromptArguments(promptName: string, fromArgs: any[], toArgs: any[]): Change[] {
    const changes: Change[] = [];
    const fromMap = new Map(fromArgs.map(a => [a.name, a]));
    const toMap = new Map(toArgs.map(a => [a.name, a]));

    // Check for removals
    for (const [argName, fromArg] of fromMap.entries()) {
      if (!toMap.has(argName)) {
        changes.push({
          id: uuidv4(),
          category: 'prompts',
          changeType: 'prompt-argument-removed',
          path: `prompts[${promptName}].arguments[${argName}]`,
          description: `Argument '${argName}' removed from prompt '${promptName}'`,
          from: fromArg,
          to: null
        });
      } else {
        const toArg = toMap.get(argName)!;
        
        // Check required status change
        if (fromArg.required !== toArg.required) {
          const changeType = toArg.required ? 'prompt-argument-made-required' : 'prompt-argument-made-optional';
          changes.push({
            id: uuidv4(),
            category: 'prompts',
            changeType,
            path: `prompts[${promptName}].arguments[${argName}].required`,
            description: `Argument '${argName}' in prompt '${promptName}' ${toArg.required ? 'is now required' : 'is now optional'}`,
            from: fromArg,
            to: toArg
          });
        }

        // Check examples change (enrichment field)
        if (fromArg.examples || toArg.examples) {
          const fromExamples = JSON.stringify(fromArg.examples || []);
          const toExamples = JSON.stringify(toArg.examples || []);
          if (fromExamples !== toExamples) {
            changes.push({
              id: uuidv4(),
              category: 'prompts',
              changeType: 'prompt-argument-examples-changed',
              path: `prompts[${promptName}].arguments[${argName}].examples`,
              description: `Argument '${argName}' examples changed in prompt '${promptName}'`,
              from: fromArg,
              to: toArg
            });
          }
        }
      }
    }

    // Check for additions
    for (const [argName, toArg] of toMap.entries()) {
      if (!fromMap.has(argName)) {
        changes.push({
          id: uuidv4(),
          category: 'prompts',
          changeType: 'prompt-argument-added',
          path: `prompts[${promptName}].arguments[${argName}]`,
          description: `Argument '${argName}' ${toArg.required ? '(required)' : '(optional)'} added to prompt '${promptName}'`,
          from: null,
          to: toArg
        });
      }
    }

    return changes;
  }

  /**
   * Compare resources
   */
  private compareResources(fromResources: any[], toResources: any[]): Change[] {
    const changes: Change[] = [];
    const fromMap = new Map(fromResources.map(r => [r.name, r]));
    const toMap = new Map(toResources.map(r => [r.name, r]));

    // Check for removals and modifications
    for (const [name, fromResource] of fromMap.entries()) {
      if (!toMap.has(name)) {
        changes.push({
          id: uuidv4(),
          category: 'resources',
          changeType: 'resource-removed',
          path: `resources[${name}]`,
          description: `Resource '${name}' was removed`,
          from: fromResource,
          to: null
        });
      } else {
        const toResource = toMap.get(name)!;
        
        // Check URI change
        if (fromResource.uri !== toResource.uri) {
          changes.push({
            id: uuidv4(),
            category: 'resources',
            changeType: 'resource-uri-changed',
            path: `resources[${name}].uri`,
            description: `Resource '${name}' URI changed from '${fromResource.uri}' to '${toResource.uri}'`,
            from: fromResource,
            to: toResource
          });
        }

        // Check mimeType change
        if (fromResource.mimeType !== toResource.mimeType) {
          changes.push({
            id: uuidv4(),
            category: 'resources',
            changeType: 'resource-mimetype-changed',
            path: `resources[${name}].mimeType`,
            description: `Resource '${name}' mimeType changed from '${fromResource.mimeType}' to '${toResource.mimeType}'`,
            from: fromResource,
            to: toResource
          });
        }

        // Check description change
        if (fromResource.description !== toResource.description) {
          changes.push({
            id: uuidv4(),
            category: 'resources',
            changeType: 'resource-description-changed',
            path: `resources[${name}].description`,
            description: `Resource '${name}' description changed`,
            from: fromResource,
            to: toResource
          });
        }

        // Check tags change (enrichment field)
        if (JSON.stringify(fromResource.tags || []) !== JSON.stringify(toResource.tags || [])) {
          changes.push({
            id: uuidv4(),
            category: 'resources',
            changeType: 'resource-tags-changed',
            path: `resources[${name}].tags`,
            description: `Resource '${name}' tags changed`,
            from: fromResource.tags || [],
            to: toResource.tags || []
          });
        }

        // Check deprecated status change (enrichment field)
        if (fromResource.deprecated !== toResource.deprecated) {
          changes.push({
            id: uuidv4(),
            category: 'resources',
            changeType: 'resource-deprecated-changed',
            path: `resources[${name}].deprecated`,
            description: `Resource '${name}' deprecated status changed`,
            from: fromResource.deprecated || false,
            to: toResource.deprecated || false
          });
        }

        // Check contentExamples change (enrichment field)
        if (JSON.stringify(fromResource.contentExamples || []) !== JSON.stringify(toResource.contentExamples || [])) {
          changes.push({
            id: uuidv4(),
            category: 'resources',
            changeType: 'resource-content-examples-changed',
            path: `resources[${name}].contentExamples`,
            description: `Resource '${name}' content examples changed`,
            from: fromResource.contentExamples || [],
            to: toResource.contentExamples || []
          });
        }
      }
    }

    // Check for additions
    for (const [name, toResource] of toMap.entries()) {
      if (!fromMap.has(name)) {
        changes.push({
          id: uuidv4(),
          category: 'resources',
          changeType: 'resource-added',
          path: `resources[${name}]`,
          description: `Resource '${name}' was added`,
          from: null,
          to: toResource
        });
      }
    }

    return changes;
  }

  /**
   * Compare resource templates
   */
  private compareResourceTemplates(fromTemplates: any[], toTemplates: any[]): Change[] {
    const changes: Change[] = [];
    const fromMap = new Map(fromTemplates.map(t => [t.name, t]));
    const toMap = new Map(toTemplates.map(t => [t.name, t]));

    // Check for removals and modifications
    for (const [name, fromTemplate] of fromMap.entries()) {
      if (!toMap.has(name)) {
        changes.push({
          id: uuidv4(),
          category: 'resourceTemplates',
          changeType: 'resourcetemplate-removed',
          path: `resourceTemplates[${name}]`,
          description: `Resource template '${name}' was removed`,
          from: fromTemplate,
          to: null
        });
      } else {
        const toTemplate = toMap.get(name)!;
        
        // Check uriTemplate change
        if (fromTemplate.uriTemplate !== toTemplate.uriTemplate) {
          changes.push({
            id: uuidv4(),
            category: 'resourceTemplates',
            changeType: 'resourcetemplate-uritemplate-changed',
            path: `resourceTemplates[${name}].uriTemplate`,
            description: `Resource template '${name}' uriTemplate changed from '${fromTemplate.uriTemplate}' to '${toTemplate.uriTemplate}'`,
            from: fromTemplate,
            to: toTemplate
          });
        }

        // Check tags change (enrichment field)
        if (JSON.stringify(fromTemplate.tags || []) !== JSON.stringify(toTemplate.tags || [])) {
          changes.push({
            id: uuidv4(),
            category: 'resourceTemplates',
            changeType: 'resourcetemplate-tags-changed',
            path: `resourceTemplates[${name}].tags`,
            description: `Resource template '${name}' tags changed`,
            from: fromTemplate.tags || [],
            to: toTemplate.tags || []
          });
        }

        // Check deprecated status change (enrichment field)
        if (fromTemplate.deprecated !== toTemplate.deprecated) {
          changes.push({
            id: uuidv4(),
            category: 'resourceTemplates',
            changeType: 'resourcetemplate-deprecated-changed',
            path: `resourceTemplates[${name}].deprecated`,
            description: `Resource template '${name}' deprecated status changed`,
            from: fromTemplate.deprecated || false,
            to: toTemplate.deprecated || false
          });
        }

        // Check contentExamples change (enrichment field)
        if (JSON.stringify(fromTemplate.contentExamples || []) !== JSON.stringify(toTemplate.contentExamples || [])) {
          changes.push({
            id: uuidv4(),
            category: 'resourceTemplates',
            changeType: 'resourcetemplate-content-examples-changed',
            path: `resourceTemplates[${name}].contentExamples`,
            description: `Resource template '${name}' content examples changed`,
            from: fromTemplate.contentExamples || [],
            to: toTemplate.contentExamples || []
          });
        }
      }
    }

    // Check for additions
    for (const [name, toTemplate] of toMap.entries()) {
      if (!fromMap.has(name)) {
        changes.push({
          id: uuidv4(),
          category: 'resourceTemplates',
          changeType: 'resourcetemplate-added',
          path: `resourceTemplates[${name}]`,
          description: `Resource template '${name}' was added`,
          from: null,
          to: toTemplate
        });
      }
    }

    return changes;
  }

  /**
   * Calculate statistics from changes
   */
  private calculateStatistics(changes: Change[]): DiffStatistics {
    const stats: DiffStatistics = {
      tools: { added: 0, removed: 0, renamed: 0, modified: 0 },
      prompts: { added: 0, removed: 0, renamed: 0, modified: 0 },
      resources: { added: 0, removed: 0, renamed: 0, modified: 0 },
      resourceTemplates: { added: 0, removed: 0, renamed: 0, modified: 0 }
    };

    for (const change of changes) {
      const category = change.category;
      if (category === 'serverInfo') continue;

      if (category in stats) {
        if (change.changeType.includes('-added')) {
          stats[category].added++;
        } else if (change.changeType.includes('-removed')) {
          stats[category].removed++;
        } else if (change.changeType.includes('-renamed')) {
          stats[category].renamed++;
        } else {
          stats[category].modified++;
        }
      }
    }

    return stats;
  }

  /**
   * Main entry point for comparison
   */
  async compare(fromData: any, toData: any, fromFile: string, toFile: string): Promise<DiffResult> {
    const fromType = this.detectType(fromData);
    const toType = this.detectType(toData);

    if (fromType !== toType) {
      throw new Error(`Cannot compare different types: ${fromType} vs ${toType}`);
    }

    if (fromType === 'dump') {
      return this.compareDumps(fromData as Dump, toData as Dump, fromFile, toFile);
    } else {
      throw new Error('Manifest comparison not yet implemented. Use dumps only for now.');
    }
  }
}
