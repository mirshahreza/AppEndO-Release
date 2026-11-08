import { describe, expect, it } from 'vitest';
import { createInitialDesignerState, designerReducer } from '../../../domain/component-designer/state';
import { applyLiveDesignerRemoveNode } from '../components/live-designer/liveDesignerDocumentOps';

describe('applyLiveDesignerRemoveNode', () => {
  it('removes a child node and keeps the root', () => {
    let state = createInitialDesignerState('demo');
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: state.document.rootNodeId,
      index: 0,
    });
    const childId = state.document.nodes[state.document.rootNodeId]?.children[0];
    expect(childId).toBeTruthy();

    const next = applyLiveDesignerRemoveNode(
      {
        document: state.document,
        bindingDefinitions: state.bindingDefinitions,
      },
      childId!,
    );

    expect(next).not.toBeNull();
    expect(next!.document.nodes[childId!]).toBeUndefined();
    expect(next!.document.nodes[state.document.rootNodeId]).toBeTruthy();
    expect(next!.document.nodes[state.document.rootNodeId]?.children).not.toContain(childId);
  });

  it('refuses to remove the root node', () => {
    const state = createInitialDesignerState('demo');
    const next = applyLiveDesignerRemoveNode(
      {
        document: state.document,
        bindingDefinitions: state.bindingDefinitions,
      },
      state.document.rootNodeId,
    );
    expect(next).toBeNull();
  });
});

describe('live designer undo path', () => {
  it('restores a removed node via undo', () => {
    let state = createInitialDesignerState('demo');
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: state.document.rootNodeId,
      index: 0,
    });
    const childId = state.document.nodes[state.document.rootNodeId]?.children[0];
    expect(childId).toBeTruthy();

    state = designerReducer(state, { type: 'remove-node', nodeId: childId! });
    expect(state.document.nodes[childId!]).toBeUndefined();
    expect(state.history.past.length).toBeGreaterThan(0);

    state = designerReducer(state, { type: 'undo' });
    expect(state.document.nodes[childId!]).toBeTruthy();
  });
});
