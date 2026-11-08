import type { BaseTreeGridRow } from '../../../components/ui/BaseTreeGrid';
import type {
  NavigationManifest,
  NavigationManifestGroup,
  NavigationManifestItem,
} from '../../../shared/api/contracts/platform/navigation';

export type NavigationTreeNodeKind = 'group' | 'item' | 'separator';

export type NavigationTreeRow = BaseTreeGridRow & {
  nodeKind: NavigationTreeNodeKind;
  groupIndex: number;
  itemPath: number[];
  label: string;
  cultureId?: string | null;
  portalSegment?: string | null;
  pageKey?: string;
  routePattern?: string;
  icon?: string;
  labelColor?: string;
  iconColor?: string;
};

export type NavigationTreeSelection = {
  groupIndex: number;
  itemPath: number[];
  nodeKind: NavigationTreeNodeKind;
};

function itemLabel(item: NavigationManifestItem): string {
  if (item.type === 'separator') {
    return '— separator —';
  }
  return item.label?.trim() || item.pageKey?.trim() || '(untitled)';
}

function appendItemRows(
  rows: NavigationTreeRow[],
  item: NavigationManifestItem,
  parentId: string,
  groupIndex: number,
  itemPath: number[],
  depth: number,
): void {
  const rowId = `g${groupIndex}:${itemPath.join('.')}`;
  const nodeKind: NavigationTreeNodeKind = item.type === 'separator' ? 'separator' : 'item';
  const children = item.type === 'separator' ? [] : item.children ?? [];
  rows.push({
    id: rowId,
    parentId,
    depth,
    hasChildren: children.length > 0,
    nodeKind,
    groupIndex,
    itemPath,
    label: itemLabel(item),
    cultureId: item.cultureId,
    portalSegment: item.portalSegment,
    pageKey: item.pageKey,
    routePattern: item.routePattern,
    icon: item.icon,
    labelColor: item.labelColor,
    iconColor: item.iconColor,
  });

  children.forEach((child, childIndex) => {
    appendItemRows(rows, child, rowId, groupIndex, [...itemPath, childIndex], depth + 1);
  });
}

export function navigationManifestToTreeRows(manifest: NavigationManifest): NavigationTreeRow[] {
  const rows: NavigationTreeRow[] = [];

  manifest.groups.forEach((group, groupIndex) => {
    const groupId = `g${groupIndex}`;
    rows.push({
      id: groupId,
      parentId: null,
      depth: 0,
      hasChildren: group.items.length > 0,
      nodeKind: 'group',
      groupIndex,
      itemPath: [],
      label: group.heading?.trim() || '(ungrouped)',
    });

    group.items.forEach((item, itemIndex) => {
      appendItemRows(rows, item, groupId, groupIndex, [itemIndex], 1);
    });
  });

  return rows;
}

export function cloneNavigationManifest(manifest: NavigationManifest): NavigationManifest {
  return structuredClone(manifest);
}

export function getNavigationItemAtPath(
  group: NavigationManifestGroup,
  itemPath: number[],
): NavigationManifestItem | null {
  if (itemPath.length === 0) {
    return null;
  }

  let current: NavigationManifestItem | undefined = group.items[itemPath[0]!];
  for (let index = 1; index < itemPath.length; index += 1) {
    current = current?.children?.[itemPath[index]!];
  }

  return current ?? null;
}

export function updateNavigationItemAtPath(
  manifest: NavigationManifest,
  groupIndex: number,
  itemPath: number[],
  updater: (item: NavigationManifestItem) => NavigationManifestItem,
): NavigationManifest {
  const next = cloneNavigationManifest(manifest);
  const group = next.groups[groupIndex];
  if (!group || itemPath.length === 0) {
    return next;
  }

  if (itemPath.length === 1) {
    const current = group.items[itemPath[0]!];
    if (current) {
      group.items[itemPath[0]!] = updater(current);
    }
    return next;
  }

  let parent = group.items[itemPath[0]!];
  for (let index = 1; index < itemPath.length - 1; index += 1) {
    parent = parent?.children?.[itemPath[index]!] as NavigationManifestItem;
  }

  const leafIndex = itemPath[itemPath.length - 1]!;
  if (parent?.children?.[leafIndex]) {
    parent.children[leafIndex] = updater(parent.children[leafIndex]!);
  }

  return next;
}

