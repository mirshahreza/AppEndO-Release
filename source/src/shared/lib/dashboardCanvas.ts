import type { PivotAggregation, PivotResult, PivotSpec } from '../api/contracts/data-api';
import { PIVOT_AGGREGATIONS } from '../api/contracts/data-api';
import type {
  DashboardCanvasPageConfig,
  DashboardCanvasPersonalization,
  DashboardDomainEntry,
  DashboardFilterDeclaration,
  DashboardJoinablePair,
  DashboardUserWidget,
} from '../api/contracts/dashboard-canvas';
import { parseDashboardCanvasPersonalization } from '../api/contracts/dashboard-canvas';
import { formatDisplayDateYmd } from './gridDateFormat';

export class DashboardDomainWhitelistError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DashboardDomainWhitelistError';
  }
}

export type PivotTableCalculation = 'runningTotal' | 'percentOfTotal' | 'rank';
export type DashboardChartKind = 'bar' | 'line' | 'pie';

export type DashboardDateGrain = 'day' | 'hour' | 'month';

export type DashboardWidgetFieldMapping = {
  dimension?: string;
  metric?: string;
  aggregation?: PivotAggregation;
  chartKind?: DashboardChartKind;
  dimensionB?: string;
  metricB?: string;
  aggregationB?: PivotAggregation;
  dimensionGrain?: DashboardDateGrain;
  title?: string;
  filters?: Record<string, Record<string, string | number | boolean | string[]>>;
};

export type DashboardBinning = {
  mode: 'fixedCount' | 'fixedWidth' | 'custom';
  count?: number;
  width?: number;
  breakpoints?: number[];
};

export type DashboardReferenceLine = {
  kind: 'none' | 'static' | 'min' | 'max' | 'median' | 'average';
  value?: number;
};

export type DashboardWidgetVizConfig = {
  binning?: DashboardBinning;
  tableCalculation?: PivotTableCalculation | '';
  referenceLine?: DashboardReferenceLine;
  text?: string;
  emptyText?: string;
};

const isPivotAggregation = (value: unknown): value is PivotAggregation => (
  typeof value === 'string' && (PIVOT_AGGREGATIONS as readonly string[]).includes(value)
);

export const parseDashboardWidgetFieldMapping = (value: unknown): DashboardWidgetFieldMapping => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const row = value as Record<string, unknown>;
  const chartKind = row.chartKind === 'line' || row.chartKind === 'pie' || row.chartKind === 'bar'
    ? row.chartKind
    : undefined;
  const grain = row.dimensionGrain === 'day' || row.dimensionGrain === 'hour' || row.dimensionGrain === 'month'
    ? row.dimensionGrain
    : undefined;
  const filters = row.filters && typeof row.filters === 'object' && !Array.isArray(row.filters)
    ? row.filters as DashboardWidgetFieldMapping['filters']
    : undefined;
  return {
    dimension: typeof row.dimension === 'string' ? row.dimension : undefined,
    metric: typeof row.metric === 'string' ? row.metric : undefined,
    aggregation: isPivotAggregation(row.aggregation) ? row.aggregation : undefined,
    chartKind,
    dimensionB: typeof row.dimensionB === 'string' ? row.dimensionB : undefined,
    metricB: typeof row.metricB === 'string' ? row.metricB : undefined,
    aggregationB: isPivotAggregation(row.aggregationB) ? row.aggregationB : undefined,
    dimensionGrain: grain,
    title: typeof row.title === 'string' ? row.title : undefined,
    filters,
  };
};

export const parseDashboardWidgetVizConfig = (value: unknown): DashboardWidgetVizConfig => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const row = value as Record<string, unknown>;
  const binningRaw = row.binning && typeof row.binning === 'object' && !Array.isArray(row.binning)
    ? row.binning as Record<string, unknown>
    : null;
  const referenceRaw = row.referenceLine && typeof row.referenceLine === 'object' && !Array.isArray(row.referenceLine)
    ? row.referenceLine as Record<string, unknown>
    : null;
  const tableCalculation = row.tableCalculation === 'runningTotal'
    || row.tableCalculation === 'percentOfTotal'
    || row.tableCalculation === 'rank'
    ? row.tableCalculation
    : '';
  return {
    binning: binningRaw ? {
      mode: binningRaw.mode === 'fixedWidth' || binningRaw.mode === 'custom' ? binningRaw.mode : 'fixedCount',
      count: typeof binningRaw.count === 'number' ? binningRaw.count : undefined,
      width: typeof binningRaw.width === 'number' ? binningRaw.width : undefined,
      breakpoints: Array.isArray(binningRaw.breakpoints)
        ? binningRaw.breakpoints.filter((item): item is number => typeof item === 'number')
        : undefined,
    } : undefined,
    tableCalculation,
    referenceLine: referenceRaw ? {
      kind: referenceRaw.kind === 'static'
        || referenceRaw.kind === 'min'
        || referenceRaw.kind === 'max'
        || referenceRaw.kind === 'median'
        || referenceRaw.kind === 'average'
        ? referenceRaw.kind
        : 'none',
      value: typeof referenceRaw.value === 'number' ? referenceRaw.value : undefined,
    } : undefined,
    text: typeof row.text === 'string' ? row.text : undefined,
    emptyText: typeof row.emptyText === 'string' ? row.emptyText : undefined,
  };
};

