import * as React from 'react';
import {
  UiBarChart,
  UiLineChart,
  UiPieChart,
  UiSparkline,
  type UiChartDataPointClickDetail,
  type UiChartGaugeThreshold,
} from '../../shared/ui/UiChart';
import {
  readUiChartEchartsChrome,
  resolveUiChartEchartsPassthrough,
  type UiChartEchartsChrome,
} from '../../shared/ui/echarts/uiChartEchartsChrome';
import type { DesignerNode } from './types';
import {
  DEFAULT_CHART_X_AXIS_KEY,
  parseDesignerChartData,
  parseSeriesKeys,
  resolveChartNumericValue,
  type DesignerChartDataRow,
} from './visualizationDataModel';
import { MOCK_CHART_SALES_Q1_JSON } from './visualizationMockFixtures';
import { readNumber, readString } from './runtimeShared';
import {
  createChartDataPointClickEvent,
  parseDesignerChartFieldMapping,
  resolveChartDataFromMultiSourceDatasets,
  resolveChartDataFromRows,
  resolveChartMappingTypeFromNode,
  resolveChartSeriesColorsFromMapping,
  resolveChartSeriesLabelsFromMapping,
  resolveGaugeConfigFromNode,
  type DesignerChartFieldMapping,
} from './bindingChartEngine';
import { renderDesignerVizDataState } from './designerVizDataState';

export type DesignerChartRuntimeProps = {
  title?: string;
  data?: string | DesignerChartDataRow[];
  seriesKeys?: string;
  xAxisKey?: string;
  seriesColors?: Record<string, string>;
  seriesLabels?: Record<string, string>;
  showLegend?: boolean;
  showGrid?: boolean;
  height?: number;
  orientation?: 'vertical' | 'horizontal';
  grouped?: boolean;
  chartVariant?: string;
  valueKey?: string;
  gaugeMin?: number;
  gaugeMax?: number;
  gaugeThresholds?: UiChartGaugeThreshold[];
  className?: string;
  style?: React.CSSProperties;
  /** When true, do not fall back to mock data when rows are empty. */
  chartListBound?: boolean;
  chartListLoading?: boolean;
  chartListError?: boolean;
  isLoading?: boolean;
  emptyContent?: string;
  errorContent?: string;
  toolbar?: React.ReactNode;
  onDataPointClick?: (event: Event) => void;
  option?: import('../../shared/ui/echarts/uiEchartsApi').UiEchartsOptionProps['option'];
  seriesOption?: import('../../shared/ui/echarts/uiEchartsApi').UiEchartsOptionProps['seriesOption'];
} & UiChartEchartsChrome;

const resolveChartRows = (data: unknown, chartListBound?: boolean): DesignerChartDataRow[] => {
  const parsed = parseDesignerChartData(data);
  if (parsed.length > 0) {
    return parsed;
  }
  if (chartListBound) {
    return [];
  }
  return parseDesignerChartData(MOCK_CHART_SALES_Q1_JSON);
};

const adaptDataPointClick = (
  onDataPointClick: ((event: Event) => void) | undefined,
): ((detail: UiChartDataPointClickDetail) => void) | undefined => {
  if (!onDataPointClick) {
    return undefined;
  }
  return (detail) => {
    onDataPointClick(createChartDataPointClickEvent(detail));
  };
};

const ChartTitle: React.FC<{ title: string }> = ({ title }) =>
  title.length > 0 ? (
    <div className="mb-2 ps-[4px] text-sm font-semibold text-slate-800">{title}</div>
  ) : null;

