import { describe, expect, it } from 'vitest';
import { CHART_FIELD_MAPPING_PROP } from '../bindingChartEngine';
import {
  chartMappingToDashboardFields,
  developerNodeToDashboardWidget,
} from '../dashboardCanvasRuntimeHelpers';
import type { DesignerNode } from '../types';
import type { DashboardCanvasPageConfig } from '../../../shared/api/contracts/dashboard-canvas';

const config: DashboardCanvasPageConfig = {
  personalizable: true,
  domain: [
    { id: 'sales', label: 'Sales', dataSourceRef: 'ds1', exposedFields: ['region', 'amount', 'profit'] },
  ],
};

const node = (props: Record<string, unknown>): DesignerNode => ({
  id: 'chart-1',
  type: 'element',
  parentId: 'canvas',
  order: 0,
  props: {
    _designerPaletteItemId: 'viz.chart-bar',
    ...props,
  },
  layout: {},
  binding: {},
  children: [],
});

describe('developer dashboard widgets', () => {
  it('maps a designer chart node onto a domain widget', () => {
    const widget = developerNodeToDashboardWidget(node({
      [CHART_FIELD_MAPPING_PROP]: {
        chartType: 'bar',
        categoryField: 'region',
        valueFields: [{ field: 'amount', aggregation: 'sum' }],
      },
    }), config);
    expect(widget).toMatchObject({
      id: 'chart-1',
      kind: 'chart',
      domainEntryId: 'sales',
      fieldMapping: { dimension: 'region', metric: 'amount', aggregation: 'sum', chartKind: 'bar' },
    });
  });

  it('applies the selected variant field mapping over the node mapping', () => {
    const widget = developerNodeToDashboardWidget(node({
      [CHART_FIELD_MAPPING_PROP]: { dimension: 'region', metric: 'amount', aggregation: 'sum' },
      variants: [
        { key: 'profit', label: 'Profit', fieldMapping: { dimension: 'region', metric: 'profit', aggregation: 'sum' } },
      ],
    }), config, { variantKey: 'profit' });
    expect(widget?.fieldMapping).toMatchObject({ dimension: 'region', metric: 'profit' });
  });

  it('overrides the grouping dimension with drill-by', () => {
    const widget = developerNodeToDashboardWidget(node({
      [CHART_FIELD_MAPPING_PROP]: { dimension: 'region', metric: 'amount' },
    }), config, { drillBy: 'profit' });
    expect(widget?.fieldMapping).toMatchObject({ dimension: 'profit', metric: 'amount' });
  });

  it('copies the node title onto the field mapping', () => {
    const widget = developerNodeToDashboardWidget(node({
      _designerPaletteItemId: 'content.stat-trend',
      title: 'Failed jobs',
      dashboardDomainEntryId: 'sales',
      [CHART_FIELD_MAPPING_PROP]: { metric: 'id', aggregation: 'count' },
    }), config);
    expect(widget?.kind).toBe('kpi');
    expect(widget?.fieldMapping.title).toBe('Failed jobs');
  });

  it('returns null for text nodes so original children stay in place', () => {
    expect(developerNodeToDashboardWidget(node({
      _designerPaletteItemId: 'content.rich-text',
    }), config)).toBeNull();
  });

  it('reads pie mappings through the designer chart contract', () => {
    expect(chartMappingToDashboardFields({
      chartType: 'pie',
      labelField: 'region',
      valueField: 'amount',
    })).toMatchObject({
      dimension: 'region',
      metric: 'amount',
      chartKind: 'pie',
    });
  });
});
