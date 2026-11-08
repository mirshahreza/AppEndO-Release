import {
  deleteSecret,
  deleteSecretsForOwner,
  getSecret,
  setSecret,
} from '../../domain/security/credentialVault/credentialVault';

export const FILE_HUB_VAULT_OWNER_TYPE = 'file_hub';
export const FILE_HUB_PASSWORD_PURPOSE = 'password';
export const FILE_HUB_PRIVATE_KEY_PURPOSE = 'ssh_private_key';
export const FILE_HUB_PASSPHRASE_PURPOSE = 'passphrase';

export const LEGACY_FILE_HUB_SECRET_BLOB_ERROR = [
  'File Hub connection still has an encrypted secret blob on disk.',
  'Run scripts/migrations/credential-vault/migrate-file-hub.ts before starting the app.',
].join(' ');

export const isLegacyFileHubSecretBlob = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') {
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

export async function setFileHubVaultSecret(ownerId: string, purpose: string, plaintext: string): Promise<void> {
  await setSecret(FILE_HUB_VAULT_OWNER_TYPE, ownerId, purpose, plaintext);
}

export async function getFileHubVaultSecret(ownerId: string, purpose: string): Promise<string | null> {
  return getSecret(FILE_HUB_VAULT_OWNER_TYPE, ownerId, purpose);
}

export async function deleteFileHubVaultSecret(ownerId: string, purpose: string): Promise<void> {
  await deleteSecret(FILE_HUB_VAULT_OWNER_TYPE, ownerId, purpose);
}

export async function deleteFileHubVaultSecrets(ownerId: string): Promise<void> {
  await deleteSecretsForOwner(FILE_HUB_VAULT_OWNER_TYPE, ownerId);
}
