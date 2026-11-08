import { APP_TABLE_GRID_PALETTE_ITEM_ID } from './designerDataGridColumns';
import { getNodePaletteItemId } from './runtimeShared';
import type { DesignerDocument } from './types';

export type GridAggregationFn = 'sum' | 'avg' | 'count' | 'min' | 'max';

export type GridAggregationFormat = 'currency' | 'percent' | 'number';

export type GridAggregationEntry = {
  field: string;
  fn: GridAggregationFn;
  label: string;
  format?: GridAggregationFormat;
};

export type GridPivotMode = {
  rowField: string;
  columnField: string;
  valueField: string;
  aggFn: GridAggregationFn;
};

export type GridAggregationConfig = {
  groupByFields?: string[];
  aggregations: GridAggregationEntry[];
  showSubtotalPerGroup?: boolean;
  showGrandTotal?: boolean;
  collapsibleGroups?: boolean;
  pivotMode?: GridPivotMode;
};

export type GridDisplayRowKind = 'data' | 'group-header' | 'subtotal' | 'grand-total';

export const GRID_ROW_KIND_KEY = '__gridRowKind';
export const GRID_GROUP_LEVEL_KEY = '__gridGroupLevel';
export const GRID_GROUP_PATH_KEY = '__gridGroupPath';

export type GridDisplayRow = Record<string, unknown> & {
  [GRID_ROW_KIND_KEY]?: GridDisplayRowKind;
  [GRID_GROUP_LEVEL_KEY]?: number;
  [GRID_GROUP_PATH_KEY]?: string;
};

const AGGREGATION_FNS: ReadonlySet<string> = new Set(['sum', 'avg', 'count', 'min', 'max']);
const AGGREGATION_FORMATS: ReadonlySet<string> = new Set(['currency', 'percent', 'number']);

const readString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const readBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return fallback;
};

const parseAggregationFn = (value: unknown): GridAggregationFn | undefined => {
  const normalized = readString(value);
  if (!normalized || !AGGREGATION_FNS.has(normalized)) {
    return undefined;
  }
  return normalized as GridAggregationFn;
};

const parseAggregationFormat = (value: unknown): GridAggregationFormat | undefined => {
  const normalized = readString(value);
  if (!normalized || !AGGREGATION_FORMATS.has(normalized)) {
    return undefined;
  }
  return normalized as GridAggregationFormat;
};

const parseAggregationEntry = (value: unknown): GridAggregationEntry | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  const field = readString(record.field);
  const fn = parseAggregationFn(record.fn);
  const label = readString(record.label) ?? field;
  if (!field || !fn) {
    return null;
  }
  const format = parseAggregationFormat(record.format);
  return {
    field,
    fn,
    label,
    ...(format ? { format } : {}),
  };
};

const parsePivotMode = (value: unknown): GridPivotMode | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const rowField = readString(record.rowField);
  const columnField = readString(record.columnField);
  const valueField = readString(record.valueField);
  const aggFn = parseAggregationFn(record.aggFn) ?? 'sum';
  if (!rowField || !columnField || !valueField) {
    return undefined;
  }
  return { rowField, columnField, valueField, aggFn };
};

export const parseGridAggregationConfig = (raw: unknown): GridAggregationConfig | null => {
  if (raw == null || raw === '') {
    return null;
  }

  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  const aggregationsRaw = Array.isArray(record.aggregations) ? record.aggregations : [];
  const aggregations = aggregationsRaw
    .map((entry) => parseAggregationEntry(entry))
    .filter((entry): entry is GridAggregationEntry => entry !== null);

  const groupByFields = Array.isArray(record.groupByFields)
    ? record.groupByFields
      .map((entry) => readString(entry))
      .filter((entry): entry is string => Boolean(entry))
    : undefined;

  const pivotMode = parsePivotMode(record.pivotMode);

  if (aggregations.length === 0 && !pivotMode) {
    return null;
  }

  return {
    ...(groupByFields && groupByFields.length > 0 ? { groupByFields } : {}),
    aggregations,
    ...(readBoolean(record.showSubtotalPerGroup, false) ? { showSubtotalPerGroup: true } : {}),
    ...(readBoolean(record.showGrandTotal, false) ? { showGrandTotal: true } : {}),
    ...(readBoolean(record.collapsibleGroups, false) ? { collapsibleGroups: true } : {}),
    ...(pivotMode ? { pivotMode } : {}),
  };
};

export const serializeGridAggregationConfig = (config: GridAggregationConfig | null | undefined): string => {
  if (!config) {
    return '';
  }
  return JSON.stringify(config);
};

