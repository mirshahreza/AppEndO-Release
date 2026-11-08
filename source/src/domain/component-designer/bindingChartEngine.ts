import { resolveBindingQueryParamsWithFilterBindings } from './bindingFilterBindingsEngine';
import { createFetchConfigKey } from './bindingApiHelpers';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from './propRegistry';
import { getDataSources } from './bindingRegistry';
import {
  buildChartListQueryParamBindings,
  parseDesignerChartToolbarConfig,
  serializeDesignerChartToolbarConfig,
  type DesignerChartToolbarConfig,
} from './designerChartToolbarConfig';
import { isVizChartPaletteItemId } from './designerVizPalette';
import {
  dataSourceToResource,
  resolveDataSourceOperationEndpoint,
} from './bindingResourceModel';
import {
  CHART_SERIES_COLORS,
  DEFAULT_CHART_X_AXIS_KEY,
  parseSeriesKeys,
  type DesignerChartDataRow,
} from './visualizationDataModel';
import type { ResolvedFetchConfig } from './bindingEngine';
import type {
  DataSourceDefinition,
  DesignerBindingDefinition,
  DesignerBindingDefinitions,
  DesignerDocument,
  DesignerNode,
  DesignerResponseMapping,
} from './types';

export const CHART_DATA_RESOURCE_BINDING_KEY = 'chartDataResource';
export const CHART_DATA_SOURCES_PROP = 'chartDataSources';
export const CHART_FIELD_MAPPING_PROP = 'chartFieldMapping';
export const CHART_TOOLBAR_CONFIG_PROP = 'chartToolbarConfig';

/** One API source + its field mapping for combo (multi-source) charts. */
export type DesignerChartDataSourceEntry = {
  dataSourceRef: string;
  fieldMapping: DesignerChartFieldMapping;
};

export type ChartSeriesAggregation = 'none' | 'sum' | 'avg' | 'count' | 'min' | 'max';

/** Palette / wizard chart kinds that drive Field Mapping shape. */
export type DesignerChartMappingType = 'bar' | 'line' | 'pie' | 'donut' | 'gauge' | 'sparkline';

export type DesignerChartGaugeThreshold = {
  value: number;
  color: string;
};

/** @deprecated Prefer DesignerChartValueField — kept for summary/adapters after migration. */
export type DesignerChartSeriesMapping = {
  apiField: string;
  seriesKey: string;
  /** Legend label shown to end users. Defaults to seriesKey when omitted. */
  label?: string;
  /** Hex color for this series (e.g. #0EA5E9). */
  color?: string;
  /** How to combine duplicate category rows. Default sum when grouping applies. */
  aggregation?: ChartSeriesAggregation;
};

export type DesignerChartValueField = {
  field: string;
  /** Legend label. Omit to fall back to the field name at render time. */
  label?: string;
  color?: string;
  axis?: 'primary' | 'secondary';
  aggregation?: ChartSeriesAggregation;
  /** Internal series key used in chart data rows. Defaults to `field`. */
  seriesKey?: string;
};

export type DesignerChartComparisonSeries = {
  dataSourceRef: string;
  label: string;
};

export type DesignerChartBarLineFieldMapping = {
  chartType: 'bar' | 'line';
  categoryField: string;
  categoryAs?: string;
  valueFields: DesignerChartValueField[];
  /** Pivot: each distinct value of this API field becomes a dynamic series. */
  seriesGroupField?: string;
  sortBy?: { field: string; direction: 'asc' | 'desc' };
  limitTopN?: { count: number; groupRestAsLabel: string };
  /** Period comparison — second list fetch rendered alongside the primary series. */
  comparisonSeries?: DesignerChartComparisonSeries;
};

export type DesignerChartPieGaugeFieldMapping = {
  chartType: 'pie' | 'donut' | 'gauge';
  labelField: string;
  valueField: string;
  gaugeMin?: number;
  gaugeMax?: number;
  gaugeThresholds?: DesignerChartGaugeThreshold[];
};

export type DesignerChartSparklineFieldMapping = {
  chartType: 'sparkline';
  valueField: string;
  compareField?: string;
};

export type DesignerChartFieldMapping =
  | DesignerChartBarLineFieldMapping
  | DesignerChartPieGaugeFieldMapping
  | DesignerChartSparklineFieldMapping;

/**
 * Flat shape consumed by the export-embedded `transformApiRowsToChartData`
 * (`bindingApiCodegen.ts`). Discriminated Designer mappings are converted here before
 * embedding so published pages keep a small, stable runtime helper.
 */
export type ChartRuntimeTransformMapping = {
  categoryField: string;
  categoryAs?: string;
  series: Array<{
    apiField: string;
    seriesKey: string;
    aggregation?: ChartSeriesAggregation | string;
  }>;
  seriesGroupField?: string;
  sortBy?: { field: string; direction: 'asc' | 'desc' };
  limitTopN?: { count: number; groupRestAsLabel: string };
};

export type ResolvedChartListFetch = {
  nodeId: string;
  /** Index within the chart node's data sources (0 = primary). */
  sourceIndex: number;
  dataSourceId: string;
  dataSource: DataSourceDefinition;
  dataVar: string;
  fetchConfig: ResolvedFetchConfig;
  responseMapping?: DesignerResponseMapping;
  queryParams?: Record<string, string>;
  fieldMapping: DesignerChartFieldMapping;
  toolbarConfig: DesignerChartToolbarConfig;
};

export type DocumentChartPlan = {
  chartListFetches: ResolvedChartListFetch[];
};

export type ChartBindingWizardDispatchAction =
  | {
    type: 'set-node-binding';
    nodeId: string;
    bindingKey: string;
    definition: DesignerBindingDefinition;
  }
  | {
    type: 'set-node-prop';
    nodeId: string;
    key: string;
    value: unknown;
  };

const resolveNodePaletteItemId = (node: DesignerNode): string | undefined => {
  const stored = node.props[DESIGNER_PALETTE_ITEM_ID_PROP];
  return typeof stored === 'string' && stored.trim().length > 0 ? stored.trim() : undefined;
};

export const isChartNode = (node: DesignerNode): boolean =>
  isVizChartPaletteItemId(resolveNodePaletteItemId(node));

export const resolveChartMappingTypeFromNode = (node: DesignerNode): DesignerChartMappingType => {
  const paletteItemId = resolveNodePaletteItemId(node);
  switch (paletteItemId) {
    case 'viz.chart-line':
      return 'line';
    case 'viz.chart-sparkline':
      return 'sparkline';
    case 'viz.chart-pie': {
      const variant = typeof node.props.chartVariant === 'string' ? node.props.chartVariant.trim() : 'pie';
      if (variant === 'donut' || variant === 'gauge') {
        return variant;
      }
      return 'pie';
    }
    case 'viz.chart':
      // Advanced chart types reuse the bar/line field-mapping shape (category + value fields).
      return 'bar';
    case 'viz.chart-bar':
    default:
      return 'bar';
  }
};

