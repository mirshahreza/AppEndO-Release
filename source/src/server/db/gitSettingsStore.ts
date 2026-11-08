import { readSettingsObject, writeSettingsObject } from '../config/settingsFile';
import { DEFAULT_GIT_SETTINGS } from '../../shared/api/contracts/git/constants';
import {
  GitValidationError,
  normalizeGitSettings,
  validateGitSettings,
} from '../../shared/api/contracts/git/validators';
import type { GitSettings } from '../../shared/api/contracts/git/types';
import { readPlatformBlob, writePlatformBlob } from '../services/settings/platformSettingsStore';
import {
  assertGitSettingsHaveNoPlaintextSecret,
  isLegacySettingsSecretError,
  syncGitOAuthSecret,
} from '../domain/security/credentialVault/platformSettingsSecrets';

const GIT_SETTINGS_KEY = 'git';

export { GitValidationError };

export const getGitSettingsFromFile = (settingsPath: string): GitSettings => {
  const settings = readSettingsObject(settingsPath);
  const raw = settings[GIT_SETTINGS_KEY];
  try {
    const normalized = normalizeGitSettings(raw);
    validateGitSettings(normalized);
    assertGitSettingsHaveNoPlaintextSecret(normalized);
    return normalized;
  } catch (error) {
    if (isLegacySettingsSecretError(error)) {
      throw error;
    }
    return normalizeGitSettings(DEFAULT_GIT_SETTINGS);
  }
};

const normalizeGitBlob = (raw: Record<string, unknown>): GitSettings => {
  try {
    const normalized = normalizeGitSettings(raw);
    validateGitSettings(normalized);
    assertGitSettingsHaveNoPlaintextSecret(normalized);
    return normalized;
  } catch (error) {
    if (isLegacySettingsSecretError(error)) {
      throw error;
    }
    return normalizeGitSettings(DEFAULT_GIT_SETTINGS);
  }
};

export const getGitSettings = (settingsPath: string): GitSettings =>
  readPlatformBlob(settingsPath, 'git', getGitSettingsFromFile, normalizeGitBlob);

export const saveGitSettingsToFile = (
  settingsPath: string,
  git: GitSettings,
): GitSettings => {
  const normalized = normalizeGitSettings(git);
  validateGitSettings(normalized);
  const settings = readSettingsObject(settingsPath);
  settings[GIT_SETTINGS_KEY] = normalized;
  writeSettingsObject(settingsPath, settings);
  return normalized;
};

export const saveGitSettings = async (
  settingsPath: string,
  git: GitSettings,
): Promise<GitSettings> => {
  const normalized = normalizeGitSettings(git);
  validateGitSettings(normalized);
  const stripped = await syncGitOAuthSecret(normalized);
  return writePlatformBlob(
    settingsPath,
    'git',
    stripped as unknown as Record<string, unknown>,
    saveGitSettingsToFile,
  ) as unknown as GitSettings;
};

export const ensureGitSettings = (settingsPath: string): GitSettings => getGitSettings(settingsPath);