const padDatePart = (value: number): string => String(value).padStart(2, '0');

const isoDateUtc = (value: Date): string => (
  `${value.getUTCFullYear()}-${padDatePart(value.getUTCMonth() + 1)}-${padDatePart(value.getUTCDate())}`
);

export const resolveDashboardFilterDefault = (value: unknown, now = new Date()): string => {
  if (value == null) {
    return '';
  }
  if (value === 'last:7d') {
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 6);
    return `${isoDateUtc(start)}..${isoDateUtc(end)}`;
  }
  return String(value);
};

export const domainEntryById = (
  config: DashboardCanvasPageConfig,
  id: string,
): DashboardDomainEntry | undefined => config.domain.find((entry) => entry.id === id);

export const assertFieldInDomain = (
  config: DashboardCanvasPageConfig,
  domainEntryId: string,
  field: string,
): DashboardDomainEntry => {
  const entry = domainEntryById(config, domainEntryId);
  if (!entry) {
    throw new DashboardDomainWhitelistError(`Domain entry "${domainEntryId}" is not declared on this page.`);
  }
  if (!entry.exposedFields.includes(field)) {
    throw new DashboardDomainWhitelistError(`Field "${field}" is not exposed on domain entry "${domainEntryId}".`);
  }
  return entry;
};

export const assertJoinablePair = (
  config: DashboardCanvasPageConfig,
  comboRef: DashboardUserWidget['comboRef'],
): DashboardJoinablePair => {
  if (!comboRef) {
    throw new DashboardDomainWhitelistError('Combo widgets require a declared joinable pair.');
  }
  const match = (config.joinablePairs ?? []).find((pair) => (
    pair.domainEntryIdA === comboRef.domainEntryIdA
    && pair.fieldA === comboRef.fieldA
    && pair.domainEntryIdB === comboRef.domainEntryIdB
    && pair.fieldB === comboRef.fieldB
  ));
  if (!match) {
    throw new DashboardDomainWhitelistError('Combo join fields are not declared joinable on this page.');
  }
  return match;
};

export const assertPivotSpecInDomain = (
  config: DashboardCanvasPageConfig,
  domainEntryId: string,
  spec: Pick<PivotSpec, 'rows' | 'columns' | 'measures' | 'filters'>,
): void => {
  const entry = domainEntryById(config, domainEntryId);
  if (!entry) {
    throw new DashboardDomainWhitelistError(`Domain entry "${domainEntryId}" is not declared on this page.`);
  }
  const used = [
    ...spec.rows.map((item) => item.field),
    ...spec.columns.map((item) => item.field),
    ...spec.measures.map((item) => item.field),
    ...Object.keys(spec.filters ?? {}),
  ];
  const unknown = used.filter((field) => field !== '*' && !entry.exposedFields.includes(field));
  if (unknown.length > 0) {
    throw new DashboardDomainWhitelistError(`Pivot fields are outside the page domain: ${unknown.join(', ')}.`);
  }
};

export const sanitizeCanvasPersonalization = (
  config: DashboardCanvasPageConfig,
  raw: unknown,
  developerNodeIds: ReadonlySet<string>,
): DashboardCanvasPersonalization => {
  const parsed = parseDashboardCanvasPersonalization(raw);
  const hiddenNodeIds = parsed.hiddenNodeIds.filter((id) => developerNodeIds.has(id));
  const userWidgets: DashboardUserWidget[] = [];
  for (const widget of parsed.userWidgets) {
    try {
      if (widget.kind === 'combo') {
        assertJoinablePair(config, widget.comboRef);
        const mapping = parseDashboardWidgetFieldMapping(widget.fieldMapping);
        if (mapping.metric) assertFieldInDomain(config, widget.comboRef!.domainEntryIdA, mapping.metric);
        if (mapping.metricB) assertFieldInDomain(config, widget.comboRef!.domainEntryIdB, mapping.metricB);
        if (mapping.dimension) assertFieldInDomain(config, widget.comboRef!.domainEntryIdA, mapping.dimension);
        if (mapping.dimensionB) assertFieldInDomain(config, widget.comboRef!.domainEntryIdB, mapping.dimensionB);
      } else if (widget.kind !== 'text') {
        if (!widget.domainEntryId) {
          throw new DashboardDomainWhitelistError('Widget is missing a domain entry.');
        }
        domainEntryById(config, widget.domainEntryId)
          ?? (() => {
            throw new DashboardDomainWhitelistError(`Domain entry "${widget.domainEntryId}" is not declared.`);
          })();
        const mapping = parseDashboardWidgetFieldMapping(widget.fieldMapping);
        if (mapping.dimension) assertFieldInDomain(config, widget.domainEntryId, mapping.dimension);
        if (mapping.metric) assertFieldInDomain(config, widget.domainEntryId, mapping.metric);
      }
      userWidgets.push(widget);
    } catch {
      // Drop widgets that fail the whitelist rather than rejecting the whole preference.
    }
  }
  const knownIds = new Set<string>([
    ...developerNodeIds,
    ...userWidgets.map((widget) => widget.id),
  ]);
  const order = parsed.order.filter((id) => knownIds.has(id));
  const sizes: DashboardCanvasPersonalization['sizes'] = {};
  for (const [id, size] of Object.entries(parsed.sizes)) {
    if (knownIds.has(id)) {
      sizes[id] = size;
    }
  }
  const variantSelections: Record<string, string> = {};
  for (const [id, key] of Object.entries(parsed.variantSelections)) {
    if (developerNodeIds.has(id)) {
      variantSelections[id] = key;
    }
  }
  const savedViews = parsed.savedViews.filter((view) => (
    view.name.trim().length > 0 && !view.urlQueryString.includes('token=')
  ));
  return {
    hiddenNodeIds,
    order,
    sizes,
    variantSelections,
    userWidgets,
    savedViews,
  };
};

