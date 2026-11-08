import type { EChartsOption, SeriesOption } from 'echarts';
import type { UiEchartsPassthrough } from './uiEchartsApi';

export const UI_CHART_LEGEND_POSITIONS = ['bottom', 'top', 'left', 'right'] as const;
export type UiChartLegendPosition = (typeof UI_CHART_LEGEND_POSITIONS)[number];

export const UI_CHART_TOOLTIP_TRIGGERS = ['axis', 'item', 'none'] as const;
export type UiChartTooltipTrigger = (typeof UI_CHART_TOOLTIP_TRIGGERS)[number];

export const UI_CHART_AXIS_POINTERS = ['line', 'shadow', 'cross', 'none'] as const;
export type UiChartAxisPointer = (typeof UI_CHART_AXIS_POINTERS)[number];

export const UI_CHART_RENDERERS = ['canvas', 'svg'] as const;
export type UiChartRenderer = (typeof UI_CHART_RENDERERS)[number];

export const UI_CHART_TITLE_ALIGNS = ['auto', 'left', 'center', 'right'] as const;
export type UiChartTitleAlign = (typeof UI_CHART_TITLE_ALIGNS)[number];

export const UI_CHART_TITLE_VERTICAL_ALIGNS = ['auto', 'top', 'middle', 'bottom'] as const;
export type UiChartTitleVerticalAlign = (typeof UI_CHART_TITLE_VERTICAL_ALIGNS)[number];

export const UI_CHART_LEGEND_TYPES = ['plain', 'scroll'] as const;
export type UiChartLegendType = (typeof UI_CHART_LEGEND_TYPES)[number];

export const UI_CHART_SELECTED_MODES = ['multiple', 'single', 'off'] as const;
export type UiChartSelectedMode = (typeof UI_CHART_SELECTED_MODES)[number];

export const UI_CHART_TOOLTIP_TRIGGER_ON = ['mousemove', 'click', 'mousemove|click', 'none'] as const;
export type UiChartTooltipTriggerOn = (typeof UI_CHART_TOOLTIP_TRIGGER_ON)[number];

export const UI_CHART_TOOLTIP_ORDERS = ['seriesAsc', 'seriesDesc', 'valueAsc', 'valueDesc'] as const;
export type UiChartTooltipOrder = (typeof UI_CHART_TOOLTIP_ORDERS)[number];

export const UI_CHART_DATA_ZOOM_TYPES = ['inside', 'slider', 'both'] as const;
export type UiChartDataZoomType = (typeof UI_CHART_DATA_ZOOM_TYPES)[number];

export const UI_CHART_VISUAL_MAP_TYPES = ['continuous', 'piecewise'] as const;
export type UiChartVisualMapType = (typeof UI_CHART_VISUAL_MAP_TYPES)[number];

export const UI_CHART_ORIENTS = ['horizontal', 'vertical'] as const;
export type UiChartOrient = (typeof UI_CHART_ORIENTS)[number];

export const UI_CHART_ANIMATION_EASINGS = ['cubicOut', 'linear', 'quadraticOut', 'elasticOut', 'bounceOut'] as const;
export type UiChartAnimationEasing = (typeof UI_CHART_ANIMATION_EASINGS)[number];

export const UI_CHART_BLEND_MODES = ['source-over', 'lighter'] as const;
export type UiChartBlendMode = (typeof UI_CHART_BLEND_MODES)[number];

export const UI_CHART_LINE_STEPS = ['none', 'start', 'middle', 'end'] as const;
export type UiChartLineStep = (typeof UI_CHART_LINE_STEPS)[number];

export const UI_CHART_ROSE_TYPES = ['off', 'radius', 'area'] as const;
export type UiChartRoseType = (typeof UI_CHART_ROSE_TYPES)[number];

export const UI_CHART_EMPHASIS_FOCUS = ['none', 'self', 'series'] as const;
export type UiChartEmphasisFocus = (typeof UI_CHART_EMPHASIS_FOCUS)[number];

export const UI_CHART_LABEL_ROTATES = [0, 30, 45, 90] as const;
export type UiChartLabelRotate = (typeof UI_CHART_LABEL_ROTATES)[number];

