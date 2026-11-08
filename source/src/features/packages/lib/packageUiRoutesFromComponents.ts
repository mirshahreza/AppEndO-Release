import { DEFAULT_EXTENSION_UI_ROUTE_MOUNT_ID } from '../../../shared/api/contracts/package-manifest/extensionUiRoutes';
import { buildPackageUiRoutePageKey } from './packageUiEntryPath';
import type { PackageBuilderCatalogUiComponentItem } from './packageBuilderCatalog';

export type PackageBuilderUiRouteCapability = {
  pageKey: string;
  entry: string;
  suggestedRoutePattern: string;
  suggestedMountId: string;
};

function ensureRelativePath(value: string, fallback: string): string {
  const clean = value.trim().replace(/^\/+/, '');
  return clean || fallback;
}

/**
 * Studio-module pages: emit ui_routes for selected page seeds (not transitive reusables).
 * Portal-derived pages already restore via portal compile — skip those keys.
 */
export function buildPackageUiRoutesForPageSeeds(input: {
  pageSeeds: readonly PackageBuilderCatalogUiComponentItem[];
  skipComponentKeys?: ReadonlySet<string>;
}): PackageBuilderUiRouteCapability[] {
  const skip = input.skipComponentKeys ?? new Set<string>();
  const usedPageKeys = new Set<string>();
  const routes: PackageBuilderUiRouteCapability[] = [];

  for (const component of input.pageSeeds) {
    if (skip.has(component.componentKey)) continue;
    const pageKey = buildPackageUiRoutePageKey(component.componentKey);
    if (!pageKey || usedPageKeys.has(pageKey)) continue;
    usedPageKeys.add(pageKey);
    const entry = ensureRelativePath(
      component.exportBundle?.entry ?? '',
      `ui/${component.componentKey}.tsx`,
    );
    routes.push({
      pageKey,
      entry,
      suggestedRoutePattern: component.componentKey.replace(/^\/+/, ''),
      suggestedMountId: DEFAULT_EXTENSION_UI_ROUTE_MOUNT_ID,
    });
  }

  return routes;
}

export function applyStudioRoutePatternsToUiRoutes(
  routes: readonly PackageBuilderUiRouteCapability[],
  bindings: readonly { pageKey: string; mountId?: string | null; routePattern: string }[],
): PackageBuilderUiRouteCapability[] {
  const byPageKey = new Map<string, string>();
  for (const binding of bindings) {
    const pageKey = binding.pageKey.trim();
    const pattern = binding.routePattern.trim().replace(/^\/+/, '');
    const mountId = binding.mountId?.trim() || DEFAULT_EXTENSION_UI_ROUTE_MOUNT_ID;
    if (!pageKey || !pattern || mountId !== DEFAULT_EXTENSION_UI_ROUTE_MOUNT_ID) continue;
    if (!byPageKey.has(pageKey)) byPageKey.set(pageKey, pattern);
  }
  return routes.map((route) => {
    const livePattern = byPageKey.get(route.pageKey);
    return livePattern ? { ...route, suggestedRoutePattern: livePattern } : route;
  });
}
