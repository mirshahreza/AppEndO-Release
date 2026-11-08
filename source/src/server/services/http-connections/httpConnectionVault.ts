import {
  deleteSecretsForOwner,
  getSecret,
  setSecret,
} from '../../domain/security/credentialVault/credentialVault';

export const HTTP_CONNECTION_VAULT_OWNER_TYPE = 'http_connection';
export const HTTP_WORKSHOP_VAULT_OWNER_TYPE = 'http_workshop_request';
export const HTTP_SECRET_PURPOSE = 'secret';

export const LEGACY_HTTP_SECRET_BLOB_ERROR = [
  'HTTP connection or API Talk auth still has an encrypted secret blob on disk.',
  'Run scripts/migrations/credential-vault/migrate-http-connections.ts before starting the app.',
].join(' ');

export const isLegacyHttpSecretBlob = (value: unknown): boolean => {
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

export async function setHttpVaultSecret(
  ownerType: string,
  ownerId: string,
  plaintext: string,
): Promise<void> {
  await setSecret(ownerType, ownerId, HTTP_SECRET_PURPOSE, plaintext);
}

export async function getHttpVaultSecret(
  ownerType: string,
  ownerId: string,
): Promise<string | null> {
  return getSecret(ownerType, ownerId, HTTP_SECRET_PURPOSE);
}

export async function deleteHttpVaultSecrets(ownerType: string, ownerId: string): Promise<void> {
  await deleteSecretsForOwner(ownerType, ownerId);
}

export async function copyHttpVaultSecret(
  ownerType: string,
  fromOwnerId: string,
  toOwnerId: string,
): Promise<boolean> {
  const plaintext = await getHttpVaultSecret(ownerType, fromOwnerId);
  if (!plaintext) {
    return false;
  }
  await setHttpVaultSecret(ownerType, toOwnerId, plaintext);
  return true;
}
