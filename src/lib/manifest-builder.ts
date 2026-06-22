// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * ManifestBuilder - Generates MCP registry-compatible manifests from MCP descriptions
 */

import { readFile } from 'node:fs/promises';
import { parse as yamlParse } from 'yaml';
import { ContractDump } from './types.js';
import { parseAsContractDump } from './mcpdesc-converter.js';

// ============================================================================
// Manifest Info Types (from manifest-info-schema.json)
// ============================================================================

export interface ManifestInfo {
  reverseDnsName: string;
  title?: string;
  description: string;
  version?: string;
  repository?: {
    url: string;
    source: string;
    id?: string;
    subfolder?: string;
  };
  websiteUrl?: string;
  icons?: Array<{
    src: string;
    sizes?: string[];
    mimeType?: string;
    theme?: 'light' | 'dark';
  }>;
  packages?: ManifestPackage[];
  remotes?: ManifestRemote[];
}

export interface ManifestPackage {
  registryType: 'npm' | 'pypi' | 'oci' | 'nuget' | 'mcpb';
  registryBaseUrl?: string;
  identifier: string;
  version?: string;
  runtimeHint?: 'npx' | 'uvx' | 'docker' | 'dnx';
  transport?: {
    type: 'stdio' | 'streamable-http' | 'sse';
    url?: string;
  };
  environmentVariables?: Array<{
    name: string;
    description?: string;
    isRequired?: boolean;
    isSecret?: boolean;
    default?: string;
    choices?: string[];
  }>;
  packageArguments?: Array<
    | { type: 'positional'; value: string; description?: string }
    | { type: 'named'; name: string; value?: string; description?: string }
  >;
  runtimeArguments?: Array<Record<string, unknown>>;
}

export interface ManifestRemote {
  type: 'streamable-http' | 'sse';
  url: string;
  headers?: Array<{
    name: string;
    description?: string;
    isRequired?: boolean;
    isSecret?: boolean;
    default?: string;
  }>;
}

// ============================================================================
// Server Manifest Types (from server.schema.json)
// ============================================================================

export interface ServerManifest {
  name: string;
  title?: string;
  version: string;
  description: string;
  repository?: {
    url: string;
    source: string;
    id?: string;
    subfolder?: string;
  };
  websiteUrl?: string;
  icons?: Array<{
    src: string;
    sizes?: string[];
    mimeType?: string;
    theme?: 'light' | 'dark';
  }>;
  packages?: ManifestPackage[];
  remotes?: ManifestRemote[];
  _meta?: {
    'io.modelcontextprotocol.registry/publisher-provided'?: {
      tool?: string;
      version?: string;
      discoveredCapabilities?: {
        toolsCount: number;
        resourcesCount: number;
        resourceTemplatesCount: number;
        promptsCount: number;
        capabilitiesDumpedAt: string;
        mcpProtocolVersion: string;
        toolNames?: string[];
        resourceNames?: string[];
        resourceTemplateNames?: string[];
        promptNames?: string[];
      };
    };
    [key: string]: unknown;
  };
}

// ============================================================================
// Validation Issue Types
// ============================================================================

export type ValidationLevel = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  level: ValidationLevel;
  message: string;
  field?: string;
  expected?: string;
  actual?: string;
}

// ============================================================================
// Builder Options
// ============================================================================

export interface ManifestBuilderOptions {
  addCapabilitiesMeta?: boolean;
  strict?: boolean; // Treat warnings as errors
}

// ============================================================================
// ManifestBuilder Class
// ============================================================================

export class ManifestBuilder {
  private dump: ContractDump;
  private info: ManifestInfo;
  private options: ManifestBuilderOptions;
  private issues: ValidationIssue[] = [];

  constructor(
    dump: ContractDump,
    info: ManifestInfo,
    options: ManifestBuilderOptions = {}
  ) {
    this.dump = dump;
    this.info = info;
    this.options = options;
  }

  /**
   * Build the server manifest with validation
   */
  public build(): { manifest: ServerManifest; issues: ValidationIssue[] } {
    this.issues = [];

    // Validate inputs
    this.validateVersionConsistency();
    this.validateTransportCompatibility();

    // Build manifest
    const manifest: ServerManifest = {
      name: this.info.reverseDnsName,
      version: this.resolveVersion(),
      description: this.info.description,
    };

    // Add optional fields
    if (this.info.title) {
      manifest.title = this.info.title;
    }

    if (this.info.repository) {
      manifest.repository = this.info.repository;
    }

    if (this.info.websiteUrl) {
      manifest.websiteUrl = this.info.websiteUrl;
    }

    if (this.info.icons && this.info.icons.length > 0) {
      manifest.icons = this.info.icons;
    }

    if (this.info.packages && this.info.packages.length > 0) {
      manifest.packages = this.info.packages;
    }

    if (this.info.remotes && this.info.remotes.length > 0) {
      manifest.remotes = this.info.remotes;
    }

    // Add capabilities metadata if requested
    if (this.options.addCapabilitiesMeta) {
      manifest._meta = this.buildMetadata();
    }

    return { manifest, issues: this.issues };
  }

