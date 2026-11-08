import { describe, expect, it } from 'vitest';
import {
  buildPwaManifestIcons,
  buildPwaIconPreviewSrc,
  buildPwaWebManifest,
  DEFAULT_PWA_SETTINGS,
  resolvePwaFaviconUrl,
  resolvePwaIcon192Url,
} from '../pwa';

describe('pwa resolvers', () => {
  it('handles partial legacy settings without throwing', () => {
    const partial = {
      name: 'Legacy App',
      enabled: true,
    };

    expect(resolvePwaFaviconUrl(partial)).toBe('/pwa-64x64.png');
    expect(resolvePwaIcon192Url(partial)).toBe('/pwa-192x192.png');
  });

  it('prefers custom favicon when present', () => {
    expect(resolvePwaFaviconUrl({
      faviconUrl: '/assets/platform/pwa/icon-32.png',
      icon192Url: '',
    })).toBe('/assets/platform/pwa/icon-32.png');
  });

  it('defaults missing fields in map-compatible shape', () => {
    expect(DEFAULT_PWA_SETTINGS.faviconUrl).toBe('');
    expect(DEFAULT_PWA_SETTINGS.iconSourceRef).toBe('');
  });

  it('emits absolute manifest icon paths', () => {
    const icons = buildPwaManifestIcons(DEFAULT_PWA_SETTINGS);
    expect(icons[1]?.src).toBe('/pwa-192x192.png');
  });

  it('appends cache bust params to preview urls', () => {
    expect(buildPwaIconPreviewSrc('192', DEFAULT_PWA_SETTINGS, 123)).toContain('v=123');
  });

  it('builds a web manifest with default name and icons', () => {
    const manifest = buildPwaWebManifest(DEFAULT_PWA_SETTINGS);
    expect(manifest.name).toBe('AppEndO');
    expect(manifest.icons[1]?.src).toBe('/pwa-192x192.png');
  });
});
