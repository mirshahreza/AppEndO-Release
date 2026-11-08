import type { NextFunction, Request, Response } from 'express';
import { isPluginRuntimeEnabled } from '../../domain/package-domain/installStateRepository';
import {
  isRemoteHubsPageKey,
  REMOTE_HUBS_PACKAGE_ID,
} from '../../../core/packages/remoteHubsPackage';
import { buildRemoteHubsNavigationPatch } from '../../../core/packages/remoteHubsPackagePackRecipe';

export function isRemoteHubsRuntimeEnabled(): boolean {
  return isPluginRuntimeEnabled(REMOTE_HUBS_PACKAGE_ID);
}

export function requireRemoteHubsPackage(_req: Request, res: Response, next: NextFunction): void {
  if (!isRemoteHubsRuntimeEnabled()) {
    res.status(404).json({ success: false, error: 'API route not found.' });
    return;
  }
  next();
}

/** Hide host-resident hub pages and bindings until the package is installed. */
export function filterRemoteHubsHostRowsUnlessInstalled<T extends { pageKey?: string }>(rows: T[]): T[] {
  if (isRemoteHubsRuntimeEnabled()) {
    return rows;
  }
  return rows.filter((row) => !row.pageKey || !isRemoteHubsPageKey(row.pageKey));
}

type RemoteHubsNavItem = {
  pageKey?: string;
  label?: string;
  description?: string;
  routePattern?: string;
  icon?: string;
  iconColor?: string;
  order?: number;
  separatorBefore?: boolean;
  children?: RemoteHubsNavItem[];
};

type RemoteHubsNavGroup = {
  heading?: string | null;
  icon?: string;
  order?: number;
  items: RemoteHubsNavItem[];
};

function filterRemoteHubsNavItems(items: RemoteHubsNavItem[]): RemoteHubsNavItem[] {
  return items.flatMap((item) => {
    if (item.pageKey && isRemoteHubsPageKey(item.pageKey)) {
      return [];
    }
    if (!item.children?.length) {
      return [item];
    }
    return [{ ...item, children: filterRemoteHubsNavItems(item.children) }];
  });
}

function collectNavPageKeys(items: RemoteHubsNavItem[]): Set<string> {
  const keys = new Set<string>();
  const walk = (rows: RemoteHubsNavItem[]) => {
    for (const item of rows) {
      if (item.pageKey) keys.add(item.pageKey);
      if (item.children?.length) walk(item.children);
    }
  };
  walk(items);
  return keys;
}

function relocateRemoteHubsItems<T extends RemoteHubsNavGroup>(groups: T[], heading: string): T[] {
  return groups.map((group) => {
    if ((group.heading ?? null) === heading) return group;
    const items = group.items.filter((item) => !item.pageKey || !isRemoteHubsPageKey(item.pageKey));
    return items.length === group.items.length ? group : { ...group, items };
  });
}

function normalizeHubRoutePattern(value: string | undefined): string {
  return String(value ?? '').trim().replace(/^\/+/, '');
}

/**
 * Overlay product chrome so stale applied ui_routes still show Sftp/SSH/RDP
 * under Remote Hubs at /studio/sftp|/ssh|/rdp.
 */
export function applyRemoteHubsChromeToPageModules<T extends { pageKey?: string; title?: string }>(
  rows: T[],
): T[] {
  if (!isRemoteHubsRuntimeEnabled()) {
    return rows;
  }

  const byKey = new Map(buildRemoteHubsNavigationPatch().items.map((item) => [item.pageKey, item]));
  return rows.map((row) => {
    const recipe = row.pageKey ? byKey.get(row.pageKey) : undefined;
    if (!recipe || row.title === recipe.label) {
      return row;
    }
    return { ...row, title: recipe.label };
  });
}

