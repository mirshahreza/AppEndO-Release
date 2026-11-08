import { describe, expect, it } from 'vitest';
import {
  getPaletteItemById,
  isCompoundPaletteItemId,
  LAYOUT_COLUMN_SLOT_CLASSNAME,
  LAYOUT_COLUMNS_PALETTE_ITEM_ID,
} from '../catalog';
import {
  LAYOUT_GRID_2_PALETTE_ITEM_ID,
  LAYOUT_GRID_3_PALETTE_ITEM_ID,
  resolveLayoutGridColumnCount,
  syncLayoutGridSlotChildren,
} from '../layoutGridSlots';
import { applyTailwindUtility } from '../tailwindClasses';
import { resolveTailwindInspectorFields } from '../inspectorRegistry';
import { createInitialDesignerState, designerReducer } from '../state';

describe('layout grid palette items', () => {
  it('registers grid-2 and grid-3 as compound layout items', () => {
    expect(isCompoundPaletteItemId(LAYOUT_GRID_2_PALETTE_ITEM_ID)).toBe(true);
    expect(isCompoundPaletteItemId(LAYOUT_GRID_3_PALETTE_ITEM_ID)).toBe(true);
    expect(getPaletteItemById(LAYOUT_GRID_2_PALETTE_ITEM_ID)?.defaultProps.className).toContain('grid-cols-2');
    expect(getPaletteItemById(LAYOUT_GRID_3_PALETTE_ITEM_ID)?.defaultProps.className).toContain('grid-cols-3');
  });

  it('inserts grid-2 with two column slot children', () => {
    const initial = createInitialDesignerState();
    const next = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: LAYOUT_GRID_2_PALETTE_ITEM_ID,
      parentId: initial.document.rootNodeId,
    });

    const parentId = next.document.nodes[next.document.rootNodeId].children[0];
    const parent = next.document.nodes[parentId];

    expect(parent.props._designerPaletteItemId).toBe(LAYOUT_GRID_2_PALETTE_ITEM_ID);
    expect(parent.children).toHaveLength(2);
    expect(resolveLayoutGridColumnCount(parent)).toBe(2);

    for (const childId of parent.children) {
      const child = next.document.nodes[childId];
      expect(child.props.className).toBe(LAYOUT_COLUMN_SLOT_CLASSNAME);
      expect(child.props._designerLayoutSlot).toBe(true);
    }
  });

  it('inserts grid-3 with three column slot children', () => {
    const initial = createInitialDesignerState();
    const next = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: LAYOUT_GRID_3_PALETTE_ITEM_ID,
      parentId: initial.document.rootNodeId,
    });

    const parentId = next.document.nodes[next.document.rootNodeId].children[0];
    const parent = next.document.nodes[parentId];

    expect(parent.children).toHaveLength(3);
    expect(resolveLayoutGridColumnCount(parent)).toBe(3);
  });

  it('adds and removes empty layout slots when grid columns change in properties', () => {
    const initial = createInitialDesignerState();
    const inserted = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: LAYOUT_GRID_2_PALETTE_ITEM_ID,
      parentId: initial.document.rootNodeId,
    });
    const parentId = inserted.document.nodes[inserted.document.rootNodeId].children[0];
    const parent = inserted.document.nodes[parentId];
    const gridField = resolveTailwindInspectorFields(LAYOUT_GRID_2_PALETTE_ITEM_ID)[1];
    const withFourCols = applyTailwindUtility(String(parent.props.className), gridField, 'grid-cols-4');

    const expanded = designerReducer(inserted, {
      type: 'set-node-prop',
      nodeId: parentId,
      key: 'className',
      value: withFourCols,
    });

    expect(expanded.document.nodes[parentId].children).toHaveLength(4);

    const withTwoCols = applyTailwindUtility(withFourCols, gridField, 'grid-cols-2');
    const reduced = designerReducer(expanded, {
      type: 'set-node-prop',
      nodeId: parentId,
      key: 'className',
      value: withTwoCols,
    });

    expect(reduced.document.nodes[parentId].children).toHaveLength(2);
  });

  it('keeps columns row layout compatible with slot sync helper', () => {
    const initial = createInitialDesignerState();
    const next = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: LAYOUT_COLUMNS_PALETTE_ITEM_ID,
      parentId: initial.document.rootNodeId,
    });
    const parentId = next.document.nodes[next.document.rootNodeId].children[0];
    const synced = syncLayoutGridSlotChildren(next.document.nodes, parentId);

    expect(synced[parentId].children).toHaveLength(2);
  });
});
