import type { EChartsOption } from 'echarts';
import {
  resolveUiChartGaugePresentation,
  resolveUiChartNumericValue,
  resolveUiChartPaletteColor,
  resolveUiChartSeriesLabel,
  type UiChartChrome,
  type UiChartDataRow,
  type UiChartPaletteId,
} from '../uiChartModel';
import {
  buildBoxStats,
  buildHierarchy,
  buildSankeyGraph,
  buildWaterfallBars,
  linearTrendline,
} from './chartTransforms';
import { buildChartChrome, cartesianAxis, ECHARTS_TRACK } from './echartsTheme';

type SeriesStyle = {
  seriesColors?: Record<string, string>;
  seriesLabels?: Record<string, string>;
  palette?: UiChartPaletteId;
};

const labeled = (
  row: UiChartDataRow,
  xAxisKey: string,
  index: number,
): string => String(row[xAxisKey] ?? row.label ?? `Item ${index + 1}`);

const datum = (
  row: UiChartDataRow,
  seriesKey: string,
  xAxisKey: string,
  index: number,
  extra?: Record<string, unknown>,
) => ({
  value: resolveUiChartNumericValue(row, seriesKey),
  name: labeled(row, xAxisKey, index),
  seriesKey,
  row,
  ...extra,
});

export const buildBarChartOption = (
  data: UiChartDataRow[],
  seriesKeys: string[],
  xAxisKey: string,
  chrome: UiChartChrome,
  style: SeriesStyle,
  orientation: 'vertical' | 'horizontal',
  grouped: boolean,
): EChartsOption => {
  const isHorizontal = orientation === 'horizontal';
  const categories = data.map((row, index) => labeled(row, xAxisKey, index));
  const categoryAxis = {
    type: 'category' as const,
    data: categories,
    ...cartesianAxis(false),
  };
  const valueAxis = {
    type: 'value' as const,
    ...cartesianAxis(chrome.showGrid !== false),
  };
  return {
    ...buildChartChrome(chrome, { includeDataZoom: true }),
    xAxis: isHorizontal ? valueAxis : categoryAxis,
    yAxis: isHorizontal ? categoryAxis : valueAxis,
    series: seriesKeys.map((key, index) => ({
      type: 'bar' as const,
      name: resolveUiChartSeriesLabel(key, style.seriesLabels),
      stack: grouped ? undefined : 'total',
      itemStyle: { color: resolveUiChartPaletteColor(key, index, style.seriesColors, chrome.palette) },
      label: { show: chrome.showLabels === true, position: isHorizontal ? 'right' : 'top', fontSize: 10 },
      data: data.map((row, rowIndex) => datum(
        row,
        key,
        xAxisKey,
        rowIndex,
        typeof row.color === 'string' ? { itemStyle: { color: row.color } } : undefined,
      )),
    })),
  };
};

export const buildLineChartOption = (
  data: UiChartDataRow[],
  seriesKeys: string[],
  xAxisKey: string,
  chrome: UiChartChrome,
  style: SeriesStyle,
  variant: 'line' | 'area',
  smooth = true,
  stacked = false,
): EChartsOption => {
  const categories = data.map((row, index) => labeled(row, xAxisKey, index));
  return {
    ...buildChartChrome(chrome, { includeDataZoom: true }),
    xAxis: { type: 'category', data: categories, ...cartesianAxis(false) },
    yAxis: { type: 'value', ...cartesianAxis(chrome.showGrid !== false) },
    series: seriesKeys.map((key, index) => {
      const color = resolveUiChartPaletteColor(key, index, style.seriesColors, chrome.palette);
      return {
        type: 'line' as const,
        name: resolveUiChartSeriesLabel(key, style.seriesLabels),
        smooth,
        stack: stacked ? 'total' : undefined,
        showSymbol: true,
        symbolSize: 8,
        lineStyle: { width: 2, color },
        itemStyle: { color },
        areaStyle: variant === 'area' ? { color, opacity: 0.25 } : undefined,
        data: data.map((row, rowIndex) => datum(row, key, xAxisKey, rowIndex)),
      };
    }),
  };
};

