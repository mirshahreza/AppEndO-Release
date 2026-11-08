import { describe, expect, it } from 'vitest';
import { APPENDOO_DEFAULT_BODY, resolveAppendooBodyGeometry } from '../appendooBodyShape';
import {
  applyAppendooEmotionRim,
  easeAppendooEmotionRim,
  lerpAppendooEmotionRim,
  resolveAppendooEmotionRim,
} from '../appendooEmotionRim';

describe('appendooEmotionRim', () => {
  it('leans the halo differently for joy, sadness, and anger', () => {
    const rest = resolveAppendooEmotionRim('neutral');
    const joy = resolveAppendooEmotionRim('joy');
    const sadness = resolveAppendooEmotionRim('sadness');
    const anger = resolveAppendooEmotionRim('anger');

    expect(joy.rimShiftY).toBeLessThan(rest.rimShiftY);
    expect(sadness.rimShiftY).toBeGreaterThan(rest.rimShiftY);
    expect(anger.rimAsym).toBeGreaterThan(rest.rimAsym);
    expect(joy.size).toBeGreaterThan(rest.size);
    expect(resolveAppendooEmotionRim('surprise').size).toBeGreaterThan(rest.size);
    expect(resolveAppendooEmotionRim('sleepy').size).toBeLessThan(rest.size);

    const peach = { ...APPENDOO_DEFAULT_BODY, shape: 'peach' as const, rimAsym: 0.2, rimShiftX: 0, rimShiftY: 0 };
    const joyApplied = applyAppendooEmotionRim(peach, 'joy');
    const surpriseApplied = applyAppendooEmotionRim(peach, 'surprise');
    const idleApplied = applyAppendooEmotionRim(peach, 'neutral');
    const joyPath = resolveAppendooBodyGeometry(joyApplied).rimPath;
    const sadPath = resolveAppendooBodyGeometry(applyAppendooEmotionRim(peach, 'sadness')).rimPath;
    const bodyPath = resolveAppendooBodyGeometry(joyApplied).bodyPath;
    const sadBody = resolveAppendooBodyGeometry(applyAppendooEmotionRim(peach, 'sadness')).bodyPath;

    expect(joyPath).not.toEqual(sadPath);
    expect(bodyPath).toEqual(sadBody);
    expect(surpriseApplied.size).toBeGreaterThan(idleApplied.size);
    expect(idleApplied.size).toBeLessThan(peach.size);
  });

  it('eases and lerps the rim overlay', () => {
    const from = resolveAppendooEmotionRim('neutral');
    const to = resolveAppendooEmotionRim('surprise');
    const mid = lerpAppendooEmotionRim(from, to, 0.5);

    expect(easeAppendooEmotionRim(0)).toBe(0);
    expect(easeAppendooEmotionRim(1)).toBe(1);
    expect(easeAppendooEmotionRim(0.5)).toBeGreaterThan(0.5);
    expect(mid.rimScale).toBeCloseTo((from.rimScale + to.rimScale) / 2, 5);
    expect(mid.rimShiftY).toBeCloseTo((from.rimShiftY + to.rimShiftY) / 2, 5);
    expect(mid.size).toBeCloseTo((from.size + to.size) / 2, 5);
  });
});
