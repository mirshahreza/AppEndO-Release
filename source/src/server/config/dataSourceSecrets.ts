import {
  decryptCredential,
  encryptCredential,
  isCredentialEncryptedBlob,
  resolveCredentialKeyVersion,
  resolveCredentialPreviousKey,
  type CredentialEncryptedBlob,
} from '../domain/security/credentialVault/credentialCrypto';
import { readSettingsObject, writeSettingsObject } from './settingsFile';

type DataSourceSecretInput = {
  password?: string;
  passwordEnvKey?: string;
  passwordCipher?: unknown;
  type?: string;
};

const DEFAULT_PG_PASSWORD_ENV_KEY = 'PGPASSWORD';

export const DEFAULT_DATA_SOURCE_PLAINTEXT_PASSWORD_ERROR = [
  'Default data source still has a plaintext password on disk.',
  'Run scripts/migrations/credential-vault/migrate-data-sources.ts before starting the app.',
].join(' ');

const PASSWORD_ENV_PLACEHOLDERS = new Set([
  DEFAULT_PG_PASSWORD_ENV_KEY,
  'CHANGE_ME',
  'your_postgres_password',
]);

const DATA_SOURCES_SETTINGS_KEY = 'dataSources';

const readEnvPassword = (envKey: string): string => {
  const key = envKey.trim() || DEFAULT_PG_PASSWORD_ENV_KEY;
  return String(process.env[key] ?? '').trim();
};

const resolveEnvKey = (input: DataSourceSecretInput): string => (
  String(input.passwordEnvKey ?? DEFAULT_PG_PASSWORD_ENV_KEY).trim() || DEFAULT_PG_PASSWORD_ENV_KEY
);

export const isRealDataSourcePassword = (value: unknown): boolean => {
  const raw = String(value ?? '').trim();
  return Boolean(raw) && !PASSWORD_ENV_PLACEHOLDERS.has(raw);
};

export const resolveDataSourcePassword = (input: DataSourceSecretInput): string => {
  const raw = String(input.password ?? '').trim();
  const envKey = resolveEnvKey(input);
  const fromEnv = readEnvPassword(envKey);
  const cloneDevPassword = process.env.APPENDO_CLONE_SQL_PASSWORD?.trim();

  if ((!raw || PASSWORD_ENV_PLACEHOLDERS.has(raw)) && fromEnv) {
    return fromEnv;
  }

  if ((!raw || PASSWORD_ENV_PLACEHOLDERS.has(raw)) && cloneDevPassword) {
    return cloneDevPassword;
  }

  if (raw && !PASSWORD_ENV_PLACEHOLDERS.has(raw)) {
    return raw;
  }

  if (isCredentialEncryptedBlob(input.passwordCipher)) {
    return decryptCredential(input.passwordCipher);
  }

  return fromEnv;
};

export const hydrateDataSourcePassword = <T extends DataSourceSecretInput>(
  source: T,
): T & { password: string } => ({
  ...source,
  password: resolveDataSourcePassword(source),
});

export const dataSourceHasStoredPassword = (input: DataSourceSecretInput): boolean => {
  if (readEnvPassword(resolveEnvKey(input))) {
    return true;
  }
  if (isCredentialEncryptedBlob(input.passwordCipher)) {
    return true;
  }
  return isRealDataSourcePassword(input.password);
};

type DiskDataSourceSecretInput = DataSourceSecretInput & {
  passwordCipher?: CredentialEncryptedBlob;
};

export const parseDiskDataSourceSecretInput = (
  item: Record<string, unknown>,
  options?: { allowPlaintext?: boolean },
): DiskDataSourceSecretInput => {
  const password = item.password !== undefined ? String(item.password) : undefined;
  if (!options?.allowPlaintext && isRealDataSourcePassword(password)) {
    throw new Error(DEFAULT_DATA_SOURCE_PLAINTEXT_PASSWORD_ERROR);
  }

  return {
    password: options?.allowPlaintext
      ? password
      : (password && PASSWORD_ENV_PLACEHOLDERS.has(password.trim()) ? password : undefined),
    passwordEnvKey: item.passwordEnvKey !== undefined ? String(item.passwordEnvKey) : undefined,
    passwordCipher: isCredentialEncryptedBlob(item.passwordCipher) ? item.passwordCipher : undefined,
    type: item.type !== undefined ? String(item.type) : undefined,
  };
};

