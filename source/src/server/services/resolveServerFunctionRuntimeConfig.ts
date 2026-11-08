import { DEFAULT_SETTINGS } from '../../shared/api/contracts/settings/constants';
import {
  clampMemoryLimitMb,
  clampTimeoutMs,
  normalizeRuntimeVersion,
  normalizeServerFunctionLanguage,
  readUseGlobalConfig,
  type ServerFunctionLanguage,
  type ServerFunctionRuntimeVersion,
} from '../../shared/server-functions/runtimeConfig';
import { getCachedEdgeAutoLogging, getCachedSection, isAppSettingsCacheInitialized } from './settings/appSettingsCache';

export type ServerFunctionRuntimeConfigInput = {
  timeoutMs?: unknown;
  memoryLimit?: unknown;
  runtimeVersion?: unknown;
  language?: unknown;
  useGlobalConfig?: unknown;
  enableLogs?: unknown;
  cacheEnabled?: unknown;
  cacheTtlMs?: unknown;
  cacheByParam?: unknown;
  cacheByUser?: unknown;
};

export type ServerFunctionRuntimeConfig = {
  timeoutMs: number;
  memoryLimit: number;
  runtimeVersion: ServerFunctionRuntimeVersion;
  language: ServerFunctionLanguage;
  enableLogs: boolean;
  cache: {
    enabled: boolean;
    ttlMs?: number;
    byParam: boolean;
    byUser: boolean;
  };
};

export type ServerFunctionGlobalRuntimeSettings = {
  serverFunctionVmMode: string;
  serverFunctionRamAllocation: number;
  serverFunctionTimeout: number;
  serverFunctionAutoLogging: boolean;
};

export {
  clampMemoryLimitMb,
  clampTimeoutMs,
  normalizeRuntimeVersion,
  normalizeServerFunctionLanguage,
  readUseGlobalConfig,
} from '../../shared/server-functions/runtimeConfig';

export const readServerFunctionGlobalRuntimeSettings = (
  section?: Record<string, unknown>,
): ServerFunctionGlobalRuntimeSettings => {
  const source = section ?? (
    isAppSettingsCacheInitialized()
      ? getCachedSection('server-functions')
      : DEFAULT_SETTINGS
  );
  return {
    serverFunctionVmMode: typeof source.serverFunctionVmMode === 'string'
      ? source.serverFunctionVmMode
      : DEFAULT_SETTINGS.serverFunctionVmMode,
    serverFunctionRamAllocation: clampMemoryLimitMb(
      source.serverFunctionRamAllocation ?? DEFAULT_SETTINGS.serverFunctionRamAllocation,
    ),
    serverFunctionTimeout: clampTimeoutMs(
      source.serverFunctionTimeout ?? DEFAULT_SETTINGS.serverFunctionTimeout,
    ),
    serverFunctionAutoLogging: typeof source.serverFunctionAutoLogging === 'boolean'
      ? source.serverFunctionAutoLogging
      : DEFAULT_SETTINGS.serverFunctionAutoLogging,
  };
};

const resolveEnableLogs = (
  input: ServerFunctionRuntimeConfigInput,
  globalSettings: ServerFunctionGlobalRuntimeSettings,
): boolean => (
  typeof input.enableLogs === 'boolean'
    ? input.enableLogs
    : globalSettings.serverFunctionAutoLogging
);

const resolveCache = (input: ServerFunctionRuntimeConfigInput) => {
  const rawTtlMs = Number(input.cacheTtlMs);
  return {
    enabled: Boolean(input.cacheEnabled),
    ttlMs: Number.isFinite(rawTtlMs) ? rawTtlMs : undefined,
    byParam: Boolean(input.cacheByParam),
    byUser: Boolean(input.cacheByUser),
  };
};

export const resolveServerFunctionRuntimeConfig = (
  input: ServerFunctionRuntimeConfigInput,
  options: {
    globalSettings?: Record<string, unknown>;
    globalAutoLogging?: boolean;
  } = {},
): ServerFunctionRuntimeConfig => {
  const globals = readServerFunctionGlobalRuntimeSettings(options.globalSettings);
  const useGlobalConfig = readUseGlobalConfig(input.useGlobalConfig);
  const globalAutoLogging = typeof options.globalAutoLogging === 'boolean'
    ? options.globalAutoLogging
    : globals.serverFunctionAutoLogging;

  const perFunction = {
    timeoutMs: clampTimeoutMs(input.timeoutMs),
    memoryLimit: clampMemoryLimitMb(input.memoryLimit),
    runtimeVersion: normalizeRuntimeVersion(input.runtimeVersion),
    language: normalizeServerFunctionLanguage(input.language),
  };

  const effective = useGlobalConfig
    ? {
      timeoutMs: globals.serverFunctionTimeout,
      memoryLimit: globals.serverFunctionRamAllocation,
      runtimeVersion: normalizeRuntimeVersion(globals.serverFunctionVmMode),
      language: perFunction.language,
    }
    : perFunction;

  return {
    ...effective,
    enableLogs: resolveEnableLogs(input, {
      ...globals,
      serverFunctionAutoLogging: globalAutoLogging,
    }),
    cache: resolveCache(input),
  };
};

export const readCachedServerFunctionAutoLogging = (): boolean => (
  isAppSettingsCacheInitialized()
    ? getCachedEdgeAutoLogging()
    : DEFAULT_SETTINGS.serverFunctionAutoLogging
);

export const runtimeConfigInputFromManagedRecord = (
  record: Record<string, unknown>,
): ServerFunctionRuntimeConfigInput => ({
  timeoutMs: record.timeoutMs ?? record.timeout_ms,
  memoryLimit: record.memoryLimit ?? record.memory_limit,
  runtimeVersion: record.runtimeVersion ?? record.runtime_version,
  language: record.language,
  useGlobalConfig: record.useGlobalConfig ?? record.use_global_config,
  enableLogs: record.enableLogs ?? record.enable_logs,
  cacheEnabled: record.cacheEnabled ?? record.cache_enabled,
  cacheTtlMs: record.cacheTtlMs ?? record.cache_ttl_ms,
  cacheByParam: record.cacheByParam ?? record.cache_by_param,
  cacheByUser: record.cacheByUser ?? record.cache_by_user,
});

export const runtimeConfigInputFromBuiltinRecord = (
  record: Record<string, unknown>,
): ServerFunctionRuntimeConfigInput => runtimeConfigInputFromManagedRecord(record);
