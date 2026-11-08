import type { DesignerNode } from './types';

const createClonedNodeId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `node-${crypto.randomUUID()}`;
  }
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export type ClonedDesignerSubtree = {
  nodes: Record<string, DesignerNode>;
  rootNodeId: string;
};

/**
 * Deep-clone a designer node subtree with fresh ids.
 * The cloned root's `parentId` / `order` are set for the insertion target.
 */
export function cloneDesignerNodeSubtree(
  sourceNodes: Record<string, DesignerNode>,
  sourceRootId: string,
  targetParentId: string,
  targetOrder: number,
): ClonedDesignerSubtree | null {
  const sourceRoot = sourceNodes[sourceRootId];
  if (!sourceRoot) {
    return null;
  }

  const idMap = new Map<string, string>();
  const walkCollect = (nodeId: string) => {
    if (idMap.has(nodeId)) {
      return;
    }
    const node = sourceNodes[nodeId];
    if (!node) {
      return;
    }
    idMap.set(nodeId, createClonedNodeId());
    for (const childId of node.children) {
      walkCollect(childId);
    }
  };
  walkCollect(sourceRootId);

  const mappedRootId = idMap.get(sourceRootId);
  if (!mappedRootId) {
    return null;
  }

  const nodes: Record<string, DesignerNode> = {};
  for (const [oldId, newId] of idMap) {
    const source = sourceNodes[oldId];
    if (!source) {
      continue;
    }
    const isRoot = oldId === sourceRootId;
    nodes[newId] = {
      id: newId,
      type: source.type,
      parentId: isRoot ? targetParentId : (source.parentId ? (idMap.get(source.parentId) ?? null) : null),
      order: isRoot ? targetOrder : source.order,
      props: structuredClone(source.props),
      layout: structuredClone(source.layout),
      binding: structuredClone(source.binding),
      ...(source.componentRef ? { componentRef: structuredClone(source.componentRef) } : {}),
      children: source.children
        .map((childId) => idMap.get(childId))
        .filter((childId): childId is string => Boolean(childId)),
    };
  }

  return {
    nodes,
    rootNodeId: mappedRootId,
  };
}

/** Extract a portable subtree snapshot (original ids) for clipboard copy. */
export function extractDesignerNodeSubtree(
  sourceNodes: Record<string, DesignerNode>,
  sourceRootId: string,
): { rootNodeId: string; nodes: Record<string, DesignerNode> } | null {
  const root = sourceNodes[sourceRootId];
  if (!root) {
    return null;
  }

  const nodes: Record<string, DesignerNode> = {};
  const stack = [sourceRootId];
  while (stack.length > 0) {
    const currentId = stack.pop()!;
    if (nodes[currentId]) {
      continue;
    }
    const node = sourceNodes[currentId];
    if (!node) {
      continue;
    }
    nodes[currentId] = structuredClone(node);
    for (const childId of node.children) {
      stack.push(childId);
    }
  }

  return { rootNodeId: sourceRootId, nodes };
}
