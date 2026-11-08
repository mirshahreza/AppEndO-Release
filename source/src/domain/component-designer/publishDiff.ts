import type { DesignerDocument } from './types';

export type DesignerPublishDiffSummary = {
  nodesAdded: number;
  nodesRemoved: number;
  nodesChanged: number;
  propsChanged: number;
};

const countProps = (props: Record<string, unknown> | undefined): number =>
  Object.keys(props ?? {}).length;

const propsFingerprint = (props: Record<string, unknown> | undefined): string =>
  JSON.stringify(props ?? {});

export function computeDesignerPublishDiff(
  current: DesignerDocument,
  published: DesignerDocument | null,
): DesignerPublishDiffSummary {
  if (!published) {
    const nodeCount = Object.keys(current.nodes).length;
    return {
      nodesAdded: nodeCount,
      nodesRemoved: 0,
      nodesChanged: 0,
      propsChanged: countProps(current.nodes[current.rootNodeId]?.props as Record<string, unknown>),
    };
  }

  const currentIds = new Set(Object.keys(current.nodes));
  const publishedIds = new Set(Object.keys(published.nodes));

  let nodesAdded = 0;
  let nodesRemoved = 0;
  let nodesChanged = 0;
  let propsChanged = 0;

  for (const nodeId of currentIds) {
    if (!publishedIds.has(nodeId)) {
      nodesAdded += 1;
      continue;
    }

    const currentNode = current.nodes[nodeId];
    const publishedNode = published.nodes[nodeId];
    if (!currentNode || !publishedNode) {
      continue;
    }

    const typeChanged = currentNode.type !== publishedNode.type;
    const orderChanged = currentNode.order !== publishedNode.order;
    const childrenChanged = JSON.stringify(currentNode.children) !== JSON.stringify(publishedNode.children);
    const currentProps = currentNode.props as Record<string, unknown>;
    const publishedProps = publishedNode.props as Record<string, unknown>;
    const propDelta = propsFingerprint(currentProps) !== propsFingerprint(publishedProps);

    if (propDelta) {
      propsChanged += 1;
    }

    if (typeChanged || orderChanged || childrenChanged || propDelta) {
      nodesChanged += 1;
    }
  }

  for (const nodeId of publishedIds) {
    if (!currentIds.has(nodeId)) {
      nodesRemoved += 1;
    }
  }

  return { nodesAdded, nodesRemoved, nodesChanged, propsChanged };
}
