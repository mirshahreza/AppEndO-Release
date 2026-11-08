import type {
  EChartsOption,
  EChartsType,
  ECElementEvent,
  SeriesOption,
  SetOptionOpts,
} from 'echarts';
import type { CSSProperties } from 'react';
import { mergeEchartsOption } from './mergeEchartsOption';

/** Top-level Apache ECharts option keys (ECBasicOption + ECUnitOption mixins). */
export const ECHARTS_OPTION_KEYS = [
  'title',
  'legend',
  'grid',
  'xAxis',
  'yAxis',
  'polar',
  'radiusAxis',
  'angleAxis',
  'radar',
  'dataZoom',
  'visualMap',
  'tooltip',
  'axisPointer',
  'toolbox',
  'brush',
  'geo',
  'parallel',
  'parallelAxis',
  'singleAxis',
  'timeline',
  'calendar',
  'matrix',
  'graphic',
  'dataset',
  'aria',
  'series',
  'color',
  'backgroundColor',
  'textStyle',
  'animation',
  'animationThreshold',
  'animationDuration',
  'animationEasing',
  'animationDelay',
  'animationDurationUpdate',
  'animationEasingUpdate',
  'animationDelayUpdate',
  'stateAnimation',
  'blendMode',
  'hoverLayerThreshold',
  'useUTC',
  'media',
  'darkMode',
  'options',
  'baseOption',
  'thumbnail',
  'colorLayer',
] as const;

export type EchartsOptionKey = (typeof ECHARTS_OPTION_KEYS)[number];

export type UiEchartsDataZoomProp = boolean | NonNullable<EChartsOption['dataZoom']>;

type EchartsKnownOptionProps = {
  [K in Exclude<EchartsOptionKey, 'dataZoom'>]?: K extends keyof EChartsOption ? EChartsOption[K] : unknown;
};

export type UiEchartsOptionProps = EchartsKnownOptionProps & {
  dataZoom?: UiEchartsDataZoomProp;
  title?: EChartsOption['title'] | string;
  /** Full option overlay — wins over built option and individual keys. */
  option?: EChartsOption;
  /** Merged into every built series (markPoint, markLine, encode, emphasis, …). */
  seriesOption?: SeriesOption;
};

export type UiEchartsEventHandler = (params: unknown, instance: EChartsType) => void;
export type UiEchartsEventMap = Record<string, UiEchartsEventHandler | undefined>;

/** Documented ECharts mouse + component events. `onEvents` also accepts any custom name. */
export const UI_ECHARTS_EVENTS = [
  'click',
  'dblclick',
  'mousedown',
  'mousemove',
  'mouseup',
  'mouseover',
  'mouseout',
  'globalout',
  'contextmenu',
  'highlight',
  'downplay',
  'selectchanged',
  'legendselectchanged',
  'legendselected',
  'legendunselected',
  'legendselectall',
  'legendinverseselect',
  'legendscroll',
  'datazoom',
  'datarangeselected',
  'timelinechanged',
  'timelineplaychanged',
  'restore',
  'dataviewchanged',
  'magictypechanged',
  'geoselectchanged',
  'geoselected',
  'geounselected',
  'pieselectchanged',
  'pieselected',
  'pieunselected',
  'mapselectchanged',
  'mapselected',
  'mapunselected',
  'axisareaselected',
  'focusnodeadjacency',
  'unfocusnodeadjacency',
  'brush',
  'brushEnd',
  'brushselected',
  'rendered',
  'finished',
  'axisbreakchanged',
] as const;

export type UiEchartsEventName = (typeof UI_ECHARTS_EVENTS)[number];

export type UiEchartsInitProps = {
  theme?: string | object | null;
  locale?: string;
  renderer?: 'canvas' | 'svg';
  devicePixelRatio?: number;
  useDirtyRect?: boolean;
  useCoarsePointer?: boolean;
  pointerSize?: number;
  ssr?: boolean;
};

export type UiEchartsSetOptionProps = {
  notMerge?: boolean;
  replaceMerge?: SetOptionOpts['replaceMerge'];
  lazyUpdate?: boolean;
  silent?: boolean;
};

export type UiEchartsRuntimeProps = UiEchartsInitProps & UiEchartsSetOptionProps & {
  loading?: boolean;
  loadingOption?: Record<string, unknown>;
  group?: string;
  autoResize?: boolean;
  onEvents?: UiEchartsEventMap;
  onChartReady?: (instance: EChartsType) => void;
  className?: string;
  style?: CSSProperties;
};

export type UiEchartsPassthrough = UiEchartsOptionProps & UiEchartsRuntimeProps;

export type UiEchartsHandle = {
  getInstance: () => EChartsType | null;
  getDom: () => HTMLDivElement | null;
  setOption: (option: EChartsOption, opts?: SetOptionOpts) => void;
  getOption: () => unknown;
  resize: EChartsType['resize'];
  dispatchAction: EChartsType['dispatchAction'];
  convertToPixel: EChartsType['convertToPixel'];
  convertFromPixel: EChartsType['convertFromPixel'];
  containPixel: EChartsType['containPixel'];
  showLoading: EChartsType['showLoading'];
  hideLoading: EChartsType['hideLoading'];
  getDataURL: EChartsType['getDataURL'];
  getConnectedDataURL: EChartsType['getConnectedDataURL'];
  appendData: EChartsType['appendData'];
  clear: EChartsType['clear'];
  isDisposed: () => boolean;
  getWidth: () => number;
  getHeight: () => number;
  getId: () => string;
};

