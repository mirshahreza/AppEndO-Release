import {
  deleteSecretsForOwner,
  getSecret,
  setSecret,
} from '../../domain/security/credentialVault/credentialVault';

export const GIT_CREDENTIAL_VAULT_OWNER_TYPE = 'git_credential';
export const GIT_CREDENTIAL_VAULT_OWNER_ID = 'app';
export const GIT_CREDENTIAL_TOKEN_PURPOSE = 'token';

export const LEGACY_GIT_SECRET_ERROR = [
  'Git credentials still have a token blob or plaintext token on disk.',
  'Run scripts/migrations/credential-vault/migrate-git-credentials.ts before starting the app.',
].join(' ');

export const isLegacyGitSecretBlob = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return record.v === 1
    && typeof record.iv === 'string'
    && typeof record.authTag === 'string'
    && typeof record.ciphertext === 'string'
    && record.iv.length > 0
    && record.authTag.length > 0
    && record.ciphertext.length > 0;
};

export const isLegacyGitTokenField = (value: unknown): boolean => {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  return isLegacyGitSecretBlob(value);
};

export async function setGitCredentialToken(plaintext: string): Promise<void> {
  await setSecret(
    GIT_CREDENTIAL_VAULT_OWNER_TYPE,
    GIT_CREDENTIAL_VAULT_OWNER_ID,
    GIT_CREDENTIAL_TOKEN_PURPOSE,
    plaintext,
  );
}

export async function getGitCredentialToken(): Promise<string | null> {
  return getSecret(
    GIT_CREDENTIAL_VAULT_OWNER_TYPE,
    GIT_CREDENTIAL_VAULT_OWNER_ID,
    GIT_CREDENTIAL_TOKEN_PURPOSE,
  );
}

export async function deleteGitCredentialToken(): Promise<void> {
  await deleteSecretsForOwner(GIT_CREDENTIAL_VAULT_OWNER_TYPE, GIT_CREDENTIAL_VAULT_OWNER_ID);
}