export const buildPieChartOption = (
  data: UiChartDataRow[],
  numericKey: string,
  xAxisKey: string,
  chrome: UiChartChrome,
  style: SeriesStyle,
  variant: 'pie' | 'donut',
): EChartsOption => ({
  ...buildChartChrome(chrome, { tooltipTrigger: 'item', includeGrid: false, includeDataZoom: false }),
  series: [{
    type: 'pie',
    radius: variant === 'donut' ? ['48%', '72%'] : '72%',
    center: ['50%', '46%'],
    label: { show: chrome.showLabels !== false, fontSize: 11 },
    data: data.map((row, index) => ({
      ...datum(row, numericKey, xAxisKey, index),
      itemStyle: {
        color: typeof row.color === 'string'
          ? row.color
          : resolveUiChartPaletteColor(numericKey, index, style.seriesColors, chrome.palette),
      },
    })),
  }],
});

export const buildSparklineOption = (
  data: UiChartDataRow[],
  seriesKey: string,
  xAxisKey: string,
  color: string,
  variant: 'line' | 'bar',
): EChartsOption => ({
  animation: process.env.NODE_ENV !== 'test',
  aria: { enabled: true },
  grid: { left: 0, right: 0, top: 4, bottom: 4 },
  tooltip: { trigger: 'axis', confine: true },
  xAxis: { type: 'category', show: false, data: data.map((row, index) => labeled(row, xAxisKey, index)) },
  yAxis: { type: 'value', show: false },
  series: [{
    type: variant === 'bar' ? 'bar' : 'line',
    showSymbol: false,
    smooth: true,
    lineStyle: { width: 2, color },
    itemStyle: { color },
    areaStyle: variant === 'line' ? { color, opacity: 0.18 } : undefined,
    data: data.map((row, index) => datum(row, seriesKey, xAxisKey, index)),
  }],
});

export const buildGaugeOption = (
  value: number,
  min: number,
  max: number,
  color: string,
): EChartsOption => {
  const { percent, displayValue } = resolveUiChartGaugePresentation(value, { min, max });
  return {
    animation: process.env.NODE_ENV !== 'test',
    series: [{
      type: 'gauge',
      min,
      max,
      startAngle: 210,
      endAngle: -30,
      radius: '92%',
      pointer: { show: true, length: '62%', width: 5, itemStyle: { color } },
      axisLine: {
        lineStyle: {
          width: 14,
          color: [
            [percent / 100, color],
            [1, ECHARTS_TRACK],
          ],
        },
      },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      anchor: { show: true, size: 10, itemStyle: { color } },
      title: { show: false },
      detail: { show: false },
      data: [{ value: displayValue }],
    }],
  };
};

export const buildScatterChartOption = (
  data: UiChartDataRow[],
  xAxisKey: string,
  yKey: string,
  sizeKey: string | undefined,
  chrome: UiChartChrome,
  style: SeriesStyle,
  showTrendline: boolean,
): EChartsOption => {
  const color = resolveUiChartPaletteColor(yKey, 0, style.seriesColors, chrome.palette);
  const points = data.map((row) => ({
    x: resolveUiChartNumericValue(row, xAxisKey),
    y: resolveUiChartNumericValue(row, yKey),
    z: sizeKey ? resolveUiChartNumericValue(row, sizeKey) : 80,
    row,
  }));
  const trend = showTrendline ? linearTrendline(points) : null;
  const series: EChartsOption['series'] = [{
    type: 'scatter',
    name: resolveUiChartSeriesLabel(yKey, style.seriesLabels),
    itemStyle: { color },
    symbolSize: (value: unknown) => {
      const size = Array.isArray(value) ? Number(value[2] ?? 80) : 80;
      return Math.max(8, Math.min(36, size / 6));
    },
    data: points.map((point) => ({
      value: [point.x, point.y, point.z],
      name: String(point.row.label ?? ''),
      seriesKey: yKey,
      row: point.row,
    })),
  }];
  if (trend) {
    series.push({
      type: 'line',
      name: 'Trendline',
      showSymbol: false,
      lineStyle: { color: '#94a3b8', width: 2 },
      data: trend.map((point) => [point.x, point.y]),
      tooltip: { show: false },
    });
  }
  return {
    ...buildChartChrome(chrome, { includeDataZoom: true }),
    xAxis: { type: 'value', name: xAxisKey, ...cartesianAxis(chrome.showGrid !== false) },
    yAxis: { type: 'value', name: yKey, ...cartesianAxis(false) },
    series,
  };
};

