import * as React from 'react';
import { UiEchartsHost } from './echarts/UiEchartsHost';
import {
  buildBoxplotChartOption,
  buildCandlestickChartOption,
  buildFunnelChartOption,
  buildHeatmapChartOption,
  buildRadarChartOption,
  buildSankeyChartOption,
  buildScatterChartOption,
  buildSunburstChartOption,
  buildTreemapChartOption,
  buildWaterfallChartOption,
} from './echarts/buildChartOption';
import { pickUiEchartsRuntimeProps, type UiEchartsHandle, type UiEchartsPassthrough } from './echarts/uiEchartsApi';
import { useComposedEchartsOption } from './echarts/useComposedEchartsOption';
import {
  UI_CHART_DEFAULT_X_AXIS_KEY,
  type UiChartChrome,
  type UiChartDataPointClickDetail,
  type UiChartDataRow,
} from './uiChartModel';

/**
 * Advanced statistical chart primitives over Apache ECharts — Scatter / Radar /
 * Heatmap / Funnel / Waterfall / Treemap / Sunburst / Sankey / Candlestick / Boxplot.
 * Full ECharts option/event/instance surface is forwarded (`option`, named keys, `onEvents`, ref).
 */

import type { AdvancedChartType } from './advancedChartTypes';

export { ADVANCED_CHART_TYPES, isAdvancedChartType } from './advancedChartTypes';
export type { AdvancedChartType } from './advancedChartTypes';

export type AdvancedChartCommonProps = UiChartChrome & UiEchartsPassthrough & {
  data: UiChartDataRow[];
  seriesKeys: string[];
  xAxisKey?: string;
  yAxisKey?: string;
  valueKey?: string;
  sizeKey?: string;
  colorKey?: string;
  seriesColors?: Record<string, string>;
  seriesLabels?: Record<string, string>;
  height?: number;
  showTrendline?: boolean;
  showConversionRate?: boolean;
  showConnectors?: boolean;
  showVolume?: boolean;
  maxValue?: number;
  onDataPointClick?: (detail: UiChartDataPointClickDetail) => void;
};

const chromeFrom = (props: AdvancedChartCommonProps): UiChartChrome => ({
  showLegend: props.showLegend,
  showGrid: props.showGrid,
  showLabels: props.showLabels,
  dataZoom: props.dataZoom,
  showToolbox: props.showToolbox,
  palette: props.palette,
});

type HostBridgeProps = {
  built: Parameters<typeof useComposedEchartsOption>[0];
  extras: UiEchartsPassthrough;
  height: number;
  chartType: string;
  ariaLabel: string;
  xAxisKey?: string;
  fallbackSeriesKey?: string;
  onDataPointClick?: (detail: UiChartDataPointClickDetail) => void;
};

const ChartHost = React.forwardRef<UiEchartsHandle, HostBridgeProps>(function ChartHost({
  built,
  extras,
  height,
  chartType,
  ariaLabel,
  xAxisKey,
  fallbackSeriesKey,
  onDataPointClick,
}, ref) {
  const composed = useComposedEchartsOption(built, extras);
  return (
    <UiEchartsHost
      ref={ref}
      option={composed}
      height={height}
      chartType={chartType}
      ariaLabel={ariaLabel}
      xAxisKey={xAxisKey}
      fallbackSeriesKey={fallbackSeriesKey}
      onDataPointClick={onDataPointClick}
      {...pickUiEchartsRuntimeProps(extras)}
    />
  );
});

const splitChartProps = (props: AdvancedChartCommonProps) => {
  const {
    data,
    seriesKeys,
    xAxisKey,
    yAxisKey,
    valueKey,
    sizeKey,
    colorKey,
    seriesColors,
    seriesLabels,
    height,
    showTrendline,
    showConversionRate,
    showConnectors,
    showVolume,
    maxValue,
    onDataPointClick,
    option,
    seriesOption,
    dataZoom,
    ...passthrough
  } = props;
  return {
    data,
    seriesKeys,
    xAxisKey,
    yAxisKey,
    valueKey,
    sizeKey,
    colorKey,
    seriesColors,
    seriesLabels,
    height: height ?? 280,
    showTrendline,
    showConversionRate,
    showConnectors,
    showVolume,
    maxValue,
    onDataPointClick,
    extras: { option, seriesOption, dataZoom, ...passthrough } as UiEchartsPassthrough,
  };
};