export const getNodeChartDataResourceRef = (node: DesignerNode): string | undefined => {
  const definition = node.binding[CHART_DATA_RESOURCE_BINDING_KEY];
  const ref = definition?.dataSourceRef ?? definition?.sourcePath;
  const trimmed = typeof ref === 'string' ? ref.trim() : '';
  return trimmed.length > 0 ? trimmed : undefined;
};

export const getNodeChartDataResourceBinding = (node: DesignerNode): DesignerBindingDefinition | undefined =>
  node.binding[CHART_DATA_RESOURCE_BINDING_KEY];

export const createChartDataResourceBindingDefinition = (
  dataSourceRef: string,
  options: {
    urlParams?: Record<string, string>;
    queryParams?: Record<string, string>;
    filterBindings?: string[];
  } = {},
): DesignerBindingDefinition => ({
  sourceType: 'static',
  dataSourceRef: dataSourceRef.trim(),
  sourcePath: dataSourceRef.trim(),
  loadOperation: 'list',
  urlParams: options.urlParams,
  queryParams: options.queryParams,
  filterBindings: options.filterBindings,
});

export const resolveChartListDataVarName = (nodeId: string, sourceIndex = 0): string => {
  const suffix = nodeId.replace(/[^a-zA-Z0-9_]/g, '_');
  return sourceIndex > 0 ? `chartData_${suffix}_${sourceIndex}` : `chartData_${suffix}`;
};

export const parseDesignerChartDataSources = (
  raw: unknown,
  options: ParseChartFieldMappingOptions = {},
): DesignerChartDataSourceEntry[] | null => {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return null;
  }

  const entries: DesignerChartDataSourceEntry[] = [];
  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const record = item as Record<string, unknown>;
    const dataSourceRef = typeof record.dataSourceRef === 'string' ? record.dataSourceRef.trim() : '';
    if (!dataSourceRef) {
      continue;
    }
    const fieldMapping = parseDesignerChartFieldMapping(record.fieldMapping, options);
    if (!fieldMapping) {
      continue;
    }
    entries.push({ dataSourceRef, fieldMapping });
  }

  return entries.length > 0 ? entries : null;
};

export const serializeDesignerChartDataSources = (entries: DesignerChartDataSourceEntry[]): string =>
  JSON.stringify(entries.map((entry) => ({
    dataSourceRef: entry.dataSourceRef,
    fieldMapping: JSON.parse(serializeDesignerChartFieldMapping(entry.fieldMapping)),
  })));

/**
 * Resolves all chart data sources for a node — multi-source prop when present, otherwise the
 * legacy single `chartDataResource` binding + `chartFieldMapping` prop.
 */
export const resolveNodeChartDataSourceEntries = (
  node: DesignerNode,
  options: ParseChartFieldMappingOptions = {},
): DesignerChartDataSourceEntry[] => {
  const chartTypeHint = options.chartTypeHint ?? resolveChartMappingTypeFromNode(node);
  const fromProp = parseDesignerChartDataSources(node.props[CHART_DATA_SOURCES_PROP], { chartTypeHint });
  if (fromProp && fromProp.length > 0) {
    return appendComparisonSeriesEntry(fromProp);
  }

  const dataSourceRef = getNodeChartDataResourceRef(node);
  if (!dataSourceRef) {
    return [];
  }

  const fieldMapping = parseDesignerChartFieldMapping(node.props[CHART_FIELD_MAPPING_PROP], { chartTypeHint })
    ?? buildDefaultChartFieldMapping([], chartTypeHint);
  return appendComparisonSeriesEntry([{ dataSourceRef, fieldMapping }]);
};

export const isNodeChartDataBound = (node: DesignerNode): boolean =>
  resolveNodeChartDataSourceEntries(node).length > 0;

export const countNodeChartDataSources = (node: DesignerNode): number =>
  resolveNodeChartDataSourceEntries(node).length;

/** Merge transformed chart rows from multiple API sources by shared category/x-axis key. */
export const mergeMultiSourceChartData = (
  datasets: DesignerChartDataRow[][],
  xAxisKey: string,
): DesignerChartDataRow[] => {
  if (datasets.length === 0) {
    return [];
  }
  if (datasets.length === 1) {
    return datasets[0] ?? [];
  }

  const merged = new Map<string, DesignerChartDataRow>();
  for (const dataset of datasets) {
    for (const row of dataset) {
      const category = String(row[xAxisKey] ?? '');
      const existing = merged.get(category);
      if (existing) {
        merged.set(category, { ...existing, ...row });
      } else {
        merged.set(category, { ...row });
      }
    }
  }
  return Array.from(merged.values());
};

/** Combine bar/line field mappings from multiple sources into one display/export mapping. */
export const combineChartFieldMappings = (
  entries: DesignerChartDataSourceEntry[],
  chartTypeHint: DesignerChartMappingType = 'bar',
): DesignerChartFieldMapping | null => {
  if (entries.length === 0) {
    return null;
  }
  if (entries.length === 1) {
    return entries[0]!.fieldMapping;
  }

  const first = entries[0]!.fieldMapping;
  if (first.chartType !== 'bar' && first.chartType !== 'line') {
    return first;
  }

  const valueFields = entries.flatMap((entry) => {
    if (entry.fieldMapping.chartType === 'bar' || entry.fieldMapping.chartType === 'line') {
      return entry.fieldMapping.valueFields;
    }
    return [];
  });

  return {
    chartType: first.chartType,
    categoryField: first.categoryField,
    ...(first.categoryAs ? { categoryAs: first.categoryAs } : {}),
    valueFields,
    ...(first.seriesGroupField ? { seriesGroupField: first.seriesGroupField } : {}),
    ...(first.sortBy ? { sortBy: first.sortBy } : {}),
    ...(first.limitTopN ? { limitTopN: first.limitTopN } : {}),
  };
};

