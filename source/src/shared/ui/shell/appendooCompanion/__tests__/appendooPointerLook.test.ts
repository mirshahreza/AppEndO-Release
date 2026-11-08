import { describe, expect, it } from 'vitest';
import { resolveAppendooAccessoryMood } from '../appendooAccessories';
import {
  applyAppendooPointerLookToMood,
  resolveAppendooPointerLook,
} from '../appendooPointerLook';

describe('appendooPointerLook', () => {
  it('looks toward the pointer and clamps the range', () => {
    const right = resolveAppendooPointerLook(140, 50, { x: 50, y: 50 });
    const up = resolveAppendooPointerLook(50, 0, { x: 50, y: 50 });
    const far = resolveAppendooPointerLook(400, 50, { x: 50, y: 50 });

    expect(right.lookX).toBeGreaterThan(0);
    expect(up.lookY).toBeLessThan(0);
    expect(far.lookX).toBe(1);
  });

  it('leans accessories toward the pointer when follow is on', () => {
    const rest = resolveAppendooAccessoryMood('neutral');
    const leaned = applyAppendooPointerLookToMood(rest, { lookX: 1, lookY: -0.5 });
    expect(leaned.hat.tilt).toBeGreaterThan(rest.hat.tilt);
    expect(leaned.glasses.shiftX).toBeGreaterThan(rest.glasses.shiftX);
    expect(leaned.hat.lift).toBeGreaterThan(rest.hat.lift);
  });
});