export const mergeComboPivotResults = (
  left: PivotResult,
  right: PivotResult,
  joinFieldLeft: string,
  joinFieldRight: string,
): PivotResult => {
  const leftIndex = left.rowAxis.fields.indexOf(joinFieldLeft);
  const rightIndex = right.rowAxis.fields.indexOf(joinFieldRight);
  const leftByKey = new Map(left.rowAxis.members.map((member) => [
    leftIndex >= 0 ? String(member.labels[leftIndex] ?? member.key) : member.key,
    member,
  ]));
  const rightByKey = new Map(right.rowAxis.members.map((member) => [
    rightIndex >= 0 ? String(member.labels[rightIndex] ?? member.key) : member.key,
    member,
  ]));
  const keys = [...new Set([...leftByKey.keys(), ...rightByKey.keys()])];
  const measures = [
    ...left.measures.map((item) => ({ ...item, field: `a.${item.field}` })),
    ...right.measures.map((item) => ({ ...item, field: `b.${item.field}` })),
  ];
  const leftCellByRow = new Map(left.cells.map((cell) => [cell.rowKey, cell]));
  const rightCellByRow = new Map(right.cells.map((cell) => [cell.rowKey, cell]));
  const members = keys.map((key) => {
    const leftMember = leftByKey.get(key);
    const rightMember = rightByKey.get(key);
    return leftMember ?? rightMember ?? { key, labels: [key] };
  });
  const cells = members.map((member) => {
    const leftKey = [...leftByKey.entries()].find((entry) => entry[1].key === member.key)?.[1].key
      ?? [...leftByKey.entries()].find((entry) => entry[0] === String(member.labels[leftIndex] ?? ''))?.[1].key;
    const rightKey = [...rightByKey.entries()].find((entry) => entry[1].key === member.key)?.[1].key
      ?? [...rightByKey.entries()].find((entry) => entry[0] === String(member.labels[rightIndex] ?? ''))?.[1].key;
    const leftCell = leftKey ? leftCellByRow.get(leftKey) : undefined;
    const rightCell = rightKey ? rightCellByRow.get(rightKey) : undefined;
    return {
      rowKey: member.key,
      colKey: left.colAxis.members[0]?.key ?? right.colAxis.members[0]?.key ?? '__all__',
      values: [
        ...(leftCell?.values ?? left.measures.map(() => null)),
        ...(rightCell?.values ?? right.measures.map(() => null)),
      ],
    };
  });
  return {
    rowAxis: { fields: [joinFieldLeft], members },
    colAxis: { fields: [], members: [{ key: '__all__', labels: [] }] },
    measures,
    cells,
  };
};

export const applyPivotTableCalculation = (
  result: PivotResult,
  calculation: PivotTableCalculation,
  measureIndex = 0,
): PivotResult => {
  if (result.cells.length === 0) {
    return result;
  }
  const values = result.cells.map((cell) => cell.values[measureIndex]);
  const numeric = values.map((value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0));
  if (calculation === 'percentOfTotal') {
    const total = numeric.reduce((sum, value) => sum + value, 0);
    return {
      ...result,
      cells: result.cells.map((cell, index) => {
        const next = [...cell.values];
        next[measureIndex] = total === 0 ? null : numeric[index] / total;
        return { ...cell, values: next };
      }),
    };
  }
  if (calculation === 'rank') {
    const ranked = numeric
      .map((value, index) => ({ value, index }))
      .sort((left, right) => right.value - left.value);
    const ranks = new Array<number>(numeric.length);
    ranked.forEach((entry, rank) => {
      ranks[entry.index] = rank + 1;
    });
    return {
      ...result,
      cells: result.cells.map((cell, index) => {
        const next = [...cell.values];
        next[measureIndex] = ranks[index] ?? null;
        return { ...cell, values: next };
      }),
    };
  }
  let running = 0;
  return {
    ...result,
    cells: result.cells.map((cell, index) => {
      running += numeric[index] ?? 0;
      const next = [...cell.values];
      next[measureIndex] = running;
      return { ...cell, values: next };
    }),
  };
};

