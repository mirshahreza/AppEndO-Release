import { describe, expect, it } from 'vitest';
import {
  PACKAGE_HOME_PORTAL_ENTRY,
  publicSiteHomePortalArtifactFile,
  publicSiteHomePortalCapability,
  shouldPackPublicSiteHomePortal,
} from '../packageHomePortalPacking';

describe('packageHomePortalPacking', () => {
  it('packs home portal only for the public-site package', () => {
    expect(shouldPackPublicSiteHomePortal('cms')).toBe(true);
    expect(shouldPackPublicSiteHomePortal('crm')).toBe(false);
    expect(publicSiteHomePortalCapability()).toEqual([{ entry: PACKAGE_HOME_PORTAL_ENTRY }]);
    expect(publicSiteHomePortalArtifactFile().entry).toBe(PACKAGE_HOME_PORTAL_ENTRY);
    expect(publicSiteHomePortalArtifactFile().content).toContain('"entryMode": "shell"');
  });
});
