import { describe, expect, it } from 'vitest';
import {
  APP_CREATIVE_MOTION_ALLOWLIST,
  CREATIVE_MOTION_CATALOG,
  CREATIVE_MOTION_IDS,
  isValidRuntimeTuple,
  resolveCreativeMotion,
  validateCreativeMotionConfig,
  validateCreativeMotionMetadata,
} from '..';
import type {
  CreativeMotionConfig,
  CreativeMotionEnvironment,
  CreativeMotionId,
} from '..';

const VALID_CONFIGS: Readonly<Record<CreativeMotionId, CreativeMotionConfig>> = {
  'reveal-fade': { id: 'reveal-fade' },
  'reveal-slide': { id: 'reveal-slide', axis: 'y', distancePx: 24 },
  'reveal-scale': { id: 'reveal-scale', fromScale: 0.94 },
  'reveal-mask': { id: 'reveal-mask', direction: 'bottom' },
  'reveal-stagger': { id: 'reveal-stagger', itemCount: 4, staggerMs: 60 },
  'metric-count-up': { id: 'metric-count-up', to: 42, decimals: 0 },
  'hover-lift': { id: 'hover-lift', distancePx: 6 },
  'pointer-tilt': { id: 'pointer-tilt', maxDegrees: 8 },
  'pointer-attract': { id: 'pointer-attract', maxDistancePx: 12 },
  'track-marquee': { id: 'track-marquee', durationMs: 12_000 },
  'scroll-progress': { id: 'scroll-progress', axis: 'x' },
  'scroll-parallax-layers': { id: 'scroll-parallax-layers', layerCount: 3 },
  'sticky-chapter': { id: 'sticky-chapter', topPx: 16 },
  'scene-scrub': { id: 'scene-scrub', start: 0.1, end: 0.9 },
  'scene-camera-path': { id: 'scene-camera-path', mode: 'scroll' },
  'scene-orbit': { id: 'scene-orbit', interaction: 'drag' },
  'scene-object-focus': { id: 'scene-object-focus', stateCount: 3 },
  'route-crossfade': { id: 'route-crossfade', durationMs: 220 },
};

const ENVIRONMENT: CreativeMotionEnvironment = {
  experienceMode: 'site',
  viewport: 'desktop',
  reducedMotion: false,
  reducedData: false,
  coarsePointer: false,
  documentHidden: false,
  offscreen: false,
  paused: false,
};

describe('creative motion frozen catalog', () => {
  it('contains exactly the p-80 section 6B IDs in order', () => {
    expect(Object.keys(CREATIVE_MOTION_CATALOG)).toEqual(CREATIVE_MOTION_IDS);
    expect(CREATIVE_MOTION_IDS).toHaveLength(18);
  });

  it.each(CREATIVE_MOTION_IDS)('%s has a strict valid config and metadata tuple', (id) => {
    expect(validateCreativeMotionConfig(VALID_CONFIGS[id])).toEqual({
      valid: true,
      config: VALID_CONFIGS[id],
    });
    expect(validateCreativeMotionMetadata(CREATIVE_MOTION_CATALOG[id])).toEqual([]);
    const metadata = CREATIVE_MOTION_CATALOG[id];
    expect(
      isValidRuntimeTuple(metadata.runtimeEngine, metadata.costTier, metadata.authoringTier),
    ).toBe(true);
  });

  it('rejects unknown fields, unregistered IDs, invalid bounds and cross-field ranges', () => {
    expect(validateCreativeMotionConfig({ id: 'reveal-fade', selector: '.unsafe' }).valid).toBe(false);
    expect(validateCreativeMotionConfig({ id: 'custom-keyframes', keyframes: [] }).valid).toBe(false);
    expect(validateCreativeMotionConfig({ id: 'pointer-tilt', maxDegrees: 19 }).valid).toBe(false);
    expect(validateCreativeMotionConfig({ id: 'scene-scrub', start: 0.8, end: 0.2 }).valid).toBe(false);
  });

  it('uses the exact app allowlist and deterministic app fallbacks', () => {
    const expected = CREATIVE_MOTION_IDS.filter((id) => CREATIVE_MOTION_CATALOG[id].appCompatible);
    expect([...APP_CREATIVE_MOTION_ALLOWLIST]).toEqual(expected);
    for (const id of CREATIVE_MOTION_IDS) {
      const decision = resolveCreativeMotion(id, { ...ENVIRONMENT, experienceMode: 'app' });
      expect(decision.mode).toBe(APP_CREATIVE_MOTION_ALLOWLIST.has(id) ? 'runtime' : 'fallback');
    }
  });

  it('forces the frozen phone projections independent of OS preference', () => {
    const projected: CreativeMotionId[] = [
      'pointer-tilt',
      'pointer-attract',
      'scroll-parallax-layers',
      'scene-scrub',
      'scene-camera-path',
      'scene-orbit',
      'scene-object-focus',
    ];
    for (const id of projected) {
      expect(resolveCreativeMotion(id, { ...ENVIRONMENT, viewport: 'phone' })).toMatchObject({
        mode: 'fallback',
        reason: 'phone-projection',
        fallback: CREATIVE_MOTION_CATALOG[id].reducedMotionFallback,
      });
    }
    expect(resolveCreativeMotion('reveal-fade', { ...ENVIRONMENT, viewport: 'phone' }).mode).toBe(
      'runtime',
    );
  });

  it('pauses hidden/offscreen runtime without changing its deterministic projection', () => {
    expect(resolveCreativeMotion('track-marquee', { ...ENVIRONMENT, offscreen: true })).toMatchObject({
      mode: 'runtime',
      paused: true,
      reason: 'eligible',
    });
    expect(resolveCreativeMotion('scene-orbit', { ...ENVIRONMENT, reducedData: true })).toMatchObject({
      mode: 'fallback',
      reason: 'reduced-data',
      fallback: 'fixed-canonical-angle',
    });
  });
});