const DASHBOARD_SLICE_COLORS: Record<string, string> = {
  error: '#e11d48',
  failed: '#e11d48',
  fail: '#e11d48',
  warn: '#d97706',
  warning: '#d97706',
  info: '#64748b',
  success: '#059669',
  completed: '#059669',
  running: '#0284c7',
  pending: '#64748b',
  blocked: '#e11d48',
  locked: '#e11d48',
  login_success: '#059669',
  login_failed: '#e11d48',
  refresh_success: '#059669',
  refresh_failed: '#e11d48',
  login_blocked: '#e11d48',
  login_rate_limited: '#d97706',
};

const DASHBOARD_CATEGORY_COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#6366f1'] as const;

const BOOLEAN_FIELD_LABELS: Record<string, Record<string, string>> = {
  locked: { '0': 'Open', '1': 'Locked', false: 'Open', true: 'Locked' },
  never_logged_in: { '0': 'Has signed in', '1': 'Never signed in' },
  has_role: { '0': 'None', '1': 'Has a role' },
  has_identity: { '0': 'Local only', '1': 'SSO linked' },
  has_scope: { '0': 'None', '1': 'Has scope' },
  is_builtin: { '0': 'Regular', '1': 'Built-in' },
  success: { '0': 'Fail', '1': 'Success', false: 'Fail', true: 'Success' },
  has_profile: { '0': 'No profile', '1': 'Has profile' },
  email_verified: { '0': 'Unverified', '1': 'Verified' },
  has_fail_streak: { '0': 'No streak', '1': 'Fail streak' },
  is_dormant: { '0': 'Active', '1': 'Dormant' },
};

const ISO_AXIS_RE = /^(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;

const formatSnakeDisplayLabel = (text: string): string => {
  if (!/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(text)) {
    return text;
  }
  return text
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
};

export const formatDashboardChartMemberLabel = (raw: unknown, field?: string): string => {
  const text = String(raw ?? '').trim();
  if (!text) {
    return '';
  }
  const boolMap = field ? BOOLEAN_FIELD_LABELS[field] : undefined;
  if (boolMap) {
    const mapped = boolMap[text] ?? boolMap[text.toLowerCase()];
    if (mapped) {
      return mapped;
    }
  }
  const iso = text.match(ISO_AXIS_RE);
  if (iso) {
    const date = new Date(/T|Z|[+-]\d{2}:\d{2}$/.test(text) ? text : `${text}T00:00:00.000Z`);
    if (!Number.isNaN(date.getTime())) {
      const isDateOnly = !iso[2] || (iso[2] === '00' && iso[3] === '00');
      if (isDateOnly) {
        return formatDisplayDateYmd(text);
      }
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'UTC',
      });
    }
  }
  return formatSnakeDisplayLabel(text);
};

export const formatDashboardChartAxisLabel = (raw: unknown): string => {
  const text = String(raw ?? '').trim();
  if (!text) {
    return '';
  }
  if (text.includes(' / ')) {
    return text
      .split(' / ')
      .map((part) => formatDashboardChartMemberLabel(part))
      .filter((part) => part.length > 0)
      .join(' / ');
  }
  return formatDashboardChartMemberLabel(text);
};

export const resolveDashboardSliceColor = (label: string): string | undefined => {
  const key = label.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return DASHBOARD_SLICE_COLORS[key];
};

export const dashboardKpiValueClass = (title: string, display: string): string => {
  const numeric = Number(display);
  if (!Number.isFinite(numeric) || numeric === 0) {
    return 'text-slate-900';
  }
  if (/(error|fail|dead letter|overdue|blocked|locked|critical|not connected|never signed|fail streak|rate limited)/i.test(title)) {
    return 'text-rose-600';
  }
  if (/\bwarn|unverified|dormant|no profile|without a role/i.test(title)) {
    return 'text-amber-600';
  }
  if (/login success/i.test(title)) {
    return 'text-emerald-600';
  }
  return 'text-slate-900';
};

const formatPivotMemberCaption = (fields: string[], labels: unknown[]): string => {
  const parts = labels
    .map((label, index) => formatDashboardChartMemberLabel(label, fields[index]))
    .filter((label) => label.length > 0);
  return parts.join(' / ');
};

const isWidePivotResult = (result: PivotResult): boolean => (
  result.colAxis.fields.length > 0
  && result.colAxis.members.some((member) => member.key !== '__all__' && member.key !== '__total__')
);

const assignDashboardRowColor = (
  row: Record<string, unknown>,
  label: string,
  index: number,
  rawJoined: string,
): void => {
  const sliceColor = resolveDashboardSliceColor(label)
    ?? resolveDashboardSliceColor(rawJoined)
    ?? DASHBOARD_CATEGORY_COLORS[index % DASHBOARD_CATEGORY_COLORS.length];
  row.color = sliceColor;
};

