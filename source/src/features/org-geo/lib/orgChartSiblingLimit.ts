import type { OrgChartTreeNode } from '../types';

export const ORG_CHART_OVERFLOW_NODE_PREFIX = '__appendo_chart_sibling_overflow__:';

export const ORG_CHART_MAX_SIBLINGS_PER_PARENT = 40;

export const isOrgChartSiblingOverflowNodeId = (id: string): boolean => (
  id.startsWith(ORG_CHART_OVERFLOW_NODE_PREFIX)
);

export const orgChartOverflowParentId = (overflowNodeId: string): string | null => {
  if (!isOrgChartSiblingOverflowNodeId(overflowNodeId)) return null;
  return overflowNodeId.slice(ORG_CHART_OVERFLOW_NODE_PREFIX.length) || null;
};

export type SiblingLimitContext = {
  maxSiblings: number;
  /** Parents for which every loaded child should render. */
  expandedParentIds: ReadonlySet<string>;
  /** Always keep these node ids visible (selection + path isolate). */
  pinnedNodeIds: ReadonlySet<string>;
};

const overflowNode = (parentId: string, hiddenCount: number): OrgChartTreeNode => ({
  id: `${ORG_CHART_OVERFLOW_NODE_PREFIX}${parentId}`,
  label: `+${hiddenCount} more`,
  isActive: true,
  hasChildren: false,
});

const pickVisibleChildren = (
  children: OrgChartTreeNode[],
  parentId: string,
  ctx: SiblingLimitContext,
): OrgChartTreeNode[] => {
  if (children.length <= ctx.maxSiblings) return children;
  if (ctx.expandedParentIds.has(parentId)) return children;

  const pinned = children.filter((child) => ctx.pinnedNodeIds.has(child.id));
  const unpinned = children.filter((child) => !ctx.pinnedNodeIds.has(child.id));
  const slots = Math.max(1, ctx.maxSiblings - 1);
  const roomForUnpinned = Math.max(0, slots - pinned.length);
  const visibleUnpinned = unpinned.slice(0, roomForUnpinned);
  const visible = [...pinned, ...visibleUnpinned];
  const hiddenCount = children.length - visible.length;
  if (hiddenCount <= 0) return visible;
  return [...visible, overflowNode(parentId, hiddenCount)];
};

export const limitOrgChartSiblingFanout = (
  node: OrgChartTreeNode,
  ctx: SiblingLimitContext,
): OrgChartTreeNode => {
  if (isOrgChartSiblingOverflowNodeId(node.id)) return node;
  const children = node.children ?? [];
  if (children.length === 0) return node;
  const limited = pickVisibleChildren(children, node.id, ctx).map((child) => (
    isOrgChartSiblingOverflowNodeId(child.id)
      ? child
      : limitOrgChartSiblingFanout(child, ctx)
  ));
  return {
    ...node,
    children: limited,
    hasChildren: Boolean(node.hasChildren) || children.length > 0,
  };
};

export const collectOrgChartAncestorIds = (
  root: OrgChartTreeNode,
  targetId: string | null | undefined,
): ReadonlySet<string> => {
  if (!targetId) return new Set();
  const path: string[] = [];
  const walk = (node: OrgChartTreeNode, trail: string[]): boolean => {
    const nextTrail = [...trail, node.id];
    if (node.id === targetId) {
      path.push(...nextTrail);
      return true;
    }
    for (const child of node.children ?? []) {
      if (walk(child, nextTrail)) return true;
    }
    return false;
  };
  walk(root, []);
  return new Set(path);
};
