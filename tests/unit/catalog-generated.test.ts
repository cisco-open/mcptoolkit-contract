// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * AUTO-GENERATED TEST FILE
 * 
 * Generated from catalog YAML files by tests/generators/catalog-test-generator.ts
 * DO NOT EDIT MANUALLY - changes will be overwritten
 * 
 * To regenerate: npm run test:generate
 */

import { describe, it, expect } from '@jest/globals';
import { RulesEngine } from '../../src/lib/rules-engine.js';
import type { Change } from '../../src/lib/differ.js';

describe('tools - Auto-generated Catalog Tests', () => {
  describe('parameter-added', () => {
    it('Adding an optional parameter is compatible [pass]', () => {
      const change: Change = {
        id: 'test-tools-parameter-added-0',
        category: 'tools',
        changeType: 'parameter-added',
        path: 'test.path',
        description: 'Adding an optional parameter is compatible',
        from: null,
        to: {"required":false,"type":"string","enum":["celsius","fahrenheit"]},
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(false);
      expect(result.severity).toBeDefined();
    });

    it('Adding a required parameter is breaking [pass]', () => {
      const change: Change = {
        id: 'test-tools-parameter-added-1',
        category: 'tools',
        changeType: 'parameter-added',
        path: 'test.path',
        description: 'Adding a required parameter is breaking',
        from: null,
        to: {"required":true,"type":"string"},
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(true);
      expect(result.severity).toBeDefined();
    });

  });

  describe('parameter-description-changed', () => {
    it('Improving parameter description is compatible [pass]', () => {
      const change: Change = {
        id: 'test-tools-parameter-description-changed-0',
        category: 'tools',
        changeType: 'parameter-description-changed',
        path: 'test.path',
        description: 'Improving parameter description is compatible',
        from: "City name",
        to: "City name (e.g., \"San Francisco\" or \"London, UK\")",
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(false);
      expect(result.severity).toBeDefined();
    });

  });

  describe('parameter-enum-values-changed', () => {
    it('Adding a new value to an existing enum is compatible [pass]', () => {
      const change: Change = {
        id: 'test-tools-parameter-enum-values-changed-0',
        category: 'tools',
        changeType: 'parameter-enum-values-changed',
        path: 'test.path',
        description: 'Adding a new value to an existing enum is compatible',
        from: {"enum":["celsius","fahrenheit"]},
        to: {"enum":["celsius","fahrenheit","kelvin"]},
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(false);
      expect(result.severity).toBeDefined();
    });

    it('Adding multiple values at once is still compatible [pass]', () => {
      const change: Change = {
        id: 'test-tools-parameter-enum-values-changed-1',
        category: 'tools',
        changeType: 'parameter-enum-values-changed',
        path: 'test.path',
        description: 'Adding multiple values at once is still compatible',
        from: {"enum":["asc","desc"]},
        to: {"enum":["asc","desc","relevance","date"]},
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(false);
      expect(result.severity).toBeDefined();
    });

    it('Adding first value to previously empty enum [pass]', () => {
      const change: Change = {
        id: 'test-tools-parameter-enum-values-changed-2',
        category: 'tools',
        changeType: 'parameter-enum-values-changed',
        path: 'test.path',
        description: 'Adding first value to previously empty enum',
        from: {"enum":[]},
        to: {"enum":["auto"]},
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(false);
      expect(result.severity).toBeDefined();
    });

    it('Removing a value from enum is breaking [pass]', () => {
      const change: Change = {
        id: 'test-tools-parameter-enum-values-changed-3',
        category: 'tools',
        changeType: 'parameter-enum-values-changed',
        path: 'test.path',
        description: 'Removing a value from enum is breaking',
        from: {"enum":["celsius","fahrenheit","kelvin"]},
        to: {"enum":["celsius","fahrenheit"]},
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(true);
      expect(result.severity).toBeDefined();
    });

    it('Replacing all enum values is breaking (both adds and removes) [pass]', () => {
      const change: Change = {
        id: 'test-tools-parameter-enum-values-changed-4',
        category: 'tools',
        changeType: 'parameter-enum-values-changed',
        path: 'test.path',
        description: 'Replacing all enum values is breaking (both adds and removes)',
        from: {"enum":["asc","desc"]},
        to: {"enum":["ascending","descending"]},
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(true);
      expect(result.severity).toBeDefined();
    });

    it('Removing some values while adding others is still breaking [pass]', () => {
      const change: Change = {
        id: 'test-tools-parameter-enum-values-changed-5',
        category: 'tools',
        changeType: 'parameter-enum-values-changed',
        path: 'test.path',
        description: 'Removing some values while adding others is still breaking',
        from: {"enum":["all","active","archived"]},
        to: {"enum":["active","inactive","deleted"]},
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(true);
      expect(result.severity).toBeDefined();
    });

  });

  describe('parameter-made-optional', () => {
    it('Making a required parameter optional is compatible [pass]', () => {
      const change: Change = {
        id: 'test-tools-parameter-made-optional-0',
        category: 'tools',
        changeType: 'parameter-made-optional',
        path: 'test.path',
        description: 'Making a required parameter optional is compatible',
        from: {"required":true},
        to: {"required":false},
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(false);
      expect(result.severity).toBeDefined();
    });

  });

  describe('parameter-made-required', () => {
    it('Making an optional parameter required is breaking [pass]', () => {
      const change: Change = {
        id: 'test-tools-parameter-made-required-0',
        category: 'tools',
        changeType: 'parameter-made-required',
        path: 'test.path',
        description: 'Making an optional parameter required is breaking',
        from: {"required":false},
        to: {"required":true},
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(true);
      expect(result.severity).toBeDefined();
    });

  });

  describe('parameter-removed', () => {
    it('Removing a parameter is compatible if server ignores unknowns [pass]', () => {
      const change: Change = {
        id: 'test-tools-parameter-removed-0',
        category: 'tools',
        changeType: 'parameter-removed',
        path: 'test.path',
        description: 'Removing a parameter is compatible if server ignores unknowns',
        from: {"required":false,"type":"boolean"},
        to: null,
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(false);
      expect(result.severity).toBeDefined();
    });

  });

  describe('parameter-renamed', () => {
    it('Renaming a parameter is breaking [pass]', () => {
      const change: Change = {
        id: 'test-tools-parameter-renamed-0',
        category: 'tools',
        changeType: 'parameter-renamed',
        path: 'test.path',
        description: 'Renaming a parameter is breaking',
        from: {"name":"location"},
        to: {"name":"city"},
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(true);
      expect(result.severity).toBeDefined();
    });

  });

  describe('parameter-type-changed', () => {
    it('Changing from number to string type is breaking [pass]', () => {
      const change: Change = {
        id: 'test-tools-parameter-type-changed-0',
        category: 'tools',
        changeType: 'parameter-type-changed',
        path: 'test.path',
        description: 'Changing from number to string type is breaking',
        from: "number",
        to: "string",
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(true);
      expect(result.severity).toBeDefined();
    });

    it('Changing from string to array type is breaking [pass]', () => {
      const change: Change = {
        id: 'test-tools-parameter-type-changed-1',
        category: 'tools',
        changeType: 'parameter-type-changed',
        path: 'test.path',
        description: 'Changing from string to array type is breaking',
        from: "string",
        to: "array",
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(true);
      expect(result.severity).toBeDefined();
    });

  });

  describe('tool-added', () => {
    it('Adding a completely new tool is compatible [pass]', () => {
      const change: Change = {
        id: 'test-tools-tool-added-0',
        category: 'tools',
        changeType: 'tool-added',
        path: 'test.path',
        description: 'Adding a completely new tool is compatible',
        from: null,
        to: {"name":"send_email","description":"Send an email message","inputSchema":{"type":"object","properties":{"to":{"type":"string"},"subject":{"type":"string"},"body":{"type":"string"}}}},
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(false);
      expect(result.severity).toBeDefined();
    });

  });

  describe('tool-description-changed', () => {
    it('Improving tool description text is compatible [pass]', () => {
      const change: Change = {
        id: 'test-tools-tool-description-changed-0',
        category: 'tools',
        changeType: 'tool-description-changed',
        path: 'test.path',
        description: 'Improving tool description text is compatible',
        from: "Get weather data",
        to: "Get current weather data for a specific location",
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(false);
      expect(result.severity).toBeDefined();
    });

  });

  describe('tool-removed', () => {
    it('Removing an existing tool is breaking [pass]', () => {
      const change: Change = {
        id: 'test-tools-tool-removed-0',
        category: 'tools',
        changeType: 'tool-removed',
        path: 'test.path',
        description: 'Removing an existing tool is breaking',
        from: {"name":"send_fax","description":"Send a fax message","inputSchema":{"type":"object","properties":{"to":{"type":"string"},"message":{"type":"string"}}}},
        to: null,
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(true);
      expect(result.severity).toBeDefined();
    });

  });

  describe('tool-renamed', () => {
    it('Changing a tool\'s name is breaking [pass]', () => {
      const change: Change = {
        id: 'test-tools-tool-renamed-0',
        category: 'tools',
        changeType: 'tool-renamed',
        path: 'test.path',
        description: 'Changing a tool\'s name is breaking',
        from: {"name":"get_weather"},
        to: {"name":"fetch_weather"},
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(true);
      expect(result.severity).toBeDefined();
    });

  });

});

describe('prompts - Auto-generated Catalog Tests', () => {
  describe('prompt-added', () => {
    it('Adding a new prompt is compatible [pass]', () => {
      const change: Change = {
        id: 'test-prompts-prompt-added-0',
        category: 'prompts',
        changeType: 'prompt-added',
        path: 'test.path',
        description: 'Adding a new prompt is compatible',
        from: null,
        to: {"name":"code_review","description":"Generate code review comments"},
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(false);
      expect(result.severity).toBeDefined();
    });

  });

  describe('prompt-argument-added', () => {
    it('Adding an optional argument is compatible [pass]', () => {
      const change: Change = {
        id: 'test-prompts-prompt-argument-added-0',
        category: 'prompts',
        changeType: 'prompt-argument-added',
        path: 'test.path',
        description: 'Adding an optional argument is compatible',
        from: null,
        to: {"required":false,"description":"Target summary length"},
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(false);
      expect(result.severity).toBeDefined();
    });

    it('Adding a required argument is breaking [pass]', () => {
      const change: Change = {
        id: 'test-prompts-prompt-argument-added-1',
        category: 'prompts',
        changeType: 'prompt-argument-added',
        path: 'test.path',
        description: 'Adding a required argument is breaking',
        from: null,
        to: {"required":true,"description":"Target language"},
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(true);
      expect(result.severity).toBeDefined();
    });

  });

  describe('prompt-argument-made-optional', () => {
    it('Making an argument optional is compatible [pass]', () => {
      const change: Change = {
        id: 'test-prompts-prompt-argument-made-optional-0',
        category: 'prompts',
        changeType: 'prompt-argument-made-optional',
        path: 'test.path',
        description: 'Making an argument optional is compatible',
        from: {"required":true},
        to: {"required":false},
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(false);
      expect(result.severity).toBeDefined();
    });

  });

  describe('prompt-argument-made-required', () => {
    it('Making an argument required is breaking [pass]', () => {
      const change: Change = {
        id: 'test-prompts-prompt-argument-made-required-0',
        category: 'prompts',
        changeType: 'prompt-argument-made-required',
        path: 'test.path',
        description: 'Making an argument required is breaking',
        from: {"required":false},
        to: {"required":true},
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(true);
      expect(result.severity).toBeDefined();
    });

  });

  describe('prompt-argument-removed', () => {
    it('Removing an argument is compatible [pass]', () => {
      const change: Change = {
        id: 'test-prompts-prompt-argument-removed-0',
        category: 'prompts',
        changeType: 'prompt-argument-removed',
        path: 'test.path',
        description: 'Removing an argument is compatible',
        from: {"required":false,"description":"Output format"},
        to: null,
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(false);
      expect(result.severity).toBeDefined();
    });

  });

  describe('prompt-description-changed', () => {
    it('Improving prompt description is compatible [pass]', () => {
      const change: Change = {
        id: 'test-prompts-prompt-description-changed-0',
        category: 'prompts',
        changeType: 'prompt-description-changed',
        path: 'test.path',
        description: 'Improving prompt description is compatible',
        from: "Summarize text",
        to: "Generate a concise summary of the provided text",
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(false);
      expect(result.severity).toBeDefined();
    });

  });

  describe('prompt-removed', () => {
    it('Removing a prompt is breaking [pass]', () => {
      const change: Change = {
        id: 'test-prompts-prompt-removed-0',
        category: 'prompts',
        changeType: 'prompt-removed',
        path: 'test.path',
        description: 'Removing a prompt is breaking',
        from: {"name":"legacy_format","description":"Generate output in legacy format"},
        to: null,
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(true);
      expect(result.severity).toBeDefined();
    });

  });

  describe('prompt-renamed', () => {
    it('Renaming a prompt is breaking [pass]', () => {
      const change: Change = {
        id: 'test-prompts-prompt-renamed-0',
        category: 'prompts',
        changeType: 'prompt-renamed',
        path: 'test.path',
        description: 'Renaming a prompt is breaking',
        from: {"name":"summarize"},
        to: {"name":"create_summary"},
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(true);
      expect(result.severity).toBeDefined();
    });

  });

});

describe('resources - Auto-generated Catalog Tests', () => {
  describe('resource-added', () => {
    it('Adding a new resource is compatible [pass]', () => {
      const change: Change = {
        id: 'test-resources-resource-added-0',
        category: 'resources',
        changeType: 'resource-added',
        path: 'test.path',
        description: 'Adding a new resource is compatible',
        from: null,
        to: {"uri":"config://app/settings","name":"Application Settings","mimeType":"application/json"},
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(false);
      expect(result.severity).toBeDefined();
    });

  });

  describe('resource-description-changed', () => {
    it('Improving resource description is compatible [pass]', () => {
      const change: Change = {
        id: 'test-resources-resource-description-changed-0',
        category: 'resources',
        changeType: 'resource-description-changed',
        path: 'test.path',
        description: 'Improving resource description is compatible',
        from: "Config file",
        to: "Application configuration file in JSON format",
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(false);
      expect(result.severity).toBeDefined();
    });

  });

  describe('resource-mimetype-changed', () => {
    it('Changing MIME type from JSON to text is breaking [pass]', () => {
      const change: Change = {
        id: 'test-resources-resource-mimetype-changed-0',
        category: 'resources',
        changeType: 'resource-mimetype-changed',
        path: 'test.path',
        description: 'Changing MIME type from JSON to text is breaking',
        from: "application/json",
        to: "text/plain",
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(true);
      expect(result.severity).toBeDefined();
    });

  });

  describe('resource-removed', () => {
    it('Removing a resource is breaking [pass]', () => {
      const change: Change = {
        id: 'test-resources-resource-removed-0',
        category: 'resources',
        changeType: 'resource-removed',
        path: 'test.path',
        description: 'Removing a resource is breaking',
        from: {"uri":"legacy://data/old-format","name":"Legacy Data Format"},
        to: null,
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(true);
      expect(result.severity).toBeDefined();
    });

  });

  describe('resource-renamed', () => {
    it('Renaming a resource is breaking [pass]', () => {
      const change: Change = {
        id: 'test-resources-resource-renamed-0',
        category: 'resources',
        changeType: 'resource-renamed',
        path: 'test.path',
        description: 'Renaming a resource is breaking',
        from: {"name":"Config"},
        to: {"name":"Configuration"},
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(true);
      expect(result.severity).toBeDefined();
    });

  });

  describe('resource-uri-changed', () => {
    it('Changing URI scheme is breaking [pass]', () => {
      const change: Change = {
        id: 'test-resources-resource-uri-changed-0',
        category: 'resources',
        changeType: 'resource-uri-changed',
        path: 'test.path',
        description: 'Changing URI scheme is breaking',
        from: "file://data/config.json",
        to: "config://app/settings",
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(true);
      expect(result.severity).toBeDefined();
    });

    it('Changing URI path is breaking [pass]', () => {
      const change: Change = {
        id: 'test-resources-resource-uri-changed-1',
        category: 'resources',
        changeType: 'resource-uri-changed',
        path: 'test.path',
        description: 'Changing URI path is breaking',
        from: "card/{id}",
        to: "cards/{id}",
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(true);
      expect(result.severity).toBeDefined();
    });

  });

});

describe('resourceTemplates - Auto-generated Catalog Tests', () => {
  describe('resourcetemplate-added', () => {
    it('Adding a new resource template is compatible [pass]', () => {
      const change: Change = {
        id: 'test-resourceTemplates-resourcetemplate-added-0',
        category: 'resourceTemplates',
        changeType: 'resourcetemplate-added',
        path: 'test.path',
        description: 'Adding a new resource template is compatible',
        from: null,
        to: {"uriTemplate":"file://logs/{date}.log","name":"Daily Log Files"},
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(false);
      expect(result.severity).toBeDefined();
    });

  });

  describe('resourcetemplate-removed', () => {
    it('Removing a resource template is breaking [pass]', () => {
      const change: Change = {
        id: 'test-resourceTemplates-resourcetemplate-removed-0',
        category: 'resourceTemplates',
        changeType: 'resourcetemplate-removed',
        path: 'test.path',
        description: 'Removing a resource template is breaking',
        from: {"uriTemplate":"legacy://{type}/{id}","name":"Legacy Resource Pattern"},
        to: null,
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(true);
      expect(result.severity).toBeDefined();
    });

  });

  describe('resourcetemplate-uritemplate-changed', () => {
    it('Changing URI template pattern is breaking [pass]', () => {
      const change: Change = {
        id: 'test-resourceTemplates-resourcetemplate-uritemplate-changed-0',
        category: 'resourceTemplates',
        changeType: 'resourcetemplate-uritemplate-changed',
        path: 'test.path',
        description: 'Changing URI template pattern is breaking',
        from: "file://{path}",
        to: "file://data/{path}",
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(true);
      expect(result.severity).toBeDefined();
    });

    it('Renaming template variables is breaking [pass]', () => {
      const change: Change = {
        id: 'test-resourceTemplates-resourcetemplate-uritemplate-changed-1',
        category: 'resourceTemplates',
        changeType: 'resourcetemplate-uritemplate-changed',
        path: 'test.path',
        description: 'Renaming template variables is breaking',
        from: "card/{id}",
        to: "card/{cardId}",
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(true);
      expect(result.severity).toBeDefined();
    });

  });

});

describe('serverInfo - Auto-generated Catalog Tests', () => {
  describe('capability-added', () => {
    it('Adding a capability is compatible [pass]', () => {
      const change: Change = {
        id: 'test-serverInfo-capability-added-0',
        category: 'serverInfo',
        changeType: 'capability-added',
        path: 'test.path',
        description: 'Adding a capability is compatible',
        from: null,
        to: {"enabled":true},
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(false);
      expect(result.severity).toBeDefined();
    });

  });

  describe('capability-property-changed', () => {
    it('Disabling listChanged notifications is breaking [pass]', () => {
      const change: Change = {
        id: 'test-serverInfo-capability-property-changed-0',
        category: 'serverInfo',
        changeType: 'capability-property-changed',
        path: 'test.path',
        description: 'Disabling listChanged notifications is breaking',
        from: true,
        to: false,
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(true);
      expect(result.severity).toBeDefined();
    });

    it('Enabling listChanged notifications is compatible [pass]', () => {
      const change: Change = {
        id: 'test-serverInfo-capability-property-changed-1',
        category: 'serverInfo',
        changeType: 'capability-property-changed',
        path: 'test.path',
        description: 'Enabling listChanged notifications is compatible',
        from: false,
        to: true,
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(false);
      expect(result.severity).toBeDefined();
    });

    it('Changing other capability properties [pass]', () => {
      const change: Change = {
        id: 'test-serverInfo-capability-property-changed-2',
        category: 'serverInfo',
        changeType: 'capability-property-changed',
        path: 'test.path',
        description: 'Changing other capability properties',
        from: true,
        to: false,
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(true);
      expect(result.severity).toBeDefined();
    });

  });

  describe('capability-removed', () => {
    it('Removing a capability is breaking [pass]', () => {
      const change: Change = {
        id: 'test-serverInfo-capability-removed-0',
        category: 'serverInfo',
        changeType: 'capability-removed',
        path: 'test.path',
        description: 'Removing a capability is breaking',
        from: {"enabled":true},
        to: null,
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(true);
      expect(result.severity).toBeDefined();
    });

  });

  describe('protocol-version-changed', () => {
    it('Upgrading protocol version is breaking [pass]', () => {
      const change: Change = {
        id: 'test-serverInfo-protocol-version-changed-0',
        category: 'serverInfo',
        changeType: 'protocol-version-changed',
        path: 'test.path',
        description: 'Upgrading protocol version is breaking',
        from: "2024-11-05",
        to: "2025-06-18",
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(true);
      expect(result.severity).toBeDefined();
    });

  });

  describe('session-support-changed', () => {
    it('Making a sessionless server session-based is breaking [pass]', () => {
      const change: Change = {
        id: 'test-serverInfo-session-support-changed-0',
        category: 'serverInfo',
        changeType: 'session-support-changed',
        path: 'test.path',
        description: 'Making a sessionless server session-based is breaking',
        from: false,
        to: true,
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(true);
      expect(result.severity).toBeDefined();
    });

    it('Making a session-based server sessionless is breaking [pass]', () => {
      const change: Change = {
        id: 'test-serverInfo-session-support-changed-1',
        category: 'serverInfo',
        changeType: 'session-support-changed',
        path: 'test.path',
        description: 'Making a session-based server sessionless is breaking',
        from: true,
        to: false,
      };

      const engine = new RulesEngine('rules/breaking-changes.yaml');
      const results = engine.applyRules([change]);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.breaking).toBe(true);
      expect(result.severity).toBeDefined();
    });

  });

});

