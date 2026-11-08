import type {
  ShellColorRef,
  ShellEffectId,
  ShellEffectMeta,
  ShellEffectPreset,
  ShellEffectVariant,
  ShellSemanticPalette,
} from './types';
import { SHELL_EFFECT_IDS } from './types';

const ALL_TARGETS = [
  'page',
  'header',
  'sidebar',
  'hero',
  'content-host',
  'aside',
  'footer',
  'mega-panel',
] as const;

export const DEFAULT_SHELL_EFFECT_PALETTE: ShellSemanticPalette = {
  surface: '#ffffff',
  'surface-elevated': '#f8fafc',
  'inverse-surface': '#0f172a',
  'surface-foreground': '#334155',
  'surface-muted': '#cbd5e1',
  neutral: '#64748b',
  accent: '#0d9488',
  success: '#059669',
  warning: '#d97706',
  danger: '#e11d48',
  info: '#2563eb',
};

export const DEFAULT_EFFECT_COLOR_REFS = [
  { source: 'semantic', token: 'accent' },
  { source: 'semantic', token: 'neutral' },
] as const satisfies readonly ShellColorRef[];

export const SHELL_EFFECT_CATALOG: Readonly<Record<ShellEffectId, ShellEffectMeta>> = {
  'animated-gradient': {
    id: 'animated-gradient',
    componentName: 'AnimatedGradientEffect',
    runtimeEngine: 'css-svg', costTier: 'low', authoringTier: 'core', loadRule: 'base', fallbackRenderer: 'static',
    cost: 'low',
    targets: ALL_TARGETS,
    reducedMotion: 'static',
  },
  'mesh-gradient': {
    id: 'mesh-gradient',
    componentName: 'MeshGradientEffect',
    runtimeEngine: 'css-svg', costTier: 'medium', authoringTier: 'core', loadRule: 'base', fallbackRenderer: 'static',
    cost: 'medium',
    targets: ['page', 'hero', 'content-host', 'footer'],
    reducedMotion: 'static',
  },
  aurora: {
    id: 'aurora',
    componentName: 'AuroraEffect',
    runtimeEngine: 'css-svg', costTier: 'medium', authoringTier: 'core', loadRule: 'base', fallbackRenderer: 'static',
    cost: 'medium',
    targets: ['page', 'hero', 'header', 'footer'],
    reducedMotion: 'static',
  },
  'gradient-orbs': {
    id: 'gradient-orbs',
    componentName: 'GradientOrbsEffect',
    runtimeEngine: 'css-svg', costTier: 'low', authoringTier: 'core', loadRule: 'base', fallbackRenderer: 'static',
    cost: 'low',
    targets: ALL_TARGETS,
    reducedMotion: 'static',
  },
  'floating-blobs': {
    id: 'floating-blobs',
    componentName: 'FloatingBlobsEffect',
    runtimeEngine: 'css-svg', costTier: 'medium', authoringTier: 'core', loadRule: 'base', fallbackRenderer: 'static',
    cost: 'medium',
    targets: ['page', 'hero', 'content-host', 'footer'],
    reducedMotion: 'static',
  },
  'flowing-waves': {
    id: 'flowing-waves',
    componentName: 'FlowingWavesEffect',
    runtimeEngine: 'css-svg', costTier: 'medium', authoringTier: 'core', loadRule: 'base', fallbackRenderer: 'static',
    cost: 'medium',
    targets: ['page', 'hero', 'footer'],
    reducedMotion: 'static',
  },
  'light-rays': {
    id: 'light-rays',
    componentName: 'LightRaysEffect',
    runtimeEngine: 'css-svg', costTier: 'low', authoringTier: 'core', loadRule: 'base', fallbackRenderer: 'static',
    cost: 'low',
    targets: ['hero', 'header', 'page'],
    reducedMotion: 'static',
  },
  'conic-rays': {
    id: 'conic-rays',
    componentName: 'ConicRaysEffect',
    runtimeEngine: 'css-svg', costTier: 'low', authoringTier: 'core', loadRule: 'base', fallbackRenderer: 'static',
    cost: 'low',
    targets: ['hero', 'page', 'footer'],
    reducedMotion: 'static',
  },
  'shimmer-bands': {
    id: 'shimmer-bands',
    componentName: 'ShimmerBandsEffect',
    runtimeEngine: 'css-svg', costTier: 'low', authoringTier: 'core', loadRule: 'base', fallbackRenderer: 'hidden',
    cost: 'low',
    targets: ['header', 'hero', 'sidebar', 'footer'],
    reducedMotion: 'hidden',
  },
  'film-grain': {
    id: 'film-grain',
    componentName: 'FilmGrainEffect',
    runtimeEngine: 'css-svg', costTier: 'low', authoringTier: 'core', loadRule: 'base', fallbackRenderer: 'static',
    cost: 'low',
    targets: ALL_TARGETS,
    reducedMotion: 'static',
  },
  'particle-field': {
    id: 'particle-field',
    componentName: 'ParticleFieldEffect',
    runtimeEngine: 'canvas-2d', costTier: 'high', authoringTier: 'enhanced', loadRule: 'visible-opt-in', fallbackRenderer: 'static',
    cost: 'high',
    targets: ['page', 'hero', 'content-host'],
    reducedMotion: 'static',
  },
  starfield: {
    id: 'starfield',
    componentName: 'StarfieldEffect',
    runtimeEngine: 'canvas-2d', costTier: 'high', authoringTier: 'enhanced', loadRule: 'visible-opt-in', fallbackRenderer: 'static',
    cost: 'high',
    targets: ['page', 'hero'],
    reducedMotion: 'static',
  },
  'animated-dot-field': {
    id: 'animated-dot-field',
    componentName: 'AnimatedDotFieldEffect',
    runtimeEngine: 'css-svg', costTier: 'medium', authoringTier: 'core', loadRule: 'base', fallbackRenderer: 'static',
    cost: 'medium',
    targets: ALL_TARGETS,
    reducedMotion: 'static',
  },
  'perspective-grid': {
    id: 'perspective-grid',
    componentName: 'PerspectiveGridEffect',
    runtimeEngine: 'css-svg', costTier: 'medium', authoringTier: 'core', loadRule: 'base', fallbackRenderer: 'static',
    cost: 'medium',
    targets: ['page', 'hero', 'content-host'],
    reducedMotion: 'static',
  },
  'floating-geometry': {
    id: 'floating-geometry',
    componentName: 'FloatingGeometryEffect',
    runtimeEngine: 'css-svg', costTier: 'medium', authoringTier: 'core', loadRule: 'base', fallbackRenderer: 'static',
    cost: 'medium',
    targets: ['page', 'hero', 'content-host', 'footer'],
    reducedMotion: 'static',
  },
  'image-depth-pan': {
    id: 'image-depth-pan',
    componentName: 'ImageDepthPanEffect',
    runtimeEngine: 'orchestrated-dom', costTier: 'medium', authoringTier: 'enhanced', loadRule: 'feature-lazy', fallbackRenderer: 'static',
    cost: 'medium',
    targets: ['page', 'hero', 'content-host'],
    reducedMotion: 'static',
  },
  'scroll-parallax': {
    id: 'scroll-parallax',
    componentName: 'ScrollParallaxEffect',
    runtimeEngine: 'orchestrated-dom', costTier: 'high', authoringTier: 'enhanced', loadRule: 'visible-opt-in', fallbackRenderer: 'static',
    cost: 'high',
    targets: ['page', 'hero', 'content-host'],
    reducedMotion: 'static',
  },
  'pointer-parallax': {
    id: 'pointer-parallax',
    componentName: 'PointerParallaxEffect',
    runtimeEngine: 'orchestrated-dom', costTier: 'medium', authoringTier: 'enhanced', loadRule: 'feature-lazy', fallbackRenderer: 'static',
    cost: 'medium',
    targets: ['hero', 'content-host', 'sidebar'],
    reducedMotion: 'static',
  },
  'cursor-spotlight': {
    id: 'cursor-spotlight',
    componentName: 'CursorSpotlightEffect',
    runtimeEngine: 'orchestrated-dom', costTier: 'medium', authoringTier: 'enhanced', loadRule: 'feature-lazy', fallbackRenderer: 'static',
    cost: 'medium',
    targets: ['page', 'header', 'sidebar', 'hero', 'content-host'],
    reducedMotion: 'static',
  },
  'section-reveal': {
    id: 'section-reveal',
    componentName: 'SectionRevealEffect',
    runtimeEngine: 'orchestrated-dom', costTier: 'low', authoringTier: 'enhanced', loadRule: 'feature-lazy', fallbackRenderer: 'simplified',
    cost: 'low',
    targets: ['hero', 'content-host', 'aside', 'footer'],
    reducedMotion: 'simplified',
  },
};

