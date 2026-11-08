import { describe, expect, it } from 'vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import {
  createGridListResourceBindingDefinition,
  GRID_LIST_RESOURCE_BINDING_KEY,
} from '../bindingGridEngine';
import type { DesignerState } from '../types';

/**
 * Bug found: a bound grid's toolbar (search/sort/page/column-filter) correctly patched
 * `designerStore` at runtime, but the exported/published fetch URL builder
 * (`renderGridListFetchHookLines` in bindingCodegen.ts) only ever read `fetchConfig.urlParams` —
 * the grid's own `queryParams` (built by designerGridToolbarConfig.ts's generic, non-Users
 * `buildGridListQueryParamBindings`) was silently dropped, so a published grid's toolbar looked
 * real but never actually varied the request. Mirrors the identical bug already found and fixed
 * for charts this session.
 */

const insert = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChild = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

describe('grid toolbar queryParams codegen', () => {
  it('emits a fetch URL expression that references the toolbar-driven designerStore paths (search/sort/page)', () => {
    let state = insert(createInitialDesignerState(), 'heroui.app-table-grid');
    const nodeId = lastChild(state);
    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'orders',
      dataSource: {
        id: 'orders',
        name: 'Orders',
        endpoint: '/api/orders',
        fields: ['month', 'status'],
        primaryKey: 'id',
        operations: { list: { method: 'GET', endpoint: '/api/orders' } },
      },
    });
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId,
      bindingKey: GRID_LIST_RESOURCE_BINDING_KEY,
      definition: createGridListResourceBindingDefinition('orders', {
        sortStorePath: 'gridQuery.sort',
        pageStorePath: 'gridQuery.page',
        queryParams: {
          search: 'gridToolbar.search',
          sortBy: 'gridQuery.sortBy',
          page: 'gridQuery.page',
        },
      }),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('grid with toolbar queryParams', tsx);

    // The fetch URL builder must now be handed all three toolbar-driven store paths — previously
    // only urlParams reached it, and queryParams were silently dropped entirely.
    expect(tsx).toMatch(/resolveBindingUrl\("\/api\/orders", designerStore, \{[^}]*"search":\s*"gridToolbar\.search"/);
    expect(tsx).toMatch(/"sortBy":\s*"gridQuery\.sortBy"/);
    expect(tsx).toMatch(/"page":\s*"gridQuery\.page"/);
  });

  it('does not require designerStore when a grid has no queryParams/urlParams at all', () => {
    let state = insert(createInitialDesignerState(), 'heroui.data-grid');
    const nodeId = lastChild(state);
    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'products',
      dataSource: {
        id: 'products',
        name: 'Products',
        endpoint: '/api/products',
        fields: ['name'],
        primaryKey: 'id',
        operations: { list: { method: 'GET', endpoint: '/api/products' } },
      },
    });
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId,
      bindingKey: GRID_LIST_RESOURCE_BINDING_KEY,
      definition: createGridListResourceBindingDefinition('products'),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('grid without toolbar queryParams', tsx);
    expect(tsx).toContain('/api/products');
  });
});