export const UI_CHART_BAR_GAPS = ['30%', '0%', '-100%'] as const;
export type UiChartBarGap = (typeof UI_CHART_BAR_GAPS)[number];

export const UI_CHART_BOUNDARY_GAPS = ['default', 'on', 'off'] as const;
export type UiChartBoundaryGap = (typeof UI_CHART_BOUNDARY_GAPS)[number];

export const UI_CHART_BACKGROUNDS = ['transparent', 'white', 'slate'] as const;
export type UiChartBackground = (typeof UI_CHART_BACKGROUNDS)[number];

export const UI_CHART_ANIMATION_DURATIONS = [300, 1000, 2000] as const;
export type UiChartAnimationDuration = (typeof UI_CHART_ANIMATION_DURATIONS)[number];

/** Operator-facing ECharts switches (inspector + Base Components). Maps to https://echarts.apache.org/en/option.html */
export type UiChartEchartsChrome = {
  showLabels?: boolean;
  dataZoom?: boolean;
  dataZoomType?: UiChartDataZoomType;
  dataZoomStart?: number;
  dataZoomEnd?: number;
  showToolbox?: boolean;
  toolboxMagicType?: boolean;
  toolboxDataView?: boolean;
  toolboxOrient?: UiChartOrient;
  showTooltip?: boolean;
  tooltipTrigger?: UiChartTooltipTrigger;
  tooltipTriggerOn?: UiChartTooltipTriggerOn;
  tooltipConfine?: boolean;
  tooltipOrder?: UiChartTooltipOrder;
  legendPosition?: UiChartLegendPosition;
  legendType?: UiChartLegendType;
  legendSelectedMode?: UiChartSelectedMode;
  animation?: boolean;
  animationDuration?: UiChartAnimationDuration;
  animationEasing?: UiChartAnimationEasing;
  darkMode?: boolean;
  renderer?: UiChartRenderer;
  showMarkPoint?: boolean;
  showMarkLine?: boolean;
  showMarkArea?: boolean;
  axisPointer?: UiChartAxisPointer;
  showTitle?: boolean;
  titleText?: string;
  titleSubtext?: string;
  titleLeft?: UiChartTitleAlign;
  titleTop?: UiChartTitleVerticalAlign;
  xAxisName?: string;
  yAxisName?: string;
  axisInverse?: boolean;
  axisSplitArea?: boolean;
  axisLabelRotate?: UiChartLabelRotate;
  boundaryGap?: UiChartBoundaryGap;
  gridContainLabel?: boolean;
  visualMap?: boolean;
  visualMapType?: UiChartVisualMapType;
  visualMapOrient?: UiChartOrient;
  brush?: boolean;
  lineStep?: UiChartLineStep;
  showSymbol?: boolean;
  connectNulls?: boolean;
  roseType?: UiChartRoseType;
  selectedMode?: UiChartSelectedMode;
  emphasisFocus?: UiChartEmphasisFocus;
  barGap?: UiChartBarGap;
  large?: boolean;
  useUTC?: boolean;
  blendMode?: UiChartBlendMode;
  background?: UiChartBackground;
  ariaEnabled?: boolean;
  ariaDecal?: boolean;
};

export const DEFAULT_UI_CHART_ECHARTS_CHROME: Required<UiChartEchartsChrome> = {
  showLabels: false,
  dataZoom: false,
  dataZoomType: 'both',
  dataZoomStart: 0,
  dataZoomEnd: 100,
  showToolbox: false,
  toolboxMagicType: false,
  toolboxDataView: false,
  toolboxOrient: 'horizontal',
  showTooltip: true,
  tooltipTrigger: 'axis',
  tooltipTriggerOn: 'mousemove',
  tooltipConfine: true,
  tooltipOrder: 'seriesAsc',
  legendPosition: 'bottom',
  legendType: 'plain',
  legendSelectedMode: 'multiple',
  animation: true,
  animationDuration: 1000,
  animationEasing: 'cubicOut',
  darkMode: false,
  renderer: 'canvas',
  showMarkPoint: false,
  showMarkLine: false,
  showMarkArea: false,
  axisPointer: 'line',
  showTitle: false,
  titleText: '',
  titleSubtext: '',
  titleLeft: 'auto',
  titleTop: 'auto',
  xAxisName: '',
  yAxisName: '',
  axisInverse: false,
  axisSplitArea: false,
  axisLabelRotate: 0,
  boundaryGap: 'default',
  gridContainLabel: false,
  visualMap: false,
  visualMapType: 'continuous',
  visualMapOrient: 'vertical',
  brush: false,
  lineStep: 'none',
  showSymbol: true,
  connectNulls: false,
  roseType: 'off',
  selectedMode: 'off',
  emphasisFocus: 'none',
  barGap: '30%',
  large: false,
  useUTC: false,
  blendMode: 'source-over',
  background: 'transparent',
  ariaEnabled: true,
  ariaDecal: true,
};

