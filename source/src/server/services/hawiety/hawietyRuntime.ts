import type { NextFunction, Request, Response } from 'express';
import { isPluginRuntimeEnabled } from '../../domain/package-domain/installStateRepository';
import {
  HAWIETY_PACKAGE_ID,
  HAWIETY_PORTAL_SEGMENT,
  isHawietyCorePageLoaderRef,
  isHawietyHostPageKey,
  isHawietyMountPathPrefix,
  isHawietyRoutePattern,
} from '../../../core/packages/hawietyPackage';

export function isHawietyRuntimeEnabled(): boolean {
  return isPluginRuntimeEnabled(HAWIETY_PACKAGE_ID);
}

export function requireHawietyPackage(_req: Request, res: Response, next: NextFunction): void {
  if (!isHawietyRuntimeEnabled()) {
    res.status(404).json({ success: false, error: 'API route not found.' });
    return;
  }
  next();
}

type HawietyHostRow = {
  pageKey?: string;
  routePattern?: string;
  loaderRef?: string;
  id?: string;
  mountId?: string;
  pathPrefix?: string;
  navigationRef?: string;
  shellKey?: string;
};

export function isHawietyHostPlatformRow(row: HawietyHostRow): boolean {
  if (isHawietyHostPageKey(row.pageKey)) return true;
  if (isHawietyCorePageLoaderRef(row.loaderRef)) return true;
  if (isHawietyRoutePattern(row.routePattern)) return true;
  if (row.id === HAWIETY_PORTAL_SEGMENT || row.navigationRef === HAWIETY_PORTAL_SEGMENT) return true;
  if (row.mountId === HAWIETY_PORTAL_SEGMENT) return true;
  if (isHawietyMountPathPrefix(row.pathPrefix)) return true;
  if (row.shellKey === HAWIETY_PORTAL_SEGMENT) return true;
  return false;
}

/** Hide host-resident Hawiety registry rows until the package is installed. */
export function filterHawietyHostRowsUnlessInstalled<T extends HawietyHostRow>(rows: T[]): T[] {
  if (isHawietyRuntimeEnabled()) {
    return rows;
  }
  return rows.filter((row) => !isHawietyHostPlatformRow(row));
}

type HawietyNavItem = {
  pageKey?: string;
  routePattern?: string;
  portalSegment?: string;
  children?: HawietyNavItem[];
};

type HawietyNavigationManifest = {
  id?: string;
  portalSegment?: string;
  groups?: Array<{ items: HawietyNavItem[] }>;
};

function filterHawietyNavItems(items: HawietyNavItem[]): HawietyNavItem[] {
  return items.flatMap((item) => {
    if (item.portalSegment === HAWIETY_PORTAL_SEGMENT) return [];
    if (isHawietyHostPageKey(item.pageKey)) return [];
    if (isHawietyRoutePattern(item.routePattern)) return [];
    if (!item.children?.length) return [item];
    const children = filterHawietyNavItems(item.children);
    if (children.length === 0) return [];
    return [{ ...item, children }];
  });
}

export function filterHawietyNavigationUnlessInstalled<T extends HawietyNavigationManifest>(manifest: T): T | null {
  if (isHawietyRuntimeEnabled()) {
    return manifest;
  }
  if (manifest.id === HAWIETY_PORTAL_SEGMENT || manifest.portalSegment === HAWIETY_PORTAL_SEGMENT) {
    return null;
  }
  if (!manifest.groups?.length) {
    return manifest;
  }
  const groups = manifest.groups
    .map((group) => ({ ...group, items: filterHawietyNavItems(group.items) }))
    .filter((group) => group.items.length > 0);
  if (groups.length === 0) {
    return null;
  }
  return { ...manifest, groups };
}

export function filterHawietyNavigationsUnlessInstalled<T extends HawietyNavigationManifest>(navigations: T[]): T[] {
  if (isHawietyRuntimeEnabled()) {
    return navigations;
  }
  return navigations
    .map((nav) => filterHawietyNavigationUnlessInstalled(nav))
    .filter((nav): nav is T => nav !== null);
}
