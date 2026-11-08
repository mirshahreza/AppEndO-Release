/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import {
  applyAppTableGridHorizontalScrollOffset,
  normalizeAppTableGridHorizontalScrollOffset,
  resolveHorizontalThumbDragDelta,
  resolveSplitTableHeaderTransform,
} from '../appTableGridHorizontalScroll';

function mockScrollHost(options: {
  direction: 'ltr' | 'rtl';
  scrollWidth: number;
  clientWidth: number;
  scrollLeft: number;
  rtlType?: 'negative' | 'reverse';
}): HTMLDivElement {
  const host = document.createElement('div');
  host.style.direction = options.direction;
  Object.defineProperty(host, 'scrollWidth', { configurable: true, value: options.scrollWidth });
  Object.defineProperty(host, 'clientWidth', { configurable: true, value: options.clientWidth });

  let scrollLeft = options.scrollLeft;
  const max = Math.max(0, options.scrollWidth - options.clientWidth);
  const rtlType = options.rtlType ?? 'negative';

  Object.defineProperty(host, 'scrollLeft', {
    configurable: true,
    get: () => scrollLeft,
    set: (next: number) => {
      if (options.direction === 'ltr') {
        scrollLeft = next;
        return;
      }
      if (rtlType === 'negative') {
        scrollLeft = next <= 0 ? next : 0;
        return;
      }
      scrollLeft = Math.max(0, Math.min(max, next));
    },
  });

  if (options.direction === 'rtl' && rtlType === 'negative') {
    Object.defineProperty(host, 'scrollLeft', {
      configurable: true,
      get: () => scrollLeft,
      set: (next: number) => {
        scrollLeft = next;
      },
    });
  }

  return host;
}

describe('appTableGridHorizontalScroll', () => {
  it('normalizes LTR scrollLeft for split header transform', () => {
    const host = mockScrollHost({
      direction: 'ltr',
      scrollWidth: 1200,
      clientWidth: 400,
      scrollLeft: 120,
    });
    expect(normalizeAppTableGridHorizontalScrollOffset(host)).toBe(120);
    expect(resolveSplitTableHeaderTransform(host)).toBe('translateX(-120px)');
  });

  it('normalizes RTL negative scrollLeft for split header transform', () => {
    const host = document.createElement('div');
    host.style.direction = 'rtl';
    Object.defineProperty(host, 'scrollWidth', { configurable: true, value: 1200 });
    Object.defineProperty(host, 'clientWidth', { configurable: true, value: 400 });
    let scrollLeft = 0;
    Object.defineProperty(host, 'scrollLeft', {
      configurable: true,
      get: () => scrollLeft,
      set: (next: number) => {
        scrollLeft = next;
      },
    });
    scrollLeft = 1;
    expect(host.scrollLeft).toBe(1);
    scrollLeft = 0;
    scrollLeft = -240;

    expect(normalizeAppTableGridHorizontalScrollOffset(host)).toBe(240);
    expect(resolveSplitTableHeaderTransform(host)).toBe('translateX(240px)');
  });

  it('uses positive split header transform for rtl reverse scrollLeft', () => {
    const host = mockScrollHost({
      direction: 'rtl',
      scrollWidth: 1200,
      clientWidth: 400,
      scrollLeft: 760,
      rtlType: 'reverse',
    });
    expect(normalizeAppTableGridHorizontalScrollOffset(host)).toBe(40);
    expect(resolveSplitTableHeaderTransform(host)).toBe('translateX(40px)');
  });

  it('writes RTL negative scrollLeft from normalized offset', () => {
    const host = document.createElement('div');
    host.style.direction = 'rtl';
    Object.defineProperty(host, 'scrollWidth', { configurable: true, value: 900 });
    Object.defineProperty(host, 'clientWidth', { configurable: true, value: 300 });
    let scrollLeft = -1;
    Object.defineProperty(host, 'scrollLeft', {
      configurable: true,
      get: () => scrollLeft,
      set: (next: number) => {
        scrollLeft = next;
      },
    });

    applyAppTableGridHorizontalScrollOffset(host, 180);
    expect(scrollLeft).toBe(-180);
  });

  it('inverts horizontal thumb drag delta in rtl', () => {
    const host = document.createElement('div');
    host.style.direction = 'rtl';
    expect(resolveHorizontalThumbDragDelta(host, -80)).toBe(80);
    expect(resolveHorizontalThumbDragDelta(host, 40)).toBe(-40);
  });
});
