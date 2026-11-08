import { describe, expect, it } from 'vitest';
import {
  applyHomeShellClaim,
  buildPublicSiteHomePortalPayload,
  isPublicSitePackageId,
  parsePackageHomePortalPayload,
} from '../packageHomePortal';
import {
  BUILT_IN_SITE_SHELL_ENTRY,
  HOME_SHELL_KEY,
} from '../../../shared/api/contracts/platform/mountConstants';

describe('packageHomePortal', () => {
  it('recognizes the public-site package id', () => {
    expect(isPublicSitePackageId('cms')).toBe(true);
    expect(isPublicSitePackageId('CMS')).toBe(true);
    expect(isPublicSitePackageId('crm')).toBe(false);
  });

  it('builds a site-shell home claim payload', () => {
    expect(buildPublicSiteHomePortalPayload()).toEqual({
      shellKey: HOME_SHELL_KEY,
      name: 'Home',
      entry: BUILT_IN_SITE_SHELL_ENTRY,
      surface: 'home',
      entryMode: 'shell',
      navigationRef: 'home',
    });
  });

  it('rejects redirect or non-home payloads', () => {
    expect(parsePackageHomePortalPayload({
      ...buildPublicSiteHomePortalPayload(),
      entryMode: 'redirect',
    })).toBeNull();
    expect(parsePackageHomePortalPayload({
      ...buildPublicSiteHomePortalPayload(),
      shellKey: 'studio',
    })).toBeNull();
  });

  it('applies a claim onto an existing redirect home-shell', () => {
    const next = applyHomeShellClaim({
      shellKey: HOME_SHELL_KEY,
      name: 'Home Redirect',
      entry: '',
      surface: 'home',
      enabled: true,
      entryMode: 'redirect',
      redirectToSegment: 'studio',
      redirectToCulture: 'us',
    }, buildPublicSiteHomePortalPayload());

    expect(next.entryMode).toBe('shell');
    expect(next.entry).toBe(BUILT_IN_SITE_SHELL_ENTRY);
    expect(next.redirectToSegment).toBeNull();
    expect(next.redirectToCulture).toBeNull();
  });
});
