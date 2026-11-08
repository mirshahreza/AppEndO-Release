import type { VisualEngineId, VisualEngineMeta } from './types';
import { VISUAL_ENGINE_IDS } from './types';

export const VISUAL_ENGINE_LIMITS = {
  canvasBackingPixelsDesktop: 2_500_000,
  canvasBackingPixelsTablet: 1_500_000,
  dprDesktop: 2,
  dprTablet: 1.5,
  textureBytesDesktop: 64 * 1024 * 1024,
  textureBytesTablet: 48 * 1024 * 1024,
  textureDimension: 4096,
  productTriangles: 80_000,
  orbitTriangles: 120_000,
  materialsProduct: 4,
  materialsOrbit: 6,
  texturesProduct: 4,
  texturesOrbit: 6,
  galleryPlanes: 20,
  constellationNodes: 96,
  constellationEdges: 192,
} as const;

export const VISUAL_ENGINE_CATALOG: Readonly<Record<VisualEngineId, VisualEngineMeta>> = {
  'canvas-particle-system': {
    id: 'canvas-particle-system',
    componentName: 'CanvasParticleSystem',
    runtimeEngine: 'canvas-2d',
    costTier: 'high',
    authoringTier: 'enhanced',
    fallback: 'generated-svg',
  },
  'canvas-vector-field': {
    id: 'canvas-vector-field',
    componentName: 'CanvasVectorField',
    runtimeEngine: 'canvas-2d',
    costTier: 'high',
    authoringTier: 'enhanced',
    fallback: 'css-svg',
  },
  'three-product-stage': {
    id: 'three-product-stage',
    componentName: 'ThreeProductStage',
    runtimeEngine: 'webgl-three',
    costTier: 'extreme',
    authoringTier: 'advanced',
    fallback: 'poster-dom',
  },
  'three-model-orbit': {
    id: 'three-model-orbit',
    componentName: 'ThreeModelOrbit',
    runtimeEngine: 'webgl-three',
    costTier: 'extreme',
    authoringTier: 'advanced',
    fallback: 'poster-dom',
  },
  'three-spatial-gallery': {
    id: 'three-spatial-gallery',
    componentName: 'ThreeSpatialGallery',
    runtimeEngine: 'webgl-three',
    costTier: 'extreme',
    authoringTier: 'advanced',
    fallback: 'dom-grid',
  },
  'three-data-constellation': {
    id: 'three-data-constellation',
    componentName: 'ThreeDataConstellation',
    runtimeEngine: 'webgl-three',
    costTier: 'high',
    authoringTier: 'advanced',
    fallback: 'semantic-grid',
  },
  'shader-image-reveal': {
    id: 'shader-image-reveal',
    componentName: 'ShaderImageReveal',
    runtimeEngine: 'webgl-three',
    costTier: 'high',
    authoringTier: 'advanced',
    fallback: 'image-fade',
  },
  'shader-ambient-field': {
    id: 'shader-ambient-field',
    componentName: 'ShaderAmbientField',
    runtimeEngine: 'webgl-three',
    costTier: 'high',
    authoringTier: 'advanced',
    fallback: 'css-svg',
  },
};

if (
  Object.keys(VISUAL_ENGINE_CATALOG).length !== VISUAL_ENGINE_IDS.length ||
  !VISUAL_ENGINE_IDS.every((id) => VISUAL_ENGINE_CATALOG[id].id === id)
) {
  throw new Error('Visual engine catalog must be an exact ID bijection.');
}
