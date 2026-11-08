import { describe, expect, it } from 'vitest';
import { createInitialDesignerState, designerReducer } from '../state';
import { extractDesignerNodeSubtree } from '../nodeSubtreeClone';

describe('duplicate-node / paste-node-subtree', () => {
  it('duplicates a node as the next sibling', () => {
    let state = createInitialDesignerState('dup');
    const rootId = state.document.rootNodeId;
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: rootId,
    });
    const originalId = state.document.nodes[rootId]!.children[0]!;

    state = designerReducer(state, { type: 'duplicate-node', nodeId: originalId });

    const children = state.document.nodes[rootId]!.children;
    expect(children).toHaveLength(2);
    expect(children[0]).toBe(originalId);
    expect(children[1]).not.toBe(originalId);
    expect(state.selectedNodeId).toBe(children[1]);
    expect(state.document.nodes[children[1]!]!.type).toBe(state.document.nodes[originalId]!.type);
  });

  it('pastes a copied subtree under a target parent', () => {
    let state = createInitialDesignerState('paste');
    const rootId = state.document.rootNodeId;
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.container',
      parentId: rootId,
    });
    const containerId = state.document.nodes[rootId]!.children[0]!;
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: containerId,
    });
    const textId = state.document.nodes[containerId]!.children[0]!;

    const snapshot = extractDesignerNodeSubtree(state.document.nodes, textId);
    expect(snapshot).not.toBeNull();

    state = designerReducer(state, {
      type: 'paste-node-subtree',
      sourceNodes: snapshot!.nodes,
      sourceRootId: snapshot!.rootNodeId,
      targetParentId: containerId,
    });

    expect(state.document.nodes[containerId]!.children).toHaveLength(2);
    expect(state.selectedNodeId).not.toBe(textId);
    expect(state.document.nodes[state.selectedNodeId!]!.type).toBe('text');
  });

  it('does not duplicate the root', () => {
    let state = createInitialDesignerState('root-dup');
    const before = Object.keys(state.document.nodes).length;
    state = designerReducer(state, {
      type: 'duplicate-node',
      nodeId: state.document.rootNodeId,
    });
    expect(Object.keys(state.document.nodes)).toHaveLength(before);
  });
});
