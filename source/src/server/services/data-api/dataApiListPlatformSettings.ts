import { getCachedSection, isAppSettingsCacheInitialized } from '../settings/appSettingsCache';

const readServerFunctionsSettingsSection = (): Record<string, unknown> | undefined => {
  if (!isAppSettingsCacheInitialized()) {
    return undefined;
  }
  return getCachedSection('server-functions');
};

const parseEnvBoolean = (raw: string | undefined): boolean | undefined => {
  const normalized = raw?.trim().toLowerCase();
  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }
  return undefined;
};

/** Env `APPENDO_DATA_API_LIST_INCLUDE_COUNT` overrides Settings when set. */
export const readDataApiListIncludeCountEnabled = (): boolean | undefined => {
  const fromEnv = parseEnvBoolean(process.env.APPENDO_DATA_API_LIST_INCLUDE_COUNT);
  if (fromEnv !== undefined) {
    return fromEnv;
  }

  const section = readServerFunctionsSettingsSection();
  if (typeof section?.dataApiListIncludeCountEnabled === 'boolean') {
    return section.dataApiListIncludeCountEnabled;
  }

  return undefined;
};

export const readDataApiListCacheDefaultEnabled = (): boolean => {
  const fromEnv = parseEnvBoolean(process.env.APPENDO_DATA_API_LIST_CACHE_DEFAULT);
  if (fromEnv !== undefined) {
    return fromEnv;
  }

  const section = readServerFunctionsSettingsSection();
  if (typeof section?.dataApiListCacheDefaultEnabled === 'boolean') {
    return section.dataApiListCacheDefaultEnabled;
  }

  return false;
};

export const readDataApiListCacheDefaultTtlMs = (): number => {
  const fromEnv = Number(process.env.APPENDO_DATA_API_LIST_CACHE_TTL_MS);
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return Math.floor(fromEnv);
  }

  const section = readServerFunctionsSettingsSection();
  const fromSettings = Number(section?.dataApiListCacheDefaultTtlMs);
  if (Number.isFinite(fromSettings) && fromSettings > 0) {
    return Math.floor(fromSettings);
  }

  return 60_000;
};
