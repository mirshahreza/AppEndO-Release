/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDesignerHydratedRows } from '../useDesignerHydratedRows';
import { useDesignerGridListRows } from '../useDesignerGridListRows';
import { __resetHydrationCacheForTests } from '../designerPreviewHydrationCache';
import { buildChartBindingWizardActions, resolveChartListDataVarName, CHART_TOOLBAR_CONFIG_PROP } from '../bindingChartEngine';
import {
  createGridListResourceBindingDefinition,
  GRID_LIST_RESOURCE_BINDING_KEY,
} from '../bindingGridEngine';
import { serializeDesignerChartToolbarConfig } from '../designerChartToolbarConfig';
import { normalizeDesignerGridToolbarConfig } from '../designerGridToolbarConfig';
import { createInitialDesignerState, designerReducer } from '../state';
import type { DesignerState } from '../types';

/**
 * Bug found (parity audit item 0): the canvas's only live-data hydration hook (grid-only, no
 * chart/viz equivalent existed at all) always rebuilt a fresh, DEFAULT `designerStore` and its
 * effect never re-ran when a toolbar search/filter value changed — so typing in a chart/grid's
 * search box never actually refetched data in the live Designer canvas. These tests prove the
 * generalized `useDesignerHydratedRows` hook (and its `useDesignerGridListRows` wrapper) now
 * reacts to real store changes, and that an explicit `refresh()` forces a fresh fetch.
 */

const insert = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChild = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

const bindChartToDataSource = (state: DesignerState, nodeId: string): DesignerState => {
  let next = designerReducer(state, {
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
  const chartNode = next.document.nodes[nodeId]!;
  for (const action of buildChartBindingWizardActions(chartNode, next.bindingDefinitions.dataSources.orders!)) {
    next = designerReducer(next, action);
  }
  return next;
};

describe('useDesignerHydratedRows (chart)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    __resetHydrationCacheForTests();
  });

  it('refetches with the new query param when a toolbar-bound store path changes (reactivity fix)', async () => {
    let state = insert(createInitialDesignerState(), 'viz.chart-bar');
    const nodeId = lastChild(state);
    state = bindChartToDataSource(state, nodeId);
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

    const requestedUrls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      requestedUrls.push(String(input));
      return new Response(JSON.stringify({ success: true, data: [{ month: 'Jan', revenue: 100 }] }), { status: 200 });
    });

    const dataVar = resolveChartListDataVarName(nodeId);
    const { result, rerender } = renderHook(
      ({ store }: { store: Record<string, unknown> }) =>
        useDesignerHydratedRows(state.document, state.bindingDefinitions, dataVar, store),
      { initialProps: { store: {} } },
    );

    await waitFor(() => expect(result.current.rows).toBeDefined());
    expect(requestedUrls).toHaveLength(1);
    expect(requestedUrls[0]).not.toContain('q=');

    rerender({ store: { chartQuery_x: { search: 'coffee' } } });

    await waitFor(() => expect(requestedUrls).toHaveLength(2));
    expect(requestedUrls[1]).toContain('q=coffee');
  });

  it('does not refetch when an unrelated store path changes', async () => {
    let state = insert(createInitialDesignerState(), 'viz.chart-line');
    const nodeId = lastChild(state);
    state = bindChartToDataSource(state, nodeId);

    const requestedUrls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      requestedUrls.push(String(input));
      return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
    });

    const dataVar = resolveChartListDataVarName(nodeId);
    const { result, rerender } = renderHook(
      ({ store }: { store: Record<string, unknown> }) =>
        useDesignerHydratedRows(state.document, state.bindingDefinitions, dataVar, store),
      { initialProps: { store: { unrelated: 'x' } } },
    );

    await waitFor(() => expect(result.current.rows).toBeDefined());
    expect(requestedUrls).toHaveLength(1);

    rerender({ store: { unrelated: 'y' } });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(requestedUrls).toHaveLength(1);
  });

  it('refresh() forces a fresh fetch even when the resolved URL is unchanged', async () => {
    let state = insert(createInitialDesignerState(), 'viz.chart-pie');
    const nodeId = lastChild(state);
    state = bindChartToDataSource(state, nodeId);

    let fetchCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      fetchCount += 1;
      return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
    });

    const dataVar = resolveChartListDataVarName(nodeId);
    const { result } = renderHook(() =>
      useDesignerHydratedRows(state.document, state.bindingDefinitions, dataVar, {}),
    );

    await waitFor(() => expect(result.current.rows).toBeDefined());
    expect(fetchCount).toBe(1);

    result.current.refresh();

    await waitFor(() => expect(fetchCount).toBe(2));
  });
});

describe('useDesignerGridListRows wrapper', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    __resetHydrationCacheForTests();
  });

  const buildBoundGridState = () => {
    let state = insert(createInitialDesignerState(), 'heroui.app-table-grid');
    const gridNodeId = lastChild(state);
    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'users',
      dataSource: {
        id: 'users',
        name: 'Users',
        endpoint: '/api/users',
        fields: ['id', 'name'],
      },
    });
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: gridNodeId,
      bindingKey: GRID_LIST_RESOURCE_BINDING_KEY,
      definition: createGridListResourceBindingDefinition('users'),
    });
    const toolbarConfig = normalizeDesignerGridToolbarConfig({
      enabled: true,
      search: { enabled: true, placeholder: 'Search…', storePath: 'gridToolbar.search', apiParam: 'search' },
      // Grid (unlike Chart) only feeds toolbar values into the fetch URL when server-mode
      // querying is explicitly enabled — in client mode it filters already-fetched rows
      // instead (see buildGridListQueryParamBindings's real logic).
      serverQuery: { enabled: true },
    } as never);
    state = designerReducer(state, { type: 'set-grid-toolbar-config', nodeId: gridNodeId, config: toolbarConfig });
    return { state, gridNodeId };
  };

  it('reacts to a live designerStore instead of always rebuilding a fresh default one (regression: grid toolbar search never refetched in canvas)', async () => {
    const { state, gridNodeId } = buildBoundGridState();

    const requestedUrls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      requestedUrls.push(String(input));
      return new Response(JSON.stringify({ success: true, data: [{ id: 1, name: 'Alice' }] }), { status: 200 });
    });

    const { result, rerender } = renderHook(
      ({ store }: { store: Record<string, unknown> }) =>
        useDesignerGridListRows(state.document, state.bindingDefinitions, gridNodeId, store),
      { initialProps: { store: {} } },
    );

    await waitFor(() => expect(result.current.rows).toBeDefined());
    expect(requestedUrls).toHaveLength(1);
    expect(requestedUrls[0]).not.toContain('search=');

    rerender({ store: { gridToolbar: { search: 'alice' } } });

    await waitFor(() => expect(requestedUrls).toHaveLength(2));
    expect(requestedUrls[1]).toContain('search=alice');
  });

  it('honest no-op when the node has no matching hydration target', async () => {
    const state = createInitialDesignerState();
    const requestedUrls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      requestedUrls.push(String(input));
      return new Response('{}', { status: 200 });
    });

    const { result } = renderHook(
      () => useDesignerGridListRows(state.document, state.bindingDefinitions, 'no-such-node', {}),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rows).toBeUndefined();
    expect(requestedUrls).toHaveLength(0);
  });
});