export const pivotResultToChartRows = (result: PivotResult): Array<Record<string, unknown>> => {
  if (isWidePivotResult(result)) {
    const seriesByColKey = new Map(
      result.colAxis.members.map((member) => [
        member.key,
        formatPivotMemberCaption(result.colAxis.fields, member.labels) || member.key,
      ]),
    );
    const rows: Array<Record<string, unknown>> = [];
    const seen = new Set<string>();
    const appendRow = (rowKey: string) => {
      if (seen.has(rowKey)) {
        return;
      }
      seen.add(rowKey);
      const rowMember = result.rowAxis.members.find((member) => member.key === rowKey);
      const label = formatPivotMemberCaption(result.rowAxis.fields, rowMember?.labels ?? []) || rowKey;
      const row: Record<string, unknown> = { label };
      for (const cell of result.cells) {
        if (cell.rowKey !== rowKey) {
          continue;
        }
        const series = seriesByColKey.get(cell.colKey) || 'value';
        row[series] = cell.values[0];
      }
      rows.push(row);
    };
    for (const member of result.rowAxis.members) {
      if (result.cells.some((cell) => cell.rowKey === member.key)) {
        appendRow(member.key);
      }
    }
    for (const cell of result.cells) {
      appendRow(cell.rowKey);
    }
    return rows;
  }

  return result.cells.map((cell, index) => {
    const rowMember = result.rowAxis.members.find((member) => member.key === cell.rowKey);
    const colMember = result.colAxis.members.find((member) => member.key === cell.colKey);
    const rowField = result.rowAxis.fields[0];
    const colField = result.colAxis.fields[0];
    const labelParts = [
      ...((rowMember?.labels ?? []).map((label) => formatDashboardChartMemberLabel(label, rowField))),
      ...((colMember?.labels ?? []).map((label) => formatDashboardChartMemberLabel(label, colField))),
    ].filter((label) => label.length > 0);
    const rawJoined = [...(rowMember?.labels ?? []), ...(colMember?.labels ?? [])]
      .filter((label) => label != null && String(label).length > 0)
      .join(' / ') || cell.rowKey;
    const label = labelParts.join(' / ') || formatDashboardChartAxisLabel(rawJoined) || 'Unknown';
    const row: Record<string, unknown> = { label };
    assignDashboardRowColor(row, label, index, String(rawJoined));
    result.measures.forEach((measure, measureIndex) => {
      row[`${measure.field}_${measure.aggregation}`] = cell.values[measureIndex];
      if (measureIndex === 0) {
        row.value = cell.values[measureIndex];
      }
    });
    return row;
  });
};

export const inferDashboardChartSeriesKeys = (rows: Array<Record<string, unknown>>): string[] => {
  const reserved = new Set(['label', 'color']);
  const keys: string[] = [];
  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      if (reserved.has(key) || keys.includes(key)) {
        continue;
      }
      if (typeof value === 'number' || key === 'value' || key === 'goal') {
        keys.push(key);
      }
    }
  }
  if (keys.includes('value')) {
    return keys.filter((key) => key === 'value' || key === 'goal');
  }
  return keys.length > 0 ? keys : ['value'];
};

export const dashboardChartRowsAreEmpty = (rows: Array<Record<string, unknown>>): boolean => {
  if (rows.length === 0) {
    return true;
  }
  const keys = inferDashboardChartSeriesKeys(rows);
  return rows.every((row) => keys.every((key) => {
    const numeric = Number(row[key]);
    return !Number.isFinite(numeric) || numeric === 0;
  }));
};

const parseStringRecord = (raw: string | null): Record<string, string> | undefined => {
  if (!raw) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return undefined;
    }
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0),
    );
  } catch {
    return undefined;
  }
};

export type DashboardCanvasQueryState = {
  filters: Record<string, string>;
  tabId?: string;
  crossFilter?: Record<string, string>;
  drillBy?: Record<string, string>;
};

export const readDashboardFilterQuery = (
  search: string,
): DashboardCanvasQueryState => {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const filters: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    if (key.startsWith('dc_f_')) {
      filters[key.slice(5)] = value;
    }
  }
  return {
    filters,
    tabId: params.get('dc_tab') || undefined,
    crossFilter: parseStringRecord(params.get('dc_xf')),
    drillBy: parseStringRecord(params.get('dc_by')),
  };
};

export const writeDashboardFilterQuery = (input: DashboardCanvasQueryState): string => {
  const params = new URLSearchParams();
  for (const [id, value] of Object.entries(input.filters)) {
    if (value) {
      params.set(`dc_f_${id}`, value);
    }
  }
  if (input.tabId) {
    params.set('dc_tab', input.tabId);
  }
  if (input.crossFilter && Object.keys(input.crossFilter).length > 0) {
    params.set('dc_xf', JSON.stringify(input.crossFilter));
  }
  if (input.drillBy && Object.keys(input.drillBy).length > 0) {
    params.set('dc_by', JSON.stringify(input.drillBy));
  }
  return params.toString();
};

export const widgetReceivesFilter = (
  filter: DashboardFilterDeclaration,
  widget: { id: string; domainEntryId?: string },
): boolean => {
  if (filter.appliesToWidgetIds && filter.appliesToWidgetIds.length > 0) {
    return filter.appliesToWidgetIds.includes(widget.id);
  }
  return !widget.domainEntryId || widget.domainEntryId === filter.domainEntryId;
};

