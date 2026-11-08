export type CacheDriver = 'memory' | 'redis';

export type CacheConnectivityStatus = 'connected' | 'disconnected' | 'error';

export type CacheEntryRecord = {
  cacheKey: string;
  cacheType: string;
  sizeBytes: number;
  hitCount: number;
  createdAt: string;
};

export type MemoryCacheSettings = {
  maxItems: number;
};

export type RedisRetryStrategy = {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

export type RedisSettings = {
  host: string;
  port: number;
  password?: string;
  hasPassword?: boolean;
  dbIndex: number;
  retryStrategy: RedisRetryStrategy;
};

export type RedisSettingsPublic = RedisSettings & {
  hasPassword?: boolean;
};

export type CacheStoreSettings = {
  memory: MemoryCacheSettings;
  redis: RedisSettings;
};

export type CacheStoreSettingsPublic = {
  memory: MemoryCacheSettings;
  redis: RedisSettingsPublic;
};

export type CacheSettings = {
  isEnabled: boolean;
  driver: CacheDriver;
  defaultTtl: number;
  storeSettings: CacheStoreSettings;
};

export type CacheSettingsPublic = Omit<CacheSettings, 'storeSettings'> & {
  storeSettings: CacheStoreSettingsPublic;
};

export type CacheStatusPayload = {
  status: CacheConnectivityStatus;
  driver: CacheDriver;
  keyCount: number | null;
  lastError: string | null;
  isEnabled: boolean;
};

export type CacheEntryValuePayload = {
  cacheKey: string;
  cacheType: string;
  value: unknown;
};

export type CacheEntriesListData = CacheEntryRecord[];

export type CacheStatusData = CacheStatusPayload;

export type CacheEntryValueData = {
  value: string | null;
  error: string | null;
};

export type CacheSettingsResponse = {
  settings: CacheSettingsPublic;
};

export type CacheSettingsTestResult = {
  success: boolean;
  message: string;
};