export function applyRemoteHubsChromeToBindings<T extends {
  pageKey?: string;
  mountId?: string;
  routePattern?: string;
  nav?: {
    label?: string;
    icon?: string;
    group?: string;
    order?: number;
    description?: string;
    color?: string;
  } | null;
}>(rows: T[]): T[] {
  if (!isRemoteHubsRuntimeEnabled()) {
    return rows;
  }

  const patch = buildRemoteHubsNavigationPatch();
  const byKey = new Map(patch.items.map((item) => [item.pageKey, item]));
  const rewritten = rows.map((row) => {
    const recipe = row.pageKey ? byKey.get(row.pageKey) : undefined;
    if (!recipe) {
      return row;
    }
    const nextNav = {
      ...(row.nav ?? {}),
      label: recipe.label,
      icon: recipe.icon,
      group: patch.heading,
      order: recipe.order,
      description: recipe.description,
      color: recipe.iconColor,
      ...(recipe.separatorBefore ? { separatorBefore: true } : {}),
    };
    return {
      ...row,
      routePattern: recipe.routePattern,
      nav: nextNav,
    };
  });

  const seen = new Set<string>();
  const unique: T[] = [];
  for (const row of rewritten) {
    const key = `${row.mountId ?? ''}::${normalizeHubRoutePattern(row.routePattern)}::${row.pageKey ?? ''}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(row);
  }
  return unique;
}

/**
 * Core / Portals compiles can wipe the Studio group while the package stays installed.
 * Re-apply the recipe in-memory so Sftp / SSH / RDP remain in the sidebar.
 */
export function ensureRemoteHubsNavigationIfInstalled<T extends { id?: string; groups: RemoteHubsNavGroup[] }>(
  manifest: T,
): T {
  if (!isRemoteHubsRuntimeEnabled()) {
    return manifest;
  }

  const patch = buildRemoteHubsNavigationPatch();
  if (String(manifest.id ?? '').trim() !== patch.navigationId) {
    return manifest;
  }
  const groupsAfterRelocate = relocateRemoteHubsItems(manifest.groups, patch.heading);
  const existingGroup = groupsAfterRelocate.find((group) => (group.heading ?? null) === patch.heading);
  const existingKeys = collectNavPageKeys(existingGroup?.items ?? []);
  const missingItems = patch.items.filter((item) => !existingKeys.has(item.pageKey));
  const relabeledItems = (existingGroup?.items ?? []).map((item) => {
    const recipe = patch.items.find((candidate) => candidate.pageKey === item.pageKey);
    if (!recipe) {
      return item;
    }
    return {
      ...item,
      label: recipe.label,
      description: recipe.description,
      routePattern: recipe.routePattern,
      icon: recipe.icon,
      iconColor: recipe.iconColor,
      order: recipe.order,
      ...(recipe.separatorBefore ? { separatorBefore: true } : {}),
    };
  });
  const hubItems = [...relabeledItems, ...missingItems].sort(
    (left, right) => (left.order ?? 999) - (right.order ?? 999),
  );
  if (existingGroup && missingItems.length === 0) {
    const groups = groupsAfterRelocate.map((group) => (
      (group.heading ?? null) === patch.heading
        ? { ...group, items: hubItems }
        : group
    ));
    return { ...manifest, groups };
  }

  const groups = existingGroup
    ? groupsAfterRelocate.map((group) => (
      (group.heading ?? null) === patch.heading
        ? {
          ...group,
          icon: patch.headingIcon ?? group.icon,
          order: patch.headingOrder ?? group.order,
          items: hubItems,
        }
        : group
    ))
    : [
      ...groupsAfterRelocate,
      {
        heading: patch.heading,
        icon: patch.headingIcon,
        order: patch.headingOrder,
        items: hubItems,
      },
    ];

  return {
    ...manifest,
    groups: [...groups].sort((left, right) => (left.order ?? 999) - (right.order ?? 999)),
  };
}

/** Studio nav is manifest-driven; leftover groups after a missed sidecar uninstall must not stay visible. */
export function filterRemoteHubsNavigationUnlessInstalled<T extends { groups: Array<{ items: RemoteHubsNavItem[] }> }>(
  manifest: T,
): T {
  if (isRemoteHubsRuntimeEnabled()) {
    return manifest;
  }
  return {
    ...manifest,
    groups: manifest.groups
      .map((group) => ({ ...group, items: filterRemoteHubsNavItems(group.items) }))
      .filter((group) => group.items.length > 0),
  };
}