export const isGridAggregationEnabled = (config: GridAggregationConfig | null | undefined): boolean => {
  if (!config) {
    return false;
  }
  if (config.pivotMode) {
    return true;
  }
  return config.aggregations.length > 0
    && Boolean(config.groupByFields && config.groupByFields.length > 0);
};

export const aggregateFieldValues = (
  fn: GridAggregationFn,
  values: readonly number[],
): number => {
  if (values.length === 0) {
    return fn === 'count' ? 0 : Number.NaN;
  }

  switch (fn) {
    case 'sum':
      return values.reduce((sum, value) => sum + value, 0);
    case 'avg':
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    case 'count':
      return values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    default:
      return Number.NaN;
  }
};

const readNumericFieldValue = (row: Record<string, unknown>, field: string): number | null => {
  const raw = row[field];
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  const parsed = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

export const formatAggregationValue = (
  value: unknown,
  format?: GridAggregationFormat,
): string => {
  if (value === null || value === undefined || (typeof value === 'number' && Number.isNaN(value))) {
    return '—';
  }

  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value);
  }

  switch (format) {
    case 'currency':
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(numeric);
    case 'percent':
      return new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 2 }).format(numeric);
    case 'number':
      return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(numeric);
    default:
      return String(numeric);
  }
};

const computeAggregationValues = (
  rows: readonly Record<string, unknown>[],
  aggregations: readonly GridAggregationEntry[],
): Record<string, number> => {
  const result: Record<string, number> = {};
  for (const aggregation of aggregations) {
    const values = rows
      .map((row) => readNumericFieldValue(row, aggregation.field))
      .filter((value): value is number => value !== null);
    result[aggregation.field] = aggregateFieldValues(aggregation.fn, values);
  }
  return result;
};

const buildGroupPath = (parts: readonly string[]): string => parts.join('\u0001');

const pivotColumnKey = (columnValue: string): string => `pivot_${columnValue.replace(/[^a-zA-Z0-9_]+/g, '_')}`;

