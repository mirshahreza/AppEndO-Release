import { APP_SHELL_LAYOUT_TEMPLATE } from '../appShellLayoutSeeds';
import { createInitialDesignerState } from '../state';
import type { DesignerNode, TemplateNodeSeed } from '../types';

export { APP_SHELL_LAYOUT_TEMPLATE };

export function createStateFromAppShellLayoutTemplate(): {
  state: ReturnType<typeof createInitialDesignerState>;
  preferredSelectedNodeId: string | null;
} {
  const baseState = createInitialDesignerState();
  const rootNodeId = baseState.document.rootNodeId;
  const now = new Date().toISOString();
  const nodes: Record<string, DesignerNode> = {
    ...baseState.document.nodes,
  };

  let seed = 0;
  const buildNode = (item: TemplateNodeSeed, parentId: string, order: number): string => {
    seed += 1;
    const nodeId = `app-shell-${item.type}-${Date.now()}-${seed}`;
    const children = (item.children ?? []).map((child, childIndex) => buildNode(child, nodeId, childIndex));

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

  const rootChildren = APP_SHELL_LAYOUT_TEMPLATE.map((item, index) => buildNode(item, rootNodeId, index));
  nodes[rootNodeId] = {
    ...nodes[rootNodeId],
    children: rootChildren,
  };

  return {
    state: {
      ...baseState,
      document: {
        ...baseState.document,
        nodes,
        metadata: {
          ...baseState.document.metadata,
          updatedAt: now,
          shellLayoutWidth: 'bounded',
          shellLayoutWidthUserControl: true,
          shellBoundedMaxWidth: 'lg',
          shellBoundedEdge: 'outset',
        },
      },
    },
    preferredSelectedNodeId: rootChildren[0] ?? null,
  };
}
