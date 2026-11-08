import { describe, expect, it } from 'vitest';
import { createInitialDesignerState, designerReducer } from '../state';
import { collectNodeBindingHealth } from '../bindingDiagnostics';
import {
  createGridListResourceBindingDefinition,
  GRID_LIST_RESOURCE_BINDING_KEY,
} from '../bindingGridEngine';
import {
  createRegionDataSourceBindingDefinition,
  REGION_DATA_SOURCE_BINDING_KEY,
} from '../bindingRegionEngine';

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

describe('bindingDiagnostics', () => {
  it('reports connected resource and mapping warnings', () => {
    let state = createInitialDesignerState();
    const formInsert = insertNode(state, 'html.form', state.document.rootNodeId);
    state = formInsert.state;

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'customers',
      dataSource: {
        id: 'customers',
        name: 'Customers',
        endpoint: '/api/customers',
        primaryKey: 'id',
        fields: ['id', 'email'],
      },
    });

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: formInsert.nodeId,
      bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
      definition: createRegionDataSourceBindingDefinition('customers'),
    });

    const health = collectNodeBindingHealth(state.document, state.bindingDefinitions, formInsert.nodeId);

    expect(health.connectedResourceId).toBe('customers');
    expect(health.connectedResourceName).toBe('Customers');
    expect(health.loadEndpoint).toContain('/api/customers');
    expect(health.issues.some((issue) => issue.id === 'no-field-mappings')).toBe(true);
  });

  it('reports grid list binding health for data grid nodes', () => {
    let state = createInitialDesignerState();
    const gridInsert = insertNode(state, 'heroui.data-grid', state.document.rootNodeId);
    state = gridInsert.state;

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'orders',
      dataSource: {
        id: 'orders',
        name: 'Orders',
        endpoint: '/api/orders',
        fields: ['id', 'total'],
      },
    });

    const unboundHealth = collectNodeBindingHealth(state.document, state.bindingDefinitions, gridInsert.nodeId);
    expect(unboundHealth.issues.some((issue) => issue.id === 'grid-no-resource')).toBe(true);

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: gridInsert.nodeId,
      bindingKey: GRID_LIST_RESOURCE_BINDING_KEY,
      definition: createGridListResourceBindingDefinition('orders'),
    });

    const boundHealth = collectNodeBindingHealth(state.document, state.bindingDefinitions, gridInsert.nodeId);
    expect(boundHealth.connectedResourceId).toBe('orders');
    expect(boundHealth.loadEndpoint).toBe('/api/orders');
  });
});