export const resolveCombinedChartSeriesMetadata = (
  entries: DesignerChartDataSourceEntry[],
  chartTypeHint: DesignerChartMappingType = 'bar',
): {
  seriesKeys: string;
  xAxisKey: string;
  seriesColors: Record<string, string>;
  seriesLabels: Record<string, string>;
} => {
  const combined = combineChartFieldMappings(entries, chartTypeHint);
  if (!combined) {
    return {
      seriesKeys: '',
      xAxisKey: DEFAULT_CHART_X_AXIS_KEY,
      seriesColors: {},
      seriesLabels: {},
    };
  }
  return {
    seriesKeys: resolveChartSeriesKeysFromMapping(combined),
    xAxisKey: resolveChartXAxisKeyFromMapping(combined),
    seriesColors: resolveChartSeriesColorsFromMapping(combined),
    seriesLabels: resolveChartSeriesLabelsFromMapping(combined),
  };
};

const parseValueFields = (raw: unknown): DesignerChartValueField[] => {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((entry): DesignerChartValueField | null => {
      if (typeof entry !== 'object' || entry === null) {
        return null;
      }
      const record = entry as Record<string, unknown>;
      // New shape
      const field = typeof record.field === 'string' ? record.field.trim() : '';
      // Legacy series shape
      const apiField = typeof record.apiField === 'string' ? record.apiField.trim() : '';
      const resolvedField = field || apiField;
      if (!resolvedField) {
        return null;
      }
      const seriesKey = typeof record.seriesKey === 'string' && record.seriesKey.trim().length > 0
        ? record.seriesKey.trim()
        : resolvedField;
      const label = typeof record.label === 'string' && record.label.trim().length > 0
        ? record.label.trim()
        : undefined;
      const aggregation = typeof record.aggregation === 'string' && record.aggregation.trim().length > 0
        ? record.aggregation.trim() as ChartSeriesAggregation
        : undefined;
      const axis = record.axis === 'secondary' ? 'secondary' as const : record.axis === 'primary' ? 'primary' as const : undefined;
      return {
        field: resolvedField,
        seriesKey,
        ...(label ? { label } : {}),
        ...(typeof record.color === 'string' && record.color.trim().length > 0 ? { color: record.color.trim() } : {}),
        ...(aggregation ? { aggregation } : {}),
        ...(axis ? { axis } : {}),
      };
    })
    .filter((entry): entry is DesignerChartValueField => entry !== null);
};

const parseGaugeThresholds = (raw: unknown): DesignerChartGaugeThreshold[] | undefined => {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const thresholds = raw
    .map((entry): DesignerChartGaugeThreshold | null => {
      if (typeof entry !== 'object' || entry === null) {
        return null;
      }
      const value = typeof (entry as { value?: unknown }).value === 'number'
        ? (entry as { value: number }).value
        : Number((entry as { value?: unknown }).value);
      const color = typeof (entry as { color?: unknown }).color === 'string'
        ? (entry as { color: string }).color.trim()
        : '';
      if (!Number.isFinite(value) || !color) {
        return null;
      }
      return { value, color };
    })
    .filter((entry): entry is DesignerChartGaugeThreshold => entry !== null);
  return thresholds.length > 0 ? thresholds : undefined;
};

const migrateLegacyChartFieldMapping = (
  raw: Record<string, unknown>,
  hint: DesignerChartMappingType,
): DesignerChartFieldMapping | null => {
  const categoryField = typeof raw.categoryField === 'string' ? raw.categoryField.trim() : '';
  const series = parseValueFields(raw.series ?? raw.valueFields);
  if (!categoryField && series.length === 0 && typeof raw.valueField !== 'string') {
    return null;
  }

  if (hint === 'sparkline') {
    const valueField = typeof raw.valueField === 'string' && raw.valueField.trim()
      ? raw.valueField.trim()
      : series[0]?.field;
    if (!valueField) {
      return null;
    }
    const compareField = typeof raw.compareField === 'string' && raw.compareField.trim()
      ? raw.compareField.trim()
      : series[1]?.field;
    return {
      chartType: 'sparkline',
      valueField,
      ...(compareField ? { compareField } : {}),
    };
  }

  if (hint === 'pie' || hint === 'donut' || hint === 'gauge') {
    const labelField = typeof raw.labelField === 'string' && raw.labelField.trim()
      ? raw.labelField.trim()
      : categoryField;
    const valueField = typeof raw.valueField === 'string' && raw.valueField.trim()
      ? raw.valueField.trim()
      : series[0]?.field;
    if (!labelField || !valueField) {
      return null;
    }
    const gaugeMin = typeof raw.gaugeMin === 'number' && Number.isFinite(raw.gaugeMin) ? raw.gaugeMin : undefined;
    const gaugeMax = typeof raw.gaugeMax === 'number' && Number.isFinite(raw.gaugeMax) ? raw.gaugeMax : undefined;
    const gaugeThresholds = parseGaugeThresholds(raw.gaugeThresholds);
    return {
      chartType: hint,
      labelField,
      valueField,
      ...(gaugeMin !== undefined ? { gaugeMin } : {}),
      ...(gaugeMax !== undefined ? { gaugeMax } : {}),
      ...(gaugeThresholds ? { gaugeThresholds } : {}),
    };
  }

  if (!categoryField || series.length === 0) {
    return null;
  }

  const chartType: 'bar' | 'line' = hint === 'line' ? 'line' : 'bar';
  const sortByRaw = raw.sortBy;
  const sortBy = typeof sortByRaw === 'object' && sortByRaw !== null
    && typeof (sortByRaw as { field?: unknown }).field === 'string'
    && ((sortByRaw as { direction?: unknown }).direction === 'asc' || (sortByRaw as { direction?: unknown }).direction === 'desc')
    ? {
      field: String((sortByRaw as { field: string }).field).trim(),
      direction: (sortByRaw as { direction: 'asc' | 'desc' }).direction,
    }
    : undefined;
  const limitRaw = raw.limitTopN;
  const limitTopN = typeof limitRaw === 'object' && limitRaw !== null
    && typeof (limitRaw as { count?: unknown }).count === 'number'
    && typeof (limitRaw as { groupRestAsLabel?: unknown }).groupRestAsLabel === 'string'
    ? {
      count: (limitRaw as { count: number }).count,
      groupRestAsLabel: String((limitRaw as { groupRestAsLabel: string }).groupRestAsLabel).trim() || 'Other',
    }
    : undefined;

  const comparisonSeries = parseComparisonSeries(raw.comparisonSeries);

  return {
    chartType,
    categoryField,
    categoryAs: typeof raw.categoryAs === 'string' && raw.categoryAs.trim().length > 0
      ? raw.categoryAs.trim()
      : DEFAULT_CHART_X_AXIS_KEY,
    valueFields: series.map((entry) => ({
      field: entry.field,
      seriesKey: entry.seriesKey ?? entry.field,
      ...(entry.label ? { label: entry.label } : {}),
      ...(entry.color ? { color: entry.color } : {}),
      ...(entry.aggregation ? { aggregation: entry.aggregation } : {}),
      ...(entry.axis ? { axis: entry.axis } : {}),
    })),
    ...(typeof raw.seriesGroupField === 'string' && raw.seriesGroupField.trim()
      ? { seriesGroupField: raw.seriesGroupField.trim() }
      : {}),
    ...(sortBy?.field ? { sortBy } : {}),
    ...(limitTopN && limitTopN.count > 0 ? { limitTopN } : {}),
    ...(comparisonSeries ? { comparisonSeries } : {}),
  };
};

