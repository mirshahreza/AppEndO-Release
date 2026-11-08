import { describe, expect, it } from 'vitest';
import {
  buildCacheKeyPrefix,
  buildEdgeResponseCacheKey,
  buildPlatformCacheKey,
  CACHE_KEY_SEGMENT_WIDTHS,
  padCacheKeySegment,
  ROLE_ATTRIBUTES_CACHE_PREFIX,
  SESSION_CONTEXT_CACHE_PREFIX,
  USER_ROLES_CACHE_PREFIX,
} from '../cacheKeyFormat';

const assertFixedSegmentWidths = (key: string) => {
  const parts = key.split(':');
  if (parts.length >= 1) {
    expect(parts[0].length).toBe(CACHE_KEY_SEGMENT_WIDTHS.domain);
  }
  if (parts.length >= 2) {
    expect(parts[1].length).toBe(CACHE_KEY_SEGMENT_WIDTHS.kind);
  }
  for (const part of parts.slice(2)) {
    expect(part.length).toBe(CACHE_KEY_SEGMENT_WIDTHS.tail);
  }
};

describe('cacheKeyFormat', () => {
  it('pads domain/kind tokens to fixed widths', () => {
    expect(padCacheKeySegment('session', CACHE_KEY_SEGMENT_WIDTHS.domain)).toBe('session');
    expect(padCacheKeySegment('ctx', CACHE_KEY_SEGMENT_WIDTHS.kind)).toBe('ctx-');
    expect(padCacheKeySegment('attrs', CACHE_KEY_SEGMENT_WIDTHS.kind, { attrs: 'attr' })).toBe('attr');
  });

  it('pads identity and tail segments to width 10', () => {
    expect(padCacheKeySegment('42', CACHE_KEY_SEGMENT_WIDTHS.tail)).toBe('42--------');
  });

  it('builds aligned platform keys with only required segments', () => {
    const sessionKey = buildPlatformCacheKey('session', 'ctx3', 42);
    const roleKey = buildPlatformCacheKey('role', 'attrs', 'AGENT');
    const userRolesKey = buildPlatformCacheKey('user', 'role', 42);

    expect(sessionKey).toBe('session:ctx3:42--------');
    expect(roleKey).toBe('role---:attr:AGENT-----');
    expect(userRolesKey).toBe('user---:role:42--------');
    expect(sessionKey.split(':')).toHaveLength(3);
    expect(roleKey.split(':')).toHaveLength(3);
    expect(userRolesKey.split(':')).toHaveLength(3);
    expect(sessionKey.startsWith(SESSION_CONTEXT_CACHE_PREFIX)).toBe(true);
    expect(roleKey.startsWith(ROLE_ATTRIBUTES_CACHE_PREFIX)).toBe(true);
    expect(userRolesKey.startsWith(USER_ROLES_CACHE_PREFIX)).toBe(true);
    assertFixedSegmentWidths(sessionKey);
    assertFixedSegmentWidths(roleKey);
    assertFixedSegmentWidths(userRolesKey);
    expect(sessionKey.length).toBe(roleKey.length);
  });

  it('omits unused param/query segments entirely', () => {
    const key = buildEdgeResponseCacheKey({
      keyNamespace: 'GET:/api/items',
      byParam: true,
      byUser: false,
      requestParams: {},
      requestQuery: {},
    });

    expect(key.split(':')).toHaveLength(3);
  });

  it('appends tail segments only when scope needs them', () => {
    const baseKey = buildEdgeResponseCacheKey({
      keyNamespace: 'GET:/api/items',
      byParam: false,
      byUser: false,
    });
    const paramOnlyKey = buildEdgeResponseCacheKey({
      keyNamespace: 'GET:/api/items',
      byParam: true,
      byUser: false,
      requestParams: { id: '1' },
      requestQuery: {},
    });
    const actorKey = buildEdgeResponseCacheKey({
      keyNamespace: 'GET:/api/items',
      byParam: false,
      byUser: true,
      actorId: 'user-a',
    });
    const scopedKey = buildEdgeResponseCacheKey({
      keyNamespace: 'GET:/api/items',
      byParam: true,
      byUser: true,
      actorId: 'user-a',
      requestParams: { id: '1' },
      requestQuery: { token: 'alpha' },
    });

    expect(baseKey.split(':')).toHaveLength(3);
    expect(paramOnlyKey.split(':')).toHaveLength(4);
    expect(actorKey.split(':')).toHaveLength(4);
    expect(scopedKey.split(':')).toHaveLength(6);
    assertFixedSegmentWidths(baseKey);
    assertFixedSegmentWidths(scopedKey);
  });

  it('builds stable prefixes for invalidation filters', () => {
    expect(buildCacheKeyPrefix('session', 'ctx')).toBe('session:ctx-:');
  });
});
