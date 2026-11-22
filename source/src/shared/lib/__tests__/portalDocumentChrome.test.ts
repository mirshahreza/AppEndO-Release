// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import { DEFAULT_PORTAL_LOGO_URL } from '../../api/contracts/platform/portalBrand';
import {
  applyPortalDocumentFavicon,
  isPortalOwnedDocumentChrome,
  resolvePortalxPublicPortalFaviconUrl,
} from '../portalDocumentChrome';

describe('portalDocumentChrome', () => {
  afterEach(() => {
    document.head.innerHTML = '';
  });

  it('detects Portalx public portal paths', () => {
    expect(isPortalOwnedDocumentChrome('/iq/portalx/login')).toBe(true);
    expect(isPortalOwnedDocumentChrome('/us/studio/users')).toBe(false);
  });

  it('falls back to bundled Portalx mark for favicon', () => {
    expect(resolvePortalxPublicPortalFaviconUrl(DEFAULT_PORTAL_LOGO_URL)).toBe(
      '/assets/portalx/mark-blue.png',
    );
    expect(resolvePortalxPublicPortalFaviconUrl('/assets/workspace/portals/portalx/logo.png')).toBe(
      '/assets/workspace/portals/portalx/logo.png',
    );
  });

  it('replaces document icon links with the portal logo', () => {
    document.head.innerHTML = '<link rel="icon" href="/favicon.ico" />';
    applyPortalDocumentFavicon('/assets/portalx/mark-blue.png');

    expect(document.querySelector('link[href="/favicon.ico"]')).toBeNull();
    expect(document.querySelector('link[rel="icon"][href="/assets/portalx/mark-blue.png"]')).toBeTruthy();
    expect(document.querySelector('link[rel="apple-touch-icon"][href="/assets/portalx/mark-blue.png"]')).toBeTruthy();
  });
});
