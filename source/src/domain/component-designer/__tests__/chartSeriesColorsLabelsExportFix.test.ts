import { describe, expect, it } from 'vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import { buildChartBindingWizardActions } from '../bindingChartEngine';
import type { DesignerState } from '../types';

/**
 * Bug found (parity audit item 10): the Chart wizard's per-series "Legend label"/"Color" editors
 * are real and work correctly in the live canvas/interactive Preview (resolved from the field
 * mapping via resolveChartSeriesColorsFromMapping/resolveChartSeriesLabelsFromMapping in
 * DesignerRuntimeCharts.tsx), but Export (`renderChartJsx` in tsxVizPalette.ts) never emitted the
 * `seriesColors`/`seriesLabels` props at all — a published chart always fell back to default
 * index-based colors and raw field-name labels, even when the user configured custom ones.
 */

const insert = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChild = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

const seedOrdersDataSource = (state: DesignerState): DesignerState =>
  designerReducer(state, {
    type: 'set-data-source',
    dataSourceId: 'orders',
    dataSource: {
      id: 'orders',
      name: 'Orders',
      endpoint: '/api/orders',
      fields: ['month', 'revenue', 'cost'],
      primaryKey: 'id',
      operations: { list: { method: 'GET', endpoint: '/api/orders' } },
    },
  });

describe('chart series colors/labels export fix (parity audit item 10)', () => {
  it('exports real seriesColors/seriesLabels props from the configured field mapping', () => {
    let state = insert(createInitialDesignerState(), 'viz.chart-bar');
    const nodeId = lastChild(state);
    state = seedOrdersDataSource(state);
    const chartNode = state.document.nodes[nodeId]!;
    for (const action of buildChartBindingWizardActions(chartNode, state.bindingDefinitions.dataSources.orders!, {
      fieldMapping: {
        categoryField: 'month',
        series: [
          { apiField: 'revenue', seriesKey: 'revenue', label: 'Revenue (USD)', color: '#0EA5E9' },
          { apiField: 'cost', seriesKey: 'cost', color: '#F97316' },
        ],
      },
    })) {
      state = designerReducer(state, action);
    }

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('bound chart-bar with custom series colors/labels', tsx);

    expect(tsx).toMatch(/seriesColors=\{\{"revenue":"#0EA5E9","cost":"#F97316"\}\}/);
    expect(tsx).toMatch(/seriesLabels=\{\{"revenue":"Revenue \(USD\)"\}\}/);
    // 'cost' has no custom label configured, so it must not appear in seriesLabels at all.
    expect(tsx).not.toMatch(/"cost":"cost"/);
  });

  it('omits seriesColors/seriesLabels attrs entirely when the chart is not bound (static mode)', () => {
    const state = insert(createInitialDesignerState(), 'viz.chart-line');
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('static chart-line, no binding', tsx);
    expect(tsx).not.toContain('seriesColors=');
    expect(tsx).not.toContain('seriesLabels=');
  });

  it('still never leaks the raw chartFieldMapping JSON prop as a literal attribute', () => {
    let state = insert(createInitialDesignerState(), 'viz.chart-pie');
    const nodeId = lastChild(state);
    state = seedOrdersDataSource(state);
    const chartNode = state.document.nodes[nodeId]!;
    for (const action of buildChartBindingWizardActions(chartNode, state.bindingDefinitions.dataSources.orders!, {
      fieldMapping: {
        categoryField: 'month',
        series: [{ apiField: 'revenue', seriesKey: 'revenue', color: '#0EA5E9' }],
      },
    })) {
      state = designerReducer(state, action);
    }

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('bound chart-pie with series color', tsx);
    expect(tsx).not.toMatch(/\schartFieldMapping=/);
  });
});
