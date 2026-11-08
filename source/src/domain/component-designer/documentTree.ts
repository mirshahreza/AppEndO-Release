import type { DesignerDocument, DesignerNode } from './types';

export const isDescendantNode = (
  nodes: Record<string, DesignerNode>,
  nodeId: string,
  potentialAncestorId: string,
): boolean => {
  let currentParentId = nodes[nodeId]?.parentId;
  while (currentParentId) {
    if (currentParentId === potentialAncestorId) {
      return true;
    }
    currentParentId = nodes[currentParentId]?.parentId ?? null;
  }
  return false;
};

export const normalizeChildrenOrder = (
  nodes: Record<string, DesignerNode>,
  parentId: string,
): Record<string, DesignerNode> => {
  const parent = nodes[parentId];
  if (!parent) {
    return nodes;
  }

  const nextNodes = { ...nodes };
  parent.children.forEach((childId, order) => {
    const child = nextNodes[childId];
    if (!child) {
      return;
    }

    nextNodes[childId] = {
      ...child,
      order,
      parentId,
    };
  });

  return nextNodes;
};

const resolveEffectiveParentId = (
  nodes: Record<string, DesignerNode>,
  rootNodeId: string,
  node: DesignerNode,
): string => {
  const parentId = node.parentId;
  if (!parentId || !nodes[parentId] || parentId === node.id) {
    return rootNodeId;
  }

  if (isDescendantNode(nodes, parentId, node.id)) {
    return rootNodeId;
  }

  return parentId;
};

const compareSiblingOrder = (
  left: DesignerNode,
  right: DesignerNode,
  leftIndexHint: number,
  rightIndexHint: number,
): number => {
  if (left.order !== right.order) {
    return left.order - right.order;
  }

  if (leftIndexHint !== rightIndexHint) {
    return leftIndexHint - rightIndexHint;
  }

  return left.id.localeCompare(right.id);
};

export const resolveSiblingInsertIndex = (
  parent: DesignerNode,
  nodeId: string,
  position: 'before' | 'after',
): number => {
  const siblingIndex = parent.children.indexOf(nodeId);
  if (siblingIndex < 0) {
    return position === 'before' ? 0 : parent.children.length;
  }

  return position === 'before' ? siblingIndex : siblingIndex + 1;
};

export const normalizeDesignerDocument = (document: DesignerDocument): DesignerDocument => {
  const rootNodeId = document.rootNodeId;
  let nodes: Record<string, DesignerNode> = structuredClone(document.nodes);

  if (!nodes[rootNodeId]) {
    nodes[rootNodeId] = {
      id: rootNodeId,
      type: 'root',
      parentId: null,
      order: 0,
      props: {},
      layout: {},
      binding: {},
      children: [],
    };
  }

  const childIndexHints = new Map<string, number>();
  for (const node of Object.values(nodes)) {
    node.children.forEach((childId, index) => {
      if (!childIndexHints.has(childId)) {
        childIndexHints.set(childId, index);
      }
    });
  }

  const siblingsByParent = new Map<string, DesignerNode[]>();
  for (const node of Object.values(nodes)) {
    if (node.id === rootNodeId) {
      continue;
    }

    const effectiveParentId = resolveEffectiveParentId(nodes, rootNodeId, node);
    const normalizedNode: DesignerNode = {
      ...node,
      parentId: effectiveParentId,
      children: node.children.filter((childId) => childId !== node.id && Boolean(nodes[childId])),
    };
    nodes[node.id] = normalizedNode;

    const siblings = siblingsByParent.get(effectiveParentId) ?? [];
    siblings.push(normalizedNode);
    siblingsByParent.set(effectiveParentId, siblings);
  }

  for (const [parentId, siblings] of siblingsByParent.entries()) {
    const parent = nodes[parentId];
    if (!parent) {
      continue;
    }

    siblings.sort((left, right) => compareSiblingOrder(
      left,
      right,
      childIndexHints.get(left.id) ?? Number.MAX_SAFE_INTEGER,
      childIndexHints.get(right.id) ?? Number.MAX_SAFE_INTEGER,
    ));

    nodes[parentId] = {
      ...parent,
      children: siblings.map((sibling) => sibling.id),
    };
  }

  nodes[rootNodeId] = {
    ...nodes[rootNodeId],
    parentId: null,
    children: (siblingsByParent.get(rootNodeId) ?? []).sort((left, right) => compareSiblingOrder(
      left,
      right,
      childIndexHints.get(left.id) ?? Number.MAX_SAFE_INTEGER,
      childIndexHints.get(right.id) ?? Number.MAX_SAFE_INTEGER,
    )).map((sibling) => sibling.id),
  };

  for (const node of Object.values(nodes)) {
    if (node.children.length === 0) {
      continue;
    }

    nodes[node.id] = {
      ...node,
      children: node.children.filter((childId) => {
        const child = nodes[childId];
        return Boolean(child) && child.parentId === node.id;
      }),
    };
  }

  for (const nodeId of Object.keys(nodes)) {
    nodes = normalizeChildrenOrder(nodes, nodeId);
  }

  return {
    ...document,
    nodes,
  };
};
