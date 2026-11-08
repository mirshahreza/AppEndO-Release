import type { CSSProperties, ElementType, ReactNode } from 'react';

export const CREATIVE_MOTION_IDS = [
  'reveal-fade',
  'reveal-slide',
  'reveal-scale',
  'reveal-mask',
  'reveal-stagger',
  'metric-count-up',
  'hover-lift',
  'pointer-tilt',
  'pointer-attract',
  'track-marquee',
  'scroll-progress',
  'scroll-parallax-layers',
  'sticky-chapter',
  'scene-scrub',
  'scene-camera-path',
  'scene-orbit',
  'scene-object-focus',
  'route-crossfade',
] as const;

export type CreativeMotionId = (typeof CREATIVE_MOTION_IDS)[number];
export type RuntimeEngine =
  | 'static'
  | 'css-svg'
  | 'orchestrated-dom'
  | 'canvas-2d'
  | 'webgl-three';
export type CostTier = 'low' | 'medium' | 'high' | 'extreme';
export type AuthoringTier = 'core' | 'enhanced' | 'advanced';
export type CreativeMotionViewport = 'desktop' | 'tablet' | 'phone';
export type CreativeMotionExperience = 'site' | 'app';
export type CreativeMotionIntensity = 'subtle' | 'standard' | 'expressive';
export type CreativeMotionFallback =
  | 'immediately-visible'
  | 'fade-only'
  | 'simultaneous-fade'
  | 'final-value'
  | 'depth-cue-only'
  | 'neutral-transform'
  | 'normal-hit-target'
  | 'wrapped-static-list'
  | 'static-progress'
  | 'zero-depth-layers'
  | 'normal-document-flow'
  | 'semantic-keyframe-poster'
  | 'poster-or-fixed-camera'
  | 'fixed-canonical-angle'
  | 'instant-state-change'
  | 'instant-route-swap';
export type CreativeMotionTrigger =
  | 'in-view'
  | 'hover/focus'
  | 'fine-pointer'
  | 'time'
  | 'scroll'
  | 'scroll/time'
  | 'drag/time'
  | 'click/focus'
  | 'route';
export type CreativeMotionExecutionEngine =
  | 'CSS/WAAPI'
  | 'CSS/SVG'
  | 'WAAPI/Motion'
  | 'rAF/Motion'
  | 'rAF'
  | 'ScrollTimeline/Motion'
  | 'ScrollTimeline/rAF'
  | 'CSS/IO'
  | 'Motion/engine bridge'
  | 'Three timeline'
  | 'Three/rAF'
  | 'Three/Motion'
  | 'View Transition/WAAPI';

export type CreativeMotionMetadata = Readonly<{
  id: CreativeMotionId;
  executionEngine: CreativeMotionExecutionEngine;
  runtimeEngine: RuntimeEngine;
  costTier: CostTier;
  authoringTier: AuthoringTier;
  trigger: CreativeMotionTrigger;
  reducedMotionFallback: CreativeMotionFallback;
  appCompatible: boolean;
}>;

type RevealBase = {
  durationMs?: number;
  delayMs?: number;
  threshold?: number;
  once?: boolean;
};

export type CreativeMotionConfig =
  | ({ id: 'reveal-fade' } & RevealBase)
  | ({ id: 'reveal-slide'; distancePx?: number; axis?: 'x' | 'y'; direction?: -1 | 1 } & RevealBase)
  | ({ id: 'reveal-scale'; fromScale?: number } & RevealBase)
  | ({ id: 'reveal-mask'; direction?: 'top' | 'right' | 'bottom' | 'left' } & RevealBase)
  | ({ id: 'reveal-stagger'; itemCount: number; staggerMs?: number } & RevealBase)
  | { id: 'metric-count-up'; from?: number; to: number; durationMs?: number; decimals?: number }
  | { id: 'hover-lift'; distancePx?: number; durationMs?: number }
  | { id: 'pointer-tilt'; maxDegrees?: number; perspectivePx?: number; smoothing?: number }
  | { id: 'pointer-attract'; maxDistancePx?: number; smoothing?: number }
  | { id: 'track-marquee'; durationMs?: number; direction?: -1 | 1 }
  | { id: 'scroll-progress'; axis?: 'x' | 'y' }
  | { id: 'scroll-parallax-layers'; depthPx?: number; layerCount: number }
  | { id: 'sticky-chapter'; topPx?: number }
  | { id: 'scene-scrub'; start?: number; end?: number }
  | { id: 'scene-camera-path'; durationMs?: number; mode?: 'scroll' | 'time' }
  | { id: 'scene-orbit'; durationMs?: number; interaction?: 'drag' | 'time' }
  | { id: 'scene-object-focus'; stateCount: number; initialState?: number }
  | { id: 'route-crossfade'; durationMs?: number };

export type CreativeMotionEnvironment = Readonly<{
  experienceMode: CreativeMotionExperience;
  viewport: CreativeMotionViewport;
  reducedMotion: boolean;
  reducedData: boolean;
  coarsePointer: boolean;
  documentHidden: boolean;
  offscreen: boolean;
  paused: boolean;
  forcedColors?: boolean;
}>;

export type CreativeMotionDecision = Readonly<{
  id: CreativeMotionId;
  mode: 'runtime' | 'fallback';
  fallback: CreativeMotionFallback;
  paused: boolean;
  reason:
    | 'eligible'
    | 'app-incompatible'
    | 'phone-projection'
    | 'reduced-motion'
    | 'reduced-data'
    | 'coarse-pointer'
    | 'forced-colors';
}>;

export type CreativeMotionProviderProps = {
  children: ReactNode;
  experienceMode?: CreativeMotionExperience;
  viewport?: CreativeMotionViewport;
  paused?: boolean;
};

export type CreativeMotionTargetProps<T extends ElementType = 'div'> = {
  as?: T;
  config: CreativeMotionConfig;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onDecision?: (decision: CreativeMotionDecision) => void;
};
