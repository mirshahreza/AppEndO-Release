import {
  deleteSecret,
  deleteSecretsForOwner,
  getSecret,
  setSecret,
} from './credentialVault';

export const PLATFORM_SETTINGS_OWNER_ID = 'app';

export const PLATFORM_SMTP_OWNER_TYPE = 'platform_smtp';
export const PLATFORM_REDIS_OWNER_TYPE = 'platform_redis';
export const AI_PROVIDER_OWNER_TYPE = 'ai_provider';
export const AI_INBOUND_HOST_OWNER_TYPE = 'ai_inbound_host';
export const AI_WEB_SEARCH_OWNER_TYPE = 'ai_web_search';
export const AI_MCP_SERVER_OWNER_TYPE = 'ai_mcp_server';
export const GIT_OAUTH_OWNER_TYPE = 'git_oauth';
export const IDENTITY_PROVIDER_OWNER_TYPE = 'identity_provider';

export const PASSWORD_PURPOSE = 'password';
export const API_KEY_PURPOSE = 'api_key';
export const ENV_JSON_PURPOSE = 'env_json';
export const CLIENT_SECRET_PURPOSE = 'client_secret';

export const LEGACY_SETTINGS_PLAINTEXT_SECRET_ERROR = [
  'Settings still contain a plaintext secret.',
  'Run scripts/migrations/credential-vault/migrate-settings-secrets.ts before starting the app.',
].join(' ');

const DEFAULT_REDACTED = ['••••••••', '***'];

export const isBlankOrRedactedSecret = (value: unknown, extraTokens: string[] = []): boolean => {
  if (typeof value !== 'string') {
    return true;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return true;
  }
  return DEFAULT_REDACTED.includes(trimmed) || extraTokens.includes(trimmed);
};

export const isLegacyPlaintextSecret = (value: unknown, extraTokens: string[] = []): boolean => {
  if (typeof value !== 'string') {
    return false;
  }
  return !isBlankOrRedactedSecret(value, extraTokens);
};

export const isLegacySecretEnvRecord = (value: unknown, extraTokens: string[] = []): boolean => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  return Object.values(value as Record<string, unknown>).some((entry) => (
    isLegacyPlaintextSecret(entry, extraTokens)
  ));
};

export const assertNoLegacyPlaintextSecret = (value: unknown, extraTokens: string[] = []): void => {
  if (isLegacyPlaintextSecret(value, extraTokens) || isLegacySecretEnvRecord(value, extraTokens)) {
    throw new Error(LEGACY_SETTINGS_PLAINTEXT_SECRET_ERROR);
  }
};

export const isLegacySettingsSecretError = (error: unknown): boolean => (
  error instanceof Error && error.message === LEGACY_SETTINGS_PLAINTEXT_SECRET_ERROR
);

export async function setPlatformSecret(
  ownerType: string,
  ownerId: string,
  purpose: string,
  plaintext: string,
): Promise<void> {
  await setSecret(ownerType, ownerId, purpose, plaintext);
}

export async function getPlatformSecret(
  ownerType: string,
  ownerId: string,
  purpose: string,
): Promise<string | null> {
  return getSecret(ownerType, ownerId, purpose);
}

export async function deletePlatformSecret(
  ownerType: string,
  ownerId: string,
  purpose: string,
): Promise<void> {
  await deleteSecret(ownerType, ownerId, purpose);
}

export async function deletePlatformSecretsForOwner(ownerType: string, ownerId: string): Promise<void> {
  await deleteSecretsForOwner(ownerType, ownerId);
}
