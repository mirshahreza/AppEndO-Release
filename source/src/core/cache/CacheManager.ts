import { LogMethod, logger } from '../logging/Logger';
import { DEFAULT_CACHE_SETTINGS } from '../../shared/api/contracts/cache/constants';
import {
  mergeCacheSettingsPatch,
  normalizeCacheSettings,
  validateCacheSettings,
} from '../../shared/api/contracts/cache/validators';
import type {
  CacheDriver,
  CacheSettings,
  RedisSettings,
} from '../../shared/api/contracts/cache/types';

export type { CacheDriver, CacheSettings, RedisSettings } from '../../shared/api/contracts/cache/types';

export type CacheConnectivityStatus = 'Connected' | 'Disconnected' | 'Error';

export interface CacheStatus {
  status: CacheConnectivityStatus;
  driver: CacheDriver;
  keyCount: number | null;
  lastError: string | null;
  isEnabled: boolean;
}

export interface CacheEntrySummary {
  cacheKey: string;
  cacheType: string;
  sizeBytes: number;
  hitCount: number;
  createdAt: string;
}

export interface CacheEntryDetail extends CacheEntrySummary {
  value: unknown;
}

type CacheEntryRecord = {
  key: string;
  value: unknown;
  cacheType: string;
  sizeBytes: number;
  hitCount: number;
  createdAtMs: number;
  updatedAtMs: number;
};

interface CacheItem<T> {
  value: T;
  expiry: number;
  createdAt: number;
}

type RedisClientLike = {
  isOpen?: boolean;
  connect?: () => Promise<void>;
  quit?: () => Promise<void>;
  disconnect?: () => Promise<void> | void;
  get?: (key: string) => Promise<string | null>;
  setEx?: (key: string, seconds: number, value: string) => Promise<unknown>;
  del?: (key: string) => Promise<unknown>;
  dbSize?: () => Promise<number>;
  flushDb?: () => Promise<unknown>;
};

const areRedisSettingsEqual = (a: RedisSettings, b: RedisSettings) => (
  a.host === b.host
  && a.port === b.port
  && a.password === b.password
  && a.dbIndex === b.dbIndex
  && a.retryStrategy.maxRetries === b.retryStrategy.maxRetries
  && a.retryStrategy.baseDelayMs === b.retryStrategy.baseDelayMs
  && a.retryStrategy.maxDelayMs === b.retryStrategy.maxDelayMs
);

export class CacheManager {
  private static instance: CacheManager;
  private readonly memoryCache: Map<string, CacheItem<unknown>> = new Map();
  private readonly entries: Map<string, CacheEntryRecord> = new Map();
  private redisClient: RedisClientLike | null = null;
  private settings: CacheSettings = normalizeCacheSettings(DEFAULT_CACHE_SETTINGS);
  private lastError: string | null = null;
  private connectivityStatus: CacheConnectivityStatus = 'Disconnected';

  private constructor() {}

  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  @LogMethod({ id: 'CacheManager.getSettings' })
  public getSettings(): CacheSettings {
    return JSON.parse(JSON.stringify(this.settings)) as CacheSettings;
  }

  @LogMethod({ id: 'CacheManager.get' })
  public async get<T>(key: string): Promise<T | null> {
    if (!this.settings.isEnabled) {
      return null;
    }

    if (this.settings.driver === 'memory') {
      const item = this.memoryCache.get(key);
      if (!item) {
        this.entries.delete(key);
        logger.debug('CacheManager', 'Memory cache miss', { key });
        return null;
      }
      if (Date.now() > item.expiry) {
        this.memoryCache.delete(key);
        this.entries.delete(key);
        logger.debug('CacheManager', 'Memory cache expired item removed', { key });
        return null;
      }
      this.touchHit(key);
      logger.debug('CacheManager', 'Memory cache hit', { key });
      return item.value as T;
    }

    try {
      const client = await this.ensureRedisClient();
      const raw = await client.get?.(key);
      if (!raw) {
        this.entries.delete(key);
        logger.debug('CacheManager', 'Redis cache miss', { key });
        return null;
      }
      const parsed = JSON.parse(raw) as T;
      this.touchHit(key, parsed);
      logger.debug('CacheManager', 'Redis cache hit', { key });
      return parsed;
    } catch (error) {
      this.captureError('Failed to get key from Redis', error);
      return null;
    }
  }

  @LogMethod({ id: 'CacheManager.set' })
  public async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (!this.settings.isEnabled) {
      return;
    }