const parseComparisonSeries = (
  raw: unknown,
): DesignerChartBarLineFieldMapping['comparisonSeries'] => {
  if (typeof raw !== 'object' || raw === null) {
    return undefined;
  }
  const record = raw as Record<string, unknown>;
  const dataSourceRef = typeof record.dataSourceRef === 'string' ? record.dataSourceRef.trim() : '';
  const label = typeof record.label === 'string' ? record.label.trim() : '';
  if (!dataSourceRef || !label) {
    return undefined;
  }
  return { dataSourceRef, label };
};

const buildComparisonSeriesEntry = (
  primaryEntry: DesignerChartDataSourceEntry,
): DesignerChartDataSourceEntry | null => {
  const primary = primaryEntry.fieldMapping;
  if (primary.chartType !== 'bar' && primary.chartType !== 'line') {
    return null;
  }
  const comparisonSeries = primary.comparisonSeries;
  if (!comparisonSeries?.dataSourceRef?.trim() || !comparisonSeries.label?.trim()) {
    return null;
  }
  const primaryField = primary.valueFields[0];
  if (!primaryField) {
    return null;
  }
  return {
    dataSourceRef: comparisonSeries.dataSourceRef.trim(),
    fieldMapping: {
      chartType: primary.chartType,
      categoryField: primary.categoryField,
      ...(primary.categoryAs ? { categoryAs: primary.categoryAs } : {}),
      valueFields: [{
        ...primaryField,
        seriesKey: comparisonSeries.label.trim(),
        label: comparisonSeries.label.trim(),
      }],
    },
  };
};

const appendComparisonSeriesEntry = (
  entries: DesignerChartDataSourceEntry[],
): DesignerChartDataSourceEntry[] => {
  if (entries.length === 0) {
    return entries;
  }
  const comparisonEntry = buildComparisonSeriesEntry(entries[0]!);
  if (!comparisonEntry) {
    return entries;
  }
  if (entries.some((entry) => entry.dataSourceRef === comparisonEntry.dataSourceRef)) {
    return entries;
  }
  return [...entries, comparisonEntry];
};

export type ParseChartFieldMappingOptions = {
  /** Used when stored JSON lacks `chartType` (legacy documents). */
  chartTypeHint?: DesignerChartMappingType;
};

/**
 * Parses + normalizes chart field mapping. Accepts the new discriminated union and the
 * legacy `{ categoryField, series[] }` shape (migrated using `chartTypeHint`, default `bar`).
 */
export const parseDesignerChartFieldMapping = (
  raw: unknown,
  options: ParseChartFieldMappingOptions = {},
): DesignerChartFieldMapping | null => {
  if (typeof raw === 'string') {
    try {
      return parseDesignerChartFieldMapping(JSON.parse(raw), options);
    } catch {
      return null;
    }
  }

  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const chartTypeRaw = typeof record.chartType === 'string' ? record.chartType.trim() : '';
  const hint = options.chartTypeHint ?? 'bar';

  if (
    chartTypeRaw === 'bar'
    || chartTypeRaw === 'line'
    || chartTypeRaw === 'pie'
    || chartTypeRaw === 'donut'
    || chartTypeRaw === 'gauge'
    || chartTypeRaw === 'sparkline'
  ) {
    return migrateLegacyChartFieldMapping(
      {
        ...record,
        // Ensure pie/sparkline fields win when present
        ...(chartTypeRaw === 'pie' || chartTypeRaw === 'donut' || chartTypeRaw === 'gauge'
          ? {
            labelField: record.labelField ?? record.categoryField,
            valueField: record.valueField ?? (Array.isArray(record.valueFields)
              ? (record.valueFields[0] as { field?: string })?.field
              : undefined),
          }
          : {}),
        ...(chartTypeRaw === 'sparkline'
          ? {
            valueField: record.valueField ?? (Array.isArray(record.valueFields)
              ? (record.valueFields[0] as { field?: string })?.field
              : undefined),
          }
          : {}),
        ...(chartTypeRaw === 'bar' || chartTypeRaw === 'line'
          ? { series: record.valueFields ?? record.series }
          : {}),
      },
      chartTypeRaw,
    );
  }

  // Legacy documents without chartType
  return migrateLegacyChartFieldMapping(record, hint);
};

export const serializeDesignerChartFieldMapping = (mapping: DesignerChartFieldMapping): string =>
  JSON.stringify(mapping);

export const suggestChartCategoryField = (fields: string[]): string => {
  const preferred = ['label', 'name', 'title', 'month', 'date', 'category', 'x'];
  for (const candidate of preferred) {
    const match = fields.find((field) => field.toLowerCase() === candidate);
    if (match) {
      return match;
    }
  }
  return fields.find((field) => !isLikelyNumericFieldName(field)) ?? fields[0] ?? 'label';
};

export const resolveDefaultSeriesColor = (index: number): string =>
  CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length] ?? CHART_SERIES_COLORS[0];

const humanizeFieldName = (field: string): string =>
  field
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const isLikelyNumericFieldName = (field: string): boolean => {
  const lower = field.toLowerCase();
  if (['id', 'count', 'total', 'amount', 'value', 'revenue', 'cost', 'price', 'qty', 'quantity', 'score', 'percent', 'rate'].some((token) => lower.includes(token))) {
    return true;
  }
  return !['name', 'label', 'title', 'description', 'email', 'status', 'type', 'category', 'date', 'month'].includes(lower);
};

export const suggestChartSeriesFields = (fields: string[], categoryField: string): DesignerChartSeriesMapping[] =>
  fields
    .filter((field) => field !== categoryField && isLikelyNumericFieldName(field))
    .slice(0, 4)
    .map((field, index) => ({
      apiField: field,
      seriesKey: field,
      label: humanizeFieldName(field),
      color: resolveDefaultSeriesColor(index),
      aggregation: 'sum' as const,
    }));