export const readDefaultDataSourceSecretInputFromSettings = (
  settingsPath: string,
  options?: { allowPlaintext?: boolean },
): DiskDataSourceSecretInput => {
  const settings = readSettingsObject(settingsPath);
  const raw = settings[DATA_SOURCES_SETTINGS_KEY];
  const array = Array.isArray(raw) ? raw : [];
  const defaultSource = array.find((item) => {
    if (!item || typeof item !== 'object') return false;
    return Boolean((item as Record<string, unknown>).isDefault);
  }) ?? array[0];

  if (!defaultSource || typeof defaultSource !== 'object') {
    return {};
  }

  return parseDiskDataSourceSecretInput(defaultSource as Record<string, unknown>, options);
};

type PersistedDefaultDataSourceFields = {
  passwordEnvKey?: string;
  passwordCipher?: CredentialEncryptedBlob;
};

export const toPersistedDefaultSecretFields = (
  source: DataSourceSecretInput,
  options?: { passwordUpdate?: string },
): PersistedDefaultDataSourceFields => {
  const envKey = String(source.passwordEnvKey ?? '').trim();
  const explicitUpdate = options?.passwordUpdate !== undefined
    ? String(options.passwordUpdate).trim()
    : undefined;

  let passwordCipher = isCredentialEncryptedBlob(source.passwordCipher)
    ? source.passwordCipher
    : undefined;

  const encryptIfReal = (candidate: string): void => {
    if (!candidate || PASSWORD_ENV_PLACEHOLDERS.has(candidate)) {
      return;
    }
    passwordCipher = encryptCredential(candidate);
  };

  if (explicitUpdate !== undefined) {
    if (explicitUpdate) {
      encryptIfReal(explicitUpdate);
    }
  } else if (!passwordCipher) {
    const raw = String(source.password ?? '').trim();
    const fromEnv = readEnvPassword(envKey || DEFAULT_PG_PASSWORD_ENV_KEY);
    if (raw && !PASSWORD_ENV_PLACEHOLDERS.has(raw) && raw !== fromEnv) {
      encryptIfReal(raw);
    }
  }

  const persisted: PersistedDefaultDataSourceFields = {};
  if (envKey) {
    persisted.passwordEnvKey = envKey;
  }
  if (passwordCipher) {
    persisted.passwordCipher = passwordCipher;
  }
  return persisted;
};

export const PREVIOUS_KEY_REQUIRED_FOR_ROTATE = [
  'APPENDO_CREDENTIAL_MASTER_KEY_PREVIOUS is required before rotating secrets that still use the previous key version.',
].join(' ');

const dataSourceRotateLabel = (item: Record<string, unknown>, index: number): string => {
  const name = String(item.name ?? '').trim();
  const id = String(item.id ?? '').trim();
  if (name) return name;
  if (id) return id;
  return `dataSources[${index}]`;
};

/**
 * Re-encrypts stale `passwordCipher` blobs in settings.json with the current
 * master-key version. Operator-only; not wired to boot.
 */
export const rotateDefaultDataSourcePasswordCipher = (
  settingsPath: string,
): { migrated: number; failed: string[] } => {
  const currentVersion = resolveCredentialKeyVersion();
  const settings = readSettingsObject(settingsPath);
  const raw = settings[DATA_SOURCES_SETTINGS_KEY];
  const array = Array.isArray(raw) ? [...raw] : [];

  const staleIndexes: number[] = [];
  for (let index = 0; index < array.length; index += 1) {
    const item = array[index];
    if (!item || typeof item !== 'object') continue;
    const cipher = (item as Record<string, unknown>).passwordCipher;
    if (isCredentialEncryptedBlob(cipher) && cipher.keyVersion !== currentVersion) {
      staleIndexes.push(index);
    }
  }

  if (staleIndexes.length === 0) {
    return { migrated: 0, failed: [] };
  }

  const needsPrevious = staleIndexes.some((index) => {
    const item = array[index] as Record<string, unknown>;
    return isCredentialEncryptedBlob(item.passwordCipher)
      && item.passwordCipher.keyVersion === currentVersion - 1;
  });
  if (needsPrevious && !resolveCredentialPreviousKey()) {
    throw new Error(PREVIOUS_KEY_REQUIRED_FOR_ROTATE);
  }

  let migrated = 0;
  const failed: string[] = [];
  let mutated = false;

  for (const index of staleIndexes) {
    const item = array[index] as Record<string, unknown>;
    const label = dataSourceRotateLabel(item, index);
    try {
      const plaintext = decryptCredential(item.passwordCipher as CredentialEncryptedBlob);
      array[index] = { ...item, passwordCipher: encryptCredential(plaintext) };
      migrated += 1;
      mutated = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failed.push(`${label}: ${message}`);
    }
  }

  if (mutated) {
    settings[DATA_SOURCES_SETTINGS_KEY] = array;
    writeSettingsObject(settingsPath, settings);
  }

  return { migrated, failed };
};
