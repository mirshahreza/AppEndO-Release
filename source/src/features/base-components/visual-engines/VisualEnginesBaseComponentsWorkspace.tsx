import * as React from 'react';
import {
  CreativeSceneHost,
  VISUAL_ENGINE_CATALOG,
  VISUAL_ENGINE_IDS,
  validateVisualEngineConfig,
  type CreativeViewport,
  type LocalModelAsset,
  type LocalRasterAsset,
  type VisualEngineConfig,
  type VisualEngineId,
} from '../../../shared/ui';
import {
  CreativeCheckbox,
  CreativeDiagnostics,
  CreativeSelect,
  CreativeWorkspace,
} from '../creative/CreativeWorkspacePrimitives';

const ASSET_HASH = 'c6209123bc7fe941c7dff953e6c35f232ff69336f7409566d6d14b769793120f';
const RASTER = `/assets/workspace/${ASSET_HASH}.png` as LocalRasterAsset;
const MODEL = `/assets/workspace/${ASSET_HASH}.glb` as LocalModelAsset;

export type VisualEnginesGalleryConfig = {
  engineId: VisualEngineId;
  quality: 'efficient' | 'balanced' | 'maximum';
  experience: 'site' | 'app';
  viewport: CreativeViewport;
  fallback: 'runtime' | 'static' | 'engine-unavailable';
  reducedMotion: boolean;
  saveData: boolean;
  paused: boolean;
};

export const DEFAULT_VISUAL_ENGINES_GALLERY_CONFIG: VisualEnginesGalleryConfig = {
  engineId: 'canvas-particle-system',
  quality: 'balanced',
  experience: 'site',
  viewport: 'desktop',
  fallback: 'runtime',
  reducedMotion: false,
  saveData: false,
  paused: false,
};

const qualityIndex = (quality: VisualEnginesGalleryConfig['quality']) =>
  quality === 'efficient' ? 0 : quality === 'balanced' ? 1 : 2;

export function buildVisualEngineDemoConfig(
  engineId: VisualEngineId,
  quality: VisualEnginesGalleryConfig['quality'],
): VisualEngineConfig {
  const level = qualityIndex(quality);
  switch (engineId) {
    case 'canvas-particle-system':
      return { engineId, seed: 29, particleCount: [24, 72, 144][level], linkCount: [8, 36, 96][level], radius: [1.5, 2.5, 4][level], speed: [0.2, 0.6, 1.2][level], color: '#0d9488', background: '#ffffff' };
    case 'canvas-vector-field':
      return { engineId, seed: 31, columns: [8, 16, 28][level], rows: [5, 10, 16][level], forces: [{ x: 0.5, y: 0.5, strength: 0.8, radius: 0.4 }], lineLength: [8, 16, 26][level], color: '#4f46e5', background: '#ffffff' };
    case 'three-product-stage':
      return { engineId, modelAsset: MODEL, posterAsset: RASTER, triangleCount: [20_000, 48_000, 80_000][level], materialCount: [1, 2, 4][level], textureCount: [1, 2, 4][level], exposure: [0.8, 1, 1.25][level], callouts: [{ id: 'detail', label: 'Product detail', x: 28, y: 34 }] };
    case 'three-model-orbit':
      return { engineId, modelAsset: MODEL, posterAsset: RASTER, triangleCount: [30_000, 72_000, 120_000][level], materialCount: [2, 4, 6][level], textureCount: [1, 3, 6][level], orbitRadius: [3, 5, 8][level], annotations: [{ id: 'assembly', label: 'Assembly', x: 68, y: 42 }] };
    case 'three-spatial-gallery':
      return { engineId, seed: 37, images: Array.from({ length: [3, 6, 12][level] }, (_, index) => ({ id: `image-${index + 1}`, assetRef: RASTER, alt: `Gallery image ${index + 1}` })), spacing: [1, 1.8, 3][level] };
    case 'three-data-constellation': {
      const nodes = Array.from({ length: [4, 12, 32][level] }, (_, index) => ({ id: `node-${index + 1}`, label: `Node ${index + 1}`, value: (index + 1) * 12, group: index % 4 }));
      return { engineId, seed: 41, nodes, edges: nodes.slice(1).map((node, index) => ({ source: nodes[index].id, target: node.id, weight: 0.6 })), color: '#0891b2' };
    }
    case 'shader-image-reveal':
      return { engineId, imageAsset: RASTER, alt: 'Product story reveal', shaderId: 'image-soft-wipe-v1', uniforms: { progress: [0.25, 0.55, 0.85][level], softness: [0.08, 0.18, 0.32][level], displacement: [0.1, 0.35, 0.7][level], grain: [0, 0.08, 0.18][level] } };
    case 'shader-ambient-field':
      return { engineId, seed: 43, shaderId: 'ambient-flow-v1', uniforms: { scale: [1, 2.5, 5][level], speed: [0.2, 0.7, 1.4][level], warp: [0.2, 0.8, 1.6][level], noise: [0.15, 0.45, 0.8][level], colorA: '#4f46e5', colorB: '#0891b2' } };
  }
}

export function normalizeVisualEnginesConfig(
  config: VisualEnginesGalleryConfig,
): VisualEnginesGalleryConfig {
  const meta = VISUAL_ENGINE_CATALOG[config.engineId];
  const fallback =
    meta.runtimeEngine === 'canvas-2d' && config.fallback === 'engine-unavailable'
      ? 'static'
      : config.fallback;
  const runtimeActive = fallback === 'runtime' && config.experience === 'site';
  return {
    ...config,
    fallback,
    reducedMotion: runtimeActive && config.reducedMotion,
    saveData: runtimeActive && config.saveData,
    paused: runtimeActive && config.paused,
  };
}

