/**
 * Bug found (gap-analysis §19.5 / phase 38): charts only supported a single chartDataResource —
 * combo charts (e.g. sales columns + cost line from a second API) were impossible.
 * Fixed in bindingChartEngine.ts (chartDataSources array + mergeMultiSourceChartData),
 * bindingCodegen.ts/bindingApiCodegen.ts (parallel useDataFetch + merge in Export),
 * BindingChartWizardDialog (Add another data source), preview/runtime parity.
 */
import { describe, expect, it } from 'vitest';
import { generateDesignerTsx } from '../codegen';
import {
  buildChartBindingWizardActions,
  buildDefaultChartFieldMapping,
  collectDocumentChartPlan,
  mergeMultiSourceChartData,
  parseDesignerChartDataSources,
  resolveChartDataFromMultiSourceDatasets,
  resolveNodeChartDataSourceEntries,
  serializeDesignerChartDataSources,
  transformApiRowsToChartData,
} from '../bindingChartEngine';
import { collectDocumentBindingPlan } from '../bindingEngine';
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

describe('38 — Combo Chart multi data source', () => {
  it('mergeMultiSourceChartData joins series from two transformed datasets by category key', () => {
    const salesRows = transformApiRowsToChartData([
      { month: 'Jan', revenue: 100 },
      { month: 'Feb', revenue: 120 },
    ], {
      chartType: 'bar',
      categoryField: 'month',
      valueFields: [{ field: 'revenue', seriesKey: 'revenue' }],
    });
    const costRows = transformApiRowsToChartData([
      { month: 'Jan', cost: 40 },
      { month: 'Feb', cost: 55 },
    ], {
      chartType: 'line',
      categoryField: 'month',
      valueFields: [{ field: 'cost', seriesKey: 'cost', axis: 'secondary' }],
    });

    const merged = mergeMultiSourceChartData([salesRows, costRows], 'label');
    expect(merged).toEqual([
      { label: 'Jan', revenue: 100, cost: 40 },
      { label: 'Feb', revenue: 120, cost: 55 },
    ]);
  });

  it('resolveNodeChartDataSourceEntries falls back to legacy single binding + chartFieldMapping', () => {
    let state = createInitialDesignerState();
    state = insertItem(state, 'viz.chart-bar');
    const chartId = lastChildId(state, state.document.rootNodeId);
    const chartNode = state.document.nodes[chartId]!;

    for (const action of buildChartBindingWizardActions(chartNode, [{
      dataSource: {
        id: 'sales',
        name: 'Sales',
        endpoint: '/api/sales',
        fields: ['month', 'revenue'],
      },
    }])) {
      state = designerReducer(state, action);
    }

    const updatedNode = state.document.nodes[chartId]!;
    const entries = resolveNodeChartDataSourceEntries(updatedNode);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.dataSourceRef).toBe('sales');
  });

  it('collectDocumentChartPlan emits two fetches for a combo chart document', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'sales',
      dataSource: {
        id: 'sales',
        name: 'Sales',
        endpoint: '/api/sales',
        fields: ['month', 'revenue'],
      },
    });
    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'costs',
      dataSource: {
        id: 'costs',
        name: 'Costs',
        endpoint: '/api/costs',
        fields: ['month', 'cost'],
      },
    });
    state = insertItem(state, 'viz.chart-bar');
    const chartId = lastChildId(state, state.document.rootNodeId);
    const chartNode = state.document.nodes[chartId]!;

    const salesMapping = buildDefaultChartFieldMapping(['month', 'revenue'], 'bar');
    const costMapping = buildDefaultChartFieldMapping(['month', 'cost'], 'line');
    if (salesMapping.chartType === 'bar') {
      salesMapping.valueFields = [{ field: 'revenue', seriesKey: 'revenue' }];
    }
    if (costMapping.chartType === 'line') {
      costMapping.valueFields = [{ field: 'cost', seriesKey: 'cost', axis: 'secondary' }];
    }

    for (const action of buildChartBindingWizardActions(chartNode, [
      { dataSource: state.bindingDefinitions.dataSources.sales!, fieldMapping: salesMapping },
      { dataSource: state.bindingDefinitions.dataSources.costs!, fieldMapping: costMapping },
    ])) {
      state = designerReducer(state, action);
    }

    const plan = collectDocumentChartPlan(state.document, state.bindingDefinitions);
    const chartFetches = plan.chartListFetches.filter((fetch) => fetch.nodeId === chartId);
    expect(chartFetches).toHaveLength(2);
    expect(chartFetches.map((fetch) => fetch.dataSourceId).sort()).toEqual(['costs', 'sales']);
    expect(new Set(chartFetches.map((fetch) => fetch.dataVar)).size).toBe(2);
  });

  it('export codegen includes two useDataFetch hooks and mergeMultiSourceChartData for combo chart', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'sales',
      dataSource: {
        id: 'sales',
        name: 'Sales',
        endpoint: '/api/sales',
        fields: ['month', 'revenue'],
      },
    });
    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'costs',
      dataSource: {
        id: 'costs',
        name: 'Costs',
        endpoint: '/api/costs',
        fields: ['month', 'cost'],
      },
    });
    state = insertItem(state, 'viz.chart-bar');
    const chartId = lastChildId(state, state.document.rootNodeId);
    const chartNode = state.document.nodes[chartId]!;

    const salesMapping = buildDefaultChartFieldMapping(['month', 'revenue'], 'bar');
    const costMapping = buildDefaultChartFieldMapping(['month', 'cost'], 'line');
    if (salesMapping.chartType === 'bar') {
      salesMapping.valueFields = [{ field: 'revenue', seriesKey: 'revenue' }];
    }
    if (costMapping.chartType === 'line') {
      costMapping.valueFields = [{ field: 'cost', seriesKey: 'cost' }];
    }

    for (const action of buildChartBindingWizardActions(chartNode, [
      { dataSource: state.bindingDefinitions.dataSources.sales!, fieldMapping: salesMapping },
      { dataSource: state.bindingDefinitions.dataSources.costs!, fieldMapping: costMapping },
    ])) {
      state = designerReducer(state, action);
    }

    const bindingPlan = collectDocumentBindingPlan(state.document, state.bindingDefinitions);
    expect(bindingPlan.chartPlan.chartListFetches.filter((fetch) => fetch.nodeId === chartId)).toHaveLength(2);

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    const dataFetchMatches = tsx.match(/useDataFetch<unknown>\(/g) ?? [];
    expect(dataFetchMatches.length).toBeGreaterThanOrEqual(2);
    expect(tsx).toMatch(/mergeMultiSourceChartData\(\[/);
    expect(tsx).toMatch(/transformApiRowsToChartData\(/);
    expect(tsx).toMatch(/\/api\/sales/);
    expect(tsx).toMatch(/\/api\/costs/);
  });

  it('resolveChartDataFromMultiSourceDatasets combines runtime preview rows', () => {
    const salesMapping = buildDefaultChartFieldMapping(['month', 'revenue'], 'bar');
    const costMapping = buildDefaultChartFieldMapping(['month', 'cost'], 'line');
    if (salesMapping.chartType === 'bar') {
      salesMapping.valueFields = [{ field: 'revenue', seriesKey: 'revenue' }];
    }
    if (costMapping.chartType === 'line') {
      costMapping.valueFields = [{ field: 'cost', seriesKey: 'cost' }];
    }

    const resolved = resolveChartDataFromMultiSourceDatasets([
      {
        rows: [{ month: 'Jan', revenue: 80 }, { month: 'Feb', revenue: 90 }],
        fieldMapping: salesMapping,
      },
      {
        rows: [{ month: 'Jan', cost: 20 }, { month: 'Feb', cost: 25 }],
        fieldMapping: costMapping,
      },
    ], 'revenue,cost', 'bar');

    expect(resolved.data).toEqual([
      { label: 'Jan', revenue: 80, cost: 20 },
      { label: 'Feb', revenue: 90, cost: 25 },
    ]);
    expect(resolved.seriesKeys.split(',').sort()).toEqual(['cost', 'revenue']);
  });

  it('chartDataSources prop round-trips through serialize/parse', () => {
    const salesMapping = buildDefaultChartFieldMapping(['month', 'revenue'], 'bar');
    const costMapping = buildDefaultChartFieldMapping(['month', 'cost'], 'line');
    const serialized = serializeDesignerChartDataSources([
      { dataSourceRef: 'sales', fieldMapping: salesMapping },
      { dataSourceRef: 'costs', fieldMapping: costMapping },
    ]);
    const parsed = parseDesignerChartDataSources(serialized, { chartTypeHint: 'bar' });
    expect(parsed).toHaveLength(2);
    expect(parsed?.[0]?.dataSourceRef).toBe('sales');
    expect(parsed?.[1]?.dataSourceRef).toBe('costs');
  });
});
