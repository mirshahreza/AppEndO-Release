import { normalizeManagedFunctionCacheFields } from './managedFunctionPayload';
import {
  clampMemoryLimitMb,
  clampTimeoutMs,
  normalizeRuntimeVersion,
  normalizeServerFunctionLanguage,
  readUseGlobalConfig,
} from '../../shared/server-functions/runtimeConfig';
import type { ServerFunctionLanguage, ServerFunctionRuntimeVersion } from '../../shared/server-functions/runtimeConfig';

export type BuiltinFunctionRuntimeFields = {
  language: ServerFunctionLanguage;
  runtimeVersion: ServerFunctionRuntimeVersion;
  memoryLimit: number;
  timeoutMs: number;
  useGlobalConfig: boolean;
  cacheEnabled: boolean;
  cacheTtlMs: number;
  cacheByParam: boolean;
  cacheByUser: boolean;
};

export const normalizeBuiltinRuntimeFields = (
  input: Partial<BuiltinFunctionRuntimeFields> | null | undefined,
  defaults: BuiltinFunctionRuntimeFields,
): BuiltinFunctionRuntimeFields => {
  const cache = normalizeManagedFunctionCacheFields({
    cacheEnabled: input?.cacheEnabled ?? defaults.cacheEnabled,
    cacheTtlMs: input?.cacheTtlMs ?? defaults.cacheTtlMs,
    cacheByParam: input?.cacheByParam ?? defaults.cacheByParam,
    cacheByUser: input?.cacheByUser ?? defaults.cacheByUser,
  });

  return {
    language: normalizeServerFunctionLanguage(input?.language ?? defaults.language),
    runtimeVersion: normalizeRuntimeVersion(input?.runtimeVersion ?? defaults.runtimeVersion),
    memoryLimit: clampMemoryLimitMb(input?.memoryLimit ?? defaults.memoryLimit),
    timeoutMs: clampTimeoutMs(input?.timeoutMs ?? defaults.timeoutMs),
    useGlobalConfig: readUseGlobalConfig(input?.useGlobalConfig ?? defaults.useGlobalConfig),
    ...cache,
  };
};

export const builtinRuntimeDefaultsFromCatalog = (
  defaults: Partial<BuiltinFunctionRuntimeFields>,
): BuiltinFunctionRuntimeFields => normalizeBuiltinRuntimeFields(undefined, {
  language: 'ts',
  runtimeVersion: 'v20.x',
  memoryLimit: 128,
  timeoutMs: 1500,
  useGlobalConfig: true,
  cacheEnabled: false,
  cacheTtlMs: 3600000,
  cacheByParam: false,
  cacheByUser: false,
  ...defaults,
});
