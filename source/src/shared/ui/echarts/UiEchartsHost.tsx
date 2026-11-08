import * as React from 'react';
import type { EChartsType } from 'echarts/core';
import type { EChartsOption, ECElementEvent } from 'echarts';
import {
  resolveUiChartNumericValue,
  type UiChartDataPointClickDetail,
  type UiChartDataRow,
} from '../uiChartModel';
import {
  bindEchartsHandle,
  type UiEchartsHandle,
  type UiEchartsRuntimeProps,
} from './uiEchartsApi';
import {
  connectEcharts,
  getInstanceByDom,
  initEcharts,
  resolveEchartsRenderer,
} from './registerEcharts';

export const mapEchartsClick = (
  params: ECElementEvent,
  fallbackSeriesKey: string,
  xAxisKey: string,
): UiChartDataPointClickDetail | null => {
  const raw = params.data;
  if (raw && typeof raw === 'object' && 'row' in (raw as object)) {
    const payload = raw as { row: UiChartDataRow; seriesKey?: string; value?: unknown; name?: string };
    const seriesKey = payload.seriesKey ?? String(params.seriesName ?? fallbackSeriesKey);
    const value = Array.isArray(payload.value)
      ? Number(payload.value[payload.value.length - 1] ?? 0)
      : typeof payload.value === 'number'
        ? payload.value
        : resolveUiChartNumericValue(payload.row, seriesKey);
    return {
      category: String(params.name ?? payload.name ?? payload.row[xAxisKey] ?? payload.row.label ?? ''),
      seriesKey,
      value: Number.isFinite(value) ? value : 0,
      row: payload.row,
    };
  }
  if (params.data && typeof params.data === 'object') {
    const row = params.data as UiChartDataRow;
    const seriesKey = String(params.seriesName ?? fallbackSeriesKey);
    return {
      category: String(params.name ?? row[xAxisKey] ?? row.label ?? ''),
      seriesKey,
      value: resolveUiChartNumericValue(row, seriesKey),
      row,
    };
  }
  return null;
};

const MIN_CHART_BOX_PX = 8;
const FALLBACK_CHART_WIDTH_PX = 320;

export const measureEchartsHostBox = (el: HTMLElement, minHeight = 1): { width: number; height: number } => {
  const rect = el.getBoundingClientRect();
  return {
    width: Math.max(el.clientWidth, el.offsetWidth, Math.round(rect.width), FALLBACK_CHART_WIDTH_PX),
    height: Math.max(el.clientHeight, el.offsetHeight, Math.round(rect.height), minHeight, 1),
  };
};

export const resizeEchartsToHost = (instance: Pick<EChartsType, 'resize'>, el: HTMLElement): boolean => {
  const width = Math.round(el.clientWidth || el.getBoundingClientRect().width);
  const height = Math.round(el.clientHeight || el.getBoundingClientRect().height);
  if (width < MIN_CHART_BOX_PX || height < MIN_CHART_BOX_PX) {
    return false;
  }
  instance.resize({ width, height });
  return true;
};

const compactRecord = <T extends Record<string, unknown>>(value: T): Partial<T> => {
  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) {
      next[key] = entry;
    }
  }
  return next as Partial<T>;
};

const createEchartsInstance = (
  el: HTMLElement,
  width: number,
  height: number,
  theme: UiEchartsRuntimeProps['theme'],
  init: Pick<UiEchartsRuntimeProps, 'renderer' | 'locale' | 'devicePixelRatio' | 'useDirtyRect' | 'useCoarsePointer' | 'pointerSize' | 'ssr'>,
): EChartsType => {
  getInstanceByDom(el)?.dispose();
  const renderer = init.renderer ?? resolveEchartsRenderer();
  const opts = compactRecord({
    renderer,
    width,
    height,
    locale: init.locale,
    devicePixelRatio: init.devicePixelRatio,
    useDirtyRect: init.useDirtyRect,
    useCoarsePointer: init.useCoarsePointer,
    pointerSize: init.pointerSize,
    ssr: init.ssr,
  });
  try {
    return initEcharts(el, theme ?? undefined, opts);
  } catch {
    return initEcharts(el, theme ?? undefined, {
      ...opts,
      renderer: renderer === 'canvas' ? 'svg' : 'canvas',
    });
  }
};

export type UiEchartsHostProps = UiEchartsRuntimeProps & {
  option: EChartsOption;
  height: number;
  chartType?: string;
  ariaLabel?: string;
  xAxisKey?: string;
  fallbackSeriesKey?: string;
  onDataPointClick?: (detail: UiChartDataPointClickDetail) => void;
};

