import * as React from 'react';
import { ADVANCED_CHART_TYPES, isAdvancedChartType, type AdvancedChartType } from '../../shared/ui/advancedChartTypes';
import { UiAdvancedChart } from '../../shared/ui/UiAdvancedCharts';
import type { UiChartDataPointClickDetail } from '../../shared/ui/UiChart';
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
  type DesignerChartDataRow,
} from './visualizationDataModel';
import {
  MOCK_ADVANCED_CHART_DATA_BY_TYPE,
  MOCK_CHART_SALES_Q1_JSON,
} from './visualizationMockFixtures';
import { readNumber, readString } from './runtimeShared';
import {
  createChartDataPointClickEvent,
  parseDesignerChartFieldMapping,
  resolveChartDataFromMultiSourceDatasets,
  resolveChartDataFromRows,
  resolveChartSeriesColorsFromMapping,
  resolveChartSeriesLabelsFromMapping,
  type DesignerChartFieldMapping,
} from './bindingChartEngine';
import { renderDesignerVizDataState } from './designerVizDataState';

export { ADVANCED_CHART_TYPES, isAdvancedChartType, type AdvancedChartType };

export type DesignerAdvancedChartRuntimeProps = {
  title?: string;
  chartType?: AdvancedChartType | string;
  data?: string | DesignerChartDataRow[];
  seriesKeys?: string;
  xAxisKey?: string;
  yAxisKey?: string;
  valueKey?: string;
  sizeKey?: string;
  colorKey?: string;
  seriesColors?: Record<string, string>;
  seriesLabels?: Record<string, string>;
  showLegend?: boolean;
  showGrid?: boolean;
  height?: number;
  showTrendline?: boolean;
  showConversionRate?: boolean;
  showConnectors?: boolean;
  showVolume?: boolean;
  maxValue?: number;
  className?: string;
  style?: React.CSSProperties;
  chartListBound?: boolean;
  chartListLoading?: boolean;
  chartListError?: boolean;
  isLoading?: boolean;
  emptyContent?: string;
  errorContent?: string;
  toolbar?: React.ReactNode;
  onDataPointClick?: (event: Event) => void;
} & UiChartEchartsChrome;

const resolveAdvancedChartType = (raw: unknown): AdvancedChartType => {
  if (isAdvancedChartType(raw)) {
    return raw;
  }
  return 'scatter';
};