export const applyGridPivot = <TRow extends Record<string, unknown>>(
  rows: readonly TRow[],
  config: GridAggregationConfig,
): TRow[] => {
  const pivot = config.pivotMode;
  if (!pivot) {
    return [...rows];
  }

  const { rowField, columnField, valueField, aggFn } = pivot;
  const columnValues = [...new Set(rows.map((row) => String(row[columnField] ?? '')).filter(Boolean))].sort();
  const rowGroups = new Map<string, TRow[]>();

  for (const row of rows) {
    const rowKey = String(row[rowField] ?? '');
    const bucket = rowGroups.get(rowKey) ?? [];
    bucket.push(row);
    rowGroups.set(rowKey, bucket);
  }

  const pivoted: TRow[] = [];
  for (const [rowKey, groupRows] of [...rowGroups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const nextRow = { [rowField]: rowKey } as unknown as TRow;
    for (const columnValue of columnValues) {
      const matching = groupRows.filter((row) => String(row[columnField] ?? '') === columnValue);
      const values = matching
        .map((row) => readNumericFieldValue(row, valueField))
        .filter((value): value is number => value !== null);
      (nextRow as Record<string, unknown>)[pivotColumnKey(columnValue)] = aggregateFieldValues(aggFn, values);
    }
    pivoted.push(nextRow);
  }

  if (config.showGrandTotal) {
    const grandRow = { [rowField]: 'Grand Total', [GRID_ROW_KIND_KEY]: 'grand-total' } as unknown as TRow;
    for (const columnValue of columnValues) {
      const values = rows
        .filter((row) => String(row[columnField] ?? '') === columnValue)
        .map((row) => readNumericFieldValue(row, valueField))
        .filter((value): value is number => value !== null);
      (grandRow as Record<string, unknown>)[pivotColumnKey(columnValue)] = aggregateFieldValues(aggFn, values);
    }
    pivoted.push(grandRow);
  }

  return pivoted;
};

const flattenGroupedRows = <TRow extends Record<string, unknown>>(
  groups: Map<string, TRow[]>,
  groupField: string,
  level: number,
  groupPathPrefix: readonly string[],
  config: GridAggregationConfig,
  remainingGroupFields: readonly string[],
): TRow[] => {
  const output: TRow[] = [];
  const sortedKeys = [...groups.keys()].sort((a, b) => a.localeCompare(b));

  for (const groupKey of sortedKeys) {
    const groupRows = groups.get(groupKey) ?? [];
    const groupPath = buildGroupPath([...groupPathPrefix, groupKey]);

    output.push({
      [groupField]: groupKey,
      [GRID_ROW_KIND_KEY]: 'group-header',
      [GRID_GROUP_LEVEL_KEY]: level,
      [GRID_GROUP_PATH_KEY]: groupPath,
    } as unknown as TRow);

    if (remainingGroupFields.length > 0) {
      const nestedGroups = new Map<string, TRow[]>();
      for (const row of groupRows) {
        const nestedKey = String(row[remainingGroupFields[0]!] ?? '');
        const bucket = nestedGroups.get(nestedKey) ?? [];
        bucket.push(row);
        nestedGroups.set(nestedKey, bucket);
      }
      output.push(
        ...flattenGroupedRows(
          nestedGroups,
          remainingGroupFields[0]!,
          level + 1,
          [...groupPathPrefix, groupKey],
          config,
          remainingGroupFields.slice(1),
        ),
      );
    } else {
      output.push(...groupRows.map((row) => ({
        ...row,
        [GRID_ROW_KIND_KEY]: 'data',
        [GRID_GROUP_PATH_KEY]: groupPath,
      } as unknown as TRow)));
    }

    if (config.showSubtotalPerGroup) {
      const totals = computeAggregationValues(groupRows, config.aggregations);
      const labelField = groupField;
      output.push({
        [labelField]: 'Subtotal',
        ...totals,
        [GRID_ROW_KIND_KEY]: 'subtotal',
        [GRID_GROUP_LEVEL_KEY]: level,
        [GRID_GROUP_PATH_KEY]: groupPath,
      } as unknown as TRow);
    }
  }

  return output;
};

/**
 * Client-side aggregation for App Table Grid (Phase 36).
 * When `pivotMode` is set, pivots row×column×value. Otherwise groups by `groupByFields`
 * and optionally inserts subtotal / grand-total rows.
 */
export const applyGridAggregation = <TRow extends Record<string, unknown>>(
  rows: readonly TRow[],
  config: GridAggregationConfig | null | undefined,
): TRow[] => {
  if (!config || !isGridAggregationEnabled(config)) {
    return [...rows];
  }

  if (config.pivotMode) {
    return applyGridPivot(rows, config);
  }

  const groupByFields = config.groupByFields ?? [];
  if (groupByFields.length === 0 || config.aggregations.length === 0) {
    return [...rows];
  }

  const topGroups = new Map<string, TRow[]>();
  for (const row of rows) {
    const key = String(row[groupByFields[0]!] ?? '');
    const bucket = topGroups.get(key) ?? [];
    bucket.push(row);
    topGroups.set(key, bucket);
  }

  const output = flattenGroupedRows(
    topGroups,
    groupByFields[0]!,
    0,
    [],
    config,
    groupByFields.slice(1),
  );

  if (config.showGrandTotal) {
    const totals = computeAggregationValues(rows, config.aggregations);
    const labelField = groupByFields[0]!;
    output.push({
      [labelField]: 'Grand Total',
      ...totals,
      [GRID_ROW_KIND_KEY]: 'grand-total',
      [GRID_GROUP_LEVEL_KEY]: 0,
      [GRID_GROUP_PATH_KEY]: '__grand_total__',
    } as unknown as TRow);
  }

  return output;
};

export type GridAggregationQueryParams = {
  groupBy?: string;
  aggregations?: string;
  showSubtotal?: string;
  showGrandTotal?: string;
  pivotRowField?: string;
  pivotColumnField?: string;
  pivotValueField?: string;
  pivotAggFn?: string;
};

export const buildGridAggregationQueryParams = (
  config: GridAggregationConfig | null | undefined,
): GridAggregationQueryParams => {
  if (!config || !isGridAggregationEnabled(config)) {
    return {};
  }

  if (config.pivotMode) {
    return {
      pivotRowField: config.pivotMode.rowField,
      pivotColumnField: config.pivotMode.columnField,
      pivotValueField: config.pivotMode.valueField,
      pivotAggFn: config.pivotMode.aggFn,
      ...(config.showGrandTotal ? { showGrandTotal: 'true' } : {}),
    };
  }

  return {
    groupBy: (config.groupByFields ?? []).join(','),
    aggregations: JSON.stringify(config.aggregations),
    ...(config.showSubtotalPerGroup ? { showSubtotal: 'true' } : {}),
    ...(config.showGrandTotal ? { showGrandTotal: 'true' } : {}),
  };
};

type ServerAggregationGroup = {
  key?: string;
  field?: string;
  label?: string;
  rows?: unknown[];
  subtotal?: Record<string, unknown>;
  groups?: ServerAggregationGroup[];
};

const isDisplayRow = (value: unknown): value is GridDisplayRow => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const flattenServerGroups = (
  groups: readonly ServerAggregationGroup[],
  groupField: string | undefined,
  config: GridAggregationConfig,
): GridDisplayRow[] => {
  const output: GridDisplayRow[] = [];

  for (const group of groups) {
    const groupKey = readString(group.key) ?? readString(group.label) ?? '';
    const field = readString(group.field) ?? groupField;
    if (field && groupKey) {
      output.push({
        [field]: groupKey,
        [GRID_ROW_KIND_KEY]: 'group-header',
      });
    }

    const childRows = Array.isArray(group.rows)
      ? group.rows.filter(isDisplayRow)
      : [];
    output.push(...childRows.map((row) => ({ ...row, [GRID_ROW_KIND_KEY]: 'data' as const })));

    if (Array.isArray(group.groups) && group.groups.length > 0) {
      output.push(...flattenServerGroups(group.groups, field, config));
    }

    if (group.subtotal && typeof group.subtotal === 'object') {
      output.push({
        ...group.subtotal,
        [GRID_ROW_KIND_KEY]: 'subtotal',
      });
    }
  }

  return output;
};

/**
 * Parse a server aggregation payload shaped as `{ groups: [...], grandTotal?: {...} }`.
 * Falls back to `items`/`data` arrays when `groups` is absent.
 */
export const parseServerAggregationResponse = (
  payload: unknown,
  config: GridAggregationConfig | null | undefined,
): GridDisplayRow[] | null => {
  if (!payload || typeof payload !== 'object' || !config || !isGridAggregationEnabled(config)) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const groups = Array.isArray(record.groups) ? record.groups as ServerAggregationGroup[] : null;
  if (!groups) {
    return null;
  }

  const groupField = config.groupByFields?.[0];
  const rows = flattenServerGroups(groups, groupField, config);

  if (config.showGrandTotal && record.grandTotal && typeof record.grandTotal === 'object') {
    rows.push({
      ...(record.grandTotal as Record<string, unknown>),
      [GRID_ROW_KIND_KEY]: 'grand-total',
    });
  }

  return rows;
};

export const resolveGridAggregationRowClassName = (row: GridDisplayRow): string | undefined => {
  const kind = row[GRID_ROW_KIND_KEY];
  switch (kind) {
    case 'group-header':
      return 'bg-slate-50 font-semibold text-slate-800';
    case 'subtotal':
      return 'bg-slate-100/80 font-medium text-slate-700';
    case 'grand-total':
      return 'bg-slate-200/80 font-semibold text-slate-900';
    default:
      return undefined;
  }
};

export const resolveGridAggregationCellText = (
  row: GridDisplayRow,
  columnKey: string,
  config: GridAggregationConfig | null | undefined,
  rawValue: unknown,
): string => {
  const kind = row[GRID_ROW_KIND_KEY];
  if (!kind || kind === 'data' || !config) {
    if (rawValue === null || rawValue === undefined) {
      return '';
    }
    return String(rawValue);
  }

  const aggregation = config.aggregations.find((entry) => entry.field === columnKey);
  if (aggregation && (kind === 'subtotal' || kind === 'grand-total')) {
    return formatAggregationValue(rawValue, aggregation.format);
  }

  if (kind === 'group-header' && config.groupByFields?.includes(columnKey)) {
    return String(rawValue ?? '');
  }

  if (kind === 'subtotal' && config.groupByFields?.includes(columnKey)) {
    return String(rawValue ?? 'Subtotal');
  }

  if (kind === 'grand-total' && config.groupByFields?.includes(columnKey)) {
    return String(rawValue ?? 'Grand Total');
  }

  return '';
};

export const resolveGridAggregationGroupIndentRem = (row: GridDisplayRow): number => {
  if (row[GRID_ROW_KIND_KEY] !== 'group-header') {
    return 0;
  }
  const level = typeof row[GRID_GROUP_LEVEL_KEY] === 'number' ? row[GRID_GROUP_LEVEL_KEY]! : 0;
  return level * 0.75;
};

export const documentUsesGridAggregation = (document: DesignerDocument): boolean =>
  Object.values(document.nodes).some((node) => {
    if (getNodePaletteItemId(node) !== APP_TABLE_GRID_PALETTE_ITEM_ID) {
      return false;
    }
    return isGridAggregationEnabled(parseGridAggregationConfig(node.props.gridAggregationConfig));
  });