export const buildRadarChartOption = (
  data: UiChartDataRow[],
  seriesKeys: string[],
  xAxisKey: string,
  chrome: UiChartChrome,
  style: SeriesStyle,
  maxValue?: number,
): EChartsOption => {
  const keys = seriesKeys.length > 0 ? seriesKeys : ['value'];
  const dataMax = Math.max(
    1,
    ...data.flatMap((row) => keys.map((key) => resolveUiChartNumericValue(row, key))),
  );
  const max = typeof maxValue === 'number' && Number.isFinite(maxValue) ? maxValue : dataMax;
  return {
    ...buildChartChrome(chrome, { tooltipTrigger: 'item', includeGrid: false, includeDataZoom: false }),
    radar: {
      indicator: data.map((row, index) => ({
        name: labeled(row, xAxisKey, index),
        max,
      })),
      axisName: { color: '#64748b', fontSize: 11 },
      splitLine: { lineStyle: { color: '#e2e8f0' } },
      splitArea: { areaStyle: { color: ['#ffffff', '#f8fafc'] } },
    },
    series: [{
      type: 'radar',
      data: keys.map((key, index) => {
        const color = resolveUiChartPaletteColor(key, index, style.seriesColors, chrome.palette);
        return {
          name: resolveUiChartSeriesLabel(key, style.seriesLabels),
          value: data.map((row) => resolveUiChartNumericValue(row, key)),
          itemStyle: { color },
          areaStyle: { color, opacity: 0.22 },
          seriesKey: key,
          row: data[0] ?? {},
        };
      }),
    }],
  };
};

export const buildHeatmapChartOption = (
  data: UiChartDataRow[],
  xAxisKey: string,
  yAxisKey: string,
  valueKey: string,
  chrome: UiChartChrome,
): EChartsOption => {
  const xValues = Array.from(new Set(data.map((row) => String(row[xAxisKey] ?? ''))));
  const yValues = Array.from(new Set(data.map((row) => String(row[yAxisKey] ?? ''))));
  const values = data.map((row) => resolveUiChartNumericValue(row, valueKey));
  const min = values.length > 0 ? Math.min(...values) : 0;
  const max = values.length > 0 ? Math.max(...values) : 1;
  return {
    ...buildChartChrome(chrome, { tooltipTrigger: 'item', includeDataZoom: true }),
    legend: { show: false },
    visualMap: {
      min,
      max,
      calculable: true,
      orient: 'vertical',
      right: 0,
      top: 'middle',
      inRange: { color: ['#e0f2fe', '#0284c7', '#0c4a6e'] },
      textStyle: { fontSize: 10, color: '#64748b' },
    },
    xAxis: { type: 'category', data: xValues, ...cartesianAxis(false) },
    yAxis: { type: 'category', data: yValues, ...cartesianAxis(false) },
    series: [{
      type: 'heatmap',
      data: data.map((row) => ({
        value: [
          xValues.indexOf(String(row[xAxisKey] ?? '')),
          yValues.indexOf(String(row[yAxisKey] ?? '')),
          resolveUiChartNumericValue(row, valueKey),
        ],
        name: `${row[xAxisKey]} / ${row[yAxisKey]}`,
        seriesKey: valueKey,
        row,
      })),
      label: { show: chrome.showLabels !== false, fontSize: 10 },
    }],
  };
};

