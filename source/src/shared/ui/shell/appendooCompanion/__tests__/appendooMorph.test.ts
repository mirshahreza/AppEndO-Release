import { describe, expect, it } from 'vitest';
import {
  APPENDOO_DEFAULT_BODY,
  pathFromAppendooSilhouettePoints,
  sampleAppendooSilhouetteLayers,
} from '../appendooBodyShape';
import {
  APPENDOO_DEFAULT_MORPH,
  APPENDOO_MORPH_TARGET_IDS,
  applyAppendooMorphEasing,
  easeAppendooMorph,
  mixAppendooMorphLayers,
  sampleAppendooMorphSourceLayers,
  sampleAppendooMorphTargetLayers,
  isAppendooMorphShapeTarget,
  isAppendooMorphTargetId,
} from '../appendooMorph';

describe('appendooMorph', () => {
  it('builds a distinct silhouette for each morph target', () => {
    const paths = APPENDOO_MORPH_TARGET_IDS.map((target) => (
      pathFromAppendooSilhouettePoints(sampleAppendooMorphTargetLayers(target, 7, APPENDOO_DEFAULT_BODY).body)
    ));
    expect(new Set(paths).size).toBe(APPENDOO_MORPH_TARGET_IDS.length);
  });

  it('starts at the current body and lands on the target', () => {
    const from = sampleAppendooSilhouetteLayers(APPENDOO_DEFAULT_BODY);
    const to = sampleAppendooMorphTargetLayers('question', 1, APPENDOO_DEFAULT_BODY);
    const start = mixAppendooMorphLayers(from, to, 0);
    const end = mixAppendooMorphLayers(from, to, 1);
    expect(pathFromAppendooSilhouettePoints(start.body)).toBe(pathFromAppendooSilhouettePoints(from.body));
    expect(pathFromAppendooSilhouettePoints(end.body)).toBe(pathFromAppendooSilhouettePoints(to.body));
    expect(pathFromAppendooSilhouettePoints(end.body)).not.toBe(pathFromAppendooSilhouettePoints(from.body));
  });

  it('builds a wide scalloped cloud with a crown above the cheeks', () => {
    const body = sampleAppendooMorphTargetLayers('cloud', 1, APPENDOO_DEFAULT_BODY).body;
    const top = body.reduce((best, point) => (point.y < best.y ? point : best));
    const left = body.reduce((best, point) => (point.x < best.x ? point : best));
    const right = body.reduce((best, point) => (point.x > best.x ? point : best));
    const width = right.x - left.x;
    const height = Math.max(...body.map((point) => point.y)) - top.y;
    expect(width).toBeGreaterThan(height * 1.2);
    expect(top.x).toBeGreaterThan(42);
    expect(top.x).toBeLessThan(58);
    expect(left.y).toBeGreaterThan(top.y + 14);
    expect(right.y).toBeGreaterThan(top.y + 14);
    const upper = [...body].filter((point) => point.y < top.y + height * 0.45).sort((a, b) => a.x - b.x);
    let puffs = 0;
    for (let index = 1; index < upper.length - 1; index += 1) {
      if (upper[index].y < upper[index - 1].y && upper[index].y < upper[index + 1].y) puffs += 1;
    }
    expect(puffs).toBeGreaterThanOrEqual(3);
  });

  it('changes the random blob when the seed changes', () => {
    const first = pathFromAppendooSilhouettePoints(sampleAppendooMorphTargetLayers('random', 3, APPENDOO_DEFAULT_BODY).body);
    const second = pathFromAppendooSilhouettePoints(sampleAppendooMorphTargetLayers('random', 9, APPENDOO_DEFAULT_BODY).body);
    expect(second).not.toBe(first);
  });

  it('lets the body melt from one character into another', () => {
    const sponge = { ...APPENDOO_DEFAULT_BODY, shape: 'sponge' as const };
    const from = sampleAppendooMorphSourceLayers(sponge);
    const to = sampleAppendooMorphTargetLayers('barbapapa', 1, sponge);
    const start = mixAppendooMorphLayers(from, to, 0);
    const end = mixAppendooMorphLayers(from, to, 1);
    expect(pathFromAppendooSilhouettePoints(start.body)).toBe(pathFromAppendooSilhouettePoints(from.body));
    expect(pathFromAppendooSilhouettePoints(end.body)).toBe(pathFromAppendooSilhouettePoints(to.body));
    expect(pathFromAppendooSilhouettePoints(end.body)).not.toBe(pathFromAppendooSilhouettePoints(from.body));
    expect(isAppendooMorphShapeTarget('barbapapa')).toBe(true);
    expect(isAppendooMorphShapeTarget('none')).toBe(false);
    expect(isAppendooMorphTargetId('sponge')).toBe(true);
  });

  it('lets easing change how far the mix has gone at the midpoint', () => {
    const linear = applyAppendooMorphEasing(APPENDOO_DEFAULT_MORPH, 'linear');
    const back = applyAppendooMorphEasing(APPENDOO_DEFAULT_MORPH, 'ease-out-back');
    expect(easeAppendooMorph(linear, 0.5)).toBeCloseTo(0.5, 2);
    expect(easeAppendooMorph(back, 0.5)).not.toBeCloseTo(0.5, 2);
  });
});