export function removeNavigationItemAtPath(
  manifest: NavigationManifest,
  groupIndex: number,
  itemPath: number[],
): NavigationManifest {
  const next = cloneNavigationManifest(manifest);
  const group = next.groups[groupIndex];
  if (!group || itemPath.length === 0) {
    return next;
  }

  if (itemPath.length === 1) {
    group.items.splice(itemPath[0]!, 1);
    return next;
  }

  let parent = group.items[itemPath[0]!];
  for (let index = 1; index < itemPath.length - 1; index += 1) {
    parent = parent?.children?.[itemPath[index]!] as NavigationManifestItem;
  }

  parent?.children?.splice(itemPath[itemPath.length - 1]!, 1);
  return next;
}

export function addNavigationGroup(manifest: NavigationManifest, heading: string | null): NavigationManifest {
  const next = cloneNavigationManifest(manifest);
  next.groups.push({
    heading,
    order: next.groups.length,
    items: [],
  });
  return next;
}

export function ensureUngroupedGroup(manifest: NavigationManifest): {
  manifest: NavigationManifest;
  groupIndex: number;
} {
  const existingIndex = manifest.groups.findIndex(
    (group) => group.heading == null || group.heading.trim() === '',
  );

  if (existingIndex !== -1) {
    return { manifest, groupIndex: existingIndex };
  }

  const next = addNavigationGroup(manifest, null);
  return { manifest: next, groupIndex: next.groups.length - 1 };
}

export function addNavigationItemAtSelection(
  manifest: NavigationManifest,
  selection: NavigationTreeSelection | null,
): NavigationManifest {
  if (selection?.nodeKind === 'group') {
    return addNavigationItem(manifest, selection.groupIndex, []);
  }

  const { manifest: withGroup, groupIndex } = ensureUngroupedGroup(manifest);
  return addNavigationItem(withGroup, groupIndex, []);
}

export function addNavigationItem(
  manifest: NavigationManifest,
  groupIndex: number,
  parentItemPath: number[],
): NavigationManifest {
  const next = cloneNavigationManifest(manifest);
  const group = next.groups[groupIndex];
  if (!group) {
    return next;
  }

  const newItem: NavigationManifestItem = {
    label: 'New item',
    pageKey: '',
    routePattern: '',
  };

  if (parentItemPath.length === 0) {
    group.items.push(newItem);
    return next;
  }

  const parent = getNavigationItemAtPath(group, parentItemPath);
  if (!parent || parent.type === 'separator') {
    return next;
  }

  parent.children = [...(parent.children ?? []), newItem];
  return next;
}

export function removeNavigationGroup(manifest: NavigationManifest, groupIndex: number): NavigationManifest {
  const next = cloneNavigationManifest(manifest);
  next.groups.splice(groupIndex, 1);
  return next;
}

export function updateNavigationGroupHeading(
  manifest: NavigationManifest,
  groupIndex: number,
  heading: string | null,
): NavigationManifest {
  const next = cloneNavigationManifest(manifest);
  const group = next.groups[groupIndex];
  if (group) {
    group.heading = heading?.trim() || null;
  }
  return next;
}

export function updateNavigationGroupCollapsedLabel(
  manifest: NavigationManifest,
  groupIndex: number,
  collapsedLabel: string | null,
): NavigationManifest {
  const next = cloneNavigationManifest(manifest);
  const group = next.groups[groupIndex];
  if (group) {
    const trimmed = collapsedLabel?.trim();
    group.collapsedLabel = trimmed || undefined;
  }
  return next;
}

export function selectionFromRow(row: NavigationTreeRow): NavigationTreeSelection {
  return {
    groupIndex: row.groupIndex,
    itemPath: row.itemPath,
    nodeKind: row.nodeKind,
  };
}

export function rowMatchesSelection(row: NavigationTreeRow, selection: NavigationTreeSelection | null): boolean {
  if (!selection) {
    return false;
  }

  return row.groupIndex === selection.groupIndex
    && row.nodeKind === selection.nodeKind
    && row.itemPath.join('.') === selection.itemPath.join('.');
}
