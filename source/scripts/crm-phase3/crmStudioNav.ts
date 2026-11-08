/**
 * CRM domain — Phase 3a Studio navigation (independent group heading=`CRM`).
 * Opt-in only. Never creates a portal / navigation/crm.json.
 */

import {
  readNavigationFile,
  writeNavigationFile,
} from '../../src/core/platform-registry/PlatformRegistryFileStore';
import type {
  NavigationManifestGroup,
  NavigationManifestItem,
} from '../../src/shared/api/contracts/platform/navigation';
import { invalidatePlatformRuntimeConfig } from '../../src/server/services/platform/platformRuntimeConfig.service';

const STUDIO_NAV_ID = 'studio';
export const CRM_STUDIO_GROUP_HEADING = 'CRM';

/** Path prefix for CRM domain routes on the studio mount (`/{culture}/studio/crm/…`). */
export const CRM_ROUTE_PREFIX = 'crm';

export type CrmStudioNavPage = {
  pageKey: string;
  routePattern: string;
  label: string;
  icon: string;
  description: string;
  iconColor: string;
  order: number;
  separatorBefore?: boolean;
};

// Matches on-disk studio.json auth shape (`{ roles: [...] }`).
const ADMIN_AUTH = { roles: ['ADMIN'] } as unknown as NavigationManifestItem['auth'];

/**
 * Studio sidebar: operational catalogs (Customers · Opportunities · Tickets, added
 * incrementally as each sub-phase ships) · separator · Settings.
 * Vocabulary sections live in the Settings left rail — never as main-menu children.
 * Built up progressively: 3a passes only `settings`; 3b/3c/3d each add their own
 * page to the array on top of what earlier sub-phases already registered.
 */
export const buildCrmStudioNavGroup = (pages: CrmStudioNavPage[]): NavigationManifestGroup => {
  const toItem = (page: CrmStudioNavPage): NavigationManifestItem => ({
    pageKey: page.pageKey,
    routePattern: page.routePattern,
    label: page.label,
    icon: page.icon,
    description: page.description,
    iconColor: page.iconColor,
    order: page.order,
    ...(page.separatorBefore ? { separatorBefore: true } : {}),
    auth: ADMIN_AUTH,
  });

  return {
    heading: CRM_STUDIO_GROUP_HEADING,
    icon: 'Handshake',
    order: 5,
    items: pages.map(toItem),
  };
};

/** Upsert the independent CRM group in studio.json (idempotent). */
export const upsertCrmStudioNavGroup = (group: NavigationManifestGroup): void => {
  const manifest = readNavigationFile(STUDIO_NAV_ID);
  if (!manifest) {
    throw new Error(
      'Studio navigation manifest not found (workspace/platform-registry/navigation/studio.json).',
    );
  }

  const groups = (manifest.groups ?? []).filter(
    (item) => item.heading !== CRM_STUDIO_GROUP_HEADING,
  );
  groups.push(group);
  groups.sort((left, right) => (left.order ?? 999) - (right.order ?? 999));

  writeNavigationFile({
    ...manifest,
    groups,
  });
  invalidatePlatformRuntimeConfig();
};

/** Remove the CRM group from studio.json. */
export const removeCrmStudioNavGroup = (): boolean => {
  const manifest = readNavigationFile(STUDIO_NAV_ID);
  if (!manifest) {
    return false;
  }

  const nextGroups = (manifest.groups ?? []).filter(
    (group) => group.heading !== CRM_STUDIO_GROUP_HEADING,
  );
  if (nextGroups.length === (manifest.groups ?? []).length) {
    return false;
  }

  writeNavigationFile({
    ...manifest,
    groups: nextGroups,
  });
  invalidatePlatformRuntimeConfig();
  return true;
};
