import type { CSSProperties, ReactNode } from 'react';

export const CREATIVE_SCENE_IDS = [
  'scene-layered-hero',
  'scene-product-orbit',
  'scene-product-explode',
  'scene-editorial-chapters',
  'scene-spatial-gallery',
  'scene-data-constellation',
  'scene-globe-network',
  'scene-ambient-landscape',
  'scene-image-reveal-story',
  'scene-portal-tunnel',
  'scene-kinetic-cards',
  'scene-ambient-particles',
] as const;

export type CreativeSceneId = (typeof CREATIVE_SCENE_IDS)[number];
export type CreativeSceneExperience = 'site' | 'app';
export type CreativeSceneHostRegion = 'hero' | 'content-host' | 'aside' | 'footer';
export type CreativeScenePlane = 'background' | 'foreground';
export type CreativeScenePreset = 'calm' | 'balanced' | 'expressive';
export type CreativeSceneDensity = 'sparse' | 'normal' | 'dense';
export type CreativeSceneInteraction = 'none' | 'scroll' | 'focus' | 'orbit';
export type CreativeSceneRuntimeEngine =
  | 'static'
  | 'css-svg'
  | 'orchestrated-dom'
  | 'canvas-2d'
  | 'webgl-three';
export type CreativeSceneCostTier = 'low' | 'medium' | 'high' | 'extreme';
export type CreativeSceneAuthoringTier = 'core' | 'enhanced' | 'advanced';
export type CreativeSceneViewport = 'desktop' | 'tablet' | 'phone';

export type CreativeSceneAdvancedModuleId =
  | 'canvas-particle-system'
  | 'canvas-vector-field'
  | 'three-product-stage'
  | 'three-model-orbit'
  | 'three-spatial-gallery'
  | 'three-data-constellation'
  | 'shader-image-reveal'
  | 'shader-ambient-field';

export type CreativeSceneMotionId =
  | 'reveal-fade'
  | 'reveal-stagger'
  | 'hover-lift'
  | 'scroll-progress'
  | 'sticky-chapter'
  | 'scene-scrub'
  | 'scene-camera-path'
  | 'scene-orbit'
  | 'scene-object-focus';

export type CreativeSceneWidgetId =
  | 'landing-hero-centered'
  | 'landing-hero-split'
  | 'landing-hero-product-stage'
  | 'landing-stat-strip'
  | 'landing-feature-grid'
  | 'landing-bento-features'
  | 'landing-process-steps'
  | 'landing-media-gallery'
  | 'landing-timeline';

export type CreativeSceneFallbackId =
  | 'ordinary-centered-hero'
  | 'labeled-poster-callouts'
  | 'static-annotated-image'
  | 'linear-article-sections'
  | 'accessible-media-grid'
  | 'semantic-list-stat-grid'
  | 'labeled-map-poster-list'
  | 'css-gradient-svg-field'
  | 'normal-images-fade'
  | 'linear-chapter-stack'
  | 'bento-grid'
  | 'static-seeded-svg-dots';

export type CreativeSceneFallbackReason =
  | 'none'
  | 'requested'
  | 'server'
  | 'print'
  | 'test'
  | 'forced-colors'
  | 'reduced-motion'
  | 'reduced-data'
  | 'phone'
  | 'offscreen'
  | 'engine-unavailable'
  | 'budget';

export type CreativeSceneAction = {
  id: string;
  label: string;
  href: `/${string}` | `#${string}`;
};

export type CreativeSceneItem = {
  id: string;
  title: string;
  description: string;
  value?: string;
  assetRef?: string;
  x?: number;
  y?: number;
};

export type CreativeSceneContent = {
  eyebrow?: string;
  heading: string;
  body: string;
  posterAsset?: string;
  items: readonly CreativeSceneItem[];
  actions: readonly CreativeSceneAction[];
};

