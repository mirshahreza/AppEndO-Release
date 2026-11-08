import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CREDENTIAL_KEY_VERSION_ENV,
  CREDENTIAL_MASTER_KEY_ENV,
  CREDENTIAL_PREVIOUS_KEY_ENV,
  decryptCredential,
  encryptCredential,
  isCredentialEncryptedBlob,
  parseCredentialMasterKey,
  resetCredentialMasterKeyCacheForTests,
  resolveCredentialKeyVersion,
  resolveCredentialMasterKey,
} from '../credentialCrypto';

const originalMaster = process.env[CREDENTIAL_MASTER_KEY_ENV];
const originalVersion = process.env[CREDENTIAL_KEY_VERSION_ENV];
const originalPrevious = process.env[CREDENTIAL_PREVIOUS_KEY_ENV];
const originalNodeEnv = process.env.NODE_ENV;

const restoreEnv = (): void => {
  if (originalMaster === undefined) delete process.env[CREDENTIAL_MASTER_KEY_ENV];
  else process.env[CREDENTIAL_MASTER_KEY_ENV] = originalMaster;
  if (originalVersion === undefined) delete process.env[CREDENTIAL_KEY_VERSION_ENV];
  else process.env[CREDENTIAL_KEY_VERSION_ENV] = originalVersion;
  if (originalPrevious === undefined) delete process.env[CREDENTIAL_PREVIOUS_KEY_ENV];
  else process.env[CREDENTIAL_PREVIOUS_KEY_ENV] = originalPrevious;
  process.env.NODE_ENV = originalNodeEnv;
  resetCredentialMasterKeyCacheForTests();
};

beforeEach(() => {
  resetCredentialMasterKeyCacheForTests();
});

afterEach(() => {
  restoreEnv();
});

describe('credentialCrypto', () => {
  it('round-trips plaintext with a hex master key', () => {
    process.env[CREDENTIAL_MASTER_KEY_ENV] = crypto.randomBytes(32).toString('hex');
    const blob = encryptCredential('sk-super-secret-token');
    expect(isCredentialEncryptedBlob(blob)).toBe(true);
    expect(blob.keyVersion).toBe(1);
    expect(blob.alg).toBe('aes-256-gcm');
    expect(decryptCredential(blob)).toBe('sk-super-secret-token');
  });

  it('round-trips with a base64 master key', () => {
    process.env[CREDENTIAL_MASTER_KEY_ENV] = crypto.randomBytes(32).toString('base64');
    const blob = encryptCredential('another-value');
    expect(decryptCredential(blob)).toBe('another-value');
  });

  it('writes distinct ciphertext for the same plaintext', () => {
    process.env[CREDENTIAL_MASTER_KEY_ENV] = crypto.randomBytes(32).toString('hex');
    const first = encryptCredential('same-secret');
    const second = encryptCredential('same-secret');
    expect(first.ciphertext).not.toBe(second.ciphertext);
    expect(decryptCredential(first)).toBe('same-secret');
    expect(decryptCredential(second)).toBe('same-secret');
  });

  it('falls back to a derived dev key outside production when no env key is set', () => {
    delete process.env[CREDENTIAL_MASTER_KEY_ENV];
    const blob = encryptCredential('dev-value');
    expect(decryptCredential(blob)).toBe('dev-value');
  });

  it('throws in production when the master key is unset', () => {
    process.env.NODE_ENV = 'production';
    delete process.env[CREDENTIAL_MASTER_KEY_ENV];
    resetCredentialMasterKeyCacheForTests();
    expect(() => resolveCredentialMasterKey()).toThrow(/required in production/);
  });

  it('rejects a malformed master key', () => {
    expect(() => parseCredentialMasterKey('not-a-valid-key')).toThrow(/32 bytes/);
  });

  it('rejects a non-integer key version', () => {
    process.env[CREDENTIAL_KEY_VERSION_ENV] = '1.5';
    expect(() => resolveCredentialKeyVersion()).toThrow(/positive integer/);
  });

  it('fails to decrypt with the wrong key', () => {
    process.env[CREDENTIAL_MASTER_KEY_ENV] = crypto.randomBytes(32).toString('hex');
    const blob = encryptCredential('value-a');
    const wrongKey = crypto.randomBytes(32);
    expect(() => decryptCredential(blob, wrongKey)).toThrow();
  });

  it('decrypts a previous-generation blob when PREVIOUS is set', () => {
    const previous = crypto.randomBytes(32).toString('hex');
    const current = crypto.randomBytes(32).toString('hex');
    process.env[CREDENTIAL_MASTER_KEY_ENV] = previous;
    process.env[CREDENTIAL_KEY_VERSION_ENV] = '1';
    const blob = encryptCredential('rotate-me');

    process.env[CREDENTIAL_MASTER_KEY_ENV] = current;
    process.env[CREDENTIAL_PREVIOUS_KEY_ENV] = previous;
    process.env[CREDENTIAL_KEY_VERSION_ENV] = '2';
    resetCredentialMasterKeyCacheForTests();

    expect(decryptCredential(blob)).toBe('rotate-me');
  });

  it('isCredentialEncryptedBlob rejects non-blob shapes', () => {
    expect(isCredentialEncryptedBlob(null)).toBe(false);
    expect(isCredentialEncryptedBlob('a string')).toBe(false);
    expect(isCredentialEncryptedBlob({ iv: 'x' })).toBe(false);
    expect(isCredentialEncryptedBlob({
      alg: 'aes-256-gcm',
      keyVersion: 1,
      iv: 'a',
      authTag: 'b',
      ciphertext: 'c',
    })).toBe(true);
  });
});
