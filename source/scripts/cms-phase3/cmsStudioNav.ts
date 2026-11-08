/**
 * CMS domain — Phase 3 Studio navigation (independent group heading=`CMS`).
 * Opt-in only. Never creates a portal / navigation/cms.json.
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
export const CMS_STUDIO_GROUP_HEADING = 'CMS';

/** Path prefix for CMS domain routes on the studio mount (`/{culture}/studio/cms/…`). */
export const CMS_ROUTE_PREFIX = 'cms';

export type CmsStudioNavPage = {
  pageKey: string;
  routePattern: string;
  label: string;
  icon: string;
  description: string;
  iconColor: string;
  order: number;
  separatorBefore?: boolean;
};

// Matches the on-disk `auth` shape already used by every existing nav item in
// `navigation/studio.json` (Data Studio / Workflows / Users, …) — `{ roles: [...] }`,
// not the stricter `FunctionAccessControl` shape the `auth` field is typed as
// (that type covers route-binding-level auth; nav-item auth on disk predates it
// and is passed through untouched by `parseNavigationManifest`). Cast to match.
const ADMIN_AUTH = { roles: ['ADMIN'] } as unknown as NavigationManifestItem['auth'];

/**
 * Studio sidebar mirrors platform Settings: one Settings item with splat
 * `cms/settings/*`. Vocabulary / domain sections live in the page’s left nav —
 * never as main-menu children.
 */
export const buildCmsStudioNavGroup = (pages: {
  contents: CmsStudioNavPage;
  settings: CmsStudioNavPage;
}): NavigationManifestGroup => {
  const items: NavigationManifestItem[] = [
    {
      pageKey: pages.contents.pageKey,
      routePattern: pages.contents.routePattern,
      label: pages.contents.label,
      icon: pages.contents.icon,
      description: pages.contents.description,
      iconColor: pages.contents.iconColor,
      order: pages.contents.order,
      auth: ADMIN_AUTH,
    },
    {
      pageKey: pages.settings.pageKey,
      routePattern: pages.settings.routePattern,
      label: pages.settings.label,
      icon: pages.settings.icon,
      description: pages.settings.description,
      iconColor: pages.settings.iconColor,
      order: pages.settings.order,
      separatorBefore: true,
      auth: ADMIN_AUTH,
    },
  ];

  return {
    heading: CMS_STUDIO_GROUP_HEADING,
    icon: 'Newspaper',
    order: 4,
    items,
  };
};

/** Upsert the independent CMS group in studio.json (idempotent). */
export const upsertCmsStudioNavGroup = (group: NavigationManifestGroup): void => {
  const manifest = readNavigationFile(STUDIO_NAV_ID);
  if (!manifest) {
    throw new Error(
      'Studio navigation manifest not found (workspace/platform-registry/navigation/studio.json).',
    );
  }

  const groups = (manifest.groups ?? []).filter(
    (item) => item.heading !== CMS_STUDIO_GROUP_HEADING,
  );
  groups.push(group);
  groups.sort((left, right) => (left.order ?? 999) - (right.order ?? 999));

  writeNavigationFile({
    ...manifest,
    groups,
  });
  invalidatePlatformRuntimeConfig();
};

/** Remove the CMS group (and any leftover Records→CMS single item from older builds). */
export const removeCmsStudioNavGroup = (): boolean => {
  const manifest = readNavigationFile(STUDIO_NAV_ID);
  if (!manifest) {
    return false;
  }

  let changed = false;
  const nextGroups = (manifest.groups ?? [])
    .filter((group) => {
      if (group.heading === CMS_STUDIO_GROUP_HEADING) {
        changed = true;
        return false;
      }
      return true;
    })
    .map((group) => {
      if (group.heading !== 'Records') {
        return group;
      }
      const items = (group.items ?? []).filter((item) => {
        const isLegacyCmsItem = (
          item.label === 'CMS'
          || item.routePattern === 'cms'
          || item.pageKey === 'cms-list'
          || item.pageKey === 'cms-contents-list'
        );
        if (isLegacyCmsItem) {
          changed = true;
          return false;
        }
        return true;
      });
      return { ...group, items };
    });

  if (!changed) {
    return false;
  }

  writeNavigationFile({
    ...manifest,
    groups: nextGroups,
  });
  invalidatePlatformRuntimeConfig();
  return true;
};
