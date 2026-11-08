/**
 * @vitest-environment jsdom
 *
 * Bug found (gap analysis §15.1/§15.2 + Phase 52): catalog had zero advanced statistical charts
 * (Scatter/Radar/Heatmap/Funnel/Waterfall/Treemap/Sankey/Candlestick/Boxplot) and zero Map/Geo
 * elements — only bar/line/pie/sparkline existed.
 * Fixed in designerVizPalette / DesignerRuntimeAdvancedCharts / DesignerRuntimeMaps / UiAdvancedCharts /
 * UiMap / tsxVizPalette: unified `viz.chart` + chartType, plus `viz.map-pin` / `viz.map-choropleth`.
 */
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { renderVizPaletteNode } from '../designerVizRuntime';
import { ADVANCED_CHART_TYPES, DesignerVizAdvancedChart } from '../DesignerRuntimeAdvancedCharts';
import { DesignerVizMapChoropleth, DesignerVizMapPin } from '../DesignerRuntimeMaps';
import {
  DesignerVizBarChart,
  DesignerVizLineChart,
  DesignerVizPieChart,
  DesignerVizSparkline,
} from '../DesignerRuntimeCharts';
import { resolveInspectorFieldSections } from '../inspectorRegistry';
import {
  DESIGNER_VIZ_PALETTE_ITEMS,
  isVizChartPaletteItemId,
  VIZ_PALETTE_ITEM_IDS,
} from '../designerVizPalette';
import {
  MOCK_ADVANCED_CHART_DATA_BY_TYPE,
  MOCK_CHART_SALES_Q1_JSON,
  MOCK_MAP_CHOROPLETH_JSON,
  MOCK_MAP_PINS_JSON,
} from '../visualizationMockFixtures';
import type { DesignerState } from '../types';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';

const insert = (state: DesignerState, itemId: string): DesignerState =>
  designerReducer(state, {
    type: 'insert-palette-item',
    itemId,
    parentId: state.document.rootNodeId,
  });

const lastChildId = (state: DesignerState): string => {
  const parent = state.document.nodes[state.document.rootNodeId]!;
  return parent.children[parent.children.length - 1] as string;
};

