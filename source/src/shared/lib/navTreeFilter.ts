import type { NavigationItemRegion } from '../api/contracts/platform/navigation';
import type { AdminShellNavGroup, AdminShellNavItem } from '../../layouts/adminShell/types';

export type ShellNavRegionId = 'top' | 'side' | 'footer';

function resolveItemRegion(item: AdminShellNavItem): NavigationItemRegion {
  return item.region === 'sidebar-footer' || item.region === 'header'
    ? item.region
    : 'side';
}

function hasNavigableItem(items: AdminShellNavItem[]): boolean {
  return items.some((item) => item.type !== 'separator' && Boolean(item.path));
}

function collectItemsForRegion(
  items: AdminShellNavItem[],
  region: NavigationItemRegion,
  mode: 'tree' | 'flat',
): AdminShellNavItem[] {
  const collected: AdminShellNavItem[] = [];

  for (const item of items) {
    if (item.type === 'separator') {
      if (mode === 'tree') {
        collected.push(item);
      }
      continue;
    }

    const childMatches = item.children?.length
      ? collectItemsForRegion(item.children, region, mode)
      : [];

    if (resolveItemRegion(item) !== region) {
      collected.push(...childMatches);
      continue;
    }

    if (mode === 'flat') {
      if (item.path) {
        collected.push({ ...item, children: undefined });
      }
      collected.push(...childMatches);
      continue;
    }

    if (childMatches.length > 0) {
      collected.push({ ...item, children: childMatches });
      continue;
    }

    if (item.children?.length) {
      collected.push({ ...item, children: undefined });
      continue;
    }

    collected.push(item);
  }

  return collected;
}

/** Model B (default): one tree filtered per designer shell region slot. */
export function filterNavGroupsForRegion(
  region: ShellNavRegionId,
  groups: AdminShellNavGroup[],
): AdminShellNavGroup[] {
  const sideGroups = filterNavGroupsByItemRegion(groups, 'side');
  if (region === 'side') {
    return sideGroups;
  }

  const flatItems = sideGroups.flatMap((group) => group.items).filter(
    (item) => item.type !== 'separator' && Boolean(item.path),
  );

  if (flatItems.length === 0) {
    return [];
  }

  return [{ heading: null, items: flatItems }];
}

/** Split the live Studio/App nav tree by item `region` (default `side`). */
export function filterNavGroupsByItemRegion(
  groups: AdminShellNavGroup[],
  region: NavigationItemRegion,
): AdminShellNavGroup[] {
  if (region === 'side') {
    return groups
      .map((group) => ({
        ...group,
        items: collectItemsForRegion(group.items, region, 'tree'),
      }))
      .filter((group) => hasNavigableItem(group.items));
  }

  const items = groups.flatMap((group) => collectItemsForRegion(group.items, region, 'flat'));
  if (!hasNavigableItem(items)) {
    return [];
  }

  return [{ heading: null, items }];
}

export function splitShellNavByItemRegion(groups: AdminShellNavGroup[]): {
  sideGroups: AdminShellNavGroup[];
  sidebarFooterItems: AdminShellNavItem[];
  headerItems: AdminShellNavItem[];
} {
  return {
    sideGroups: filterNavGroupsByItemRegion(groups, 'side'),
    sidebarFooterItems: filterNavGroupsByItemRegion(groups, 'sidebar-footer')
      .flatMap((group) => group.items)
      .filter((item) => item.type !== 'separator' && Boolean(item.path)),
    headerItems: filterNavGroupsByItemRegion(groups, 'header')
      .flatMap((group) => group.items)
      .filter((item) => item.type !== 'separator' && Boolean(item.path)),
  };
}

function isNavigableNavItem(item: AdminShellNavItem): boolean {
  return item.type !== 'separator' && Boolean(item.path);
}

/** Pull leading ungrouped links (e.g. Home) out of the tree for the icon strip. */
export function splitLeadingUngroupedNavGroups(groups: AdminShellNavGroup[]): {
  leadingItems: AdminShellNavItem[];
  restGroups: AdminShellNavGroup[];
} {
  const leadingItems: AdminShellNavItem[] = [];
  let index = 0;
  while (index < groups.length && !groups[index]!.heading?.trim()) {
    leadingItems.push(...groups[index]!.items.filter(isNavigableNavItem));
    index += 1;
  }
  return {
    leadingItems,
    restGroups: groups.slice(index),
  };
}

/** Studio/App sidebar: icon-strip items at the top, remaining groups in the tree. */
export function composeStudioSidebarNav(groups: AdminShellNavGroup[]): {
  treeGroups: AdminShellNavGroup[];
  quickNavItems: AdminShellNavItem[];
  headerItems: AdminShellNavItem[];
} {
  const split = splitShellNavByItemRegion(groups);
  const { leadingItems, restGroups } = splitLeadingUngroupedNavGroups(split.sideGroups);
  return {
    treeGroups: restGroups,
    quickNavItems: [...leadingItems, ...split.sidebarFooterItems],
    headerItems: split.headerItems,
  };
}

export function partitionSidebarQuickNavItems(items: AdminShellNavItem[]): {
  sidebarTopItems: AdminShellNavItem[];
  sidebarFooterItems: AdminShellNavItem[];
} {
  const sidebarTopItems: AdminShellNavItem[] = [];
  const sidebarFooterItems: AdminShellNavItem[] = [];
  for (const item of items) {
    if (item.region === 'sidebar-footer') {
      sidebarFooterItems.push(item);
    } else {
      sidebarTopItems.push(item);
    }
  }
  return { sidebarTopItems, sidebarFooterItems };
}
