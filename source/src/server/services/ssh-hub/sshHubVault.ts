import {
  deleteSecret,
  deleteSecretsForOwner,
  getSecret,
  setSecret,
} from '../../domain/security/credentialVault/credentialVault';

export const SSH_HUB_VAULT_OWNER_TYPE = 'ssh_hub';
export const SSH_HUB_PASSWORD_PURPOSE = 'password';
export const SSH_HUB_PRIVATE_KEY_PURPOSE = 'ssh_private_key';
export const SSH_HUB_PASSPHRASE_PURPOSE = 'passphrase';

export const LEGACY_SSH_HUB_SECRET_BLOB_ERROR = [
  'SSH Hub connection still has an encrypted secret blob on disk.',
  'Run scripts/migrations/credential-vault/migrate-ssh-hub.ts before starting the app.',
].join(' ');

export const isLegacySshHubSecretBlob = (value: unknown): boolean => {
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

export async function setSshHubVaultSecret(ownerId: string, purpose: string, plaintext: string): Promise<void> {
  await setSecret(SSH_HUB_VAULT_OWNER_TYPE, ownerId, purpose, plaintext);
}

export async function getSshHubVaultSecret(ownerId: string, purpose: string): Promise<string | null> {
  return getSecret(SSH_HUB_VAULT_OWNER_TYPE, ownerId, purpose);
}

export async function deleteSshHubVaultSecret(ownerId: string, purpose: string): Promise<void> {
  await deleteSecret(SSH_HUB_VAULT_OWNER_TYPE, ownerId, purpose);
}

export async function deleteSshHubVaultSecrets(ownerId: string): Promise<void> {
  await deleteSecretsForOwner(SSH_HUB_VAULT_OWNER_TYPE, ownerId);
}