export const UiScatterChart = React.forwardRef<UiEchartsHandle, AdvancedChartCommonProps>(function UiScatterChart(props, ref) {
  const { data, seriesKeys, xAxisKey = 'x', yAxisKey = 'y', sizeKey, seriesColors, seriesLabels, height, showTrendline = false, onDataPointClick, extras } = {
    ...splitChartProps(props),
    xAxisKey: props.xAxisKey ?? 'x',
    yAxisKey: props.yAxisKey ?? 'y',
    showTrendline: props.showTrendline ?? false,
  };
  const yKey = yAxisKey || seriesKeys[0] || 'y';
  const built = React.useMemo(
    () => buildScatterChartOption(data, xAxisKey, yKey, sizeKey, chromeFrom(props), { seriesColors, seriesLabels, palette: props.palette }, showTrendline),
    [data, xAxisKey, yKey, sizeKey, props, seriesColors, seriesLabels, showTrendline],
  );
  return (
    <ChartHost
      ref={ref}
      built={built}
      extras={extras}
      height={height}
      chartType="scatter"
      ariaLabel="Scatter chart"
      xAxisKey={xAxisKey}
      fallbackSeriesKey={yKey}
      onDataPointClick={onDataPointClick}
    />
  );
});

export const UiRadarChart = React.forwardRef<UiEchartsHandle, AdvancedChartCommonProps>(function UiRadarChart(props, ref) {
  const { data, seriesKeys, xAxisKey = UI_CHART_DEFAULT_X_AXIS_KEY, seriesColors, seriesLabels, height, maxValue, onDataPointClick, extras } = {
    ...splitChartProps(props),
    xAxisKey: props.xAxisKey ?? UI_CHART_DEFAULT_X_AXIS_KEY,
  };
  const built = React.useMemo(
    () => buildRadarChartOption(data, seriesKeys, xAxisKey, chromeFrom(props), { seriesColors, seriesLabels, palette: props.palette }, maxValue),
    [data, seriesKeys, xAxisKey, props, seriesColors, seriesLabels, maxValue],
  );
  return (
    <ChartHost
      ref={ref}
      built={built}
      extras={extras}
      height={height}
      chartType="radar"
      ariaLabel="Radar chart"
      xAxisKey={xAxisKey}
      fallbackSeriesKey={seriesKeys[0] ?? 'value'}
      onDataPointClick={onDataPointClick}
    />
  );
});

export const UiHeatmapChart = React.forwardRef<UiEchartsHandle, AdvancedChartCommonProps>(function UiHeatmapChart(props, ref) {
  const { data, xAxisKey = 'x', yAxisKey = 'y', valueKey = 'value', height, onDataPointClick, extras } = {
    ...splitChartProps(props),
    xAxisKey: props.xAxisKey ?? 'x',
    yAxisKey: props.yAxisKey ?? 'y',
    valueKey: props.valueKey ?? 'value',
  };
  const built = React.useMemo(
    () => buildHeatmapChartOption(data, xAxisKey, yAxisKey, valueKey, chromeFrom(props)),
    [data, xAxisKey, yAxisKey, valueKey, props],
  );
  return (
    <ChartHost
      ref={ref}
      built={built}
      extras={extras}
      height={height}
      chartType="heatmap"
      ariaLabel="Heatmap"
      xAxisKey={xAxisKey}
      fallbackSeriesKey={valueKey}
      onDataPointClick={onDataPointClick}
    />
  );
});

