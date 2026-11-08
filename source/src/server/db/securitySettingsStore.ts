import { buildDefaultRuntimeSettings, readRuntimeSettings } from '../config/settingsFile';
import { loadAuthSecrets, type SecuritySettings } from '../config/authSecrets';
import { readPlatformBlob, writePlatformBlob } from '../services/settings/platformSettingsStore';
import { writePlatformBlobAsync } from '../services/settings/platformSettingsStore';

const normalizeSecuritySettings = (raw: Record<string, unknown>): SecuritySettings => {
  const defaults = buildDefaultRuntimeSettings();
  return {
    accessTokenSecret: typeof raw.accessTokenSecret === 'string' && raw.accessTokenSecret.trim()
      ? raw.accessTokenSecret.trim()
      : defaults.accessTokenSecret,
    refreshTokenSecret: typeof raw.refreshTokenSecret === 'string' && raw.refreshTokenSecret.trim()
      ? raw.refreshTokenSecret.trim()
      : defaults.refreshTokenSecret,
  };
};

export const getSecuritySettingsFromRuntime = (settingsPath: string): SecuritySettings => {
  const runtime = readRuntimeSettings(settingsPath);
  return {
    accessTokenSecret: runtime.accessTokenSecret,
    refreshTokenSecret: runtime.refreshTokenSecret,
  };
};

export const getSecuritySettings = (settingsPath: string): SecuritySettings =>
  readPlatformBlob(
    settingsPath,
    'security',
    getSecuritySettingsFromRuntime,
    normalizeSecuritySettings,
  );

export const saveSecuritySettings = (
  settingsPath: string,
  security: SecuritySettings,
): SecuritySettings => {
  const normalized = normalizeSecuritySettings(security as unknown as Record<string, unknown>);
  loadAuthSecrets(normalized);
  return writePlatformBlob(
    settingsPath,
    'security',
    normalized as unknown as Record<string, unknown>,
    (_path, value) => value as unknown as SecuritySettings,
  ) as unknown as SecuritySettings;
};

export const saveSecuritySettingsAsync = async (
  security: SecuritySettings,
  actorId: number | null,
): Promise<SecuritySettings> => {
  const normalized = normalizeSecuritySettings(security as unknown as Record<string, unknown>);
  loadAuthSecrets(normalized);
  await writePlatformBlobAsync('security', normalized as unknown as Record<string, unknown>, actorId);
  return normalized;
};

export const applySecuritySettingsFromPlatformCache = (settingsPath: string): void => {
  loadAuthSecrets(getSecuritySettings(settingsPath));
};
