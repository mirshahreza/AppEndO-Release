import { describe, expect, it } from 'vitest';
import {
  APPENDOO_DEFAULT_BODY,
  APPENDOO_SHAPE_IDS,
  appendooShapeShowsBody,
  isAppendooShapeId,
  mergeAppendooBodyRig,
  nearestAppendooSizeStep,
  nearestAppendooWonkStep,
  nextAppendooWonkSeed,
  pathFromAppendooSilhouettePoints,
  resolveAppendooBodyGeometry,
  resolveAppendooCompanionBox,
  resolveAppendooLeanPose,
  sampleAppendooSilhouetteLayers,
} from '../appendooBodyShape';

describe('appendooBodyShape', () => {
  it('builds a different silhouette for peach, blot, barbapapa, and bacteria', () => {
    const peach = resolveAppendooBodyGeometry({ ...APPENDOO_DEFAULT_BODY, shape: 'peach', bodyAsym: 0, rimAsym: 0 });
    const blot = resolveAppendooBodyGeometry({ ...APPENDOO_DEFAULT_BODY, shape: 'blot', bodyAsym: 0, rimAsym: 0 });
    const barbapapa = resolveAppendooBodyGeometry({ ...APPENDOO_DEFAULT_BODY, shape: 'barbapapa', bodyAsym: 0, rimAsym: 0 });
    const bacteria = resolveAppendooBodyGeometry({ ...APPENDOO_DEFAULT_BODY, shape: 'bacteria', bodyAsym: 0, rimAsym: 0 });

    expect(new Set([peach.bodyPath, blot.bodyPath, barbapapa.bodyPath, bacteria.bodyPath]).size).toBe(4);
    expect(peach.extras.map((extra) => extra.id)).toEqual(expect.arrayContaining(['peach-leaf', 'peach-stem', 'peach-cleft']));
    expect(blot.extras.map((extra) => extra.id)).toEqual(expect.arrayContaining(['blot-drip', 'blot-drop']));
    expect(blot.extras.some((extra) => extra.kind === 'leaf')).toBe(false);
    expect(barbapapa.extras.map((extra) => extra.id)).toEqual(expect.arrayContaining(['barbapapa-arm-left', 'barbapapa-arm-right']));
    expect(barbapapa.extras.some((extra) => extra.kind === 'leaf')).toBe(false);
    expect(barbapapa.extras.some((extra) => extra.id === 'barbapapa-head' || extra.id === 'barbapapa-neck')).toBe(false);
    expect(bacteria.extras.map((extra) => extra.id)).toEqual(expect.arrayContaining(['bacteria-antenna-left', 'bacteria-antenna-right']));
    expect(bacteria.extras.some((extra) => extra.kind === 'leaf')).toBe(false);
  });

  it('builds barbapapa as one tall pear, not a stacked head and belly', () => {
    const body = sampleAppendooSilhouetteLayers({
      ...APPENDOO_DEFAULT_BODY,
      shape: 'barbapapa',
      bodyAsym: 0,
    }).body;
    const xs = body.map((point) => point.x);
    const ys = body.map((point) => point.y);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const height = maxY - minY;
    const width = Math.max(...xs) - Math.min(...xs);
    expect(height).toBeGreaterThan(width * 1.12);
    expect(minY).toBeLessThan(22);
    expect(maxY).toBeGreaterThan(96);

    const widthAt = (frac: number) => {
      const y = minY + height * frac;
      const band = body.filter((point) => Math.abs(point.y - y) < 4);
      expect(band.length).toBeGreaterThan(1);
      return Math.max(...band.map((point) => point.x)) - Math.min(...band.map((point) => point.x));
    };
    expect(widthAt(0.22)).toBeLessThan(widthAt(0.78) * 0.92);
  });

  it('gives sponge pores and crab claws their telltale extras', () => {
    const sponge = resolveAppendooBodyGeometry({ ...APPENDOO_DEFAULT_BODY, shape: 'sponge' });
    const crab = resolveAppendooBodyGeometry({ ...APPENDOO_DEFAULT_BODY, shape: 'crab' });

    expect(sponge.extras.map((extra) => extra.id)).toEqual(expect.arrayContaining([
      'sponge-pore-a',
      'sponge-arm-left',
      'sponge-pants',
      'sponge-tie',
      'sponge-shoe-left',
    ]));
    expect(sponge.extras.some((extra) => extra.id === 'sponge-body' || extra.kind === 'leaf')).toBe(false);
    expect(crab.extras.map((extra) => extra.id)).toEqual(expect.arrayContaining(['crab-claw-left', 'crab-stalk-left']));
    expect(crab.extras.some((extra) => extra.kind === 'leaf')).toBe(false);
    expect(new Set([sponge.bodyPath, crab.bodyPath]).size).toBe(2);
  });

  it('builds sponge as a tall rounded kitchen sponge, not a puffy blob', () => {
    const body = sampleAppendooSilhouetteLayers({
      ...APPENDOO_DEFAULT_BODY,
      shape: 'sponge',
      bodyAsym: 0,
    }).body;
    const xs = body.map((point) => point.x);
    const ys = body.map((point) => point.y);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const height = maxY - minY;
    const width = Math.max(...xs) - Math.min(...xs);
    expect(height).toBeGreaterThan(width * 1.04);
    const widthAt = (frac: number) => {
      const y = minY + height * frac;
      const band = body.filter((point) => Math.abs(point.y - y) < 3.5);
      expect(band.length).toBeGreaterThan(1);
      return Math.max(...band.map((point) => point.x)) - Math.min(...band.map((point) => point.x));
    };
    expect(Math.abs(widthAt(0.28) - widthAt(0.55))).toBeLessThan(width * 0.2);
  });

  it('keeps the green leaf on peach only', () => {
    const peach = resolveAppendooBodyGeometry({ ...APPENDOO_DEFAULT_BODY, shape: 'peach' }).extras.find((extra) => extra.kind === 'leaf');
    expect(peach).toBeTruthy();
    const others = APPENDOO_SHAPE_IDS.filter((shape) => shape !== 'peach').map((shape) => (
      resolveAppendooBodyGeometry({ ...APPENDOO_DEFAULT_BODY, shape }).extras.some((extra) => extra.kind === 'leaf')
    ));
    expect(others.every((hasLeaf) => !hasLeaf)).toBe(true);
  });

  it('lets none drop the silhouette extras and the leaf', () => {
    const none = resolveAppendooBodyGeometry({ ...APPENDOO_DEFAULT_BODY, shape: 'none' });
    expect(appendooShapeShowsBody('none')).toBe(false);
    expect(appendooShapeShowsBody('peach')).toBe(true);
    expect(isAppendooShapeId('robot')).toBe(false);
    expect(none.extras).toEqual([]);
  });

  it('warps the rim away from the body when rim asymmetry and shift increase', () => {
    const rest = resolveAppendooBodyGeometry({
      ...APPENDOO_DEFAULT_BODY,
      bodyAsym: 0,
      rimAsym: 0,
      rimScale: 1,
      rimShiftX: 0,
      rimShiftY: 0,
    });
    const warped = resolveAppendooBodyGeometry({
      ...APPENDOO_DEFAULT_BODY,
      bodyAsym: 0,
      rimAsym: 1,
      rimScale: 1.12,
      rimShiftX: 0.8,
      rimShiftY: -0.5,
    });

    expect(rest.rimPath).not.toEqual(warped.rimPath);
    expect(rest.rimPath).not.toEqual(rest.bodyPath);
    expect(rest.innerTrimPath).not.toEqual(rest.bodyPath);
  });

  it('clamps playground rim values', () => {
    const rig = mergeAppendooBodyRig({ rimAsym: 8, rimWeight: 0, trimMotion: -2, rimScale: 4, size: 99 });
    expect(rig.rimAsym).toBe(1);
    expect(rig.rimWeight).toBe(0.4);
    expect(rig.trimMotion).toBe(0);
    expect(rig.rimScale).toBe(1.18);
    expect(rig.size).toBe(10);
    expect(mergeAppendooBodyRig({ wonk: 99 }).wonk).toBe(10);
  });

  it('maps size 1–10 from the old mid-range up, with 2 matching the 72×82 base', () => {
    expect(APPENDOO_DEFAULT_BODY.size).toBe(5);
    expect(resolveAppendooCompanionBox(1)).toEqual({ width: 57.6, height: 65.6 });
    expect(resolveAppendooCompanionBox(2)).toEqual({ width: 72, height: 82 });
    expect(resolveAppendooCompanionBox(10)).toEqual({ width: 187.2, height: 213.2 });
    expect(resolveAppendooCompanionBox(10).width).toBeGreaterThan(resolveAppendooCompanionBox(7).width);
    expect(nearestAppendooSizeStep(2)).toBe(2);
    expect(nearestAppendooSizeStep(10)).toBe(10);
    expect(nearestAppendooSizeStep(0.4)).toBe(1);
  });

  it('maps wonk 1–10 as edge mess, not a lean', () => {
    expect(APPENDOO_DEFAULT_BODY.wonk).toBe(1);
    expect(APPENDOO_DEFAULT_BODY.lean).toBe('none');
    expect(nearestAppendooWonkStep(0.4)).toBe(1);
    expect(nearestAppendooWonkStep(10)).toBe(10);
    const meanX = (points: readonly { x: number; y: number }[]) => (
      points.reduce((sum, point) => sum + point.x, 0) / points.length
    );
    const straight = resolveAppendooBodyGeometry({ ...APPENDOO_DEFAULT_BODY, wonk: 1, bodyAsym: 0 });
    const lopsided = resolveAppendooBodyGeometry({ ...APPENDOO_DEFAULT_BODY, wonk: 10, lean: 'none', bodyAsym: 0 });
    expect(straight.bodyPath).not.toEqual(lopsided.bodyPath);
    expect(lopsided.face.browAsym).toBeGreaterThan(straight.face.browAsym ?? 0);
    expect(lopsided.face.mouthAsym).toBeGreaterThan(straight.face.mouthAsym ?? 0);
    expect(Math.abs(
      meanX(sampleAppendooSilhouetteLayers({ ...APPENDOO_DEFAULT_BODY, wonk: 10, lean: 'none', bodyAsym: 0 }).body)
      - meanX(sampleAppendooSilhouetteLayers({ ...APPENDOO_DEFAULT_BODY, wonk: 1, lean: 'none', bodyAsym: 0 }).body),
    )).toBeLessThan(2);
  });

  it('leans left, right, both, or none without mixing into wonk', () => {
    expect(resolveAppendooLeanPose('none')).toEqual({ rotate: 0, sway: 0 });
    expect(resolveAppendooLeanPose('left')).toEqual({ rotate: -14, sway: 0 });
    expect(resolveAppendooLeanPose('right')).toEqual({ rotate: 14, sway: 0 });
    expect(resolveAppendooLeanPose('both')).toEqual({ rotate: 0, sway: 1 });
    const upright = resolveAppendooBodyGeometry({ ...APPENDOO_DEFAULT_BODY, wonk: 1, lean: 'none', bodyAsym: 0 });
    const both = resolveAppendooBodyGeometry({ ...APPENDOO_DEFAULT_BODY, wonk: 1, lean: 'both', bodyAsym: 0 });
    const right = resolveAppendooBodyGeometry({ ...APPENDOO_DEFAULT_BODY, wonk: 1, lean: 'right', bodyAsym: 0 });
    expect(both.bodyPath).not.toEqual(upright.bodyPath);
    expect(right.bodyPath).toEqual(upright.bodyPath);
    expect(mergeAppendooBodyRig({ lean: 'sideways' as never }).lean).toBe('none');
  });

  it('moves more silhouette points and can scatter them at random', () => {
    const radiusTurns = (points: readonly { x: number; y: number }[]): number => {
      const cx = points.reduce((sum, point) => sum + point.x, 0) / points.length;
      const cy = points.reduce((sum, point) => sum + point.y, 0) / points.length;
      const radii = points.map((point) => Math.hypot(point.x - cx, point.y - cy));
      const deltas = radii.map((radius, index) => radius - radii[(index + radii.length - 1) % radii.length]);
      return deltas.filter((delta, index) => delta * deltas[(index + deltas.length - 1) % deltas.length] < 0).length;
    };
    const rest = sampleAppendooSilhouetteLayers({ ...APPENDOO_DEFAULT_BODY, wonk: 1, bodyAsym: 0 });
    const ordered = sampleAppendooSilhouetteLayers({ ...APPENDOO_DEFAULT_BODY, wonk: 10, wonkScatter: false, bodyAsym: 0 });
    const scattered = sampleAppendooSilhouetteLayers({
      ...APPENDOO_DEFAULT_BODY,
      wonk: 10,
      wonkScatter: true,
      wonkSeed: 1,
      bodyAsym: 0,
    });
    const reshuffled = sampleAppendooSilhouetteLayers({
      ...APPENDOO_DEFAULT_BODY,
      wonk: 10,
      wonkScatter: true,
      wonkSeed: 2,
      bodyAsym: 0,
    });
    expect(radiusTurns(ordered.body)).toBeGreaterThan(radiusTurns(rest.body) + 6);
    expect(pathFromAppendooSilhouettePoints(scattered.body)).not.toEqual(pathFromAppendooSilhouettePoints(ordered.body));
    expect(pathFromAppendooSilhouettePoints(reshuffled.body)).not.toEqual(pathFromAppendooSilhouettePoints(scattered.body));
    expect(mergeAppendooBodyRig({ wonkScatter: true, wonkSeed: 0 }).wonkScatter).toBe(true);
    expect(nextAppendooWonkSeed(1)).toBe(2);
  });
});
