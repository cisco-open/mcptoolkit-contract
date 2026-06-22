// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

import type { ClientMetadata } from 'openid-client';
import { CLIENT_METADATA, DEFAULT_SCOPES } from './constants.js';
import { ClientRegistrationStorage, StoredClientRegistration } from './client-registration-storage.js';
import type { OAuthDiscoveryResult } from './discovery.js';
import { ConfigurationError } from '../types.js';

interface RegistrationResponse {
    client_id: string;
    client_secret?: string;
    client_secret_expires_at?: number;
    registration_access_token?: string;
    registration_client_uri?: string;
    token_endpoint_auth_method?: string;
    registration_client_secret_expires_at?: number;
    grant_types?: string[];
    redirect_uris?: string[];
    response_types?: string[];
    client_name?: string;
    application_type?: string;
    software_id?: string;
    scope?: string;
    [key: string]: unknown;
}

export interface ClientIdentity {
    clientId: string;
    clientSecret?: string;
    tokenEndpointAuthMethod: string;
    registrationAccessToken?: string;
    registrationClientUri?: string;
    metadata: Partial<ClientMetadata>;
    clientSecretExpiresAt?: number;
    dynamic: boolean;
    registeredAt?: number;
}

export class ClientRegistrar {
        private storage: ClientRegistrationStorage;

        constructor(storage?: ClientRegistrationStorage) {
                this.storage = storage ?? new ClientRegistrationStorage();
        }

        async resolve(options: {
                discovery: OAuthDiscoveryResult;
                requestInit?: RequestInit;
                log?: (message: string) => void;
                customClientId?: string;
                customClientSecret?: string;
        }): Promise<ClientIdentity> {
                const endpoint = options.discovery.authorizationServer.registration_endpoint;

                if (!endpoint) {
                        options.log?.('[INFO] Authorization server does not advertise dynamic client registration; using static client identity');
                        return this.staticIdentity(options.customClientId, options.customClientSecret);
                }

                // If custom client credentials are provided, skip dynamic registration
                if (options.customClientId) {
                        options.log?.('[INFO] Custom OAuth client credentials provided; skipping dynamic registration');
                        return this.staticIdentity(options.customClientId, options.customClientSecret);
                }

                const storageKey = this.storageKey(options.discovery.authorizationServer.issuer, endpoint);
                const existing = await this.storage.load(storageKey);
                if (existing && !this.isExpired(existing)) {
                        return this.identityFromStored(existing);
                }

                if (existing && this.isExpired(existing)) {
                        await this.storage.clear(storageKey);
                }

                try {
                        const registration = await this.performRegistration(
                            endpoint,
                            options.discovery,
                            options.requestInit,
                            options.log
                        );
                        const record = this.toStoredRecord(registration, options.discovery.authorizationServer.issuer, endpoint);
                        await this.storage.save(storageKey, record);
                        return this.identityFromStored(record);
                } catch (error) {
                        // Dynamic client registration is optional per MCP spec (MAY requirement)
                        // Fall back to static client identity if registration fails
                        options.log?.(`[WARN] Dynamic client registration failed: ${(error as Error).message}`);
                        options.log?.('[INFO] Falling back to static client identity (pre-registered credentials may be required)');
                        return this.staticIdentity(options.customClientId, options.customClientSecret);
                }
        }

    private staticIdentity(customClientId?: string, customClientSecret?: string): ClientIdentity {
        const clientId = customClientId || CLIENT_METADATA.clientId;
        const tokenEndpointAuthMethod = customClientSecret 
            ? 'client_secret_post' 
            : CLIENT_METADATA.tokenEndpointAuthMethod;

        const metadata: Partial<ClientMetadata> = {
            redirect_uris: [...CLIENT_METADATA.redirectUris],
            token_endpoint_auth_method: tokenEndpointAuthMethod,
            application_type: CLIENT_METADATA.applicationType,
            client_name: CLIENT_METADATA.clientName,
            software_id: CLIENT_METADATA.softwareId,
            grant_types: [...CLIENT_METADATA.grantTypes],
            response_types: [...CLIENT_METADATA.responseTypes]
        };

        return {
            clientId,
            clientSecret: customClientSecret,
            tokenEndpointAuthMethod,
            metadata,
            dynamic: false
        };
    }