  /**
   * Resolve version from info or dump
   */
  private resolveVersion(): string {
    if (this.info.version) {
      return this.info.version;
    }
    return this.dump.serverInfo.version;
  }

  /**
   * Validate version consistency between dump and info
   */
  private validateVersionConsistency(): void {
    if (!this.info.version) {
      // Info version omitted, will use dump version
      this.addIssue('info', `Using version from MCP description: ${this.dump.serverInfo.version}`);
      return;
    }

    if (this.info.version !== this.dump.serverInfo.version) {
      this.addIssue(
        'warning',
        'Version mismatch between info and MCP description',
        'version',
        this.dump.serverInfo.version,
        this.info.version
      );
    }
  }

  /**
   * Validate transport compatibility between dump connection and package config
   */
  private validateTransportCompatibility(): void {
    const extractedTransport = this.dump.dumpDetails.mcpServerConfig.transport;

    // Check package transports
    if (this.info.packages) {
      for (const pkg of this.info.packages) {
        if (pkg.transport && pkg.transport.type !== extractedTransport) {
          this.addIssue(
            'warning',
            `Package transport type (${pkg.transport.type}) differs from extraction transport (${extractedTransport})`,
            'packages.transport.type',
            extractedTransport,
            pkg.transport.type
          );
        }
      }
    }

    // Check remote transports
    if (this.info.remotes) {
      for (const remote of this.info.remotes) {
        if (remote.type !== extractedTransport) {
          this.addIssue(
            'warning',
            `Remote transport type (${remote.type}) differs from extraction transport (${extractedTransport})`,
            'remotes.type',
            extractedTransport,
            remote.type
          );
        }
      }
    }
  }

  /**
   * Build metadata section with discovered capabilities
   */
  private buildMetadata(): ServerManifest['_meta'] {
    const toolNames = this.dump.tools.map((t) => t.name);
    const resourceNames = this.dump.resources.map((r) => r.name);
    const resourceTemplateNames = this.dump.resourceTemplates.map((rt) => rt.name);
    const promptNames = this.dump.prompts.map((p) => p.name);

    return {
      'io.modelcontextprotocol.registry/publisher-provided': {
        tool: this.dump.dumpDetails.toolName,
        version: this.dump.dumpDetails.toolVersion,
        discoveredCapabilities: {
          toolsCount: this.dump.tools.length,
          resourcesCount: this.dump.resources.length,
          resourceTemplatesCount: this.dump.resourceTemplates.length,
          promptsCount: this.dump.prompts.length,
          capabilitiesDumpedAt: this.dump.dumpDetails.createdAt,
          mcpProtocolVersion: this.dump.dumpDetails.dumpExecution.mcpProtocolUsed,
          toolNames: toolNames.length > 0 ? toolNames : undefined,
          resourceNames: resourceNames.length > 0 ? resourceNames : undefined,
          resourceTemplateNames: resourceTemplateNames.length > 0 ? resourceTemplateNames : undefined,
          promptNames: promptNames.length > 0 ? promptNames : undefined,
        },
      },
    };
  }

  /**
   * Add validation issue
   */
  private addIssue(
    level: ValidationLevel,
    message: string,
    field?: string,
    expected?: string,
    actual?: string
  ): void {
    this.issues.push({ level, message, field, expected, actual });
  }

  /**
   * Static method to load and build manifest from files
   */
  public static async buildFromFiles(
    mcpdescPath: string,
    infoPath: string,
    options: ManifestBuilderOptions = {}
  ): Promise<{ manifest: ServerManifest; issues: ValidationIssue[] }> {
    // Load files
    const [mcpdescContent, infoContent] = await Promise.all([
      readFile(mcpdescPath, 'utf-8'),
      readFile(infoPath, 'utf-8'),
    ]);

    // Parse MCP description (try JSON first, then YAML), auto-detect format
    let rawData: unknown;
    try {
      rawData = JSON.parse(mcpdescContent);
    } catch {
      try {
        rawData = yamlParse(mcpdescContent);
      } catch (yamlError) {
        throw new Error(`Failed to parse MCP description file as JSON or YAML: ${(yamlError as Error).message}`);
      }
    }
    const dump: ContractDump = parseAsContractDump(rawData as Record<string, unknown>);

    // Parse info (try JSON first, then YAML)
    let info: ManifestInfo;
    try {
      info = JSON.parse(infoContent);
    } catch {
      try {
        info = yamlParse(infoContent) as ManifestInfo;
      } catch (yamlError) {
        throw new Error(`Failed to parse info file as JSON or YAML: ${(yamlError as Error).message}`);
      }
    }

    // Build manifest
    const builder = new ManifestBuilder(dump, info, options);
    return builder.build();
  }
}

// ============================================================================
// Error Types
// ============================================================================

export class ManifestGenerationError extends Error {
  constructor(
    message: string,
    public reason: string,
    public issues?: ValidationIssue[]
  ) {
    super(message);
    this.name = 'ManifestGenerationError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public issues: ValidationIssue[]
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}
