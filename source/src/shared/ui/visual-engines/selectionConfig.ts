import type {
  LocalModelAsset,
  LocalRasterAsset,
  VisualEngineConfig,
  VisualEngineId,
} from './types';

const DEFAULT_ASSET_HASH = 'c6209123bc7fe941c7dff953e6c35f232ff69336f7409566d6d14b769793120f';
const DEFAULT_RASTER = `/assets/workspace/${DEFAULT_ASSET_HASH}.png` as LocalRasterAsset;
const DEFAULT_MODEL = `/assets/workspace/${DEFAULT_ASSET_HASH}.glb` as LocalModelAsset;

export type VisualEngineSelection = {
  instanceId: string;
  engineId: VisualEngineId;
  fallback?: { assetRef?: string };
};

const seedFor = (value: string): number =>
  [...value].reduce((seed, character) => Math.imul(seed ^ character.charCodeAt(0), 16_777_619) >>> 0, 2_166_136_261);

export function buildVisualEngineSelectionConfig(selection: VisualEngineSelection): VisualEngineConfig {
  const seed = seedFor(selection.instanceId);
  const raster = selection.fallback?.assetRef?.match(/\.(?:png|jpe?g|webp|avif)$/)
    ? selection.fallback.assetRef as LocalRasterAsset
    : DEFAULT_RASTER;
  switch (selection.engineId) {
    case 'canvas-particle-system':
      return { engineId: selection.engineId, seed, particleCount: 72, linkCount: 36, radius: 2, speed: 0.5, color: '#4F46E5', background: '#FFFFFF' };
    case 'canvas-vector-field':
      return { engineId: selection.engineId, seed, columns: 16, rows: 10, forces: [{ x: 0.5, y: 0.5, strength: 0.8, radius: 0.4 }], lineLength: 16, color: '#4F46E5', background: '#FFFFFF' };
    case 'three-product-stage':
      return { engineId: selection.engineId, modelAsset: DEFAULT_MODEL, posterAsset: raster, triangleCount: 48_000, materialCount: 2, textureCount: 2, exposure: 1, callouts: [] };
    case 'three-model-orbit':
      return { engineId: selection.engineId, modelAsset: DEFAULT_MODEL, posterAsset: raster, triangleCount: 72_000, materialCount: 4, textureCount: 3, orbitRadius: 5, annotations: [] };
    case 'three-spatial-gallery':
      return { engineId: selection.engineId, seed, images: [{ id: 'fallback-image', assetRef: raster, alt: 'Spatial gallery fallback' }], spacing: 1.8 };
    case 'three-data-constellation': {
      const nodes = [
        { id: 'primary', label: 'Primary', value: 64, group: 0 },
        { id: 'secondary', label: 'Secondary', value: 36, group: 1 },
      ];
      return { engineId: selection.engineId, seed, nodes, edges: [{ source: 'primary', target: 'secondary', weight: 0.5 }], color: '#4F46E5' };
    }
    case 'shader-image-reveal':
      return { engineId: selection.engineId, imageAsset: raster, alt: 'Image reveal fallback', shaderId: 'image-soft-wipe-v1', uniforms: { progress: 0.5, softness: 0.12, displacement: 0.25, grain: 0.05 } };
    case 'shader-ambient-field':
      return { engineId: selection.engineId, seed, shaderId: 'ambient-flow-v1', uniforms: { scale: 2, speed: 0.35, warp: 0.6, noise: 0.45, colorA: '#4F46E5', colorB: '#0891B2' } };
  }
}
