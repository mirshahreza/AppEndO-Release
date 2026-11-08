import { describe, expect, it } from 'vitest';
import { createInitialDesignerState, designerReducer } from '../state';
import { validateDesignerDocument } from '../validation';
import { buildReusablePaletteItems } from '../reusablePalette';
import { setDesignerPaletteCatalog } from '../catalog';
import { DESIGNER_PALETTE } from '../catalog';

describe('reusable-slot validation', () => {
  it('accepts reusable-slot nodes with component references', () => {
    const reusableItem = buildReusablePaletteItems([
      { id: 'hero-banner', name: 'Hero Banner' },
    ])[0];
    setDesignerPaletteCatalog([...DESIGNER_PALETTE, reusableItem]);

    const initial = createInitialDesignerState('Reusable Test');
    const state = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: reusableItem.id,
      parentId: initial.document.rootNodeId,
    });

    const diagnostics = validateDesignerDocument(state.document);
    const reusableErrors = diagnostics.filter((item) => item.field === 'componentId');

    expect(reusableErrors).toHaveLength(0);
    expect(state.document.nodes[state.selectedNodeId ?? '']?.type).toBe('reusable-slot');
    expect(state.document.nodes[state.selectedNodeId ?? '']?.componentRef).toMatchObject({
      refType: 'reusable',
      refId: 'hero-banner',
    });
  });

  it('rejects reusable-slot nodes without component references', () => {
    const state = createInitialDesignerState('Invalid Reusable');
    const rootId = state.document.rootNodeId;
    const nodeId = 'invalid-reusable-node';

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
          type: 'reusable-slot',
          parentId: rootId,
          order: 0,
          props: {},
          layout: {},
          binding: {},
          children: [],
        },
      },
    };

    const diagnostics = validateDesignerDocument(document);
    expect(diagnostics.some((item) => item.field === 'componentId')).toBe(true);
  });

  // CD-I03: reusable-version-stale
  it('emits reusable-version-stale warning when version is pinned to a non-latest value', () => {
    const state = createInitialDesignerState('Version Stale Test');
    const rootId = state.document.rootNodeId;
    const nodeId = 'pinned-reusable-node';

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
          type: 'reusable-slot',
          parentId: rootId,
          order: 0,
          props: { componentId: 'my-banner' },
          layout: {},
          binding: {},
          children: [],
          componentRef: {
            refType: 'reusable' as const,
            refId: 'my-banner',
            version: '1.0.0',
          },
        },
      },
    };

    const diagnostics = validateDesignerDocument(document);
    expect(diagnostics.some((d) => d.code === 'reusable-version-stale')).toBe(true);
    expect(diagnostics.some((d) => d.code === 'reusable-version-stale' && d.level === 'warning')).toBe(true);
  });

  it('does NOT emit reusable-version-stale when no version is pinned', () => {
    const state = createInitialDesignerState('No Pin Test');
    const rootId = state.document.rootNodeId;
    const nodeId = 'unpinned-reusable-node';

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
          type: 'reusable-slot',
          parentId: rootId,
          order: 0,
          props: { componentId: 'my-banner' },
          layout: {},
          binding: {},
          children: [],
          componentRef: {
            refType: 'reusable' as const,
            refId: 'my-banner',
          },
        },
      },
    };

    const diagnostics = validateDesignerDocument(document);
    expect(diagnostics.some((d) => d.code === 'reusable-version-stale')).toBe(false);
  });
});


describe('designer document schemaVersion', () => {
  it('sets schemaVersion on new documents', () => {
    const state = createInitialDesignerState();
    expect(state.document.schemaVersion).toBe('1.0.0');
  });
});