const ChartShell: React.FC<{
  title: string;
  toolbar?: React.ReactNode;
  chartListLoading?: boolean;
  chartListError?: boolean;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyContent?: string;
  errorContent?: string;
  className?: string;
  style?: React.CSSProperties;
  dataComponent: string;
  children: React.ReactNode;
}> = ({ title, toolbar, chartListLoading, chartListError, isLoading, isEmpty, emptyContent, errorContent, className, style, dataComponent, children }) => (
  <div className={className} style={style} data-designer-component={dataComponent}>
    <ChartTitle title={title} />
    {toolbar}
    {renderDesignerVizDataState({
      isLoading: chartListLoading || isLoading,
      loadingMessage: 'Loading chart data…',
      hasError: chartListError,
      errorContent,
      isEmpty,
      emptyContent,
      children,
    })}
  </div>
);

export const DesignerVizBarChart: React.FC<DesignerChartRuntimeProps> = (props) => {
  const {
    title = '',
    data,
    seriesKeys = 'revenue,cost',
    xAxisKey = DEFAULT_CHART_X_AXIS_KEY,
    seriesColors,
    seriesLabels,
    showLegend = true,
    showGrid = true,
    height = 280,
    orientation = 'vertical',
    grouped = true,
    className,
    style,
    chartListBound,
    chartListLoading,
    chartListError,
    isLoading,
    emptyContent,
    errorContent,
    toolbar,
    onDataPointClick,
  } = props;
  const rows = resolveChartRows(data, chartListBound);
  const keys = parseSeriesKeys(seriesKeys, 'revenue');

  return (
    <ChartShell
      title={title}
      toolbar={toolbar}
      chartListLoading={chartListLoading}
      chartListError={chartListError}
      isLoading={isLoading}
      isEmpty={chartListBound && rows.length === 0}
      emptyContent={emptyContent}
      errorContent={errorContent}
      className={className}
      style={style}
      dataComponent="viz.chart-bar"
    >
      <UiBarChart
        data={rows}
        seriesKeys={keys}
        xAxisKey={xAxisKey}
        seriesColors={seriesColors}
        seriesLabels={seriesLabels}
        showLegend={showLegend}
        showGrid={showGrid}
        height={height}
        orientation={orientation}
        grouped={grouped}
        onDataPointClick={adaptDataPointClick(onDataPointClick)}
        option={props.option}
        seriesOption={props.seriesOption}
        {...resolveUiChartEchartsPassthrough(props)}
      />
    </ChartShell>
  );
};

export const DesignerVizLineChart: React.FC<DesignerChartRuntimeProps> = (props) => {
  const {
    title = '',
    data,
    seriesKeys = 'revenue',
    xAxisKey = DEFAULT_CHART_X_AXIS_KEY,
    seriesColors,
    seriesLabels,
    showLegend = true,
    showGrid = true,
    height = 280,
    chartVariant = 'line',
    className,
    style,
    chartListBound,
    chartListLoading,
    chartListError,
    isLoading,
    emptyContent,
    errorContent,
    toolbar,
    onDataPointClick,
  } = props;
  const rows = resolveChartRows(data, chartListBound);
  const keys = parseSeriesKeys(seriesKeys, 'revenue');

  return (
    <ChartShell
      title={title}
      toolbar={toolbar}
      chartListLoading={chartListLoading}
      chartListError={chartListError}
      isLoading={isLoading}
      isEmpty={chartListBound && rows.length === 0}
      emptyContent={emptyContent}
      errorContent={errorContent}
      className={className}
      style={style}
      dataComponent="viz.chart-line"
    >
      <UiLineChart
        data={rows}
        seriesKeys={keys}
        xAxisKey={xAxisKey}
        seriesColors={seriesColors}
        seriesLabels={seriesLabels}
        showLegend={showLegend}
        showGrid={showGrid}
        height={height}
        variant={chartVariant === 'area' ? 'area' : 'line'}
        onDataPointClick={adaptDataPointClick(onDataPointClick)}
        option={props.option}
        seriesOption={props.seriesOption}
        {...resolveUiChartEchartsPassthrough(props)}
      />
    </ChartShell>
  );
};

