import * as React from 'react';
import type { PivotResult, PivotSpec } from '../../shared/api/contracts/data-api';
import type {
  DashboardCanvasPageConfig,
  DashboardUserWidget,
} from '../../shared/api/contracts/dashboard-canvas';
import {
  applyNumericBinning,
  applyPivotTableCalculation,
  applyReferenceLineToRows,
  buildWidgetPivotSpec,
  collectPivotFilters,
  dashboardChartRowsAreEmpty,
  dashboardKpiValueClass,
  mergeComboPivotResults,
  parseDashboardWidgetFieldMapping,
  parseDashboardWidgetVizConfig,
  pivotResultToChartRows,
  resolveDashboardSliceColor,
  unwrapPivotApiResult,
  type DashboardCanvasQueryState,
} from '../../shared/lib/dashboardCanvas';
import { apiPost } from '../../shared/api/client';
import { AppTableGrid } from '../../shared/ui';
import { resolveChartDataPointClickPayload } from './bindingChartEngine';
import {
  DesignerVizBarChart,
  DesignerVizLineChart,
  DesignerVizPieChart,
} from './DesignerRuntimeCharts';
import { DesignerUniversalStatTrend } from './DesignerRuntimeUniversalWidgets';

export const requestDashboardCanvasPivot = async (
  pageId: string,
  domainEntryId: string,
  spec: PivotSpec,
  widgetNodeId: string,
): Promise<PivotResult | null> => {
  const { data } = await apiPost(`/api/dashboard-canvas/pages/${encodeURIComponent(pageId)}/pivot`, {
    pageId,
    domainEntryId,
    spec,
    widgetNodeId,
  });
  return unwrapPivotApiResult(data);
};

type DesignerRuntimeDashboardUserWidgetProps = {
  pageId: string;
  widget: DashboardUserWidget;
  config: DashboardCanvasPageConfig;
  query: DashboardCanvasQueryState;
  refreshNonce?: number;
  onResult: (widgetId: string, result: PivotResult | null) => void;
  onDataPoint: (widget: DashboardUserWidget, category: string) => void;
};

