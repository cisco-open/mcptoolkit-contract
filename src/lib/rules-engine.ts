// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Rules Engine - Apply backward compatibility rules to diffs
 */

import * as yaml from 'yaml';
import * as fs from 'fs';
import { Change } from './differ.js';

export interface Rule {
  changeType: string;
  breaking: boolean;
  severity: 'info' | 'major' | 'critical';
  message: string;
  rationale?: string;
  migration?: string;
  example?: string;
  note?: string;
  details?: string;
  conditions?: Array<{
    field: string;
    operator: 'equals' | 'notEquals' | 'contains' | 'notContains' | 'hasAdditions' | 'hasRemovals' | 'onlyAdditions' | 'onlyRemovals';
    value: any;
  }>;
}

export interface RulesConfig {
  version: string;
  description?: string;
  rules: {
    tools?: Rule[];
    prompts?: Rule[];
    resources?: Rule[];
    resourceTemplates?: Rule[];
    serverInfo?: Rule[];
  };
  metadata?: any;
}

export interface AnnotatedChange extends Change {
  breaking?: boolean;
  severity?: string;
  ruleMessage?: string;
  rationale?: string;
  migration?: string;
  changeCategory?: 'breaking' | 'new' | 'update' | 'deleted';
  impact?: {
    level: 'high' | 'medium' | 'low';
    affectedUsers?: string;
  };
  details?: {
    what: string;
    whatBrief?: string;
    why?: string;
    before?: string;
    after?: string;
    capabilityName?: string;
    diff?: string;
    beforeSnippet?: string;
    afterSnippet?: string;
  };
}

export interface AnalysisResult {
  schemaVersion: string;
  diffSource: string;
  rulesApplied: string;
  metadata: {
    old: {
      name: string;
      version: string;
    };
    new: {
      name: string;
      version: string;
    };
  };
  summary: {
    totalChanges: number;
    breakingChanges: number;
    compatibleChanges: number;
    status: 'BACKWARD_COMPATIBLE' | 'BREAKING_CHANGES';
    exitCode: number;
  };
  categorization: {
    breaking: string[];
    new: string[];
    updates: string[];
    deleted: string[];
  };
  versioningSuggestion: {
    recommendedBump: 'major' | 'minor' | 'patch';
    reason: string;
    suggestedVersion?: string;
  };
  changes: AnnotatedChange[];
}

export class RulesEngine {
  private rules: RulesConfig;

  constructor(rulesPath: string) {
    const rulesContent = fs.readFileSync(rulesPath, 'utf-8');
    this.rules = yaml.parse(rulesContent);
  }

  /**
   * Check if a condition matches
   */
  private checkCondition(change: Change, condition: { field: string; operator: string; value: any }): boolean {
    // For enum operators, work directly on the change object
    if (['hasAdditions', 'hasRemovals', 'onlyAdditions', 'onlyRemovals'].includes(condition.operator)) {
      return this.applyOperator(change, condition.operator, condition.value, change);
    }
    
    // For other operators, navigate to the field
    const fieldParts = condition.field.split('.');
    let value: any = change;

    // Navigate to the field
    for (const part of fieldParts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return false;
      }
    }