const RUNTIME_KEYS = new Set<string>([
  'theme',
  'locale',
  'renderer',
  'devicePixelRatio',
  'useDirtyRect',
  'useCoarsePointer',
  'pointerSize',
  'ssr',
  'notMerge',
  'replaceMerge',
  'lazyUpdate',
  'silent',
  'loading',
  'loadingOption',
  'group',
  'autoResize',
  'onEvents',
  'onChartReady',
  'className',
  'style',
]);

export const pickEchartsOptionProps = (props: UiEchartsOptionProps): EChartsOption => {
  const picked: Record<string, unknown> = {};
  for (const key of ECHARTS_OPTION_KEYS) {
    const value = props[key];
    if (value === undefined) {
      continue;
    }
    if (key === 'dataZoom' && typeof value === 'boolean') {
      continue;
    }
    if (key === 'title' && typeof value === 'string') {
      picked.title = { text: value };
      continue;
    }
    picked[key] = value;
  }
  return picked as EChartsOption;
};

export const pickUiEchartsRuntimeProps = (props: UiEchartsRuntimeProps): UiEchartsRuntimeProps => {
  const picked: Record<string, unknown> = {};
  for (const key of RUNTIME_KEYS) {
    const value = (props as Record<string, unknown>)[key];
    if (value !== undefined) {
      picked[key] = value;
    }
  }
  return picked as UiEchartsRuntimeProps;
};

const asSeriesList = (series: EChartsOption['series']): SeriesOption[] => {
  if (!series) {
    return [];
  }
  return (Array.isArray(series) ? series : [series]) as SeriesOption[];
};

export const composeUiChartOption = (
  built: EChartsOption,
  extras: UiEchartsOptionProps = {},
): EChartsOption => {
  const withKeys = mergeEchartsOption(built, pickEchartsOptionProps(extras));
  const withSeries = extras.seriesOption
    ? {
      ...withKeys,
      series: asSeriesList(withKeys.series).map((series) =>
        mergeEchartsOption(series, extras.seriesOption),
      ),
    }
    : withKeys;
  return extras.option ? mergeEchartsOption(withSeries, extras.option) : withSeries;
};

export const bindEchartsHandle = (
  getChart: () => EChartsType | null,
  getHost: () => HTMLDivElement | null,
): UiEchartsHandle => {
  const requireInstance = (): EChartsType => {
    const instance = getChart();
    if (!instance) {
      throw new Error('ECharts instance is not ready');
    }
    return instance;
  };
  return {
    getInstance: getChart,
    getDom: getHost,
    setOption: (option, opts) => {
      requireInstance().setOption(option, opts);
    },
    getOption: () => requireInstance().getOption(),
    resize: ((opts?: Parameters<EChartsType['resize']>[0]) => requireInstance().resize(opts)) as EChartsType['resize'],
    dispatchAction: ((payload: Parameters<EChartsType['dispatchAction']>[0]) =>
      requireInstance().dispatchAction(payload)) as EChartsType['dispatchAction'],
    convertToPixel: ((...args: Parameters<EChartsType['convertToPixel']>) =>
      requireInstance().convertToPixel(...args)) as EChartsType['convertToPixel'],
    convertFromPixel: ((...args: Parameters<EChartsType['convertFromPixel']>) =>
      requireInstance().convertFromPixel(...args)) as EChartsType['convertFromPixel'],
    containPixel: ((...args: Parameters<EChartsType['containPixel']>) =>
      requireInstance().containPixel(...args)) as EChartsType['containPixel'],
    showLoading: ((...args: Parameters<EChartsType['showLoading']>) =>
      requireInstance().showLoading(...args)) as EChartsType['showLoading'],
    hideLoading: () => requireInstance().hideLoading(),
    getDataURL: ((opts?: Parameters<EChartsType['getDataURL']>[0]) =>
      requireInstance().getDataURL(opts)) as EChartsType['getDataURL'],
    getConnectedDataURL: ((opts?: Parameters<EChartsType['getConnectedDataURL']>[0]) =>
      requireInstance().getConnectedDataURL(opts)) as EChartsType['getConnectedDataURL'],
    appendData: ((opts: Parameters<EChartsType['appendData']>[0]) =>
      requireInstance().appendData(opts)) as EChartsType['appendData'],
    clear: () => requireInstance().clear(),
    isDisposed: () => getChart()?.isDisposed() ?? true,
    getWidth: () => requireInstance().getWidth(),
    getHeight: () => requireInstance().getHeight(),
    getId: () => requireInstance().getId(),
  };
};

export { mergeEchartsOption } from './mergeEchartsOption';
export type { EChartsOption, EChartsType, ECElementEvent, SeriesOption, SetOptionOpts };
