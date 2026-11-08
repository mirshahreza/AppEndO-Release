import * as React from 'react';
import {
  CREATIVE_SCENE_APP_ALLOWLIST,
  CREATIVE_SCENE_CATALOG,
  CREATIVE_SCENE_IDS,
  CreativeSceneCompositionHost,
  createCreativeSceneFixture,
  resolveCreativeSceneProjection,
  type CreativeSceneConfig,
  type CreativeSceneExperience,
  type CreativeSceneHostRegion,
  type CreativeSceneId,
  type CreativeSceneViewport,
} from '../../../shared/ui';
import {
  CreativeCheckbox,
  CreativeDiagnostics,
  CreativeSelect,
  CreativeWorkspace,
} from '../creative/CreativeWorkspacePrimitives';

export type CreativeScenesGalleryConfig = {
  sceneId: CreativeSceneId;
  preset: 'calm' | 'balanced' | 'expressive';
  density: 'sparse' | 'normal' | 'dense';
  experience: CreativeSceneExperience;
  host: CreativeSceneHostRegion;
  viewport: CreativeSceneViewport;
  fallback: 'runtime' | 'static' | 'engine-unavailable';
  reducedMotion: boolean;
  saveData: boolean;
};

export const DEFAULT_CREATIVE_SCENES_GALLERY_CONFIG: CreativeScenesGalleryConfig = {
  sceneId: 'scene-kinetic-cards',
  preset: 'balanced',
  density: 'normal',
  experience: 'site',
  host: 'content-host',
  viewport: 'desktop',
  fallback: 'runtime',
  reducedMotion: false,
  saveData: false,
};

export function getCreativeSceneIds(
  experience: CreativeSceneExperience,
): readonly CreativeSceneId[] {
  return experience === 'site' ? CREATIVE_SCENE_IDS : CREATIVE_SCENE_APP_ALLOWLIST;
}

export function normalizeCreativeScenesConfig(
  config: CreativeScenesGalleryConfig,
): CreativeScenesGalleryConfig {
  const ids = getCreativeSceneIds(config.experience);
  const sceneId = ids.includes(config.sceneId) ? config.sceneId : ids[0];
  const meta = CREATIVE_SCENE_CATALOG[sceneId];
  return {
    ...config,
    sceneId,
    host: meta.allowedHosts.includes(config.host) ? config.host : meta.allowedHosts[0],
    reducedMotion: config.fallback === 'runtime' && config.reducedMotion,
    saveData: config.fallback === 'runtime' && config.saveData,
  };
}

export function buildCreativeSceneDemoConfig(
  config: CreativeScenesGalleryConfig,
): CreativeSceneConfig {
  const normalized = normalizeCreativeScenesConfig(config);
  return {
    ...createCreativeSceneFixture(normalized.sceneId, normalized.experience),
    host: normalized.host,
    preset: normalized.preset,
    density: normalized.density,
  } as CreativeSceneConfig;
}

export function exportCreativeScenesGalleryConfig(config: CreativeScenesGalleryConfig) {
  const normalized = normalizeCreativeScenesConfig(config);
  const scene = buildCreativeSceneDemoConfig(normalized);
  const capabilities = {
    viewport: normalized.viewport,
    reducedMotion: normalized.reducedMotion || normalized.fallback === 'static',
    reducedData: normalized.saveData,
    advancedEngines: normalized.fallback !== 'engine-unavailable',
    visible: true,
    budgetEligible: normalized.fallback !== 'static',
  } as const;
  const projection = resolveCreativeSceneProjection(scene, capabilities);
  return {
    public: {
      experienceMode: normalized.experience,
      viewport: normalized.viewport,
    },
    composition: {
      sceneId: normalized.sceneId,
      host: normalized.host,
      preset: normalized.preset,
      density: normalized.density,
      scene,
    },
    demo: {
      fixtures: { fixtureId: normalized.sceneId },
      scenarios: {
        fallback: normalized.fallback,
        reducedMotion: normalized.reducedMotion,
        saveData: normalized.saveData,
        capabilities,
        projection,
      },
    },
  };
}

export const CreativeScenesBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = React.useState(DEFAULT_CREATIVE_SCENES_GALLERY_CONFIG);
  const normalized = normalizeCreativeScenesConfig(config);
  const meta = CREATIVE_SCENE_CATALOG[normalized.sceneId];
  const ids = getCreativeSceneIds(normalized.experience);
  const exported = exportCreativeScenesGalleryConfig(normalized);
  const update = <K extends keyof CreativeScenesGalleryConfig>(
    key: K,
    value: CreativeScenesGalleryConfig[K],
  ) => setConfig((current) => normalizeCreativeScenesConfig({ ...current, [key]: value }));

  return (
    <CreativeWorkspace
      sectionId="creative-scenes"
      json={JSON.stringify(exported, null, 2)}
      onReset={() => setConfig(DEFAULT_CREATIVE_SCENES_GALLERY_CONFIG)}
      primaryControls={(
        <>
          <CreativeSelect label="Scene" value={normalized.sceneId} options={ids} onChange={(value) => update('sceneId', value)} />
          <CreativeSelect label="Preset" value={normalized.preset} options={['calm', 'balanced', 'expressive']} onChange={(value) => update('preset', value)} />
          <CreativeSelect label="Density" value={normalized.density} options={['sparse', 'normal', 'dense']} onChange={(value) => update('density', value)} />
          <CreativeSelect label="Experience" value={normalized.experience} options={['site', 'app']} onChange={(value) => update('experience', value)} />
          <CreativeSelect label="Host" value={normalized.host} options={meta.allowedHosts} onChange={(value) => update('host', value)} />
          <CreativeSelect label="Viewport" value={normalized.viewport} options={['desktop', 'tablet', 'phone']} onChange={(value) => update('viewport', value)} />
        </>
      )}
      fallbackControls={(
        <>
          <CreativeSelect label="Engine fallback" value={normalized.fallback} options={['runtime', 'static', 'engine-unavailable']} onChange={(value) => update('fallback', value)} />
          {normalized.fallback === 'runtime' ? <CreativeCheckbox label="Reduced motion" checked={normalized.reducedMotion} onChange={(value) => update('reducedMotion', value)} /> : null}
          {normalized.fallback === 'runtime' ? <CreativeCheckbox label="Save-Data" checked={normalized.saveData} onChange={(value) => update('saveData', value)} /> : null}
        </>
      )}
    >
      <CreativeDiagnostics entries={[
        { label: 'Scene', value: meta.label },
        { label: 'Engine', value: meta.runtimeEngine },
        { label: 'Module', value: meta.advancedModule ?? 'none' },
        { label: 'Projection', value: exported.demo.scenarios.projection.mode === 'primary' ? 'primary' : exported.demo.scenarios.projection.reason },
      ]} />
      <CreativeSceneCompositionHost
        scenes={[exported.composition.scene]}
        experienceMode={normalized.experience}
        capabilities={exported.demo.scenarios.capabilities}
        className="min-h-[24rem] overflow-hidden rounded-2xl border border-indigo-200 bg-white"
      />
    </CreativeWorkspace>
  );
};
