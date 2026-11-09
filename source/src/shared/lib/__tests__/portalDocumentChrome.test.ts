// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import { DEFAULT_PORTAL_LOGO_URL } from '../../api/contracts/platform/portalBrand';
import {
  applyPortalDocumentFavicon,
  isPortalOwnedDocumentChrome,
  resolveVerticalPublicPortalFaviconUrl,
} from '../portalDocumentChrome';

describe('portalDocumentChrome', () => {
  afterEach(() => {
    document.head.innerHTML = '';
  });

  it('detects Vertical public portal paths', () => {
    expect(isPortalOwnedDocumentChrome('/iq/vertical/login')).toBe(true);
    expect(isPortalOwnedDocumentChrome('/us/studio/users')).toBe(false);
  });

  it('falls back to bundled Vertical mark for favicon', () => {
    expect(resolveVerticalPublicPortalFaviconUrl(DEFAULT_PORTAL_LOGO_URL)).toBe(
      '/assets/vertical/mark-blue.png',
    );
    expect(resolveVerticalPublicPortalFaviconUrl('/assets/workspace/portals/vertical/logo.png')).toBe(
      '/assets/workspace/portals/vertical/logo.png',
    );
  });

  it('replaces document icon links with the portal logo', () => {
    document.head.innerHTML = '<link rel="icon" href="/favicon.ico" />';
    applyPortalDocumentFavicon('/assets/vertical/mark-blue.png');

    expect(document.querySelector('link[href="/favicon.ico"]')).toBeNull();
    expect(document.querySelector('link[rel="icon"][href="/assets/vertical/mark-blue.png"]')).toBeTruthy();
    expect(document.querySelector('link[rel="apple-touch-icon"][href="/assets/vertical/mark-blue.png"]')).toBeTruthy();
  });
});
