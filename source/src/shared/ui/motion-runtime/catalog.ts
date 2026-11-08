import type { CreativeMotionId, CreativeMotionMetadata } from './types';

const define = (metadata: CreativeMotionMetadata): CreativeMotionMetadata => Object.freeze(metadata);

export const CREATIVE_MOTION_CATALOG: Readonly<Record<CreativeMotionId, CreativeMotionMetadata>> =
  Object.freeze({
    'reveal-fade': define({
      id: 'reveal-fade', executionEngine: 'CSS/WAAPI', runtimeEngine: 'css-svg',
      costTier: 'low', authoringTier: 'core', trigger: 'in-view',
      reducedMotionFallback: 'immediately-visible', appCompatible: true,
    }),
    'reveal-slide': define({
      id: 'reveal-slide', executionEngine: 'CSS/WAAPI', runtimeEngine: 'css-svg',
      costTier: 'low', authoringTier: 'core', trigger: 'in-view',
      reducedMotionFallback: 'fade-only', appCompatible: true,
    }),
    'reveal-scale': define({
      id: 'reveal-scale', executionEngine: 'CSS/WAAPI', runtimeEngine: 'css-svg',
      costTier: 'low', authoringTier: 'core', trigger: 'in-view',
      reducedMotionFallback: 'fade-only', appCompatible: true,
    }),
    'reveal-mask': define({
      id: 'reveal-mask', executionEngine: 'CSS/SVG', runtimeEngine: 'css-svg',
      costTier: 'medium', authoringTier: 'core', trigger: 'in-view',
      reducedMotionFallback: 'immediately-visible', appCompatible: false,
    }),
    'reveal-stagger': define({
      id: 'reveal-stagger', executionEngine: 'WAAPI/Motion', runtimeEngine: 'orchestrated-dom',
      costTier: 'medium', authoringTier: 'enhanced', trigger: 'in-view',
      reducedMotionFallback: 'simultaneous-fade', appCompatible: true,
    }),
    'metric-count-up': define({
      id: 'metric-count-up', executionEngine: 'rAF/Motion', runtimeEngine: 'css-svg',
      costTier: 'low', authoringTier: 'core', trigger: 'in-view',
      reducedMotionFallback: 'final-value', appCompatible: true,
    }),
    'hover-lift': define({
      id: 'hover-lift', executionEngine: 'CSS/WAAPI', runtimeEngine: 'css-svg',
      costTier: 'low', authoringTier: 'core', trigger: 'hover/focus',
      reducedMotionFallback: 'depth-cue-only', appCompatible: true,
    }),
    'pointer-tilt': define({
      id: 'pointer-tilt', executionEngine: 'rAF', runtimeEngine: 'orchestrated-dom',
      costTier: 'medium', authoringTier: 'enhanced', trigger: 'fine-pointer',
      reducedMotionFallback: 'neutral-transform', appCompatible: false,
    }),
    'pointer-attract': define({
      id: 'pointer-attract', executionEngine: 'rAF', runtimeEngine: 'orchestrated-dom',
      costTier: 'medium', authoringTier: 'enhanced', trigger: 'fine-pointer',
      reducedMotionFallback: 'normal-hit-target', appCompatible: false,
    }),
    'track-marquee': define({
      id: 'track-marquee', executionEngine: 'CSS/WAAPI', runtimeEngine: 'css-svg',
      costTier: 'medium', authoringTier: 'core', trigger: 'time',
      reducedMotionFallback: 'wrapped-static-list', appCompatible: false,
    }),
    'scroll-progress': define({
      id: 'scroll-progress', executionEngine: 'ScrollTimeline/Motion', runtimeEngine: 'css-svg',
      costTier: 'low', authoringTier: 'core', trigger: 'scroll',
      reducedMotionFallback: 'static-progress', appCompatible: true,
    }),
    'scroll-parallax-layers': define({
      id: 'scroll-parallax-layers', executionEngine: 'ScrollTimeline/rAF',
      runtimeEngine: 'orchestrated-dom', costTier: 'high', authoringTier: 'enhanced',
      trigger: 'scroll', reducedMotionFallback: 'zero-depth-layers', appCompatible: false,
    }),
    'sticky-chapter': define({
      id: 'sticky-chapter', executionEngine: 'CSS/IO', runtimeEngine: 'css-svg',
      costTier: 'medium', authoringTier: 'core', trigger: 'scroll',
      reducedMotionFallback: 'normal-document-flow', appCompatible: true,
    }),
    'scene-scrub': define({
      id: 'scene-scrub', executionEngine: 'Motion/engine bridge', runtimeEngine: 'orchestrated-dom',
      costTier: 'high', authoringTier: 'enhanced', trigger: 'scroll',
      reducedMotionFallback: 'semantic-keyframe-poster', appCompatible: false,
    }),
    'scene-camera-path': define({
      id: 'scene-camera-path', executionEngine: 'Three timeline', runtimeEngine: 'webgl-three',
      costTier: 'high', authoringTier: 'advanced', trigger: 'scroll/time',
      reducedMotionFallback: 'poster-or-fixed-camera', appCompatible: false,
    }),
    'scene-orbit': define({
      id: 'scene-orbit', executionEngine: 'Three/rAF', runtimeEngine: 'webgl-three',
      costTier: 'high', authoringTier: 'advanced', trigger: 'drag/time',
      reducedMotionFallback: 'fixed-canonical-angle', appCompatible: false,
    }),
    'scene-object-focus': define({
      id: 'scene-object-focus', executionEngine: 'Three/Motion', runtimeEngine: 'webgl-three',
      costTier: 'high', authoringTier: 'advanced', trigger: 'click/focus',
      reducedMotionFallback: 'instant-state-change', appCompatible: false,
    }),
    'route-crossfade': define({
      id: 'route-crossfade', executionEngine: 'View Transition/WAAPI',
      runtimeEngine: 'orchestrated-dom', costTier: 'medium', authoringTier: 'enhanced',
      trigger: 'route', reducedMotionFallback: 'instant-route-swap', appCompatible: true,
    }),
  });

export const APP_CREATIVE_MOTION_ALLOWLIST = Object.freeze(
  new Set<CreativeMotionId>([
    'reveal-fade',
    'reveal-slide',
    'reveal-scale',
    'reveal-stagger',
    'metric-count-up',
    'hover-lift',
    'scroll-progress',
    'sticky-chapter',
    'route-crossfade',
  ]),
);
