import { buildPackagePageLoaderRef } from './verticalApp';

export type ExtensionUiRouteCapability = {
  pageKey: string;
  entry: string;
  suggestedRoutePattern?: string;
  suggestedMountId?: string;
};

export type ExtensionUiRoutesPreview = {
  schema: 'package-ui-routes-preview';
  schemaVersion: '1.0.0';
  packageId: string;
  version: string;
  routes: ExtensionUiRoutesPreviewRoute[];
  generatedAt: string;
};

export type ExtensionUiRoutesPreviewRoute = {
  pageKey: string;
  title: string;
  routePattern: string;
  mountId: string;
  loaderRef: string;
  entry: string;
};

export const DEFAULT_EXTENSION_UI_ROUTE_MOUNT_ID = 'studio';

export function buildDefaultUiRoutePattern(packageId: string, pageKey: string): string {
  return `packages/${packageId}/${pageKey}`;
}

export function titleFromUiRoutePageKey(pageKey: string): string {
  return pageKey
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function resolveExtensionUiRouteMountId(route: ExtensionUiRouteCapability): string {
  return route.suggestedMountId?.trim() || DEFAULT_EXTENSION_UI_ROUTE_MOUNT_ID;
}

export function resolveExtensionUiRoutePattern(
  packageId: string,
  route: ExtensionUiRouteCapability,
): string {
  const pattern = route.suggestedRoutePattern?.trim();
  if (pattern) {
    return pattern.replace(/^\/+/, '');
  }
  return buildDefaultUiRoutePattern(packageId, route.pageKey);
}

export function buildExtensionUiRoutePreviewRoute(
  packageId: string,
  route: ExtensionUiRouteCapability,
): ExtensionUiRoutesPreviewRoute {
  return {
    pageKey: route.pageKey,
    title: titleFromUiRoutePageKey(route.pageKey),
    routePattern: resolveExtensionUiRoutePattern(packageId, route),
    mountId: resolveExtensionUiRouteMountId(route),
    loaderRef: buildPackagePageLoaderRef(packageId, route.pageKey),
    entry: route.entry,
  };
}

export function decodePackageUiModuleKey(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    return decodeURIComponent(trimmed).replace(/^\/+/, '');
  } catch {
    return trimmed.replace(/^\/+/, '');
  }
}

export function readPackageUiModuleKeyFromParams(
  params: Record<string, string | undefined>,
): string {
  const splat = params['0'] ?? '';
  const named = params.componentKey ?? '';
  return decodePackageUiModuleKey(splat || named);
}

function encodePackageUiModuleKeyPath(moduleKey: string): string {
  return decodePackageUiModuleKey(moduleKey)
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export function buildPackageUiModuleUrl(
  packageId: string,
  moduleKey: string,
  version?: string,
): string {
  const encodedKey = encodePackageUiModuleKeyPath(moduleKey);
  const base = `/api/packages/${encodeURIComponent(packageId)}/ui/${encodedKey}`;
  const trimmedVersion = version?.trim();
  if (!trimmedVersion) {
    return base;
  }
  return `${base}?v=${encodeURIComponent(trimmedVersion)}`;
}

export function parsePackagePageLoaderRef(loaderRef: string): { packageId: string; pageKey: string } | null {
  const separatorIndex = loaderRef.indexOf(':');
  if (separatorIndex <= 0 || separatorIndex >= loaderRef.length - 1) {
    return null;
  }
  return {
    packageId: loaderRef.slice(0, separatorIndex),
    pageKey: loaderRef.slice(separatorIndex + 1),
  };
}
