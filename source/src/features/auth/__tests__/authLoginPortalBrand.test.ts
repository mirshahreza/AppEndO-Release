import { describe, expect, it } from 'vitest';

import type { PlatformRuntimeConfig } from '../../../shared/api/contracts/platform/types';
import { EXTX_PLATFORM_PORTAL_BRAND_LOGO_URL } from '../../../oss/excludedModuleStub';
import { DEFAULT_PORTAL_LOGO_URL } from '../../../shared/api/contracts/platform/portalBrand';
import {
  resolveAuthLoginBrandContextPath,
  resolveAuthLoginPortalBrand,
} from '../authLoginPortalBrand';

const portalxHomeConfig = {
  shells: [
    {
      shellKey: 'home-shell',
      name: 'Home',
      enabled: true,
      entryMode: 'redirect',
      redirectToCulture: 'iq',
      redirectToSegment: 'portalx',
    },
    {
      shellKey: 'portalx',
      name: 'Portalx',
      enabled: true,
      brand: {
        logoUrl: '/assets/workspace/portals/portalx/logo.png',
        title: 'Portalx identity',
        windowTitle: 'هويتي',
      },
    },
  ],
} as unknown as PlatformRuntimeConfig;

describe('authLoginPortalBrand', () => {
  it('maps root return URL to the home-shell redirect target', () => {
    expect(resolveAuthLoginBrandContextPath('/', portalxHomeConfig)).toBe('/iq/portalx');
  });

  it('uses the Portalx portal logo when signing in after visiting /', () => {
    const brand = resolveAuthLoginPortalBrand('/', portalxHomeConfig);
    expect(brand.portalSegment).toBe('portalx');
    expect(brand.usesPortalLogo).toBe(true);
    expect(brand.logoUrl).toBe('/assets/workspace/portals/portalx/logo.png');
    expect(brand.windowTitle).toBe('هويتي');
  });

  it('uses the Portalx portal logo when return URL targets portalx', () => {
    const brand = resolveAuthLoginPortalBrand('/iq/portalx/members', portalxHomeConfig);
    expect(brand.usesPortalLogo).toBe(true);
    expect(brand.logoUrl).toBe('/assets/workspace/portals/portalx/logo.png');
  });

  it('falls back to bundled Portalx mark when shell brand is still AppEnd placeholder', () => {
    const config = {
      shells: [
        {
          shellKey: 'portalx',
          name: 'Portalx',
          enabled: true,
          brand: {
            logoUrl: DEFAULT_PORTAL_LOGO_URL,
            title: 'AppEnd',
          },
        },
      ],
    } as unknown as PlatformRuntimeConfig;

    const brand = resolveAuthLoginPortalBrand('/iq/portalx/login', config);
    expect(brand.usesPortalLogo).toBe(true);
    expect(brand.logoUrl).toBe(EXTX_PLATFORM_PORTAL_BRAND_LOGO_URL);
  });

  it('keeps AppEnd branding for studio return URLs without a custom portal logo', () => {
    const config = {
      shells: [
        {
          shellKey: 'studio',
          name: 'Studio',
          enabled: true,
          brand: null,
        },
      ],
    } as unknown as PlatformRuntimeConfig;

    const brand = resolveAuthLoginPortalBrand('/us/studio/users', config);
    expect(brand.portalSegment).toBe('studio');
    expect(brand.usesPortalLogo).toBe(false);
    expect(brand.logoUrl).toBe(DEFAULT_PORTAL_LOGO_URL);
  });
});
