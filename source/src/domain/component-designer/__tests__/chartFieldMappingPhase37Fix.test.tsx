/**
 * @vitest-environment jsdom
 *
 * Bug found (parity audit phase 37 / gap-analysis §19.1 + per-element §14 #11/#12):
 * Chart Field Mapping was type-agnostic for all four chart widgets; Gauge clamped 0–100 with
 * no min/max/thresholds; charts lacked onDataPointClick in the Event Eligibility Matrix.
 * Fixed in bindingChartEngine.ts (discriminated ChartFieldMapping + migration),
 * BindingChartFieldMappingStep/Wizard, UiChart gauge presentation, DesignerRuntimeCharts,
 * bindingEngine (onDataPointClick), Inspector gauge fields, designerVizRuntime wiring.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { resolveUiChartGaugePresentation, UiChartGauge } from '../../../shared/ui/UiChart';
import {
  buildDefaultChartFieldMapping,
  createChartDataPointClickEvent,
  parseDesignerChartFieldMapping,
  resolveChartDataPointClickPayload,
  resolveChartMappingTypeFromNode,
  serializeDesignerChartFieldMapping,
  toChartRuntimeTransformMapping,
  transformApiRowsToChartData,
} from '../bindingChartEngine';
import { resolveNodeEventBindingTargets } from '../bindingEngine';
import { resolveInspectorFieldSections } from '../inspectorRegistry';
import { DesignerVizPieChart } from '../DesignerRuntimeCharts';
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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('37.1 — type-specific ChartFieldMapping + Inspector gauge fields', () => {
  it('builds bar vs pie vs sparkline defaults with distinct shapes', () => {
    const fields = ['month', 'revenue', 'cost'];
    const bar = buildDefaultChartFieldMapping(fields, 'bar');
    const pie = buildDefaultChartFieldMapping(fields, 'pie');
    const spark = buildDefaultChartFieldMapping(fields, 'sparkline');

    expect(bar.chartType).toBe('bar');
    if (bar.chartType === 'bar') {
      expect(bar.categoryField).toBe('month');
      expect(bar.valueFields.length).toBeGreaterThan(0);
    }

    expect(pie.chartType).toBe('pie');
    if (pie.chartType === 'pie') {
      expect(pie.labelField).toBe('month');
      expect(pie.valueField).toBeTruthy();
    }

    expect(spark.chartType).toBe('sparkline');
    if (spark.chartType === 'sparkline') {
      expect(spark.valueField).toBeTruthy();
    }
  });

  it('migrates legacy {categoryField,series} JSON and round-trips new union', () => {
    const legacy = parseDesignerChartFieldMapping({
      categoryField: 'month',
      series: [
        { apiField: 'revenue', seriesKey: 'revenue', label: 'Revenue', color: '#0ea5e9', aggregation: 'sum' },
      ],
    });
    expect(legacy?.chartType).toBe('bar');
    if (legacy?.chartType !== 'bar') {
      throw new Error('expected bar');
    }
    expect(legacy.valueFields[0]?.field).toBe('revenue');

    const serialized = serializeDesignerChartFieldMapping(legacy);
    const reparsed = parseDesignerChartFieldMapping(serialized);
    expect(reparsed).toEqual(legacy);
  });

  it('shows gaugeMin/Max/Thresholds for viz.chart-pie+gauge and hides them for bar', () => {
    let state = createInitialDesignerState();
    state = insertItem(state, 'viz.chart-pie');
    const pieId = lastChildId(state, state.document.rootNodeId);
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: pieId,
      key: 'chartVariant',
      value: 'gauge',
    });
    const pieNode = state.document.nodes[pieId]!;
    const pieFields = resolveInspectorFieldSections(pieNode)
      .flatMap((section) => section.fields)
      .map((field) => field.key);
    expect(pieFields).toContain('gaugeMin');
    expect(pieFields).toContain('gaugeMax');
    expect(pieFields).toContain('gaugeThresholds');

    state = insertItem(state, 'viz.chart-bar');
    const barId = lastChildId(state, state.document.rootNodeId);
    const barNode = state.document.nodes[barId]!;
    const barFields = resolveInspectorFieldSections(barNode)
      .flatMap((section) => section.fields)
      .map((field) => field.key);
    expect(barFields).not.toContain('gaugeMin');
    expect(barFields).not.toContain('gaugeMax');
    expect(barFields).not.toContain('gaugeThresholds');
  });

  it('resolves chart mapping type from palette + pie variant', () => {
    let state = createInitialDesignerState();
    state = insertItem(state, 'viz.chart-pie');
    const pieId = lastChildId(state, state.document.rootNodeId);
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: pieId,
      key: 'chartVariant',
      value: 'gauge',
    });
    expect(resolveChartMappingTypeFromNode(state.document.nodes[pieId]!)).toBe('gauge');
  });
});

describe('37.2 — real Gauge min/max/thresholds presentation', () => {
  it('clamps values outside [min,max] and colors by thresholds', () => {
    const over = resolveUiChartGaugePresentation(250, {
      min: 0,
      max: 200,
      thresholds: [
        { value: 50, color: '#10b981' },
        { value: 150, color: '#ef4444' },
      ],
    });
    expect(over.clampedValue).toBe(200);
    expect(over.percent).toBe(100);
    expect(over.color).toBe('#ef4444');

    const mid = resolveUiChartGaugePresentation(80, {
      min: 0,
      max: 100,
      thresholds: [
        { value: 70, color: '#f59e0b' },
        { value: 90, color: '#ef4444' },
      ],
    });
    expect(mid.percent).toBe(80);
    expect(mid.color).toBe('#f59e0b');
  });

  it('renders gauge display value (not hard-coded 0–100 percent) for out-of-range inputs', () => {
    render(
      <UiChartGauge
        value={150}
        min={0}
        max={100}
        thresholds={[{ value: 90, color: '#ef4444' }]}
        label="CPU"
      />,
    );
    const dial = document.querySelector('[data-gauge-value="100"]');
    expect(dial).toBeTruthy();
    expect(dial?.getAttribute('data-gauge-color')).toBe('#ef4444');
    expect(screen.getByText('CPU')).toBeTruthy();
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('DesignerVizPieChart gauge variant uses gaugeMin/Max props', () => {
    render(
      <DesignerVizPieChart
        chartVariant="gauge"
        data={[{ label: 'Load', revenue: 180 }]}
        seriesKeys="revenue"
        valueKey="revenue"
        gaugeMin={0}
        gaugeMax={200}
        gaugeThresholds={[{ value: 160, color: '#ef4444' }]}
      />,
    );
    const dial = document.querySelector('[data-gauge-value="180"]');
    expect(dial).toBeTruthy();
    expect(dial?.getAttribute('data-gauge-percent')).toBe('90');
    expect(dial?.getAttribute('data-gauge-color')).toBe('#ef4444');
    expect(screen.getByText('180')).toBeTruthy();
    expect(screen.getByText('0 – 200')).toBeTruthy();
  });
});

describe('37.3 — onDataPointClick event eligibility + payload', () => {
  it('exposes onDataPointClick for all four chart palette items', () => {
    for (const itemId of ['viz.chart-bar', 'viz.chart-line', 'viz.chart-pie', 'viz.chart-sparkline'] as const) {
      let state = createInitialDesignerState();
      state = insertItem(state, itemId);
      const nodeId = lastChildId(state, state.document.rootNodeId);
      expect(resolveNodeEventBindingTargets(state.document.nodes[nodeId]!)).toContain('onDataPointClick');
    }
  });

  it('createChartDataPointClickEvent exposes category on target.value for Dynamic Actions', () => {
    const event = createChartDataPointClickEvent({
      category: 'Jan',
      seriesKey: 'revenue',
      value: 120,
      row: { label: 'Jan', revenue: 120 },
    });
    expect(resolveChartDataPointClickPayload(event)).toEqual({
      category: 'Jan',
      seriesKey: 'revenue',
      value: 120,
      row: { label: 'Jan', revenue: 120 },
    });
    expect((event.target as unknown as { value: string }).value).toBe('Jan');
  });

  it('gauge click fires onDataPointClick with category payload', () => {
    const onDataPointClick = vi.fn();
    render(
      <DesignerVizPieChart
        chartVariant="gauge"
        data={[{ label: 'Score', revenue: 42 }]}
        seriesKeys="revenue"
        valueKey="revenue"
        gaugeMin={0}
        gaugeMax={100}
        onDataPointClick={onDataPointClick}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onDataPointClick).toHaveBeenCalledTimes(1);
    const event = onDataPointClick.mock.calls[0][0] as Event;
    expect((event.target as unknown as { value: string }).value).toBe('Score');
  });
});

describe('37.4 — transform + export runtime mapping', () => {
  it('pie mapping transforms label/value fields like legacy category/series', () => {
    const mapping = parseDesignerChartFieldMapping({
      chartType: 'pie',
      labelField: 'name',
      valueField: 'amount',
    });
    expect(mapping).toBeTruthy();
    const rows = transformApiRowsToChartData([
      { name: 'A', amount: 10 },
      { name: 'B', amount: 20 },
    ], mapping!);
    expect(rows).toEqual([
      { label: 'A', amount: 10 },
      { label: 'B', amount: 20 },
    ]);
  });

  it('toChartRuntimeTransformMapping flattens discriminated union for export helper', () => {
    const mapping = buildDefaultChartFieldMapping(['month', 'revenue'], 'bar');
    const runtime = toChartRuntimeTransformMapping(mapping);
    expect(runtime.categoryField).toBe('month');
    expect(runtime.series[0]?.apiField).toBe('revenue');
  });

  it('legacy transformApiRowsToChartData shape still works without chartType', () => {
    const rows = transformApiRowsToChartData(
      [{ month: 'Jan', revenue: 5 }],
      {
        categoryField: 'month',
        categoryAs: 'label',
        series: [{ apiField: 'revenue', seriesKey: 'revenue' }],
      },
    );
    expect(rows).toEqual([{ label: 'Jan', revenue: 5 }]);
  });
});