export const scopeDashboardFilters = (
  filters: DashboardFilterDeclaration[],
  visibleWidgetIds: Iterable<string>,
  domains: DashboardDomainEntry[],
): DashboardFilterDeclaration[] => {
  const visible = new Set(visibleWidgetIds);
  const scoped = filters.filter((filter) => {
    if (!filter.appliesToWidgetIds?.length) {
      return true;
    }
    return filter.appliesToWidgetIds.some((id) => visible.has(id));
  });
  const visibleDateRangeCount = scoped.filter((filter) => filter.controlType === 'dateRange').length;
  if (visibleDateRangeCount < 2) {
    return scoped;
  }
  return scoped.map((filter) => {
    if (filter.controlType !== 'dateRange') {
      return filter;
    }
    const domainLabel = domains.find((entry) => entry.id === filter.domainEntryId)?.label?.trim();
    if (!domainLabel) {
      return filter;
    }
    return { ...filter, label: `${domainLabel} date range` };
  });
};

export const collectPivotFilters = (
  config: DashboardCanvasPageConfig,
  widget: { id: string; domainEntryId?: string; fieldMapping?: unknown },
  filterValues: Record<string, string>,
  crossFilter?: Record<string, string>,
): PivotSpec['filters'] => {
  const filters: NonNullable<PivotSpec['filters']> = {};
  const baked = parseDashboardWidgetFieldMapping(widget.fieldMapping).filters;
  if (baked) {
    for (const [field, operators] of Object.entries(baked)) {
      filters[field] = operators;
    }
  }
  for (const declaration of config.filters ?? []) {
    if (!widgetReceivesFilter(declaration, widget)) {
      continue;
    }
    if (widget.domainEntryId && declaration.domainEntryId !== widget.domainEntryId) {
      continue;
    }
    const raw = filterValues[declaration.id]
      || resolveDashboardFilterDefault(declaration.defaultValue);
    if (!raw) {
      continue;
    }
    if (declaration.controlType === 'numericRange' || declaration.controlType === 'dateRange') {
      const [min, max] = raw.split('..').map((item) => item.trim());
      const ops: Record<string, string | number | boolean | string[]> = {};
      if (min) ops.gte = declaration.controlType === 'numericRange' ? Number(min) : min;
      if (max) ops.lte = declaration.controlType === 'numericRange' ? Number(max) : max;
      if (Object.keys(ops).length > 0) {
        filters[declaration.field] = ops;
      }
    } else if (declaration.controlType === 'multiSelect') {
      const values = raw.split(',').map((item) => item.trim()).filter(Boolean);
      if (values.length === 1) {
        filters[declaration.field] = { eq: values[0] };
      } else if (values.length > 1) {
        filters[declaration.field] = { in: values };
      }
    } else {
      filters[declaration.field] = { eq: raw };
    }
  }
  if (crossFilter && widget.domainEntryId) {
    const entry = domainEntryById(config, widget.domainEntryId);
    for (const [field, value] of Object.entries(crossFilter)) {
      if (entry?.exposedFields.includes(field) && value) {
        filters[field] = { eq: value };
      }
    }
  }
  return Object.keys(filters).length > 0 ? filters : undefined;
};

export const buildWidgetPivotSpec = (
  widget: DashboardUserWidget,
  config: DashboardCanvasPageConfig,
  query: DashboardCanvasQueryState,
): { domainEntryId: string; spec: PivotSpec } | null => {
  if (widget.kind === 'text' || widget.kind === 'combo') {
    return null;
  }
  if (!widget.domainEntryId) {
    return null;
  }
  const mapping = parseDashboardWidgetFieldMapping(widget.fieldMapping);
  const metric = mapping.metric
    ?? config.domain.find((entry) => entry.id === widget.domainEntryId)?.exposedFields[0];
  if (!metric) {
    return null;
  }
  const drillDimension = query.drillBy?.[widget.id];
  const dimension = drillDimension || mapping.dimension;
  const aggregation: PivotAggregation = mapping.aggregation ?? 'sum';
  const rowAxis = widget.kind === 'kpi' || !dimension
    ? []
    : [{ field: dimension, ...(mapping.dimensionGrain ? { grain: mapping.dimensionGrain } : {}) }];
  const colAxis = mapping.dimensionB
    ? [{ field: mapping.dimensionB }]
    : [];
  return {
    domainEntryId: widget.domainEntryId,
    spec: {
      rows: rowAxis,
      columns: colAxis,
      measures: [{ field: metric, aggregation }],
      filters: collectPivotFilters(config, widget, query.filters, query.crossFilter),
    },
  };
};

export const buildFilterMembersPivotSpec = (field: string): PivotSpec => ({
  rows: [{ field }],
  columns: [],
  measures: [{ field, aggregation: 'count' }],
});

export const pivotResultMemberLabels = (result: PivotResult): string[] => (
  [...new Set(
    result.rowAxis.members.flatMap((member) => (
      member.labels.map((label) => String(label ?? '').trim()).filter(Boolean)
    )),
  )]
);

