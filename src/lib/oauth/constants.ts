// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

// OAuth dynamic-client identity for the official mcpcontract CLI distribution.
//
// NOTE FOR FORKS / DERIVATIVE BUILDS:
// `clientId` and `clientMetadataUri` identify *this specific CLI build* to
// authorization servers that support OAuth 2.0 Dynamic Client Registration.
// If you redistribute mcpcontract under a different name or organization, you
// should register your own client metadata document and replace these values,
// rather than impersonating the upstream Cisco-published client.
//
// See: https://datatracker.ietf.org/doc/html/rfc7591
export const CLIENT_METADATA = {
  clientId: 'com.cisco.devnet.mcpcontract',
  clientMetadataUri: 'https://developer.cisco.com/docs/mcpcontract/.well-known/client-id-metadata.json',
  redirectUris: [
    'http://localhost'
  ],
  clientName: 'mcpcontract CLI',
  softwareId: 'mcpcontract-cli',
  softwareVersion: '0.20.1',
  applicationType: 'native',
  grantTypes: ['authorization_code', 'refresh_token'] as const,
  responseTypes: ['code'] as const,
  tokenEndpointAuthMethod: 'none' as const
} as const;

export const DEFAULT_SCOPES = ['mcp:read'] as const;

export const TOKEN_REFRESH_THRESHOLD_SECONDS = 300; // Refresh 5 minutes before expiry

export const TOKEN_STORAGE_DIRECTORY = '.mcpcontract/oauth';

export const TOKEN_FILE_EXTENSION = '.enc';

export const CLIENT_REGISTRATION_FILE_EXTENSION = '.client';
