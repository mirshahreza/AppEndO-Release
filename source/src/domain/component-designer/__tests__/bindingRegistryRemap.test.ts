import { describe, expect, it } from 'vitest';
import {
  createRegionColumnBindingDefinition,
  createRegionDataSourceBindingDefinition,
  REGION_DATA_SOURCE_BINDING_KEY,
} from '../bindingRegionEngine';
import { createDynamicAction, createDynamicActionsEventBindingDefinition } from '../bindingDynamicActionsEngine';
import { eventBindingKeyForEvent, propertyBindingKeyForProp } from '../bindingEngine';
import { remapDataSourceReferencesInDocument } from '../bindingRegistryRemap';
import { createInitialDesignerState, designerReducer } from '../state';

const insertNode = (state: ReturnType<typeof createInitialDesignerState>, itemId: string, parentId: string) => {
  const next = designerReducer(state, {
    type: 'insert-palette-item',
    itemId,
    parentId,
  });
  const parent = next.document.nodes[parentId];
  const childId = parent.children[parent.children.length - 1];
  return { state: next, nodeId: childId };
};

describe('bindingRegistryRemap', () => {
  it('remaps region data source refs and refresh action dataSourceRef when a data source is renamed', () => {
    let state = createInitialDesignerState();

    const formInsert = insertNode(state, 'html.form', state.document.rootNodeId);
    state = formInsert.state;
    const regionId = formInsert.nodeId;

    const inputInsert = insertNode(state, 'heroui.input-text', regionId);
    state = inputInsert.state;
    const inputId = inputInsert.nodeId;

    const buttonInsert = insertNode(state, 'heroui.button-solid', state.document.rootNodeId);
    state = buttonInsert.state;
    const buttonId = buttonInsert.nodeId;

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'users',
      dataSource: {
        id: 'users',
        name: 'Users',
        endpoint: '/api/users',
        fields: ['ID', 'NAME'],
      },
    });

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: regionId,
      bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
      definition: createRegionDataSourceBindingDefinition('users'),
    });

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: inputId,
      bindingKey: propertyBindingKeyForProp('value'),
      definition: createRegionColumnBindingDefinition('value', 'NAME'),
    });

    const refreshAction = createDynamicAction('refreshDataSource');
    refreshAction.dataSourceRef = 'users';

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: buttonId,
      bindingKey: eventBindingKeyForEvent('onClick'),
      definition: createDynamicActionsEventBindingDefinition('onClick', [refreshAction]),
    });

    state = designerReducer(state, {
      type: 'rename-data-source',
      previousDataSourceId: 'users',
      dataSourceId: 'app_users',
      dataSource: {
        id: 'app_users',
        name: 'Users',
        endpoint: '/api/users',
        fields: ['ID', 'NAME'],
      },
    });

    const regionBinding = state.document.nodes[regionId]?.binding[REGION_DATA_SOURCE_BINDING_KEY];
    expect(regionBinding?.dataSourceRef).toBe('app_users');
    expect(regionBinding?.sourcePath).toBe('app_users');

    const refreshBinding = state.document.nodes[buttonId]?.binding[eventBindingKeyForEvent('onClick')];
    expect(refreshBinding?.trueActions?.[0]?.dataSourceRef).toBe('app_users');
    expect(state.bindingDefinitions.dataSources.app_users).toBeDefined();
    expect(state.bindingDefinitions.dataSources.users).toBeUndefined();
  });

  it('remaps references through remapDataSourceReferencesInDocument helper', () => {
    let state = createInitialDesignerState();

    const formInsert = insertNode(state, 'html.form', state.document.rootNodeId);
    state = formInsert.state;
    const regionId = formInsert.nodeId;

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: regionId,
      bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
      definition: createRegionDataSourceBindingDefinition('orders'),
    });

    const remapped = remapDataSourceReferencesInDocument(state.document, 'orders', 'sales_orders');
    expect(remapped.nodes[regionId]?.binding[REGION_DATA_SOURCE_BINDING_KEY]?.dataSourceRef).toBe('sales_orders');
  });
});
