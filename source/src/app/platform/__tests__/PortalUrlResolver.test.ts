import { describe, expect, it } from 'vitest';
import { bootstrapCultureRegistry } from '../../../core/culture/CultureRegistry';
import {
  STUDIO_PORTAL_SEGMENT,
  HOME_SHELL_KEY,
  ROOT_PORTAL_SEGMENT,
} from '../../../shared/api/contracts/platform/mountConstants';
import type { PlatformRuntimeConfig } from '../../../shared/api/contracts/platform/types';
import {
  resolvePortalFromPathname,
  resolvePortalFromRemainderPath,
  resolvePortalShellFromPathname,
} from '../PortalUrlResolver';

const runtimeConfig: PlatformRuntimeConfig = {
  version: 'application-v1',
  mounts: [],
  shells: [
    {
      shellKey: HOME_SHELL_KEY,
      name: 'Home Redirect',
      entry: '',
      surface: 'home',
      enabled: true,
      entryMode: 'redirect',
      redirectToSegment: STUDIO_PORTAL_SEGMENT,
      redirectToCulture: 'us',
    },
    {
      shellKey: STUDIO_PORTAL_SEGMENT,
      name: 'Studio',
      entry: 'core:AdminLayout',
      surface: 'studio',
      enabled: true,
    },
    {
      shellKey: 'designer',
      name: 'Designer Shell',
      entry: 'core:DesignerShell',
      surface: 'designer',
      enabled: true,
    },
  ],
  shellRules: [],
  pageModules: [],
  bindings: [
    {
      id: 1,
      mountId: 'studio',
      routePattern: 'users',
      pageKey: 'users',
      enabled: true,
    },
  ],
  navigations: [],
};

describe('PortalUrlResolver', () => {
  it('maps canonical studio portal segment to studio shell', () => {
    expect(resolvePortalFromRemainderPath('/studio/users', runtimeConfig)).toEqual({
      portalSegment: STUDIO_PORTAL_SEGMENT,
      shellKey: STUDIO_PORTAL_SEGMENT,
      pageRemainderPath: '/users',
    });
  });

  it('keeps legacy studio remainders on studio when a route binding exists', () => {
    expect(resolvePortalFromRemainderPath('/users', runtimeConfig)).toEqual({
      portalSegment: STUDIO_PORTAL_SEGMENT,
      shellKey: STUDIO_PORTAL_SEGMENT,
      pageRemainderPath: '/users',
    });
  });

  it('keeps public CMS slugs on the home site instead of studio', () => {
    bootstrapCultureRegistry(['us']);
    expect(resolvePortalFromRemainderPath('/about', runtimeConfig)).toEqual({
      portalSegment: ROOT_PORTAL_SEGMENT,
      shellKey: HOME_SHELL_KEY,
      pageRemainderPath: '/about',
    });
    expect(resolvePortalFromPathname('/us/about', runtimeConfig)).toEqual({
      cultureId: 'us',
      portalSegment: ROOT_PORTAL_SEGMENT,
      shellKey: HOME_SHELL_KEY,
      pageRemainderPath: '/about',
    });
  });

  it('maps empty remainder to the built-in home redirect application', () => {
    expect(resolvePortalFromRemainderPath('/', runtimeConfig)).toEqual({
      portalSegment: ROOT_PORTAL_SEGMENT,
      shellKey: HOME_SHELL_KEY,
      pageRemainderPath: '/',
    });
  });

  it('maps a registered shell key segment directly', () => {
    expect(resolvePortalFromRemainderPath('/designer/client-components', runtimeConfig)).toEqual({
      portalSegment: 'designer',
      shellKey: 'designer',
      pageRemainderPath: '/client-components',
    });
  });

  it('resolves culture prefix then portal segment from full pathname', () => {
    bootstrapCultureRegistry(['us', 'ir']);

    expect(resolvePortalFromPathname('/ir/studio/users', runtimeConfig)).toEqual({
      cultureId: 'ir',
      portalSegment: STUDIO_PORTAL_SEGMENT,
      shellKey: STUDIO_PORTAL_SEGMENT,
      pageRemainderPath: '/users',
    });

    expect(resolvePortalFromPathname('/us/studio', runtimeConfig)).toEqual({
      cultureId: 'us',
      portalSegment: STUDIO_PORTAL_SEGMENT,
      shellKey: STUDIO_PORTAL_SEGMENT,
      pageRemainderPath: '/',
    });

    expect(resolvePortalFromPathname('/us', runtimeConfig)).toEqual({
      cultureId: 'us',
      portalSegment: ROOT_PORTAL_SEGMENT,
      shellKey: HOME_SHELL_KEY,
      pageRemainderPath: '/',
    });
  });

  it('uses URL portal segment first for canonical studio paths', () => {
    bootstrapCultureRegistry(['us']);

    expect(resolvePortalShellFromPathname('/us/studio/users', runtimeConfig, 'us')).toEqual({
      cultureId: 'us',
      portalSegment: STUDIO_PORTAL_SEGMENT,
      shellKey: STUDIO_PORTAL_SEGMENT,
      pageRemainderPath: '/users',
    });
  });

  it('falls back to designer shell rule when URL has no explicit portal segment', () => {
    bootstrapCultureRegistry(['us']);

    const config: PlatformRuntimeConfig = {
      ...runtimeConfig,
      shellRules: [
        {
          id: 1,
          mountId: 'studio',
          pathPrefix: '/studio/client-components',
          shellKey: 'designer',
          priority: 10,
          enabled: true,
        },
      ],
    };

    expect(resolvePortalShellFromPathname('/studio/client-components', config, 'studio')).toEqual({
      cultureId: 'us',
      portalSegment: 'designer',
      shellKey: 'designer',
      pageRemainderPath: '/studio/client-components',
    });
  });

  it('uses designer shell rule for canonical culture studio client-components path', () => {
    bootstrapCultureRegistry(['us']);

    const config: PlatformRuntimeConfig = {
      ...runtimeConfig,
      shellRules: [
        {
          id: 1,
          mountId: 'studio',
          pathPrefix: '/studio/client-components',
          shellKey: 'designer',
          priority: 10,
          enabled: true,
        },
      ],
    };

    expect(resolvePortalShellFromPathname('/us/studio/client-components', config, 'us')).toEqual({
      cultureId: 'us',
      portalSegment: 'studio',
      shellKey: 'designer',
      pageRemainderPath: '/client-components',
    });
  });

  it('does not override explicit designer portal segment with shell rules', () => {
    bootstrapCultureRegistry(['us']);

    const config: PlatformRuntimeConfig = {
      ...runtimeConfig,
      shellRules: [
        {
          id: 1,
          mountId: 'studio',
          pathPrefix: '/studio/client-components',
          shellKey: STUDIO_PORTAL_SEGMENT,
          priority: 10,
          enabled: true,
        },
      ],
    };

    expect(resolvePortalShellFromPathname('/us/designer/client-components', config, 'us')).toEqual({
      cultureId: 'us',
      portalSegment: 'designer',
      shellKey: 'designer',
      pageRemainderPath: '/client-components',
    });
  });
});
