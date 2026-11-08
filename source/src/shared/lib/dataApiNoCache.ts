/** Query flag: skip Data API GET response cache (read); response may still be written to cache. */
export const DATA_API_NO_CACHE_QUERY = 'noCache';
export const DATA_API_NO_CACHE_VALUE = '1';

export const isDataApiNoCacheQueryValue = (value: unknown): boolean => (
  value === '1' || value === 'true' || value === true
);

export const readDataApiNoCacheFromRequest = (input: {
  query?: Record<string, unknown> | unknown;
  body?: unknown;
}): boolean => {
  const query = input.query;
  if (query && typeof query === 'object' && !Array.isArray(query)) {
    const record = query as Record<string, unknown>;
    if (isDataApiNoCacheQueryValue(record[DATA_API_NO_CACHE_QUERY])) {
      return true;
    }
  }
  const body = input.body;
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return (body as Record<string, unknown>).noCache === true;
  }
  return false;
};

export const appendDataApiNoCacheQueryParam = (url: string): string => {
  const trimmed = url.trim();
  if (!trimmed) {
    return trimmed;
  }
  const hashIndex = trimmed.indexOf('#');
  const withoutHash = hashIndex >= 0 ? trimmed.slice(0, hashIndex) : trimmed;
  const hash = hashIndex >= 0 ? trimmed.slice(hashIndex) : '';
  const queryIndex = withoutHash.indexOf('?');
  const path = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const query = queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : '';
  const params = new URLSearchParams(query);
  params.set(DATA_API_NO_CACHE_QUERY, DATA_API_NO_CACHE_VALUE);
  const nextQuery = params.toString();
  return nextQuery ? `${path}?${nextQuery}${hash}` : `${path}${hash}`;
};

/** Omit noCache from cache-key material so refresh requests reuse the same cache slot on write. */
export const omitDataApiNoCacheFromQuery = (
  query: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined => {
  if (!query) {
    return query;
  }
  if (!(DATA_API_NO_CACHE_QUERY in query)) {
    return query;
  }
  const next = { ...query };
  delete next[DATA_API_NO_CACHE_QUERY];
  return next;
};
