const BASE_INFO_OPTIONS_CACHE_TTL_MS = 30_000;

type BaseInfoOptionsCacheEntry = {
  expiresAt: number;
  items: unknown[];
};

const baseInfoOptionsCache = new Map<string, BaseInfoOptionsCacheEntry>();

export const buildBaseInfoOptionsCacheKey = (input: {
  root?: string;
  includeInactive: boolean;
  lang?: string;
}): string => JSON.stringify({
  root: input.root ?? '',
  includeInactive: input.includeInactive,
  lang: input.lang ?? '',
});

/** Same dimensions as options; prefix avoids colliding with flat option rows. */
export const buildBaseInfoTreeCacheKey = (input: {
  root?: string;
  includeInactive: boolean;
  lang?: string;
}): string => `tree:${buildBaseInfoOptionsCacheKey(input)}`;

export const readCachedBaseInfoOptions = (cacheKey: string): unknown[] | null => {
  const cached = baseInfoOptionsCache.get(cacheKey);
  if (!cached || Date.now() >= cached.expiresAt) {
    baseInfoOptionsCache.delete(cacheKey);
    return null;
  }
  return cached.items;
};

export const writeCachedBaseInfoOptions = (cacheKey: string, items: unknown[]): void => {
  baseInfoOptionsCache.set(cacheKey, {
    items,
    expiresAt: Date.now() + BASE_INFO_OPTIONS_CACHE_TTL_MS,
  });
};

export const invalidateBaseInfoOptionsCache = (): void => {
  baseInfoOptionsCache.clear();
};
