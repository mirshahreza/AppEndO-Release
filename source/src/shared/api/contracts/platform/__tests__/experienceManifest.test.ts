import { describe, expect, it } from 'vitest';
import {
  portalPageBindingPattern,
  defaultHomePortal,
  defaultStudioPortal,
  defaultComponentAlonePortal,
  enforceBuiltInPortals,
  experiencePageIdentityKey,
  formatPortalUrlSegment,
  isOperatorHiddenBuiltinPortal,
  portalSupportsNavigation,
  portalUsesRedirectEntry,
  normalizePortalPagePath,
  resolvePortalLayoutKey,
  resolvePortalRegistryKey,
  validatePortalSegmentSlug,
  validateExperienceManifest,
  validatePackageExtensionPortals,
  isValidExperiencePageKey,
} from '../experienceManifest';

const builtInPortals = [defaultHomePortal(), defaultStudioPortal(), defaultComponentAlonePortal()];

describe('experienceManifest contract', () => {
  it('validates experience pageKey slugs', () => {
    expect(isValidExperiencePageKey('my-page')).toBe(true);
    expect(isValidExperiencePageKey('general/my-page')).toBe(false);
    expect(isValidExperiencePageKey('MyPage')).toBe(false);
  });

  it('validates a minimal manifest with built-in portals', () => {
    const result = validateExperienceManifest({
      id: 'admin',
      cultureId: 'us',
      portals: [
        defaultHomePortal(),
        {
          ...defaultStudioPortal(),
          pages: [{ path: 'studio/users', pageKey: 'users' }],
        },
        defaultComponentAlonePortal(),
      ],
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      const studio = result.manifest.portals.find((portal) => portal.segment === 'studio');
      expect(studio?.pages[0]?.path).toBe('studio/users');
    }
  });

  it('rejects duplicate route identity', () => {
    const result = validateExperienceManifest({
      id: 'admin',
      cultureId: 'us',
      portals: [
        defaultHomePortal(),
        {
          ...defaultStudioPortal(),
          pages: [
            { path: 'studio/users', pageKey: 'users' },
            { path: 'users', pageKey: 'users' },
          ],
        },
        defaultComponentAlonePortal(),
      ],
    });
    expect(result.valid).toBe(false);
  });

  it('normalizes relative paths to studio application namespace', () => {
    expect(normalizePortalPagePath('studio', 'users')).toBe('studio/users');
    expect(experiencePageIdentityKey('studio', 'users', 'users')).toBe('studio/users::users');
  });

  it('formats built-in portal URL segments', () => {
    expect(formatPortalUrlSegment('home')).toBe('/');
    expect(formatPortalUrlSegment('studio')).toBe('/studio');
    expect(formatPortalUrlSegment('portal')).toBe('/portal');
  });

  it('treats home as outside operator hidden built-ins', () => {
    expect(isOperatorHiddenBuiltinPortal(defaultHomePortal())).toBe(false);
    expect(isOperatorHiddenBuiltinPortal(defaultStudioPortal())).toBe(true);
    expect(isOperatorHiddenBuiltinPortal(defaultComponentAlonePortal())).toBe(true);
  });

  it('allows navigation only for non-redirect portals', () => {
    expect(portalSupportsNavigation(defaultHomePortal())).toBe(false);
    expect(portalSupportsNavigation(defaultStudioPortal())).toBe(true);
    expect(portalSupportsNavigation({
      ...defaultHomePortal(),
      entryMode: 'shell',
      redirectToSegment: null,
      redirectToCulture: null,
    })).toBe(true);
    expect(portalUsesRedirectEntry(defaultHomePortal())).toBe(true);
  });

  it('preserves incoming studio application fields while locking segment only', () => {
    const authoritative = {
      id: 'admin',
      cultureId: 'us',
      portals: builtInPortals,
    };

    const incoming = {
      ...authoritative,
      portals: [
        authoritative.portals[0],
        {
          ...defaultStudioPortal(),
          shellKey: 'my-portal',
          name: 'Operator Studio',
          auth: { accessMode: 'specific', allowRoles: ['ADMIN'], allowUsers: [], denyRoles: [], denyUsers: [] },
          pages: [],
        },
      ],
    };

    const merged = enforceBuiltInPortals(incoming, authoritative);
    expect(merged.portals[1]).toMatchObject({
      segment: 'studio',
      shellKey: 'studio',
      name: 'Operator Studio',
      auth: { accessMode: 'specific', allowRoles: ['ADMIN'], allowUsers: [], denyRoles: [], denyUsers: [] },
    });
  });

  it('preserves home layout assignment while locking the root segment', () => {
    const authoritative = {
      id: 'admin',
      cultureId: 'us',
      portals: builtInPortals,
    };

    const incoming = {
      ...authoritative,
      portals: [
        {
          ...defaultHomePortal(),
          shellKey: 'core:SiteLayout',
          entryMode: 'shell' as const,
          redirectToSegment: null,
          redirectToCulture: null,
          name: 'Public Home',
        },
        defaultStudioPortal(),
        defaultComponentAlonePortal(),
      ],
    };

    const merged = enforceBuiltInPortals(incoming, authoritative);
    expect(merged.portals[0]).toMatchObject({
      segment: 'home',
      shellKey: 'core:SiteLayout',
      entryMode: 'shell',
      name: 'Public Home',
    });
  });

  it('builds route binding patterns for root and child routes', () => {
    expect(portalPageBindingPattern('studio', 'studio/users')).toBe('users');
    expect(portalPageBindingPattern('portal', 'portal/home')).toBe('portal/home');
  });

  it('validates duplicate application URL segment slugs', () => {
    expect(validatePortalSegmentSlug('my-portal')).toBeNull();
    expect(validatePortalSegmentSlug('my_app.v2')).toBeNull();
    expect(validatePortalSegmentSlug('')).toBe('URL segment is required.');
    expect(validatePortalSegmentSlug('My-Portal')).toContain('lowercase');
    expect(validatePortalSegmentSlug('home')).toBe('URL segment is reserved.');
    expect(validatePortalSegmentSlug('studio')).toBe('URL segment is reserved.');
    expect(validatePortalSegmentSlug('component-alone')).toBe('URL segment is reserved.');
    expect(validatePortalSegmentSlug('site')).toBe('URL segment is reserved.');
  });

  it('separates portal URL segment from layout key', () => {
    expect(resolvePortalRegistryKey('my-test')).toBe('my-test');
    expect(resolvePortalLayoutKey('my-test', 'my-portal-layout')).toBe('my-portal-layout');
    expect(resolvePortalLayoutKey('my-test')).toBe('my-test');
    expect(resolvePortalLayoutKey('home', 'core:SiteLayout')).toBe('core:SiteLayout');
    expect(resolvePortalLayoutKey('home', 'site')).toBe('site');
    expect(resolvePortalLayoutKey('home')).toBe('home-shell');

    const result = validateExperienceManifest({
      id: 'admin',
      cultureId: 'us',
      portals: [
        defaultHomePortal(),
        defaultStudioPortal(),
        defaultComponentAlonePortal(),
        {
          segment: 'my-test',
          name: 'My Test',
          shellKey: 'my-portal-layout',
          entryMode: 'shell',
          enabled: true,
          auth: { accessMode: 'authenticated', allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] },
          pages: [],
        },
      ],
    });

    expect(result.valid).toBe(true);
    if (result.valid) {
      const portal = result.manifest.portals.find((entry) => entry.segment === 'my-test');
      expect(portal).toMatchObject({
        segment: 'my-test',
        shellKey: 'my-portal-layout',
      });
    }
  });

  it('accepts dot and underscore in portal segment validation', () => {
    const result = validateExperienceManifest({
      id: 'admin',
      cultureId: 'us',
      portals: [
        defaultHomePortal(),
        defaultStudioPortal(),
        defaultComponentAlonePortal(),
        {
          segment: 'my.portal_v2',
          name: 'My Portal',
          shellKey: 'my.portal_v2',
          entryMode: 'shell',
          navigationRef: 'my.portal_v2',
          enabled: false,
          auth: { accessMode: 'authenticated', allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] },
          pages: [],
        },
      ],
    });

    expect(result.valid).toBe(true);
  });

  it('validates package extension portals without built-in home/studio/component-alone', () => {
    const result = validatePackageExtensionPortals('my-package', [{
      segment: 'my-test',
      name: 'My Test',
      shellKey: 'my-test',
      entryMode: 'shell',
      enabled: true,
      auth: { accessMode: 'authenticated', allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] },
      pages: [{ path: 'my-test/home', pageKey: 'home' }],
    }]);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.manifest.portals).toHaveLength(1);
      expect(result.manifest.portals[0]?.segment).toBe('my-test');
    }
  });

  it('rejects built-in portal segments in package extension validation', () => {
    const result = validatePackageExtensionPortals('my-package', [defaultStudioPortal()]);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((error) => error.includes('reserved for built-in portals'))).toBe(true);
    }
  });

  it('allows redirect targets that reference built-in portals in package extension validation', () => {
    const result = validatePackageExtensionPortals('my-package', [{
      segment: 'landing',
      name: 'Landing',
      shellKey: 'landing',
      entryMode: 'redirect',
      redirectToSegment: 'studio',
      redirectToCulture: 'us',
      enabled: true,
      pages: [],
    }]);

    expect(result.valid).toBe(true);
  });
});
