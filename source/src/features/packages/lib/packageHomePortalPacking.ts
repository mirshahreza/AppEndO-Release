import {
  PACKAGE_HOME_PORTAL_ENTRY,
  buildPublicSiteHomePortalPayload,
  isPublicSitePackageId,
} from '../../../core/packages/packageHomePortal';

export { PACKAGE_HOME_PORTAL_ENTRY };

export function shouldPackPublicSiteHomePortal(packageId: string): boolean {
  return isPublicSitePackageId(packageId);
}

export function publicSiteHomePortalCapability(): Array<{ entry: string }> {
  return [{ entry: PACKAGE_HOME_PORTAL_ENTRY }];
}

export function publicSiteHomePortalArtifactFile(): { entry: string; content: string } {
  return {
    entry: PACKAGE_HOME_PORTAL_ENTRY,
    content: `${JSON.stringify(buildPublicSiteHomePortalPayload(), null, 2)}\n`,
  };
}
