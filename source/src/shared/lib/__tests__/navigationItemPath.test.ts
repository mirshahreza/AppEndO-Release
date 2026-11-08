import { describe, expect, it } from 'vitest';
import { STUDIO_PORTAL_SEGMENT } from '../../api/contracts/platform/mountConstants';
import { buildNavigationItemAbsolutePath } from '../navigationItemPath';

describe('buildNavigationItemAbsolutePath', () => {
  it('builds culture studio page paths from studio-relative route patterns', () => {
    expect(buildNavigationItemAbsolutePath({
      cultureId: 'us',
      portalSegment: STUDIO_PORTAL_SEGMENT,
      routePattern: 'users',
    })).toBe('/us/studio/users');
  });

  it('builds legacy studio mount paths', () => {
    expect(buildNavigationItemAbsolutePath({
      cultureId: 'us',
      portalSegment: STUDIO_PORTAL_SEGMENT,
      routePattern: 'studio/users',
    })).toBe('/us/studio/users');
  });

  it('supports cross-culture overrides', () => {
    expect(buildNavigationItemAbsolutePath({
      cultureId: 'ir',
      portalSegment: STUDIO_PORTAL_SEGMENT,
      routePattern: 'settings/*',
    })).toBe('/ir/studio/settings/server-functions');
  });

  it('lands Base Components nav on the default catalog section', () => {
    expect(buildNavigationItemAbsolutePath({
      cultureId: 'us',
      portalSegment: STUDIO_PORTAL_SEGMENT,
      routePattern: 'base-components/*',
    })).toBe('/us/studio/base-components/crud-set');
  });

  it('lands Settings nav on the default catalog section', () => {
    expect(buildNavigationItemAbsolutePath({
      cultureId: 'us',
      portalSegment: STUDIO_PORTAL_SEGMENT,
      routePattern: 'settings/*',
    })).toBe('/us/studio/settings/server-functions');
  });
});
