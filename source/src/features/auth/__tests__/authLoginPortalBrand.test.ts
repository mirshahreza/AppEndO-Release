import { describe, expect, it } from 'vitest';

import type { PlatformRuntimeConfig } from '../../../shared/api/contracts/platform/types';
import { HWY_PLATFORM_PORTAL_BRAND_LOGO_URL } from '../../../domain/hwy/hwyPlatformPortalBrandDefaults';
import { DEFAULT_PORTAL_LOGO_URL } from '../../../shared/api/contracts/platform/portalBrand';
import {
  resolveAuthLoginBrandContextPath,
  resolveAuthLoginPortalBrand,
} from '../authLoginPortalBrand';

const hawietyHomeConfig = {
  shells: [
    {
      shellKey: 'home-shell',
      name: 'Home',
      enabled: true,
      entryMode: 'redirect',
      redirectToCulture: 'iq',
      redirectToSegment: 'hawiety',
    },
    {
      shellKey: 'hawiety',
      name: 'Hawiety',
      enabled: true,
      brand: {
        logoUrl: '/assets/workspace/portals/hawiety/logo.png',
        title: 'Hawiety identity',
        windowTitle: 'هويتي',
      },
    },
  ],
} as unknown as PlatformRuntimeConfig;

describe('authLoginPortalBrand', () => {
  it('maps root return URL to the home-shell redirect target', () => {
    expect(resolveAuthLoginBrandContextPath('/', hawietyHomeConfig)).toBe('/iq/hawiety');
  });

  it('uses the Hawiety portal logo when signing in after visiting /', () => {
    const brand = resolveAuthLoginPortalBrand('/', hawietyHomeConfig);
    expect(brand.portalSegment).toBe('hawiety');
    expect(brand.usesPortalLogo).toBe(true);
    expect(brand.logoUrl).toBe('/assets/workspace/portals/hawiety/logo.png');
    expect(brand.windowTitle).toBe('هويتي');
  });

  it('uses the Hawiety portal logo when return URL targets hawiety', () => {
    const brand = resolveAuthLoginPortalBrand('/iq/hawiety/members', hawietyHomeConfig);
    expect(brand.usesPortalLogo).toBe(true);
    expect(brand.logoUrl).toBe('/assets/workspace/portals/hawiety/logo.png');
  });

  it('falls back to bundled Hawiety mark when shell brand is still AppEnd placeholder', () => {
    const config = {
      shells: [
        {
          shellKey: 'hawiety',
          name: 'Hawiety',
          enabled: true,
          brand: {
            logoUrl: DEFAULT_PORTAL_LOGO_URL,
            title: 'AppEnd',
          },
        },
      ],
    } as unknown as PlatformRuntimeConfig;

    const brand = resolveAuthLoginPortalBrand('/iq/hawiety/login', config);
    expect(brand.usesPortalLogo).toBe(true);
    expect(brand.logoUrl).toBe(HWY_PLATFORM_PORTAL_BRAND_LOGO_URL);
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
