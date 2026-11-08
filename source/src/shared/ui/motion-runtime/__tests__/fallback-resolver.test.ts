import { describe, expect, it } from 'vitest';
import { resolveCreativeMotion } from '../resolver';
import type { CreativeMotionEnvironment } from '../types';

const environment: CreativeMotionEnvironment = {
  experienceMode: 'site',
  viewport: 'desktop',
  reducedMotion: false,
  reducedData: false,
  coarsePointer: false,
  documentHidden: false,
  offscreen: false,
  paused: false,
  forcedColors: false,
};

describe('creative motion fallback resolver', () => {
  it.each([
    ['reduced motion', 'reveal-slide', { reducedMotion: true }, 'reduced-motion'],
    ['Save-Data', 'track-marquee', { reducedData: true }, 'reduced-data'],
    ['coarse pointer', 'pointer-tilt', { coarsePointer: true }, 'coarse-pointer'],
    ['phone', 'scene-camera-path', { viewport: 'phone' }, 'phone-projection'],
    ['forced colors', 'hover-lift', { forcedColors: true }, 'forced-colors'],
  ] as const)('projects %s to a semantic fallback', (_label, id, override, reason) => {
    expect(resolveCreativeMotion(id, { ...environment, ...override })).toMatchObject({
      mode: 'fallback',
      paused: true,
      reason,
    });
  });

  it.each([
    ['document-hidden', { documentHidden: true }],
    ['offscreen', { offscreen: true }],
    ['user-paused', { paused: true }],
  ] as const)('pauses eligible runtime work while %s', (_label, override) => {
    expect(resolveCreativeMotion('reveal-fade', { ...environment, ...override })).toEqual({
      id: 'reveal-fade',
      mode: 'runtime',
      fallback: 'immediately-visible',
      paused: true,
      reason: 'eligible',
    });
  });

  it('keeps non-pointer keyboard behavior eligible on coarse pointers', () => {
    expect(resolveCreativeMotion('hover-lift', {
      ...environment,
      coarsePointer: true,
    })).toMatchObject({ mode: 'runtime', paused: false });
  });
});
