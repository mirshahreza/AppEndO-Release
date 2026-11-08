import type { CSSProperties, ReactNode } from 'react';

export const SHELL_EFFECT_IDS = [
  'animated-gradient',
  'mesh-gradient',
  'aurora',
  'gradient-orbs',
  'floating-blobs',
  'flowing-waves',
  'light-rays',
  'conic-rays',
  'shimmer-bands',
  'film-grain',
  'particle-field',
  'starfield',
  'animated-dot-field',
  'perspective-grid',
  'floating-geometry',
  'image-depth-pan',
  'scroll-parallax',
  'pointer-parallax',
  'cursor-spotlight',
  'section-reveal',
] as const;

export type ShellEffectId = (typeof SHELL_EFFECT_IDS)[number];
export type ShellEffectCost = 'low' | 'medium' | 'high';
export type ShellEffectRuntimeEngine =
  | 'static'
  | 'css-svg'
  | 'orchestrated-dom'
  | 'canvas-2d';
export type ShellEffectAuthoringTier = 'core' | 'enhanced';
export type ShellViewport = 'desktop' | 'tablet' | 'phone';
export type ShellEffectTarget =
  | 'page'
  | 'header'
  | 'sidebar'
  | 'hero'
  | 'content-host'
  | 'aside'
  | 'footer'
  | 'mega-panel';
export type ShellEffectPlane = 'underlay' | 'background' | 'overlay';
export type ShellEffectFallback = 'runtime' | 'static' | 'simplified' | 'hidden';
export type ShellEffectInteraction = 'none' | 'scroll' | 'pointer';

export type ShellSemanticColor =
  | 'surface'
  | 'surface-elevated'
  | 'inverse-surface'
  | 'surface-foreground'
  | 'surface-muted'
  | 'neutral'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

export type ShellColorValue = {
  colorSpace: 'srgb' | 'display-p3' | 'oklch';
  components: [number, number, number];
  alpha: number;
  hex: `#${string}`;
};

export type ShellColorRef =
  | { source: 'semantic'; token: ShellSemanticColor }
  | { source: 'custom'; value: ShellColorValue };

export type ShellSemanticPalette = Readonly<Record<ShellSemanticColor, string>>;

export type ShellEffectLayerBase = {
  id: string;
  target: ShellEffectTarget;
  plane: ShellEffectPlane;
  palette: readonly ShellColorRef[];
  intensity: 'subtle' | 'soft' | 'medium' | 'strong';
  speed: 'still' | 'slow' | 'medium' | 'fast';
  density: 'sparse' | 'normal' | 'dense';
  scale: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  direction: 'forward' | 'reverse' | 'alternate';
  opacity: 'faint' | 'subtle' | 'visible' | 'strong';
  blend: 'normal' | 'multiply' | 'screen' | 'soft-light' | 'overlay';
  interaction: ShellEffectInteraction;
  seed: number;
  visibility: Readonly<Record<ShellViewport, boolean>>;
};

export type ShellEffectVariant =
  | { effectId: 'animated-gradient'; config: { angle: number; duration: number; stops: 2 | 3 | 4 } }
  | { effectId: 'mesh-gradient'; config: { points: number; morph: number; blur: number } }
  | { effectId: 'aurora'; config: { bands: number; spread: number; wave: number } }
  | { effectId: 'gradient-orbs'; config: { orbs: number; blur: number; drift: number } }
  | { effectId: 'floating-blobs'; config: { blobs: number; complexity: number; morph: number } }
  | { effectId: 'flowing-waves'; config: { waves: number; amplitude: number; frequency: number } }
  | { effectId: 'light-rays'; config: { rays: number; spread: number; rotation: number } }
  | { effectId: 'conic-rays'; config: { rays: number; rotation: number; softness: number } }
  | { effectId: 'shimmer-bands'; config: { bands: number; width: number; angle: number } }
  | { effectId: 'film-grain'; config: { grain: number; monochrome: boolean; frameRate: 6 | 12 | 24 } }
  | {
      effectId: 'particle-field';
      config: { count: number; size: number; drift: number; connections: boolean };
    }
  | { effectId: 'starfield'; config: { count: number; twinkle: number; depth: number } }
  | { effectId: 'animated-dot-field'; config: { count: number; size: number; pulse: number } }
  | {
      effectId: 'perspective-grid';
      config: { spacing: number; perspective: number; horizon: number };
    }
  | {
      effectId: 'floating-geometry';
      config: { shapes: number; rotation: number; drift: number };
    }
  | {
      effectId: 'image-depth-pan';
      config: { assetRef: string; zoom: number; pan: number; focalX: number; focalY: number };
    }
  | {
      effectId: 'scroll-parallax';
      config: { layers: number; depth: number; axis: 'x' | 'y' | 'both'; range: number };
    }
  | {
      effectId: 'pointer-parallax';
      config: { layers: number; depth: number; lag: number; range: number };
    }
  | {
      effectId: 'cursor-spotlight';
      config: { radius: number; softness: number; lag: number };
    }
  | {
      effectId: 'section-reveal';
      config: {
        style: 'fade' | 'slide' | 'scale' | 'mask';
        distance: number;
        stagger: number;
        threshold: 0.1 | 0.25 | 0.5 | 0.75;
        once: boolean;
      };
    };

export type ShellEffectLayerConfig = ShellEffectLayerBase & ShellEffectVariant;

export type ShellEffectStackConfig = {
  layers: readonly ShellEffectLayerConfig[];
  isolation?: boolean;
  overflow?: 'clip' | 'visible';
  reducedMotionFallback?: Exclude<ShellEffectFallback, 'runtime'>;
};

export type ShellEffectPreset = {
  id: `subtle-${ShellEffectId}` | `expressive-${ShellEffectId}`;
  label: string;
  effectId: ShellEffectId;
  layer: Omit<ShellEffectLayerConfig, 'id' | 'target' | 'plane'>;
};

export type ShellEffectMeta = {
  id: ShellEffectId;
  componentName: string;
  runtimeEngine: ShellEffectRuntimeEngine;
  costTier: ShellEffectCost;
  authoringTier: ShellEffectAuthoringTier;
  loadRule: 'base' | 'feature-lazy' | 'visible-opt-in';
  fallbackRenderer: 'static' | 'simplified' | 'hidden';
  /** @deprecated Use costTier. Retained for existing consumers. */
  cost: ShellEffectCost;
  targets: readonly ShellEffectTarget[];
  reducedMotion: Exclude<ShellEffectFallback, 'runtime'>;
};

export type ShellEffectRuntimeContext = {
  fallback: ShellEffectFallback;
  paused: boolean;
  palette: readonly string[];
  progress: number;
  pointer: { x: number; y: number };
};

export type ShellEffectRendererProps = {
  layer: ShellEffectLayerConfig;
  runtime: ShellEffectRuntimeContext;
};

export type ShellEffectLayerProps = {
  layer: ShellEffectLayerConfig;
  viewport?: ShellViewport;
  fallback?: ShellEffectFallback;
  reducedMotionFallback?: Exclude<ShellEffectFallback, 'runtime'>;
  paused?: boolean;
  semanticPalette?: Partial<ShellSemanticPalette>;
  className?: string;
  style?: CSSProperties;
};

export type ShellEffectStackProps = Omit<ShellEffectStackConfig, 'layers'> & {
  layers: readonly ShellEffectLayerConfig[];
  target?: ShellEffectTarget;
  viewport?: ShellViewport;
  fallback?: ShellEffectFallback;
  paused?: boolean;
  semanticPalette?: Partial<ShellSemanticPalette>;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

