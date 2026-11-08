import { describe, expect, it } from 'vitest';
import { createInitialDesignerState, designerReducer } from '../state';
import { alignNodesInFlexParent, isFlexContainerNode, resolveSharedFlexParentId } from '../nodeFlexAlign';

describe('nodeFlexAlign', () => {
  it('detects flex containers from className and twFlexDirection', () => {
    const flexRow = designerReducer(createInitialDesignerState(), {
      type: 'insert-palette-item',
      itemId: 'layout.flex-row',
      parentId: createInitialDesignerState().document.rootNodeId,
    });
    const flexId = flexRow.document.nodes[flexRow.document.rootNodeId].children[0];
    expect(isFlexContainerNode(flexRow.document.nodes[flexId])).toBe(true);
  });

  it('aligns multiple siblings in a flex row parent', () => {
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
      itemId: 'heroui.button-solid',
      parentId: flexId,
    });
    const firstButton = state.document.nodes[flexId].children[0];

    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.button-solid',
      parentId: flexId,
    });
    const secondButton = state.document.nodes[flexId].children[1];

    expect(resolveSharedFlexParentId(state.document, [firstButton, secondButton])).toBe(flexId);

    const aligned = designerReducer(state, {
      type: 'align-nodes-in-flex',
      nodeIds: [firstButton, secondButton],
      alignment: 'center',
    });

    expect(aligned.document.nodes[firstButton].props.className).toContain('self-center');
    expect(aligned.document.nodes[secondButton].props.className).toContain('self-center');
    expect(alignNodesInFlexParent(state.document, [firstButton, secondButton], 'start')).not.toBeNull();
  });

  it('supports shift-click multi-select via select-node additive', () => {
    let state = createInitialDesignerState();
    const rootId = state.document.rootNodeId;

    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: rootId,
    });
    const first = state.document.nodes[rootId].children[0];

    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: rootId,
    });
    const second = state.document.nodes[rootId].children[1];

    state = designerReducer(state, { type: 'select-node', nodeId: first });
    expect(state.selectedNodeIds).toEqual([first]);

    state = designerReducer(state, { type: 'select-node', nodeId: second, additive: true });
    expect(state.selectedNodeIds).toEqual([first, second]);
    expect(state.selectedNodeId).toBe(second);
  });
});
