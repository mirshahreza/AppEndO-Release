import { describe, expect, it } from 'vitest';
import { createInitialDesignerState, designerReducer } from '../state';
import {
  buildChartBindingWizardActions,
  CHART_DATA_RESOURCE_BINDING_KEY,
  collectDocumentChartPlan,
  createChartDataResourceBindingDefinition,
  getNodeChartDataResourceRef,
  isChartNode,
  parseDesignerChartFieldMapping,
  resolveChartListDataVarName,
  transformApiRowsToChartData,
} from '../bindingChartEngine';
import { buildChartListQueryParamBindings } from '../designerChartToolbarConfig';
import { collectDocumentBindingPlan } from '../bindingEngine';

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

describe('bindingChartEngine', () => {
  it('detects chart nodes and resolves chart data var names', () => {
    let state = createInitialDesignerState();
    const chartInsert = insertNode(state, 'viz.chart-bar', state.document.rootNodeId);
    const node = chartInsert.state.document.nodes[chartInsert.nodeId]!;

    expect(isChartNode(node)).toBe(true);
    expect(resolveChartListDataVarName(chartInsert.nodeId)).toMatch(/^chartData_/);
  });

  it('transforms API rows into chart data rows', () => {
    const mapping = {
      categoryField: 'month',
      categoryAs: 'label',
      series: [
        { apiField: 'revenue', seriesKey: 'revenue' },
        { apiField: 'cost', seriesKey: 'cost' },
      ],
    };

    const rows = transformApiRowsToChartData([
      { month: 'Jan', revenue: 100, cost: 40 },
      { month: 'Feb', revenue: '150', cost: 55 },
    ], mapping);

    expect(rows).toEqual([
      { label: 'Jan', revenue: 100, cost: 40 },
      { label: 'Feb', revenue: 150, cost: 55 },
    ]);
  });

  it('collects chart plan and binding plan hydration targets', () => {
    let state = createInitialDesignerState();
    const chartInsert = insertNode(state, 'viz.chart-bar', state.document.rootNodeId);
    state = chartInsert.state;

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'products',
      dataSource: {
        id: 'products',
        name: 'Products',
        endpoint: '/api/products',
        fields: ['name', 'price', 'qty'],
        primaryKey: 'id',
        operations: { list: { method: 'GET', endpoint: '/api/products' } },
      },
    });

    const chartNode = state.document.nodes[chartInsert.nodeId]!;
    for (const action of buildChartBindingWizardActions(chartNode, state.bindingDefinitions.dataSources.products!)) {
      state = designerReducer(state, action);
    }

    expect(getNodeChartDataResourceRef(state.document.nodes[chartInsert.nodeId]!)).toBe('products');

    const chartPlan = collectDocumentChartPlan(state.document, state.bindingDefinitions);
    expect(chartPlan.chartListFetches).toHaveLength(1);
    expect(chartPlan.chartListFetches[0]?.fetchConfig.endpointTemplate).toBe('/api/products');

    const bindingPlan = collectDocumentBindingPlan(state.document, state.bindingDefinitions);
    expect(bindingPlan.chartPlan.chartListFetches).toHaveLength(1);
  });

  it('builds query param bindings for chart toolbar filters', () => {
    const bindings = buildChartListQueryParamBindings({
      enabled: true,
      search: { enabled: true, storePath: 'chartQuery_a.search', apiParam: 'search' },
      dateRange: {
        enabled: true,
        fromStorePath: 'chartQuery_a.dateFrom',
        toStorePath: 'chartQuery_a.dateTo',
        fromApiParam: 'from',
        toApiParam: 'to',
      },
    }, 'node-a');

    expect(bindings.search).toBe('chartQuery_a.search');
    expect(bindings.from).toBe('chartQuery_a.dateFrom');
    expect(bindings.to).toBe('chartQuery_a.dateTo');
  });

  it('aggregates duplicate categories when series aggregation is set', () => {
    const mapping = {
      categoryField: 'month',
      categoryAs: 'label',
      series: [{ apiField: 'revenue', seriesKey: 'revenue', aggregation: 'sum' as const }],
    };

    const rows = transformApiRowsToChartData([
      { month: 'Jan', revenue: 100 },
      { month: 'Jan', revenue: 50 },
      { month: 'Feb', revenue: 80 },
    ], mapping);

    expect(rows).toEqual([
      { label: 'Jan', revenue: 150 },
      { label: 'Feb', revenue: 80 },
    ]);
  });

  it('resolves series colors and labels from mapping', () => {
    const mapping = parseDesignerChartFieldMapping(JSON.stringify({
      categoryField: 'label',
      series: [{
        apiField: 'value',
        seriesKey: 'value',
        label: 'Sales',
        color: '#FF0000',
        aggregation: 'sum',
      }],
    }));

    expect(mapping?.chartType).toBe('bar');
    if (mapping?.chartType !== 'bar' && mapping?.chartType !== 'line') {
      throw new Error('expected bar/line mapping');
    }
    expect(mapping.valueFields[0]?.label).toBe('Sales');
    expect(mapping.valueFields[0]?.color).toBe('#FF0000');
  });

  it('migrates legacy categoryField/series JSON into discriminated chartType union', () => {
    const pie = parseDesignerChartFieldMapping({
      categoryField: 'name',
      series: [{ apiField: 'amount', seriesKey: 'amount' }],
    }, { chartTypeHint: 'gauge' });

    expect(pie).toEqual({
      chartType: 'gauge',
      labelField: 'name',
      valueField: 'amount',
    });
  });

  it('derives hydration query params from toolbar config prop', () => {
    let state = createInitialDesignerState();
    const chartInsert = insertNode(state, 'viz.chart-bar', state.document.rootNodeId);
    state = chartInsert.state;

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'products',
      dataSource: {
        id: 'products',
        name: 'Products',
        endpoint: '/api/products',
        fields: ['name', 'price'],
        primaryKey: 'id',
        operations: { list: { method: 'GET', endpoint: '/api/products' } },
      },
    });

    const nodeId = chartInsert.nodeId;
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId,
      bindingKey: CHART_DATA_RESOURCE_BINDING_KEY,
      definition: createChartDataResourceBindingDefinition('products'),
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'chartToolbarConfig',
      value: JSON.stringify({
        enabled: true,
        search: {
          enabled: true,
          storePath: `chartQuery_${nodeId.replace(/[^a-zA-Z0-9_]/g, '_')}.search`,
          apiParam: 'search',
        },
      }),
    });

    const chartPlan = collectDocumentChartPlan(state.document, state.bindingDefinitions);
    expect(chartPlan.chartListFetches[0]?.queryParams?.search).toContain('chartQuery_');
  });

  it('creates chart data resource binding definition', () => {
    const definition = createChartDataResourceBindingDefinition('sales', {
      queryParams: { search: 'chartQuery_x.search' },
    });

    expect(definition.dataSourceRef).toBe('sales');
    expect(definition.loadOperation).toBe('list');
    expect(definition.queryParams?.search).toBe('chartQuery_x.search');
    expect(CHART_DATA_RESOURCE_BINDING_KEY).toBe('chartDataResource');
  });
});