beforeEach(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Phase 52 — advanced charts + Map/Geo', () => {
  it('registers viz.chart / viz.map-pin / viz.map-choropleth without removing the four classic charts', () => {
    expect(VIZ_PALETTE_ITEM_IDS).toContain('viz.chart');
    expect(VIZ_PALETTE_ITEM_IDS).toContain('viz.map-pin');
    expect(VIZ_PALETTE_ITEM_IDS).toContain('viz.map-choropleth');
    expect(VIZ_PALETTE_ITEM_IDS).toContain('viz.chart-bar');
    expect(VIZ_PALETTE_ITEM_IDS).toContain('viz.chart-line');
    expect(VIZ_PALETTE_ITEM_IDS).toContain('viz.chart-pie');
    expect(VIZ_PALETTE_ITEM_IDS).toContain('viz.chart-sparkline');
    expect(isVizChartPaletteItemId('viz.chart')).toBe(true);
    expect(isVizChartPaletteItemId('viz.chart-bar')).toBe(true);
    expect(DESIGNER_VIZ_PALETTE_ITEMS.some((item) => item.id === 'viz.chart')).toBe(true);
  });

  it.each(ADVANCED_CHART_TYPES)('renders advanced chartType=%s without crashing', (chartType) => {
    const { container } = render(
      <DesignerVizAdvancedChart
        chartType={chartType}
        data={MOCK_ADVANCED_CHART_DATA_BY_TYPE[chartType]}
        seriesKeys={chartType === 'radar' ? 'alpha,beta' : chartType === 'scatter' ? 'y' : 'value'}
        xAxisKey={chartType === 'scatter' || chartType === 'heatmap' ? 'x' : chartType === 'boxplot' ? 'group' : 'label'}
        yAxisKey="y"
        valueKey="value"
        sizeKey={chartType === 'scatter' ? 'size' : undefined}
        height={200}
        title={`Test ${chartType}`}
      />,
    );
    expect(container.querySelector('[data-designer-component="viz.chart"]')).toBeTruthy();
    expect(container.querySelector(`[data-chart-type="${chartType}"]`)).toBeTruthy();
    expect(screen.getByText(`Test ${chartType}`)).toBeTruthy();
  });

  it('renders map-pin and map-choropleth without crashing (jsdom fallback list)', () => {
    const pin = render(
      <DesignerVizMapPin title="Pins" data={MOCK_MAP_PINS_JSON} height={200} />,
    );
    expect(pin.container.querySelector('[data-designer-component="viz.map-pin"]')).toBeTruthy();
    expect(
      pin.container.querySelector('[data-map-fallback="true"]')
      || pin.container.querySelector('[data-map-canvas="pin"]'),
    ).toBeTruthy();
    expect(pin.container.textContent).toContain('Tehran HQ');

    const choro = render(
      <DesignerVizMapChoropleth title="Regions" data={MOCK_MAP_CHOROPLETH_JSON} height={200} />,
    );
    expect(choro.container.querySelector('[data-designer-component="viz.map-choropleth"]')).toBeTruthy();
    expect(choro.container.textContent).toContain('Tehran');
  });

  it('exposes advanced chart Inspector fields and type-specific keys for viz.chart', () => {
    let state = createInitialDesignerState();
    state = insert(state, 'viz.chart');
    const nodeId = lastChildId(state);
    const node = state.document.nodes[nodeId]!;
    const keys = resolveInspectorFieldSections(node)
      .flatMap((section) => section.fields)
      .map((field) => field.key);
    expect(keys).toContain('chartType');
    expect(keys).toContain('sizeKey');
    expect(keys).toContain('showTrendline');
    expect(keys).toContain('maxValue');
    expect(keys).toContain('yAxisKey');
  });

  it('exports viz.chart / map elements through codegen with valid TSX', () => {
    let state = createInitialDesignerState();
    state = insert(state, 'viz.chart');
    const chartId = lastChildId(state);
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: chartId,
      key: 'chartType',
      value: 'funnel',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: chartId,
      key: 'data',
      value: MOCK_ADVANCED_CHART_DATA_BY_TYPE.funnel,
    });
    state = insert(state, 'viz.map-pin');
    state = insert(state, 'viz.map-choropleth');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('phase52-advanced-chart-maps', tsx);
    expect(tsx).toContain('DesignerVizAdvancedChart');
    expect(tsx).toContain('chartType="funnel"');
    expect(tsx).toContain('DesignerVizMapPin');
    expect(tsx).toContain('DesignerVizMapChoropleth');
    expect(tsx).toMatch(/from ['"]@\/domain\/component-designer\/DesignerRuntimeAdvancedCharts['"]/);
    expect(tsx).toMatch(/from ['"]@\/domain\/component-designer\/DesignerRuntimeMaps['"]/);
  });

  it('wires viz.chart through renderVizPaletteNode (design mode)', () => {
    let state = createInitialDesignerState();
    state = insert(state, 'viz.chart');
    const node = state.document.nodes[lastChildId(state)]!;
    const element = renderVizPaletteNode(node, { mode: 'design' });
    expect(element).toBeTruthy();
    const { container } = render(<>{element}</>);
    expect(container.querySelector('[data-designer-component="viz.chart"]')).toBeTruthy();
  });

  it('keeps classic bar/line/pie/sparkline renderers intact', () => {
    const bar = render(<DesignerVizBarChart data={MOCK_CHART_SALES_Q1_JSON} seriesKeys="revenue,cost" height={160} />);
    expect(bar.container.querySelector('[data-designer-component="viz.chart-bar"]')).toBeTruthy();

    const line = render(<DesignerVizLineChart data={MOCK_CHART_SALES_Q1_JSON} seriesKeys="revenue" height={160} />);
    expect(line.container.querySelector('[data-designer-component="viz.chart-line"]')).toBeTruthy();

    const pie = render(<DesignerVizPieChart data={MOCK_CHART_SALES_Q1_JSON} seriesKeys="revenue" height={160} />);
    expect(pie.container.querySelector('[data-designer-component="viz.chart-pie"]')).toBeTruthy();

    const spark = render(<DesignerVizSparkline data={MOCK_CHART_SALES_Q1_JSON} seriesKeys="revenue" height={40} />);
    expect(spark.container.querySelector('[data-designer-component="viz.chart-sparkline"]')).toBeTruthy();
  });

  it('renders advanced chart inside interactive preview document', () => {
    let state = createInitialDesignerState();
    state = insert(state, 'viz.chart');
    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.querySelector('[data-designer-component="viz.chart"]')).toBeTruthy();
  });
});
