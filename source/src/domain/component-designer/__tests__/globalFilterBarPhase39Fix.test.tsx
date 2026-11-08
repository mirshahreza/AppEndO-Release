/**
 * Bug found (gap-analysis #4 / phase 39): no Global Filter Bar, cross-filtering between widgets,
 * or period comparison on bar/line charts — multi-widget dashboards could not share filters.
 * Fixed in designerDashboardFilterBarConfig.ts, DesignerRuntimeFilterBar.tsx,
 * bindingFilterBindingsEngine.ts, bindingChartEngine.ts (filterBindings + comparisonSeries),
 * bindingDynamicActionsEngine/Runtime/Codegen (updateFilterFromClick), designerVizPalette/runtime.
 */
/** @vitest-environment jsdom */
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { generateDesignerTsx } from '../codegen';
import {
  CHART_DATA_RESOURCE_BINDING_KEY,
  collectDocumentChartPlan,
  createChartDataResourceBindingDefinition,
  parseDesignerChartFieldMapping,
  resolveNodeChartDataSourceEntries,
  serializeDesignerChartFieldMapping,
} from '../bindingChartEngine';
import {
  buildFilterBindingQueryParams,
  mergeQueryParamsWithFilterBindings,
} from '../bindingFilterBindingsEngine';
import {
  createDynamicAction,
  resolveDynamicActions,
} from '../bindingDynamicActionsEngine';
import { executeDynamicAction } from '../bindingDynamicActionsRuntime';
import { createChartDataPointClickEvent } from '../bindingChartEngine';
import { DesignerRuntimeFilterBar } from '../DesignerRuntimeFilterBar';
import { DEFAULT_DASHBOARD_FILTER_BAR_CONFIG, parseDashboardFilterBarConfig, serializeDashboardFilterBarConfig } from '../designerDashboardFilterBarConfig';
import { createInitialDesignerState, designerReducer } from '../state';
import type { DesignerState } from '../types';

const insertItem = (state: DesignerState, itemId: string): DesignerState =>
  designerReducer(state, {
    type: 'insert-palette-item',
    itemId,
    parentId: state.document.rootNodeId,
  });

const lastChildId = (state: DesignerState, parentId: string): string => {
  const parent = state.document.nodes[parentId];
  return parent.children[parent.children.length - 1] as string;
};

