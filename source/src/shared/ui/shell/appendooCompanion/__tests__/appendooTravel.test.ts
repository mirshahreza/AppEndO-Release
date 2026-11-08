import { describe, expect, it } from 'vitest';
import {
  APPENDOO_DEFAULT_TRAVEL,
  applyAppendooTravelEasing,
  cssAppendooTravelEasing,
  easeAppendooTravel,
  mergeAppendooTravelRig,
  pingPongAppendooTravelTime,
  sampleAppendooTravel,
} from '../appendooTravel';

describe('appendooTravel', () => {
  it('rests the companion in the center of the playground', () => {
    expect(APPENDOO_DEFAULT_TRAVEL.fromX).toBe(50);
    expect(APPENDOO_DEFAULT_TRAVEL.fromY).toBe(50);
    expect(sampleAppendooTravel(APPENDOO_DEFAULT_TRAVEL, 0)).toMatchObject({ x: 50, y: 50 });
  });

  it('samples a linear hop at the midpoint', () => {
    const rig = applyAppendooTravelEasing({
      ...APPENDOO_DEFAULT_TRAVEL,
      fromX: 0,
      fromY: 0,
      toX: 100,
      toY: 50,
    }, 'linear');
    expect(sampleAppendooTravel(rig, 0)).toMatchObject({ x: 0, y: 0, progress: 0 });
    expect(sampleAppendooTravel(rig, 1)).toMatchObject({ x: 100, y: 50, progress: 1 });
    const mid = sampleAppendooTravel(rig, 0.5);
    expect(mid.x).toBeCloseTo(50, 5);
    expect(mid.y).toBeCloseTo(25, 5);
  });

  it('lets ease-out run ahead of linear, and back-out overshoot the end before landing', () => {
    const linear = applyAppendooTravelEasing(APPENDOO_DEFAULT_TRAVEL, 'linear');
    const easeOut = applyAppendooTravelEasing(APPENDOO_DEFAULT_TRAVEL, 'ease-out-cubic');
    const backOut = applyAppendooTravelEasing(APPENDOO_DEFAULT_TRAVEL, 'ease-out-back');
    expect(easeAppendooTravel(easeOut, 0.4)).toBeGreaterThan(easeAppendooTravel(linear, 0.4));
    expect(easeAppendooTravel(backOut, 0.85)).toBeGreaterThan(1);
    expect(cssAppendooTravelEasing(backOut)).toContain('cubic-bezier(');
  });

  it('clamps playground travel values and custom bezier handles', () => {
    const rig = mergeAppendooTravelRig({
      fromX: -20,
      toX: 140,
      durationMs: 12,
      bezierX1: -1,
      bezierY1: 9,
      easing: 'nope' as never,
    });
    expect(rig.fromX).toBe(0);
    expect(rig.toX).toBe(100);
    expect(rig.durationMs).toBe(120);
    expect(rig.bezierX1).toBe(0);
    expect(rig.bezierY1).toBe(2);
    expect(rig.easing).toBe('custom');
  });

  it('ping-pongs looped time and finishes a one-shot hop', () => {
    expect(pingPongAppendooTravelTime(450, 900, false)).toEqual({ time: 0.5, done: false });
    expect(pingPongAppendooTravelTime(900, 900, false)).toEqual({ time: 1, done: true });
    expect(pingPongAppendooTravelTime(1350, 900, true).time).toBeCloseTo(0.5, 5);
    expect(pingPongAppendooTravelTime(1350, 900, true).done).toBe(false);
  });
});
