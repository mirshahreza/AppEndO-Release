import crypto from 'node:crypto';
import { logger } from '../../../../core/logging/Logger';
import { getAuthSecrets } from '../../../config/authSecrets';

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;
const DEV_SALT = 'appendo-credential-vault-v1';
const BLOB_ALG = 'aes-256-gcm' as const;

export const CREDENTIAL_MASTER_KEY_ENV = 'APPENDO_CREDENTIAL_MASTER_KEY';
export const CREDENTIAL_KEY_VERSION_ENV = 'APPENDO_CREDENTIAL_KEY_VERSION';
export const CREDENTIAL_PREVIOUS_KEY_ENV = 'APPENDO_CREDENTIAL_MASTER_KEY_PREVIOUS';

export type CredentialEncryptedBlob = {
  alg: typeof BLOB_ALG;
  keyVersion: number;
  iv: string;
  authTag: string;
  ciphertext: string;
};

let warnedDevFallback = false;
let cachedCurrentKey: Buffer | null = null;
let cachedCurrentKeySource = '';
let cachedPreviousKey: Buffer | null = null;
let cachedPreviousKeySource = '';

export function parseCredentialMasterKey(raw: string, envName = CREDENTIAL_MASTER_KEY_ENV): Buffer {
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }

  const base64 = Buffer.from(trimmed, 'base64');
  if (base64.length === KEY_BYTES) {
    return base64;
  }

  throw new Error(`${envName} must be 32 bytes as 64 hex characters or base64.`);
}

export function resolveCredentialKeyVersion(): number {
  const raw = process.env[CREDENTIAL_KEY_VERSION_ENV]?.trim() ?? '';
  if (!raw) {
    return 1;
  }

  if (!/^[1-9]\d*$/.test(raw)) {
    throw new Error(`${CREDENTIAL_KEY_VERSION_ENV} must be a positive integer.`);
  }

  return Number(raw);
}

export function resolveCredentialMasterKey(): Buffer {
  const envKey = process.env[CREDENTIAL_MASTER_KEY_ENV]?.trim() ?? '';
  const source = envKey ? `env:${envKey.length}` : 'dev-derived';
  if (cachedCurrentKey && cachedCurrentKeySource === source) {
    return cachedCurrentKey;
  }

  if (envKey) {
    cachedCurrentKey = parseCredentialMasterKey(envKey, CREDENTIAL_MASTER_KEY_ENV);
    cachedCurrentKeySource = source;
    return cachedCurrentKey;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${CREDENTIAL_MASTER_KEY_ENV} is required in production to encrypt secrets at rest.`);
  }

  if (!warnedDevFallback) {
    warnedDevFallback = true;
    logger.warn(
      'CredentialVault',
      `${CREDENTIAL_MASTER_KEY_ENV} is unset; deriving a development key from the JWT secret. Set ${CREDENTIAL_MASTER_KEY_ENV} for durable encryption at rest. Compromising this key decrypts every vault secret.`,
    );
  }

  cachedCurrentKey = crypto.scryptSync(getAuthSecrets().accessTokenSecret, DEV_SALT, KEY_BYTES);
  cachedCurrentKeySource = source;
  return cachedCurrentKey;
}

export function resolveCredentialPreviousKey(): Buffer | null {
  const envKey = process.env[CREDENTIAL_PREVIOUS_KEY_ENV]?.trim() ?? '';
  const source = envKey ? `env:${envKey.length}` : 'unset';
  if (cachedPreviousKeySource === source) {
    return cachedPreviousKey;
  }

  cachedPreviousKeySource = source;
  if (!envKey) {
    cachedPreviousKey = null;
    return null;
  }

  cachedPreviousKey = parseCredentialMasterKey(envKey, CREDENTIAL_PREVIOUS_KEY_ENV);
  return cachedPreviousKey;
}

export function resolveCredentialKeyForVersion(keyVersion: number): Buffer {
  const currentVersion = resolveCredentialKeyVersion();
  if (keyVersion === currentVersion) {
    return resolveCredentialMasterKey();
  }

  if (keyVersion === currentVersion - 1) {
    const previous = resolveCredentialPreviousKey();
    if (!previous) {
      throw new Error(
        `${CREDENTIAL_PREVIOUS_KEY_ENV} is required to decrypt keyVersion ${keyVersion} (current is ${currentVersion}).`,
      );
    }
    return previous;
  }

  throw new Error(
    `Unsupported credential keyVersion ${keyVersion}; current is ${currentVersion}. Only the current key and one previous generation can be decrypted.`,
  );
}

export function encryptCredential(plaintext: string, masterKey = resolveCredentialMasterKey()): CredentialEncryptedBlob {
  const keyVersion = resolveCredentialKeyVersion();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, masterKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    alg: BLOB_ALG,
    keyVersion,
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

export function decryptCredential(blob: CredentialEncryptedBlob, masterKey?: Buffer): string {
  const key = masterKey ?? resolveCredentialKeyForVersion(blob.keyVersion);
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(blob.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(blob.authTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(blob.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export function isCredentialEncryptedBlob(value: unknown): value is CredentialEncryptedBlob {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return record.alg === BLOB_ALG
    && Number.isInteger(record.keyVersion)
    && (record.keyVersion as number) >= 1
    && typeof record.iv === 'string'
    && typeof record.authTag === 'string'
    && typeof record.ciphertext === 'string'
    && record.iv.length > 0
    && record.authTag.length > 0
    && record.ciphertext.length > 0;
}

export function resetCredentialMasterKeyCacheForTests(): void {
  cachedCurrentKey = null;
  cachedCurrentKeySource = '';
  cachedPreviousKey = null;
  cachedPreviousKeySource = '';
  warnedDevFallback = false;
}
