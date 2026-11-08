import { describe, expect, it } from 'vitest';
import {
  applyNumericBinning,
  applyPivotTableCalculation,
  assertPivotSpecInDomain,
  buildDashboardEmbedHref,
  buildDashboardFrameAncestorsCsp,
  buildDrillDownPivotSpec,
  buildFilterMembersPivotSpec,
  buildWidgetPivotSpec,
  collectPivotFilters,
  scopeDashboardFilters,
  DashboardDomainWhitelistError,
  dashboardSnapshotViewerPath,
  isDashboardChromeStrippedView,
  mergeComboPivotResults,
  parseDashboardEmbedRequest,
  parseFrozenDashboardSnapshotPayload,
  pivotResultMemberLabels,
  pivotResultToChartRows,
  dashboardKpiValueClass,
  formatDashboardChartAxisLabel,
  resolveDashboardSliceColor,
  readDashboardFilterQuery,
  resolveDashboardFilterDefault,
  sanitizeCanvasPersonalization,
  sanitizeDashboardEmbedOrigins,
  writeDashboardFilterQuery,
} from '../dashboardCanvas';
import type { DashboardCanvasPageConfig } from '../../api/contracts/dashboard-canvas';
import type { PivotResult } from '../../api/contracts/data-api';

const config: DashboardCanvasPageConfig = {
  personalizable: true,
  domain: [
    { id: 'sales', label: 'Sales', dataSourceRef: 'ds1', exposedFields: ['region', 'amount'] },
  ],
  filters: [
    {
      id: 'region',
      label: 'Region',
      domainEntryId: 'sales',
      field: 'region',
      controlType: 'select',
    },
  ],
};

const sampleResult = (values: number[]): PivotResult => ({
  rowAxis: {
    fields: ['region'],
    members: values.map((value, index) => ({ key: `r${index}`, labels: [String(value)] })),
  },
  colAxis: { fields: [], members: [{ key: '__all__', labels: [] }] },
  measures: [{ field: 'amount', aggregation: 'sum' }],
  cells: values.map((value, index) => ({
    rowKey: `r${index}`,
    colKey: '__all__',
    values: [value],
  })),
});

describe('dashboard canvas domain whitelist', () => {
  it('rejects pivot fields that are not on the declared domain entry', () => {
    expect(() => assertPivotSpecInDomain(config, 'sales', {
      rows: [{ field: 'region' }],
      columns: [],
      measures: [{ field: 'secret', aggregation: 'sum' }],
    })).toThrow(DashboardDomainWhitelistError);
  });

  it('accepts pivot fields that are on the declared domain entry', () => {
    expect(() => assertPivotSpecInDomain(config, 'sales', {
      rows: [{ field: 'region' }],
      columns: [],
      measures: [{ field: 'amount', aggregation: 'sum' }],
    })).not.toThrow();
  });

  it('drops user widgets that point at undeclared domain entries', () => {
    const sanitized = sanitizeCanvasPersonalization(config, {
      hiddenNodeIds: ['dev-1', 'unknown'],
      userWidgets: [
        {
          id: 'w1',
          kind: 'chart',
          domainEntryId: 'missing',
          fieldMapping: {},
          vizConfig: {},
          gridPosition: { x: 0, y: 0, w: 4, h: 3 },
        },
        {
          id: 'w2',
          kind: 'kpi',
          domainEntryId: 'sales',
          fieldMapping: {},
          vizConfig: {},
          gridPosition: { x: 0, y: 0, w: 4, h: 3 },
        },
      ],
    }, new Set(['dev-1']));
    expect(sanitized.hiddenNodeIds).toEqual(['dev-1']);
    expect(sanitized.userWidgets.map((item) => item.id)).toEqual(['w2']);
  });

  it('drops user widgets whose mapped fields are outside the domain', () => {
    const sanitized = sanitizeCanvasPersonalization(config, {
      userWidgets: [
        {
          id: 'w3',
          kind: 'chart',
          domainEntryId: 'sales',
          fieldMapping: { dimension: 'secret', metric: 'amount' },
          vizConfig: {},
          gridPosition: { x: 0, y: 0, w: 4, h: 3 },
        },
      ],
    }, new Set());
    expect(sanitized.userWidgets).toEqual([]);
  });
});

