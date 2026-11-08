import {
  createInitialDesignerState,
  designerReducer,
} from '../../../../domain/component-designer/state';
import type {
  DesignerBindingDefinitions,
  DesignerDocument,
} from '../../../../domain/component-designer/types';

export type LiveDesignerEditableSnapshot = {
  document: DesignerDocument;
  bindingDefinitions: DesignerBindingDefinitions;
};

/** Apply classic designer `remove-node` to a live-designer document snapshot. */
export function applyLiveDesignerRemoveNode(
  snapshot: LiveDesignerEditableSnapshot,
  nodeId: string,
): LiveDesignerEditableSnapshot | null {
  const trimmed = nodeId.trim();
  if (!trimmed || trimmed === snapshot.document.rootNodeId) {
    return null;
  }

  if (!snapshot.document.nodes[trimmed]) {
    return null;
  }

  let state = createInitialDesignerState(snapshot.document.name);
  state = designerReducer(state, {
    type: 'hydrate-document',
    document: snapshot.document,
    bindingDefinitions: snapshot.bindingDefinitions,
  });

  const next = designerReducer(state, { type: 'remove-node', nodeId: trimmed });
  if (next.document.nodes[trimmed]) {
    return null;
  }

  return {
    document: next.document,
    bindingDefinitions: next.bindingDefinitions,
  };
}
