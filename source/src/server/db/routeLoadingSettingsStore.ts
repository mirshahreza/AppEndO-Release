import { readSettingsObject, writeSettingsObject } from '../config/settingsFile';
import { normalizePlatformRouteLoadingConfig } from '../../shared/api/contracts/routeLoading/normalizers';
import type { PlatformRouteLoadingConfig } from '../../shared/api/contracts/routeLoading/schema';
import { DEFAULT_PLATFORM_ROUTE_LOADING_CONFIG } from '../../shared/api/contracts/routeLoading/constants';
import {
  getCachedPlatformBlob,
  isPlatformSettingsCacheInitialized,
} from '../services/settings/platformSettingsCache';
import { readPlatformBlob, writePlatformBlob } from '../services/settings/platformSettingsStore';

const ROUTE_LOADING_CONFIG_KEY = 'platformRouteLoading';

export const getPlatformRouteLoadingConfigFromFile = (settingsPath: string): PlatformRouteLoadingConfig => {
  const settings = readSettingsObject(settingsPath);
  return normalizePlatformRouteLoadingConfig(settings[ROUTE_LOADING_CONFIG_KEY]);
};

const normalizeRouteLoadingBlob = (raw: Record<string, unknown>): PlatformRouteLoadingConfig =>
  normalizePlatformRouteLoadingConfig(raw);

export const getPlatformRouteLoadingConfig = (settingsPath: string): PlatformRouteLoadingConfig =>
  readPlatformBlob(
    settingsPath,
    'platformRouteLoading',
    getPlatformRouteLoadingConfigFromFile,
    normalizeRouteLoadingBlob,
  );

export const savePlatformRouteLoadingConfigToFile = (
  settingsPath: string,
  config: PlatformRouteLoadingConfig,
): PlatformRouteLoadingConfig => {
  const normalized = normalizePlatformRouteLoadingConfig(config);
  const settings = readSettingsObject(settingsPath);
  settings[ROUTE_LOADING_CONFIG_KEY] = normalized;
  writeSettingsObject(settingsPath, settings);
  return normalized;
};

export const savePlatformRouteLoadingConfig = (
  settingsPath: string,
  config: PlatformRouteLoadingConfig,
): PlatformRouteLoadingConfig => {
  const normalized = normalizePlatformRouteLoadingConfig(config);
  return writePlatformBlob(
    settingsPath,
    'platformRouteLoading',
    normalized as unknown as Record<string, unknown>,
    savePlatformRouteLoadingConfigToFile,
  ) as unknown as PlatformRouteLoadingConfig;
};

export const ensurePlatformRouteLoadingConfig = (settingsPath: string): PlatformRouteLoadingConfig => {
  const settings = readSettingsObject(settingsPath);
  const hasFileKey = ROUTE_LOADING_CONFIG_KEY in settings && settings[ROUTE_LOADING_CONFIG_KEY] != null;
  if (isPlatformSettingsCacheInitialized()) {
    const cached = getCachedPlatformBlob('platformRouteLoading');
    if (cached && Object.keys(cached).length > 0) {
      return normalizePlatformRouteLoadingConfig(cached);
    }
  }
  if (hasFileKey) {
    return getPlatformRouteLoadingConfig(settingsPath);
  }
  return savePlatformRouteLoadingConfig(settingsPath, DEFAULT_PLATFORM_ROUTE_LOADING_CONFIG);
};
