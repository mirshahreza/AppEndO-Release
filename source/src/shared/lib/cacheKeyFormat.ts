/**
 * Cache Manager key format standard.
 * @see docs/standards/cache-keys.md
 * @see src/config/projectStandards.ts — platform.cache.key-format
 */
export const CACHE_KEY_SEGMENT_SEPARATOR = ':' as const;

/** Fixed width for segment 3 and all tail segments. */
export const CACHE_KEY_SEGMENT_MAX_WIDTH = 10;

export const CACHE_KEY_SEGMENT_WIDTHS = {
  domain: 7,
  kind: 4,
  tail: 10,
} as const;

const CACHE_KEY_DOMAIN_ABBREVIATIONS: Record<string, string> = {};

const CACHE_KEY_KIND_ABBREVIATIONS: Record<string, string> = {
  attrs: 'attr',
};

export const stableCacheKeyPayload = (value: unknown): string => {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableCacheKeyPayload).join(',')}]`;

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.length === 0) {
    return '{}';
  }
  return `{${keys.map((key) => `${key}:${stableCacheKeyPayload(record[key])}`).join('|')}}`;
};

export const hasCacheKeyPayload = (value: unknown): boolean => {
  const payload = stableCacheKeyPayload(value);
  return Boolean(payload && payload !== '{}' && payload !== '[]' && payload !== 'null');
};

export const fnv1aHex = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

export const resolveCacheKeyToken = (
  value: string,
  abbreviations: Record<string, string> = {},
): string => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) {
    return '';
  }

  const lower = trimmed.toLowerCase();
  return abbreviations[lower] ?? abbreviations[trimmed] ?? trimmed;
};

export const padCacheKeySegment = (
  value: string,
  width: number,
  abbreviations: Record<string, string> = {},
): string => {
  const resolved = resolveCacheKeyToken(value, abbreviations);
  if (!resolved) {
    return '';
  }

  const segmentWidth = Math.max(1, Math.floor(width));
  if (resolved.length <= segmentWidth) {
    return resolved.padEnd(segmentWidth, '-');
  }

  const hash = fnv1aHex(resolved);
  const prefixLength = Math.max(1, segmentWidth - 1 - hash.length);
  return `${resolved.slice(0, prefixLength)}-${hash}`.slice(0, segmentWidth).padEnd(segmentWidth, '-');
};

export const hashCacheKeyPayload = (value: unknown): string => {
  if (!hasCacheKeyPayload(value)) {
    return '';
  }

  return padCacheKeySegment(fnv1aHex(stableCacheKeyPayload(value)), CACHE_KEY_SEGMENT_WIDTHS.tail);
};

const joinCacheKeySegments = (segments: string[]): string => (
  segments
    .map((segment) => String(segment ?? '').trim())
    .filter((segment) => segment.length > 0)
    .join(CACHE_KEY_SEGMENT_SEPARATOR)
);

export const buildCacheKeyPrefix = (domain: string, kind: string): string => {
  const prefix = joinCacheKeySegments([
    padCacheKeySegment(domain, CACHE_KEY_SEGMENT_WIDTHS.domain, CACHE_KEY_DOMAIN_ABBREVIATIONS),
    padCacheKeySegment(kind, CACHE_KEY_SEGMENT_WIDTHS.kind, CACHE_KEY_KIND_ABBREVIATIONS),
  ]);

  return prefix ? `${prefix}${CACHE_KEY_SEGMENT_SEPARATOR}` : '';
};

export const buildPlatformCacheKey = (
  domain: string,
  kind: string,
  identity: string | number,
  tail: string[] = [],
): string => joinCacheKeySegments([
  padCacheKeySegment(domain, CACHE_KEY_SEGMENT_WIDTHS.domain, CACHE_KEY_DOMAIN_ABBREVIATIONS),
  padCacheKeySegment(kind, CACHE_KEY_SEGMENT_WIDTHS.kind, CACHE_KEY_KIND_ABBREVIATIONS),
  padCacheKeySegment(String(identity), CACHE_KEY_SEGMENT_WIDTHS.tail),
  ...tail,
]);

export const parseRouteCacheNamespace = (keyNamespace: string): { method: string; path: string } => {
  const normalized = String(keyNamespace || '').trim() || 'edge';
  const colonIndex = normalized.indexOf(':');
  if (colonIndex < 0) {
    return { method: 'GET', path: normalized };
  }

  return {
    method: normalized.slice(0, colonIndex) || 'GET',
    path: normalized.slice(colonIndex + 1) || '',
  };
};

/** Kind `ctx3` rebuilds caches so firstname/lastname/image identity values are present. */
export const SESSION_CONTEXT_CACHE_PREFIX = buildCacheKeyPrefix('session', 'ctx3');
export const ROLE_ATTRIBUTES_CACHE_PREFIX = buildCacheKeyPrefix('role', 'attrs');
export const USER_ROLES_CACHE_PREFIX = buildCacheKeyPrefix('user', 'role');

export const buildEdgeResponseCacheKey = (input: {
  keyNamespace?: string;
  byParam?: boolean;
  byUser?: boolean;
  actorId?: string;
  requestParams?: unknown;
  requestQuery?: unknown;
}): string => {
  const route = parseRouteCacheNamespace(input.keyNamespace || 'edge');
  const tail: string[] = [];

  if (input.byParam) {
    const paramSegment = hashCacheKeyPayload(input.requestParams);
    if (paramSegment) {
      tail.push(paramSegment);
    }

    const querySegment = hashCacheKeyPayload(input.requestQuery);
    if (querySegment) {
      tail.push(querySegment);
    }
  }

  if (input.byUser) {
    const actorSegment = padCacheKeySegment(
      input.actorId || 'anonymous',
      CACHE_KEY_SEGMENT_WIDTHS.tail,
    );
    if (actorSegment) {
      tail.push(actorSegment);
    }
  }

  return buildPlatformCacheKey('edge', route.method, route.path, tail);
};
