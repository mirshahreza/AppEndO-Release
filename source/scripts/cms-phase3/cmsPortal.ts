/**
 * CMS domain — Phase 3 leftover portal cleanup (Round 4: CMS lives under Studio nav).
 * Kept only so install/rollback can remove a previously created independent `cms` portal.
 * Do not create portals from Phase 3 anymore — use cmsStudioNav.ts.
 */

import { resolvePortalRegistryKey } from '../../src/shared/api/contracts/platform/experienceManifest';
import type { PlatformRegistryActor } from '../../src/core/platform-registry/platformRegistryAudit';
import { deletePortal } from '../../src/server/services/platform/portal.service';
import { findPlatformShellByKey } from '../../src/server/domain/platform';
import { deleteNavigationFile, readNavigationFile } from '../../src/core/platform-registry/PlatformRegistryFileStore';

export const CMS_PORTAL_SEGMENT = 'cms';
export const CMS_NAVIGATION_ID = 'cms';

/** Remove leftover independent CMS portal + its nav manifest if present. */
export const removeCmsPortal = async (actor: PlatformRegistryActor): Promise<boolean> => {
  let removed = false;
  const existing = await findPlatformShellByKey(resolvePortalRegistryKey(CMS_PORTAL_SEGMENT));
  if (existing) {
    await deletePortal(CMS_PORTAL_SEGMENT, actor);
    removed = true;
  }
  if (readNavigationFile(CMS_NAVIGATION_ID)) {
    deleteNavigationFile(CMS_NAVIGATION_ID);
    removed = true;
  }
  return removed;
};
