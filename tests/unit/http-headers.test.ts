// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Unit tests for HTTP headers support (curl-style repeatable syntax)
 */

import { describe, it, expect } from '@jest/globals';
import { loadConfigFromFile, createConfigFromCLI } from '../../src/lib/config.js';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CLIOptions } from '../../src/lib/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES_DIR = resolve(__dirname, '../fixtures/dumps');

describe('HTTP Headers Configuration (curl-style)', () => {
  describe('loadConfigFromFile with headers', () => {
    it('should load streamable-http config with headers', async () => {
      const configPath = resolve(FIXTURES_DIR, 'test-http-headers-config.json');
      const config = await loadConfigFromFile(configPath, 'test-http-with-headers');

      expect(config).toBeDefined();
      expect(config.transport.type).toBe('streamable-http');
      
      if (config.transport.type === 'streamable-http') {
        expect(config.transport.url).toBe('https://api.test.example.com/mcp');
        expect(config.transport.headers).toEqual({
          'Authorization': 'Bearer test-token-12345',
          'X-API-Key': 'test-api-key',
          'X-Client-ID': 'mcpcontract-test'
        });
      }
    });

    it('should load streamable-http config without headers', async () => {
      const configPath = resolve(FIXTURES_DIR, 'test-http-headers-config.json');
      const config = await loadConfigFromFile(configPath, 'test-http-no-headers');

      expect(config).toBeDefined();
      expect(config.transport.type).toBe('streamable-http');
      
      if (config.transport.type === 'streamable-http') {
        expect(config.transport.url).toBe('https://public.test.example.com/mcp');
        expect(config.transport.headers).toBeUndefined();
      }
    });

    it('should load SSE config with headers', async () => {
      const configPath = resolve(FIXTURES_DIR, 'test-http-headers-config.json');
      const config = await loadConfigFromFile(configPath, 'test-sse-with-headers');

      expect(config).toBeDefined();
      expect(config.transport.type).toBe('sse');
      
      if (config.transport.type === 'sse') {
        expect(config.transport.url).toBe('https://sse.test.example.com/events');
        expect(config.transport.headers).toEqual({
          'Authorization': 'Bearer sse-token-67890'
        });
      }
    });
  });

  describe('createConfigFromCLI with curl-style headers', () => {
    it('should create config with single header', () => {
      const options: CLIOptions = {
        transport: 'streamable-http',
        url: 'https://api.example.com/mcp',
        header: ['Authorization: Bearer TOKEN']
      };

      const config = createConfigFromCLI(options);

      expect(config).toBeDefined();
      expect(config.transport.type).toBe('streamable-http');
      
      if (config.transport.type === 'streamable-http') {
        expect(config.transport.url).toBe('https://api.example.com/mcp');
        expect(config.transport.headers).toEqual({
          'Authorization': 'Bearer TOKEN'
        });
      }
    });

    it('should create config with multiple headers (curl-style)', () => {
      const options: CLIOptions = {
        transport: 'streamable-http',
        url: 'https://api.example.com/mcp',
        header: [
          'Authorization: Bearer TOKEN',
          'X-API-Key: secret123',
          'X-Client-ID: mcpcontract'
        ]
      };

      const config = createConfigFromCLI(options);

      expect(config).toBeDefined();
      expect(config.transport.type).toBe('streamable-http');
      
      if (config.transport.type === 'streamable-http') {
        expect(config.transport.headers).toEqual({
          'Authorization': 'Bearer TOKEN',
          'X-API-Key': 'secret123',
          'X-Client-ID': 'mcpcontract'
        });
      }
    });

    it('should create config without headers', () => {
      const options: CLIOptions = {
        transport: 'streamable-http',
        url: 'https://api.example.com/mcp'
      };

      const config = createConfigFromCLI(options);

      expect(config).toBeDefined();
      expect(config.transport.type).toBe('streamable-http');
      
      if (config.transport.type === 'streamable-http') {
        expect(config.transport.url).toBe('https://api.example.com/mcp');
        expect(config.transport.headers).toBeUndefined();
      }
    });

    it('should handle empty header array', () => {
      const options: CLIOptions = {
        transport: 'streamable-http',
        url: 'https://api.example.com/mcp',
        header: []
      };

      const config = createConfigFromCLI(options);

      expect(config).toBeDefined();
      expect(config.transport.type).toBe('streamable-http');
      
      if (config.transport.type === 'streamable-http') {
        expect(config.transport.headers).toBeUndefined();
      }
    });

    it('should create SSE config with headers', () => {
      const options: CLIOptions = {
        transport: 'sse',
        url: 'https://sse.example.com/events',
        header: ['Authorization: Bearer SSE-TOKEN']
      };

      const config = createConfigFromCLI(options);

      expect(config).toBeDefined();
      expect(config.transport.type).toBe('sse');
      
      if (config.transport.type === 'sse') {
        expect(config.transport.url).toBe('https://sse.example.com/events');
        expect(config.transport.headers).toEqual({
          'Authorization': 'Bearer SSE-TOKEN'
        });
      }
    });

    it('should throw error for invalid header format (no colon)', () => {
      const options: CLIOptions = {
        transport: 'streamable-http',
        url: 'https://api.example.com/mcp',
        header: ['InvalidHeaderFormat']
      };

      expect(() => createConfigFromCLI(options)).toThrow('Invalid header format');
    });

    it('should throw error for header starting with colon', () => {
      const options: CLIOptions = {
        transport: 'streamable-http',
        url: 'https://api.example.com/mcp',
        header: [': value']
      };

      expect(() => createConfigFromCLI(options)).toThrow('Invalid header format');
    });
  });

  describe('Real-world curl-style header patterns', () => {
    it('should handle Bearer token with JWT format', () => {
      const options: CLIOptions = {
        transport: 'streamable-http',
        url: 'https://api.example.com/mcp',
        header: ['Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.test']
      };

      const config = createConfigFromCLI(options);
      
      if (config.transport.type === 'streamable-http' && config.transport.headers) {
        expect(config.transport.headers['Authorization']).toContain('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      }
    });

    it('should handle API key pattern', () => {
      const options: CLIOptions = {
        transport: 'streamable-http',
        url: 'https://api.example.com/mcp',
        header: ['X-API-Key: sk-proj-abc123def456']
      };

      const config = createConfigFromCLI(options);
      
      if (config.transport.type === 'streamable-http') {
        expect(config.transport.headers).toEqual({
          'X-API-Key': 'sk-proj-abc123def456'
        });
      }
    });

    it('should handle headers with colons in values (curl-style advantage)', () => {
      const options: CLIOptions = {
        transport: 'streamable-http',
        url: 'https://api.example.com/mcp',
        header: [
          'Set-Cookie: session=abc; expires=Mon, 01 Jan 2025; path=/',
          'Authorization: Bearer token:with:colons'
        ]
      };

      const config = createConfigFromCLI(options);
      
      if (config.transport.type === 'streamable-http') {
        expect(config.transport.headers).toEqual({
          'Set-Cookie': 'session=abc; expires=Mon, 01 Jan 2025; path=/',
          'Authorization': 'Bearer token:with:colons'
        });
      }
    });

    it('should handle headers with commas in values (curl-style advantage)', () => {
      const options: CLIOptions = {
        transport: 'streamable-http',
        url: 'https://api.example.com/mcp',
        header: [
          'Accept: text/html, application/json, */*',
          'X-Custom-List: item1, item2, item3'
        ]
      };

      const config = createConfigFromCLI(options);
      
      if (config.transport.type === 'streamable-http') {
        expect(config.transport.headers).toEqual({
          'Accept': 'text/html, application/json, */*',
          'X-Custom-List': 'item1, item2, item3'
        });
      }
    });

    it('should handle multiple authentication headers', () => {
      const options: CLIOptions = {
        transport: 'streamable-http',
        url: 'https://api.example.com/mcp',
        header: [
          'Authorization: Bearer TOKEN',
          'X-API-Key: key123',
          'X-Client-Secret: secret456'
        ]
      };

      const config = createConfigFromCLI(options);
      
      if (config.transport.type === 'streamable-http') {
        expect(config.transport.headers).toEqual({
          'Authorization': 'Bearer TOKEN',
          'X-API-Key': 'key123',
          'X-Client-Secret': 'secret456'
        });
      }
    });

    it('should handle custom tracking headers', () => {
      const options: CLIOptions = {
        transport: 'streamable-http',
        url: 'https://api.example.com/mcp',
        header: [
          'Authorization: Bearer TOKEN',
          'X-Request-ID: req-12345',
          'X-Client-Version: 0.14.3'
        ]
      };

      const config = createConfigFromCLI(options);
      
      if (config.transport.type === 'streamable-http') {
        expect(config.transport.headers).toEqual({
          'Authorization': 'Bearer TOKEN',
          'X-Request-ID': 'req-12345',
          'X-Client-Version': '0.14.3'
        });
      }
    });

    it('should trim whitespace from keys and values', () => {
      const options: CLIOptions = {
        transport: 'streamable-http',
        url: 'https://api.example.com/mcp',
        header: [
          '  Authorization  :  Bearer TOKEN  ',
          'X-API-Key:  secret  '
        ]
      };

      const config = createConfigFromCLI(options);
      
      if (config.transport.type === 'streamable-http') {
        expect(config.transport.headers).toEqual({
          'Authorization': 'Bearer TOKEN',
          'X-API-Key': 'secret'
        });
      }
    });
  });
});
