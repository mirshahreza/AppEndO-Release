import { describe, expect, it } from 'vitest';
import { collectDesignerSelectAllNodeIds } from '../selectAllNodes';
import { createInitialDesignerState, designerReducer } from '../state';

describe('collectDesignerSelectAllNodeIds', () => {
  it('returns only direct children of the document root', () => {
    let state = createInitialDesignerState();
    const rootId = state.document.rootNodeId;

    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'layout.flex-row',
      parentId: rootId,
    });
    const flexId = state.document.nodes[rootId].children[0];

    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: flexId,
    });
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: rootId,
    });

    const ids = collectDesignerSelectAllNodeIds(state.document);
    expect(ids).toEqual(state.document.nodes[rootId].children);
    expect(ids).toHaveLength(2);
    expect(ids).not.toContain(rootId);
    expect(ids.every((id) => state.document.nodes[id]?.parentId === rootId)).toBe(true);
  });
});

describe('select-nodes', () => {
  it('replaces the selection set and ignores missing ids', () => {
    let state = createInitialDesignerState();
    const rootId = state.document.rootNodeId;

    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: rootId,
    });
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: rootId,
    });
    const [first, second] = state.document.nodes[rootId].children;

    state = designerReducer(state, {
      type: 'select-nodes',
      nodeIds: [first, 'missing-node', second, first],
    });

    expect(state.selectedNodeIds).toEqual([first, second]);
    expect(state.selectedNodeId).toBe(second);
  });

  it('clears selection when no canvas objects exist', () => {
    const initial = designerReducer(createInitialDesignerState(), {
      type: 'select-node',
      nodeId: 'root',
    });
    const cleared = designerReducer(initial, {
      type: 'select-nodes',
      nodeIds: collectDesignerSelectAllNodeIds(initial.document),
    });

    expect(cleared.selectedNodeId).toBeNull();
    expect(cleared.selectedNodeIds).toEqual([]);
  });
});

describe('remove-nodes', () => {
  it('deletes every selected canvas object in one undo step', () => {
    let state = createInitialDesignerState();
    const rootId = state.document.rootNodeId;
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: rootId,
    });
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: rootId,
    });
    const [first, second] = state.document.nodes[rootId].children;
    state = designerReducer(state, { type: 'select-nodes', nodeIds: [first, second] });

    const removed = designerReducer(state, { type: 'remove-nodes', nodeIds: [first, second] });

    expect(removed.document.nodes[first]).toBeUndefined();
    expect(removed.document.nodes[second]).toBeUndefined();
    expect(removed.document.nodes[rootId].children).toEqual([]);
    expect(removed.selectedNodeId).toBe(rootId);
    expect(removed.history.past.length).toBe(state.history.past.length + 1);
  });

  it('skips the document root and nested descendants of another selected node', () => {
    let state = createInitialDesignerState();
    const rootId = state.document.rootNodeId;
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.container',
      parentId: rootId,
    });
    const containerId = state.document.nodes[rootId].children[0];
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: containerId,
    });
    const childId = state.document.nodes[containerId].children[0];

    const removed = designerReducer(state, {
      type: 'remove-nodes',
      nodeIds: [rootId, containerId, childId],
    });

    expect(removed.document.nodes[containerId]).toBeUndefined();
    expect(removed.document.nodes[childId]).toBeUndefined();
    expect(removed.document.nodes[rootId]).toBeDefined();
    expect(removed.document.nodes[rootId].children).toEqual([]);
  });
});
