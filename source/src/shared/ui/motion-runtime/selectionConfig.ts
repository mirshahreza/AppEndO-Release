import type { CreativeMotionConfig, CreativeMotionId } from './types';

export type CreativeMotionSelection = {
  motionId: CreativeMotionId;
  intensity: 'subtle' | 'standard' | 'expressive';
};

export function buildCreativeMotionSelectionConfig(
  selection: CreativeMotionSelection,
): CreativeMotionConfig {
  const durationMs = selection.intensity === 'subtle' ? 800 : selection.intensity === 'expressive' ? 260 : 480;
  switch (selection.motionId) {
    case 'reveal-fade': return { id: selection.motionId, durationMs };
    case 'reveal-slide': return { id: selection.motionId, durationMs, distancePx: selection.intensity === 'expressive' ? 48 : 20, axis: 'y', direction: 1 };
    case 'reveal-scale': return { id: selection.motionId, durationMs, fromScale: selection.intensity === 'expressive' ? 0.78 : 0.94 };
    case 'reveal-mask': return { id: selection.motionId, durationMs, direction: 'bottom' };
    case 'reveal-stagger': return { id: selection.motionId, durationMs, itemCount: 3, staggerMs: selection.intensity === 'subtle' ? 160 : 80 };
    case 'metric-count-up': return { id: selection.motionId, from: 0, to: 100, durationMs, decimals: 0 };
    case 'hover-lift': return { id: selection.motionId, distancePx: selection.intensity === 'expressive' ? 18 : 8, durationMs };
    case 'pointer-tilt': return { id: selection.motionId, maxDegrees: selection.intensity === 'expressive' ? 16 : 7, perspectivePx: 800, smoothing: 0.14 };
    case 'pointer-attract': return { id: selection.motionId, maxDistancePx: selection.intensity === 'expressive' ? 28 : 12, smoothing: 0.16 };
    case 'track-marquee': return { id: selection.motionId, durationMs: durationMs * 20, direction: 1 };
    case 'scroll-progress': return { id: selection.motionId, axis: 'x' };
    case 'scroll-parallax-layers': return { id: selection.motionId, depthPx: selection.intensity === 'expressive' ? 90 : 40, layerCount: 3 };
    case 'sticky-chapter': return { id: selection.motionId, topPx: 24 };
    case 'scene-scrub': return { id: selection.motionId, start: 0, end: 1 };
    case 'scene-camera-path': return { id: selection.motionId, durationMs: durationMs * 5, mode: 'time' };
    case 'scene-orbit': return { id: selection.motionId, durationMs: durationMs * 8, interaction: 'time' };
    case 'scene-object-focus': return { id: selection.motionId, stateCount: 3, initialState: 0 };
    case 'route-crossfade': return { id: selection.motionId, durationMs };
  }
}
