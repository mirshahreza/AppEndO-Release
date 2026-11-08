import type { TreeDropPosition } from '../../../shared/types/tree';
import type {
  NavigationManifest,
  NavigationManifestGroup,
  NavigationManifestItem,
} from '../../../shared/api/contracts/platform/navigation';
import {
  cloneNavigationManifest,
  getNavigationItemAtPath,
  navigationManifestToTreeRows,
  type NavigationTreeRow,
  type NavigationTreeSelection,
} from './navigationTreeRows';

type ItemInsertTarget = {
  groupIndex: number;
  parentItemPath: number[];
  index: number;
};

function indexRows(rows: NavigationTreeRow[]): Record<string, NavigationTreeRow> {
  const next: Record<string, NavigationTreeRow> = {};
  for (const row of rows) {
    next[row.id] = row;
  }
  return next;
}

export function isNavigationRowDescendantOf(
  rows: NavigationTreeRow[],
  descendantId: string,
  ancestorId: string,
): boolean {
  const rowsById = indexRows(rows);
  let cursor = rowsById[descendantId]?.parentId ?? null;

  while (cursor) {
    if (cursor === ancestorId) {
      return true;
    }
    cursor = rowsById[cursor]?.parentId ?? null;
  }

  return false;
}

function getChildrenList(
  group: NavigationManifestGroup,
  parentItemPath: number[],
): NavigationManifestItem[] | null {
  if (parentItemPath.length === 0) {
    return group.items;
  }

  const parent = getNavigationItemAtPath(group, parentItemPath);
  if (!parent || parent.type === 'separator') {
    return null;
  }

  if (!parent.children) {
    parent.children = [];
  }

  return parent.children;
}

function extractGroup(
  manifest: NavigationManifest,
  groupIndex: number,
): { manifest: NavigationManifest; group: NavigationManifestGroup } | null {
  const next = cloneNavigationManifest(manifest);
  if (groupIndex < 0 || groupIndex >= next.groups.length) {
    return null;
  }

  const [group] = next.groups.splice(groupIndex, 1);
  if (!group) {
    return null;
  }

  return { manifest: next, group };
}

function insertGroup(
  manifest: NavigationManifest,
  group: NavigationManifestGroup,
  atIndex: number,
): NavigationManifest {
  const next = cloneNavigationManifest(manifest);
  const index = Math.max(0, Math.min(atIndex, next.groups.length));
  next.groups.splice(index, 0, group);
  next.groups.forEach((entry, entryIndex) => {
    entry.order = entryIndex;
  });
  return next;
}

function extractItem(
  manifest: NavigationManifest,
  groupIndex: number,
  itemPath: number[],
): { manifest: NavigationManifest; item: NavigationManifestItem } | null {
  const next = cloneNavigationManifest(manifest);
  const group = next.groups[groupIndex];
  if (!group || itemPath.length === 0) {
    return null;
  }

  const parentItemPath = itemPath.slice(0, -1);
  const itemIndex = itemPath[itemPath.length - 1]!;
  const list = getChildrenList(group, parentItemPath);
  if (!list || itemIndex < 0 || itemIndex >= list.length) {
    return null;
  }

  const [item] = list.splice(itemIndex, 1);
  if (!item) {
    return null;
  }

  return { manifest: next, item };
}

function insertItem(
  manifest: NavigationManifest,
  target: ItemInsertTarget,
  item: NavigationManifestItem,
): NavigationManifest {
  const next = cloneNavigationManifest(manifest);
  const group = next.groups[target.groupIndex];
  if (!group) {
    return manifest;
  }

  const list = getChildrenList(group, target.parentItemPath);
  if (!list) {
    return manifest;
  }

  const index = Math.max(0, Math.min(target.index, list.length));
  list.splice(index, 0, item);
  return next;
}

function adjustPathForRemoval(path: number[], removedPath: number[]): number[] {
  if (path.length === 0 || removedPath.length === 0) {
    return path;
  }

  const removedParent = removedPath.slice(0, -1);
  const removedIndex = removedPath[removedPath.length - 1]!;

  if (removedParent.length === 0) {
    if (path[0]! > removedIndex) {
      return [path[0]! - 1, ...path.slice(1)];
    }
    return path;
  }

  if (
    path.length > removedParent.length
    && path.slice(0, removedParent.length).join('.') === removedParent.join('.')
    && path[removedParent.length]! > removedIndex
  ) {
    return [
      ...path.slice(0, removedParent.length),
      path[removedParent.length]! - 1,
      ...path.slice(removedParent.length + 1),
    ];
  }

  return path;
}

function resolveItemInsertTargetAfterRemoval(
  manifest: NavigationManifest,
  sourceItemPath: number[],
  targetRow: NavigationTreeRow,
  position: TreeDropPosition,
): ItemInsertTarget | null {
  if (targetRow.nodeKind === 'group') {
    const group = manifest.groups[targetRow.groupIndex];
    if (!group) {
      return null;
    }

    if (position === 'before') {
      return {
        groupIndex: targetRow.groupIndex,
        parentItemPath: [],
        index: 0,
      };
    }

    return {
      groupIndex: targetRow.groupIndex,
      parentItemPath: [],
      index: group.items.length,
    };
  }

  const adjustedTargetPath = adjustPathForRemoval(targetRow.itemPath, sourceItemPath);

  if (position === 'inside') {
    if (targetRow.nodeKind === 'separator') {
      return null;
    }

    const group = manifest.groups[targetRow.groupIndex];
    const parent = group ? getNavigationItemAtPath(group, adjustedTargetPath) : null;
    const childCount = parent?.type === 'separator'
      ? 0
      : parent?.children?.length ?? 0;

    return {
      groupIndex: targetRow.groupIndex,
      parentItemPath: adjustedTargetPath,
      index: childCount,
    };
  }

  const parentItemPath = adjustedTargetPath.slice(0, -1);
  const siblingIndex = adjustedTargetPath[adjustedTargetPath.length - 1]!;

  return {
    groupIndex: targetRow.groupIndex,
    parentItemPath,
    index: position === 'before' ? siblingIndex : siblingIndex + 1,
  };
}

