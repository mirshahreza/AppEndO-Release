import { describe, expect, it } from 'vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import {
  createEventBindingDefinition,
  eventBindingKeyForEvent,
} from '../bindingEngine';
import { GRID_LIST_RESOURCE_BINDING_KEY, createGridListResourceBindingDefinition } from '../bindingGridEngine';
import type { DesignerState } from '../types';

/**
 * Bug found: `invalidateQueries: ['region:<dataSourceId>']` (exactly what the Create/Edit form
 * wizard's "Refresh" success option emits) resolved via `fetchRefreshVarByKey`, but that map only
 * ever registered Region fetches under the `region:<id>` key — a Grid bound to the same data
 * source was invisible to it. So "refresh this data source" after a successful mutation silently
 * did nothing to the visible grid. Fixed in bindingCodegen.ts's createTsxBindingRenderContext.
 */

const insert = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChild = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

describe('grid refresh-after-mutation codegen', () => {
  it("a button's invalidateQueries targeting the grid's own data source calls the grid's real refresh function, not a phantom duplicate fetch", () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'orders',
      dataSource: {
        id: 'orders',
        name: 'Orders',
        endpoint: '/api/orders',
        fields: ['id', 'month'],
        primaryKey: 'id',
        operations: { list: { method: 'GET', endpoint: '/api/orders' } },
      },
    });

    state = insert(state, 'heroui.app-table-grid');
    const gridNodeId = lastChild(state);
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: gridNodeId,
      bindingKey: GRID_LIST_RESOURCE_BINDING_KEY,
      definition: createGridListResourceBindingDefinition('orders'),
    });

    state = insert(state, 'heroui.button-solid');
    const buttonNodeId = lastChild(state);
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: buttonNodeId,
      bindingKey: eventBindingKeyForEvent('onClick'),
      definition: createEventBindingDefinition('onClick', '/api/orders/bulk-close', 'POST', undefined, {
        invalidateQueries: ['region:orders'],
      }),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('grid + invalidateQueries button', tsx);

    // The grid's own fetch hook must be declared exactly once (no phantom duplicate for 'orders').
    const gridFetchDeclarations = tsx.match(/const \{ data: raw_gridData_\w+.*?useDataFetch<unknown>\("\/api\/orders"/g) ?? [];
    expect(gridFetchDeclarations).toHaveLength(1);
    expect(tsx).not.toContain('regionData_orders');

    // The button's click handler must call the grid's real refresh function.
    expect(tsx).toMatch(/await refresh_gridData_\w+\(\);/);
  });
});
