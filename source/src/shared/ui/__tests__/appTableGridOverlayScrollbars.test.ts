import { describe, expect, it } from 'vitest';
import {
  computeOverlayScrollbarAxisMetrics,
  scrollOffsetFromThumbDrag,
} from '../appTableGridOverlayScrollbars';

describe('computeOverlayScrollbarAxisMetrics', () => {
  it('hides when content fits', () => {
    expect(computeOverlayScrollbarAxisMetrics(400, 400, 0)).toEqual({
      visible: false,
      thumbSize: 0,
      thumbOffset: 0,
    });
  });

  it('sizes and positions the thumb from scroll metrics', () => {
    const metrics = computeOverlayScrollbarAxisMetrics(1000, 200, 400);
    expect(metrics.visible).toBe(true);
    expect(metrics.thumbSize).toBeGreaterThanOrEqual(20);
    expect(metrics.thumbOffset).toBeGreaterThan(0);
    expect(metrics.thumbOffset).toBeLessThan(200);
  });
});

describe('scrollOffsetFromThumbDrag', () => {
  it('maps thumb drag to scroll offset', () => {
    const next = scrollOffsetFromThumbDrag(50, 200, 40, 1000, 200, 0);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(800);
  });
});
