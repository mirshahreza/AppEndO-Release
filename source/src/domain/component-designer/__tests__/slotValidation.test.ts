import { describe, expect, it } from 'vitest';
import { createInitialDesignerState, designerReducer } from '../state';
import { validateDesignerDocument } from '../validation';
import { buildSlotPaletteItems } from '../slotPalette';
import { CORE_SLOT_CATALOG } from '../../../shared/api/contracts/slots/catalog';
import { setDesignerPaletteCatalog } from '../catalog';
import { DESIGNER_PALETTE } from '../catalog';

describe('system-slot validation', () => {
  it('accepts catalog slot ids on system-slot nodes', () => {
    const slotItem = buildSlotPaletteItems(CORE_SLOT_CATALOG)[1];
    setDesignerPaletteCatalog([...DESIGNER_PALETTE, slotItem]);

    const initial = createInitialDesignerState('Slot Test');
    const state = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: slotItem.id,
      parentId: initial.document.rootNodeId,
    });

    const diagnostics = validateDesignerDocument(state.document);
    const slotErrors = diagnostics.filter((item) => item.code === 'slot-unknown' || item.field === 'slotId');

    expect(slotErrors).toHaveLength(0);
    expect(state.document.nodes[state.selectedNodeId ?? '']?.type).toBe('system-slot');
  });

  it('rejects unknown slot ids', () => {
    const state = createInitialDesignerState('Invalid Slot');
    const rootId = state.document.rootNodeId;
    const nodeId = 'invalid-slot-node';

    const document = {
      ...state.document,
      nodes: {
        ...state.document.nodes,
        [rootId]: {
          ...state.document.nodes[rootId],
          children: [nodeId],
        },
        [nodeId]: {
          id: nodeId,
          type: 'system-slot',
          parentId: rootId,
          order: 0,
          props: { slotId: 'unknown.slot.id' },
          layout: {},
          binding: {},
          children: [],
        },
      },
    };

    const diagnostics = validateDesignerDocument(document);
    expect(diagnostics.some((item) => item.code === 'slot-unknown')).toBe(true);
  });
});
