import { REDACTED_REDIS_PASSWORD } from '../../shared/api/contracts/cache/constants';
import type { CacheSettings, CacheSettingsPublic } from '../../shared/api/contracts/cache/types';

export type CacheSettingsFormState = {
  isEnabled: boolean;
  driver: 'memory' | 'redis';
  defaultTtl: string;
  maxItems: string;
  redisHost: string;
  redisPort: string;
  redisPassword: string;
  redisDbIndex: string;
};

export const createEmptyCacheSettingsForm = (): CacheSettingsFormState => ({
  isEnabled: true,
  driver: 'memory',
  defaultTtl: '60',
  maxItems: '10000',
  redisHost: '127.0.0.1',
  redisPort: '6379',
  redisPassword: '',
  redisDbIndex: '0',
});

export const toCacheSettingsForm = (settings: CacheSettingsPublic): CacheSettingsFormState => ({
  isEnabled: settings.isEnabled,
  driver: settings.driver,
  defaultTtl: String(settings.defaultTtl),
  maxItems: String(settings.storeSettings.memory.maxItems),
  redisHost: settings.storeSettings.redis.host,
  redisPort: String(settings.storeSettings.redis.port),
  redisPassword: settings.storeSettings.redis.hasPassword ? REDACTED_REDIS_PASSWORD : '',
  redisDbIndex: String(settings.storeSettings.redis.dbIndex),
});

export const validateCacheSettingsForm = (form: CacheSettingsFormState): string | null => {
  const defaultTtl = Number(form.defaultTtl);
  if (!Number.isFinite(defaultTtl) || defaultTtl < 1) {
    return 'Default TTL must be at least 1 second.';
  }

  const maxItems = Number(form.maxItems);
  if (!Number.isFinite(maxItems) || maxItems < 1) {
    return 'Max items must be at least 1.';
  }

  if (form.driver !== 'redis') {
    return null;
  }

  if (!form.redisHost.trim()) {
    return 'Redis host is required when storage is Redis.';
  }

  const redisPort = Number(form.redisPort);
  if (!Number.isFinite(redisPort) || redisPort < 1 || redisPort > 65535) {
    return 'A valid Redis port is required when storage is Redis.';
  }

  const redisDbIndex = Number(form.redisDbIndex);
  if (!Number.isFinite(redisDbIndex) || redisDbIndex < 0) {
    return 'Redis DB index must be zero or greater.';
  }

  return null;
};

export const toCacheSettingsPayload = (form: CacheSettingsFormState): Partial<CacheSettings> => {
  const payload: Partial<CacheSettings> = {
    isEnabled: form.isEnabled,
    driver: form.driver,
    defaultTtl: Math.max(1, Math.floor(Number(form.defaultTtl))),
    storeSettings: {
      memory: {
        maxItems: Math.max(1, Math.floor(Number(form.maxItems))),
      },
      redis: {
        host: form.redisHost.trim(),
        port: Math.floor(Number(form.redisPort)),
        dbIndex: Math.max(0, Math.floor(Number(form.redisDbIndex))),
        retryStrategy: {
          maxRetries: 20,
          baseDelayMs: 100,
          maxDelayMs: 3_000,
        },
      },
    },
  };

  if (form.driver === 'redis') {
    payload.storeSettings!.redis!.password = form.redisPassword.trim() || undefined;
  }

  return payload;
};

export const formatCacheDriverLabel = (driver: 'memory' | 'redis') => (
  driver === 'redis' ? 'Redis' : 'Memory'
);

export const formatCacheStatusLabel = (
  driver: 'memory' | 'redis',
  status: 'connected' | 'disconnected' | 'error',
  isEnabled: boolean,
) => {
  if (!isEnabled) {
    return 'Disabled';
  }

  const driverLabel = formatCacheDriverLabel(driver);
  if (status === 'connected') {
    return `${driverLabel} · Connected`;
  }
  if (status === 'error') {
    return `${driverLabel} · Error`;
  }
  return `${driverLabel} · Disconnected`;
};
