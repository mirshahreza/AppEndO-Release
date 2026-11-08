import type { CSSProperties, ReactNode } from 'react';

export const VISUAL_ENGINE_IDS = [
  'canvas-particle-system',
  'canvas-vector-field',
  'three-product-stage',
  'three-model-orbit',
  'three-spatial-gallery',
  'three-data-constellation',
  'shader-image-reveal',
  'shader-ambient-field',
] as const;

export type VisualEngineId = (typeof VISUAL_ENGINE_IDS)[number];
export type CreativeRuntimeEngine = 'canvas-2d' | 'webgl-three';
export type CreativeCostTier = 'high' | 'extreme';
export type CreativeAuthoringTier = 'enhanced' | 'advanced';
export type CreativeViewport = 'desktop' | 'tablet' | 'phone';
export type CreativeFallbackReason =
  | 'invalid'
  | 'ssr'
  | 'snapshot'
  | 'print'
  | 'forced-colors'
  | 'reduced-motion'
  | 'save-data'
  | 'slow-connection'
  | 'low-memory'
  | 'phone'
  | 'offscreen'
  | 'hidden'
  | 'webgl-unavailable'
  | 'context-lost'
  | 'budget';

export type LocalRasterAsset = `/assets/workspace/${string}.${'png' | 'jpg' | 'jpeg' | 'webp' | 'avif'}`;
export type LocalModelAsset = `/assets/workspace/${string}.${'glb' | 'gltf'}`;
export type HexColor = `#${string}`;

export type CanvasParticleSystemConfig = {
  engineId: 'canvas-particle-system';
  seed: number;
  particleCount: number;
  linkCount: number;
  radius: number;
  speed: number;
  color: HexColor;
  background: HexColor;
};

export type VectorForce = {
  x: number;
  y: number;
  strength: number;
  radius: number;
};

export type CanvasVectorFieldConfig = {
  engineId: 'canvas-vector-field';
  seed: number;
  columns: number;
  rows: number;
  forces: readonly VectorForce[];
  lineLength: number;
  color: HexColor;
  background: HexColor;
};

export type SemanticCallout = {
  id: string;
  label: string;
  body?: string;
  x: number;
  y: number;
};

export type ThreeProductStageConfig = {
  engineId: 'three-product-stage';
  modelAsset: LocalModelAsset;
  posterAsset: LocalRasterAsset;
  triangleCount: number;
  materialCount: number;
  textureCount: number;
  exposure: number;
  callouts: readonly SemanticCallout[];
};

export type ThreeModelOrbitConfig = {
  engineId: 'three-model-orbit';
  modelAsset: LocalModelAsset;
  posterAsset: LocalRasterAsset;
  triangleCount: number;
  materialCount: number;
  textureCount: number;
  orbitRadius: number;
  annotations: readonly SemanticCallout[];
};

export type GalleryImage = {
  id: string;
  assetRef: LocalRasterAsset;
  alt: string;
};

export type ThreeSpatialGalleryConfig = {
  engineId: 'three-spatial-gallery';
  seed: number;
  images: readonly GalleryImage[];
  spacing: number;
};

export type ConstellationNode = {
  id: string;
  label: string;
  value: number;
  group: number;
};

export type ConstellationEdge = {
  source: string;
  target: string;
  weight: number;
};

export type ThreeDataConstellationConfig = {
  engineId: 'three-data-constellation';
  seed: number;
  nodes: readonly ConstellationNode[];
  edges: readonly ConstellationEdge[];
  color: HexColor;
};

export type ShaderImageRevealConfig = {
  engineId: 'shader-image-reveal';
  imageAsset: LocalRasterAsset;
  alt: string;
  shaderId: 'image-soft-wipe-v1';
  uniforms: {
    progress: number;
    softness: number;
    displacement: number;
    grain: number;
  };
};

export type ShaderAmbientFieldConfig = {
  engineId: 'shader-ambient-field';
  seed: number;
  shaderId: 'ambient-flow-v1';
  uniforms: {
    scale: number;
    speed: number;
    warp: number;
    noise: number;
    colorA: HexColor;
    colorB: HexColor;
  };
};

export type VisualEngineConfig =
  | CanvasParticleSystemConfig
  | CanvasVectorFieldConfig
  | ThreeProductStageConfig
  | ThreeModelOrbitConfig
  | ThreeSpatialGalleryConfig
  | ThreeDataConstellationConfig
  | ShaderImageRevealConfig
  | ShaderAmbientFieldConfig;

export type VisualEngineMeta = {
  id: VisualEngineId;
  componentName:
    | 'CanvasParticleSystem'
    | 'CanvasVectorField'
    | 'ThreeProductStage'
    | 'ThreeModelOrbit'
    | 'ThreeSpatialGallery'
    | 'ThreeDataConstellation'
    | 'ShaderImageReveal'
    | 'ShaderAmbientField';
  runtimeEngine: CreativeRuntimeEngine;
  costTier: CreativeCostTier;
  authoringTier: CreativeAuthoringTier;
  fallback: 'generated-svg' | 'css-svg' | 'poster-dom' | 'dom-grid' | 'semantic-grid' | 'image-fade';
};

export type CreativeSceneCapability = {
  eligible: boolean;
  reason?: CreativeFallbackReason;
  dpr: number;
  maxBackingPixels: number;
  maxTextureBytes: number;
};

export type CreativeCapabilityInput = {
  runtimeEngine: CreativeRuntimeEngine;
  costTier: CreativeCostTier;
  viewport?: CreativeViewport;
  visible?: boolean;
  documentHidden?: boolean;
  reducedMotion?: boolean;
  saveData?: boolean;
  effectiveType?: string;
  deviceMemory?: number;
  forcedColors?: boolean;
  printing?: boolean;
  snapshot?: boolean;
  webgl2?: boolean;
  dpr?: number;
};

export type CreativeSceneHostProps = {
  scenes: readonly VisualEngineConfig[];
  viewport?: CreativeViewport;
  enabled?: boolean;
  paused?: boolean;
  className?: string;
  style?: CSSProperties;
  semanticOverlay?: ReactNode;
  capabilityOverride?: Partial<CreativeCapabilityInput>;
};

export type VisualEngineComponentProps<Config extends VisualEngineConfig> = Omit<
  CreativeSceneHostProps,
  'scenes'
> & {
  config: Config;
};

export type EngineMountOptions = {
  canvas: HTMLCanvasElement;
  config: VisualEngineConfig;
  capability: CreativeSceneCapability;
  paused: boolean;
};

export type EngineMount = {
  setPaused(paused: boolean): void;
  resize(width: number, height: number, dpr: number): void;
  dispose(): void;
};

export type EngineRuntimeModule = {
  mountVisualEngine(options: EngineMountOptions): EngineMount | null;
};
