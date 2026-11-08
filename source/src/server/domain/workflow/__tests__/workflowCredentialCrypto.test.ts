import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CREDENTIAL_KEY_VERSION_ENV,
  CREDENTIAL_MASTER_KEY_ENV,
  CREDENTIAL_PREVIOUS_KEY_ENV,
  resetCredentialMasterKeyCacheForTests,
} from '../../security/credentialVault/credentialCrypto';
import {
  decryptWorkflowCredentialValue,
  encryptWorkflowCredentialValue,
  isLegacyWorkflowCredentialBlob,
  isWorkflowCredentialEncryptedBlob,
  resetWorkflowCredentialMasterKeyCacheForTests,
} from '../workflowCredentialCrypto';

const originalMaster = process.env[CREDENTIAL_MASTER_KEY_ENV];
const originalVersion = process.env[CREDENTIAL_KEY_VERSION_ENV];
const originalPrevious = process.env[CREDENTIAL_PREVIOUS_KEY_ENV];

const restoreEnv = (): void => {
  if (originalMaster === undefined) delete process.env[CREDENTIAL_MASTER_KEY_ENV];
  else process.env[CREDENTIAL_MASTER_KEY_ENV] = originalMaster;
  if (originalVersion === undefined) delete process.env[CREDENTIAL_KEY_VERSION_ENV];
  else process.env[CREDENTIAL_KEY_VERSION_ENV] = originalVersion;
  if (originalPrevious === undefined) delete process.env[CREDENTIAL_PREVIOUS_KEY_ENV];
  else process.env[CREDENTIAL_PREVIOUS_KEY_ENV] = originalPrevious;
  resetWorkflowCredentialMasterKeyCacheForTests();
};

beforeEach(() => {
  restoreEnv();
  process.env[CREDENTIAL_MASTER_KEY_ENV] = crypto.randomBytes(32).toString('hex');
  process.env[CREDENTIAL_KEY_VERSION_ENV] = '1';
  delete process.env[CREDENTIAL_PREVIOUS_KEY_ENV];
  resetCredentialMasterKeyCacheForTests();
});

afterEach(() => {
  restoreEnv();
});

describe('workflowCredentialCrypto', () => {
  it('round-trips a plaintext value through the shared credential blob', () => {
    const blob = encryptWorkflowCredentialValue('sk-super-secret-token');
    expect(isWorkflowCredentialEncryptedBlob(blob)).toBe(true);
    expect(blob.alg).toBe('aes-256-gcm');
    expect(blob.keyVersion).toBe(1);
    expect(decryptWorkflowCredentialValue(blob)).toBe('sk-super-secret-token');
  });

  it('writes distinct ciphertext for the same plaintext', () => {
    const first = encryptWorkflowCredentialValue('same-secret');
    const second = encryptWorkflowCredentialValue('same-secret');
    expect(first.ciphertext).not.toBe(second.ciphertext);
    expect(decryptWorkflowCredentialValue(first)).toBe('same-secret');
    expect(decryptWorkflowCredentialValue(second)).toBe('same-secret');
  });

  it('fails to decrypt with the wrong key', () => {
    const blob = encryptWorkflowCredentialValue('value-a');
    const wrongKey = crypto.randomBytes(32);
    expect(() => decryptWorkflowCredentialValue(blob, wrongKey)).toThrow();
  });

  it('rejects leftover workflow blobs that still use the old shape', () => {
    const leftover = { iv: 'aa', authTag: 'bb', ciphertext: 'cc' };
    expect(isLegacyWorkflowCredentialBlob(leftover)).toBe(true);
    expect(isWorkflowCredentialEncryptedBlob(leftover)).toBe(false);
    expect(() => decryptWorkflowCredentialValue(leftover)).toThrow(/migrate-workflow-secrets/);
  });

  it('does not treat a shared credential blob as leftover', () => {
    const blob = encryptWorkflowCredentialValue('kept');
    expect(isLegacyWorkflowCredentialBlob(blob)).toBe(false);
    expect(isWorkflowCredentialEncryptedBlob(blob)).toBe(true);
  });
});
