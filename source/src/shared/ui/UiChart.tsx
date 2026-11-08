import * as React from 'react';
import { UiEchartsHost } from './echarts/UiEchartsHost';
import {
  buildBarChartOption,
  buildGaugeOption,
  buildLineChartOption,
  buildPieChartOption,
  buildSparklineOption,
} from './echarts/buildChartOption';
import { pickUiEchartsRuntimeProps, type UiEchartsHandle, type UiEchartsPassthrough } from './echarts/uiEchartsApi';
import { useComposedEchartsOption } from './echarts/useComposedEchartsOption';
import {
  resolveUiChartGaugePresentation,
  resolveUiChartNumericValue,
  UI_CHART_DEFAULT_X_AXIS_KEY,
  UI_CHART_SERIES_COLORS,
  type UiChartChrome,
  type UiChartDataPointClickDetail,
  type UiChartDataRow,
  type UiChartGaugeThreshold,
} from './uiChartModel';

export {
  resolveUiChartGaugePresentation,
  resolveUiChartNumericValue,
  resolveUiChartPaletteColor,
  resolveUiChartSeriesColor,
  resolveUiChartSeriesLabel,
  UI_CHART_DEFAULT_X_AXIS_KEY,
  UI_CHART_PALETTE_IDS,
  UI_CHART_PALETTES,
  UI_CHART_SERIES_COLORS,
  type UiChartChrome,
  type UiChartDataPointClickDetail,
  type UiChartDataRow,
  type UiChartGaugeThreshold,
  type UiChartPaletteId,
} from './uiChartModel';

export type {
  UiEchartsHandle,
  UiEchartsPassthrough,
  UiEchartsOptionProps,
  UiEchartsRuntimeProps,
  UiEchartsEventMap,
} from './echarts/uiEchartsApi';

/**
 * Generic chart primitives over Apache ECharts (Apache-2.0, tree-shaken).
 * Public wrappers stay stable for Component Designer and Base Components.
 * Every ECharts option key, event, and instance method is exposed via
 * `option` / named keys / `onEvents` / ref (`UiEchartsHandle`).
 */

type UiChartCommonProps = UiChartChrome & UiEchartsPassthrough & {
  data: UiChartDataRow[];
  seriesKeys: string[];
  xAxisKey?: string;
  seriesColors?: Record<string, string>;
  seriesLabels?: Record<string, string>;
  height?: number;
  onDataPointClick?: (detail: UiChartDataPointClickDetail) => void;
};

export type UiBarChartProps = UiChartCommonProps & {
  orientation?: 'vertical' | 'horizontal';
  grouped?: boolean;
};

export const UiBarChart = React.forwardRef<UiEchartsHandle, UiBarChartProps>(function UiBarChart({
  data,
  seriesKeys,
  xAxisKey = UI_CHART_DEFAULT_X_AXIS_KEY,
  seriesColors,
  seriesLabels,
  showLegend = true,
  showGrid = true,
  showLabels = false,
  dataZoom = false,
  showToolbox = false,
  palette = 'categorical',
  height = 280,
  orientation = 'vertical',
  grouped = true,
  onDataPointClick,
  option,
  seriesOption,
  ...passthrough
}, ref) {
  const built = React.useMemo(
    () => buildBarChartOption(
      data,
      seriesKeys,
      xAxisKey,
      { showLegend, showGrid, showLabels, dataZoom, showToolbox, palette },
      { seriesColors, seriesLabels, palette },
      orientation,
      grouped,
    ),
    [data, seriesKeys, xAxisKey, seriesColors, seriesLabels, showLegend, showGrid, showLabels, dataZoom, showToolbox, palette, orientation, grouped],
  );
  const composed = useComposedEchartsOption(built, { ...passthrough, option, seriesOption, dataZoom });
  return (
    <UiEchartsHost
      ref={ref}
      option={composed}
      height={height}
      chartType="bar"
      ariaLabel="Bar chart"
      xAxisKey={xAxisKey}
      fallbackSeriesKey={seriesKeys[0] ?? 'value'}
      onDataPointClick={onDataPointClick}
      {...pickUiEchartsRuntimeProps(passthrough)}
    />
  );
});

