import type { EChartsOption } from 'echarts';

export type UiChartDataRow = Record<string, string | number> & {
  label?: string;
  color?: string;
};

export const UI_CHART_SERIES_COLORS = [
  '#0ea5e9',
  '#8b5cf6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#6366f1',
] as const;

export const UI_CHART_PALETTE_IDS = ['categorical', 'sequential', 'diverging', 'semantic'] as const;
export type UiChartPaletteId = (typeof UI_CHART_PALETTE_IDS)[number];

export const UI_CHART_PALETTES: Record<UiChartPaletteId, readonly string[]> = {
  categorical: UI_CHART_SERIES_COLORS,
  sequential: ['#e0f2fe', '#7dd3fc', '#38bdf8', '#0ea5e9', '#0369a1', '#0c4a6e'],
  diverging: ['#ef4444', '#fb923c', '#fde68a', '#38bdf8', '#2563eb', '#1e3a8a'],
  semantic: ['#10b981', '#f59e0b', '#ef4444', '#6366f1', '#0ea5e9', '#8b5cf6'],
};

export const UI_CHART_DEFAULT_X_AXIS_KEY = 'label';

export const resolveUiChartSeriesColor = (
  key: string,
  index: number,
  seriesColors?: Record<string, string>,
): string => seriesColors?.[key] ?? UI_CHART_SERIES_COLORS[index % UI_CHART_SERIES_COLORS.length];

export const resolveUiChartPaletteColor = (
  key: string,
  index: number,
  seriesColors?: Record<string, string>,
  palette: UiChartPaletteId = 'categorical',
): string => seriesColors?.[key]
  ?? UI_CHART_PALETTES[palette][index % UI_CHART_PALETTES[palette].length];

export const resolveUiChartSeriesLabel = (
  key: string,
  seriesLabels?: Record<string, string>,
): string => seriesLabels?.[key] ?? key;

export const resolveUiChartNumericValue = (row: UiChartDataRow, key: string): number => {
  const value = row[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export type UiChartDataPointClickDetail = {
  category: string;
  seriesKey: string;
  value: number;
  row: UiChartDataRow;
};

export type UiChartGaugeThreshold = {
  value: number;
  color: string;
};

/** Map a raw gauge value into [0, 100] percent of [min, max], then color by thresholds. */
export const resolveUiChartGaugePresentation = (
  value: number,
  options: {
    min?: number;
    max?: number;
    thresholds?: UiChartGaugeThreshold[];
    fallbackColor?: string;
  } = {},
): { percent: number; displayValue: number; color: string; clampedValue: number } => {
  const min = typeof options.min === 'number' && Number.isFinite(options.min) ? options.min : 0;
  const maxRaw = typeof options.max === 'number' && Number.isFinite(options.max) ? options.max : 100;
  const max = maxRaw === min ? min + 100 : maxRaw;
  const clampedValue = Math.min(max, Math.max(min, value));
  const percent = ((clampedValue - min) / (max - min)) * 100;
  const sorted = [...(options.thresholds ?? [])]
    .filter((entry) => Number.isFinite(entry.value) && entry.color.trim().length > 0)
    .sort((a, b) => a.value - b.value);
  let color = options.fallbackColor ?? '#0ea5e9';
  for (const threshold of sorted) {
    if (clampedValue >= threshold.value) {
      color = threshold.color;
    }
  }
  return {
    percent: Math.min(100, Math.max(0, percent)),
    displayValue: clampedValue,
    color,
    clampedValue,
  };
};

export type UiChartChrome = {
  showLegend?: boolean;
  showGrid?: boolean;
  showLabels?: boolean;
  /** `true` enables inside+slider zoom; pass an ECharts dataZoom option for full control. */
  dataZoom?: boolean | EChartsOption['dataZoom'];
  showToolbox?: boolean;
  palette?: UiChartPaletteId;
};
