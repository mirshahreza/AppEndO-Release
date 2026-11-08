import {
  deleteSecret,
  deleteSecretsForOwner,
  getSecret,
  setSecret,
} from '../../domain/security/credentialVault/credentialVault';

export const RDP_HUB_VAULT_OWNER_TYPE = 'rdp_hub';
export const RDP_HUB_PASSWORD_PURPOSE = 'password';

export const LEGACY_RDP_HUB_SECRET_BLOB_ERROR = [
  'RDP Hub connection still has an encrypted secret blob on disk.',
  'Run scripts/migrations/credential-vault/migrate-rdp-hub.ts before starting the app.',
].join(' ');

export const isLegacyRdpHubSecretBlob = (value: unknown): boolean => {
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

export async function setRdpHubVaultSecret(ownerId: string, plaintext: string): Promise<void> {
  await setSecret(RDP_HUB_VAULT_OWNER_TYPE, ownerId, RDP_HUB_PASSWORD_PURPOSE, plaintext);
}

export async function getRdpHubVaultSecret(ownerId: string): Promise<string | null> {
  return getSecret(RDP_HUB_VAULT_OWNER_TYPE, ownerId, RDP_HUB_PASSWORD_PURPOSE);
}

export async function deleteRdpHubVaultSecret(ownerId: string): Promise<void> {
  await deleteSecret(RDP_HUB_VAULT_OWNER_TYPE, ownerId, RDP_HUB_PASSWORD_PURPOSE);
}

export async function deleteRdpHubVaultSecrets(ownerId: string): Promise<void> {
  await deleteSecretsForOwner(RDP_HUB_VAULT_OWNER_TYPE, ownerId);
}
