import type { OrgChartTreeNode } from '../types';

/** Root plus its direct children are visible; deeper branches start collapsed. */
export const ORG_CHART_DEFAULT_OPEN_DEPTH = 1;

export const orgChartNodeHasChildren = (
  node: OrgChartTreeNode | null | undefined,
): boolean => Boolean(node && ((node.children?.length ?? 0) > 0 || node.hasChildren));

/** Clone tree, dropping children of collapsed nodes (node itself remains). */
export const pruneOrgChartCollapsed = (
  node: OrgChartTreeNode,
  collapsedIds: ReadonlySet<string>,
  skipSelf = true,
): OrgChartTreeNode => {
  if (!skipSelf && collapsedIds.has(node.id)) {
    return {
      ...node,
      children: undefined,
    };
  }
  const children = node.children ?? [];
  if (children.length === 0) return node;
  return {
    ...node,
    children: children.map((child) => pruneOrgChartCollapsed(child, collapsedIds, false)),
  };
};

/**
 * Ids that should start collapsed so only `openDepth` levels are visible.
 * Depth 0 is the view root (always open). Depth 1 is the first child row.
 */
export const collectOrgChartCollapsedBeyondDepth = (
  node: OrgChartTreeNode,
  openDepth: number = ORG_CHART_DEFAULT_OPEN_DEPTH,
  depth = 0,
): string[] => {
  const ids: string[] = [];
  if (orgChartNodeHasChildren(node) && depth >= openDepth) {
    ids.push(node.id);
  }
  for (const child of node.children ?? []) {
    ids.push(...collectOrgChartCollapsedBeyondDepth(child, openDepth, depth + 1));
  }
  return ids;
};

export const findOrgChartNodeDepth = (
  root: OrgChartTreeNode,
  targetId: string,
  depth = 0,
): number | null => {
  if (root.id === targetId) return depth;
  for (const child of root.children ?? []) {
    const found = findOrgChartNodeDepth(child, targetId, depth + 1);
    if (found != null) return found;
  }
  return null;
};

export const countOrgChartDirectChildren = (node: OrgChartTreeNode | null | undefined): number => (
  node?.children?.length ?? 0
);

/** Ancestor chain from `root` through `targetId` (inclusive), or null if not in tree. */
export const findOrgChartPathToNode = (
  root: OrgChartTreeNode,
  targetId: string,
  trail: OrgChartTreeNode[] = [],
): OrgChartTreeNode[] | null => {
  const nextTrail = [...trail, root];
  if (root.id === targetId) return nextTrail;
  for (const child of root.children ?? []) {
    const found = findOrgChartPathToNode(child, targetId, nextTrail);
    if (found) return found;
  }
  return null;
};

/**
 * Ancestors form a single branch (no siblings). The focused target keeps its loaded subtree.
 */
export const buildOrgChartPathOnlyTree = (path: OrgChartTreeNode[]): OrgChartTreeNode => {
  if (path.length === 0) {
    throw new Error('Path must include at least one node.');
  }
  const target = path[path.length - 1];
  let node: OrgChartTreeNode = {
    ...target,
    hasChildren: orgChartNodeHasChildren(target),
  };
  for (let index = path.length - 2; index >= 0; index -= 1) {
    const ancestor = path[index];
    node = {
      ...ancestor,
      children: [node],
      hasChildren: true,
    };
  }
  return node;
};
