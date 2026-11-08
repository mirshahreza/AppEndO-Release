import { createHash } from 'node:crypto';
import { cacheManager } from '../../../core/cache/CacheManager';
import { buildPlatformCacheKey, stableCacheKeyPayload } from '../../../shared/lib/cacheKeyFormat';
import type { PivotResult, PivotSpec } from '../../../shared/api/contracts/data-api';
import { DEFAULT_PIVOT_CACHE_TTL_MS } from '../../../shared/api/contracts/data-api';

export type PivotCacheLookup = {
  dataSourceId: string;
  spec: PivotSpec;
  policyContextKey: string;
  ttlMs?: number;
  noCache?: boolean;
};

const hashPayload = (value: unknown): string => (
  createHash('sha256').update(stableCacheKeyPayload(value)).digest('hex').slice(0, 24)
);

export const buildPivotResultCacheKey = (lookup: PivotCacheLookup): string => (
  buildPlatformCacheKey('pivot', 'rslt', lookup.dataSourceId, [
    hashPayload({ spec: lookup.spec, policy: lookup.policyContextKey }),
  ])
);

export const readPivotResultCache = async (
  lookup: PivotCacheLookup,
): Promise<PivotResult | null> => {
  if (lookup.noCache || lookup.spec.noCache) {
    return null;
  }
  const cached = await cacheManager.get<PivotResult>(buildPivotResultCacheKey(lookup));
  return cached ?? null;
};

export const writePivotResultCache = async (
  lookup: PivotCacheLookup,
  result: PivotResult,
): Promise<void> => {
  if (lookup.noCache || lookup.spec.noCache) {
    return;
  }
  const ttlSeconds = Math.max(1, Math.floor((lookup.ttlMs ?? DEFAULT_PIVOT_CACHE_TTL_MS) / 1000));
  await cacheManager.set(buildPivotResultCacheKey(lookup), result, ttlSeconds);
};