export type UiLineChartProps = UiChartCommonProps & {
  variant?: 'line' | 'area';
  smooth?: boolean;
  stacked?: boolean;
};

export const UiLineChart = React.forwardRef<UiEchartsHandle, UiLineChartProps>(function UiLineChart({
  data,
  seriesKeys,
  xAxisKey = UI_CHART_DEFAULT_X_AXIS_KEY,
  seriesColors,
  seriesLabels,
  showLegend = true,
  showGrid = true,
  showLabels = false,
  dataZoom = false,
  showToolbox = false,
  palette = 'categorical',
  height = 280,
  variant = 'line',
  smooth = true,
  stacked = false,
  onDataPointClick,
  option,
  seriesOption,
  ...passthrough
}, ref) {
  const built = React.useMemo(
    () => buildLineChartOption(
      data,
      seriesKeys,
      xAxisKey,
      { showLegend, showGrid, showLabels, dataZoom, showToolbox, palette },
      { seriesColors, seriesLabels, palette },
      variant,
      smooth,
      stacked,
    ),
    [data, seriesKeys, xAxisKey, seriesColors, seriesLabels, showLegend, showGrid, showLabels, dataZoom, showToolbox, palette, variant, smooth, stacked],
  );
  const composed = useComposedEchartsOption(built, { ...passthrough, option, seriesOption, dataZoom });
  return (
    <UiEchartsHost
      ref={ref}
      option={composed}
      height={height}
      chartType={variant}
      ariaLabel={variant === 'area' ? 'Area chart' : 'Line chart'}
      xAxisKey={xAxisKey}
      fallbackSeriesKey={seriesKeys[0] ?? 'value'}
      onDataPointClick={onDataPointClick}
      {...pickUiEchartsRuntimeProps(passthrough)}
    />
  );
});

export type UiChartGaugeProps = UiEchartsPassthrough & {
  value: number;
  label?: string;
  min?: number;
  max?: number;
  thresholds?: UiChartGaugeThreshold[];
  onClick?: () => void;
};