    return this.applyOperator(change, condition.operator, condition.value, value);
  }

  /**
   * Apply operator to a value
   */
  private applyOperator(change: Change, operator: string, conditionValue: any, value: any): boolean {
    switch (operator) {
      case 'equals':
        return value === conditionValue;
      case 'notEquals':
        return value !== conditionValue;
      case 'contains':
        return Array.isArray(value) && value.includes(conditionValue);
      case 'notContains':
        return Array.isArray(value) && !value.includes(conditionValue);
      
      // Array comparison operators for enum analysis
      case 'hasAdditions': {
        // Check if to.enum has values not in from.enum
        const fromArray = change.from?.enum || [];
        const toArray = change.to?.enum || [];
        return toArray.some((v: any) => !fromArray.includes(v));
      }
      case 'hasRemovals': {
        // Check if from.enum has values not in to.enum
        const fromArray = change.from?.enum || [];
        const toArray = change.to?.enum || [];
        return fromArray.some((v: any) => !toArray.includes(v));
      }
      case 'onlyAdditions': {
        // Check if ONLY additions (no removals)
        const fromArray = change.from?.enum || [];
        const toArray = change.to?.enum || [];
        const hasAdditions = toArray.some((v: any) => !fromArray.includes(v));
        const hasRemovals = fromArray.some((v: any) => !toArray.includes(v));
        return hasAdditions && !hasRemovals;
      }
      case 'onlyRemovals': {
        // Check if ONLY removals (no additions)
        const fromArray = change.from?.enum || [];
        const toArray = change.to?.enum || [];
        const hasAdditions = toArray.some((v: any) => !fromArray.includes(v));
        const hasRemovals = fromArray.some((v: any) => !toArray.includes(v));
        return hasRemovals && !hasAdditions;
      }
      default:
        return false;
    }
  }

  /**
   * Find matching rule for a change
   */
  private findMatchingRule(change: Change): Rule | null {
    const categoryRules = this.rules.rules[change.category];
    if (!categoryRules) {
      return null;
    }

    // Find rules that match the changeType
    const matchingRules = categoryRules.filter(rule => rule.changeType === change.changeType);

    if (matchingRules.length === 0) {
      return null;
    }

    // If there are multiple rules with conditions, check conditions
    for (const rule of matchingRules) {
      if (!rule.conditions || rule.conditions.length === 0) {
        return rule;
      }

      // Check if all conditions match
      const allConditionsMatch = rule.conditions.every(condition => 
        this.checkCondition(change, condition)
      );

      if (allConditionsMatch) {
        return rule;
      }
    }

    // If no conditional rules matched, try to find a rule without conditions
    const defaultRule = matchingRules.find(rule => !rule.conditions || rule.conditions.length === 0);
    return defaultRule || null;
  }

  /**
   * Categorize a change for changelog generation
   */
  private categorizeChange(change: AnnotatedChange): 'breaking' | 'new' | 'update' | 'deleted' {
    // Breaking changes
    if (change.breaking) {
      return 'breaking';
    }

    // Deletions
    if (change.changeType.includes('-removed') || change.changeType === 'tool-deleted' || 
        change.changeType === 'prompt-deleted' || change.changeType === 'resource-deleted' ||
        change.changeType === 'resource-template-deleted') {
      return 'deleted';
    }

    // New additions
    if (change.changeType.includes('-added') || change.changeType === 'tool-added' || 
        change.changeType === 'prompt-added' || change.changeType === 'resource-added' ||
        change.changeType === 'resource-template-added') {
      return 'new';
    }

    // Everything else is an update
    return 'update';
  }

  /**
   * Enrich change with detailed description for changelog
   */
  private enrichChangeDetails(change: AnnotatedChange): AnnotatedChange['details'] {
    const what = this.describeChange(change);
    const why = this.inferReason(change);
    const before = this.formatValue(change.from);
    const after = this.formatValue(change.to);
    const capabilityName = this.extractCapabilityName(change.path);
    const diff = this.computeDiff(change);
    const snippets = this.computeSnippets(change);

    // whatBrief: same as what but without the "Type `name`: " prefix.
    // Used in detailed sections where the capability name is already a heading.
    const label = this.getCategoryLabel(change.category);
    const prefix = `${label} \`${capabilityName}\`: `;
    const whatBrief = what.startsWith(prefix) ? what.slice(prefix.length) : what;

    return {
      what, whatBrief, why, before, after, capabilityName, diff,
      beforeSnippet: snippets?.before,
      afterSnippet: snippets?.after
    };
  }

  /**
   * Compute a simple unified-diff-style representation of what changed.
   * For description changes, extracts and diffs just the description text.
   * For other changes, diffs the full JSON representation.
   */
  private computeDiff(change: AnnotatedChange): string | undefined {
    if (change.from === undefined || change.from === null ||
        change.to === undefined || change.to === null) {
      return undefined;
    }

    // For description changes, extract just the description strings and diff them
    if (change.changeType.includes('description-changed')) {
      const fromDesc = typeof change.from === 'object' ? change.from.description : String(change.from);
      const toDesc = typeof change.to === 'object' ? change.to.description : String(change.to);
      if (fromDesc && toDesc && fromDesc !== toDesc) {
        return this.generateTextDiff(fromDesc, toDesc);
      }
    }

    // For other changes, diff the full JSON
    const fromStr = typeof change.from === 'object' ? JSON.stringify(change.from, null, 2) : String(change.from);
    const toStr = typeof change.to === 'object' ? JSON.stringify(change.to, null, 2) : String(change.to);
    if (fromStr !== toStr) {
      return this.generateTextDiff(fromStr, toStr);
    }

    return undefined;
  }

  /**
   * Generate a simple line-by-line diff between two text strings.
   * Produces unified-diff-style output with - and + prefixes.
   */
  private generateTextDiff(fromText: string, toText: string): string {
    const fromLines = fromText.split('\n');
    const toLines = toText.split('\n');
    const diffLines: string[] = [];

    const maxLen = Math.max(fromLines.length, toLines.length);
    for (let i = 0; i < maxLen; i++) {
      const fromLine = i < fromLines.length ? fromLines[i] : undefined;
      const toLine = i < toLines.length ? toLines[i] : undefined;

      if (fromLine === toLine) {
        diffLines.push(`  ${fromLine}`);
      } else {
        if (fromLine !== undefined) {
          diffLines.push(`- ${fromLine}`);
        }
        if (toLine !== undefined) {
          diffLines.push(`+ ${toLine}`);
        }
      }
    }

    return diffLines.join('\n');
  }

  /**
   * Compute smart before/after snippets that show only the changed portion
   * with minimal context. Used for rendering compact Before/After tables.
   * Returns undefined when both values are missing (additions/removals).
   */
  private computeSnippets(change: AnnotatedChange): { before: string; after: string } | undefined {
    if (change.from === undefined || change.from === null ||
        change.to === undefined || change.to === null) {
      return undefined;
    }

    // For description changes, extract the description text and diff it
    if (change.changeType.includes('description-changed')) {
      const fromDesc = typeof change.from === 'object' ? change.from.description : String(change.from);
      const toDesc = typeof change.to === 'object' ? change.to.description : String(change.to);
      if (fromDesc && toDesc && fromDesc !== toDesc) {
        return this.extractRelevantSnippets(fromDesc, toDesc);
      }
    }

    // For other changes, diff the formatted values
    const fromStr = typeof change.from === 'object' ? JSON.stringify(change.from, null, 2) : String(change.from);
    const toStr = typeof change.to === 'object' ? JSON.stringify(change.to, null, 2) : String(change.to);
    if (fromStr !== toStr) {
      return this.extractRelevantSnippets(fromStr, toStr);
    }

    return undefined;
  }

  /**
   * Extract only the changed portion from two text strings with minimal context.
   * For single-line text: shows ~40 chars around the change.
   * For multi-line text: shows only changed lines with 1 line of context.
   * Uses … to indicate truncated/omitted content.
   */
  private extractRelevantSnippets(fromText: string, toText: string): { before: string; after: string } {
    const fromLines = fromText.split('\n');
    const toLines = toText.split('\n');

    // Single-line: extract word-level context around the change
    if (fromLines.length === 1 && toLines.length === 1) {
      return this.extractSingleLineSnippets(fromLines[0], toLines[0]);
    }

    // Multi-line: extract only the changed lines with context
    return this.extractMultiLineSnippets(fromLines, toLines);
  }

  /**
   * For single-line text: find the differing portion and show it
   * with surrounding character context. Adds … for truncation.
   * Snaps to word boundaries to avoid cutting words mid-way.
   */
  private extractSingleLineSnippets(from: string, to: string): { before: string; after: string } {
    const CONTEXT = 40;

    // Find first differing character
    let start = 0;
    while (start < from.length && start < to.length && from[start] === to[start]) {
      start++;
    }

    // Find last differing character (from end)
    let fromEnd = from.length;
    let toEnd = to.length;
    while (fromEnd > start && toEnd > start && from[fromEnd - 1] === to[toEnd - 1]) {
      fromEnd--;
      toEnd--;
    }

    // If texts are identical, return them as-is
    if (start === from.length && start === to.length) {
      return { before: from, after: to };
    }

    // Expand context window around the change
    let snippetStart = Math.max(0, start - CONTEXT);
    const fromSnippetEnd = Math.min(from.length, fromEnd + CONTEXT);
    const toSnippetEnd = Math.min(to.length, toEnd + CONTEXT);

    // If context already covers the full text, return as-is (no truncation)
    if (snippetStart === 0 && fromSnippetEnd >= from.length && toSnippetEnd >= to.length) {
      return { before: from, after: to };
    }

    // Snap snippetStart forward to next word boundary (space) to avoid cutting mid-word
    if (snippetStart > 0) {
      const nextSpace = from.indexOf(' ', snippetStart);
      if (nextSpace !== -1 && nextSpace < start) {
        snippetStart = nextSpace + 1;
      }
    }

    const prefix = snippetStart > 0 ? '…' : '';
    const fromSuffix = fromSnippetEnd < from.length ? '…' : '';
    const toSuffix = toSnippetEnd < to.length ? '…' : '';

    return {
      before: prefix + from.slice(snippetStart, fromSnippetEnd) + fromSuffix,
      after: prefix + to.slice(snippetStart, toSnippetEnd) + toSuffix
    };
  }

  /**
   * For multi-line text: find the changed lines and show them
   * with 1 line of context above/below. Uses … for omitted lines.
   */
  private extractMultiLineSnippets(fromLines: string[], toLines: string[]): { before: string; after: string } {
    // Find first changed line
    let firstDiff = 0;
    const minLen = Math.min(fromLines.length, toLines.length);
    while (firstDiff < minLen && fromLines[firstDiff] === toLines[firstDiff]) {
      firstDiff++;
    }

    // Find last changed line (from end)
    let fromLastDiff = fromLines.length - 1;
    let toLastDiff = toLines.length - 1;
    while (fromLastDiff > firstDiff && toLastDiff > firstDiff &&
           fromLines[fromLastDiff] === toLines[toLastDiff]) {
      fromLastDiff--;
      toLastDiff--;
    }

    // Add 1 line of context above and below
    const contextStart = Math.max(0, firstDiff - 1);
    const fromContextEnd = Math.min(fromLines.length - 1, fromLastDiff + 1);
    const toContextEnd = Math.min(toLines.length - 1, toLastDiff + 1);

    const beforeLines = fromLines.slice(contextStart, fromContextEnd + 1);
    const afterLines = toLines.slice(contextStart, toContextEnd + 1);

    // If context covers everything, return full text (no truncation)
    if (contextStart === 0 && fromContextEnd >= fromLines.length - 1 && toContextEnd >= toLines.length - 1) {
      return { before: fromLines.join('\n'), after: toLines.join('\n') };
    }

    const prefix = contextStart > 0 ? '…\n' : '';
    const fromSuffix = fromContextEnd < fromLines.length - 1 ? '\n…' : '';
    const toSuffix = toContextEnd < toLines.length - 1 ? '\n…' : '';

    return {
      before: prefix + beforeLines.join('\n') + fromSuffix,
      after: prefix + afterLines.join('\n') + toSuffix
    };
  }

  /**
   * Extract capability name from path, handling both bracket and dot notation
   * Examples:
   * - "resources[ai-defense-api.json]" -> "ai-defense-api.json"
   * - "tools[search-inventory]" -> "search-inventory"
   * - "dumpDetails.dumpExecution.corsSupport" -> "corsSupport"
   */
  private extractCapabilityName(path: string): string {
    // Handle bracket notation: resources[name], tools[name]
    const bracketMatch = path.match(/\[([^\]]+)\]/);
    if (bracketMatch) {
      return bracketMatch[1];
    }
    
    // Handle dot notation: get the last segment for nested properties
    const segments = path.split('.');
    return segments[segments.length - 1] || path;
  }

  /**
   * Get the singular capability type label from category
   */
  private getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      tools: 'Tool',
      prompts: 'Prompt',
      resources: 'Resource',
      resourceTemplates: 'Resource Template',
      serverInfo: 'Server'
    };
    return labels[category] || category;
  }

  /**
   * Generate human-readable description of what changed.
   * Output uses markdown backticks for identifiers and consistent
   * "<CapabilityType> `name`: <what changed>" voice.
   */
  private describeChange(change: AnnotatedChange): string {
    const { changeType, path, category } = change;

    const capabilityName = this.extractCapabilityName(path);
    const label = this.getCategoryLabel(category);

    switch (changeType) {
      case 'tool-added':
      case 'prompt-added':
      case 'resource-added':
      case 'resource-template-added': {
        let description = `${label} \`${capabilityName}\`: added`;
        
        // Add type hint for resources to make changelog more informative
        if ((changeType === 'resource-added' || changeType === 'resource-template-added') && change.to) {
          const resource = change.to as any;
          if (resource?.mimeType) {
            description += ` (${resource.mimeType})`;
          }
        }
        
        return description;
      }
      
      case 'tool-deleted':
      case 'prompt-deleted':
      case 'resource-deleted':
      case 'resource-template-deleted':
        return `${label} \`${capabilityName}\`: removed`;
      
      case 'parameter-added': {
        const paramName = path.split('.').pop();
        return `${label} \`${capabilityName}\`: parameter \`${paramName}\` added`;
      }
      
      case 'parameter-removed': {
        const paramName = path.split('.').pop();
        return `${label} \`${capabilityName}\`: parameter \`${paramName}\` removed`;
      }
      
      case 'parameter-required-changed':
      case 'parameter-made-required':
      case 'parameter-made-optional': {
        const paramName = path.split('.').pop();
        const nowRequired = change.to === true || changeType === 'parameter-made-required';
        return `${label} \`${capabilityName}\`: parameter \`${paramName}\` ${nowRequired ? 'now required' : 'now optional'}`;
      }
      
      case 'parameter-type-changed': {
        const paramName = path.split('.').pop();
        return `${label} \`${capabilityName}\`: parameter \`${paramName}\` type changed`;
      }
      
      case 'parameter-enum-values-changed': {
        const paramName = path.split('.').pop();
        return `${label} \`${capabilityName}\`: parameter \`${paramName}\` enum values changed`;
      }
      
      case 'parameter-description-changed': {
        const paramName = path.split('.').pop();
        // paramName is 'description', we need the actual parameter name from the path
        // path format: tools[name].inputSchema.properties.paramName.description
        const parts = path.split('.');
        const descIdx = parts.lastIndexOf('description');
        const actualParam = descIdx > 0 ? parts[descIdx - 1] : paramName;
        return `${label} \`${capabilityName}\`: description changed for parameter \`${actualParam}\``;
      }

      case 'tool-description-changed':
      case 'prompt-description-changed':
      case 'resource-description-changed':
      case 'resource-template-description-changed':
      case 'description-changed':
        return `${label} \`${capabilityName}\`: description changed`;
      
      case 'uri-pattern-changed':
        return `${label} \`${capabilityName}\`: URI pattern changed`;
      
      default:
        return `${label} \`${capabilityName}\`: ${changeType.replace(/-/g, ' ')}`;
    }
  }

  /**
   * Infer reason for change based on type
   */
  private inferReason(change: AnnotatedChange): string | undefined {
    if (change.rationale) {
      return change.rationale;
    }

    const { changeType } = change;

    // Common patterns
    if (changeType.includes('-added')) {
      return 'New capability added';
    }
    if (changeType.includes('-removed') || changeType.includes('-deleted')) {
      return 'Feature no longer supported';
    }
    if (changeType.includes('-description-')) {
      return 'Documentation improvement';
    }
    if (changeType.includes('-required-')) {
      return 'API requirement change';
    }

    return undefined;
  }

  /**
   * Format a value for display in changelog
   */
  private formatValue(value: any): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value === 'object') {
      // Format objects/arrays as JSON
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return String(value);
      }
    }

    return String(value);
  }

  /**
   * Determine impact level based on change characteristics
   */
  private assessImpact(change: AnnotatedChange): AnnotatedChange['impact'] {
    // High impact: Breaking changes, deletions
    if (change.breaking || change.changeType.includes('-deleted') || change.changeType.includes('-removed')) {
      return {
        level: 'high',
        affectedUsers: 'All users of this capability'
      };
    }

    // Medium impact: Required parameter changes, type changes
    if (change.changeType.includes('-required-') && change.to === true) {
      return {
        level: 'medium',
        affectedUsers: 'Users calling this capability'
      };
    }

    if (change.changeType.includes('-type-changed')) {
      return {
        level: 'medium',
        affectedUsers: 'Users relying on parameter types'
      };
    }

    // Low impact: Additions, description changes
    return {
      level: 'low',
      affectedUsers: change.changeType.includes('-added') ? 'No impact (new feature)' : 'Minimal impact'
    };
  }

  /**
   * Recommend semantic version bump based on changes
   */
  private recommendVersionBump(categorization: { breaking: string[]; new: string[]; updates: string[]; deleted: string[] }): {
    recommendedBump: 'major' | 'minor' | 'patch';
    reason: string;
  } {
    if (categorization.breaking.length > 0) {
      return {
        recommendedBump: 'major',
        reason: `${categorization.breaking.length} breaking ${categorization.breaking.length === 1 ? 'change' : 'changes'} detected`
      };
    }

    if (categorization.new.length > 0 || categorization.deleted.length > 0) {
      return {
        recommendedBump: 'minor',
        reason: categorization.new.length > 0 
          ? `${categorization.new.length} new ${categorization.new.length === 1 ? 'feature' : 'features'} added`
          : `${categorization.deleted.length} ${categorization.deleted.length === 1 ? 'feature' : 'features'} removed`
      };
    }

    return {
      recommendedBump: 'patch',
      reason: 'Only backward-compatible updates'
    };
  }

  /**
   * Extract version metadata from diff
   */
  private extractMetadata(diffData: any): { 
    old: { name: string; version: string; protocolVersion?: string; capabilities?: string[] }; 
    new: { name: string; version: string; protocolVersion?: string; capabilities?: string[] } 
  } {
    let oldVersion = '';
    let newVersion = '';
    let oldName = '';
    let newName = '';
    let oldProtocolVersion: string | undefined;
    let newProtocolVersion: string | undefined;
    let oldCapabilities: string[] | undefined;
    let newCapabilities: string[] | undefined;

    // Extract from diff.metadata (new structure)
    if (diffData.metadata) {
      oldVersion = diffData.metadata.old?.version || '';
      newVersion = diffData.metadata.new?.version || '';
      oldName = diffData.metadata.old?.name || '';
      newName = diffData.metadata.new?.name || '';
      oldProtocolVersion = diffData.metadata.old?.protocolVersion;
      newProtocolVersion = diffData.metadata.new?.protocolVersion;
      oldCapabilities = diffData.metadata.old?.capabilities;
      newCapabilities = diffData.metadata.new?.capabilities;
    }

    // Fallback: Try to extract from serverInfo changes (backward compatibility)
    if (!oldVersion || !newVersion) {
      const versionChange = diffData.changes?.find((c: Change) => 
        c.category === 'serverInfo' && c.path.endsWith('.version')
      );
      
      if (versionChange) {
        oldVersion = oldVersion || versionChange.from || '';
        newVersion = newVersion || versionChange.to || '';
      }
    }

    // Fallback: Try to extract server name from changes
    if (!oldName || !newName) {
      const nameChange = diffData.changes?.find((c: Change) => 
        c.category === 'serverInfo' && c.path.endsWith('.name')
      );
      
      if (nameChange) {
        oldName = oldName || nameChange.from || '';
        newName = newName || nameChange.to || '';
      }
    }

    return {
      old: {
        name: oldName,
        version: oldVersion,
        protocolVersion: oldProtocolVersion,
        capabilities: oldCapabilities
      },
      new: {
        name: newName,
        version: newVersion,
        protocolVersion: newProtocolVersion,
        capabilities: newCapabilities
      }
    };
  }

  /**
   * Calculate suggested next version based on current version and bump type
   */
  private suggestNextVersion(currentVersion: string | undefined, bump: 'major' | 'minor' | 'patch'): string | undefined {
    if (!currentVersion) {
      return undefined;
    }

    // Parse semantic version (e.g., "2.4.0" or "v2.4.0")
    const versionMatch = currentVersion.match(/^v?(\d+)\.(\d+)\.(\d+)/);
    if (!versionMatch) {
      return undefined;
    }

    let [, major, minor, patch] = versionMatch.map(Number);

    switch (bump) {
      case 'major':
        return `${major + 1}.0.0`;
      case 'minor':
        return `${major}.${minor + 1}.0`;
      case 'patch':
        return `${major}.${minor}.${patch + 1}`;
    }
  }

  /**
   * Apply rules to a list of changes
   */
  applyRules(changes: Change[]): AnnotatedChange[] {
    return changes.map(change => {
      const rule = this.findMatchingRule(change);

      let annotated: AnnotatedChange;

      if (rule) {
        annotated = {
          ...change,
          breaking: rule.breaking,
          severity: rule.severity,
          ruleMessage: rule.message,
          rationale: rule.rationale,
          migration: rule.migration
        };
      } else {
        // Default: if no rule found, assume breaking for removals/changes, compatible for additions
        const isAddition = change.changeType.includes('-added');
        const isDescriptionChange = change.changeType.includes('-description-');

        annotated = {
          ...change,
          breaking: !isAddition && !isDescriptionChange,
          severity: 'major',
          ruleMessage: 'No specific rule found - using default heuristic'
        };
      }

      // Enrich with categorization, details, and impact
      annotated.changeCategory = this.categorizeChange(annotated);
      annotated.details = this.enrichChangeDetails(annotated);
      annotated.impact = this.assessImpact(annotated);

      return annotated;
    });
  }

  /**
   * Analyze a diff and apply rules
   */
  analyze(diffData: any, diffSource: string, rulesPath: string): AnalysisResult {
    const annotatedChanges = this.applyRules(diffData.changes);

    const breakingCount = annotatedChanges.filter(c => c.breaking).length;
    const compatibleCount = annotatedChanges.filter(c => !c.breaking).length;

    // Build categorization
    const categorization = {
      breaking: annotatedChanges.filter(c => c.changeCategory === 'breaking').map(c => c.id),
      new: annotatedChanges.filter(c => c.changeCategory === 'new').map(c => c.id),
      updates: annotatedChanges.filter(c => c.changeCategory === 'update').map(c => c.id),
      deleted: annotatedChanges.filter(c => c.changeCategory === 'deleted').map(c => c.id)
    };

    // Extract metadata
    const metadata = this.extractMetadata(diffData);

    // Generate versioning suggestion
    const versionBump = this.recommendVersionBump(categorization);
    const versioningSuggestion = {
      ...versionBump,
      suggestedVersion: this.suggestNextVersion(metadata.old.version, versionBump.recommendedBump)
    };

    const summary = {
      totalChanges: annotatedChanges.length,
      breakingChanges: breakingCount,
      compatibleChanges: compatibleCount,
      status: (breakingCount > 0 ? 'BREAKING_CHANGES' : 'BACKWARD_COMPATIBLE') as 'BACKWARD_COMPATIBLE' | 'BREAKING_CHANGES',
      exitCode: breakingCount > 0 ? 1 : 0
    };

    return {
      schemaVersion: 'https://developer.cisco.com/mcpcontract/schema/diff-breaking/2.0.0',
      diffSource,
      rulesApplied: rulesPath,
      metadata,
      summary,
      categorization,
      versioningSuggestion,
      changes: annotatedChanges
    };
  }
}