export const buildDefaultChartFieldMapping = (
  fields: string[],
  chartType: DesignerChartMappingType = 'bar',
): DesignerChartFieldMapping => {
  const categoryField = suggestChartCategoryField(fields);
  const series = suggestChartSeriesFields(fields, categoryField);
  const fallbackSeries = series.length > 0
    ? series
    : [{
      apiField: 'value',
      seriesKey: 'value',
      label: 'Value',
      color: resolveDefaultSeriesColor(0),
      aggregation: 'sum' as const,
    }];

  if (chartType === 'sparkline') {
    return {
      chartType: 'sparkline',
      valueField: fallbackSeries[0]!.apiField,
      ...(fallbackSeries[1] ? { compareField: fallbackSeries[1].apiField } : {}),
    };
  }

  if (chartType === 'pie' || chartType === 'donut' || chartType === 'gauge') {
    return {
      chartType,
      labelField: categoryField,
      valueField: fallbackSeries[0]!.apiField,
      ...(chartType === 'gauge' ? { gaugeMin: 0, gaugeMax: 100 } : {}),
    };
  }

  return {
    chartType: chartType === 'line' ? 'line' : 'bar',
    categoryField,
    categoryAs: DEFAULT_CHART_X_AXIS_KEY,
    valueFields: fallbackSeries.map((entry) => ({
      field: entry.apiField,
      label: entry.label ?? entry.apiField,
      seriesKey: entry.seriesKey,
      color: entry.color,
      aggregation: entry.aggregation,
    })),
  };
};

/** Series view for Inspector summaries / color-label helpers (works for all chart types). */
export const chartMappingToSeriesView = (mapping: DesignerChartFieldMapping): DesignerChartSeriesMapping[] => {
  switch (mapping.chartType) {
    case 'bar':
    case 'line':
      return mapping.valueFields.map((entry) => ({
        apiField: entry.field,
        seriesKey: entry.seriesKey ?? entry.field,
        label: entry.label,
        color: entry.color,
        aggregation: entry.aggregation,
      }));
    case 'pie':
    case 'donut':
    case 'gauge':
      return [{
        apiField: mapping.valueField,
        seriesKey: mapping.valueField,
        label: mapping.valueField,
      }];
    case 'sparkline':
      return [
        { apiField: mapping.valueField, seriesKey: mapping.valueField, label: mapping.valueField },
        ...(mapping.compareField
          ? [{ apiField: mapping.compareField, seriesKey: mapping.compareField, label: mapping.compareField }]
          : []),
      ];
  }
};

export const chartMappingCategoryField = (mapping: DesignerChartFieldMapping): string => {
  switch (mapping.chartType) {
    case 'bar':
    case 'line':
      return mapping.categoryField;
    case 'pie':
    case 'donut':
    case 'gauge':
      return mapping.labelField;
    case 'sparkline':
      return DEFAULT_CHART_X_AXIS_KEY;
  }
};

export const toChartRuntimeTransformMapping = (mapping: DesignerChartFieldMapping): ChartRuntimeTransformMapping => {
  switch (mapping.chartType) {
    case 'bar':
    case 'line':
      return {
        categoryField: mapping.categoryField,
        categoryAs: mapping.categoryAs ?? DEFAULT_CHART_X_AXIS_KEY,
        series: mapping.valueFields.map((entry) => ({
          apiField: entry.field,
          seriesKey: entry.seriesKey ?? entry.field,
          ...(entry.aggregation ? { aggregation: entry.aggregation } : {}),
        })),
        ...(mapping.seriesGroupField ? { seriesGroupField: mapping.seriesGroupField } : {}),
        ...(mapping.sortBy ? { sortBy: mapping.sortBy } : {}),
        ...(mapping.limitTopN ? { limitTopN: mapping.limitTopN } : {}),
      };
    case 'pie':
    case 'donut':
    case 'gauge':
      return {
        categoryField: mapping.labelField,
        categoryAs: DEFAULT_CHART_X_AXIS_KEY,
        series: [{
          apiField: mapping.valueField,
          seriesKey: mapping.valueField,
          aggregation: 'sum',
        }],
      };
    case 'sparkline':
      return {
        categoryField: '__rowIndex',
        categoryAs: DEFAULT_CHART_X_AXIS_KEY,
        series: [
          { apiField: mapping.valueField, seriesKey: mapping.valueField, aggregation: 'none' },
          ...(mapping.compareField
            ? [{ apiField: mapping.compareField, seriesKey: mapping.compareField, aggregation: 'none' as const }]
            : []),
        ],
      };
  }
};

export const resolveChartSeriesColorsFromMapping = (mapping: DesignerChartFieldMapping): Record<string, string> => {
  const colors: Record<string, string> = {};
  chartMappingToSeriesView(mapping).forEach((entry, index) => {
    colors[entry.seriesKey] = entry.color?.trim() || resolveDefaultSeriesColor(index);
  });
  return colors;
};

export const resolveChartSeriesLabelsFromMapping = (mapping: DesignerChartFieldMapping): Record<string, string> => {
  const labels: Record<string, string> = {};
  for (const entry of chartMappingToSeriesView(mapping)) {
    if (entry.label?.trim()) {
      labels[entry.seriesKey] = entry.label.trim();
    }
  }
  return labels;
};

const parseChartNumericValue = (raw: unknown): number => {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === 'string') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export const aggregateChartSeriesValues = (
  values: number[],
  aggregation: ChartSeriesAggregation,
): number => {
  if (values.length === 0) {
    return 0;
  }
  switch (aggregation) {
    case 'count':
      return values.length;
    case 'avg':
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    case 'sum':
      return values.reduce((sum, value) => sum + value, 0);
    case 'none':
    default:
      return values[0] ?? 0;
  }
};

const applySortAndTopN = (
  rows: DesignerChartDataRow[],
  runtime: ChartRuntimeTransformMapping,
): DesignerChartDataRow[] => {
  let next = rows;
  if (runtime.sortBy?.field) {
    const field = runtime.sortBy.field;
    const direction = runtime.sortBy.direction;
    next = [...next].sort((a, b) => {
      const av = a[field];
      const bv = b[field];
      const an = typeof av === 'number' ? av : parseChartNumericValue(av);
      const bn = typeof bv === 'number' ? bv : parseChartNumericValue(bv);
      if (an !== bn) {
        return direction === 'asc' ? an - bn : bn - an;
      }
      return String(a[runtime.categoryAs ?? DEFAULT_CHART_X_AXIS_KEY] ?? '').localeCompare(
        String(b[runtime.categoryAs ?? DEFAULT_CHART_X_AXIS_KEY] ?? ''),
      );
    });
  }

  if (runtime.limitTopN && runtime.limitTopN.count > 0 && next.length > runtime.limitTopN.count) {
    const categoryKey = runtime.categoryAs ?? DEFAULT_CHART_X_AXIS_KEY;
    const primarySeries = runtime.series[0]?.seriesKey;
    const top = next.slice(0, runtime.limitTopN.count);
    const rest = next.slice(runtime.limitTopN.count);
    if (!primarySeries || rest.length === 0) {
      return top;
    }
    const restRow: DesignerChartDataRow = {
      [categoryKey]: runtime.limitTopN.groupRestAsLabel || 'Other',
    };
    for (const series of runtime.series) {
      restRow[series.seriesKey] = rest.reduce(
        (sum, row) => sum + parseChartNumericValue(row[series.seriesKey]),
        0,
      );
    }
    return [...top, restRow];
  }

  return next;
};

