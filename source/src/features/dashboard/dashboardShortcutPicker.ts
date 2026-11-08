import type { AuthUserLike } from '../../app/guards/roleAccess';
import type { PlatformRouteBinding, PlatformRuntimeConfig } from '../../shared/api/contracts/platform/types';
import {
  createDashboardHomeShortcut,
  isDashboardHomePageKey,
  type DashboardHomeShortcut,
} from '../../shared/lib/dashboardHomeShortcuts';
import { NESTED_EDITOR_EDIT_SEGMENT } from '../../shared/routing/nestedEditorDeepLink';
import type { AdminShellNavGroup, AdminShellNavItem } from '../../layouts/adminShell/types';
import { resolveStudioPagePath } from './constants';

export const DASHBOARD_SHORTCUT_OTHER_GROUP = 'Other pages';

/** Sidebar entry id for free-form Studio paths and external URLs (not tied to a page module). */
export const DASHBOARD_SHORTCUT_FREE_FORM_ID = '__custom_path__';

export type DashboardShortcutItemMode = 'edit' | 'remainder';

export type DashboardShortcutQueryPair = {
  key: string;
  value: string;
};

export type DashboardShortcutTarget = {
  id: string;
  pageKey?: string;
  label: string;
  description?: string;
  path: string;
  icon?: string;
  group: string | null;
  itemMode: DashboardShortcutItemMode | null;
};

const EDIT_SPLAT_PATTERN = /(^|\/)edit\/\*$/;

export const resolveDashboardShortcutItemMode = (
  bindings: readonly PlatformRouteBinding[],
  pageKey: string | undefined,
): DashboardShortcutItemMode | null => {
  if (!pageKey?.trim()) {
    return null;
  }

  const pageBindings = bindings.filter((binding) => binding.enabled && binding.pageKey === pageKey);
  if (pageBindings.some((binding) => EDIT_SPLAT_PATTERN.test(binding.routePattern))) {
    return 'edit';
  }
  if (pageBindings.some((binding) => binding.routePattern.endsWith('/*'))) {
    return 'remainder';
  }
  return null;
};

const sanitizeShortcutPathSegment = (raw: string): string =>
  raw.trim().replace(/^\/+|\/+$/g, '').replace(/[?#].*$/, '');

export const composeDashboardShortcutPath = (input: {
  basePath: string;
  itemMode: DashboardShortcutItemMode | null;
  itemSlug: string;
  queryPairs: readonly DashboardShortcutQueryPair[];
}): string => {
  let path = input.basePath.replace(/\/+$/, '') || '/';
  const slug = sanitizeShortcutPathSegment(input.itemSlug);
  if (slug) {
    if (input.itemMode === 'edit') {
      const recordKey = slug.replace(new RegExp(`^${NESTED_EDITOR_EDIT_SEGMENT}/`), '');
      if (recordKey) {
        path = `${path}/${NESTED_EDITOR_EDIT_SEGMENT}/${recordKey}`;
      }
    } else {
      path = `${path}/${slug}`;
    }
  }

  const params = new URLSearchParams();
  for (const pair of input.queryPairs) {
    const key = pair.key.trim();
    if (key) {
      params.set(key, pair.value);
    }
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
};

const collectNavigableNavItems = (
  items: readonly AdminShellNavItem[],
): AdminShellNavItem[] => {
  const result: AdminShellNavItem[] = [];
  for (const item of items) {
    if (item.type !== 'separator' && item.path && !isDashboardHomePageKey(item.pageKey)) {
      result.push(item);
    }
    if (item.children?.length) {
      result.push(...collectNavigableNavItems(item.children));
    }
  }
  return result;
};

const toTargetId = (pageKey: string | undefined, path: string): string =>
  pageKey?.trim() ? `${pageKey}:${path}` : path;

export const listDashboardShortcutTargets = (input: {
  navGroups: readonly AdminShellNavGroup[];
  config: PlatformRuntimeConfig;
  mountId: string;
  pathPrefix: string;
  currentUser: AuthUserLike;
}): DashboardShortcutTarget[] => {
  const bindings = input.config.bindings;
  const seenPageKeys = new Set<string>();
  const seenPaths = new Set<string>();
  const targets: DashboardShortcutTarget[] = [];

  for (const group of input.navGroups) {
    for (const item of collectNavigableNavItems(group.items)) {
      const path = item.path?.trim();
      if (!path || seenPaths.has(path)) {
        continue;
      }
      seenPaths.add(path);
      if (item.pageKey?.trim()) {
        seenPageKeys.add(item.pageKey.trim());
      }
      targets.push({
        id: toTargetId(item.pageKey, path),
        pageKey: item.pageKey,
        label: item.label?.trim() || item.pageKey || path,
        description: item.description,
        path,
        icon: item.icon,
        group: group.heading,
        itemMode: resolveDashboardShortcutItemMode(bindings, item.pageKey),
      });
    }
  }

  for (const pageModule of input.config.pageModules) {
    if (!pageModule.enabled || isDashboardHomePageKey(pageModule.pageKey) || seenPageKeys.has(pageModule.pageKey)) {
      continue;
    }
    const path = resolveStudioPagePath(
      input.config,
      input.mountId,
      input.pathPrefix,
      input.currentUser,
      pageModule.pageKey,
    );
    if (!path || seenPaths.has(path)) {
      continue;
    }
    seenPaths.add(path);
    seenPageKeys.add(pageModule.pageKey);
    targets.push({
      id: toTargetId(pageModule.pageKey, path),
      pageKey: pageModule.pageKey,
      label: pageModule.title.trim() || pageModule.pageKey,
      path,
      group: DASHBOARD_SHORTCUT_OTHER_GROUP,
      itemMode: resolveDashboardShortcutItemMode(bindings, pageModule.pageKey),
    });
  }

  return targets;
};

export const filterDashboardShortcutTargets = (
  targets: readonly DashboardShortcutTarget[],
  search: string,
): DashboardShortcutTarget[] => {
  const needle = search.trim().toLowerCase();
  if (!needle) {
    return [...targets];
  }

  return targets.filter((target) => (
    target.label.toLowerCase().includes(needle)
    || target.path.toLowerCase().includes(needle)
    || (target.pageKey?.toLowerCase().includes(needle) ?? false)
    || (target.description?.toLowerCase().includes(needle) ?? false)
    || (target.group?.toLowerCase().includes(needle) ?? false)
  ));
};

export const createDashboardShortcutFromTarget = (
  target: DashboardShortcutTarget,
  input: {
    label: string;
    icon: string;
    itemSlug: string;
    queryPairs: readonly DashboardShortcutQueryPair[];
  },
): DashboardHomeShortcut | null => createDashboardHomeShortcut({
  kind: 'custom',
  pageKey: target.pageKey,
  path: composeDashboardShortcutPath({
    basePath: target.path,
    itemMode: target.itemMode,
    itemSlug: input.itemSlug,
    queryPairs: input.queryPairs,
  }),
  label: input.label,
  icon: input.icon,
});

export const createDashboardShortcutFromFreePath = (input: {
  label: string;
  icon: string;
  path: string;
}): DashboardHomeShortcut | null => createDashboardHomeShortcut({
  kind: 'custom',
  path: input.path,
  label: input.label,
  icon: input.icon,
});
