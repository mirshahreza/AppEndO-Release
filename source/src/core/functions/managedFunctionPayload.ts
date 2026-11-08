export type ManagedFunctionCacheFields = {
  cacheEnabled: boolean;
  cacheTtlMs: number;
  cacheByParam: boolean;
  cacheByUser: boolean;
};

const DEFAULT_CACHE_TTL_MS = 180000;

const normalizeTtlMs = (value: unknown): number => {
  const ttl = Number(value);
  if (!Number.isFinite(ttl)) return DEFAULT_CACHE_TTL_MS;
  return Math.max(1000, Math.floor(ttl));
};

export const normalizeManagedFunctionCacheFields = (
  input: Partial<ManagedFunctionCacheFields> | undefined,
): ManagedFunctionCacheFields => {
  return {
    cacheEnabled: Boolean(input?.cacheEnabled),
    cacheTtlMs: normalizeTtlMs(input?.cacheTtlMs),
    cacheByParam: Boolean(input?.cacheByParam),
    cacheByUser: Boolean(input?.cacheByUser),
  };
};

export const mergeManagedFunctionCacheFields = (
  payload: Record<string, unknown>,
  existing: Record<string, unknown>,
): ManagedFunctionCacheFields => {
  return {
    cacheEnabled: Boolean(payload.cacheEnabled ?? existing.cache_enabled ?? existing.cacheEnabled),
    cacheTtlMs: normalizeTtlMs(payload.cacheTtlMs ?? existing.cache_ttl_ms ?? existing.cacheTtlMs),
    cacheByParam: Boolean(payload.cacheByParam ?? existing.cache_by_param ?? existing.cacheByParam),
    cacheByUser: Boolean(payload.cacheByUser ?? existing.cache_by_user ?? existing.cacheByUser),
  };
};