export const UI_CHART_ECHARTS_CHROME_KEYS = [
  'showLabels',
  'dataZoom',
  'dataZoomType',
  'dataZoomStart',
  'dataZoomEnd',
  'showToolbox',
  'toolboxMagicType',
  'toolboxDataView',
  'toolboxOrient',
  'showTooltip',
  'tooltipTrigger',
  'tooltipTriggerOn',
  'tooltipConfine',
  'tooltipOrder',
  'legendPosition',
  'legendType',
  'legendSelectedMode',
  'animation',
  'animationDuration',
  'animationEasing',
  'darkMode',
  'renderer',
  'showMarkPoint',
  'showMarkLine',
  'showMarkArea',
  'axisPointer',
  'showTitle',
  'titleText',
  'titleSubtext',
  'titleLeft',
  'titleTop',
  'xAxisName',
  'yAxisName',
  'axisInverse',
  'axisSplitArea',
  'axisLabelRotate',
  'boundaryGap',
  'gridContainLabel',
  'visualMap',
  'visualMapType',
  'visualMapOrient',
  'brush',
  'lineStep',
  'showSymbol',
  'connectNulls',
  'roseType',
  'selectedMode',
  'emphasisFocus',
  'barGap',
  'large',
  'useUTC',
  'blendMode',
  'background',
  'ariaEnabled',
  'ariaDecal',
] as const satisfies readonly (keyof UiChartEchartsChrome)[];

const asMember = <T extends string | number>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T => (allowed as readonly unknown[]).includes(value) ? value as T : fallback;

const asBool = (value: unknown, fallback: boolean): boolean =>
  value === true ? true : value === false ? false : fallback;

const asString = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback;

const asZoomPercent = (value: unknown, fallback: number): number => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : fallback;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(100, Math.max(0, Math.round(parsed)));
};

