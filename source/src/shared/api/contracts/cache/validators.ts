import { DEFAULT_CACHE_SETTINGS, REDACTED_REDIS_PASSWORD } from './constants';
import type {
  CacheDriver,
  CacheSettings,
  CacheSettingsPublic,
  RedisSettings,
} from './types';

export class CacheValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CacheValidationError';
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizeRedisSettings = (raw: unknown, fallback: RedisSettings): RedisSettings => {
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const retryRaw = input.retryStrategy && typeof input.retryStrategy === 'object'
    ? input.retryStrategy as Record<string, unknown>
    : {};

  const maxRetries = Number.isFinite(retryRaw.maxRetries)
    ? clamp(Math.floor(Number(retryRaw.maxRetries)), 0, 10_000)
    : fallback.retryStrategy.maxRetries;
  const baseDelayMs = Number.isFinite(retryRaw.baseDelayMs)
    ? clamp(Math.floor(Number(retryRaw.baseDelayMs)), 10, 60_000)
    : fallback.retryStrategy.baseDelayMs;
  const maxDelayMs = Number.isFinite(retryRaw.maxDelayMs)
    ? Math.max(baseDelayMs, Math.floor(Number(retryRaw.maxDelayMs)))
    : fallback.retryStrategy.maxDelayMs;

  const port = Number.isFinite(input.port)
    ? clamp(Math.floor(Number(input.port)), 1, 65535)
    : fallback.port;
  const dbIndex = Number.isFinite(input.dbIndex)
    ? Math.max(0, Math.floor(Number(input.dbIndex)))
    : fallback.dbIndex;

  const password = input.password === undefined || input.password === null || input.password === ''
    ? undefined
    : String(input.password);
  const hasPassword = input.hasPassword === undefined
    ? Boolean(fallback.hasPassword) || Boolean(password)
    : Boolean(input.hasPassword) || Boolean(password);

  return {
    host: String(input.host ?? fallback.host).trim() || fallback.host,
    port,
    password,
    hasPassword,
    dbIndex,
    retryStrategy: {
      maxRetries,
      baseDelayMs,
      maxDelayMs,
    },
  };
};

export const normalizeCacheSettings = (raw: unknown): CacheSettings => {
  const defaults = DEFAULT_CACHE_SETTINGS;
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const storeRaw = input.storeSettings && typeof input.storeSettings === 'object'
    ? input.storeSettings as Record<string, unknown>
    : {};
  const memoryRaw = storeRaw.memory && typeof storeRaw.memory === 'object'
    ? storeRaw.memory as Record<string, unknown>
    : {};

  const defaultTtl = Number.isFinite(input.defaultTtl)
    ? Math.max(1, Math.floor(Number(input.defaultTtl)))
    : defaults.defaultTtl;
  const maxItems = Number.isFinite(memoryRaw.maxItems)
    ? Math.max(1, Math.floor(Number(memoryRaw.maxItems)))
    : defaults.storeSettings.memory.maxItems;
  const driver: CacheDriver = input.driver === 'redis' ? 'redis' : 'memory';

  return {
    isEnabled: input.isEnabled === undefined ? defaults.isEnabled : Boolean(input.isEnabled),
    driver,
    defaultTtl,
    storeSettings: {
      memory: { maxItems },
      redis: normalizeRedisSettings(storeRaw.redis, defaults.storeSettings.redis),
    },
  };
};

export const validateCacheSettings = (settings: CacheSettings): void => {
  if (settings.driver !== 'redis') {
    return;
  }

  const host = settings.storeSettings.redis.host.trim();
  if (!host) {
    throw new CacheValidationError('Redis host is required when cache storage is Redis.');
  }

  const port = settings.storeSettings.redis.port;
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    throw new CacheValidationError('A valid Redis port is required when cache storage is Redis.');
  }
};

export const redactCacheSettings = (settings: CacheSettings): CacheSettingsPublic => {
  const hasPassword = Boolean(settings.storeSettings.redis.hasPassword)
    || Boolean(settings.storeSettings.redis.password?.trim());

  return {
    ...settings,
    storeSettings: {
      ...settings.storeSettings,
      redis: {
        ...settings.storeSettings.redis,
        password: hasPassword ? REDACTED_REDIS_PASSWORD : undefined,
        hasPassword,
      },
    },
  };
};

export const mergeCacheSettingsPatch = (
  current: CacheSettings,
  patch: Partial<CacheSettings>,
): CacheSettings => {
  const merged = normalizeCacheSettings({
    ...current,
    ...patch,
    storeSettings: {
      memory: {
        ...current.storeSettings.memory,
        ...(patch.storeSettings?.memory || {}),
      },
      redis: {
        ...current.storeSettings.redis,
        ...(patch.storeSettings?.redis || {}),
        retryStrategy: {
          ...current.storeSettings.redis.retryStrategy,
          ...(patch.storeSettings?.redis?.retryStrategy || {}),
        },
      },
    },
  });

  const incomingPassword = patch.storeSettings?.redis?.password;
  if (incomingPassword !== undefined) {
    const trimmed = String(incomingPassword).trim();
    if (!trimmed || trimmed === REDACTED_REDIS_PASSWORD) {
      merged.storeSettings.redis.password = current.storeSettings.redis.password;
      merged.storeSettings.redis.hasPassword = Boolean(current.storeSettings.redis.hasPassword)
        || Boolean(current.storeSettings.redis.password?.trim());
    } else {
      merged.storeSettings.redis.password = trimmed;
      merged.storeSettings.redis.hasPassword = true;
    }
  } else {
    merged.storeSettings.redis.hasPassword = Boolean(current.storeSettings.redis.hasPassword)
      || Boolean(merged.storeSettings.redis.hasPassword)
      || Boolean(merged.storeSettings.redis.password?.trim());
  }

  validateCacheSettings(merged);
  return merged;
};