const FIXTURE_ASSET =
  '/assets/workspace/c6209123bc7fe941c7dff953e6c35f232ff69336f7409566d6d14b769793120f.svg';

const PRESET_VARIANTS: readonly (readonly [ShellEffectVariant, ShellEffectVariant])[] = [
  [
    { effectId: 'animated-gradient', config: { angle: 135, duration: 32, stops: 2 } },
    { effectId: 'animated-gradient', config: { angle: 225, duration: 16, stops: 4 } },
  ],
  [
    { effectId: 'mesh-gradient', config: { points: 4, morph: 30, blur: 48 } },
    { effectId: 'mesh-gradient', config: { points: 7, morph: 70, blur: 72 } },
  ],
  [
    { effectId: 'aurora', config: { bands: 2, spread: 40, wave: 30 } },
    { effectId: 'aurora', config: { bands: 4, spread: 80, wave: 70 } },
  ],
  [
    { effectId: 'gradient-orbs', config: { orbs: 2, blur: 48, drift: 30 } },
    { effectId: 'gradient-orbs', config: { orbs: 5, blur: 80, drift: 70 } },
  ],
  [
    { effectId: 'floating-blobs', config: { blobs: 2, complexity: 4, morph: 30 } },
    { effectId: 'floating-blobs', config: { blobs: 5, complexity: 7, morph: 70 } },
  ],
  [
    { effectId: 'flowing-waves', config: { waves: 2, amplitude: 16, frequency: 2 } },
    { effectId: 'flowing-waves', config: { waves: 6, amplitude: 48, frequency: 6 } },
  ],
  [
    { effectId: 'light-rays', config: { rays: 4, spread: 40, rotation: 45 } },
    { effectId: 'light-rays', config: { rays: 10, spread: 100, rotation: 225 } },
  ],
  [
    { effectId: 'conic-rays', config: { rays: 8, rotation: 45, softness: 40 } },
    { effectId: 'conic-rays', config: { rays: 20, rotation: 225, softness: 70 } },
  ],
  [
    { effectId: 'shimmer-bands', config: { bands: 1, width: 12, angle: 45 } },
    { effectId: 'shimmer-bands', config: { bands: 4, width: 32, angle: 315 } },
  ],
  [
    { effectId: 'film-grain', config: { grain: 20, monochrome: true, frameRate: 6 } },
    { effectId: 'film-grain', config: { grain: 65, monochrome: false, frameRate: 12 } },
  ],
  [
    {
      effectId: 'particle-field',
      config: { count: 30, size: 2, drift: 20, connections: false },
    },
    {
      effectId: 'particle-field',
      config: { count: 90, size: 5, drift: 70, connections: true },
    },
  ],
  [
    { effectId: 'starfield', config: { count: 40, twinkle: 30, depth: 2 } },
    { effectId: 'starfield', config: { count: 110, twinkle: 80, depth: 5 } },
  ],
  [
    { effectId: 'animated-dot-field', config: { count: 30, size: 2, pulse: 30 } },
    { effectId: 'animated-dot-field', config: { count: 100, size: 6, pulse: 80 } },
  ],
  [
    {
      effectId: 'perspective-grid',
      config: { spacing: 48, perspective: 600, horizon: 50 },
    },
    {
      effectId: 'perspective-grid',
      config: { spacing: 16, perspective: 1000, horizon: 70 },
    },
  ],
  [
    { effectId: 'floating-geometry', config: { shapes: 3, rotation: 30, drift: 20 } },
    { effectId: 'floating-geometry', config: { shapes: 10, rotation: 80, drift: 70 } },
  ],
  [
    {
      effectId: 'image-depth-pan',
      config: { assetRef: FIXTURE_ASSET, zoom: 105, pan: 20, focalX: 50, focalY: 50 },
    },
    {
      effectId: 'image-depth-pan',
      config: { assetRef: FIXTURE_ASSET, zoom: 125, pan: 80, focalX: 50, focalY: 40 },
    },
  ],
  [
    { effectId: 'scroll-parallax', config: { layers: 2, depth: 2, axis: 'y', range: 30 } },
    {
      effectId: 'scroll-parallax',
      config: { layers: 5, depth: 5, axis: 'both', range: 80 },
    },
  ],
  [
    { effectId: 'pointer-parallax', config: { layers: 2, depth: 2, lag: 70, range: 8 } },
    {
      effectId: 'pointer-parallax',
      config: { layers: 5, depth: 5, lag: 20, range: 40 },
    },
  ],
  [
    { effectId: 'cursor-spotlight', config: { radius: 160, softness: 70, lag: 60 } },
    { effectId: 'cursor-spotlight', config: { radius: 320, softness: 35, lag: 15 } },
  ],
  [
    {
      effectId: 'section-reveal',
      config: { style: 'fade', distance: 16, stagger: 50, threshold: 0.25, once: true },
    },
    {
      effectId: 'section-reveal',
      config: { style: 'mask', distance: 56, stagger: 200, threshold: 0.5, once: true },
    },
  ],
];

