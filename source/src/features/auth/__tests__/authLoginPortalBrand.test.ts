import { describe, expect, it } from 'vitest';

import type { PlatformRuntimeConfig } from '../../../shared/api/contracts/platform/types';
import { VX_PLATFORM_PORTAL_BRAND_LOGO_URL } from '../../../domain/vx/vxPlatformPortalBrandDefaults';
import {
  resolveAuthLoginBrandContextPath,
  resolveAuthLoginPortalBrand,
} from '../authLoginPortalBrand';

const verticalHomeConfig = {
  shells: [
    {
      shellKey: 'home-shell',
      name: 'Home',
      enabled: true,
      entryMode: 'redirect',
      redirectToCulture: 'iq',
      redirectToSegment: 'vertical',
    },
    {
      shellKey: 'vertical',
      name: 'Vertical',
      enabled: true,
      brand: {
        logoUrl: '/assets/workspace/portals/vertical/logo.png',
        title: 'Vertical identity',
        windowTitle: 'هویتی',
      },
    },
  ],
} as unknown as PlatformRuntimeConfig;

describe('authLoginPortalBrand', () => {
  it('maps root return URL to the home-shell redirect target', () => {
    expect(resolveAuthLoginBrandContextPath('/', verticalHomeConfig)).toBe('/iq/vertical');
  });

  it('uses the Vertical portal logo when signing in after visiting /', () => {
    const brand = resolveAuthLoginPortalBrand('/', verticalHomeConfig);
    expect(brand.portalSegment).toBe('vertical');
    expect(brand.usesPortalLogo).toBe(true);
    expect(brand.logoUrl).toBe('/assets/workspace/portals/vertical/logo.png');
    expect(brand.windowTitle).toBe('هویتی');
  });

  it('uses the Vertical portal logo when return URL targets vertical', () => {
    const brand = resolveAuthLoginPortalBrand('/iq/vertical/members', verticalHomeConfig);
    expect(brand.usesPortalLogo).toBe(true);
    expect(brand.logoUrl).toBe('/assets/workspace/portals/vertical/logo.png');
  });

  it('falls back to bundled Vertical mark when shell brand is still AppEnd placeholder', () => {
    const config = {
      shells: [
        {
          shellKey: 'vertical',
          name: 'Vertical',
          enabled: true,
          brand: {
            logoUrl: '/assets/appendo-logo.png',
            title: 'AppEnd',
          },
        },
      ],
    } as unknown as PlatformRuntimeConfig;

    const brand = resolveAuthLoginPortalBrand('/iq/vertical/login', config);
    expect(brand.usesPortalLogo).toBe(true);
    expect(brand.logoUrl).toBe(VX_PLATFORM_PORTAL_BRAND_LOGO_URL);
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
    expect(brand.logoUrl).toBe('/assets/appendo-logo.png');
  });
});
