import { describe, expect, it } from 'vitest';
import {
  applyLayoutGridClassName,
  applyLayoutGridTracksToClassName,
  buildLayoutGridColsUtility,
  buildLayoutGridTemplateColumnsCss,
  parseLayoutGridColumnWidths,
  parseLayoutGridColumnWidthsFromClassName,
  parseLayoutGridTrack,
  resizeLayoutGridColumnWidths,
  resolveLayoutGridDomStyle,
  serializeLayoutGridColumnWidths,
  syncLayoutGridNodeColumnSizing,
} from '../layoutGridColumnWidths';
import { resolveDesignerDomProps } from '../domProps';
import { LAYOUT_GRID_2_PALETTE_ITEM_ID } from '../layoutGridSlots';
import { createInitialDesignerState, designerReducer } from '../state';

describe('layoutGridColumnWidths', () => {
  it('builds equal grid-cols-N utilities for default fr columns', () => {
    expect(buildLayoutGridColsUtility([
      { value: '1', unit: 'fr' },
      { value: '1', unit: 'fr' },
    ])).toBe('grid-cols-2');
  });

  it('omits Tailwind arbitrary grid-cols utilities for custom widths', () => {
    expect(buildLayoutGridColsUtility([
      { value: '240', unit: 'px' },
      { value: '1', unit: 'fr' },
    ])).toBe('');

    expect(buildLayoutGridColsUtility([
      { value: '30', unit: '%' },
      { value: '70', unit: '%' },
    ])).toBe('');
  });

  it('builds CSS grid-template-columns for custom widths', () => {
    expect(buildLayoutGridTemplateColumnsCss([
      { value: '20', unit: '%' },
      { value: '70', unit: '%' },
    ])).toBe('20% 70%');

    expect(buildLayoutGridTemplateColumnsCss([
      { value: '1', unit: 'fr' },
      { value: '1', unit: 'fr' },
    ])).toBeNull();
  });

  it('parses and serializes column width props', () => {
    const widths = [
      { value: '200', unit: 'px' as const },
      { value: '1', unit: 'fr' as const },
    ];
    const serialized = serializeLayoutGridColumnWidths(widths);
    expect(parseLayoutGridColumnWidths(serialized)).toEqual(widths);
  });

  it('parses arbitrary grid-cols tracks from className', () => {
    expect(parseLayoutGridColumnWidthsFromClassName('grid w-full grid-cols-[280px,1fr] gap-4')).toEqual([
      { value: '280', unit: 'px' },
      { value: '1', unit: 'fr' },
    ]);
  });

  it('applies custom widths to className while preserving other utilities', () => {
    const className = applyLayoutGridTracksToClassName('grid w-full grid-cols-2 gap-4', [
      { value: '180', unit: 'px' },
      { value: '1', unit: 'fr' },
    ], 'row');

    expect(className).toBe('w-full gap-4 grid');
    expect(className).not.toContain('grid-cols-[');
  });

  it('uses flex column layout when direction is column', () => {
    const className = applyLayoutGridClassName('grid w-full grid-cols-2 gap-4', 'column', [
      { value: '1', unit: 'fr' },
      { value: '1', unit: 'fr' },
    ]);

    expect(className).toContain('flex');
    expect(className).toContain('flex-col');
    expect(className).not.toContain('grid-cols-');
  });

  it('syncs column direction through designer reducer', () => {
    const initial = createInitialDesignerState();
    const inserted = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: LAYOUT_GRID_2_PALETTE_ITEM_ID,
      parentId: initial.document.rootNodeId,
    });
    const parentId = inserted.document.nodes[inserted.document.rootNodeId].children[0];

    const stacked = designerReducer(inserted, {
      type: 'set-node-prop',
      nodeId: parentId,
      key: 'layoutGridDirection',
      value: 'column',
    });

    const parent = stacked.document.nodes[parentId];
    expect(parent.props.layoutGridDirection).toBe('column');
    expect(parent.props.className).toContain('flex-col');
    expect(parent.props.className).not.toContain('grid-cols-2');
    expect(parent.children).toHaveLength(2);
  });

  it('resizes width arrays when column count changes', () => {
    const resized = resizeLayoutGridColumnWidths([
      { value: '200', unit: 'px' },
      { value: '1', unit: 'fr' },
    ], 3);

    expect(resized).toEqual([
      { value: '200', unit: 'px' },
      { value: '1', unit: 'fr' },
      { value: '1', unit: 'fr' },
    ]);
  });

  it('syncs layout grid node className when column widths change', () => {
    const initial = createInitialDesignerState();
    const inserted = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: LAYOUT_GRID_2_PALETTE_ITEM_ID,
      parentId: initial.document.rootNodeId,
    });
    const parentId = inserted.document.nodes[inserted.document.rootNodeId].children[0];
    const parent = inserted.document.nodes[parentId];

    const withCustomWidths = {
      ...parent,
      props: {
        ...parent.props,
        layoutGridColumnWidths: serializeLayoutGridColumnWidths([
          { value: '220', unit: 'px' },
          { value: '1', unit: 'fr' },
        ]),
      },
    };

    const next = syncLayoutGridNodeColumnSizing(withCustomWidths, 'layoutGridColumnWidths');
    expect(next.props.className).toContain('grid');
    expect(next.props.className).not.toContain('grid-cols-[');
    expect(resolveLayoutGridDomStyle(next)).toEqual({ gridTemplateColumns: '220px 1fr' });
  });

  it('resizes stored widths and slots when grid column count changes', () => {
    const initial = createInitialDesignerState();
    const inserted = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: LAYOUT_GRID_2_PALETTE_ITEM_ID,
      parentId: initial.document.rootNodeId,
    });
    const parentId = inserted.document.nodes[inserted.document.rootNodeId].children[0];

    const withCustomWidths = designerReducer(inserted, {
      type: 'set-node-prop',
      nodeId: parentId,
      key: 'layoutGridColumnWidths',
      value: serializeLayoutGridColumnWidths([
        { value: '220', unit: 'px' },
        { value: '1', unit: 'fr' },
        { value: '1', unit: 'fr' },
        { value: '1', unit: 'fr' },
      ]),
    });

    const parent = withCustomWidths.document.nodes[parentId];
    expect(parent.children).toHaveLength(4);

    const withTwoCols = applyLayoutGridTracksToClassName(String(parent.props.className), [
      { value: '1', unit: 'fr' },
      { value: '1', unit: 'fr' },
    ]);

    const reduced = designerReducer(withCustomWidths, {
      type: 'set-node-prop',
      nodeId: parentId,
      key: 'className',
      value: withTwoCols,
    });

    expect(reduced.document.nodes[parentId].children).toHaveLength(2);
    expect(reduced.document.nodes[parentId].props.className).not.toContain('grid-cols-[');
    expect(resolveLayoutGridDomStyle(reduced.document.nodes[parentId])).toEqual({
      gridTemplateColumns: '220px 1fr',
    });
  });

  it('resolves percent row columns through designer dom props', () => {
    const initial = createInitialDesignerState();
    const inserted = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: LAYOUT_GRID_2_PALETTE_ITEM_ID,
      parentId: initial.document.rootNodeId,
    });
    const parentId = inserted.document.nodes[inserted.document.rootNodeId].children[0];

    const withPercentWidths = designerReducer(inserted, {
      type: 'set-node-prop',
      nodeId: parentId,
      key: 'layoutGridColumnWidths',
      value: serializeLayoutGridColumnWidths([
        { value: '20', unit: '%' },
        { value: '70', unit: '%' },
      ]),
    });

    const parent = withPercentWidths.document.nodes[parentId];
    expect(parent.props.layoutGridDirection ?? 'row').toBe('row');
    expect(resolveDesignerDomProps(parent).style).toEqual({ gridTemplateColumns: '20% 70%' });
  });

  it('parses fr, px, percent, and auto tracks', () => {
    expect(parseLayoutGridTrack('1.5fr')).toEqual({ value: '1.5', unit: 'fr' });
    expect(parseLayoutGridTrack('120px')).toEqual({ value: '120', unit: 'px' });
    expect(parseLayoutGridTrack('25%')).toEqual({ value: '25', unit: '%' });
    expect(parseLayoutGridTrack('auto')).toEqual({ value: '', unit: 'auto' });
  });
});
