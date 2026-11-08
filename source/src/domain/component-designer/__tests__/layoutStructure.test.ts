import { describe, expect, it } from 'vitest';
import { LAYOUT_GRID_ROWS_PROP } from '../layoutPaletteConstants';
import { isLayoutColumnSlotNode, resolveLayoutGridColumnCount, resolveLayoutGridRowCount } from '../layoutGridSlots';
import { resolveLayoutStructureHint } from '../layoutStructure';
import { createInitialDesignerState, designerReducer } from '../state';

const insertItem = (itemId: string) => {
  const initial = createInitialDesignerState();
  const next = designerReducer(initial, {
    type: 'insert-palette-item',
    itemId,
    parentId: initial.document.rootNodeId,
  });
  const nodeId = next.document.nodes[next.document.rootNodeId].children[0]!;
  return { state: next, nodeId };
};

describe('layout structure tracks', () => {
  it('inserts split pane with two pane slots', () => {
    const { state, nodeId } = insertItem('layout.split-pane');
    const node = state.document.nodes[nodeId];
    expect(node.children).toHaveLength(2);
    for (const childId of node.children) {
      expect(isLayoutColumnSlotNode(state.document.nodes[childId])).toBe(true);
    }

    const hint = resolveLayoutStructureHint(state.document.nodes, nodeId);
    expect(hint).toMatchObject({
      kind: 'split-pane',
      hostNodeId: nodeId,
      canAddColumn: true,
      canAddRow: true,
      addColumnLabel: 'Add column',
      addRowLabel: 'Split vertically',
      columnCount: 2,
    });
  });

  it('adds a split pane along the primary axis from Properties', () => {
    const { state, nodeId } = insertItem('layout.split-pane');
    const next = designerReducer(state, {
      type: 'add-layout-track',
      nodeId,
      axis: 'column',
    });
    expect(next.document.nodes[nodeId].children).toHaveLength(3);
    expect(next.selectedNodeId).toBe(nodeId);
  });

  it('adds a pane after the hovered slot', () => {
    const { state, nodeId } = insertItem('layout.split-pane');
    const firstPaneId = state.document.nodes[nodeId].children[0]!;
    const next = designerReducer(state, {
      type: 'add-layout-track',
      nodeId: firstPaneId,
      axis: 'column',
      place: 'after',
    });
    expect(next.document.nodes[nodeId].children).toHaveLength(3);
    expect(next.document.nodes[nodeId].children[1]).not.toBe(state.document.nodes[nodeId].children[1]);
    expect(isLayoutColumnSlotNode(next.document.nodes[next.document.nodes[nodeId].children[1]!])).toBe(true);
  });

  it('nests an opposite split pane when adding a row to a horizontal split', () => {
    const { state, nodeId } = insertItem('layout.split-pane');
    const firstPaneId = state.document.nodes[nodeId].children[0]!;
    const next = designerReducer(state, {
      type: 'add-layout-track',
      nodeId: firstPaneId,
      axis: 'row',
    });
    expect(next.document.nodes[nodeId].children).toHaveLength(2);
    const nestedId = next.document.nodes[firstPaneId].children[0]!;
    const nested = next.document.nodes[nestedId];
    expect(nested.props._designerPaletteItemId).toBe('layout.split-pane');
    expect(nested.props.direction).toBe('vertical');
    expect(nested.children).toHaveLength(2);
  });

  it('treats a hovered slot as the split-pane host', () => {
    const { state, nodeId } = insertItem('layout.split-pane');
    const slotId = state.document.nodes[nodeId].children[0]!;
    const hint = resolveLayoutStructureHint(state.document.nodes, slotId);
    expect(hint?.hostNodeId).toBe(nodeId);
    expect(hint?.hoveredChildId).toBe(slotId);
  });

  it('walks nested canvas hover up to the layout host', () => {
    let { state, nodeId } = insertItem('layout.split-pane');
    const slotId = state.document.nodes[nodeId].children[0]!;
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: slotId,
    });
    const textId = state.document.nodes[slotId].children[0]!;
    expect(resolveLayoutStructureHint(state.document.nodes, textId)).toBeNull();

    const hoverHint = resolveLayoutStructureHint(state.document.nodes, textId, { includeNestedPieces: true });
    expect(hoverHint?.hostNodeId).toBe(nodeId);
    expect(hoverHint?.hoveredChildId).toBe(slotId);
  });

  it('adds a grid column and a grid row', () => {
    const { state, nodeId } = insertItem('layout.grid-2');
    const withColumn = designerReducer(state, {
      type: 'add-layout-track',
      nodeId,
      axis: 'column',
    });
    const afterColumn = withColumn.document.nodes[nodeId];
    expect(resolveLayoutGridColumnCount(afterColumn)).toBe(3);
    expect(afterColumn.children).toHaveLength(3);

    const withRow = designerReducer(withColumn, {
      type: 'add-layout-track',
      nodeId,
      axis: 'row',
    });
    const afterRow = withRow.document.nodes[nodeId];
    expect(afterRow.props[LAYOUT_GRID_ROWS_PROP]).toBe(2);
    expect(resolveLayoutGridRowCount(afterRow)).toBe(2);
    expect(afterRow.children).toHaveLength(6);
  });

  it('adds a slot to a flex row', () => {
    const { state, nodeId } = insertItem('layout.flex-row');
    expect(state.document.nodes[nodeId].children).toHaveLength(0);
    const next = designerReducer(state, {
      type: 'add-layout-track',
      nodeId,
      axis: 'column',
    });
    expect(next.document.nodes[nodeId].children).toHaveLength(1);
    expect(isLayoutColumnSlotNode(next.document.nodes[next.document.nodes[nodeId].children[0]!])).toBe(true);
  });
});