const transformWithSeriesGroupField = (
  rows: Array<Record<string, unknown>>,
  runtime: ChartRuntimeTransformMapping,
): DesignerChartDataRow[] => {
  const groupField = runtime.seriesGroupField!.trim();
  const valueField = runtime.series[0]?.apiField ?? 'value';
  const categoryKey = runtime.categoryAs ?? DEFAULT_CHART_X_AXIS_KEY;
  const grouped = new Map<string, Map<string, number[]>>();

  for (const row of rows) {
    const category = String(row[runtime.categoryField] ?? '');
    const seriesName = String(row[groupField] ?? 'Series');
    let catBucket = grouped.get(category);
    if (!catBucket) {
      catBucket = new Map();
      grouped.set(category, catBucket);
    }
    const values = catBucket.get(seriesName) ?? [];
    values.push(parseChartNumericValue(row[valueField]));
    catBucket.set(seriesName, values);
  }

  return Array.from(grouped.entries()).map(([category, seriesMap]) => {
    const chartRow: DesignerChartDataRow = { [categoryKey]: category };
    for (const [seriesName, values] of seriesMap.entries()) {
      chartRow[seriesName] = aggregateChartSeriesValues(values, 'sum');
    }
    return chartRow;
  });
};

/**
 * Transforms API rows into chart data. Accepts the discriminated Designer mapping or a
 * flat runtime/legacy `{ categoryField, series }` payload (including export-embedded JSON).
 */
export const transformApiRowsToChartData = (
  rows: Array<Record<string, unknown>>,
  mapping: DesignerChartFieldMapping | ChartRuntimeTransformMapping | (DesignerChartFieldMapping & { series?: DesignerChartSeriesMapping[] }),
): DesignerChartDataRow[] => {
  let runtime: ChartRuntimeTransformMapping;

  if ('chartType' in mapping && typeof mapping.chartType === 'string') {
    runtime = toChartRuntimeTransformMapping(mapping as DesignerChartFieldMapping);
  } else if ('series' in mapping && Array.isArray((mapping as ChartRuntimeTransformMapping).series)) {
    runtime = mapping as ChartRuntimeTransformMapping;
  } else {
    const parsed = parseDesignerChartFieldMapping(mapping);
    if (!parsed) {
      return [];
    }
    runtime = toChartRuntimeTransformMapping(parsed);
  }

  // Sparkline: synthesize category from row index when categoryField is the sentinel
  const sourceRows = runtime.categoryField === '__rowIndex'
    ? rows.map((row, index) => ({ ...row, __rowIndex: String(index + 1) }))
    : rows;

  let chartRows: DesignerChartDataRow[];

  if (runtime.seriesGroupField?.trim()) {
    chartRows = transformWithSeriesGroupField(sourceRows, runtime);
  } else {
    const needsGrouping = runtime.series.some((entry) => entry.aggregation && entry.aggregation !== 'none');
    const categoryKey = runtime.categoryAs ?? DEFAULT_CHART_X_AXIS_KEY;

    if (!needsGrouping) {
      chartRows = sourceRows.map((row) => {
        const chartRow: DesignerChartDataRow = {
          [categoryKey]: String(row[runtime.categoryField] ?? ''),
        };
        for (const series of runtime.series) {
          chartRow[series.seriesKey] = parseChartNumericValue(row[series.apiField]);
        }
        return chartRow;
      });
    } else {
      const grouped = new Map<string, Array<Record<string, unknown>>>();
      for (const row of sourceRows) {
        const category = String(row[runtime.categoryField] ?? '');
        const bucket = grouped.get(category);
        if (bucket) {
          bucket.push(row);
        } else {
          grouped.set(category, [row]);
        }
      }

      chartRows = Array.from(grouped.entries()).map(([category, groupRows]) => {
        const chartRow: DesignerChartDataRow = {
          [categoryKey]: category,
        };
        for (const series of runtime.series) {
          const values = groupRows.map((row) => parseChartNumericValue(row[series.apiField]));
          const aggregation = (series.aggregation ?? 'sum') as ChartSeriesAggregation;
          chartRow[series.seriesKey] = aggregateChartSeriesValues(values, aggregation);
        }
        return chartRow;
      });
    }
  }

  return applySortAndTopN(chartRows, runtime);
};

export const resolveChartSeriesKeysFromMapping = (mapping: DesignerChartFieldMapping): string =>
  chartMappingToSeriesView(mapping).map((entry) => entry.seriesKey).join(',');

export const resolveChartXAxisKeyFromMapping = (mapping: DesignerChartFieldMapping): string => {
  if (mapping.chartType === 'bar' || mapping.chartType === 'line') {
    return mapping.categoryAs ?? DEFAULT_CHART_X_AXIS_KEY;
  }
  return DEFAULT_CHART_X_AXIS_KEY;
};

export const resolveChartQueryParamsForNode = (node: DesignerNode): Record<string, string> => {
  const toolbarConfig = parseDesignerChartToolbarConfig(node.props[CHART_TOOLBAR_CONFIG_PROP]);
  const toolbarParams = buildChartListQueryParamBindings(toolbarConfig, node.id);
  return resolveBindingQueryParamsWithFilterBindings(getNodeChartDataResourceBinding(node), toolbarParams);
};

