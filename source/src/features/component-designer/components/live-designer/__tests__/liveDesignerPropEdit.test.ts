import { describe, expect, it } from 'vitest';
import {
  createInitialDesignerState,
  designerReducer,
} from '../../../../../domain/component-designer/state';

describe('live designer prop edits', () => {
  it('applies set-node-prop into document nodes used by preview', () => {
    let state = createInitialDesignerState('live-prop-edit');
    const rootId = state.document.rootNodeId;

    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: rootId,
    });

    const nodeId = state.document.nodes[rootId]?.children[0];
    expect(nodeId).toBeTruthy();

    state = designerReducer(state, {
      type: 'select-node',
      nodeId: nodeId!,
    });

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: nodeId!,
      key: 'text',
      value: 'Updated live text',
    });

    expect(state.document.nodes[nodeId!]?.props.text).toBe('Updated live text');
    expect(state.isDirty).toBe(true);
    expect(state.history.past.length).toBeGreaterThan(0);
  });
});
