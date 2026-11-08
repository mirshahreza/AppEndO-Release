import { readSettingsObject, writeSettingsObject } from '../config/settingsFile';
import {
  IdentityProviderValidationError,
  mergeIdentityProviderSecrets,
  normalizeAuthIdentitySettings,
  normalizeIdentityProvider,
} from '../../shared/api/contracts/auth/identityProviderValidators';
import type {
  AuthIdentitySettings,
  IdentityProviderConfig,
} from '../../shared/api/contracts/auth/identityProviders';
import { readPlatformBlob, writePlatformBlob } from '../services/settings/platformSettingsStore';
import {
  assertIdentitySettingsHaveNoPlaintextSecret,
  isLegacySettingsSecretError,
  syncIdentityProviderSecrets,
} from '../domain/security/credentialVault/platformSettingsSecrets';
import { deletePlatformSecretsForOwner, IDENTITY_PROVIDER_OWNER_TYPE } from '../domain/security/credentialVault/platformSettingsVault';

const AUTH_SETTINGS_KEY = 'auth';

export { IdentityProviderValidationError };

const readAuthObject = (settingsPath: string): Record<string, unknown> => {
  const settings = readSettingsObject(settingsPath);
  const raw = settings[AUTH_SETTINGS_KEY];
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
};

export const getAuthIdentitySettingsFromFile = (settingsPath: string): AuthIdentitySettings => {
  const auth = readAuthObject(settingsPath);
  try {
    const normalized = normalizeAuthIdentitySettings(auth);
    assertIdentitySettingsHaveNoPlaintextSecret(normalized);
    return normalized;
  } catch (error) {
    if (isLegacySettingsSecretError(error)) {
      throw error;
    }
    return { identityProviders: [] };
  }
};

export const getAuthIdentitySettings = (settingsPath: string): AuthIdentitySettings =>
  readPlatformBlob(
    settingsPath,
    'identity-providers',
    getAuthIdentitySettingsFromFile,
    (raw) => {
      try {
        const normalized = normalizeAuthIdentitySettings(raw);
        assertIdentitySettingsHaveNoPlaintextSecret(normalized);
        return normalized;
      } catch (error) {
        if (isLegacySettingsSecretError(error)) {
          throw error;
        }
        return { identityProviders: [] };
      }
    },
  );

const writeAuthIdentitySettings = (
  settingsPath: string,
  identitySettings: AuthIdentitySettings,
): AuthIdentitySettings => {
  const normalized = normalizeAuthIdentitySettings(identitySettings);
  return writePlatformBlob(
    settingsPath,
    'identity-providers',
    normalized as unknown as Record<string, unknown>,
    saveAuthIdentitySettingsToFile,
  ) as unknown as AuthIdentitySettings;
};

export const saveAuthIdentitySettingsToFile = (
  settingsPath: string,
  identitySettings: AuthIdentitySettings,
): AuthIdentitySettings => {
  const normalized = normalizeAuthIdentitySettings(identitySettings);
  const settings = readSettingsObject(settingsPath);
  const auth = readAuthObject(settingsPath);
  settings[AUTH_SETTINGS_KEY] = {
    ...auth,
    identityProviders: normalized.identityProviders,
  };
  writeSettingsObject(settingsPath, settings);
  return normalized;
};

export const ensureAuthIdentitySettings = (settingsPath: string): AuthIdentitySettings =>
  getAuthIdentitySettings(settingsPath);

export const getIdentityProviderFromFile = (
  settingsPath: string,
  id: string,
): IdentityProviderConfig | undefined => (
  getAuthIdentitySettings(settingsPath).identityProviders.find((item) => item.id === id)
);

export const mergeIdentityProvider = async (
  settingsPath: string,
  incoming: IdentityProviderConfig,
  mode: 'create' | 'update',
): Promise<AuthIdentitySettings> => {
  const current = getAuthIdentitySettings(settingsPath);
  const normalized = normalizeIdentityProvider(incoming);
  const existingIndex = current.identityProviders.findIndex((item) => item.id === normalized.id);

  if (mode === 'create' && existingIndex >= 0) {
    throw new IdentityProviderValidationError(`Identity provider "${normalized.id}" already exists.`);
  }
  if (mode === 'update' && existingIndex < 0) {
    throw new IdentityProviderValidationError(`Identity provider "${normalized.id}" was not found.`);
  }

  const existing = existingIndex >= 0 ? current.identityProviders[existingIndex] : undefined;
  const merged = mergeIdentityProviderSecrets(normalized, existing);
  const identityProviders = [...current.identityProviders];

  if (mode === 'create') {
    identityProviders.push(merged);
  } else {
    identityProviders[existingIndex] = merged;
  }

  const stripped = await syncIdentityProviderSecrets(identityProviders, current.identityProviders);
  return writeAuthIdentitySettings(settingsPath, { identityProviders: stripped });
};

export const removeIdentityProvider = async (
  settingsPath: string,
  id: string,
): Promise<AuthIdentitySettings> => {
  const current = getAuthIdentitySettings(settingsPath);
  const nextProviders = current.identityProviders.filter((item) => item.id !== id);
  if (nextProviders.length === current.identityProviders.length) {
    throw new IdentityProviderValidationError(`Identity provider "${id}" was not found.`);
  }
  await deletePlatformSecretsForOwner(IDENTITY_PROVIDER_OWNER_TYPE, id);
  const stripped = await syncIdentityProviderSecrets(nextProviders, current.identityProviders);
  return writeAuthIdentitySettings(settingsPath, { identityProviders: stripped });
};
