import { describe, expect, it } from 'vitest';
import { createInitialDesignerState, designerReducer } from '../state';
import {
  assertPersistableDesignerDocument,
  normalizeDesignerDocumentFromPersist,
  prepareDesignerDocumentForPersist,
} from '../documentPersist';
import { DESIGNER_DOCUMENT_SCHEMA_VERSION } from '../documentSchema';
import { validateDesignerDocument } from '../validation';
import { buildSlotPaletteItems } from '../slotPalette';
import { CORE_SLOT_CATALOG } from '../../../shared/api/contracts/slots/catalog';
import { DESIGNER_PALETTE, setDesignerPaletteCatalog } from '../catalog';

describe('documentPersist', () => {
  it('strips diagnostics and defaults schemaVersion on normalize', () => {
    const state = createInitialDesignerState();
    const withDiagnostics = {
      ...state.document,
      schemaVersion: '',
      diagnostics: [
        {
          id: 'test-error',
          code: 'required-prop' as const,
          level: 'error' as const,
          message: 'Stale diagnostic',
        },
      ],
    };

    const normalized = normalizeDesignerDocumentFromPersist(withDiagnostics);

    expect(normalized.diagnostics).toEqual([]);
    expect(normalized.schemaVersion).toBe(DESIGNER_DOCUMENT_SCHEMA_VERSION);
  });

  it('prepares document for persist with draft metadata', () => {
    const state = createInitialDesignerState('source-name');
    const prepared = prepareDesignerDocumentForPersist(state.document, {
      draftId: 'my-layout',
      draftName: 'My Layout',
    });

    expect(prepared.id).toBe('my-layout');
    expect(prepared.name).toBe('My Layout');
    expect(prepared.diagnostics).toEqual([]);
    expect(prepared.schemaVersion).toBe(DESIGNER_DOCUMENT_SCHEMA_VERSION);
  });

  it('assertPersistableDesignerDocument rejects unknown slot ids', () => {
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

    expect(() => assertPersistableDesignerDocument(document)).toThrow(/not registered in the platform catalog/);
  });

  it('accepts catalog-backed system-slot nodes for persist', () => {
    const slotItem = buildSlotPaletteItems(CORE_SLOT_CATALOG)[1];
    setDesignerPaletteCatalog([...DESIGNER_PALETTE, slotItem]);

    const initial = createInitialDesignerState('Slot Layout');
    const state = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: slotItem.id,
      parentId: initial.document.rootNodeId,
    });

    expect(() => assertPersistableDesignerDocument(state.document)).not.toThrow();
    expect(validateDesignerDocument(state.document).filter((item) => item.level === 'error')).toHaveLength(0);
  });
});