describe('dashboard canvas query and pivot helpers', () => {
  it('round-trips filter, tab, cross-filter, and drill-by in the URL', () => {
    const serialized = writeDashboardFilterQuery({
      filters: { region: 'west' },
      tabId: 'ops',
      crossFilter: { region: 'west' },
      drillBy: { w1: 'amount' },
    });
    const parsed = readDashboardFilterQuery(`?${serialized}`);
    expect(parsed.filters).toEqual({ region: 'west' });
    expect(parsed.tabId).toBe('ops');
    expect(parsed.crossFilter).toEqual({ region: 'west' });
    expect(parsed.drillBy).toEqual({ w1: 'amount' });
  });

  it('builds a widget pivot spec from mapping, filters, and drill-by', () => {
    const built = buildWidgetPivotSpec({
      id: 'w2',
      kind: 'chart',
      domainEntryId: 'sales',
      fieldMapping: { dimension: 'region', metric: 'amount', aggregation: 'sum' },
      vizConfig: {},
      gridPosition: { x: 0, y: 0, w: 4, h: 3 },
    }, config, {
      filters: { region: 'west' },
      drillBy: { w2: 'amount' },
    });
    expect(built?.spec.rows).toEqual([{ field: 'amount' }]);
    expect(built?.spec.measures).toEqual([{ field: 'amount', aggregation: 'sum' }]);
    expect(built?.spec.filters?.region).toEqual({ eq: 'west' });
  });

  it('applies filter declarations to matching widgets only', () => {
    const filters = collectPivotFilters(config, { id: 'w2', domainEntryId: 'sales' }, { region: 'east' });
    expect(filters).toEqual({ region: { eq: 'east' } });
  });

  it('honors appliesToWidgetIds instead of broadcasting to every domain widget', () => {
    const scoped: DashboardCanvasPageConfig = {
      ...config,
      filters: [{
        id: 'region',
        label: 'Region',
        domainEntryId: 'sales',
        field: 'region',
        controlType: 'select',
        appliesToWidgetIds: ['w2'],
      }],
    };
    expect(collectPivotFilters(scoped, { id: 'w2', domainEntryId: 'sales' }, { region: 'west' }))
      .toEqual({ region: { eq: 'west' } });
    expect(collectPivotFilters(scoped, { id: 'w9', domainEntryId: 'sales' }, { region: 'west' }))
      .toBeUndefined();
  });

  it('encodes multi-select filter values as an in-list', () => {
    const scoped: DashboardCanvasPageConfig = {
      ...config,
      filters: [{
        id: 'region',
        label: 'Region',
        domainEntryId: 'sales',
        field: 'region',
        controlType: 'multiSelect',
      }],
    };
    expect(collectPivotFilters(scoped, { id: 'w2', domainEntryId: 'sales' }, { region: 'west,east' }))
      .toEqual({ region: { in: ['west', 'east'] } });
  });

  it('resolves last:7d to a UTC inclusive 7-day range', () => {
    expect(resolveDashboardFilterDefault('last:7d', new Date('2026-09-14T15:04:00Z')))
      .toBe('2026-09-08..2026-09-14');
  });

  it('applies last:7d defaults without taking a baked status KPI filter from the page status control', () => {
    const ops: DashboardCanvasPageConfig = {
      personalizable: true,
      domain: [{ id: 'ops_jobs', dataSourceRef: 'ds', exposedFields: ['id', 'status', 'created_at'] }],
      filters: [
        {
          id: 'ops-range',
          label: 'Date range',
          domainEntryId: 'ops_jobs',
          field: 'created_at',
          controlType: 'dateRange',
          appliesToWidgetIds: ['ops-ov-kpi-failed'],
          defaultValue: 'last:7d',
        },
        {
          id: 'ops-job-status',
          label: 'Job status',
          domainEntryId: 'ops_jobs',
          field: 'status',
          controlType: 'multiSelect',
          appliesToWidgetIds: ['ops-ov-chart-job-status'],
        },
      ],
    };
    const range = resolveDashboardFilterDefault('last:7d');
    const [gte, lte] = range.split('..');
    expect(collectPivotFilters(
      ops,
      {
        id: 'ops-ov-kpi-failed',
        domainEntryId: 'ops_jobs',
        fieldMapping: { filters: { status: { eq: 'failed' } } },
      },
      { 'ops-job-status': 'completed' },
      undefined,
    )).toEqual({
      status: { eq: 'failed' },
      created_at: { gte, lte },
    });
  });

  it('builds a members pivot for filter-bar select options', () => {
    expect(buildFilterMembersPivotSpec('region')).toEqual({
      rows: [{ field: 'region' }],
      columns: [],
      measures: [{ field: 'region', aggregation: 'count' }],
    });
    expect(pivotResultMemberLabels(sampleResult([10, 30]))).toEqual(['10', '30']);
  });

  it('builds a finer drill-down PivotSpec from the clicked member', () => {
    const spec = buildDrillDownPivotSpec(
      {
        rows: [{ field: 'region' }],
        columns: [],
        measures: [{ field: 'amount', aggregation: 'sum' }],
        filters: { year: { eq: '2026' } },
      },
      'region',
      'west',
      ['region', 'product', 'amount'],
    );
    expect(spec.filters).toEqual({ year: { eq: '2026' }, region: { eq: 'west' } });
    expect(spec.rows).toEqual([{ field: 'product' }]);
    expect(spec.measures).toEqual([{ field: 'amount', aggregation: 'sum' }]);
  });

  it('keeps measures and drops rows when no remaining drill field exists', () => {
    const spec = buildDrillDownPivotSpec(
      {
        rows: [{ field: 'region' }],
        columns: [],
        measures: [{ field: 'amount', aggregation: 'sum' }],
      },
      'region',
      'west',
      ['region', 'amount'],
    );
    expect(spec.rows).toEqual([]);
    expect(spec.filters).toEqual({ region: { eq: 'west' } });
  });

  it('computes running total and percent-of-total over a pivot result', () => {
    const result = sampleResult([10, 30]);
    expect(applyPivotTableCalculation(result, 'runningTotal').cells.map((cell) => cell.values[0])).toEqual([10, 40]);
    expect(applyPivotTableCalculation(result, 'percentOfTotal').cells.map((cell) => cell.values[0])).toEqual([0.25, 0.75]);
  });

  it('bins numeric row members into fixed-count ranges', () => {
    const binned = applyNumericBinning(sampleResult([1, 2, 9, 10]), { mode: 'fixedCount', count: 2 });
    expect(binned.rowAxis.members).toHaveLength(2);
    expect(binned.cells.reduce((sum, cell) => sum + (cell.values[0] ?? 0), 0)).toBe(22);
  });

  it('merges combo pivot results as an outer join with null gaps', () => {
    const left = sampleResult([1]);
    left.rowAxis.fields = ['day'];
    left.rowAxis.members = [{ key: 'd1', labels: ['d1'] }];
    left.cells = [{ rowKey: 'd1', colKey: '__all__', values: [8] }];
    const right: PivotResult = {
      ...sampleResult([1]),
      rowAxis: { fields: ['day'], members: [{ key: 'd2', labels: ['d2'] }] },
      measures: [{ field: 'units', aggregation: 'sum' }],
      cells: [{ rowKey: 'd2', colKey: '__all__', values: [3] }],
    };
    const merged = mergeComboPivotResults(left, right, 'day', 'day');
    expect(merged.measures.map((item) => item.field)).toEqual(['a.amount', 'b.units']);
    expect(merged.cells).toHaveLength(2);
    expect(merged.cells.some((cell) => cell.values.includes(null))).toBe(true);
  });
});