export const UiChartGauge = React.forwardRef<UiEchartsHandle, UiChartGaugeProps>(function UiChartGauge({
  value,
  label,
  min = 0,
  max = 100,
  thresholds,
  onClick,
  option,
  seriesOption,
  ...passthrough
}, ref) {
  const { percent, displayValue, color } = resolveUiChartGaugePresentation(value, { min, max, thresholds });
  const centerLabel = min === 0 && max === 100
    ? `${Math.round(percent)}%`
    : (Number.isInteger(displayValue) ? String(displayValue) : displayValue.toFixed(1));
  const built = React.useMemo(
    () => buildGaugeOption(value, min, max, color),
    [value, min, max, color],
  );
  const composed = useComposedEchartsOption(built, { ...passthrough, option, seriesOption });
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 py-4${onClick ? ' cursor-pointer' : ''}`}
      onClick={onClick}
      onKeyDown={onClick ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      } : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div
        className="relative h-32 w-32"
        data-gauge-percent={String(Math.round(percent))}
        data-gauge-value={String(displayValue)}
        data-gauge-color={color}
      >
        <UiEchartsHost
          ref={ref}
          option={composed}
          height={128}
          chartType="gauge"
          ariaLabel={label ?? 'Gauge'}
          {...pickUiEchartsRuntimeProps(passthrough)}
        />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xl font-bold text-slate-900">
          {centerLabel}
        </span>
      </div>
      {label ? <span className="text-xs text-slate-600">{label}</span> : null}
      {min !== 0 || max !== 100 ? (
        <span className="text-[10px] text-slate-400">{min} – {max}</span>
      ) : null}
    </div>
  );
});

export type UiPieChartProps = UiChartChrome & UiEchartsPassthrough & {
  data: UiChartDataRow[];
  seriesKeys: string[];
  xAxisKey?: string;
  seriesColors?: Record<string, string>;
  height?: number;
  variant?: 'pie' | 'donut' | 'gauge';
  valueKey?: string;
  gaugeMin?: number;
  gaugeMax?: number;
  gaugeThresholds?: UiChartGaugeThreshold[];
  onDataPointClick?: (detail: UiChartDataPointClickDetail) => void;
};

export const UiPieChart = React.forwardRef<UiEchartsHandle, UiPieChartProps>(function UiPieChart({
  data,
  seriesKeys,
  xAxisKey = UI_CHART_DEFAULT_X_AXIS_KEY,
  seriesColors,
  showLegend = true,
  showLabels = true,
  showToolbox = false,
  palette = 'categorical',
  height = 280,
  variant = 'pie',
  valueKey,
  gaugeMin,
  gaugeMax,
  gaugeThresholds,
  onDataPointClick,
  option,
  seriesOption,
  dataZoom,
  ...passthrough
}, ref) {
  const numericKey = valueKey && valueKey.length > 0 ? valueKey : seriesKeys[0] ?? 'value';
  const built = React.useMemo(
    () => variant === 'gauge'
      ? {}
      : buildPieChartOption(
        data,
        numericKey,
        xAxisKey,
        { showLegend, showLabels, showToolbox, palette },
        { seriesColors, palette },
        variant,
      ),
    [data, numericKey, xAxisKey, showLegend, showLabels, showToolbox, palette, seriesColors, variant],
  );
  const composed = useComposedEchartsOption(built, { ...passthrough, option, seriesOption, dataZoom });

  if (variant === 'gauge') {
    const gaugeValue = data.length > 0 ? resolveUiChartNumericValue(data[0], numericKey) : 0;
    const row = data[0] ?? {};
    return (
      <UiChartGauge
        ref={ref}
        value={gaugeValue}
        label={data[0] ? String(data[0][xAxisKey] ?? '') : undefined}
        min={gaugeMin}
        max={gaugeMax}
        thresholds={gaugeThresholds}
        option={option}
        seriesOption={seriesOption}
        {...passthrough}
        onClick={onDataPointClick ? () => {
          onDataPointClick({
            category: String(row[xAxisKey] ?? ''),
            seriesKey: numericKey,
            value: gaugeValue,
            row,
          });
        } : undefined}
      />
    );
  }

  return (
    <UiEchartsHost
      ref={ref}
      option={composed}
      height={height}
      chartType={variant}
      ariaLabel={variant === 'donut' ? 'Donut chart' : 'Pie chart'}
      xAxisKey={xAxisKey}
      fallbackSeriesKey={numericKey}
      onDataPointClick={onDataPointClick}
      {...pickUiEchartsRuntimeProps(passthrough)}
    />
  );
});

export type UiSparklineProps = UiEchartsPassthrough & {
  data: UiChartDataRow[];
  seriesKey: string;
  color?: string;
  height?: number;
  variant?: 'line' | 'bar';
  xAxisKey?: string;
  onDataPointClick?: (detail: UiChartDataPointClickDetail) => void;
};

export const UiSparkline = React.forwardRef<UiEchartsHandle, UiSparklineProps>(function UiSparkline({
  data,
  seriesKey,
  color = UI_CHART_SERIES_COLORS[0],
  height = 48,
  variant = 'line',
  xAxisKey = UI_CHART_DEFAULT_X_AXIS_KEY,
  onDataPointClick,
  option,
  seriesOption,
  ...passthrough
}, ref) {
  const built = React.useMemo(
    () => buildSparklineOption(data, seriesKey, xAxisKey, color, variant),
    [data, seriesKey, xAxisKey, color, variant],
  );
  const composed = useComposedEchartsOption(built, { ...passthrough, option, seriesOption });
  return (
    <UiEchartsHost
      ref={ref}
      option={composed}
      height={height}
      chartType="sparkline"
      ariaLabel="Sparkline"
      xAxisKey={xAxisKey}
      fallbackSeriesKey={seriesKey}
      onDataPointClick={onDataPointClick}
      {...pickUiEchartsRuntimeProps(passthrough)}
    />
  );
});