describe('39 — Global Filter Bar + cross-filter + period comparison', () => {
  it('buildFilterBindingQueryParams maps store paths to API param names', () => {
    expect(buildFilterBindingQueryParams(['dashboardFilters.category', 'dashboardFilters.period.from'])).toEqual({
      category: 'dashboardFilters.category',
      from: 'dashboardFilters.period.from',
    });
  });

  it('mergeQueryParamsWithFilterBindings preserves toolbar params and adds dashboard filters', () => {
    expect(mergeQueryParamsWithFilterBindings(
      { search: 'chartQuery.node.search' },
      ['dashboardFilters.category'],
    )).toEqual({
      search: 'chartQuery.node.search',
      category: 'dashboardFilters.category',
    });
  });

  it('collectDocumentChartPlan includes comparisonSeries as an extra fetch', () => {
    let state = createInitialDesignerState();
    state = insertItem(state, 'viz.chart-bar');
    const chartId = lastChildId(state, state.document.rootNodeId);

    const mapping = {
      chartType: 'bar' as const,
      categoryField: 'month',
      categoryAs: 'label',
      valueFields: [{ field: 'revenue', seriesKey: 'revenue', aggregation: 'sum' as const }],
      comparisonSeries: { dataSourceRef: 'salesPrev', label: 'Previous month' },
    };

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: chartId,
      bindingKey: CHART_DATA_RESOURCE_BINDING_KEY,
      definition: createChartDataResourceBindingDefinition('salesCurrent'),
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: chartId,
      key: 'chartFieldMapping',
      value: serializeDesignerChartFieldMapping(mapping),
    });
    state = {
      ...state,
      bindingDefinitions: {
        ...state.bindingDefinitions,
        dataSources: {
          salesCurrent: {
            id: 'salesCurrent',
            name: 'Sales current',
            endpoint: '/api/sales/current',
            fields: ['month', 'revenue'],
          },
          salesPrev: {
            id: 'salesPrev',
            name: 'Sales previous',
            endpoint: '/api/sales/previous',
            fields: ['month', 'revenue'],
          },
        },
      },
    };

    const entries = resolveNodeChartDataSourceEntries(state.document.nodes[chartId]!);
    expect(entries).toHaveLength(2);
    expect(entries[1]?.dataSourceRef).toBe('salesPrev');

    const plan = collectDocumentChartPlan(state.document, state.bindingDefinitions);
    const chartFetches = plan.chartListFetches.filter((entry) => entry.nodeId === chartId);
    expect(chartFetches).toHaveLength(2);
    expect(chartFetches[1]?.dataSourceId).toBe('salesPrev');
  });

  it('updateFilterFromClick dynamic action writes clicked category to store', async () => {
    const actions = resolveDynamicActions({
      sourceType: 'static',
      targetEvent: 'onDataPointClick',
      trueActions: [{
        ...createDynamicAction('updateFilterFromClick'),
        filterStorePath: 'dashboardFilters.category',
        filterValueSource: 'clickCategory',
      }],
    }, { definitions: {}, storeSegments: {}, dataSources: {}, lovs: {} });

    expect(actions).toHaveLength(1);
    expect(actions[0]?.type).toBe('updateFilterFromClick');

    const patches: Array<{ path: string; value: unknown }> = [];
    const clickEvent = createChartDataPointClickEvent({
      category: 'Product A',
      seriesKey: 'revenue',
      value: 42,
      row: { label: 'Product A', revenue: 42 },
    });

    await executeDynamicAction(actions[0]!, {
      designerStore: {},
      patchStore: (path, value) => {
        patches.push({ path, value });
      },
    }, clickEvent);

    expect(patches).toEqual([{ path: 'dashboardFilters.category', value: 'Product A' }]);
  });

  it('filter bar patchStore updates shared query params on bound chart hydration targets', async () => {
    let state = createInitialDesignerState();
    state = insertItem(state, 'dashboard.filter-bar');
    state = insertItem(state, 'viz.chart-bar');
    const root = state.document.nodes[state.document.rootNodeId]!;
    const filterBarId = root.children[0] as string;
    const chartId = root.children[1] as string;

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: filterBarId,
      key: 'filterBarConfig',
      value: serializeDashboardFilterBarConfig({
        filters: [{
          id: 'category',
          label: 'Category',
          type: 'select',
          apiParam: 'category',
          storePath: 'dashboardFilters.category',
          options: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }],
        }],
      }),
    });

    const sharedFilterBindings = ['dashboardFilters.category'];
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: chartId,
      bindingKey: CHART_DATA_RESOURCE_BINDING_KEY,
      definition: createChartDataResourceBindingDefinition('salesA', {
        filterBindings: sharedFilterBindings,
        queryParams: buildFilterBindingQueryParams(sharedFilterBindings),
      }),
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: chartId,
      key: 'chartFieldMapping',
      value: serializeDesignerChartFieldMapping({
        chartType: 'bar',
        categoryField: 'month',
        categoryAs: 'label',
        valueFields: [{ field: 'revenue', seriesKey: 'revenue', aggregation: 'sum' }],
      }),
    });
    state = {
      ...state,
      bindingDefinitions: {
        ...state.bindingDefinitions,
        dataSources: {
          salesA: {
            id: 'salesA',
            name: 'Sales A',
            endpoint: '/api/sales/a',
            fields: ['month', 'revenue'],
          },
        },
      },
    };

    const plan = collectDocumentChartPlan(state.document, state.bindingDefinitions);
    const chartFetch = plan.chartListFetches.find((entry) => entry.nodeId === chartId);
    expect(chartFetch?.queryParams).toEqual({ category: 'dashboardFilters.category' });

    const patchCalls: Array<{ path: string; value: unknown }> = [];
    const { container } = render(
      <DesignerRuntimeFilterBar
        config={parseDashboardFilterBarConfig(state.document.nodes[filterBarId]!.props.filterBarConfig)}
        designerStore={{}}
        onStorePathChange={(path, value) => {
          patchCalls.push({ path, value });
        }}
      />,
    );

    const categorySelect = container.querySelector('[data-testid="hidden-select-container"] select') as HTMLSelectElement;
    expect(categorySelect).toBeTruthy();
    fireEvent.change(categorySelect, { target: { value: 'b' } });
    expect(patchCalls).toEqual([{ path: 'dashboardFilters.category', value: 'b' }]);
  });

  it('export codegen includes DesignerRuntimeFilterBar and updateFilterFromClick handler', () => {
    let state = createInitialDesignerState();
    state = insertItem(state, 'dashboard.filter-bar');
    state = insertItem(state, 'viz.chart-bar');
    const root = state.document.nodes[state.document.rootNodeId]!;
    const filterBarId = root.children[0] as string;
    const chartId = root.children[1] as string;

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: filterBarId,
      key: 'filterBarConfig',
      value: serializeDashboardFilterBarConfig(DEFAULT_DASHBOARD_FILTER_BAR_CONFIG),
    });
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: chartId,
      bindingKey: CHART_DATA_RESOURCE_BINDING_KEY,
      definition: createChartDataResourceBindingDefinition('sales', {
        filterBindings: ['dashboardFilters.category'],
        queryParams: buildFilterBindingQueryParams(['dashboardFilters.category']),
      }),
    });
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: chartId,
      bindingKey: 'onDataPointClick',
      definition: {
        sourceType: 'static',
        targetEvent: 'onDataPointClick',
        trueActions: [{
          ...createDynamicAction('updateFilterFromClick'),
          filterStorePath: 'dashboardFilters.category',
          filterValueSource: 'clickCategory',
        }],
      },
    });
    state = {
      ...state,
      bindingDefinitions: {
        ...state.bindingDefinitions,
        dataSources: {
          sales: {
            id: 'sales',
            name: 'Sales',
            endpoint: '/api/sales',
            fields: ['month', 'revenue'],
          },
        },
      },
    };

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain("import { DesignerRuntimeFilterBar } from '@/domain/component-designer/DesignerRuntimeFilterBar';");
    expect(tsx).toContain('<DesignerRuntimeFilterBar');
    expect(tsx).toContain('"category": "dashboardFilters.category"');

    const mapping = parseDesignerChartFieldMapping(state.document.nodes[chartId]!.props.chartFieldMapping);
    expect(mapping?.chartType === 'bar' || mapping?.chartType === 'line' ? mapping.comparisonSeries : undefined).toBeUndefined();
  });
});