describe('dashboard canvas embed and snapshot URLs', () => {
  it('parses embed query, designer page id, and snapshot paths', () => {
    expect(parseDashboardEmbedRequest('/us/studio/client-components/edit/sales?dc_embed=1')).toEqual({
      embed: true,
      snapshotId: null,
      pageId: 'sales',
      needsFramePolicy: true,
    });
    expect(parseDashboardEmbedRequest('/us/home?dc_embed=1&dc_page=page-9')).toMatchObject({
      embed: true,
      pageId: 'page-9',
      needsFramePolicy: true,
    });
    expect(parseDashboardEmbedRequest('/shared/dashboard-snapshots/snap-1')).toEqual({
      embed: false,
      snapshotId: 'snap-1',
      pageId: null,
      needsFramePolicy: true,
    });
    expect(parseDashboardEmbedRequest('/studio/users')).toMatchObject({
      embed: false,
      snapshotId: null,
      needsFramePolicy: false,
    });
  });

  it('strips studio chrome for embed query and snapshot viewer paths', () => {
    expect(isDashboardChromeStrippedView('/studio/client-components/edit/sales', '?dc_embed=1')).toBe(true);
    expect(isDashboardChromeStrippedView('/shared/dashboard-snapshots/snap-1', '')).toBe(true);
    expect(isDashboardChromeStrippedView('/studio/users', '')).toBe(false);
  });

  it('builds public snapshot and embed hrefs', () => {
    expect(dashboardSnapshotViewerPath('snap/1')).toBe('/shared/dashboard-snapshots/snap%2F1');
    expect(buildDashboardEmbedHref('https://app.example', '/studio/home', '?tab=a', 'page-1')).toBe(
      'https://app.example/studio/home?tab=a&dc_embed=1&dc_page=page-1',
    );
  });

  it('sanitizes embed origins and refuses wildcard frame-ancestors', () => {
    expect(sanitizeDashboardEmbedOrigins(['https://partner.example', '*', 'https://*.evil.test', 'not a host'])).toEqual([
      'https://partner.example',
    ]);
    expect(buildDashboardFrameAncestorsCsp(['https://partner.example', 'http://127.0.0.1:4173'])).toBe(
      "frame-ancestors 'self' https://partner.example http://127.0.0.1:4173",
    );
    expect(buildDashboardFrameAncestorsCsp([])).toBeNull();
  });

  it('hides filters that do not apply to the visible tab widgets and disambiguates date ranges', () => {
    const scoped = scopeDashboardFilters(
      [
        {
          id: 'jobs-range',
          label: 'Date range',
          domainEntryId: 'sales',
          field: 'created_at',
          controlType: 'dateRange',
          appliesToWidgetIds: ['jobs-kpi'],
        },
        {
          id: 'logs-range',
          label: 'Date range',
          domainEntryId: 'logs',
          field: 'created_at',
          controlType: 'dateRange',
          appliesToWidgetIds: ['logs-kpi'],
        },
        {
          id: 'job-status',
          label: 'Job status',
          domainEntryId: 'sales',
          field: 'status',
          controlType: 'multiSelect',
          appliesToWidgetIds: ['jobs-chart'],
        },
      ],
      ['jobs-kpi', 'jobs-chart'],
      [
        { id: 'sales', label: 'Jobs', dataSourceRef: 'ds1', exposedFields: ['region'] },
        { id: 'logs', label: 'Logs', dataSourceRef: 'ds1', exposedFields: ['level'] },
      ],
    );
    expect(scoped.map((filter) => filter.id)).toEqual(['jobs-range', 'job-status']);
    expect(scoped[0]?.label).toBe('Date range');
  });

  it('disambiguates date range labels only when two or more are visible on the tab', () => {
    const scoped = scopeDashboardFilters(
      [
        {
          id: 'jobs-range',
          label: 'Date range',
          domainEntryId: 'sales',
          field: 'created_at',
          controlType: 'dateRange',
          appliesToWidgetIds: ['jobs-kpi'],
        },
        {
          id: 'logs-range',
          label: 'Date range',
          domainEntryId: 'logs',
          field: 'created_at',
          controlType: 'dateRange',
          appliesToWidgetIds: ['logs-kpi'],
        },
      ],
      ['jobs-kpi', 'logs-kpi'],
      [
        { id: 'sales', label: 'Jobs', dataSourceRef: 'ds1', exposedFields: ['region'] },
        { id: 'logs', label: 'Logs', dataSourceRef: 'ds1', exposedFields: ['level'] },
      ],
    );
    expect(scoped.map((filter) => filter.label)).toEqual(['Jobs date range', 'Logs date range']);
  });

  it('reads frozen snapshot widget results from the persisted payload', () => {
    const widgets = parseFrozenDashboardSnapshotPayload({
      frozen: true,
      results: [
        { widgetId: 'w1', kind: 'table', result: sampleResult([4]) },
        { widgetId: 'bad', result: { cells: [] } },
      ],
    });
    expect(widgets).toHaveLength(1);
    expect(widgets[0]?.widgetId).toBe('w1');
    expect(widgets[0]?.kind).toBe('table');
  });

  it('formats ISO chart axis labels and colors semantic slices', () => {
    expect(formatDashboardChartAxisLabel('2026-09-13T12:08:33.764Z')).toBe('Sep 13, 12:08 PM');
    expect(formatDashboardChartAxisLabel('2026-09-13')).toBe('Sep 13');
    expect(formatDashboardChartAxisLabel('ERROR')).toBe('ERROR');
    expect(formatDashboardChartAxisLabel('LOGIN_SUCCESS')).toBe('Login Success');
    expect(formatDashboardChartAxisLabel('2026-09-13T12:07:23.314Z / 0')).toBe('Sep 13, 12:07 PM / 0');
    expect(resolveDashboardSliceColor('ERROR')).toBe('#e11d48');
    expect(resolveDashboardSliceColor('INFO')).toBe('#64748b');
    expect(resolveDashboardSliceColor('Login Success')).toBe('#059669');
    expect(dashboardKpiValueClass('Error logs', '53')).toBe('text-rose-600');
    expect(dashboardKpiValueClass('Error logs', '0')).toBe('text-slate-900');
    expect(dashboardKpiValueClass('Unverified email', '1')).toBe('text-amber-600');
    expect(dashboardKpiValueClass('Fail streak', '2')).toBe('text-rose-600');
    const rows = pivotResultToChartRows({
      rowAxis: { fields: ['level'], members: [{ key: 'r0', labels: ['ERROR'] }] },
      colAxis: { fields: [], members: [{ key: '__all__', labels: [] }] },
      measures: [{ field: 'id', aggregation: 'count' }],
      cells: [{ rowKey: 'r0', colKey: '__all__', values: [12] }],
    });
    expect(rows[0]?.label).toBe('ERROR');
    expect(rows[0]?.color).toBe('#e11d48');
  });

  it('maps boolean pie members and widens a success/fail day series', () => {
    const locked = pivotResultToChartRows({
      rowAxis: { fields: ['locked'], members: [{ key: 'r0', labels: [0] }] },
      colAxis: { fields: [], members: [{ key: '__all__', labels: [] }] },
      measures: [{ field: 'id', aggregation: 'count' }],
      cells: [{ rowKey: 'r0', colKey: '__all__', values: [2] }],
    });
    expect(locked[0]?.label).toBe('Open');
    const wide = pivotResultToChartRows({
      rowAxis: {
        fields: ['created_at'],
        members: [{ key: 'r0', labels: ['2026-09-13T12:07:23.314Z'] }],
      },
      colAxis: {
        fields: ['success'],
        members: [
          { key: 'c0', labels: [0] },
          { key: 'c1', labels: [1] },
        ],
      },
      measures: [{ field: 'id', aggregation: 'count' }],
      cells: [
        { rowKey: 'r0', colKey: 'c0', values: [1] },
        { rowKey: 'r0', colKey: 'c1', values: [2] },
      ],
    });
    expect(wide).toEqual([
      { label: 'Sep 13, 12:07 PM', Fail: 1, Success: 2 },
    ]);
  });
});
