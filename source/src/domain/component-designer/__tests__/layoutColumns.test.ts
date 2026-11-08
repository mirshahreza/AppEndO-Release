import { describe, expect, it } from 'vitest';
import {
  getPaletteItemById,
  isCompoundPaletteItemId,
  LAYOUT_COLUMNS_PALETTE_ITEM_ID,
  LAYOUT_COLUMN_SLOT_CLASSNAME,
} from '../catalog';
import {
  PALETTE_TAILWIND_FIELD_KEYS,
  resolveInspectorFieldSections,
  resolveTailwindInspectorFields,
} from '../inspectorRegistry';
import { applyTailwindUtility } from '../tailwindClasses';
import { createInitialDesignerState, designerReducer } from '../state';

describe('layout.columns palette item', () => {
  it('registers the columns row item in the layout category', () => {
    const item = getPaletteItemById(LAYOUT_COLUMNS_PALETTE_ITEM_ID);

    expect(item).toBeDefined();
    expect(item?.label).toBe('Columns / Row');
    expect(item?.category).toBe('layout');
    expect(item?.defaultProps.className).toContain('grid-cols-2');
    expect(item?.defaultProps.className).toContain('gap-4');
    expect(isCompoundPaletteItemId(LAYOUT_COLUMNS_PALETTE_ITEM_ID)).toBe(true);
  });

  it('inserts a parent grid container with two column slot children', () => {
    const initial = createInitialDesignerState();
    const next = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: LAYOUT_COLUMNS_PALETTE_ITEM_ID,
      parentId: initial.document.rootNodeId,
    });

    const parentId = next.document.nodes[next.document.rootNodeId].children[0];
    const parent = next.document.nodes[parentId];

    expect(parent.props._designerPaletteItemId).toBe(LAYOUT_COLUMNS_PALETTE_ITEM_ID);
    expect(parent.props.className).toContain('grid w-full grid-cols-2 gap-4');
    expect(parent.children).toHaveLength(2);

    for (const childId of parent.children) {
      const child = next.document.nodes[childId];
      expect(child.type).toBe('container');
      expect(child.parentId).toBe(parentId);
      expect(child.props.className).toBe(LAYOUT_COLUMN_SLOT_CLASSNAME);
      expect(child.children).toEqual([]);
    }
  });

  it('exposes grid column and gap tailwind controls for the parent node', () => {
    const node = {
      id: 'columns-1',
      type: 'container',
      parentId: 'root',
      order: 0,
      props: {
        className: 'grid w-full grid-cols-2 gap-4',
        _designerPaletteItemId: LAYOUT_COLUMNS_PALETTE_ITEM_ID,
      },
      layout: {},
      binding: {},
      children: ['col-1', 'col-2'],
    };

    expect(PALETTE_TAILWIND_FIELD_KEYS[LAYOUT_COLUMNS_PALETTE_ITEM_ID]).toEqual([
      'layoutGridDirection',
      'twGridCols',
      'layoutGridColumnWidths',
      'twGap',
    ]);

    const tailwindFields = resolveTailwindInspectorFields(LAYOUT_COLUMNS_PALETTE_ITEM_ID);
    expect(tailwindFields.map((field) => field.key)).toEqual([
      'layoutGridDirection',
      'twGridCols',
      'layoutGridColumnWidths',
      'twGap',
    ]);

    const sections = resolveInspectorFieldSections(node);
    const styleSection = sections.find((section) => section.id === 'style');
    expect(styleSection?.fields.map((field) => field.key)).toEqual([
      'twGap',
      'twGridCols',
      'layoutGridDirection',
      'layoutGridColumnWidths',
      'surfaceToken',
      'className',
      'style',
    ]);
  });

  it('updates parent className utilities through applyTailwindUtility', () => {
    const initial = createInitialDesignerState();
    const inserted = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: LAYOUT_COLUMNS_PALETTE_ITEM_ID,
      parentId: initial.document.rootNodeId,
    });
    const parentId = inserted.document.nodes[inserted.document.rootNodeId].children[0];
    const parent = inserted.document.nodes[parentId];
    const gridField = resolveTailwindInspectorFields(LAYOUT_COLUMNS_PALETTE_ITEM_ID)[1];
    const gapField = resolveTailwindInspectorFields(LAYOUT_COLUMNS_PALETTE_ITEM_ID)[3];

    const withThreeCols = applyTailwindUtility(String(parent.props.className), gridField, 'grid-cols-3');
    const withLargeGap = applyTailwindUtility(withThreeCols, gapField, 'gap-6');

    expect(withThreeCols).toContain('grid-cols-3');
    expect(withThreeCols).not.toContain('grid-cols-2');
    expect(withLargeGap).toContain('gap-6');
    expect(withLargeGap).not.toContain('gap-4');
  });
});