export const DesignerRuntimeDashboardUserWidget: React.FC<DesignerRuntimeDashboardUserWidgetProps> = ({
  pageId,
  widget,
  config,
  query,
  refreshNonce = 0,
  onResult,
  onDataPoint,
}) => {
  const mapping = React.useMemo(() => parseDashboardWidgetFieldMapping(widget.fieldMapping), [widget.fieldMapping]);
  const viz = React.useMemo(() => parseDashboardWidgetVizConfig(widget.vizConfig), [widget.vizConfig]);
  const [result, setResult] = React.useState<PivotResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    if (widget.kind === 'text') {
      onResult(widget.id, null);
      return;
    }
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(false);
      try {
        let next: PivotResult | null = null;
        if (widget.kind === 'combo' && widget.comboRef) {
          const filtersA = collectPivotFilters(
            config,
            { id: widget.id, domainEntryId: widget.comboRef.domainEntryIdA },
            query.filters,
            query.crossFilter,
          );
          const filtersB = collectPivotFilters(
            config,
            { id: widget.id, domainEntryId: widget.comboRef.domainEntryIdB },
            query.filters,
            query.crossFilter,
          );
          const metricA = mapping.metric
            ?? config.domain.find((entry) => entry.id === widget.comboRef?.domainEntryIdA)?.exposedFields[0];
          const metricB = mapping.metricB
            ?? config.domain.find((entry) => entry.id === widget.comboRef?.domainEntryIdB)?.exposedFields[0];
          if (!metricA || !metricB) {
            throw new Error('Combo widget is missing metrics.');
          }
          const [left, right] = await Promise.all([
            requestDashboardCanvasPivot(pageId, widget.comboRef.domainEntryIdA, {
              rows: [{ field: widget.comboRef.fieldA }],
              columns: [],
              measures: [{ field: metricA, aggregation: mapping.aggregation ?? 'sum' }],
              filters: filtersA,
            }, widget.id),
            requestDashboardCanvasPivot(pageId, widget.comboRef.domainEntryIdB, {
              rows: [{ field: widget.comboRef.fieldB }],
              columns: [],
              measures: [{ field: metricB, aggregation: mapping.aggregationB ?? 'sum' }],
              filters: filtersB,
            }, widget.id),
          ]);
          if (left && right) {
            next = mergeComboPivotResults(left, right, widget.comboRef.fieldA, widget.comboRef.fieldB);
          }
        } else {
          const built = buildWidgetPivotSpec(widget, config, query);
          if (built) {
            next = await requestDashboardCanvasPivot(pageId, built.domainEntryId, built.spec, widget.id);
            if (!next) {
              throw new Error('Pivot returned no result.');
            }
          }
        }
        if (cancelled) return;
        if (next && viz.binning) {
          next = applyNumericBinning(next, viz.binning);
        }
        if (next && viz.tableCalculation) {
          next = applyPivotTableCalculation(next, viz.tableCalculation);
        }
        setResult(next);
        onResult(widget.id, next);
      } catch {
        if (!cancelled) {
          setError(true);
          onResult(widget.id, null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [pageId, widget, config, query, mapping, viz, onResult, refreshNonce]);

  const handlePointClick = (event: Event) => {
    const payload = resolveChartDataPointClickPayload(event);
    if (payload?.category) {
      onDataPoint(widget, payload.category);
    }
  };

  if (widget.kind === 'text') {
    return (
      <p className="whitespace-pre-wrap text-sm text-slate-700">{viz.text || 'Notes widget'}</p>
    );
  }

  const emptyNote = (message: string) => (
    <p className="flex h-full min-h-[4.5rem] items-center justify-center px-3 text-center text-sm text-slate-600">
      {message}
    </p>
  );

  if (loading) {
    return emptyNote('Loading widget data…');
  }
  if (error) {
    return (
      <p className="flex h-full min-h-[4.5rem] items-center justify-center px-3 text-center text-sm text-rose-600">
        Unable to load this widget.
      </p>
    );
  }
  if (!result) {
    if (mapping.metric || mapping.title) {
      return emptyNote(viz.emptyText || 'No rows in this date range.');
    }
    return emptyNote('Pick a metric to query this domain.');
  }

  const chartRows = pivotResultToChartRows(result);
  if (widget.kind !== 'kpi' && dashboardChartRowsAreEmpty(chartRows)) {
    return emptyNote(viz.emptyText || 'No rows in this date range.');
  }
  const lined = applyReferenceLineToRows(chartRows, viz.referenceLine);
  const firstValue = result.cells[0]?.values[0];
  const seriesKeyList = lined.seriesKeys.split(',').map((key) => key.trim()).filter(Boolean);
  const singleSeries = widget.kind !== 'combo' && seriesKeyList.length <= 1;
  const seriesColors = Object.fromEntries(
    seriesKeyList
      .map((key) => {
        const color = resolveDashboardSliceColor(key);
        return color ? [key, color] as const : null;
      })
      .filter((entry): entry is readonly [string, string] => entry != null),
  );

  if (widget.kind === 'kpi') {
    const empty = result.cells.length === 0;
    const display = empty
      ? (mapping.aggregation === 'count' || mapping.aggregation === 'countDistinct' ? '0' : (viz.emptyText || '—'))
      : (firstValue == null ? '—' : String(firstValue));
    return (
      <DesignerUniversalStatTrend
        className="border-0 bg-transparent p-0"
        value={display}
        valueClassName={dashboardKpiValueClass(mapping.title ?? '', display)}
      />
    );
  }

  if (widget.kind === 'table') {
    const columns = [
      {
        id: 'label',
        label: 'Member',
        renderCell: (row: Record<string, unknown>) => String(row.label ?? ''),
        isRowHeader: true,
      },
      {
        id: 'value',
        label: 'Count',
        renderCell: (row: Record<string, unknown>) => (row.value == null ? '—' : String(row.value)),
      },
    ];
    return (
      <AppTableGrid
        chrome="hero"
        fillHeight={false}
        scrollOwner="panel"
        columns={columns}
        rows={chartRows}
        getRowKey={(row) => String(row.label ?? '')}
        ariaLabel="Dashboard table widget"
        onRowClick={(row) => onDataPoint(widget, String(row.label ?? ''))}
      />
    );
  }

  const chartProps = {
    data: lined.rows,
    seriesKeys: widget.kind === 'combo'
      ? result.measures.map((measure) => `${measure.field}_${measure.aggregation}`).join(',')
      : lined.seriesKeys,
    xAxisKey: 'label',
    height: 280,
    chartListBound: true,
    chartListLoading: loading,
    chartListError: error,
    showLegend: mapping.chartKind === 'pie' || !singleSeries,
    showLabels: mapping.chartKind === 'pie',
    seriesLabels: singleSeries ? { value: mapping.title || 'Count' } : undefined,
    seriesColors: Object.keys(seriesColors).length > 0 ? seriesColors : undefined,
    showMarkLine: lined.showMarkLine,
    showMarkPoint: lined.showMarkPoint,
    onDataPointClick: handlePointClick,
    ariaDecal: false,
    option: mapping.chartKind === 'pie'
      ? { aria: { enabled: true, decal: { show: false } } }
      : {
        aria: { enabled: true, decal: { show: false } },
        yAxis: { minInterval: 1, axisLabel: { color: '#475569', fontSize: 12 } },
        xAxis: { axisLabel: { color: '#475569', fontSize: 12, hideOverlap: true } },
      },
    seriesOption: mapping.chartKind === 'bar' ? { barMaxWidth: 72 } : undefined,
  };

  if (mapping.chartKind === 'line') {
    return <DesignerVizLineChart {...chartProps} />;
  }
  if (mapping.chartKind === 'pie') {
    return <DesignerVizPieChart {...chartProps} />;
  }
  return <DesignerVizBarChart {...chartProps} />;
};
