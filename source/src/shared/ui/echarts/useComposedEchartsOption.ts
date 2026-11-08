import * as React from 'react';
import type { EChartsOption } from 'echarts';
import {
  composeUiChartOption,
  ECHARTS_OPTION_KEYS,
  type UiEchartsOptionProps,
} from './uiEchartsApi';

export const useComposedEchartsOption = (
  built: EChartsOption,
  extras: UiEchartsOptionProps,
): EChartsOption => {
  const overlay = extras.option;
  const seriesOption = extras.seriesOption;
  const keyValues = ECHARTS_OPTION_KEYS.map((key) => extras[key]);
  return React.useMemo(
    () => composeUiChartOption(built, extras),
    // Individual ECharts keys are listed so inline option objects stay referentially stable when unchanged.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- extras is read inside; keyValues tracks its option fields.
    [built, overlay, seriesOption, ...keyValues],
  );
};