type CreativeSceneCommon = {
  instanceId: string;
  experienceMode: CreativeSceneExperience;
  host: CreativeSceneHostRegion;
  plane: CreativeScenePlane;
  preset: CreativeScenePreset;
  palette: readonly CreativeSceneSemanticColor[];
  density: CreativeSceneDensity;
  seed: number;
  fallbackAsset?: string;
  content: CreativeSceneContent;
};

type CreativeSceneVariant<
  Id extends CreativeSceneId,
  Interaction extends CreativeSceneInteraction,
> = CreativeSceneCommon & {
  sceneId: Id;
  interaction: Interaction;
};

export type CreativeSceneConfig =
  | CreativeSceneVariant<'scene-layered-hero', 'none'>
  | CreativeSceneVariant<'scene-product-orbit', 'orbit'>
  | CreativeSceneVariant<'scene-product-explode', 'focus'>
  | CreativeSceneVariant<'scene-editorial-chapters', 'scroll'>
  | CreativeSceneVariant<'scene-spatial-gallery', 'focus'>
  | CreativeSceneVariant<'scene-data-constellation', 'focus'>
  | CreativeSceneVariant<'scene-globe-network', 'focus'>
  | CreativeSceneVariant<'scene-ambient-landscape', 'none'>
  | CreativeSceneVariant<'scene-image-reveal-story', 'scroll'>
  | CreativeSceneVariant<'scene-portal-tunnel', 'scroll'>
  | CreativeSceneVariant<'scene-kinetic-cards', 'focus'>
  | CreativeSceneVariant<'scene-ambient-particles', 'none'>;

export type CreativeSceneSemanticColor =
  | 'surface'
  | 'surface-elevated'
  | 'surface-foreground'
  | 'surface-muted'
  | 'accent'
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning';

export type CreativeSceneStructuralSignature = {
  sectionOrder: readonly string[];
  compositionTopology: string;
  semanticRegions: readonly CreativeSceneHostRegion[];
  widgets: readonly CreativeSceneWidgetId[];
  motions: readonly CreativeSceneMotionId[];
  mediaTreatment: string;
  interaction: CreativeSceneInteraction;
  runtimeEngine: CreativeSceneRuntimeEngine;
  costTier: CreativeSceneCostTier;
  authoringTier: CreativeSceneAuthoringTier;
};

export type CreativeSceneMeta = {
  id: CreativeSceneId;
  label: string;
  primaryAnatomy: string;
  advancedModule: CreativeSceneAdvancedModuleId | null;
  moduleOptional: boolean;
  runtimeEngine: CreativeSceneRuntimeEngine;
  costTier: CreativeSceneCostTier;
  authoringTier: CreativeSceneAuthoringTier;
  siteCompatible: true;
  appCompatible: boolean;
  allowedHosts: readonly CreativeSceneHostRegion[];
  interaction: CreativeSceneInteraction;
  itemBounds: readonly [min: number, max: number];
  fallbackId: CreativeSceneFallbackId;
  signature: CreativeSceneStructuralSignature;
};

export type CreativeSceneCapabilities = {
  advancedEngines?: boolean;
  reducedMotion?: boolean;
  reducedData?: boolean;
  forcedColors?: boolean;
  print?: boolean;
  test?: boolean;
  server?: boolean;
  visible?: boolean;
  budgetEligible?: boolean;
  viewport?: CreativeSceneViewport;
};

export type CreativeSceneProjection = {
  mode: 'primary' | 'fallback';
  fallbackId: CreativeSceneFallbackId;
  reason: CreativeSceneFallbackReason;
  renderAdvancedModule: boolean;
};

export type CreativeSceneCompositionProps = {
  config: CreativeSceneConfig;
  capabilities?: CreativeSceneCapabilities;
  className?: string;
  style?: CSSProperties;
};

export type CreativeSceneHostProps = {
  scenes: readonly CreativeSceneConfig[];
  experienceMode: CreativeSceneExperience;
  capabilities?: CreativeSceneCapabilities;
  className?: string;
  children?: ReactNode;
};
