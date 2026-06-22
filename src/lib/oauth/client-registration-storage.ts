// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { CLIENT_REGISTRATION_FILE_EXTENSION, TOKEN_STORAGE_DIRECTORY } from './constants.js';

export interface StoredClientRegistration {
  issuer: string;
  registrationEndpoint: string;
  clientId: string;
  clientSecret?: string;
  clientSecretExpiresAt?: number;
  tokenEndpointAuthMethod?: string;
  registrationAccessToken?: string;
  registrationClientUri?: string;
  metadata: Record<string, unknown>;
  registeredAt: number;
}

interface EncryptedPayload {
  iv: string;
  authTag: string;
  encrypted: string;
}

export class ClientRegistrationStorage {
  private basePath: string;
  private keyPath: string;
  private cachedKey: Buffer | null = null;

  constructor() {
    this.basePath = join(homedir(), TOKEN_STORAGE_DIRECTORY);
    this.keyPath = join(this.basePath, '.key');
  }

  async save(identifier: string, registration: StoredClientRegistration): Promise<void> {
    await this.ensureBasePath();
    const key = await this.getEncryptionKey();
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const payload = JSON.stringify(registration);

    let encrypted = cipher.update(payload, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    const envelope: EncryptedPayload = {
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      encrypted
    };

    const filePath = this.filePathFor(identifier);
    await writeFile(filePath, JSON.stringify(envelope), { mode: 0o600 });
  }

  async load(identifier: string): Promise<StoredClientRegistration | null> {
    try {
      const filePath = this.filePathFor(identifier);
      const raw = await readFile(filePath, 'utf8');
      const envelope = JSON.parse(raw) as EncryptedPayload;
      const key = await this.getEncryptionKey();
      const decipher = createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(envelope.iv, 'hex')
      );
      decipher.setAuthTag(Buffer.from(envelope.authTag, 'hex'));
      let decrypted = decipher.update(envelope.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return JSON.parse(decrypted) as StoredClientRegistration;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async clear(identifier: string): Promise<void> {
    try {
      const filePath = this.filePathFor(identifier);
      await unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private async ensureBasePath(): Promise<void> {
    try {
      await mkdir(this.basePath, { recursive: true, mode: 0o700 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  private async getEncryptionKey(): Promise<Buffer> {
    if (this.cachedKey) {
      return this.cachedKey;
    }

    await this.ensureBasePath();

    try {
      const existing = await readFile(this.keyPath);
      this.cachedKey = Buffer.from(existing);
      return this.cachedKey;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    const key = randomBytes(32);
    await writeFile(this.keyPath, key, { mode: 0o600 });
    this.cachedKey = key;
    return key;
  }

  private filePathFor(identifier: string): string {
    const hash = createHash('sha256').update(identifier).digest('hex');
    return join(this.basePath, `${hash}${CLIENT_REGISTRATION_FILE_EXTENSION}`);
  }
}