export const DesignerVizPieChart: React.FC<DesignerChartRuntimeProps> = (props) => {
  const {
    title = '',
    data,
    seriesKeys = 'revenue',
    xAxisKey = DEFAULT_CHART_X_AXIS_KEY,
    seriesColors,
    showLegend = true,
    height = 280,
    chartVariant = 'pie',
    valueKey,
    gaugeMin,
    gaugeMax,
    gaugeThresholds,
    className,
    style,
    chartListBound,
    chartListLoading,
    chartListError,
    isLoading,
    emptyContent,
    errorContent,
    toolbar,
    onDataPointClick,
  } = props;
  const rows = resolveChartRows(data, chartListBound);
  const keys = parseSeriesKeys(seriesKeys, 'revenue');
  const variant = chartVariant === 'gauge' ? 'gauge' : chartVariant === 'donut' ? 'donut' : 'pie';

  return (
    <ChartShell
      title={title}
      toolbar={toolbar}
      chartListLoading={chartListLoading}
      chartListError={chartListError}
      isLoading={isLoading}
      isEmpty={chartListBound && rows.length === 0}
      emptyContent={emptyContent}
      errorContent={errorContent}
      className={className}
      style={style}
      dataComponent="viz.chart-pie"
    >
      <UiPieChart
        data={rows}
        seriesKeys={keys}
        xAxisKey={xAxisKey}
        seriesColors={seriesColors}
        showLegend={showLegend}
        height={height}
        variant={variant}
        valueKey={valueKey}
        gaugeMin={gaugeMin}
        gaugeMax={gaugeMax}
        gaugeThresholds={gaugeThresholds}
        onDataPointClick={adaptDataPointClick(onDataPointClick)}
        option={props.option}
        seriesOption={props.seriesOption}
        {...resolveUiChartEchartsPassthrough(props)}
      />
    </ChartShell>
  );
};

export const DesignerVizSparkline: React.FC<DesignerChartRuntimeProps> = (props) => {
  const {
    data,
    seriesKeys = 'revenue',
    xAxisKey = DEFAULT_CHART_X_AXIS_KEY,
    seriesColors,
    height = 48,
    chartVariant = 'line',
    className,
    style,
    chartListBound,
    chartListLoading,
    chartListError,
    isLoading,
    emptyContent,
    errorContent,
    toolbar,
    onDataPointClick,
  } = props;
  const rows = resolveChartRows(data, chartListBound);
  const keys = parseSeriesKeys(seriesKeys, 'revenue');
  const key = keys[0] ?? 'revenue';
  const sparkColor = seriesColors?.[key];

  return (
    <ChartShell
      title=""
      toolbar={toolbar}
      chartListLoading={chartListLoading}
      chartListError={chartListError}
      isLoading={isLoading}
      isEmpty={chartListBound && rows.length === 0}
      emptyContent={emptyContent}
      errorContent={errorContent}
      className={className}
      style={style}
      dataComponent="viz.chart-sparkline"
    >
      <UiSparkline
        data={rows}
        seriesKey={key}
        color={sparkColor}
        height={height}
        variant={chartVariant === 'bar' ? 'bar' : 'line'}
        xAxisKey={xAxisKey}
        onDataPointClick={adaptDataPointClick(onDataPointClick)}
        {...resolveUiChartEchartsPassthrough({
          showTooltip: props.showTooltip,
          animation: props.animation,
          darkMode: props.darkMode,
          renderer: props.renderer,
        })}
      />
      {rows.length > 0 ? (
        <span className="mt-1 block text-[10px] text-slate-500">
          {String(rows[rows.length - 1]?.[xAxisKey] ?? '')}: {resolveChartNumericValue(rows[rows.length - 1] ?? {}, key)}
        </span>
      ) : null}
    </ChartShell>
  );
};

