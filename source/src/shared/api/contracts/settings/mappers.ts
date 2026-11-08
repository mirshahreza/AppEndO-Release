import { DEFAULT_SETTINGS } from './constants';
import { mapPwaSettings } from './pwaMappers';
import { parseLogRetentionSettings } from './retention';
import type { AppSettings } from './types';

export const mapAppSettings = (data: unknown): AppSettings => {
  const root = data && typeof data === 'object' ? data as Record<string, unknown> : {};
  const { pwa, logRetention, logRetentionDays, logViewerRefreshSeconds: _ignoredRefresh, ...rest } = root;
  const parsedRetention = parseLogRetentionSettings(logRetention, logRetentionDays);

  return {
    ...DEFAULT_SETTINGS,
    ...(rest as Partial<Omit<AppSettings, 'pwa' | 'logRetention'>>),
    logRetention: parsedRetention,
    logRetentionDays: parsedRetention.appLogs.olderThanDays ?? DEFAULT_SETTINGS.logRetentionDays,
    pwa: mapPwaSettings(pwa),
  };
};

export { mapPwaSettings } from './pwaMappers';