export const UiFunnelChart = React.forwardRef<UiEchartsHandle, AdvancedChartCommonProps>(function UiFunnelChart(props, ref) {
  const { data, xAxisKey = UI_CHART_DEFAULT_X_AXIS_KEY, valueKey = 'value', seriesColors, height, showConversionRate = true, onDataPointClick, extras } = {
    ...splitChartProps(props),
    xAxisKey: props.xAxisKey ?? UI_CHART_DEFAULT_X_AXIS_KEY,
    valueKey: props.valueKey ?? 'value',
    showConversionRate: props.showConversionRate ?? true,
  };
  const built = React.useMemo(
    () => buildFunnelChartOption(data, xAxisKey, valueKey, chromeFrom(props), { seriesColors, palette: props.palette }, showConversionRate),
    [data, xAxisKey, valueKey, props, seriesColors, showConversionRate],
  );
  return (
    <ChartHost
      ref={ref}
      built={built}
      extras={extras}
      height={height}
      chartType="funnel"
      ariaLabel="Funnel chart"
      xAxisKey={xAxisKey}
      fallbackSeriesKey={valueKey}
      onDataPointClick={onDataPointClick}
    />
  );
});

export const UiWaterfallChart = React.forwardRef<UiEchartsHandle, AdvancedChartCommonProps>(function UiWaterfallChart(props, ref) {
  const { data, xAxisKey = UI_CHART_DEFAULT_X_AXIS_KEY, valueKey = 'value', height, onDataPointClick, extras } = {
    ...splitChartProps(props),
    xAxisKey: props.xAxisKey ?? UI_CHART_DEFAULT_X_AXIS_KEY,
    valueKey: props.valueKey ?? 'value',
  };
  const built = React.useMemo(
    () => buildWaterfallChartOption(data, xAxisKey, valueKey, chromeFrom(props)),
    [data, xAxisKey, valueKey, props],
  );
  return (
    <ChartHost
      ref={ref}
      built={built}
      extras={extras}
      height={height}
      chartType="waterfall"
      ariaLabel="Waterfall chart"
      xAxisKey={xAxisKey}
      fallbackSeriesKey={valueKey}
      onDataPointClick={onDataPointClick}
    />
  );
});

export const UiTreemapChart = React.forwardRef<UiEchartsHandle, AdvancedChartCommonProps>(function UiTreemapChart(props, ref) {
  const { data, xAxisKey = UI_CHART_DEFAULT_X_AXIS_KEY, valueKey = 'value', colorKey, seriesColors, height, onDataPointClick, extras } = {
    ...splitChartProps(props),
    xAxisKey: props.xAxisKey ?? UI_CHART_DEFAULT_X_AXIS_KEY,
    valueKey: props.valueKey ?? 'value',
  };
  const built = React.useMemo(
    () => buildTreemapChartOption(data, xAxisKey, valueKey, colorKey, chromeFrom(props), { seriesColors, palette: props.palette }),
    [data, xAxisKey, valueKey, colorKey, props, seriesColors],
  );
  return (
    <ChartHost
      ref={ref}
      built={built}
      extras={extras}
      height={height}
      chartType="treemap"
      ariaLabel="Treemap"
      xAxisKey={xAxisKey}
      fallbackSeriesKey={valueKey}
      onDataPointClick={onDataPointClick}
    />
  );
});

export const UiSunburstChart = React.forwardRef<UiEchartsHandle, AdvancedChartCommonProps>(function UiSunburstChart(props, ref) {
  const { data, xAxisKey = UI_CHART_DEFAULT_X_AXIS_KEY, valueKey = 'value', colorKey, seriesColors, height, onDataPointClick, extras } = {
    ...splitChartProps(props),
    xAxisKey: props.xAxisKey ?? UI_CHART_DEFAULT_X_AXIS_KEY,
    valueKey: props.valueKey ?? 'value',
  };
  const built = React.useMemo(
    () => buildSunburstChartOption(data, xAxisKey, valueKey, colorKey, chromeFrom(props), { seriesColors, palette: props.palette }),
    [data, xAxisKey, valueKey, colorKey, props, seriesColors],
  );
  return (
    <ChartHost
      ref={ref}
      built={built}
      extras={extras}
      height={height}
      chartType="sunburst"
      ariaLabel="Sunburst chart"
      xAxisKey={xAxisKey}
      fallbackSeriesKey={valueKey}
      onDataPointClick={onDataPointClick}
    />
  );
});