export const UiEchartsHost = React.forwardRef<UiEchartsHandle, UiEchartsHostProps>(function UiEchartsHost({
  option,
  height,
  chartType,
  ariaLabel,
  xAxisKey = 'label',
  fallbackSeriesKey = 'value',
  onDataPointClick,
  theme,
  locale,
  renderer,
  devicePixelRatio,
  useDirtyRect,
  useCoarsePointer,
  pointerSize,
  ssr,
  notMerge = true,
  replaceMerge,
  lazyUpdate,
  silent,
  loading = false,
  loadingOption,
  group,
  autoResize = true,
  onEvents,
  onChartReady,
  className,
  style,
}, ref) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const chartRef = React.useRef<EChartsType | null>(null);
  const clickRef = React.useRef(onDataPointClick);
  const axisRef = React.useRef(xAxisKey);
  const seriesRef = React.useRef(fallbackSeriesKey);
  const optionRef = React.useRef(option);
  const eventsRef = React.useRef(onEvents);
  const readyRef = React.useRef(onChartReady);
  const setOptionRef = React.useRef({ notMerge, replaceMerge, lazyUpdate, silent });
  clickRef.current = onDataPointClick;
  axisRef.current = xAxisKey;
  seriesRef.current = fallbackSeriesKey;
  optionRef.current = option;
  eventsRef.current = onEvents;
  readyRef.current = onChartReady;
  setOptionRef.current = { notMerge, replaceMerge, lazyUpdate, silent };

  const applyOption = React.useCallback((instance: EChartsType, next: EChartsOption) => {
    const flags = compactRecord(setOptionRef.current);
    try {
      instance.setOption(next, flags);
    } catch {
      instance.setOption(next, { notMerge: true });
    }
  }, []);

  React.useImperativeHandle(
    ref,
    () => bindEchartsHandle(() => chartRef.current, () => hostRef.current),
    [],
  );

  React.useEffect(() => {
    const el = hostRef.current;
    if (!el) {
      return;
    }
    const box = measureEchartsHostBox(el, height);
    const instance = createEchartsInstance(el, box.width, box.height, theme, {
      renderer,
      locale,
      devicePixelRatio,
      useDirtyRect,
      useCoarsePointer,
      pointerSize,
      ssr,
    });
    chartRef.current = instance;
    const onClick = (params: ECElementEvent) => {
      const handler = clickRef.current;
      if (handler) {
        const detail = mapEchartsClick(params, seriesRef.current, axisRef.current);
        if (detail) {
          handler(detail);
        }
      }
      eventsRef.current?.click?.(params, instance);
    };
    instance.on('click', onClick);
    const extraHandlers: Array<{ name: string; fn: (params: unknown) => void }> = [];
    for (const name of Object.keys(eventsRef.current ?? {})) {
      if (name === 'click') {
        continue;
      }
      const fn = (params: unknown) => {
        eventsRef.current?.[name]?.(params, instance);
      };
      instance.on(name, fn);
      extraHandlers.push({ name, fn });
    }
    applyOption(instance, optionRef.current);
    if (group) {
      instance.group = group;
      connectEcharts(group);
    }
    readyRef.current?.(instance);
    const frame = requestAnimationFrame(() => {
      resizeEchartsToHost(instance, el);
    });
    const observer = autoResize && typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => {
        resizeEchartsToHost(instance, el);
      })
      : null;
    observer?.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      instance.off('click', onClick);
      for (const extra of extraHandlers) {
        instance.off(extra.name, extra.fn);
      }
      instance.dispose();
      if (chartRef.current === instance) {
        chartRef.current = null;
      }
    };
  }, [
    height,
    theme,
    locale,
    renderer,
    devicePixelRatio,
    useDirtyRect,
    useCoarsePointer,
    pointerSize,
    ssr,
    autoResize,
    group,
    applyOption,
  ]);

  React.useEffect(() => {
    const instance = chartRef.current;
    if (!instance) {
      return;
    }
    applyOption(instance, option);
  }, [option, notMerge, replaceMerge, lazyUpdate, silent, applyOption]);

  const shownLoadingRef = React.useRef(false);

  React.useEffect(() => {
    const instance = chartRef.current;
    if (!instance) {
      return;
    }
    if (loading) {
      instance.showLoading('default', loadingOption);
      shownLoadingRef.current = true;
      return;
    }
    if (shownLoadingRef.current) {
      instance.hideLoading();
      shownLoadingRef.current = false;
    }
  }, [loading, loadingOption]);

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label={ariaLabel}
      data-chart-engine="echarts"
      data-chart-type={chartType}
      className={['relative w-full shrink-0 [&_canvas]:max-w-none', className].filter(Boolean).join(' ')}
      style={{ width: '100%', height, minHeight: height, ...style }}
    />
  );
});
