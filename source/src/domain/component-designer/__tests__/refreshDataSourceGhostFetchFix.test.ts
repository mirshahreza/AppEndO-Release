/**
 * Bug found (parity audit item 36): `refreshDataSource` Dynamic Actions always minted a phantom
 * `refresh_regionData_<dataSourceId>` fetch hook, even when a Grid/Chart/Viz was already bound to
 * the same data source — so "refresh after save" never refreshed the visible widget.
 * Fixed in bindingDynamicActionsEngine.ts + bindingEngine.ts + bindingCodegen.ts: live fetches
 * register into a shared refresh-var map and trueActions reuse that var (no phantom hook).
 */
import { describe, expect, it } from 'vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import { createDynamicAction } from '../bindingDynamicActionsEngine';
import {
  REGION_DATA_SOURCE_BINDING_KEY,
  createRegionDataSourceBindingDefinition,
  createRegionSubmitEventBindingDefinition,
} from '../bindingRegionEngine';
import { GRID_LIST_RESOURCE_BINDING_KEY, createGridListResourceBindingDefinition } from '../bindingGridEngine';
import {
  buildChartBindingWizardActions,
} from '../bindingChartEngine';
import type { DesignerState } from '../types';

const insert = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChild = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

const withOrdersDataSource = (state: DesignerState): DesignerState =>
  designerReducer(state, {
    type: 'set-data-source',
    dataSourceId: 'orders',
    dataSource: {
      id: 'orders',
      name: 'Orders',
      endpoint: '/api/orders',
      fields: ['id', 'month'],
      primaryKey: 'id',
      operations: {
        list: { method: 'GET', endpoint: '/api/orders' },
        create: { method: 'POST', endpoint: '/api/orders' },
      },
    },
  });

describe('refreshDataSource ghost-fetch dedupe (item 36)', () => {
  it('form success refreshDataSource reuses the grid refresh var — no phantom regionData_* hook', () => {
    let state = withOrdersDataSource(createInitialDesignerState());

    state = insert(state, 'heroui.app-table-grid');
    const gridNodeId = lastChild(state);
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: gridNodeId,
      bindingKey: GRID_LIST_RESOURCE_BINDING_KEY,
      definition: createGridListResourceBindingDefinition('orders'),
    });

    state = insert(state, 'html.form');
    const formNodeId = lastChild(state);
    state = insert(state, 'heroui.button-solid', formNodeId);
    const buttonNodeId = lastChild(state, formNodeId);

    const refreshAction = createDynamicAction('refreshDataSource');
    refreshAction.dataSourceRef = 'orders';
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: buttonNodeId,
      bindingKey: 'event:onClick',
      definition: createRegionSubmitEventBindingDefinition('onClick', {
        trueActions: [refreshAction],
        invalidateQueries: ['region:orders'],
      }),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('grid + refreshDataSource success', tsx);

    expect(tsx).not.toContain('regionData_orders');
    expect(tsx).not.toMatch(/refresh_regionData_orders\s*=/);
    expect(tsx).toMatch(/await refresh_gridData_\w+\(\);/);

    const gridFetchDeclarations = tsx.match(/useDataFetch<unknown>\("\/api\/orders"/g) ?? [];
    expect(gridFetchDeclarations.length).toBeGreaterThanOrEqual(1);
  });

  it('when Region form + Grid share a dataSource, refresh prefers the visible grid var', () => {
    let state = withOrdersDataSource(createInitialDesignerState());

    state = insert(state, 'heroui.app-table-grid');
    const gridNodeId = lastChild(state);
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: gridNodeId,
      bindingKey: GRID_LIST_RESOURCE_BINDING_KEY,
      definition: createGridListResourceBindingDefinition('orders'),
    });

    state = insert(state, 'html.form');
    const formNodeId = lastChild(state);
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: formNodeId,
      bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
      definition: createRegionDataSourceBindingDefinition('orders'),
    });
    state = insert(state, 'heroui.button-solid', formNodeId);
    const buttonNodeId = lastChild(state, formNodeId);

    const refreshAction = createDynamicAction('refreshDataSource');
    refreshAction.dataSourceRef = 'orders';
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: buttonNodeId,
      bindingKey: 'event:onClick',
      definition: createRegionSubmitEventBindingDefinition('onClick', {
        trueActions: [refreshAction],
        invalidateQueries: ['region:orders'],
      }),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('region+grid refresh prefers grid', tsx);
    expect(tsx).toMatch(/await refresh_gridData_\w+\(\);/);
    expect(tsx).not.toMatch(/await refresh_regionData_orders\(\);/);
  });

  it('refreshDataSource against a chart-bound data source reuses the chart refresh var', () => {
    let state = withOrdersDataSource(createInitialDesignerState());
    state = insert(state, 'viz.chart-bar');
    const chartNodeId = lastChild(state);
    const chartNode = state.document.nodes[chartNodeId]!;
    for (const action of buildChartBindingWizardActions(chartNode, state.bindingDefinitions.dataSources.orders!)) {
      state = designerReducer(state, action);
    }

    state = insert(state, 'heroui.button-solid');
    const buttonNodeId = lastChild(state);
    const refreshAction = createDynamicAction('refreshDataSource');
    refreshAction.dataSourceRef = 'orders';
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: buttonNodeId,
      bindingKey: 'event:onClick',
      definition: {
        sourceType: 'static',
        bindingRole: 'event',
        targetEvent: 'onClick',
        trueActions: [refreshAction],
      },
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('chart + refreshDataSource', tsx);
    expect(tsx).not.toContain('regionData_orders');
    expect(tsx).toMatch(/await refresh_chartData_\w+\(\);/);
  });
});
