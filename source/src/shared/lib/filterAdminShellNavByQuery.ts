import type { AdminShellNavGroup, AdminShellNavItem } from '../../layouts/adminShell/types';

const normalizeNavSearchQuery = (query: string): string => query.trim().toLowerCase();

const navTextMatches = (value: string | undefined, needle: string): boolean =>
  Boolean(value?.toLowerCase().includes(needle));

const navItemMatchesQuery = (item: AdminShellNavItem, needle: string): boolean => {
  if (item.type === 'separator') {
    return false;
  }

  return navTextMatches(item.label, needle) || navTextMatches(item.description, needle);
};

const flattenMatchingNavItems = (
  items: AdminShellNavItem[],
  needle: string,
  includeAll: boolean,
): AdminShellNavItem[] => {
  const flattened: AdminShellNavItem[] = [];

  for (const item of items) {
    if (item.type === 'separator' || !item.path) {
      if (item.children?.length) {
        flattened.push(...flattenMatchingNavItems(item.children, needle, includeAll));
      }
      continue;
    }

    const selfMatches = includeAll || navItemMatchesQuery(item, needle);
    if (selfMatches) {
      flattened.push({ ...item, children: undefined });
    }

    if (item.children?.length) {
      flattened.push(...flattenMatchingNavItems(item.children, needle, includeAll));
    }
  }

  return flattened;
};

const dedupeNavItemsByPath = (items: AdminShellNavItem[]): AdminShellNavItem[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.path ?? '';
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

/** Search hits are a single ungrouped list — no section headings or nested parents. */
export function filterAdminShellNavByQuery(
  groups: AdminShellNavGroup[],
  query: string,
): AdminShellNavGroup[] {
  const needle = normalizeNavSearchQuery(query);
  if (!needle) {
    return groups;
  }

  const items = dedupeNavItemsByPath(groups.flatMap((group) => (
    flattenMatchingNavItems(
      group.items,
      needle,
      navTextMatches(group.heading ?? undefined, needle),
    )
  )));

  if (items.length === 0) {
    return [];
  }

  return [{ heading: null, items }];
}

export function splitNavGroupsAtSearchSlot(groups: AdminShellNavGroup[]): {
  beforeSearch: AdminShellNavGroup[];
  afterSearch: AdminShellNavGroup[];
} {
  let splitIndex = 0;
  while (splitIndex < groups.length && !groups[splitIndex]!.heading?.trim()) {
    splitIndex += 1;
  }

  return {
    beforeSearch: groups.slice(0, splitIndex),
    afterSearch: groups.slice(splitIndex),
  };
}
