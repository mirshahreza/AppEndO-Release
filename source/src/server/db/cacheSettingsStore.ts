import { readSettingsObject, writeSettingsObject } from '../config/settingsFile';
import { DEFAULT_CACHE_SETTINGS } from '../../shared/api/contracts/cache/constants';
import {
  CacheValidationError,
  normalizeCacheSettings,
  validateCacheSettings,
} from '../../shared/api/contracts/cache/validators';
import type { CacheSettings } from '../../shared/api/contracts/cache/types';
import { readPlatformBlob, writePlatformBlob } from '../services/settings/platformSettingsStore';
import {
  assertCacheSettingsHaveNoPlaintextSecret,
  isLegacySettingsSecretError,
} from '../domain/security/credentialVault/platformSettingsSecrets';

const CACHE_SETTINGS_KEY = 'cache';

export { CacheValidationError };

const readNormalizedCacheSettings = (raw: unknown): CacheSettings => {
  const normalized = normalizeCacheSettings(raw);
  validateCacheSettings(normalized);
  assertCacheSettingsHaveNoPlaintextSecret(normalized);
  return normalized;
};

export const getCacheSettingsFromFile = (settingsPath: string): CacheSettings => {
  const settings = readSettingsObject(settingsPath);
  const raw = settings[CACHE_SETTINGS_KEY];
  try {
    return readNormalizedCacheSettings(raw);
  } catch (error) {
    if (isLegacySettingsSecretError(error)) {
      throw error;
    }
    return normalizeCacheSettings(DEFAULT_CACHE_SETTINGS);
  }
};

const normalizeCacheBlob = (raw: Record<string, unknown>): CacheSettings => {
  try {
    return readNormalizedCacheSettings(raw);
  } catch (error) {
    if (isLegacySettingsSecretError(error)) {
      throw error;
    }
    return normalizeCacheSettings(DEFAULT_CACHE_SETTINGS);
  }
};

export const getCacheSettings = (settingsPath: string): CacheSettings =>
  readPlatformBlob(settingsPath, 'cache', getCacheSettingsFromFile, normalizeCacheBlob);

export const saveCacheSettingsToFile = (
  settingsPath: string,
  cache: CacheSettings,
): CacheSettings => {
  const normalized = normalizeCacheSettings(cache);
  validateCacheSettings(normalized);
  const settings = readSettingsObject(settingsPath);
  settings[CACHE_SETTINGS_KEY] = normalized;
  writeSettingsObject(settingsPath, settings);
  return normalized;
};

export const saveCacheSettings = (
  settingsPath: string,
  cache: CacheSettings,
): CacheSettings => {
  const normalized = normalizeCacheSettings(cache);
  validateCacheSettings(normalized);
  return writePlatformBlob(
    settingsPath,
    'cache',
    normalized as unknown as Record<string, unknown>,
    saveCacheSettingsToFile,
  ) as unknown as CacheSettings;
};

export const ensureCacheSettings = (settingsPath: string): CacheSettings => getCacheSettings(settingsPath);