export const collectDocumentChartPlan = (
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions,
): DocumentChartPlan => {
  const dataSources = getDataSources(bindingDefinitions);
  const chartListFetches: ResolvedChartListFetch[] = [];

  for (const node of Object.values(document.nodes)) {
    if (!isChartNode(node)) {
      continue;
    }

    const chartTypeHint = resolveChartMappingTypeFromNode(node);
    const entries = resolveNodeChartDataSourceEntries(node, { chartTypeHint });
    if (entries.length === 0) {
      continue;
    }

    const chartBinding = getNodeChartDataResourceBinding(node);
    const toolbarConfig = parseDesignerChartToolbarConfig(node.props[CHART_TOOLBAR_CONFIG_PROP]);
    const queryParams = resolveChartQueryParamsForNode(node);

    entries.forEach((entry, sourceIndex) => {
      const dataSource = dataSources[entry.dataSourceRef];
      if (!dataSource?.endpoint?.trim()) {
        return;
      }

      const listEndpoint = resolveDataSourceOperationEndpoint(dataSource, 'list');
      const resource = dataSourceToResource(dataSource);

      chartListFetches.push({
        nodeId: node.id,
        sourceIndex,
        dataSourceId: entry.dataSourceRef,
        dataSource,
        dataVar: resolveChartListDataVarName(node.id, sourceIndex),
        fetchConfig: {
          configKey: createFetchConfigKey(
            listEndpoint,
            chartBinding?.urlParams ?? {},
            sourceIndex > 0 ? { chartSourceIndex: String(sourceIndex) } : {},
          ),
          endpointTemplate: listEndpoint,
          urlParams: { ...(chartBinding?.urlParams ?? {}) },
          headers: {},
        },
        responseMapping: resource.response,
        queryParams,
        fieldMapping: entry.fieldMapping,
        toolbarConfig,
      });
    });
  }

  return { chartListFetches };
};

export type ChartBindingWizardSourceInput = {
  dataSource: DataSourceDefinition;
  fieldMapping?: DesignerChartFieldMapping | Record<string, unknown>;
};

const isDataSourceDefinition = (value: unknown): value is DataSourceDefinition =>
  typeof value === 'object'
  && value !== null
  && 'id' in value
  && 'endpoint' in value
  && 'fields' in value;

export const buildChartBindingWizardActions = (
  chartNode: DesignerNode,
  sources: ChartBindingWizardSourceInput | ChartBindingWizardSourceInput[] | DataSourceDefinition,
  options: {
    fieldMapping?: DesignerChartFieldMapping | Record<string, unknown>;
    toolbarConfig?: DesignerChartToolbarConfig;
  } = {},
): ChartBindingWizardDispatchAction[] => {
  const sourceInputs: ChartBindingWizardSourceInput[] = Array.isArray(sources)
    ? sources
    : isDataSourceDefinition(sources)
      ? [{ dataSource: sources }]
      : [sources];
  if (sourceInputs.length === 0) {
    return [];
  }

  const chartType = resolveChartMappingTypeFromNode(chartNode);
  const resolvedEntries: DesignerChartDataSourceEntry[] = sourceInputs.map((sourceInput) => {
    const mappingInput = sourceInput.fieldMapping ?? (sourceInputs.length === 1 ? options.fieldMapping : undefined);
    const fieldMapping = mappingInput
      ? (parseDesignerChartFieldMapping(mappingInput, { chartTypeHint: chartType })
        ?? buildDefaultChartFieldMapping(sourceInput.dataSource.fields, chartType))
      : buildDefaultChartFieldMapping(sourceInput.dataSource.fields, chartType);
    return {
      dataSourceRef: sourceInput.dataSource.id,
      fieldMapping,
    };
  });

  const primaryEntry = resolvedEntries[0]!;
  const fieldMapping = combineChartFieldMappings(resolvedEntries, chartType) ?? primaryEntry.fieldMapping;
  const toolbarConfig = options.toolbarConfig ?? parseDesignerChartToolbarConfig(chartNode.props[CHART_TOOLBAR_CONFIG_PROP]);
  const queryParams = buildChartListQueryParamBindings(toolbarConfig, chartNode.id);

  const actions: ChartBindingWizardDispatchAction[] = [
    {
      type: 'set-node-binding',
      nodeId: chartNode.id,
      bindingKey: CHART_DATA_RESOURCE_BINDING_KEY,
      definition: createChartDataResourceBindingDefinition(primaryEntry.dataSourceRef, { queryParams }),
    },
    {
      type: 'set-node-prop',
      nodeId: chartNode.id,
      key: CHART_FIELD_MAPPING_PROP,
      value: serializeDesignerChartFieldMapping(fieldMapping),
    },
    {
      type: 'set-node-prop',
      nodeId: chartNode.id,
      key: 'seriesKeys',
      value: resolveChartSeriesKeysFromMapping(fieldMapping),
    },
    {
      type: 'set-node-prop',
      nodeId: chartNode.id,
      key: 'xAxisKey',
      value: resolveChartXAxisKeyFromMapping(fieldMapping),
    },
    {
      type: 'set-node-prop',
      nodeId: chartNode.id,
      key: CHART_TOOLBAR_CONFIG_PROP,
      value: serializeDesignerChartToolbarConfig(toolbarConfig, chartNode.id),
    },
    {
      type: 'set-node-prop',
      nodeId: chartNode.id,
      key: CHART_DATA_SOURCES_PROP,
      value: resolvedEntries.length > 1
        ? serializeDesignerChartDataSources(resolvedEntries)
        : undefined,
    },
  ];

  if (fieldMapping.chartType === 'pie' || fieldMapping.chartType === 'donut' || fieldMapping.chartType === 'gauge') {
    actions.push({
      type: 'set-node-prop',
      nodeId: chartNode.id,
      key: 'valueKey',
      value: fieldMapping.valueField,
    });
    if (fieldMapping.chartType === 'gauge' || fieldMapping.chartType === 'donut' || fieldMapping.chartType === 'pie') {
      actions.push({
        type: 'set-node-prop',
        nodeId: chartNode.id,
        key: 'chartVariant',
        value: fieldMapping.chartType,
      });
    }
    if (fieldMapping.chartType === 'gauge') {
      actions.push(
        {
          type: 'set-node-prop',
          nodeId: chartNode.id,
          key: 'gaugeMin',
          value: fieldMapping.gaugeMin ?? 0,
        },
        {
          type: 'set-node-prop',
          nodeId: chartNode.id,
          key: 'gaugeMax',
          value: fieldMapping.gaugeMax ?? 100,
        },
        {
          type: 'set-node-prop',
          nodeId: chartNode.id,
          key: 'gaugeThresholds',
          value: fieldMapping.gaugeThresholds
            ? JSON.stringify(fieldMapping.gaugeThresholds)
            : undefined,
        },
      );
    }
  }

  return actions;
};

export const buildChartBindingWithToolbarQueryParams = (
  dataSourceRef: string,
  nodeId: string,
  toolbarConfig: DesignerChartToolbarConfig | undefined,
  existing?: Pick<DesignerBindingDefinition, 'urlParams' | 'filterBindings'>,
): DesignerBindingDefinition => createChartDataResourceBindingDefinition(dataSourceRef, {
  urlParams: existing?.urlParams,
  queryParams: resolveBindingQueryParamsWithFilterBindings(
    existing as DesignerBindingDefinition | undefined,
    buildChartListQueryParamBindings(toolbarConfig, nodeId),
  ),
  filterBindings: existing?.filterBindings,
});