export const buildFunnelChartOption = (
  data: UiChartDataRow[],
  xAxisKey: string,
  valueKey: string,
  chrome: UiChartChrome,
  style: SeriesStyle,
  showConversionRate: boolean,
): EChartsOption => ({
  ...buildChartChrome(chrome, { tooltipTrigger: 'item', includeGrid: false, includeDataZoom: false }),
  tooltip: {
    trigger: 'item',
    formatter: (params: unknown) => {
      const item = params as { name?: string; value?: number; data?: { conversionRate?: number } };
      const rate = item.data?.conversionRate;
      if (showConversionRate && typeof rate === 'number') {
        return `${item.name}: ${item.value} (${rate}%)`;
      }
      return `${item.name}: ${item.value}`;
    },
  },
  series: [{
    type: 'funnel',
    left: '12%',
    width: '70%',
    minSize: '20%',
    label: { show: true, position: 'inside' },
    data: data.map((row, index) => {
      const value = resolveUiChartNumericValue(row, valueKey);
      const prev = index > 0 ? resolveUiChartNumericValue(data[index - 1]!, valueKey) : value;
      return {
        ...datum(row, valueKey, xAxisKey, index),
        conversionRate: prev > 0 ? Math.round((value / prev) * 100) : 100,
        itemStyle: {
          color: resolveUiChartPaletteColor(valueKey, index, style.seriesColors, chrome.palette),
        },
      };
    }),
  }],
});

export const buildWaterfallChartOption = (
  data: UiChartDataRow[],
  xAxisKey: string,
  valueKey: string,
  chrome: UiChartChrome,
): EChartsOption => {
  const bars = buildWaterfallBars(data, xAxisKey, valueKey);
  return {
    ...buildChartChrome(chrome, { includeDataZoom: true }),
    legend: { show: false },
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const list = Array.isArray(params) ? params : [params];
        const rise = list.find((item) => (item as { seriesName?: string }).seriesName === 'Change') as
          | { name?: string; data?: { delta?: number } }
          | undefined;
        return `${rise?.name ?? ''}: ${rise?.data?.delta ?? 0}`;
      },
    },
    xAxis: { type: 'category', data: bars.map((bar) => bar.name), ...cartesianAxis(false) },
    yAxis: { type: 'value', ...cartesianAxis(chrome.showGrid !== false) },
    series: [
      {
        type: 'bar',
        name: 'Base',
        stack: 'wf',
        silent: true,
        itemStyle: { color: 'transparent', borderColor: 'transparent' },
        data: bars.map((bar) => bar.base),
      },
      {
        type: 'bar',
        name: 'Change',
        stack: 'wf',
        data: bars.map((bar) => ({
          value: bar.rise,
          name: bar.name,
          seriesKey: valueKey,
          delta: bar.delta,
          row: bar.row,
          itemStyle: { color: bar.fill },
        })),
      },
    ],
  };
};

export const buildTreemapChartOption = (
  data: UiChartDataRow[],
  xAxisKey: string,
  valueKey: string,
  colorKey: string | undefined,
  chrome: UiChartChrome,
  style: SeriesStyle,
): EChartsOption => ({
  ...buildChartChrome(chrome, { tooltipTrigger: 'item', includeGrid: false, includeDataZoom: false }),
  legend: { show: false },
  series: [{
    type: 'treemap',
    roam: false,
    nodeClick: false,
    breadcrumb: { show: false },
    label: { show: true, fontSize: 11 },
    data: buildHierarchy(data, xAxisKey, valueKey, colorKey, style.seriesColors, chrome.palette),
  }],
});

