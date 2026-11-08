import { cacheManager } from '../../core/cache/CacheManager';
import {
  getCacheSettings,
  saveCacheSettings,
  CacheValidationError,
} from '../db/cacheSettingsStore';
import { HttpError } from '../errors/HttpError';
import {
  mergeCacheSettingsPatch,
  redactCacheSettings,
} from '../../shared/api/contracts/cache/validators';
import type { CacheSettings } from '../../shared/api/contracts/cache/types';
import {
  applyCacheEntriesListQuery,
  type CacheEntriesListQuery,
} from '../../shared/api/contracts/cache/listQuery';
import {
  hydrateCacheSecrets,
  syncCacheRedisPassword,
} from '../domain/security/credentialVault/platformSettingsSecrets';

export type CacheServiceDeps = {
  settingsPath: string;
};

export class CacheService {
  constructor(private readonly deps: CacheServiceDeps) {}

  getSettings() {
    const settings = cacheManager.getSettings();
    return { body: { success: true as const, settings: redactCacheSettings(settings) } };
  }

  async updateSettings(payload: Partial<CacheSettings>) {
    try {
      const current = getCacheSettings(this.deps.settingsPath);
      const merged = mergeCacheSettingsPatch(current, payload);
      const stripped = await syncCacheRedisPassword(merged);
      const saved = saveCacheSettings(this.deps.settingsPath, stripped);
      const settings = await cacheManager.loadSettings(await hydrateCacheSecrets(saved));
      return { body: { success: true as const, settings: redactCacheSettings(settings) } };
    } catch (error: unknown) {
      if (error instanceof CacheValidationError) {
        throw new HttpError(400, error.message);
      }
      const message = error instanceof Error ? error.message : 'Failed to update cache settings.';
      throw new HttpError(400, message);
    }
  }

  async testSettings(payload: Partial<CacheSettings>) {
    try {
      const current = getCacheSettings(this.deps.settingsPath);
      const merged = mergeCacheSettingsPatch(current, payload);
      const forTest = await hydrateCacheSecrets(merged);
      if (merged.driver !== 'redis') {
        return {
          body: {
            success: true as const,
            result: { success: true, message: 'Memory storage does not require a connection test.' },
          },
        };
      }

      const result = await cacheManager.testRedisConnection(forTest.storeSettings.redis);
      return { body: { success: true as const, result } };
    } catch (error: unknown) {
      if (error instanceof CacheValidationError) {
        throw new HttpError(400, error.message);
      }
      const message = error instanceof Error ? error.message : 'Failed to test cache settings.';
      throw new HttpError(400, message);
    }
  }

  async getStatus() {
    const status = await cacheManager.getCacheStatus();
    return {
      body: {
        success: true as const,
        status: {
          status: status.status.toLowerCase() as 'connected' | 'disconnected' | 'error',
          driver: status.driver,
          keyCount: status.keyCount,
          lastError: status.lastError,
          isEnabled: status.isEnabled,
        },
      },
    };
  }

  async listEntries(query: CacheEntriesListQuery = {}) {
    const items = await cacheManager.listEntries();
    const filtered = applyCacheEntriesListQuery(items, query);
    return { body: { success: true as const, items: filtered } };
  }

  async getEntry(key: string) {
    const entry = await cacheManager.getEntry(key);
    if (!entry) {
      throw new HttpError(404, 'Cache key not found.');
    }
    return {
      body: {
        success: true as const,
        cacheKey: entry.cacheKey,
        cacheType: entry.cacheType,
        value: entry.value,
      },
    };
  }

  async clearAll() {
    await cacheManager.clearAll();
    return { body: { success: true as const, message: 'All cache entries evicted.' } };
  }

  async deleteKey(key: string) {
    const deleted = await cacheManager.deleteKey(key);
    if (!deleted) {
      throw new HttpError(404, 'Cache key not found.');
    }
    return { body: { success: true as const } };
  }
}
