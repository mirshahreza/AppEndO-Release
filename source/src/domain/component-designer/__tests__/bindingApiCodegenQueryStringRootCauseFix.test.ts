import { transformSync } from 'esbuild';
import { describe, expect, it } from 'vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import {
  createGridListResourceBindingDefinition,
  GRID_LIST_RESOURCE_BINDING_KEY,
} from '../bindingGridEngine';
import { buildChartBindingWizardActions, CHART_TOOLBAR_CONFIG_PROP } from '../bindingChartEngine';
import { serializeDesignerChartToolbarConfig } from '../designerChartToolbarConfig';
import { renderBindingApiRuntimeHelpers } from '../bindingApiCodegen';
import {
  resolveBindingHeaders,
  resolveBindingUrl,
} from '../bindingMutationRuntime';
import type { DesignerState } from '../types';

/**
 * Bug found (parity audit item 28): Export's inlined `resolveBindingUrl` only substituted
 * `{name}` path placeholders — toolbar query params (search/sort/page/filter) passed as
 * leftover `paramPaths` keys were silently ignored, so published chart/grid/viz never varied
 * the real request URL. Preview already builds `?key=value` via `resolveHydrationTargetUrl`.
 * Fixed in bindingApiCodegen.ts + bindingMutationRuntime.ts: unused paramPaths → URLSearchParams.
 */

const insert = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChild = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

const loadInlinedResolveBindingUrl = (): ((
  endpointTemplate: string,
  context: Record<string, unknown> | null | undefined,
  paramPaths: Record<string, string>,
) => string) => {
  const jsSource = transformSync(renderBindingApiRuntimeHelpers().join('\n'), { loader: 'ts' }).code;
  // eslint-disable-next-line no-new-func
  const module = new Function(`${jsSource}\nreturn { resolveBindingUrl };`)();
  return module.resolveBindingUrl as typeof resolveBindingUrl;
};