    const finalTtl = Number.isFinite(ttlSeconds)
      ? Math.max(1, Math.floor(ttlSeconds as number))
      : this.settings.defaultTtl;

    if (this.settings.driver === 'memory') {
      const now = Date.now();
      this.memoryCache.set(key, {
        value,
        expiry: now + finalTtl * 1000,
        createdAt: now,
      });
      this.upsertEntry(key, value);
      this.enforceMemoryCapacity();
      logger.info('CacheManager', 'Memory cache item set', { key, ttlSeconds: finalTtl });
      return;
    }

    try {
      const client = await this.ensureRedisClient();
      await client.setEx?.(key, finalTtl, JSON.stringify(value));
      this.upsertEntry(key, value);
      logger.info('CacheManager', 'Redis cache item set', { key, ttlSeconds: finalTtl });
    } catch (error) {
      this.captureError('Failed to set key in Redis', error);
    }
  }

  @LogMethod({ id: 'CacheManager.invalidate' })
  public async invalidate(key: string): Promise<void> {
    await this.deleteKey(key);
    logger.info('CacheManager', 'Cache item invalidated', { key });
  }

  @LogMethod({ id: 'CacheManager.invalidateByPrefix' })
  public async invalidateByPrefix(prefix: string): Promise<number> {
    const normalizedPrefix = String(prefix ?? '').trim();
    if (!normalizedPrefix) {
      return 0;
    }

    // Prefixes from buildCacheKeyPrefix already end with `:`; do not append another `:`.
    const matchesPrefix = (key: string) => {
      if (key === normalizedPrefix) {
        return true;
      }
      if (normalizedPrefix.endsWith(':')) {
        return key.startsWith(normalizedPrefix);
      }
      return key.startsWith(`${normalizedPrefix}:`);
    };

    const keysToDelete = new Set<string>();
    for (const key of this.entries.keys()) {
      if (matchesPrefix(key)) {
        keysToDelete.add(key);
      }
    }

    if (this.settings.driver === 'redis' && this.settings.isEnabled) {
      try {
        const client = await this.ensureRedisClient();
        const scanIterator = (client as RedisClientLike & {
          scanIterator?: (options: { MATCH: string; COUNT?: number }) => AsyncIterable<string>;
        }).scanIterator;

        if (scanIterator) {
          for await (const key of scanIterator({ MATCH: `${normalizedPrefix}*`, COUNT: 100 })) {
            if (matchesPrefix(key)) {
              keysToDelete.add(key);
            }
          }
        }
      } catch (error) {
        this.captureError('Failed to scan Redis keys for prefix invalidation', error);
      }
    }

    if (keysToDelete.size === 0) {
      return 0;
    }

    await Promise.all(Array.from(keysToDelete, (key) => this.deleteKey(key)));
    logger.info('CacheManager', 'Cache items invalidated by prefix', {
      prefix: normalizedPrefix,
      count: keysToDelete.size,
    });
    return keysToDelete.size;
  }

  @LogMethod({ id: 'CacheManager.listEntries' })
  public async listEntries(): Promise<CacheEntrySummary[]> {
    this.removeExpiredFromMemory();
    const items = Array.from(this.entries.values());
    items.sort((a, b) => b.createdAtMs - a.createdAtMs);
    return items.map((item) => ({
      cacheKey: item.key,
      cacheType: item.cacheType,
      sizeBytes: item.sizeBytes,
      hitCount: item.hitCount,
      createdAt: new Date(item.createdAtMs).toISOString(),
    }));
  }

  @LogMethod({ id: 'CacheManager.getEntry' })
  public async getEntry(key: string): Promise<CacheEntryDetail | null> {
    const value = await this.get<unknown>(key);
    if (value === null) {
      return null;
    }

    const entry = this.entries.get(key);
    if (!entry) {
      this.upsertEntry(key, value);
    }

    const updated = this.entries.get(key);
    if (!updated) {
      return null;
    }

    return {
      cacheKey: updated.key,
      cacheType: updated.cacheType,
      sizeBytes: updated.sizeBytes,
      hitCount: updated.hitCount,
      createdAt: new Date(updated.createdAtMs).toISOString(),
      value,
    };
  }

  @LogMethod({ id: 'CacheManager.deleteKey' })
  public async deleteKey(key: string): Promise<boolean> {
    const existed = this.memoryCache.delete(key) || this.entries.has(key);

    if (this.redisClient) {
      try {
        await this.redisClient.del?.(key);
      } catch (error) {
        this.captureError('Failed to delete key from Redis', error);
      }
    }

    this.entries.delete(key);
    return existed;
  }

  @LogMethod({ id: 'CacheManager.clearAll' })
  public async clearAll(): Promise<void> {
    this.memoryCache.clear();
    this.entries.clear();

    if (this.redisClient) {
      try {
        await this.redisClient.flushDb?.();
      } catch (error) {
        this.captureError('Failed to flush Redis database', error);
      }
    }
  }

  @LogMethod({ id: 'CacheManager.loadSettings' })
  public async loadSettings(settings: CacheSettings): Promise<CacheSettings> {
    const next = normalizeCacheSettings(settings);
    validateCacheSettings(next);
    await this.applySettings(next);
    return this.getSettings();
  }

  @LogMethod({ id: 'CacheManager.updateSettings' })
  public async updateSettings(newSettings: Partial<CacheSettings>): Promise<CacheSettings> {
    const next = mergeCacheSettingsPatch(this.settings, newSettings);
    await this.applySettings(next);
    return this.getSettings();
  }

  @LogMethod({ id: 'CacheManager.testRedisConnection' })
  public async testRedisConnection(redisSettings: RedisSettings): Promise<{ success: boolean; message: string }> {
    const draft = normalizeCacheSettings({
      ...DEFAULT_CACHE_SETTINGS,
      driver: 'redis',
      storeSettings: {
        ...DEFAULT_CACHE_SETTINGS.storeSettings,
        redis: redisSettings,
      },
    });

    try {
      validateCacheSettings(draft);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid Redis settings.';
      return { success: false, message };
    }

    let client: RedisClientLike | null = null;
    try {
      client = await this.createRedisClient(draft.storeSettings.redis);
      await client.connect?.();
      return { success: true, message: 'Redis connection succeeded.' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Redis connection failed.';
      return { success: false, message };
    } finally {
      if (client) {
        try {
          if (client.isOpen && client.quit) {
            await client.quit();
          } else {
            await client.disconnect?.();
          }
        } catch {
          // ignore cleanup errors during probe
        }
      }
    }
  }

  private async applySettings(next: CacheSettings): Promise<void> {
    const previous = this.settings;

    const driverChanged = previous.driver !== next.driver;
    const redisChanged = !areRedisSettingsEqual(previous.storeSettings.redis, next.storeSettings.redis);
    const enabledChanged = previous.isEnabled !== next.isEnabled;

    const shouldReconnectRedis = next.isEnabled && next.driver === 'redis' && (driverChanged || redisChanged || enabledChanged);
    const shouldCloseRedis = this.redisClient && (!next.isEnabled || next.driver !== 'redis' || redisChanged);

    if (shouldCloseRedis) {
      await this.closeRedisClient();
    }

    this.settings = next;

    if (shouldReconnectRedis) {
      await this.ensureRedisClient();
    } else if (next.driver === 'memory') {
      this.connectivityStatus = next.isEnabled ? 'Connected' : 'Disconnected';
    }

    logger.info('CacheManager', 'Cache settings updated at runtime', {
      fromDriver: previous.driver,
      toDriver: next.driver,
      isEnabled: next.isEnabled,
    });
  }

  @LogMethod({ id: 'CacheManager.getCacheStatus' })
  public async getCacheStatus(): Promise<CacheStatus> {
    if (!this.settings.isEnabled) {
      return {
        status: 'Disconnected',
        driver: this.settings.driver,
        keyCount: 0,
        lastError: this.lastError,
        isEnabled: false,
      };
    }

    if (this.settings.driver === 'memory') {
      this.removeExpiredFromMemory();
      return {
        status: 'Connected',
        driver: 'memory',
        keyCount: this.entries.size,
        lastError: this.lastError,
        isEnabled: true,
      };
    }

    try {
      const client = await this.ensureRedisClient();
      const keyCount = await client.dbSize?.();
      return {
        status: this.connectivityStatus,
        driver: 'redis',
        keyCount: typeof keyCount === 'number' ? keyCount : this.entries.size,
        lastError: this.lastError,
        isEnabled: true,
      };
    } catch (error) {
      this.captureError('Failed to read Redis status', error);
      return {
        status: 'Error',
        driver: 'redis',
        keyCount: null,
        lastError: this.lastError,
        isEnabled: true,
      };
    }
  }

  private removeExpiredFromMemory(): void {
    const now = Date.now();
    for (const [key, item] of this.memoryCache.entries()) {
      if (item.expiry <= now) {
        this.memoryCache.delete(key);
        this.entries.delete(key);
      }
    }
  }

  private enforceMemoryCapacity(): void {
    this.removeExpiredFromMemory();

    const maxItems = this.settings.storeSettings.memory.maxItems;
    if (this.memoryCache.size <= maxItems) {
      return;
    }

    const entries = Array.from(this.memoryCache.entries());
    entries.sort((a, b) => a[1].createdAt - b[1].createdAt);
    const toRemove = this.memoryCache.size - maxItems;
    for (let i = 0; i < toRemove; i += 1) {
      const key = entries[i][0];
      this.memoryCache.delete(key);
      this.entries.delete(key);
    }
  }

  private touchHit(key: string, resolvedValue?: unknown): void {
    const record = this.entries.get(key);
    if (!record) return;
    record.hitCount += 1;
    record.updatedAtMs = Date.now();
    if (resolvedValue !== undefined) {
      record.value = resolvedValue;
      record.sizeBytes = this.estimateSizeBytes(resolvedValue);
      record.cacheType = this.detectCacheType(resolvedValue);
    }
  }

  private upsertEntry(key: string, value: unknown): void {
    const now = Date.now();
    const current = this.entries.get(key);
    const cacheType = this.detectCacheType(value);
    const sizeBytes = this.estimateSizeBytes(value);

    this.entries.set(key, {
      key,
      value,
      cacheType,
      sizeBytes,
      hitCount: current?.hitCount ?? 0,
      createdAtMs: current?.createdAtMs ?? now,
      updatedAtMs: now,
    });
  }

  private detectCacheType(value: unknown): string {
    if (value === null || value === undefined) return 'Null';
    if (Array.isArray(value)) return 'Array';
    const valueType = typeof value;
    if (valueType === 'object') return 'JSON';
    if (valueType === 'string') return 'String';
    if (valueType === 'number') return 'Number';
    if (valueType === 'boolean') return 'Boolean';
    return 'Unknown';
  }

  private estimateSizeBytes(value: unknown): number {
    try {
      return Buffer.byteLength(JSON.stringify(value ?? null), 'utf8');
    } catch {
      return 0;
    }
  }

  private async createRedisClient(redisSettings: RedisSettings): Promise<RedisClientLike> {
    const redis = await import('redis');
    const createClient = (redis as unknown as { createClient: (options: unknown) => RedisClientLike }).createClient;

    const socket = {
      host: redisSettings.host,
      port: redisSettings.port,
      reconnectStrategy: (retries: number) => {
        if (retries >= redisSettings.retryStrategy.maxRetries) {
          return false;
        }
        const delay = redisSettings.retryStrategy.baseDelayMs * Math.max(1, retries + 1);
        return Math.min(delay, redisSettings.retryStrategy.maxDelayMs);
      },
    };

    return createClient({
      socket,
      password: redisSettings.password,
      database: redisSettings.dbIndex,
    });
  }

  private async ensureRedisClient(): Promise<RedisClientLike> {
    if (this.redisClient?.isOpen) {
      this.connectivityStatus = 'Connected';
      return this.redisClient;
    }

    const client = await this.createRedisClient(this.settings.storeSettings.redis);

    (client as any).on?.('error', (error: unknown) => {
      this.captureError('Redis client emitted error', error);
    });

    await client.connect?.();

    this.redisClient = client;
    this.connectivityStatus = 'Connected';
    this.lastError = null;
    return client;
  }

  private async closeRedisClient(): Promise<void> {
    if (!this.redisClient) {
      this.connectivityStatus = 'Disconnected';
      return;
    }

    try {
      if (this.redisClient.isOpen && this.redisClient.quit) {
        await this.redisClient.quit();
      } else {
        await this.redisClient.disconnect?.();
      }
    } catch (error) {
      this.captureError('Failed to close Redis connection cleanly', error);
    } finally {
      this.redisClient = null;
      this.connectivityStatus = 'Disconnected';
    }
  }

  private captureError(message: string, error: unknown): void {
    const normalized = error instanceof Error ? error.message : String(error);
    this.lastError = `${message}: ${normalized}`;
    this.connectivityStatus = 'Error';
    logger.error('CacheManager', message, { error: normalized });
  }
}

export const cacheManager = CacheManager.getInstance();