export const UiSankeyChart = React.forwardRef<UiEchartsHandle, AdvancedChartCommonProps>(function UiSankeyChart(props, ref) {
  const { data, height, onDataPointClick, extras } = splitChartProps(props);
  const built = React.useMemo(
    () => buildSankeyChartOption(data, chromeFrom(props)),
    [data, props],
  );
  return (
    <ChartHost
      ref={ref}
      built={built}
      extras={extras}
      height={height}
      chartType="sankey"
      ariaLabel="Sankey chart"
      fallbackSeriesKey="value"
      onDataPointClick={onDataPointClick}
    />
  );
});

export const UiCandlestickChart = React.forwardRef<UiEchartsHandle, AdvancedChartCommonProps>(function UiCandlestickChart(props, ref) {
  const { data, xAxisKey = UI_CHART_DEFAULT_X_AXIS_KEY, height, showVolume = true, onDataPointClick, extras } = {
    ...splitChartProps(props),
    xAxisKey: props.xAxisKey ?? UI_CHART_DEFAULT_X_AXIS_KEY,
    showVolume: props.showVolume ?? true,
  };
  const built = React.useMemo(
    () => buildCandlestickChartOption(data, xAxisKey, chromeFrom(props), showVolume),
    [data, xAxisKey, props, showVolume],
  );
  return (
    <ChartHost
      ref={ref}
      built={built}
      extras={extras}
      height={height}
      chartType="candlestick"
      ariaLabel="Candlestick chart"
      xAxisKey={xAxisKey}
      fallbackSeriesKey="close"
      onDataPointClick={onDataPointClick}
    />
  );
});

export const UiBoxplotChart = React.forwardRef<UiEchartsHandle, AdvancedChartCommonProps>(function UiBoxplotChart(props, ref) {
  const { data, xAxisKey = 'group', valueKey = 'value', height, onDataPointClick, extras } = {
    ...splitChartProps(props),
    xAxisKey: props.xAxisKey ?? 'group',
    valueKey: props.valueKey ?? 'value',
  };
  const built = React.useMemo(
    () => buildBoxplotChartOption(data, xAxisKey, valueKey, chromeFrom(props)),
    [data, xAxisKey, valueKey, props],
  );
  return (
    <ChartHost
      ref={ref}
      built={built}
      extras={extras}
      height={height}
      chartType="boxplot"
      ariaLabel="Box plot"
      xAxisKey={xAxisKey}
      fallbackSeriesKey={valueKey}
      onDataPointClick={onDataPointClick}
    />
  );
});

export type UiAdvancedChartProps = AdvancedChartCommonProps & {
  chartType: AdvancedChartType;
};

export const UiAdvancedChart = React.forwardRef<UiEchartsHandle, UiAdvancedChartProps>(function UiAdvancedChart({ chartType, ...props }, ref) {
  switch (chartType) {
    case 'scatter':
      return <UiScatterChart ref={ref} {...props} />;
    case 'radar':
      return <UiRadarChart ref={ref} {...props} />;
    case 'heatmap':
      return <UiHeatmapChart ref={ref} {...props} />;
    case 'funnel':
      return <UiFunnelChart ref={ref} {...props} />;
    case 'waterfall':
      return <UiWaterfallChart ref={ref} {...props} />;
    case 'treemap':
      return <UiTreemapChart ref={ref} {...props} />;
    case 'sunburst':
      return <UiSunburstChart ref={ref} {...props} />;
    case 'sankey':
      return <UiSankeyChart ref={ref} {...props} />;
    case 'candlestick':
      return <UiCandlestickChart ref={ref} {...props} />;
    case 'boxplot':
      return <UiBoxplotChart ref={ref} {...props} />;
    default:
      return null;
  }
});
