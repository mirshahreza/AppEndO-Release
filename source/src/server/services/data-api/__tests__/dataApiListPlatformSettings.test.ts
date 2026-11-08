import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../settings/appSettingsCache', () => ({
  isAppSettingsCacheInitialized: vi.fn(() => true),
  getCachedSection: vi.fn(() => ({})),
}));

import { getCachedSection, isAppSettingsCacheInitialized } from '../../settings/appSettingsCache';
import {
  readDataApiListCacheDefaultEnabled,
  readDataApiListCacheDefaultTtlMs,
  readDataApiListIncludeCountEnabled,
} from '../dataApiListPlatformSettings';

describe('dataApiListPlatformSettings', () => {
  beforeEach(() => {
    vi.mocked(isAppSettingsCacheInitialized).mockReturnValue(true);
    vi.mocked(getCachedSection).mockReturnValue({});
    delete process.env.APPENDO_DATA_API_LIST_INCLUDE_COUNT;
    delete process.env.APPENDO_DATA_API_LIST_CACHE_DEFAULT;
    delete process.env.APPENDO_DATA_API_LIST_CACHE_TTL_MS;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('reads list include count from settings when env unset', () => {
    vi.mocked(getCachedSection).mockReturnValue({ dataApiListIncludeCountEnabled: false });
    expect(readDataApiListIncludeCountEnabled()).toBe(false);
  });

  it('env overrides settings for list include count', () => {
    vi.mocked(getCachedSection).mockReturnValue({ dataApiListIncludeCountEnabled: false });
    process.env.APPENDO_DATA_API_LIST_INCLUDE_COUNT = 'true';
    expect(readDataApiListIncludeCountEnabled()).toBe(true);
  });

  it('reads cache default from settings', () => {
    vi.mocked(getCachedSection).mockReturnValue({
      dataApiListCacheDefaultEnabled: true,
      dataApiListCacheDefaultTtlMs: 120_000,
    });
    expect(readDataApiListCacheDefaultEnabled()).toBe(true);
    expect(readDataApiListCacheDefaultTtlMs()).toBe(120_000);
  });
});