export const buildDrillDownPivotSpec = (
  base: PivotSpec,
  clickedField: string,
  clickedValue: string,
  exposedFields: string[],
): PivotSpec => {
  const measureFields = new Set(base.measures.map((item) => item.field));
  const breakdown = exposedFields.find((field) => (
    field !== clickedField && !measureFields.has(field)
  ));
  return {
    rows: breakdown ? [{ field: breakdown }] : [],
    columns: [],
    measures: base.measures,
    filters: {
      ...(base.filters ?? {}),
      [clickedField]: { eq: clickedValue },
    },
  };
};

export const applyNumericBinning = (
  result: PivotResult,
  binning: DashboardBinning,
): PivotResult => {
  if (result.rowAxis.members.length === 0) {
    return result;
  }
  const parsed = result.rowAxis.members.map((member) => ({
    member,
    value: Number(member.labels[0] ?? member.key),
  }));
  if (parsed.some((entry) => !Number.isFinite(entry.value))) {
    return result;
  }
  const numbers = parsed.map((entry) => entry.value);
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  const span = max - min || 1;
  const edges: number[] = [];
  if (binning.mode === 'custom' && (binning.breakpoints?.length ?? 0) > 0) {
    edges.push(min, ...[...(binning.breakpoints ?? [])].sort((left, right) => left - right), max);
  } else if (binning.mode === 'fixedWidth') {
    const width = binning.width && binning.width > 0 ? binning.width : span / 5;
    const count = Math.max(1, Math.ceil(span / width));
    for (let index = 0; index <= count; index += 1) {
      edges.push(min + index * width);
    }
    edges[edges.length - 1] = max;
  } else {
    const count = Math.max(1, Math.round(binning.count ?? 5));
    for (let index = 0; index <= count; index += 1) {
      edges.push(min + (index / count) * span);
    }
  }
  const lastBin = Math.max(0, edges.length - 2);
  const bucketOf = (value: number): { key: string; labels: unknown[] } => {
    let index = lastBin;
    for (let edgeIndex = 0; edgeIndex < lastBin; edgeIndex += 1) {
      const start = edges[edgeIndex] ?? min;
      const end = edges[edgeIndex + 1] ?? max;
      if (value >= start && value < end) {
        index = edgeIndex;
        break;
      }
    }
    const start = edges[index] ?? min;
    const end = edges[index + 1] ?? max;
    return { key: `bin:${index}`, labels: [`${start.toFixed(1)}–${end.toFixed(1)}`] };
  };
  const membersByKey = new Map<string, { key: string; labels: unknown[] }>();
  const valuesByKey = new Map<string, number[]>();
  result.cells.forEach((cell) => {
    const member = result.rowAxis.members.find((item) => item.key === cell.rowKey);
    const numeric = Number(member?.labels[0] ?? member?.key ?? '');
    if (!Number.isFinite(numeric)) {
      return;
    }
    const bucket = bucketOf(numeric);
    membersByKey.set(bucket.key, bucket);
    const next = valuesByKey.get(bucket.key) ?? [];
    next.push(typeof cell.values[0] === 'number' ? cell.values[0] : 0);
    valuesByKey.set(bucket.key, next);
  });
  const members = [...membersByKey.values()];
  return {
    ...result,
    rowAxis: { fields: result.rowAxis.fields, members },
    cells: members.map((member) => {
      const values = valuesByKey.get(member.key) ?? [];
      const sum = values.reduce((total, value) => total + value, 0);
      return {
        rowKey: member.key,
        colKey: result.colAxis.members[0]?.key ?? '__all__',
        values: [sum],
      };
    }),
  };
};

export const unwrapPivotApiResult = (body: unknown): PivotResult | null => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }
  const row = body as Record<string, unknown>;
  const candidate = row.data && typeof row.data === 'object' && !Array.isArray(row.data)
    ? row.data
    : body;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return null;
  }
  const result = candidate as Partial<PivotResult>;
  if (!result.rowAxis || !result.colAxis || !Array.isArray(result.cells) || !Array.isArray(result.measures)) {
    return null;
  }
  return result as PivotResult;
};

export const applyReferenceLineToRows = (
  rows: Array<Record<string, unknown>>,
  referenceLine?: DashboardReferenceLine,
): { rows: Array<Record<string, unknown>>; seriesKeys: string; showMarkLine: boolean; showMarkPoint: boolean } => {
  const seriesKeys = inferDashboardChartSeriesKeys(rows).join(',');
  if (!referenceLine || referenceLine.kind === 'none') {
    return { rows, seriesKeys, showMarkLine: false, showMarkPoint: false };
  }
  if (referenceLine.kind === 'average' || referenceLine.kind === 'median') {
    return { rows, seriesKeys, showMarkLine: true, showMarkPoint: false };
  }
  if (referenceLine.kind === 'min' || referenceLine.kind === 'max') {
    return { rows, seriesKeys, showMarkLine: false, showMarkPoint: true };
  }
  const goal = referenceLine.value;
  if (typeof goal !== 'number' || !Number.isFinite(goal)) {
    return { rows, seriesKeys, showMarkLine: false, showMarkPoint: false };
  }
  return {
    rows: rows.map((row) => ({ ...row, goal })),
    seriesKeys: seriesKeys.includes('goal') ? seriesKeys : `${seriesKeys},goal`,
    showMarkLine: false,
    showMarkPoint: false,
  };
};