export function exportVisualEnginesGalleryConfig(config: VisualEnginesGalleryConfig) {
  const normalized = normalizeVisualEnginesConfig(config);
  const engineConfig = buildVisualEngineDemoConfig(normalized.engineId, normalized.quality);
  const meta = VISUAL_ENGINE_CATALOG[normalized.engineId];
  const capabilityOverride = {
    reducedMotion: normalized.reducedMotion,
    saveData: normalized.saveData,
    snapshot: normalized.fallback === 'static' || normalized.experience === 'app',
    webgl2: normalized.fallback !== 'engine-unavailable',
  };
  return {
    public: {
      viewport: normalized.viewport,
      enabled: normalized.experience === 'site',
      paused: normalized.paused,
    },
    composition: {
      engineId: normalized.engineId,
      quality: normalized.quality,
      config: engineConfig,
    },
    demo: {
      fixtures: { localAssetSet: 'creative-engine-demo' },
      scenarios: {
        experience: normalized.experience,
        fallback: normalized.fallback,
        reducedMotion: normalized.reducedMotion,
        saveData: normalized.saveData,
        capabilityOverride,
        expectedFallback: normalized.experience === 'app'
          ? 'app-unsupported'
          : normalized.fallback === 'static'
            ? 'snapshot'
            : normalized.fallback === 'engine-unavailable' && meta.runtimeEngine === 'webgl-three'
              ? 'webgl-unavailable'
              : normalized.reducedMotion
                ? 'reduced-motion'
                : normalized.saveData
                  ? 'save-data'
                  : 'runtime',
      },
    },
  };
}

export const VisualEnginesBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = React.useState(DEFAULT_VISUAL_ENGINES_GALLERY_CONFIG);
  const normalized = normalizeVisualEnginesConfig(config);
  const meta = VISUAL_ENGINE_CATALOG[normalized.engineId];
  const exported = exportVisualEnginesGalleryConfig(normalized);
  const validation = validateVisualEngineConfig(exported.composition.config);
  const runtimeActive = normalized.fallback === 'runtime' && normalized.experience === 'site';
  const update = <K extends keyof VisualEnginesGalleryConfig>(
    key: K,
    value: VisualEnginesGalleryConfig[K],
  ) => setConfig((current) => normalizeVisualEnginesConfig({ ...current, [key]: value }));

  return (
    <CreativeWorkspace
      sectionId="visual-engines"
      json={JSON.stringify(exported, null, 2)}
      onReset={() => setConfig(DEFAULT_VISUAL_ENGINES_GALLERY_CONFIG)}
      primaryControls={(
        <>
          <CreativeSelect label="Engine module" value={normalized.engineId} options={VISUAL_ENGINE_IDS} onChange={(value) => update('engineId', value)} />
          <CreativeSelect label="Config quality" value={normalized.quality} options={['efficient', 'balanced', 'maximum']} onChange={(value) => update('quality', value)} />
          <CreativeSelect label="Experience" value={normalized.experience} options={['site', 'app']} onChange={(value) => update('experience', value)} />
          <CreativeSelect label="Viewport" value={normalized.viewport} options={['desktop', 'tablet', 'phone']} onChange={(value) => update('viewport', value)} />
        </>
      )}
      fallbackControls={(
        <>
          {normalized.experience === 'site' ? (
            <CreativeSelect
              label="Engine fallback"
              value={normalized.fallback}
              options={meta.runtimeEngine === 'webgl-three'
                ? ['runtime', 'static', 'engine-unavailable']
                : ['runtime', 'static']}
              onChange={(value) => update('fallback', value)}
            />
          ) : null}
          {runtimeActive ? <CreativeCheckbox label="Reduced motion" checked={normalized.reducedMotion} onChange={(value) => update('reducedMotion', value)} /> : null}
          {runtimeActive ? <CreativeCheckbox label="Save-Data" checked={normalized.saveData} onChange={(value) => update('saveData', value)} /> : null}
          {runtimeActive ? <CreativeCheckbox label="Pause runtime" checked={normalized.paused} onChange={(value) => update('paused', value)} /> : null}
        </>
      )}
    >
      <CreativeDiagnostics entries={[
        { label: 'Export', value: meta.componentName },
        { label: 'Engine', value: meta.runtimeEngine },
        { label: 'Cost', value: meta.costTier },
        { label: 'Projection', value: exported.demo.scenarios.expectedFallback },
      ]} />
      <CreativeSceneHost
        scenes={[exported.composition.config]}
        viewport={normalized.viewport}
        enabled={normalized.experience === 'site'}
        paused={normalized.paused}
        capabilityOverride={exported.demo.scenarios.capabilityOverride}
        className="min-h-[24rem] overflow-hidden rounded-2xl border border-emerald-200 bg-white"
        semanticOverlay={(
          <div className="absolute inset-x-0 bottom-0 z-10 bg-white/90 p-4 backdrop-blur-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">{normalized.engineId}</p>
            <p className="mt-1 text-sm text-slate-600">
              {validation.valid ? 'Closed production config validated.' : `${validation.issues.length} validation issues.`}
            </p>
          </div>
        )}
      />
    </CreativeWorkspace>
  );
};
