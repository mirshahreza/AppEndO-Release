import {
  decryptCredential,
  encryptCredential,
  isCredentialEncryptedBlob,
  resetCredentialMasterKeyCacheForTests,
  type CredentialEncryptedBlob,
} from '../security/credentialVault/credentialCrypto';

/**
 * Workflow secret-reference values stay in Prisma `encryptedValueJson`.
 * Encryption uses the shared credential-vault crypto (same blob shape and master key).
 */

export type WorkflowCredentialEncryptedBlob = CredentialEncryptedBlob;

export const LEGACY_WORKFLOW_SECRET_BLOB_ERROR = [
  'Workflow secret reference still has a legacy encrypted blob in encryptedValueJson.',
  'Run scripts/migrations/credential-vault/migrate-workflow-secrets.ts before starting the app.',
].join(' ');

export const isLegacyWorkflowCredentialBlob = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  if (isCredentialEncryptedBlob(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.iv === 'string'
    && typeof record.authTag === 'string'
    && typeof record.ciphertext === 'string'
    && record.iv.length > 0
    && record.authTag.length > 0
    && record.ciphertext.length > 0;
};

export const isWorkflowCredentialEncryptedBlob = (value: unknown): value is WorkflowCredentialEncryptedBlob => (
  isCredentialEncryptedBlob(value)
);

export function encryptWorkflowCredentialValue(
  plaintext: string,
  masterKey?: Buffer,
): WorkflowCredentialEncryptedBlob {
  return masterKey ? encryptCredential(plaintext, masterKey) : encryptCredential(plaintext);
}

export function decryptWorkflowCredentialValue(
  blob: unknown,
  masterKey?: Buffer,
): string {
  if (isLegacyWorkflowCredentialBlob(blob)) {
    throw new Error(LEGACY_WORKFLOW_SECRET_BLOB_ERROR);
  }
  if (!isCredentialEncryptedBlob(blob)) {
    throw new Error('Workflow secret value is not a credential-vault encrypted blob.');
  }
  return decryptCredential(blob, masterKey);
}

export function resetWorkflowCredentialMasterKeyCacheForTests(): void {
  resetCredentialMasterKeyCacheForTests();
}