const resolveChartRows = (
  data: unknown,
  chartType: AdvancedChartType,
  chartListBound?: boolean,
): DesignerChartDataRow[] => {
  const parsed = parseDesignerChartData(data);
  if (parsed.length > 0) {
    return parsed;
  }
  if (chartListBound) {
    return [];
  }
  const fixture = MOCK_ADVANCED_CHART_DATA_BY_TYPE[chartType];
  return parseDesignerChartData(fixture ?? MOCK_CHART_SALES_Q1_JSON);
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

export const DesignerVizAdvancedChart: React.FC<DesignerAdvancedChartRuntimeProps> = (props) => {
  const {
    title = '',
    chartType: chartTypeRaw = 'scatter',
    data,
    seriesKeys = 'value',
    xAxisKey = DEFAULT_CHART_X_AXIS_KEY,
    yAxisKey = 'y',
    valueKey = 'value',
    sizeKey,
    colorKey,
    seriesColors,
    seriesLabels,
    showLegend = true,
    showGrid = true,
    height = 280,
    showTrendline = false,
    showConversionRate = true,
    showConnectors = true,
    showVolume = true,
    maxValue,
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
  const chartType = resolveAdvancedChartType(chartTypeRaw);
  const rows = resolveChartRows(data, chartType, chartListBound);
  const keys = parseSeriesKeys(seriesKeys, valueKey || 'value');

  return (
    <div className={className} style={style} data-designer-component="viz.chart" data-chart-type={chartType}>
      {title.length > 0 ? (
        <div className="mb-2 ps-[4px] text-sm font-semibold text-slate-800">{title}</div>
      ) : null}
      {toolbar}
      {renderDesignerVizDataState({
        isLoading: chartListLoading || isLoading,
        loadingMessage: 'Loading chart data…',
        hasError: chartListError,
        errorContent,
        isEmpty: chartListBound && rows.length === 0,
        emptyContent,
        children: (
          <UiAdvancedChart
            chartType={chartType}
            data={rows}
            seriesKeys={keys}
            xAxisKey={xAxisKey}
            yAxisKey={yAxisKey}
            valueKey={valueKey || keys[0] || 'value'}
            sizeKey={sizeKey}
            colorKey={colorKey}
            seriesColors={seriesColors}
            seriesLabels={seriesLabels}
            showLegend={showLegend}
            showGrid={showGrid}
            height={height}
            showTrendline={showTrendline}
            showConversionRate={showConversionRate}
            showConnectors={showConnectors}
            showVolume={showVolume}
            maxValue={maxValue}
            onDataPointClick={adaptDataPointClick(onDataPointClick)}
            {...resolveUiChartEchartsPassthrough(props)}
          />
        ),
      })}
    </div>
  );
};

export type ResolveAdvancedChartPropsOptions = {
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

export const resolveAdvancedChartPropsFromNode = (
  node: DesignerNode,
  options: ResolveAdvancedChartPropsOptions = {},
): DesignerAdvancedChartRuntimeProps => {
  const chartType = resolveAdvancedChartType(node.props.chartType);
  const fieldMappingRaw = node.props.chartFieldMapping;
  const fieldMapping = parseDesignerChartFieldMapping(fieldMappingRaw, { chartTypeHint: 'bar' });
  const fixture = MOCK_ADVANCED_CHART_DATA_BY_TYPE[chartType] ?? MOCK_CHART_SALES_Q1_JSON;
  const staticData = readString(node.props.data, fixture);
  const seriesKeys = readString(node.props.seriesKeys, chartType === 'radar' ? 'alpha,beta' : 'value');
  const xAxisKey = readString(
    node.props.xAxisKey,
    chartType === 'scatter' ? 'x' : chartType === 'heatmap' ? 'x' : chartType === 'boxplot' ? 'group' : DEFAULT_CHART_X_AXIS_KEY,
  );

  let resolvedData: string | DesignerChartDataRow[] = staticData;
  let resolvedSeriesKeys = seriesKeys;
  let resolvedXAxisKey = xAxisKey;
  let resolvedSeriesColors = fieldMapping ? resolveChartSeriesColorsFromMapping(fieldMapping) : undefined;
  let resolvedSeriesLabels = fieldMapping ? resolveChartSeriesLabelsFromMapping(fieldMapping) : undefined;

  if (options.chartSourceDatasets && options.chartSourceDatasets.length > 1) {
    const resolved = resolveChartDataFromMultiSourceDatasets(
      options.chartSourceDatasets,
      seriesKeys,
      'bar',
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
    chartType,
    data: resolvedData,
    seriesKeys: resolvedSeriesKeys,
    xAxisKey: resolvedXAxisKey,
    yAxisKey: readString(node.props.yAxisKey, chartType === 'scatter' ? 'y' : 'y'),
    valueKey: readString(node.props.valueKey, 'value'),
    sizeKey: readString(node.props.sizeKey) || undefined,
    colorKey: readString(node.props.colorKey) || undefined,
    seriesColors: resolvedSeriesColors,
    seriesLabels: resolvedSeriesLabels,
    showLegend: node.props.showLegend !== false,
    showGrid: node.props.showGrid !== false,
    height: readNumber(node.props.height, 280),
    showTrendline: node.props.showTrendline === true,
    showConversionRate: node.props.showConversionRate !== false,
    showConnectors: node.props.showConnectors !== false,
    showVolume: node.props.showVolume !== false,
    maxValue: typeof node.props.maxValue === 'number' ? node.props.maxValue : undefined,
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
