import { describe, expect, it } from 'vitest';
import { resolveAppendooBrowGeometry } from '../appendooFaceGeometry';
import { APPENDOO_DEFAULT_RIG, resolveAppendooFaceRig } from '../appendooFaceRig';

describe('appendooFaceRig', () => {
  it('keeps anger inner brows lower than surprise and knits fear while raising it', () => {
    const anger = resolveAppendooFaceRig({ emotion: 'anger' });
    const surprise = resolveAppendooFaceRig({ emotion: 'surprise' });
    const fear = resolveAppendooFaceRig({ emotion: 'fear' });
    const joy = resolveAppendooFaceRig({ emotion: 'joy' });

    expect(anger.browInnerY).toBeLessThan(surprise.browInnerY);
    expect(surprise.browKnit).toBe(0);
    expect(fear.browKnit).toBeGreaterThan(0.5);
    expect(fear.browInnerY).toBeGreaterThan(0.5);
    expect(joy.mouthCurve).toBeGreaterThan(0.7);
    expect(joy.cheekRaise).toBeGreaterThan(0.5);
  });

  it('closes both eyes when blinking and clamps playground overrides', () => {
    const blink = resolveAppendooFaceRig({ emotion: 'surprise', blinking: true });
    const clamped = resolveAppendooFaceRig({
      emotion: 'neutral',
      override: { browKnit: 4, lookX: 8, blush: -2 },
    });

    expect(blink.eyeOpen).toBeLessThan(0.2);
    expect(blink.winkLeft).toBe(1);
    expect(blink.winkRight).toBe(1);
    expect(clamped.browKnit).toBe(1);
    expect(clamped.lookX).toBe(1);
    expect(clamped.blush).toBe(0);
  });
});

describe('appendooFaceGeometry', () => {
  it('pulls inner brows toward the center when knit increases', () => {
    const rest = resolveAppendooBrowGeometry(APPENDOO_DEFAULT_RIG, 'left');
    const knit = resolveAppendooBrowGeometry({ ...APPENDOO_DEFAULT_RIG, browKnit: 1 }, 'left');
    expect(knit.innerX).toBeGreaterThan(rest.innerX);
  });

  it('raises the right brow when asymmetry is positive', () => {
    const rig = { ...APPENDOO_DEFAULT_RIG, browAsym: 0.8 };
    const left = resolveAppendooBrowGeometry(rig, 'left');
    const right = resolveAppendooBrowGeometry(rig, 'right');
    expect(right.innerY).toBeLessThan(left.innerY);
  });
});