export const readUiChartEchartsChrome = (props: Record<string, unknown>): Required<UiChartEchartsChrome> => ({
  showLabels: asBool(props.showLabels, DEFAULT_UI_CHART_ECHARTS_CHROME.showLabels),
  dataZoom: asBool(props.dataZoom, DEFAULT_UI_CHART_ECHARTS_CHROME.dataZoom),
  dataZoomType: asMember(props.dataZoomType, UI_CHART_DATA_ZOOM_TYPES, DEFAULT_UI_CHART_ECHARTS_CHROME.dataZoomType),
  dataZoomStart: asZoomPercent(props.dataZoomStart, DEFAULT_UI_CHART_ECHARTS_CHROME.dataZoomStart),
  dataZoomEnd: asZoomPercent(props.dataZoomEnd, DEFAULT_UI_CHART_ECHARTS_CHROME.dataZoomEnd),
  showToolbox: asBool(props.showToolbox, DEFAULT_UI_CHART_ECHARTS_CHROME.showToolbox),
  toolboxMagicType: asBool(props.toolboxMagicType, DEFAULT_UI_CHART_ECHARTS_CHROME.toolboxMagicType),
  toolboxDataView: asBool(props.toolboxDataView, DEFAULT_UI_CHART_ECHARTS_CHROME.toolboxDataView),
  toolboxOrient: asMember(props.toolboxOrient, UI_CHART_ORIENTS, DEFAULT_UI_CHART_ECHARTS_CHROME.toolboxOrient),
  showTooltip: asBool(props.showTooltip, DEFAULT_UI_CHART_ECHARTS_CHROME.showTooltip),
  tooltipTrigger: asMember(props.tooltipTrigger, UI_CHART_TOOLTIP_TRIGGERS, DEFAULT_UI_CHART_ECHARTS_CHROME.tooltipTrigger),
  tooltipTriggerOn: asMember(props.tooltipTriggerOn, UI_CHART_TOOLTIP_TRIGGER_ON, DEFAULT_UI_CHART_ECHARTS_CHROME.tooltipTriggerOn),
  tooltipConfine: asBool(props.tooltipConfine, DEFAULT_UI_CHART_ECHARTS_CHROME.tooltipConfine),
  tooltipOrder: asMember(props.tooltipOrder, UI_CHART_TOOLTIP_ORDERS, DEFAULT_UI_CHART_ECHARTS_CHROME.tooltipOrder),
  legendPosition: asMember(props.legendPosition, UI_CHART_LEGEND_POSITIONS, DEFAULT_UI_CHART_ECHARTS_CHROME.legendPosition),
  legendType: asMember(props.legendType, UI_CHART_LEGEND_TYPES, DEFAULT_UI_CHART_ECHARTS_CHROME.legendType),
  legendSelectedMode: asMember(props.legendSelectedMode, UI_CHART_SELECTED_MODES, DEFAULT_UI_CHART_ECHARTS_CHROME.legendSelectedMode),
  animation: asBool(props.animation, DEFAULT_UI_CHART_ECHARTS_CHROME.animation),
  animationDuration: asMember(props.animationDuration, UI_CHART_ANIMATION_DURATIONS, DEFAULT_UI_CHART_ECHARTS_CHROME.animationDuration),
  animationEasing: asMember(props.animationEasing, UI_CHART_ANIMATION_EASINGS, DEFAULT_UI_CHART_ECHARTS_CHROME.animationEasing),
  darkMode: asBool(props.darkMode, DEFAULT_UI_CHART_ECHARTS_CHROME.darkMode),
  renderer: asMember(props.renderer, UI_CHART_RENDERERS, DEFAULT_UI_CHART_ECHARTS_CHROME.renderer),
  showMarkPoint: asBool(props.showMarkPoint, DEFAULT_UI_CHART_ECHARTS_CHROME.showMarkPoint),
  showMarkLine: asBool(props.showMarkLine, DEFAULT_UI_CHART_ECHARTS_CHROME.showMarkLine),
  showMarkArea: asBool(props.showMarkArea, DEFAULT_UI_CHART_ECHARTS_CHROME.showMarkArea),
  axisPointer: asMember(props.axisPointer, UI_CHART_AXIS_POINTERS, DEFAULT_UI_CHART_ECHARTS_CHROME.axisPointer),
  showTitle: asBool(props.showTitle, DEFAULT_UI_CHART_ECHARTS_CHROME.showTitle),
  titleText: asString(props.titleText, DEFAULT_UI_CHART_ECHARTS_CHROME.titleText),
  titleSubtext: asString(props.titleSubtext, DEFAULT_UI_CHART_ECHARTS_CHROME.titleSubtext),
  titleLeft: asMember(props.titleLeft, UI_CHART_TITLE_ALIGNS, DEFAULT_UI_CHART_ECHARTS_CHROME.titleLeft),
  titleTop: asMember(props.titleTop, UI_CHART_TITLE_VERTICAL_ALIGNS, DEFAULT_UI_CHART_ECHARTS_CHROME.titleTop),
  xAxisName: asString(props.xAxisName, DEFAULT_UI_CHART_ECHARTS_CHROME.xAxisName),
  yAxisName: asString(props.yAxisName, DEFAULT_UI_CHART_ECHARTS_CHROME.yAxisName),
  axisInverse: asBool(props.axisInverse, DEFAULT_UI_CHART_ECHARTS_CHROME.axisInverse),
  axisSplitArea: asBool(props.axisSplitArea, DEFAULT_UI_CHART_ECHARTS_CHROME.axisSplitArea),
  axisLabelRotate: asMember(props.axisLabelRotate, UI_CHART_LABEL_ROTATES, DEFAULT_UI_CHART_ECHARTS_CHROME.axisLabelRotate),
  boundaryGap: asMember(props.boundaryGap, UI_CHART_BOUNDARY_GAPS, DEFAULT_UI_CHART_ECHARTS_CHROME.boundaryGap),
  gridContainLabel: asBool(props.gridContainLabel, DEFAULT_UI_CHART_ECHARTS_CHROME.gridContainLabel),
  visualMap: asBool(props.visualMap, DEFAULT_UI_CHART_ECHARTS_CHROME.visualMap),
  visualMapType: asMember(props.visualMapType, UI_CHART_VISUAL_MAP_TYPES, DEFAULT_UI_CHART_ECHARTS_CHROME.visualMapType),
  visualMapOrient: asMember(props.visualMapOrient, UI_CHART_ORIENTS, DEFAULT_UI_CHART_ECHARTS_CHROME.visualMapOrient),
  brush: asBool(props.brush, DEFAULT_UI_CHART_ECHARTS_CHROME.brush),
  lineStep: asMember(props.lineStep, UI_CHART_LINE_STEPS, DEFAULT_UI_CHART_ECHARTS_CHROME.lineStep),
  showSymbol: asBool(props.showSymbol, DEFAULT_UI_CHART_ECHARTS_CHROME.showSymbol),
  connectNulls: asBool(props.connectNulls, DEFAULT_UI_CHART_ECHARTS_CHROME.connectNulls),
  roseType: asMember(props.roseType, UI_CHART_ROSE_TYPES, DEFAULT_UI_CHART_ECHARTS_CHROME.roseType),
  selectedMode: asMember(props.selectedMode, UI_CHART_SELECTED_MODES, DEFAULT_UI_CHART_ECHARTS_CHROME.selectedMode),
  emphasisFocus: asMember(props.emphasisFocus, UI_CHART_EMPHASIS_FOCUS, DEFAULT_UI_CHART_ECHARTS_CHROME.emphasisFocus),
  barGap: asMember(props.barGap, UI_CHART_BAR_GAPS, DEFAULT_UI_CHART_ECHARTS_CHROME.barGap),
  large: asBool(props.large, DEFAULT_UI_CHART_ECHARTS_CHROME.large),
  useUTC: asBool(props.useUTC, DEFAULT_UI_CHART_ECHARTS_CHROME.useUTC),
  blendMode: asMember(props.blendMode, UI_CHART_BLEND_MODES, DEFAULT_UI_CHART_ECHARTS_CHROME.blendMode),
  background: asMember(props.background, UI_CHART_BACKGROUNDS, DEFAULT_UI_CHART_ECHARTS_CHROME.background),
  ariaEnabled: asBool(props.ariaEnabled, DEFAULT_UI_CHART_ECHARTS_CHROME.ariaEnabled),
  ariaDecal: asBool(props.ariaDecal, DEFAULT_UI_CHART_ECHARTS_CHROME.ariaDecal),
});

