// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  PORTAL_BRAND_CACHE_KEY,
  cachePortalBrand,
  guessPortalSegmentFromPathname,
  primePortalBrandCacheFromShells,
  readCachedPortalBrand,
  readCachedPortalBrandForPathname,
  resolvePortalLoadingBrandForPathname,
} from '../portalBrandCache';

describe('portal brand cache', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('guesses the portal segment from a culture URL', () => {
    expect(guessPortalSegmentFromPathname('/us/studio/users')).toBe('studio');
    expect(guessPortalSegmentFromPathname('/iq/hawiety/self-registration')).toBe('hawiety');
    expect(guessPortalSegmentFromPathname('/us')).toBe('home');
    expect(guessPortalSegmentFromPathname('/login')).toBe('');
  });

  it('stores and reads a safe portal logo', () => {
    cachePortalBrand('shop', {
      logoUrl: '/assets/workspace/portals/shop/logo.png',
      title: 'Shop',
    });
    expect(readCachedPortalBrand('shop')).toEqual({
      logoUrl: '/assets/workspace/portals/shop/logo.png',
      title: 'Shop',
    });
    expect(readCachedPortalBrandForPathname('/us/shop/home')).toEqual({
      logoUrl: '/assets/workspace/portals/shop/logo.png',
      title: 'Shop',
    });
    expect(localStorage.getItem(PORTAL_BRAND_CACHE_KEY)).toContain('shop');
  });

  it('falls back to the bundled Hawiety mark when cache and shells are empty', () => {
    expect(resolvePortalLoadingBrandForPathname('/iq/hawiety/self-registration')).toEqual({
      logoUrl: '/assets/hawiety/mark-blue.png',
    });
  });

  it('resolves loading brand from boot shells for culture portal URLs', () => {
    const brand = resolvePortalLoadingBrandForPathname('/iq/hawiety/self-registration', [
      {
        shellKey: 'hawiety',
        name: 'Hawiety',
        brand: {
          logoUrl: '/assets/workspace/portals/hawiety/logo.png',
          title: 'Hawiety portal',
        },
      } as never,
    ]);
    expect(brand).toEqual({
      logoUrl: '/assets/workspace/portals/hawiety/logo.png',
      title: 'انضم الينا / نظام هويتي الإلكتروني',
    });
  });

  it('seeds cache from portal shell brand (Settings → Portals)', () => {
    window.history.replaceState({}, '', '/iq/hawiety/self-registration');
    primePortalBrandCacheFromShells([
      {
        shellKey: 'hawiety',
        name: 'Hawiety',
        entry: 'core:AdminLayout',
        surface: 'studio',
        enabled: true,
        brand: {
          logoUrl: '/assets/workspace/portals/hawiety/logo.png',
          title: 'Hawiety portal',
        },
      } as never,
    ]);
    expect(readCachedPortalBrand('hawiety')).toEqual({
      logoUrl: '/assets/workspace/portals/hawiety/logo.png',
      title: 'انضم الينا / نظام هويتي الإلكتروني',
    });
  });

  it('ignores unsafe cached logo URLs', () => {
    localStorage.setItem(PORTAL_BRAND_CACHE_KEY, JSON.stringify({
      shop: { logoUrl: 'javascript:alert(1)', title: '<b>x</b>' },
    }));
    expect(readCachedPortalBrand('shop')).toBeNull();
  });
});
