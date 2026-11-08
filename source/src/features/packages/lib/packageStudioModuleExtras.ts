import { navGroupKey, navLabelKey } from '../../../core/culture/cultureShellKeys';
import { DEFAULT_EXTENSION_UI_ROUTE_MOUNT_ID, titleFromUiRoutePageKey } from '../../../shared/api/contracts/package-manifest/extensionUiRoutes';
import {
  isPackageStudioSidebarRoute,
  packageStudioSidebarChrome,
  packageStudioSidebarLabel,
  sortPackageStudioSidebarItems,
} from '../../../shared/lib/packageStudioSidebar';
import type { PackageBuilderCatalogUiComponentItem } from './packageBuilderCatalog';
import type { PackageBuilderUiRouteCapability } from './packageUiRoutesFromComponents';

export { isPackageStudioSidebarRoute } from '../../../shared/lib/packageStudioSidebar';

export const PACKAGE_STUDIO_NAVIGATION_ID = 'studio';
export const PACKAGE_STUDIO_NAV_PATCH_ENTRY = 'platform/navigation-patches/studio.json';
export const PACKAGE_CULTURE_KEYS_ENTRY = 'culture/keys.json';

export type PackageStudioNavPatchItem = {
  pageKey: string;
  label: string;
  order?: number;
  icon?: string;
  routePattern?: string;
};

export type PackageStudioNavPatch = {
  navigationId: string;
  heading: string;
  items: PackageStudioNavPatchItem[];
};

export type PackageStudioModuleExtras = {
  navigationPatch: PackageStudioNavPatch;
  navigationPatchCapability: { navigationId: string; entry: string };
  cultureKeys: Record<string, string>;
  cultureKeysCapability: { entry: string };
};

function humanizeComponentLabel(component: PackageBuilderCatalogUiComponentItem, pageKey: string): string {
  const raw = component.label.trim();
  if (raw && !raw.includes('/')) {
    return packageStudioSidebarLabel(pageKey, raw);
  }
  const fromKey = titleFromUiRoutePageKey(pageKey);
  return packageStudioSidebarLabel(pageKey, fromKey || raw || pageKey);
}

/**
 * Studio-module extras: a nav group named after the package plus English culture keys
 * so the shell does not fall back to `nav.group.*` / `nav.{pageKey}` raw keys.
 */
export function buildPackageStudioModuleExtras(input: {
  packageName: string;
  routes: readonly PackageBuilderUiRouteCapability[];
  pageSeeds: readonly PackageBuilderCatalogUiComponentItem[];
}): PackageStudioModuleExtras | null {
  const heading = input.packageName.trim();
  const studioRoutes = input.routes.filter((route) => (
    (route.suggestedMountId?.trim() || DEFAULT_EXTENSION_UI_ROUTE_MOUNT_ID) === PACKAGE_STUDIO_NAVIGATION_ID
    && isPackageStudioSidebarRoute(route.pageKey)
  ));
  if (!heading || studioRoutes.length === 0) {
    return null;
  }

  const seedByEntry = new Map(input.pageSeeds.map((item) => [
    (item.exportBundle?.entry ?? `ui/${item.componentKey}.tsx`).replace(/^\/+/, ''),
    item,
  ]));
  const seedByKey = new Map(input.pageSeeds.map((item) => [item.componentKey, item]));

  const items = sortPackageStudioSidebarItems(studioRoutes.map((route) => {
    const seed = seedByEntry.get(route.entry.replace(/^\/+/, ''))
      ?? seedByKey.get(route.suggestedRoutePattern)
      ?? input.pageSeeds.find((item) => item.componentKey.replace(/^\/+/, '') === route.suggestedRoutePattern);
    const label = packageStudioSidebarLabel(
      route.pageKey,
      seed ? humanizeComponentLabel(seed, route.pageKey) : titleFromUiRoutePageKey(route.pageKey),
    );
    const chrome = packageStudioSidebarChrome(route.pageKey);
    return {
      pageKey: route.pageKey,
      label,
      ...(chrome?.icon ? { icon: chrome.icon } : {}),
      routePattern: chrome?.routePattern ?? route.suggestedRoutePattern,
    };
  })).map((item, index) => ({
    ...item,
    order: index,
  }));

  const cultureKeys: Record<string, string> = {
    [navGroupKey(heading)]: heading,
  };
  for (const item of items) {
    cultureKeys[navLabelKey(item.pageKey)] = item.label;
  }

  return {
    navigationPatch: {
      navigationId: PACKAGE_STUDIO_NAVIGATION_ID,
      heading,
      items,
    },
    navigationPatchCapability: {
      navigationId: PACKAGE_STUDIO_NAVIGATION_ID,
      entry: PACKAGE_STUDIO_NAV_PATCH_ENTRY,
    },
    cultureKeys,
    cultureKeysCapability: {
      entry: PACKAGE_CULTURE_KEYS_ENTRY,
    },
  };
}

export function studioModuleExtraFiles(
  extras: PackageStudioModuleExtras,
): Array<{ entry: string; content: string }> {
  return [
    {
      entry: extras.navigationPatchCapability.entry,
      content: `${JSON.stringify(extras.navigationPatch, null, 2)}\n`,
    },
    {
      entry: extras.cultureKeysCapability.entry,
      content: `${JSON.stringify(extras.cultureKeys, null, 2)}\n`,
    },
  ];
}
