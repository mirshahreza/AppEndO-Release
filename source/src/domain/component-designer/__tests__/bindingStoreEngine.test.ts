import { describe, expect, it } from 'vitest';
import { createInitialDesignerState, designerReducer } from '../state';
import {
  collectDocumentStorePlan,
  parseStoreBindingKey,
  resolveStorePathExpression,
  storeBindingKeyForPath,
  validateStoreDependencies,
} from '../bindingStoreEngine';
import { generateDesignerTsx } from '../codegen';
import { createDefaultBindingDefinitions } from '../bindingRegistry';
import { createStoreReadBindingDefinition } from '../bindingStoreEngine';
import { createEventBindingDefinition, eventBindingKeyForEvent } from '../bindingEngine';

describe('bindingStoreEngine', () => {
  it('parses store binding keys', () => {
    expect(parseStoreBindingKey('store:selection.countryId')).toEqual({
      segmentId: 'selection',
      path: 'countryId',
      storePath: 'selection.countryId',
    });
    expect(storeBindingKeyForPath('filters.status')).toBe('store:filters.status');
  });

  it('resolves optional chain store expressions', () => {
    expect(resolveStorePathExpression('selection.countryId')).toBe('designerStore?.selection?.countryId');
  });

  it('collects store read and write bindings from the document', () => {
    const state = createInitialDesignerState();
    const selectNodeId = 'select-node';
    const gridNodeId = 'grid-node';

    state.document.nodes[selectNodeId] = {
      id: selectNodeId,
      type: 'component',
      parentId: state.document.rootNodeId,
      order: 0,
      props: { _designerPaletteItemId: 'heroui.select' },
      layout: {},
      binding: {
        [eventBindingKeyForEvent('onChange')]: {
          sourceType: 'store',
          bindingRole: 'event',
          targetEvent: 'onChange',
          storeWritePath: 'selection.countryId',
        },
      },
      children: [],
    };

    const storeRead = createStoreReadBindingDefinition('rows', 'filters.countryId');
    state.document.nodes[gridNodeId] = {
      id: gridNodeId,
      type: 'component',
      parentId: state.document.rootNodeId,
      order: 1,
      props: { _designerPaletteItemId: 'heroui.data-grid' },
      layout: {},
      binding: {
        [storeRead.bindingKey]: storeRead.definition,
      },
      children: [],
    };

    state.document.nodes[state.document.rootNodeId].children = [selectNodeId, gridNodeId];

    const plan = collectDocumentStorePlan(state.document, {
      ...state.bindingDefinitions,
      storeSegments: {
        selection: { id: 'selection', initialValue: { countryId: null } },
        filters: { id: 'filters', initialValue: { countryId: null } },
      },
    });

    expect(plan.readBindings).toHaveLength(1);
    expect(plan.writeBindings).toHaveLength(1);
    expect(plan.readBindings[0]?.storePath).toBe('filters.countryId');
    expect(plan.writeBindings[0]?.storePath).toBe('selection.countryId');
  });

  it('generates useDesignerStore hook and store read/write TSX', () => {
    const state = createInitialDesignerState();
    const selectNodeId = 'select-node';
    const gridNodeId = 'grid-node';

    state.bindingDefinitions = {
      definitions: createDefaultBindingDefinitions().definitions,
      storeSegments: {
        selection: { id: 'selection', initialValue: { countryId: null } },
        filters: { id: 'filters', initialValue: { countryId: null } },
      },
    };

    state.document.nodes[selectNodeId] = {
      id: selectNodeId,
      type: 'component',
      parentId: state.document.rootNodeId,
      order: 0,
      props: { _designerPaletteItemId: 'heroui.select' },
      layout: {},
      binding: {
        [eventBindingKeyForEvent('onChange')]: {
          sourceType: 'store',
          bindingRole: 'event',
          targetEvent: 'onChange',
          storeWritePath: 'selection.countryId',
        },
      },
      children: [],
    };

    const storeRead = createStoreReadBindingDefinition('rows', 'filters.countryId');
    state.document.nodes[gridNodeId] = {
      id: gridNodeId,
      type: 'component',
      parentId: state.document.rootNodeId,
      order: 1,
      props: { _designerPaletteItemId: 'heroui.data-grid' },
      layout: {},
      binding: {
        [storeRead.bindingKey]: storeRead.definition,
      },
      children: [],
    };

    state.document.nodes[state.document.rootNodeId].children = [selectNodeId, gridNodeId];

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);

    expect(tsx).toContain('function useDesignerStore');
    expect(tsx).toContain('patchDesignerStore');
    expect(tsx).toContain('designerStore?.filters?.countryId');
    expect(tsx).toContain('patchDesignerStore("selection.countryId"');
    expect(tsx).not.toContain('zustand');
    expect(tsx).not.toContain('redux');
  });

  it('supports store patch combined with API mutation', () => {
    const state = createInitialDesignerState();
    const nodeId = 'input-node';

    state.document.nodes[nodeId] = {
      id: nodeId,
      type: 'component',
      parentId: state.document.rootNodeId,
      order: 0,
      props: { _designerPaletteItemId: 'heroui.input' },
      layout: {},
      binding: {
        [eventBindingKeyForEvent('onChange')]: createEventBindingDefinition(
          'onChange',
          '/api/v1/profile',
          'PATCH',
          undefined,
          { storeWritePath: 'selection.email' },
        ),
      },
      children: [],
    };

    state.document.nodes[state.document.rootNodeId].children = [nodeId];

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('patchDesignerStore("selection.email"');
    expect(tsx).toContain('/api/v1/profile');
  });

  it('manages store segments through reducer actions', () => {
    const initial = createInitialDesignerState();
    const next = designerReducer(initial, {
      type: 'set-store-segment',
      segmentId: 'selection',
      segment: { id: 'selection', initialValue: { countryId: null }, persist: 'none' },
    });

    expect(next.bindingDefinitions.storeSegments.selection?.id).toBe('selection');

    const removed = designerReducer(next, {
      type: 'remove-store-segment',
      segmentId: 'selection',
    });

    expect(removed.bindingDefinitions.storeSegments.selection).toBeUndefined();
  });

  it('surfaces circular store dependency diagnostics', () => {
    const state = createInitialDesignerState();
    const nodeA = 'node-a';
    const nodeB = 'node-b';

    state.document.nodes[nodeA] = {
      id: nodeA,
      type: 'component',
      parentId: state.document.rootNodeId,
      order: 0,
      props: {},
      layout: {},
      binding: {
        [storeBindingKeyForPath('selection.countryId')]: {
          sourceType: 'store',
          bindingRole: 'property',
          targetProp: 'value',
        },
        [eventBindingKeyForEvent('onChange')]: {
          sourceType: 'store',
          bindingRole: 'event',
          targetEvent: 'onChange',
          storeWritePath: 'filters.status',
        },
      },
      children: [],
    };

    state.document.nodes[nodeB] = {
      id: nodeB,
      type: 'component',
      parentId: state.document.rootNodeId,
      order: 1,
      props: {},
      layout: {},
      binding: {
        [storeBindingKeyForPath('filters.status')]: {
          sourceType: 'store',
          bindingRole: 'property',
          targetProp: 'value',
        },
        [eventBindingKeyForEvent('onChange')]: {
          sourceType: 'store',
          bindingRole: 'event',
          targetEvent: 'onChange',
          storeWritePath: 'selection.countryId',
        },
      },
      children: [],
    };

    const diagnostics = validateStoreDependencies(state.document);
    expect(diagnostics.some((item) => item.code === 'binding-dependency')).toBe(true);
  });
});
