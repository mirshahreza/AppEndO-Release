// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { DEFAULT_PWA_SETTINGS } from '../../contracts/settings/pwa';
import { applyPwaDocumentMeta } from '../pwa';

describe('applyPwaDocumentMeta', () => {
  it('updates document title and meta tags', () => {
    applyPwaDocumentMeta({
      ...DEFAULT_PWA_SETTINGS,
      name: 'Test App',
      description: 'Test description',
      themeColor: '#112233',
      shortName: 'Test',
    });

    expect(document.title).toBe('Test App');
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Test description');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#112233');
  });

  it('sets favicon links when custom icons are configured', () => {
    applyPwaDocumentMeta({
      ...DEFAULT_PWA_SETTINGS,
      faviconUrl: '/assets/platform/pwa/icon-32.png',
      icon192Url: '/assets/platform/pwa/icon-192.png',
    });

    const faviconLink = Array.from(document.head.querySelectorAll('link[rel="icon"]'))
      .find((link) => link.getAttribute('href') === '/assets/platform/pwa/icon-32.png');
    const icon192Link = Array.from(document.head.querySelectorAll('link[rel="icon"]'))
      .find((link) => link.getAttribute('href') === '/assets/platform/pwa/icon-192.png');
    expect(faviconLink).toBeTruthy();
    expect(icon192Link).toBeTruthy();
    expect(document.querySelector('link[href="/favicon.ico"]')).toBeNull();
  });

  it('replaces built-in favicon links when no custom icons are configured', () => {
    applyPwaDocumentMeta(DEFAULT_PWA_SETTINGS);

    expect(document.querySelector('link[href="/favicon.ico"]')).toBeNull();
    expect(document.querySelector('link[href="/pwa-192x192.png"]')).toBeTruthy();
  });
});
