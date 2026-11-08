// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import {
  applyPortalDocumentFavicon,
  isPortalOwnedDocumentChrome,
  resolveHawietyPublicPortalFaviconUrl,
} from '../portalDocumentChrome';

describe('portalDocumentChrome', () => {
  afterEach(() => {
    document.head.innerHTML = '';
  });

  it('detects Hawiety public portal paths', () => {
    expect(isPortalOwnedDocumentChrome('/iq/hawiety/login')).toBe(true);
    expect(isPortalOwnedDocumentChrome('/us/studio/users')).toBe(false);
  });

  it('falls back to bundled Hawiety mark for favicon', () => {
    expect(resolveHawietyPublicPortalFaviconUrl('/assets/appendo-logo.png')).toBe(
      '/assets/hawiety/mark-blue.png',
    );
    expect(resolveHawietyPublicPortalFaviconUrl('/assets/workspace/portals/hawiety/logo.png')).toBe(
      '/assets/workspace/portals/hawiety/logo.png',
    );
  });

  it('replaces document icon links with the portal logo', () => {
    document.head.innerHTML = '<link rel="icon" href="/favicon.ico" />';
    applyPortalDocumentFavicon('/assets/hawiety/mark-blue.png');

    expect(document.querySelector('link[href="/favicon.ico"]')).toBeNull();
    expect(document.querySelector('link[rel="icon"][href="/assets/hawiety/mark-blue.png"]')).toBeTruthy();
    expect(document.querySelector('link[rel="apple-touch-icon"][href="/assets/hawiety/mark-blue.png"]')).toBeTruthy();
  });
});
