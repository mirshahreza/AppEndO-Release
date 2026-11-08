import type { PivotAggregation } from '../../shared/api/contracts/data-api';
import type {
  DashboardCanvasPageConfig,
  DashboardUserWidget,
  DashboardWidgetKind,
} from '../../shared/api/contracts/dashboard-canvas';
import {
  parseDashboardWidgetFieldMapping,
  type DashboardChartKind,
  type DashboardWidgetFieldMapping,
} from '../../shared/lib/dashboardCanvas';
import type { DesignerNode } from './types';
import type { UiDashboardCanvasItem } from '../../shared/ui/UiDashboardCanvas';
import {
  CHART_FIELD_MAPPING_PROP,
  chartMappingCategoryField,
  parseDesignerChartFieldMapping,
  type ChartSeriesAggregation,
} from './bindingChartEngine';
import { getNodePaletteItemId } from './runtimeShared';
import { isVizChartPaletteItemId } from './designerVizPalette';

export const parseDashboardGrid = (
  value: unknown,
  fallback: UiDashboardCanvasItem,
): UiDashboardCanvasItem => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fallback;
  }
  const row = value as Record<string, unknown>;
  return {
    i: fallback.i,
    x: typeof row.x === 'number' ? row.x : fallback.x,
    y: typeof row.y === 'number' ? row.y : fallback.y,
    w: typeof row.w === 'number' ? row.w : fallback.w,
    h: typeof row.h === 'number' ? row.h : fallback.h,
  };
};

export type DashboardNodeVariant = {
  key: string;
  label: string;
  fieldMapping?: unknown;
};

export const readNodeVariants = (node: DesignerNode | undefined): DashboardNodeVariant[] => {
  const raw = node?.props?.variants;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return [];
    }
    const row = item as Record<string, unknown>;
    const key = typeof row.key === 'string' ? row.key : '';
    if (!key) return [];
    return [{
      key,
      label: typeof row.label === 'string' && row.label ? row.label : key,
      fieldMapping: row.fieldMapping,
    }];
  });
};

export const nodeDashboardTabId = (node: DesignerNode | undefined): string | undefined => (
  typeof node?.props?.dashboardTabId === 'string' ? node.props.dashboardTabId : undefined
);

const toPivotAggregation = (value: ChartSeriesAggregation | undefined): PivotAggregation => {
  if (value === 'avg' || value === 'count' || value === 'min' || value === 'max') {
    return value;
  }
  return 'sum';
};

const toChartKind = (value: string | undefined): DashboardChartKind => {
  if (value === 'line' || value === 'pie') return value;
  return 'bar';
};

export const chartMappingToDashboardFields = (raw: unknown): DashboardWidgetFieldMapping => {
  const dashboard = parseDashboardWidgetFieldMapping(raw);
  if (dashboard.dimension || dashboard.metric) {
    return dashboard;
  }
  const chart = parseDesignerChartFieldMapping(raw);
  if (!chart) {
    return {};
  }
  const series = 'valueFields' in chart
    ? chart.valueFields[0]
    : { field: 'valueField' in chart ? chart.valueField : undefined, aggregation: undefined };
  return {
    dimension: chartMappingCategoryField(chart),
    metric: series?.field,
    aggregation: toPivotAggregation(series?.aggregation),
    chartKind: toChartKind(chart.chartType),
  };
};

const inferDomainEntryId = (
  node: DesignerNode,
  config: DashboardCanvasPageConfig,
  mapping: DashboardWidgetFieldMapping,
): string | undefined => {
  if (typeof node.props.dashboardDomainEntryId === 'string' && node.props.dashboardDomainEntryId) {
    return node.props.dashboardDomainEntryId;
  }
  const used = [mapping.dimension, mapping.metric].filter((item): item is string => Boolean(item));
  const matches = config.domain.filter((entry) => (
    used.length === 0 || used.every((field) => entry.exposedFields.includes(field))
  ));
  if (matches.length === 1) {
    return matches[0].id;
  }
  if (config.domain.length === 1) {
    return config.domain[0].id;
  }
  return undefined;
};

const paletteToWidgetKind = (paletteItemId: string | null): DashboardWidgetKind | null => {
  if (!paletteItemId) return null;
  if (isVizChartPaletteItemId(paletteItemId)) return 'chart';
  if (paletteItemId === 'content.stat-trend') return 'kpi';
  if (paletteItemId === 'viz.sheet' || paletteItemId.startsWith('grid')) return 'table';
  if (paletteItemId.includes('text') || paletteItemId.includes('note')) return 'text';
  return null;
};

export const developerNodeToDashboardWidget = (
  node: DesignerNode | undefined,
  config: DashboardCanvasPageConfig,
  options: { variantKey?: string; drillBy?: string } = {},
): DashboardUserWidget | null => {
  if (!node) return null;
  const kind = paletteToWidgetKind(getNodePaletteItemId(node));
  if (!kind || kind === 'text') {
    return null;
  }
  const variant = readNodeVariants(node).find((item) => item.key === options.variantKey);
  const mapping = {
    ...chartMappingToDashboardFields(node.props[CHART_FIELD_MAPPING_PROP]),
    ...chartMappingToDashboardFields(variant?.fieldMapping),
  };
  if (typeof node.props.title === 'string' && node.props.title && !mapping.title) {
    mapping.title = node.props.title;
  }
  if (options.drillBy) {
    mapping.dimension = options.drillBy;
  }
  const domainEntryId = inferDomainEntryId(node, config, mapping);
  if (!domainEntryId) {
    return null;
  }
  return {
    id: node.id,
    kind,
    domainEntryId,
    fieldMapping: mapping,
    vizConfig: node.props.vizConfig ?? {},
    gridPosition: { x: 0, y: 0, w: 6, h: 4 },
  };
};

export const downloadDashboardBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
