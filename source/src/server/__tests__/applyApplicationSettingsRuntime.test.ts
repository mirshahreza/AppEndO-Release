import { beforeEach, describe, expect, it, vi } from 'vitest';

const hydrateAiMock = vi.hoisted(() => vi.fn());
const hydrateCacheMock = vi.hoisted(() => vi.fn());
const reloadAiMock = vi.hoisted(() => vi.fn());
const loadCacheMock = vi.hoisted(() => vi.fn());

vi.mock('../domain/security/credentialVault/platformSettingsSecrets', () => ({
  hydrateAiSettingsSecrets: hydrateAiMock,
  hydrateCacheSecrets: hydrateCacheMock,
}));

vi.mock('../../core/ai/AiManager', () => ({
  aiManager: { reloadFromSettings: reloadAiMock },
}));

vi.mock('../../core/cache/CacheManager', () => ({
  cacheManager: { loadSettings: loadCacheMock },
}));

vi.mock('../db/aiSettingsStore', () => ({
  ensureAiSettings: vi.fn(() => ({ enabled: false, models: [] })),
}));

vi.mock('../db/schedulerSettingsStore', () => ({
  ensureSchedulerSettings: vi.fn(() => ({ tickIntervalSec: 60 })),
}));

vi.mock('../db/cacheSettingsStore', () => ({
  ensureCacheSettings: vi.fn(() => ({})),
}));

vi.mock('../db/dataSourcesStore', () => ({
  ensureDataSourcesSettings: vi.fn(),
}));

vi.mock('../db/packagesSettings', () => ({
  ensurePackagesSettings: vi.fn(),
}));

vi.mock('../db/gitSettingsStore', () => ({
  ensureGitSettings: vi.fn(),
}));

vi.mock('../db/platformCultureSettingsStore', () => ({
  ensurePlatformCulturesSettings: vi.fn(),
}));

vi.mock('../db/platformCultureTranslationsStore', () => ({
  ensurePlatformCultureTranslationsSettings: vi.fn(),
}));

vi.mock('../db/feedbackSettingsStore', () => ({
  ensurePlatformFeedbackConfig: vi.fn(),
}));

vi.mock('../db/identityProvidersStore', () => ({
  ensureAuthIdentitySettings: vi.fn(),
}));

vi.mock('../services/platform/platformWebFontsRuntime', () => ({
  applyPlatformWebFontsRuntime: vi.fn(),
}));

vi.mock('../services/platform/platformCultureSettings.service', () => ({
  bootstrapPlatformCulturesFromSettings: vi.fn(),
}));

import { applyApplicationSettingsRuntime } from '../applyApplicationSettingsRuntime';

describe('applyApplicationSettingsRuntime', () => {
  beforeEach(() => {
    hydrateAiMock.mockReset();
    hydrateCacheMock.mockReset();
    reloadAiMock.mockReset();
    loadCacheMock.mockReset();
    hydrateAiMock.mockResolvedValue({ enabled: true, models: [] });
    hydrateCacheMock.mockResolvedValue({});
    loadCacheMock.mockResolvedValue(undefined);
  });

  it('hydrates AI and cache settings before applying runtime managers', async () => {
    await applyApplicationSettingsRuntime('/tmp/settings.json');

    expect(hydrateAiMock).toHaveBeenCalledTimes(1);
    expect(hydrateCacheMock).toHaveBeenCalledTimes(1);
    expect(reloadAiMock).toHaveBeenCalledTimes(1);
    expect(loadCacheMock).toHaveBeenCalledTimes(1);
  });
});