export function canMoveNavigationNode(
  rows: NavigationTreeRow[],
  sourceId: string,
  targetId: string | null,
  position: TreeDropPosition,
): boolean {
  if (!targetId) {
    return false;
  }

  const rowsById = indexRows(rows);
  const sourceRow = rowsById[sourceId];
  const targetRow = rowsById[targetId];

  if (!sourceRow || !targetRow || sourceId === targetId) {
    return false;
  }

  if (isNavigationRowDescendantOf(rows, targetId, sourceId)) {
    return false;
  }

  if (sourceRow.nodeKind === 'group') {
    return targetRow.nodeKind === 'group' && position !== 'inside';
  }

  if (position === 'inside') {
    return targetRow.nodeKind === 'group' || targetRow.nodeKind === 'item';
  }

  if (targetRow.nodeKind === 'group') {
    return true;
  }

  const parentId = targetRow.parentId;
  if (!parentId) {
    return false;
  }

  if (parentId === sourceId) {
    return false;
  }

  return !isNavigationRowDescendantOf(rows, parentId, sourceId);
}

export function moveNavigationNode(
  manifest: NavigationManifest,
  sourceId: string,
  targetId: string,
  position: TreeDropPosition,
): { manifest: NavigationManifest; selection: NavigationTreeSelection | null } {
  const rows = navigationManifestToTreeRows(manifest);
  if (!canMoveNavigationNode(rows, sourceId, targetId, position)) {
    return { manifest, selection: null };
  }

  const rowsById = indexRows(rows);
  const sourceRow = rowsById[sourceId]!;
  const targetRow = rowsById[targetId]!;

  if (sourceRow.nodeKind === 'group') {
    const extracted = extractGroup(manifest, sourceRow.groupIndex);
    if (!extracted) {
      return { manifest, selection: null };
    }

    let insertIndex = position === 'before'
      ? targetRow.groupIndex
      : targetRow.groupIndex + 1;

    if (sourceRow.groupIndex < insertIndex) {
      insertIndex -= 1;
    }

    const next = insertGroup(extracted.manifest, extracted.group, insertIndex);
    return {
      manifest: next,
      selection: {
        groupIndex: insertIndex,
        itemPath: [],
        nodeKind: 'group',
      },
    };
  }

  const extracted = extractItem(manifest, sourceRow.groupIndex, sourceRow.itemPath);
  if (!extracted) {
    return { manifest, selection: null };
  }

  const insertTarget = resolveItemInsertTargetAfterRemoval(
    extracted.manifest,
    sourceRow.itemPath,
    targetRow,
    position,
  );
  if (!insertTarget) {
    return { manifest, selection: null };
  }

  const next = insertItem(extracted.manifest, insertTarget, extracted.item);
  return {
    manifest: next,
    selection: {
      groupIndex: insertTarget.groupIndex,
      itemPath: [...insertTarget.parentItemPath, insertTarget.index],
      nodeKind: sourceRow.nodeKind,
    },
  };
}

export function canMoveNavigationNodeStep(
  rows: NavigationTreeRow[],
  sourceId: string,
  direction: 'up' | 'down',
): boolean {
  const rowsById = indexRows(rows);
  const sourceRow = rowsById[sourceId];
  if (!sourceRow) {
    return false;
  }

  const siblings = rows.filter((row) => row.parentId === sourceRow.parentId);
  const siblingIndex = siblings.findIndex((row) => row.id === sourceId);
  if (siblingIndex === -1) {
    return false;
  }

  return direction === 'up' ? siblingIndex > 0 : siblingIndex < siblings.length - 1;
}

export function moveNavigationNodeStep(
  manifest: NavigationManifest,
  sourceId: string,
  direction: 'up' | 'down',
): { manifest: NavigationManifest; selection: NavigationTreeSelection | null } {
  const rows = navigationManifestToTreeRows(manifest);
  if (!canMoveNavigationNodeStep(rows, sourceId, direction)) {
    return { manifest, selection: null };
  }

  const rowsById = indexRows(rows);
  const sourceRow = rowsById[sourceId]!;
  const siblings = rows.filter((row) => row.parentId === sourceRow.parentId);
  const siblingIndex = siblings.findIndex((row) => row.id === sourceId);
  const targetSibling = direction === 'up'
    ? siblings[siblingIndex - 1]
    : siblings[siblingIndex + 1];

  if (!targetSibling) {
    return { manifest, selection: null };
  }

  return moveNavigationNode(
    manifest,
    sourceId,
    targetSibling.id,
    direction === 'up' ? 'before' : 'after',
  );
}

export function selectionIdFromRows(
  rows: NavigationTreeRow[],
  selection: NavigationTreeSelection,
): string | null {
  const row = rows.find(
    (entry) => entry.groupIndex === selection.groupIndex
      && entry.nodeKind === selection.nodeKind
      && entry.itemPath.join('.') === selection.itemPath.join('.'),
  );

  return row?.id ?? null;
}
