import type { PlatformBlobSectionKey } from '../../../shared/api/contracts/settings/scopes';
import {
  getCachedPlatformBlob,
  isPlatformSettingsCacheInitialized,
  persistPlatformBlob,
  replaceCachedPlatformBlob,
} from './platformSettingsCache';

export const readPlatformBlob = <T>(
  settingsPath: string,
  sectionKey: PlatformBlobSectionKey,
  readFromFile: (settingsPath: string) => T,
  normalize: (raw: Record<string, unknown>) => T,
): T => {
  if (isPlatformSettingsCacheInitialized()) {
    const cached = getCachedPlatformBlob(sectionKey);
    if (cached) {
      return normalize(cached);
    }
  }
  return readFromFile(settingsPath);
};

export const writePlatformBlob = <T extends Record<string, unknown>>(
  settingsPath: string,
  sectionKey: PlatformBlobSectionKey,
  value: T,
  writeToFile: (settingsPath: string, value: T) => T,
  actorId: number | null = null,
): T => {
  if (isPlatformSettingsCacheInitialized()) {
    persistPlatformBlob(sectionKey, value, actorId);
    return value;
  }
  return writeToFile(settingsPath, value);
};

export const writePlatformBlobAsync = async <T extends Record<string, unknown>>(
  sectionKey: PlatformBlobSectionKey,
  value: T,
  actorId: number | null = null,
): Promise<T> => {
  await replaceCachedPlatformBlob(sectionKey, value, actorId);
  return value;
};
