import type { AdminShellNavGroup, AdminShellNavItem } from '../../layouts/adminShell/types';
import {
  tierMeetsMinViewport,
  type MinViewport,
  type ViewportTier,
} from './viewportTokens';

function itemMinViewport(item: AdminShellNavItem): MinViewport | undefined {
  if (item.type === 'separator' || !item.path) {
    return undefined;
  }
  return item.minViewport;
}

function filterNavItems(items: AdminShellNavItem[], tier: ViewportTier): AdminShellNavItem[] {
  const filtered: AdminShellNavItem[] = [];

  for (const item of items) {
    if (item.type === 'separator') {
      if (filtered.length > 0 && filtered[filtered.length - 1]?.type !== 'separator') {
        filtered.push(item);
      }
      continue;
    }

    const minViewport = itemMinViewport(item);
    if (!tierMeetsMinViewport(tier, minViewport)) {
      continue;
    }

    if (item.children?.length) {
      const children = filterNavItems(item.children, tier);
      filtered.push(children.length > 0 ? { ...item, children } : { ...item, children: undefined });
      continue;
    }

    filtered.push(item);
  }

  while (filtered.length > 0 && filtered[filtered.length - 1]?.type === 'separator') {
    filtered.pop();
  }

  return filtered;
}

export function filterAdminShellNavByViewport(
  groups: AdminShellNavGroup[],
  tier: ViewportTier,
): AdminShellNavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: filterNavItems(group.items, tier),
    }))
    .filter((group) => group.items.some((item) => item.type !== 'separator' && Boolean(item.path)));
}
