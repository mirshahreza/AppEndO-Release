/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiBarChart } from '../../UiChart';
import {
  measureEchartsHostBox,
  resizeEchartsToHost,
} from '../UiEchartsHost';
import type { UiEchartsHandle } from '../uiEchartsApi';
import { resolveEchartsRenderer } from '../registerEcharts';

afterEach(cleanup);

describe('echarts host layout guards', () => {
  it('picks a renderer without reading process.env (undefined in the browser)', () => {
    expect(['canvas', 'svg']).toContain(resolveEchartsRenderer());
  });
  it('ignores zero-size resize so the canvas cannot collapse inside a reserved box', () => {
    const resize = vi.fn();
    const el = document.createElement('div');
    Object.defineProperty(el, 'clientWidth', { value: 0 });
    Object.defineProperty(el, 'clientHeight', { value: 280 });
    el.getBoundingClientRect = () => ({
      width: 0,
      height: 280,
      top: 0,
      left: 0,
      right: 0,
      bottom: 280,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    expect(resizeEchartsToHost({ resize }, el)).toBe(false);
    expect(resize).not.toHaveBeenCalled();
  });

  it('resizes to the host box when both axes are usable', () => {
    const resize = vi.fn();
    const el = document.createElement('div');
    Object.defineProperty(el, 'clientWidth', { value: 640 });
    Object.defineProperty(el, 'clientHeight', { value: 280 });
    expect(resizeEchartsToHost({ resize }, el)).toBe(true);
    expect(resize).toHaveBeenCalledWith({ width: 640, height: 280 });
  });

  it('falls back to a minimum width when the host has not been laid out yet', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'clientWidth', { value: 0 });
    Object.defineProperty(el, 'offsetWidth', { value: 0 });
    Object.defineProperty(el, 'clientHeight', { value: 0 });
    Object.defineProperty(el, 'offsetHeight', { value: 0 });
    el.getBoundingClientRect = () => ({
      width: 0,
      height: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    expect(measureEchartsHostBox(el, 280)).toEqual({ width: 320, height: 280 });
  });
});

describe('UiBarChart host', () => {
  it('paints an echarts instance into the reserved plot box', async () => {
    const { container } = render(
      <UiBarChart
        data={[
          { label: 'Jan', revenue: 4200, cost: 2800 },
          { label: 'Feb', revenue: 5100, cost: 3000 },
        ]}
        seriesKeys={['revenue', 'cost']}
        height={280}
      />,
    );
    const host = container.querySelector('[data-chart-engine="echarts"][data-chart-type="bar"]');
    expect(host).toBeTruthy();
    await waitFor(() => {
      expect(host?.getAttribute('_echarts_instance_')).toBeTruthy();
      expect(host?.querySelector('canvas, svg')).toBeTruthy();
    });
  });

  it('exposes ECharts option overlay and instance methods on the ref', async () => {
    const ref = React.createRef<UiEchartsHandle>();
    render(
      <UiBarChart
        ref={ref}
        data={[
          { label: 'Jan', revenue: 4200 },
          { label: 'Feb', revenue: 5100 },
        ]}
        seriesKeys={['revenue']}
        height={280}
        title={{ text: 'Revenue' }}
        seriesOption={{ markPoint: { data: [{ type: 'max', name: 'Peak' }] } }}
      />,
    );
    await waitFor(() => {
      expect(ref.current?.getInstance()).toBeTruthy();
    });
    const option = ref.current?.getOption() as {
      title?: Array<{ text?: string }>;
      series?: Array<{ markPoint?: { data?: unknown[] } }>;
    };
    expect(option.title?.[0]?.text).toBe('Revenue');
    expect(option.series?.[0]?.markPoint?.data?.[0]).toMatchObject({ type: 'max', name: 'Peak' });
    expect(ref.current?.getWidth()).toBeGreaterThan(0);
  });
});