    private storageKey(issuer: string, registrationEndpoint: string): string {
        return `${issuer}|${registrationEndpoint}|${CLIENT_METADATA.softwareId}`;
    }

    private isExpired(record: StoredClientRegistration): boolean {
        if (!record.clientSecretExpiresAt || record.clientSecretExpiresAt === 0) {
            return false;
        }
        const now = Math.floor(Date.now() / 1000);
        return record.clientSecretExpiresAt <= now;
    }

    private identityFromStored(record: StoredClientRegistration): ClientIdentity {
        const redirect_uris = Array.isArray(record.metadata.redirect_uris)
            ? record.metadata.redirect_uris as string[]
            : Array.from(CLIENT_METADATA.redirectUris);
        const grant_types = Array.isArray(record.metadata.grant_types)
            ? record.metadata.grant_types as string[]
            : Array.from(CLIENT_METADATA.grantTypes);
        const response_types = Array.isArray(record.metadata.response_types)
            ? record.metadata.response_types as string[]
            : Array.from(CLIENT_METADATA.responseTypes);
        const scope = typeof record.metadata.scope === 'string' ? record.metadata.scope : undefined;
        const client_name = typeof record.metadata.client_name === 'string'
            ? record.metadata.client_name
            : CLIENT_METADATA.clientName;
        const application_type = typeof record.metadata.application_type === 'string'
            ? record.metadata.application_type
            : CLIENT_METADATA.applicationType;
        const software_id = typeof record.metadata.software_id === 'string'
            ? record.metadata.software_id
            : CLIENT_METADATA.softwareId;

        const metadata: Partial<ClientMetadata> = {
            redirect_uris,
            token_endpoint_auth_method: record.tokenEndpointAuthMethod ?? CLIENT_METADATA.tokenEndpointAuthMethod,
            grant_types,
            response_types,
            client_name,
            application_type,
            software_id,
            scope
        };

        return {
            clientId: record.clientId,
            clientSecret: record.clientSecret,
            tokenEndpointAuthMethod: record.tokenEndpointAuthMethod ?? (record.clientSecret ? 'client_secret_post' : 'none'),
            registrationAccessToken: record.registrationAccessToken,
            registrationClientUri: record.registrationClientUri,
            metadata,
            clientSecretExpiresAt: record.clientSecretExpiresAt,
            dynamic: true,
            registeredAt: record.registeredAt
        };
    }

    private async performRegistration(
        endpoint: string,
        discovery: OAuthDiscoveryResult,
        requestInit?: RequestInit,
        log?: (message: string) => void
    ): Promise<RegistrationResponse> {
        // Per MCP spec and RFC 7591: Include all required fields for native client
        const payload: Record<string, unknown> = {
            client_name: CLIENT_METADATA.clientName,
            application_type: CLIENT_METADATA.applicationType,
            grant_types: [...CLIENT_METADATA.grantTypes],
            response_types: [...CLIENT_METADATA.responseTypes],
            redirect_uris: [...CLIENT_METADATA.redirectUris],
            token_endpoint_auth_method: CLIENT_METADATA.tokenEndpointAuthMethod
        };

        const scope = this.resolveRegistrationScope(discovery);
        if (scope) {
            payload.scope = scope;
        }

        const mergedHeaders = new Headers(requestInit?.headers);
        if (!mergedHeaders.has('Accept')) {
            mergedHeaders.set('Accept', 'application/json');
        }
        mergedHeaders.set('Content-Type', 'application/json');

        log?.(`-> POST ${endpoint}`);
        const payloadLines = JSON.stringify(payload, null, 2).split('\n');
        for (const line of payloadLines) {
            log?.(`>- ${line}`);
        }

        const response = await fetch(endpoint, {
            ...requestInit,
            method: 'POST',
            headers: mergedHeaders,
            body: JSON.stringify(payload)
        });

        let rawBody = '';
        try {
            rawBody = await response.text();
        } catch {
            rawBody = '';
        }

        const statusLine = `${response.status} ${response.statusText || ''}`.trim();
        log?.(`<-${statusLine}`);
        
        // Log response headers in verbose mode
        if (log) {
            const headerEntries = Array.from(response.headers.entries());
            if (headerEntries.length > 0) {
                log(`<- Response Headers:`);
                for (const [key, value] of headerEntries) {
                    log(`<-   ${key}: ${value}`);
                }
            }
        }
        
        const responseBodyForLog = rawBody.length > 0 ? rawBody : '(empty body)';
        for (const line of responseBodyForLog.split('\n')) {
            log?.(`<- ${line}`);
        }

        if (!response.ok) {
            let errorDetail = rawBody.length > 0 ? rawBody : response.statusText;
            
            // Try to parse as JSON for better error messages
            if (rawBody.trim().length > 0) {
                try {
                    const errorJson = JSON.parse(rawBody) as Record<string, unknown>;
                    if (errorJson.error) {
                        errorDetail = typeof errorJson.error === 'string' 
                            ? errorJson.error 
                            : JSON.stringify(errorJson.error);
                    }
                    if (errorJson.error_description) {
                        errorDetail = `${errorDetail}: ${errorJson.error_description}`;
                    }
                } catch {
                    // Not JSON, use raw body
                }
            }
            
            throw new ConfigurationError(
                `Dynamic client registration failed at ${endpoint}: ${response.status} ${response.statusText} - ${errorDetail}`
            );
        }

        if (rawBody.trim().length === 0) {
            throw new ConfigurationError('Dynamic client registration response was empty');
        }

        let json: unknown;
        try {
            json = JSON.parse(rawBody) as unknown;
        } catch (error) {
            throw new ConfigurationError(
                `Dynamic client registration returned invalid JSON: ${(error as Error).message}`
            );
        }

        if (!json || typeof json !== 'object') {
            throw new ConfigurationError('Dynamic client registration response was not an object');
        }

        if (typeof (json as RegistrationResponse).client_id !== 'string') {
            throw new ConfigurationError('Dynamic client registration response missing client_id');
        }

        return json as RegistrationResponse;
    }