export const resolveChartDataFromRows = (
  rows: Array<Record<string, unknown>> | undefined,
  fieldMapping: DesignerChartFieldMapping | null,
  fallbackSeriesKeys: string,
): {
  data: DesignerChartDataRow[];
  seriesKeys: string;
  xAxisKey: string;
  seriesColors: Record<string, string>;
  seriesLabels: Record<string, string>;
} => {
  if (!rows || rows.length === 0) {
    return {
      data: [],
      seriesKeys: fallbackSeriesKeys,
      xAxisKey: DEFAULT_CHART_X_AXIS_KEY,
      seriesColors: {},
      seriesLabels: {},
    };
  }

  if (!fieldMapping) {
    const keys = parseSeriesKeys(fallbackSeriesKeys, 'value');
    return {
      data: rows as DesignerChartDataRow[],
      seriesKeys: keys.join(','),
      xAxisKey: DEFAULT_CHART_X_AXIS_KEY,
      seriesColors: Object.fromEntries(keys.map((key, index) => [key, resolveDefaultSeriesColor(index)])),
      seriesLabels: {},
    };
  }

  return {
    data: transformApiRowsToChartData(rows, fieldMapping),
    seriesKeys: resolveChartSeriesKeysFromMapping(fieldMapping),
    xAxisKey: resolveChartXAxisKeyFromMapping(fieldMapping),
    seriesColors: resolveChartSeriesColorsFromMapping(fieldMapping),
    seriesLabels: resolveChartSeriesLabelsFromMapping(fieldMapping),
  };
};

export const resolveChartDataFromMultiSourceDatasets = (
  datasets: Array<{ rows: Array<Record<string, unknown>>; fieldMapping: DesignerChartFieldMapping }>,
  fallbackSeriesKeys: string,
  chartTypeHint: DesignerChartMappingType = 'bar',
): ReturnType<typeof resolveChartDataFromRows> => {
  if (datasets.length === 0) {
    return resolveChartDataFromRows(undefined, null, fallbackSeriesKeys);
  }
  if (datasets.length === 1) {
    return resolveChartDataFromRows(datasets[0]!.rows, datasets[0]!.fieldMapping, fallbackSeriesKeys);
  }

  const transformed = datasets.map((dataset) =>
    transformApiRowsToChartData(dataset.rows, dataset.fieldMapping),
  );
  const xAxisKey = resolveChartXAxisKeyFromMapping(datasets[0]!.fieldMapping);
  const merged = mergeMultiSourceChartData(transformed, xAxisKey);
  const combinedEntries = datasets.map((dataset) => ({
    dataSourceRef: '',
    fieldMapping: dataset.fieldMapping,
  }));
  const metadata = resolveCombinedChartSeriesMetadata(combinedEntries, chartTypeHint);

  return {
    data: merged,
    seriesKeys: metadata.seriesKeys || fallbackSeriesKeys,
    xAxisKey: metadata.xAxisKey,
    seriesColors: metadata.seriesColors,
    seriesLabels: metadata.seriesLabels,
  };
};

/** Resolve gauge range from field mapping and/or node props. */
export const resolveGaugeConfigFromNode = (
  node: DesignerNode,
  fieldMapping?: DesignerChartFieldMapping | null,
): {
  gaugeMin: number;
  gaugeMax: number;
  gaugeThresholds: DesignerChartGaugeThreshold[];
} => {
  const fromMapping = fieldMapping
    && (fieldMapping.chartType === 'gauge' || fieldMapping.chartType === 'pie' || fieldMapping.chartType === 'donut')
    ? fieldMapping
    : null;

  const gaugeMin = typeof fromMapping?.gaugeMin === 'number' && Number.isFinite(fromMapping.gaugeMin)
    ? fromMapping.gaugeMin
    : typeof node.props.gaugeMin === 'number' && Number.isFinite(node.props.gaugeMin)
      ? node.props.gaugeMin
      : 0;

  const gaugeMax = typeof fromMapping?.gaugeMax === 'number' && Number.isFinite(fromMapping.gaugeMax)
    ? fromMapping.gaugeMax
    : typeof node.props.gaugeMax === 'number' && Number.isFinite(node.props.gaugeMax)
      ? node.props.gaugeMax
      : 100;

  let gaugeThresholds = fromMapping?.gaugeThresholds ?? undefined;
  if (!gaugeThresholds) {
    gaugeThresholds = parseGaugeThresholds(node.props.gaugeThresholds)
      ?? (typeof node.props.gaugeThresholds === 'string'
        ? parseGaugeThresholds((() => {
          try {
            return JSON.parse(node.props.gaugeThresholds as string);
          } catch {
            return null;
          }
        })())
        : undefined)
      ?? [];
  }

  return {
    gaugeMin,
    gaugeMax: gaugeMax === gaugeMin ? gaugeMin + 100 : gaugeMax,
    gaugeThresholds,
  };
};

export type DesignerChartDataPointClickDetail = {
  category: string;
  seriesKey: string;
  value: number;
  row: DesignerChartDataRow;
};

/** Synthetic event shape compatible with Designer Interaction handlers (`event.target.value`). */
export const createChartDataPointClickEvent = (
  detail: DesignerChartDataPointClickDetail,
): Event => ({
  target: {
    value: detail.category,
    category: detail.category,
    seriesKey: detail.seriesKey,
    dataPointValue: detail.value,
    row: detail.row,
  },
  currentTarget: null,
  preventDefault() {},
  stopPropagation() {},
} as unknown as Event);

export const resolveChartDataPointClickPayload = (event: Event): DesignerChartDataPointClickDetail | null => {
  const target = event.target as {
    value?: unknown;
    category?: unknown;
    seriesKey?: unknown;
    dataPointValue?: unknown;
    row?: unknown;
  } | null;
  if (!target || typeof target !== 'object') {
    return null;
  }
  const category = typeof target.category === 'string'
    ? target.category
    : typeof target.value === 'string'
      ? target.value
      : '';
  const seriesKey = typeof target.seriesKey === 'string' ? target.seriesKey : '';
  const value = typeof target.dataPointValue === 'number' ? target.dataPointValue : Number(target.dataPointValue);
  const row = target.row && typeof target.row === 'object'
    ? target.row as DesignerChartDataRow
    : { [DEFAULT_CHART_X_AXIS_KEY]: category };
  if (!category && !seriesKey) {
    return null;
  }
  return {
    category,
    seriesKey,
    value: Number.isFinite(value) ? value : 0,
    row,
  };
};