const selectedModeValue = (mode: UiChartSelectedMode): boolean | 'single' | 'multiple' =>
  mode === 'off' ? false : mode;

const backgroundColor = (background: UiChartBackground): string | undefined => {
  if (background === 'white') return '#ffffff';
  if (background === 'slate') return '#0f172a';
  return undefined;
};

const resolveDataZoom = (chrome: Required<UiChartEchartsChrome>): UiEchartsPassthrough['dataZoom'] => {
  if (!chrome.dataZoom) return false;
  const span = {
    start: Math.min(chrome.dataZoomStart, chrome.dataZoomEnd),
    end: Math.max(chrome.dataZoomStart, chrome.dataZoomEnd),
  };
  if (chrome.dataZoomType === 'inside') return [{ type: 'inside', ...span }];
  if (chrome.dataZoomType === 'slider') return [{ type: 'slider', height: 16, ...span }];
  return [
    { type: 'inside', ...span },
    { type: 'slider', height: 16, ...span },
  ];
};

export const resolveUiChartEchartsPassthrough = (
  chromeInput: UiChartEchartsChrome,
): UiEchartsPassthrough => {
  const chrome = readUiChartEchartsChrome(chromeInput);
  const tooltipTrigger = chrome.tooltipTrigger;
  const showTooltip = chrome.showTooltip && tooltipTrigger !== 'none';
  const legendPosition = chrome.legendPosition;
  const axisPointer = chrome.axisPointer;
  const verticalLegend = legendPosition === 'left' || legendPosition === 'right';
  const dataZoom = resolveDataZoom(chrome);
  const passthrough: UiEchartsPassthrough = {
    showLabels: chrome.showLabels,
    dataZoom,
    showToolbox: chrome.showToolbox,
    animation: chrome.animation,
    animationDuration: chrome.animation ? chrome.animationDuration : 0,
    animationEasing: chrome.animationEasing,
    darkMode: chrome.darkMode,
    theme: chrome.darkMode ? 'dark' : undefined,
    renderer: chrome.renderer === 'svg' ? 'svg' : undefined,
    useUTC: chrome.useUTC,
    blendMode: chrome.blendMode,
    backgroundColor: backgroundColor(chrome.background),
    tooltip: {
      show: showTooltip,
      trigger: tooltipTrigger === 'item' ? 'item' : 'axis',
      triggerOn: chrome.tooltipTriggerOn,
      confine: chrome.tooltipConfine,
      order: chrome.tooltipOrder,
      axisPointer: axisPointer === 'none' ? undefined : { type: axisPointer },
    },
    legend: {
      type: chrome.legendType,
      selectedMode: selectedModeValue(chrome.legendSelectedMode),
      ...(legendPosition === 'top' ? { top: 8, bottom: 'auto' as const } : {}),
      ...(legendPosition === 'bottom' ? { bottom: 0, top: 'auto' as const } : {}),
      ...(legendPosition === 'left' ? { left: 0, right: 'auto' as const, top: 'middle', orient: 'vertical' as const } : {}),
      ...(legendPosition === 'right' ? { right: 0, left: 'auto' as const, top: 'middle', orient: 'vertical' as const } : {}),
    },
    grid: {
      containLabel: chrome.gridContainLabel,
      ...(verticalLegend ? { [legendPosition]: 88 } : legendPosition === 'top' ? { top: 48 } : {}),
    },
    aria: {
      enabled: chrome.ariaEnabled,
      decal: { show: chrome.ariaDecal },
    },
  };
  const titleIsDefault = !chrome.showTitle
    && !chrome.titleText.trim()
    && !chrome.titleSubtext.trim()
    && chrome.titleLeft === 'auto'
    && chrome.titleTop === 'auto';
  if (!titleIsDefault) {
    passthrough.title = {
      show: chrome.showTitle,
      text: chrome.titleText,
      subtext: chrome.titleSubtext,
      left: chrome.titleLeft === 'auto' ? undefined : chrome.titleLeft,
      top: chrome.titleTop === 'auto' ? undefined : chrome.titleTop,
    };
  }
  const axisPatch = {
    inverse: chrome.axisInverse || undefined,
    splitArea: chrome.axisSplitArea ? { show: true } : undefined,
    axisLabel: chrome.axisLabelRotate ? { rotate: chrome.axisLabelRotate } : undefined,
    boundaryGap: chrome.boundaryGap === 'default' ? undefined : chrome.boundaryGap === 'on',
  };
  if (chrome.xAxisName.trim() || axisPatch.inverse || axisPatch.splitArea || axisPatch.axisLabel || axisPatch.boundaryGap !== undefined) {
    passthrough.xAxis = {
      name: chrome.xAxisName.trim() || undefined,
      ...axisPatch,
    };
  }
  if (chrome.yAxisName.trim() || axisPatch.inverse || axisPatch.splitArea) {
    passthrough.yAxis = {
      name: chrome.yAxisName.trim() || undefined,
      inverse: chrome.axisInverse || undefined,
      splitArea: chrome.axisSplitArea ? { show: true } : undefined,
    };
  }
  if (chrome.visualMap) {
    passthrough.visualMap = {
      type: chrome.visualMapType,
      orient: chrome.visualMapOrient,
      min: 0,
      max: 100,
      calculable: true,
      left: chrome.visualMapOrient === 'vertical' ? 8 : 'center',
      bottom: chrome.visualMapOrient === 'horizontal' ? 8 : undefined,
      inRange: { color: ['#e0f2fe', '#0ea5e9', '#0c4a6e'] },
    };
  }
  if (chrome.brush) {
    passthrough.brush = {
      toolbox: ['rect', 'polygon', 'lineX', 'lineY', 'keep', 'clear'],
      xAxisIndex: 0,
    };
  }
  if (chrome.showToolbox || chrome.brush) {
    passthrough.toolbox = {
      show: chrome.showToolbox || chrome.brush,
      orient: chrome.toolboxOrient,
      feature: {
        ...(chrome.showToolbox
          ? {
            saveAsImage: { title: 'Save image' },
            restore: { title: 'Reset' },
            ...(chrome.toolboxDataView ? { dataView: { title: 'Data view', readOnly: true, lang: ['Data view', 'Close', 'Refresh'] } } : {}),
            ...(chrome.toolboxMagicType ? { magicType: { type: ['line', 'bar', 'stack'] } } : {}),
            ...(chrome.dataZoom ? { dataZoom: { title: { zoom: 'Zoom', back: 'Reset zoom' } } } : {}),
          }
          : {}),
        ...(chrome.brush ? { brush: { type: ['rect', 'polygon', 'lineX', 'lineY', 'keep', 'clear'] } } : {}),
      },
    };
  }
  const seriesOption: Record<string, unknown> = {};
  if (chrome.showMarkPoint) {
    seriesOption.markPoint = { data: [{ type: 'max', name: 'Max' }, { type: 'min', name: 'Min' }] };
  }
  if (chrome.showMarkLine) {
    seriesOption.markLine = { data: [{ type: 'average', name: 'Avg' }] };
  }
  if (chrome.showMarkArea) {
    seriesOption.markArea = {
      data: [[{ type: 'min', name: 'Min band' }, { type: 'max', name: 'Max band' }]],
    };
  }
  if (chrome.lineStep !== 'none') seriesOption.step = chrome.lineStep;
  if (chrome.showSymbol === false) seriesOption.showSymbol = false;
  if (chrome.connectNulls) seriesOption.connectNulls = true;
  if (chrome.roseType !== 'off') seriesOption.roseType = chrome.roseType;
  if (chrome.selectedMode !== 'off') seriesOption.selectedMode = selectedModeValue(chrome.selectedMode);
  if (chrome.emphasisFocus !== 'none') seriesOption.emphasis = { focus: chrome.emphasisFocus };
  if (chrome.barGap !== '30%') seriesOption.barGap = chrome.barGap;
  if (chrome.large) seriesOption.large = true;
  if (Object.keys(seriesOption).length > 0) {
    passthrough.seriesOption = seriesOption as SeriesOption;
  }
  return passthrough;
};

const LEGACY_JSX_KEYS = [
  'showLabels',
  'dataZoom',
  'showToolbox',
  'toolboxMagicType',
  'showTooltip',
  'tooltipTrigger',
  'legendPosition',
  'animation',
  'darkMode',
  'renderer',
  'showMarkPoint',
  'showMarkLine',
  'axisPointer',
] as const;

const jsxAttr = (key: string, value: string | number | boolean): string =>
  typeof value === 'string' ? ` ${key}="${value}"` : ` ${key}={${value}}`;

export const renderDesignerChartEchartsJsxAttrs = (props: Record<string, unknown>): string => {
  const chrome = readUiChartEchartsChrome(props);
  const parts: string[] = [];
  for (const key of LEGACY_JSX_KEYS) {
    parts.push(jsxAttr(key, chrome[key]));
  }
  for (const key of UI_CHART_ECHARTS_CHROME_KEYS) {
    if ((LEGACY_JSX_KEYS as readonly string[]).includes(key)) continue;
    const value = chrome[key];
    const fallback = DEFAULT_UI_CHART_ECHARTS_CHROME[key];
    if (value === fallback) continue;
    parts.push(jsxAttr(key, value));
  }
  return parts.join('');
};