describe('bindingApiCodegen query-string root cause fix (parity audit item 28)', () => {
  describe('inlined Export helper (behavioral, via esbuild)', () => {
    it('preserves path-placeholder substitution (legacy behavior)', () => {
      const resolve = loadInlinedResolveBindingUrl();
      expect(resolve('/api/users/{id}', { params: { id: '42' } }, { id: 'params.id' }))
        .toBe('/api/users/42');
    });

    it('appends unused paramPaths as a real query string on a plain endpoint', () => {
      const resolve = loadInlinedResolveBindingUrl();
      expect(resolve(
        '/api/orders',
        { gridToolbar: { search: 'alice' } },
        { search: 'gridToolbar.search' },
      )).toBe('/api/orders?search=alice');
    });

    it('combines path placeholders with leftover query params', () => {
      const resolve = loadInlinedResolveBindingUrl();
      expect(resolve(
        '/api/users/{id}/orders',
        { params: { id: '7' }, gridToolbar: { search: 'open' } },
        { id: 'params.id', search: 'gridToolbar.search' },
      )).toBe('/api/users/7/orders?search=open');
    });

    it('appends multiple query params together', () => {
      const resolve = loadInlinedResolveBindingUrl();
      const url = resolve(
        '/api/orders',
        {
          gridToolbar: { search: 'alice' },
          gridQuery: { sortBy: 'email', page: 2 },
        },
        {
          search: 'gridToolbar.search',
          sortBy: 'gridQuery.sortBy',
          page: 'gridQuery.page',
        },
      );
      const parsed = new URL(url, 'http://local.test');
      expect(parsed.pathname).toBe('/api/orders');
      expect(parsed.searchParams.get('search')).toBe('alice');
      expect(parsed.searchParams.get('sortBy')).toBe('email');
      expect(parsed.searchParams.get('page')).toBe('2');
    });

    it('omits undefined / null / empty / whitespace-only query values (no empty key=)', () => {
      const resolve = loadInlinedResolveBindingUrl();
      expect(resolve(
        '/api/orders',
        {
          gridToolbar: { search: '' },
          gridQuery: { sortBy: '   ', page: undefined as unknown as string },
        },
        {
          search: 'gridToolbar.search',
          sortBy: 'gridQuery.sortBy',
          page: 'gridQuery.page',
          missing: 'gridQuery.missing',
        },
      )).toBe('/api/orders');
    });

    it('appends with & when the template already has a query string', () => {
      const resolve = loadInlinedResolveBindingUrl();
      expect(resolve(
        '/api/orders?tenant=acme',
        { gridToolbar: { search: 'bob' } },
        { search: 'gridToolbar.search' },
      )).toBe('/api/orders?tenant=acme&search=bob');
    });
  });

  describe('shared runtime helper (bindingMutationRuntime) stays in parity', () => {
    it('appends query params the same way as the inlined Export helper', () => {
      expect(resolveBindingUrl(
        '/api/orders',
        { gridToolbar: { search: 'alice' }, gridQuery: { sortBy: 'email' } },
        { search: 'gridToolbar.search', sortBy: 'gridQuery.sortBy' },
      )).toBe('/api/orders?search=alice&sortBy=email');
    });

    it('does not append leftover params onto header template values', () => {
      const headers = resolveBindingHeaders(
        { auth: { token: 'secret' }, gridToolbar: { search: 'alice' } },
        { Authorization: 'Bearer {token}' },
        { token: 'auth.token', search: 'gridToolbar.search' },
      );
      expect(headers.Authorization).toBe('Bearer secret');
      expect(headers.Authorization).not.toContain('?');
      expect(headers.Authorization).not.toContain('search');
    });
  });

  describe('end-to-end Export codegen → real URL', () => {
    it('grid with toolbar queryParams: inlined helper turns store values into ?search=&sortBy=&page=', () => {
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
      assertValidTsxSyntax('grid toolbar query-string e2e', tsx);
      expect(tsx).toContain('new URLSearchParams()');
      expect(tsx).toMatch(/resolveBindingUrl\("\/api\/orders", designerStore, \{[^}]*"search":\s*"gridToolbar\.search"/);

      const resolve = loadInlinedResolveBindingUrl();
      const url = resolve(
        '/api/orders',
        {
          gridToolbar: { search: 'paid' },
          gridQuery: { sortBy: 'month', page: 3 },
        },
        {
          search: 'gridToolbar.search',
          sortBy: 'gridQuery.sortBy',
          page: 'gridQuery.page',
        },
      );
      const parsed = new URL(url, 'http://local.test');
      expect(parsed.searchParams.get('search')).toBe('paid');
      expect(parsed.searchParams.get('sortBy')).toBe('month');
      expect(parsed.searchParams.get('page')).toBe('3');
    });

    it('chart with toolbar search: inlined helper produces ?q= from store path', () => {
      let state = insert(createInitialDesignerState(), 'viz.chart-bar');
      const nodeId = lastChild(state);
      state = designerReducer(state, {
        type: 'set-data-source',
        dataSourceId: 'orders',
        dataSource: {
          id: 'orders',
          name: 'Orders',
          endpoint: '/api/orders',
          fields: ['month', 'revenue', 'status'],
          primaryKey: 'id',
          operations: { list: { method: 'GET', endpoint: '/api/orders' } },
        },
      });
      const chartNode = state.document.nodes[nodeId]!;
      for (const action of buildChartBindingWizardActions(
        chartNode,
        state.bindingDefinitions.dataSources.orders!,
      )) {
        state = designerReducer(state, action);
      }
      state = designerReducer(state, {
        type: 'set-node-prop',
        nodeId,
        key: CHART_TOOLBAR_CONFIG_PROP,
        value: serializeDesignerChartToolbarConfig({
          enabled: true,
          runtimeEnabled: true,
          search: { enabled: true, apiParam: 'q', storePath: 'chartQuery_x.search' },
        }, nodeId),
      });

      const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      assertValidTsxSyntax('chart toolbar query-string e2e', tsx);
      expect(tsx).toContain('new URLSearchParams()');

      const resolve = loadInlinedResolveBindingUrl();
      // Match the store path the toolbar config wired (suffix may be node-scoped — use the
      // same path we configured above).
      expect(resolve(
        '/api/orders',
        { chartQuery_x: { search: 'revenue>100' } },
        { q: 'chartQuery_x.search' },
      )).toBe('/api/orders?q=revenue%3E100');
    });
  });
});
