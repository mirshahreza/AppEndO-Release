import { createInitialDesignerState } from './state';
import type { DesignerNode } from './types';
import type { TemplateNodeSeed } from './types';

const BUILT_IN_COMPONENT_EPOCH = '2024-01-01T00:00:00.000Z';

export const createStableStateFromTemplateSeeds = (
  template: TemplateNodeSeed[],
  componentId: string,
  componentName: string,
): { state: ReturnType<typeof createInitialDesignerState>; preferredSelectedNodeId: string | null } => {
  const baseState = createInitialDesignerState();
  if (template.length === 0) {
    return {
      state: {
        ...baseState,
        document: {
          ...baseState.document,
          id: componentId,
          name: componentName,
          metadata: {
            createdAt: BUILT_IN_COMPONENT_EPOCH,
            updatedAt: BUILT_IN_COMPONENT_EPOCH,
          },
        },
      },
      preferredSelectedNodeId: null,
    };
  }

  const rootNodeId = baseState.document.rootNodeId;
  const nodes: Record<string, DesignerNode> = {
    ...baseState.document.nodes,
  };

  let nodeCounter = 0;
  const buildNode = (item: TemplateNodeSeed, parentId: string, order: number, pathPrefix: string): string => {
    nodeCounter += 1;
    const nodeId = `${componentId}-node-${pathPrefix}-${nodeCounter}`;
    const children = (item.children ?? []).map((child, childIndex) => buildNode(child, nodeId, childIndex, `${pathPrefix}-${childIndex}`));

    nodes[nodeId] = {
      id: nodeId,
      type: item.type,
      parentId,
      order,
      props: { ...(item.props ?? {}) },
      layout: {},
      binding: {},
      children,
    };

    return nodeId;
  };

  const rootChildren = template.map((item, index) => buildNode(item, rootNodeId, index, String(index)));
  nodes[rootNodeId] = {
    ...nodes[rootNodeId],
    children: rootChildren,
  };

  return {
    state: {
      ...baseState,
      document: {
        ...baseState.document,
        id: componentId,
        name: componentName,
        nodes,
        metadata: {
          createdAt: BUILT_IN_COMPONENT_EPOCH,
          updatedAt: BUILT_IN_COMPONENT_EPOCH,
        },
      },
    },
    preferredSelectedNodeId: rootChildren[0] ?? null,
  };
};
