import { describe, expect, it } from 'vitest';
import {
  APPENDOO_ACCESSORY_IDS,
  lerpAppendooAccessoryPose,
  resolveAppendooAccessoryMood,
  resolveAppendooAccessoryPaint,
  resolveAppendooAccessoryPose,
} from '../appendooAccessories';

describe('appendooAccessories', () => {
  it('lifts the hat and widens glasses on surprise and search faces', () => {
    const rest = resolveAppendooAccessoryMood('neutral');
    const surprise = resolveAppendooAccessoryMood('surprise');
    const curious = resolveAppendooAccessoryMood('curious');
    const thinking = resolveAppendooAccessoryMood('thinking');

    expect(APPENDOO_ACCESSORY_IDS).toEqual(['hat', 'glasses', 'headphones']);
    expect(surprise.hat.lift).toBeGreaterThan(rest.hat.lift);
    expect(curious.hat.lift).toBeGreaterThan(rest.hat.lift);
    expect(thinking.hat.lift).toBeGreaterThan(rest.hat.lift);
    expect(surprise.glasses.scale).toBeGreaterThan(rest.glasses.scale);
    expect(curious.glasses.scale).toBeGreaterThan(rest.glasses.scale);
    expect(thinking.glasses.scale).toBeGreaterThan(1);
  });

  it('slips sleepy accessories and tilts headphones on thinking', () => {
    const restHat = resolveAppendooAccessoryPose('hat', 'neutral');
    const sleepyHat = resolveAppendooAccessoryPose('hat', 'sleepy');
    const thinkingCans = resolveAppendooAccessoryPose('headphones', 'thinking');

    expect(sleepyHat.lift).toBeLessThan(restHat.lift);
    expect(Math.abs(sleepyHat.tilt)).toBeGreaterThan(Math.abs(restHat.tilt));
    expect(thinkingCans.tilt).not.toBe(0);
  });

  it('resolves a dedicated accessory paint apart from the body gel', () => {
    const cherry = resolveAppendooAccessoryPaint();
    const cobalt = resolveAppendooAccessoryPaint('cobalt');
    expect(cherry.id).toBe('cherry');
    expect(cobalt.mid).toBe('#3d7ee8');
    expect(cobalt.mid).not.toBe(cherry.mid);
  });

  it('lerps accessory poses', () => {
    const from = resolveAppendooAccessoryPose('glasses', 'neutral');
    const to = resolveAppendooAccessoryPose('glasses', 'surprise');
    const mid = lerpAppendooAccessoryPose(from, to, 0.5);
    expect(mid.scale).toBeCloseTo((from.scale + to.scale) / 2, 5);
  });
});