export const buildSunburstChartOption = (
  data: UiChartDataRow[],
  xAxisKey: string,
  valueKey: string,
  colorKey: string | undefined,
  chrome: UiChartChrome,
  style: SeriesStyle,
): EChartsOption => ({
  ...buildChartChrome(chrome, { tooltipTrigger: 'item', includeGrid: false, includeDataZoom: false }),
  legend: { show: false },
  series: [{
    type: 'sunburst',
    radius: ['12%', '88%'],
    label: { fontSize: 11 },
    data: buildHierarchy(data, xAxisKey, valueKey, colorKey, style.seriesColors, chrome.palette),
  }],
});

export const buildSankeyChartOption = (
  data: UiChartDataRow[],
  chrome: UiChartChrome,
): EChartsOption => {
  const graph = buildSankeyGraph(data);
  return {
    ...buildChartChrome(chrome, { tooltipTrigger: 'item', includeGrid: false, includeDataZoom: false }),
    legend: { show: false },
    series: [{
      type: 'sankey',
      emphasis: { focus: 'adjacency' },
      lineStyle: { color: 'gradient', opacity: 0.35 },
      data: graph.nodes,
      links: graph.links.map((link) => ({
        source: link.source,
        target: link.target,
        value: link.value,
        seriesKey: 'value',
        row: link.row,
      })),
    }],
  };
};

export const buildCandlestickChartOption = (
  data: UiChartDataRow[],
  xAxisKey: string,
  chrome: UiChartChrome,
  showVolume: boolean,
): EChartsOption => {
  const categories = data.map((row, index) => labeled(row, xAxisKey, index));
  const candles = data.map((row, index) => ({
    value: [
      resolveUiChartNumericValue(row, 'open'),
      resolveUiChartNumericValue(row, 'close'),
      resolveUiChartNumericValue(row, 'low'),
      resolveUiChartNumericValue(row, 'high'),
    ],
    name: labeled(row, xAxisKey, index),
    seriesKey: 'close',
    row,
  }));
  const option: EChartsOption = {
    ...buildChartChrome(chrome, { includeDataZoom: true }),
    legend: { show: false },
    xAxis: { type: 'category', data: categories, ...cartesianAxis(false) },
    yAxis: showVolume
      ? [
        { type: 'value', scale: true, ...cartesianAxis(chrome.showGrid !== false) },
        { type: 'value', scale: true, show: false, splitLine: { show: false } },
      ]
      : { type: 'value', scale: true, ...cartesianAxis(chrome.showGrid !== false) },
    series: [{
      type: 'candlestick',
      itemStyle: {
        color: '#10b981',
        color0: '#ef4444',
        borderColor: '#10b981',
        borderColor0: '#ef4444',
      },
      data: candles,
    }],
  };
  if (showVolume) {
    (option.series as object[]).push({
      type: 'bar',
      yAxisIndex: 1,
      itemStyle: { color: '#cbd5e1' },
      data: data.map((row, index) => datum(row, 'volume', xAxisKey, index)),
    });
  }
  return option;
};

export const buildBoxplotChartOption = (
  data: UiChartDataRow[],
  groupKey: string,
  valueKey: string,
  chrome: UiChartChrome,
): EChartsOption => {
  const stats = buildBoxStats(data, groupKey, valueKey);
  return {
    ...buildChartChrome(chrome, { tooltipTrigger: 'item', includeDataZoom: true }),
    legend: { show: false },
    xAxis: { type: 'category', data: stats.map((stat) => stat.name), ...cartesianAxis(false) },
    yAxis: { type: 'value', ...cartesianAxis(chrome.showGrid !== false) },
    series: [{
      type: 'boxplot',
      data: stats.map((stat) => ({
        value: [stat.min, stat.q1, stat.median, stat.q3, stat.max],
        name: stat.name,
        seriesKey: valueKey,
        row: stat.row,
      })),
    }],
  };
};