    private toStoredRecord(
        response: RegistrationResponse,
        issuer: string,
        endpoint: string
    ): StoredClientRegistration {
        const redirectUris = Array.isArray(response.redirect_uris) && response.redirect_uris.length > 0
            ? response.redirect_uris
            : [...CLIENT_METADATA.redirectUris];
        const grantTypes = Array.isArray(response.grant_types) && response.grant_types.length > 0
            ? response.grant_types
            : [...CLIENT_METADATA.grantTypes];
        const responseTypes = Array.isArray(response.response_types) && response.response_types.length > 0
            ? response.response_types
            : [...CLIENT_METADATA.responseTypes];

        const tokenEndpointAuthMethod = response.token_endpoint_auth_method
            ?? (response.client_secret ? 'client_secret_post' : CLIENT_METADATA.tokenEndpointAuthMethod);

        const metadata: Record<string, unknown> = {
            redirect_uris: redirectUris,
            grant_types: grantTypes,
            response_types: responseTypes,
            token_endpoint_auth_method: tokenEndpointAuthMethod,
            client_name: response.client_name ?? CLIENT_METADATA.clientName,
            application_type: response.application_type ?? CLIENT_METADATA.applicationType,
            software_id: response.software_id ?? CLIENT_METADATA.softwareId,
            scope: response.scope
        };

        return {
            issuer,
            registrationEndpoint: endpoint,
            clientId: response.client_id,
            clientSecret: response.client_secret,
            clientSecretExpiresAt: response.client_secret_expires_at ?? response.registration_client_secret_expires_at,
            registrationAccessToken: response.registration_access_token,
            registrationClientUri: response.registration_client_uri,
            tokenEndpointAuthMethod,
            metadata,
            registeredAt: Math.floor(Date.now() / 1000)
        };
    }

    private resolveRegistrationScope(discovery: OAuthDiscoveryResult): string | undefined {
        const candidates: Array<readonly string[] | undefined> = [
            discovery.resource.scopes_supported,
            discovery.authorizationServer.scopes_supported,
            discovery.challengeScopes
        ];

        for (const candidate of candidates) {
            if (!candidate || candidate.length === 0) {
                continue;
            }

            const normalized = candidate
                .map((scope) => scope.trim())
                .filter((scope) => scope.length > 0);

            if (normalized.length > 0) {
                return Array.from(new Set(normalized)).join(' ');
            }
        }

        if (DEFAULT_SCOPES.length > 0) {
            return Array.from(DEFAULT_SCOPES).join(' ');
        }

        return undefined;
    }
}
