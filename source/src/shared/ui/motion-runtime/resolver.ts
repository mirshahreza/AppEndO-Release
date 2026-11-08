import { APP_CREATIVE_MOTION_ALLOWLIST, CREATIVE_MOTION_CATALOG } from './catalog';
import type {
  CreativeMotionDecision,
  CreativeMotionEnvironment,
  CreativeMotionId,
} from './types';

const PHONE_FALLBACK_IDS: ReadonlySet<CreativeMotionId> = new Set([
  'pointer-tilt',
  'pointer-attract',
  'scroll-parallax-layers',
  'scene-scrub',
  'scene-camera-path',
  'scene-orbit',
  'scene-object-focus',
]);

const REDUCED_DATA_IDS: ReadonlySet<CreativeMotionId> = new Set([
  'track-marquee',
  'scroll-parallax-layers',
  'scene-scrub',
  'scene-camera-path',
  'scene-orbit',
  'scene-object-focus',
]);

export function resolveCreativeMotion(
  id: CreativeMotionId,
  environment: CreativeMotionEnvironment,
): CreativeMotionDecision {
  const metadata = CREATIVE_MOTION_CATALOG[id];
  const fallback = metadata.reducedMotionFallback;
  const paused =
    environment.paused || environment.documentHidden || environment.offscreen;

  if (environment.experienceMode === 'app' && !APP_CREATIVE_MOTION_ALLOWLIST.has(id)) {
    return { id, mode: 'fallback', fallback, paused: true, reason: 'app-incompatible' };
  }
  if (environment.viewport === 'phone' && PHONE_FALLBACK_IDS.has(id)) {
    return { id, mode: 'fallback', fallback, paused: true, reason: 'phone-projection' };
  }
  if (environment.forcedColors) {
    return { id, mode: 'fallback', fallback, paused: true, reason: 'forced-colors' };
  }
  if (environment.reducedMotion) {
    return { id, mode: 'fallback', fallback, paused: true, reason: 'reduced-motion' };
  }
  if (environment.reducedData && REDUCED_DATA_IDS.has(id)) {
    return { id, mode: 'fallback', fallback, paused: true, reason: 'reduced-data' };
  }
  if (
    environment.coarsePointer
    && (id === 'pointer-tilt' || id === 'pointer-attract')
  ) {
    return { id, mode: 'fallback', fallback, paused: true, reason: 'coarse-pointer' };
  }
  return { id, mode: 'runtime', fallback, paused, reason: 'eligible' };
}
