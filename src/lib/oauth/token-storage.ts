// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { TOKEN_FILE_EXTENSION, TOKEN_STORAGE_DIRECTORY } from './constants.js';

export interface StoredToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number; // epoch seconds
  scope?: string;
  resource: string;
  issuer: string;
  tokenEndpoint: string;
  clientId?: string;
}

interface EncryptedPayload {
  iv: string;
  authTag: string;
  encrypted: string;
}

export class TokenStorage {
  private basePath: string;
  private keyPath: string;
  private cachedKey: Buffer | null = null;

  constructor() {
    this.basePath = join(homedir(), TOKEN_STORAGE_DIRECTORY);
    this.keyPath = join(this.basePath, '.key');
  }

  async save(identifier: string, token: StoredToken): Promise<void> {
    await this.ensureBasePath();
    const key = await this.getEncryptionKey();
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const payload = JSON.stringify(token);

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

  async load(identifier: string): Promise<StoredToken | null> {
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
      return JSON.parse(decrypted) as StoredToken;
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
    return join(this.basePath, `${hash}${TOKEN_FILE_EXTENSION}`);
  }
}