export type ResolveChartPropsOptions = {
  chartRows?: Array<Record<string, unknown>>;
  chartSourceDatasets?: Array<{
    rows: Array<Record<string, unknown>>;
    fieldMapping: DesignerChartFieldMapping;
  }>;
  chartListBound?: boolean;
  chartListLoading?: boolean;
  chartListError?: boolean;
  toolbar?: React.ReactNode;
  onDataPointClick?: (event: Event) => void;
};

export const resolveChartPropsFromNode = (
  node: DesignerNode,
  options: ResolveChartPropsOptions = {},
): DesignerChartRuntimeProps => {
  const chartTypeHint = resolveChartMappingTypeFromNode(node);
  const fieldMappingRaw = node.props.chartFieldMapping;
  const fieldMapping = parseDesignerChartFieldMapping(fieldMappingRaw, { chartTypeHint });
  const staticData = readString(node.props.data, MOCK_CHART_SALES_Q1_JSON);
  const seriesKeys = readString(node.props.seriesKeys, 'revenue,cost');
  const xAxisKey = readString(node.props.xAxisKey, DEFAULT_CHART_X_AXIS_KEY);
  const gaugeConfig = resolveGaugeConfigFromNode(node, fieldMapping);

  let resolvedData: string | DesignerChartDataRow[] = staticData;
  let resolvedSeriesKeys = seriesKeys;
  let resolvedXAxisKey = xAxisKey;
  let resolvedSeriesColors = fieldMapping ? resolveChartSeriesColorsFromMapping(fieldMapping) : undefined;
  let resolvedSeriesLabels = fieldMapping ? resolveChartSeriesLabelsFromMapping(fieldMapping) : undefined;

  if (options.chartSourceDatasets && options.chartSourceDatasets.length > 1) {
    const resolved = resolveChartDataFromMultiSourceDatasets(
      options.chartSourceDatasets,
      seriesKeys,
      chartTypeHint,
    );
    resolvedData = resolved.data;
    resolvedSeriesKeys = resolved.seriesKeys;
    resolvedXAxisKey = resolved.xAxisKey;
    resolvedSeriesColors = resolved.seriesColors;
    resolvedSeriesLabels = resolved.seriesLabels;
  } else if (options.chartRows) {
    const resolved = resolveChartDataFromRows(options.chartRows, fieldMapping, seriesKeys);
    resolvedData = resolved.data;
    resolvedSeriesKeys = resolved.seriesKeys;
    resolvedXAxisKey = resolved.xAxisKey;
    resolvedSeriesColors = resolved.seriesColors;
    resolvedSeriesLabels = resolved.seriesLabels;
  }

  return {
    title: readString(node.props.title),
    data: resolvedData,
    seriesKeys: resolvedSeriesKeys,
    xAxisKey: resolvedXAxisKey,
    seriesColors: resolvedSeriesColors,
    seriesLabels: resolvedSeriesLabels,
    showLegend: node.props.showLegend !== false,
    showGrid: node.props.showGrid !== false,
    height: readNumber(node.props.height, 280),
    orientation: readString(node.props.orientation, 'vertical') === 'horizontal' ? 'horizontal' : 'vertical',
    grouped: node.props.grouped !== false,
    chartVariant: readString(node.props.chartVariant, 'line'),
    valueKey: readString(node.props.valueKey),
    gaugeMin: gaugeConfig.gaugeMin,
    gaugeMax: gaugeConfig.gaugeMax,
    gaugeThresholds: gaugeConfig.gaugeThresholds,
    className: readString(node.props.className, 'w-full rounded-lg border border-slate-200 bg-white p-3'),
    chartListBound: options.chartListBound,
    chartListLoading: options.chartListLoading,
    chartListError: options.chartListError,
    isLoading: node.props.isLoading === true,
    emptyContent: readString(node.props.emptyContent),
    errorContent: readString(node.props.errorContent),
    toolbar: options.toolbar,
    onDataPointClick: options.onDataPointClick,
    ...readUiChartEchartsChrome(node.props),
  };
};