export const DASHBOARD_EMBED_QUERY_PARAM = 'dc_embed';
export const DASHBOARD_EMBED_PAGE_QUERY_PARAM = 'dc_page';

const DASHBOARD_SNAPSHOT_PATH_RE = /(?:^|\/)shared\/dashboard-snapshots\/([^/?#]+)\/?$/;
const DASHBOARD_DESIGNER_EDIT_PATH_RE = /(?:^|\/)studio\/client-components\/edit\/([^/?#]+)/;

export type DashboardEmbedRequestParse = {
  embed: boolean;
  snapshotId: string | null;
  pageId: string | null;
  needsFramePolicy: boolean;
};

const splitUrlPathAndSearch = (urlOrPath: string): { pathname: string; search: string } => {
  try {
    const parsed = new URL(urlOrPath, 'http://dashboard.local');
    return { pathname: parsed.pathname, search: parsed.search };
  } catch {
    const q = urlOrPath.indexOf('?');
    if (q >= 0) {
      return { pathname: urlOrPath.slice(0, q), search: urlOrPath.slice(q) };
    }
    return { pathname: urlOrPath, search: '' };
  }
};

export const parseDashboardEmbedRequest = (urlOrPath: string): DashboardEmbedRequestParse => {
  const { pathname, search } = splitUrlPathAndSearch(urlOrPath);
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const embed = params.get(DASHBOARD_EMBED_QUERY_PARAM) === '1';
  const snapshotMatch = pathname.match(DASHBOARD_SNAPSHOT_PATH_RE);
  const snapshotId = snapshotMatch ? decodeURIComponent(snapshotMatch[1]) : null;
  const editMatch = pathname.match(DASHBOARD_DESIGNER_EDIT_PATH_RE);
  const pageFromPath = editMatch ? decodeURIComponent(editMatch[1]) : null;
  const pageFromQuery = params.get(DASHBOARD_EMBED_PAGE_QUERY_PARAM)?.trim() || null;
  return {
    embed,
    snapshotId,
    pageId: pageFromQuery || pageFromPath,
    needsFramePolicy: embed || Boolean(snapshotId),
  };
};

export const isDashboardChromeStrippedView = (pathname: string, search: string): boolean => {
  const parsed = parseDashboardEmbedRequest(`${pathname}${search.startsWith('?') || !search ? search : `?${search}`}`);
  return parsed.embed || Boolean(parsed.snapshotId);
};

export const dashboardSnapshotViewerPath = (snapshotId: string): string => (
  `/shared/dashboard-snapshots/${encodeURIComponent(snapshotId)}`
);

export const buildDashboardEmbedHref = (
  origin: string,
  pathname: string,
  search: string,
  pageId: string,
): string => {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  params.set(DASHBOARD_EMBED_QUERY_PARAM, '1');
  if (pageId.trim()) {
    params.set(DASHBOARD_EMBED_PAGE_QUERY_PARAM, pageId.trim());
  }
  const query = params.toString();
  return `${origin}${pathname}${query ? `?${query}` : ''}`;
};

export const sanitizeDashboardEmbedOrigins = (origins: unknown): string[] => {
  if (!Array.isArray(origins)) {
    return [];
  }
  const out: string[] = [];
  for (const raw of origins) {
    if (typeof raw !== 'string') {
      continue;
    }
    const trimmed = raw.trim();
    if (!trimmed || trimmed === '*' || trimmed.includes('*')) {
      continue;
    }
    try {
      const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        continue;
      }
      if (url.username || url.password) {
        continue;
      }
      const origin = url.origin;
      if (!origin || origin === 'null' || out.includes(origin)) {
        continue;
      }
      out.push(origin);
    } catch {
      // Skip values that are not absolute origins.
    }
  }
  return out;
};

export const buildDashboardFrameAncestorsCsp = (origins: unknown): string | null => {
  const allowed = sanitizeDashboardEmbedOrigins(origins);
  if (allowed.length === 0) {
    return null;
  }
  return `frame-ancestors 'self' ${allowed.join(' ')}`;
};

export type FrozenDashboardSnapshotWidget = {
  widgetId: string;
  kind?: string;
  result: PivotResult;
};

export const parseFrozenDashboardSnapshotPayload = (payload: unknown): FrozenDashboardSnapshotWidget[] => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return [];
  }
  const results = (payload as { results?: unknown }).results;
  if (!Array.isArray(results)) {
    return [];
  }
  const out: FrozenDashboardSnapshotWidget[] = [];
  for (const item of results) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }
    const row = item as Record<string, unknown>;
    const result = unwrapPivotApiResult(row.result);
    if (!result) {
      continue;
    }
    const widgetId = typeof row.widgetId === 'string' && row.widgetId.trim()
      ? row.widgetId
      : `widget-${out.length + 1}`;
    const kind = typeof row.kind === 'string' && row.kind.trim() ? row.kind : undefined;
    out.push({ widgetId, kind, result });
  }
  return out;
};
