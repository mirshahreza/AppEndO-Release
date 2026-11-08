import type { EChartsOption } from 'echarts';
import {
  UI_CHART_PALETTES,
  type UiChartChrome,
  type UiChartPaletteId,
} from '../uiChartModel';

export const ECHARTS_AXIS_MUTED = '#64748b';
export const ECHARTS_GRID_LINE = '#e2e8f0';
export const ECHARTS_AXIS_LINE = '#cbd5e1';
export const ECHARTS_TRACK = '#e2e8f0';

export const resolveChartPalette = (palette?: UiChartPaletteId): readonly string[] =>
  UI_CHART_PALETTES[palette ?? 'categorical'];

export const echartsTextStyle = {
  fontFamily: 'inherit',
  color: ECHARTS_AXIS_MUTED,
  fontSize: 11,
} as const;

export const cartesianAxis = (showGrid: boolean) => ({
  axisLabel: { color: ECHARTS_AXIS_MUTED, fontSize: 11 },
  axisLine: { lineStyle: { color: ECHARTS_AXIS_LINE } },
  axisTick: { show: false },
  splitLine: {
    show: showGrid,
    lineStyle: { color: ECHARTS_GRID_LINE, type: 'dashed' as const },
  },
});

export const buildChartChrome = (
  chrome: UiChartChrome,
  extras: {
    tooltipTrigger?: 'axis' | 'item';
    includeGrid?: boolean;
    includeDataZoom?: boolean;
  } = {},
): EChartsOption => {
  const colors = resolveChartPalette(chrome.palette);
  const option: EChartsOption = {
    color: [...colors],
    animation: process.env.NODE_ENV !== 'test',
    aria: { enabled: true, decal: { show: true } },
    textStyle: echartsTextStyle,
    tooltip: {
      trigger: extras.tooltipTrigger ?? 'axis',
      confine: true,
    },
    legend: {
      show: chrome.showLegend !== false,
      bottom: 0,
      textStyle: echartsTextStyle,
    },
  };
  if (extras.includeGrid !== false) {
    option.grid = {
      top: chrome.showToolbox ? 36 : 24,
      right: 20,
      left: 44,
      bottom: chrome.showLegend === false ? 28 : 48,
    };
  }
  if (chrome.showToolbox) {
    option.toolbox = {
      right: 8,
      top: 0,
      feature: {
        saveAsImage: { title: 'Save image' },
        restore: { title: 'Reset' },
      },
    };
  }
  if (chrome.dataZoom && extras.includeDataZoom !== false) {
    option.dataZoom = chrome.dataZoom === true
      ? [
        { type: 'inside', filterMode: 'none' },
        { type: 'slider', height: 16, bottom: chrome.showLegend === false ? 4 : 22 },
      ]
      : chrome.dataZoom;
  }
  return option;
};
