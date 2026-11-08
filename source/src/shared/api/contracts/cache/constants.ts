import type { CacheSettings } from './types';

export const REDACTED_REDIS_PASSWORD = '••••••••';

export const DEFAULT_CACHE_SETTINGS: CacheSettings = {
  isEnabled: true,
  driver: 'memory',
  defaultTtl: 60,
  storeSettings: {
    memory: {
      maxItems: 10_000,
    },
    redis: {
      host: '127.0.0.1',
      port: 6379,
      password: undefined,
      dbIndex: 0,
      retryStrategy: {
        maxRetries: 20,
        baseDelayMs: 100,
        maxDelayMs: 3_000,
      },
    },
  },
};