function interactionFor(
  effectId: ShellEffectId,
  tone: 'subtle' | 'expressive',
): 'none' | 'scroll' | 'pointer' {
  if (
    effectId === 'scroll-parallax' ||
    effectId === 'section-reveal' ||
    (effectId === 'image-depth-pan' && tone === 'expressive')
  ) {
    return 'scroll';
  }
  if (effectId === 'pointer-parallax' || effectId === 'cursor-spotlight') return 'pointer';
  return 'none';
}

export const SHELL_EFFECT_PRESETS: readonly ShellEffectPreset[] = PRESET_VARIANTS.flatMap(
  ([subtle, expressive]) => {
    const makePreset = (
      tone: 'subtle' | 'expressive',
      variant: ShellEffectVariant,
      seed: number,
    ): ShellEffectPreset => ({
      id: `${tone}-${variant.effectId}`,
      label: `${tone === 'subtle' ? 'Subtle' : 'Expressive'} ${variant.effectId.replaceAll('-', ' ')}`,
      effectId: variant.effectId,
      layer: {
        ...variant,
        palette: DEFAULT_EFFECT_COLOR_REFS,
        intensity: tone === 'subtle' ? 'subtle' : 'medium',
        speed: tone === 'subtle' ? 'slow' : 'medium',
        density: tone === 'subtle' ? 'sparse' : 'normal',
        scale: tone === 'subtle' ? 'md' : 'lg',
        direction: 'forward',
        opacity: tone === 'subtle' ? 'faint' : 'visible',
        blend: 'normal',
        interaction: interactionFor(variant.effectId, tone),
        seed,
        visibility: { desktop: true, tablet: true, phone: true },
      },
    });
    return [makePreset('subtle', subtle, 11), makePreset('expressive', expressive, 29)];
  },
);

export const SHELL_EFFECT_PRESET_BY_ID = Object.fromEntries(
  SHELL_EFFECT_PRESETS.map((preset) => [preset.id, preset]),
) as Readonly<Record<ShellEffectPreset['id'], ShellEffectPreset>>;

export function getShellEffectPreset(
  effectId: ShellEffectId,
  tone: 'subtle' | 'expressive' = 'subtle',
): ShellEffectPreset {
  return SHELL_EFFECT_PRESET_BY_ID[`${tone}-${effectId}`];
}

if (PRESET_VARIANTS.length !== SHELL_EFFECT_IDS.length) {
  throw new Error('Shell effect preset catalog must cover every effect ID.');
}

