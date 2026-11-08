import * as React from 'react';
import { cn } from '../../../lib/utils';
import {
  APP_CREATIVE_MOTION_ALLOWLIST,
  CREATIVE_MOTION_CATALOG,
  CREATIVE_MOTION_IDS,
  CreativeMotionProvider,
  CreativeMotionTarget,
  resolveCreativeMotion,
  type CreativeMotionConfig,
  type CreativeMotionExperience,
  type CreativeMotionId,
  type CreativeMotionViewport,
} from '../../../shared/ui';
import {
  CreativeCheckbox,
  CreativeDiagnostics,
  CreativeSelect,
  CreativeWorkspace,
} from '../creative/CreativeWorkspacePrimitives';

export type MotionBehaviorsGalleryConfig = {
  behaviorId: CreativeMotionId;
  target: 'card' | 'metric' | 'route';
  intensity: 'subtle' | 'standard' | 'expressive';
  experience: CreativeMotionExperience;
  viewport: CreativeMotionViewport;
  fallback: 'runtime' | 'static';
  reducedMotion: boolean;
  saveData: boolean;
};

export const DEFAULT_MOTION_BEHAVIORS_GALLERY_CONFIG: MotionBehaviorsGalleryConfig = {
  behaviorId: 'reveal-stagger',
  target: 'card',
  intensity: 'standard',
  experience: 'site',
  viewport: 'desktop',
  fallback: 'runtime',
  reducedMotion: false,
  saveData: false,
};

export function getCreativeMotionIds(
  experience: CreativeMotionExperience,
): readonly CreativeMotionId[] {
  return experience === 'site'
    ? CREATIVE_MOTION_IDS
    : CREATIVE_MOTION_IDS.filter((id) => APP_CREATIVE_MOTION_ALLOWLIST.has(id));
}

export function normalizeMotionBehaviorsConfig(
  config: MotionBehaviorsGalleryConfig,
): MotionBehaviorsGalleryConfig {
  const ids = getCreativeMotionIds(config.experience);
  const behaviorId = ids.includes(config.behaviorId) ? config.behaviorId : ids[0];
  return {
    ...config,
    behaviorId,
    reducedMotion: config.fallback === 'runtime' && config.reducedMotion,
    saveData: config.fallback === 'runtime' && config.saveData,
  };
}

export function buildCreativeMotionDemoConfig(
  id: CreativeMotionId,
  intensity: MotionBehaviorsGalleryConfig['intensity'],
): CreativeMotionConfig {
  const durationMs = intensity === 'subtle' ? 800 : intensity === 'expressive' ? 260 : 480;
  switch (id) {
    case 'reveal-fade': return { id, durationMs };
    case 'reveal-slide': return { id, durationMs, distancePx: intensity === 'expressive' ? 48 : 20, axis: 'y', direction: 1 };
    case 'reveal-scale': return { id, durationMs, fromScale: intensity === 'expressive' ? 0.78 : 0.94 };
    case 'reveal-mask': return { id, durationMs, direction: 'bottom' };
    case 'reveal-stagger': return { id, durationMs, itemCount: 3, staggerMs: intensity === 'subtle' ? 160 : 80 };
    case 'metric-count-up': return { id, from: 0, to: 42, durationMs, decimals: 0 };
    case 'hover-lift': return { id, distancePx: intensity === 'expressive' ? 18 : 8, durationMs };
    case 'pointer-tilt': return { id, maxDegrees: intensity === 'expressive' ? 16 : 7, perspectivePx: 800, smoothing: 0.14 };
    case 'pointer-attract': return { id, maxDistancePx: intensity === 'expressive' ? 28 : 12, smoothing: 0.16 };
    case 'track-marquee': return { id, durationMs: durationMs * 20, direction: 1 };
    case 'scroll-progress': return { id, axis: 'x' };
    case 'scroll-parallax-layers': return { id, depthPx: intensity === 'expressive' ? 90 : 40, layerCount: 3 };
    case 'sticky-chapter': return { id, topPx: 24 };
    case 'scene-scrub': return { id, start: 0, end: 1 };
    case 'scene-camera-path': return { id, durationMs: durationMs * 5, mode: 'time' };
    case 'scene-orbit': return { id, durationMs: durationMs * 8, interaction: 'time' };
    case 'scene-object-focus': return { id, stateCount: 3, initialState: 0 };
    case 'route-crossfade': return { id, durationMs };
  }
}

export function exportMotionBehaviorsGalleryConfig(config: MotionBehaviorsGalleryConfig) {
  const normalized = normalizeMotionBehaviorsConfig(config);
  const motionConfig = buildCreativeMotionDemoConfig(normalized.behaviorId, normalized.intensity);
  const decision = resolveCreativeMotion(normalized.behaviorId, {
    experienceMode: normalized.experience,
    viewport: normalized.viewport,
    reducedMotion: normalized.reducedMotion || normalized.fallback === 'static',
    reducedData: normalized.saveData,
    coarsePointer: normalized.viewport === 'phone',
    documentHidden: false,
    offscreen: false,
    paused: false,
  });
  return {
    public: {
      experienceMode: normalized.experience,
      viewport: normalized.viewport,
    },
    composition: {
      target: normalized.target,
      behavior: motionConfig,
    },
    demo: {
      fixtures: { intensity: normalized.intensity },
      scenarios: {
        reducedMotion: normalized.reducedMotion,
        saveData: normalized.saveData,
        fallback: normalized.fallback,
        decision,
      },
    },
  };
}

const targetCopy = {
  card: ['Reusable motion', 'A production target with keyboard-safe fallback.'],
  metric: ['42% faster', 'Final values remain visible without animation.'],
  route: ['Route transition', 'The next view swaps instantly when motion is reduced.'],
} as const;

export const MotionBehaviorsBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = React.useState(DEFAULT_MOTION_BEHAVIORS_GALLERY_CONFIG);
  const normalized = normalizeMotionBehaviorsConfig(config);
  const meta = CREATIVE_MOTION_CATALOG[normalized.behaviorId];
  const ids = getCreativeMotionIds(normalized.experience);
  const exported = exportMotionBehaviorsGalleryConfig(normalized);
  const decision = exported.demo.scenarios.decision;
  const motionConfig = exported.composition.behavior;
  const update = <K extends keyof MotionBehaviorsGalleryConfig>(
    key: K,
    value: MotionBehaviorsGalleryConfig[K],
  ) => setConfig((current) => normalizeMotionBehaviorsConfig({ ...current, [key]: value }));

  return (
    <CreativeWorkspace
      sectionId="motion-behaviors"
      json={JSON.stringify(exported, null, 2)}
      onReset={() => setConfig(DEFAULT_MOTION_BEHAVIORS_GALLERY_CONFIG)}
      primaryControls={(
        <>
          <CreativeSelect label="Behavior" value={normalized.behaviorId} options={ids} onChange={(value) => update('behaviorId', value)} />
          <CreativeSelect label="Target" value={normalized.target} options={['card', 'metric', 'route']} onChange={(value) => update('target', value)} />
          <CreativeSelect label="Intensity" value={normalized.intensity} options={['subtle', 'standard', 'expressive']} onChange={(value) => update('intensity', value)} />
          <CreativeSelect label="Experience" value={normalized.experience} options={['site', 'app']} onChange={(value) => update('experience', value)} />
          <CreativeSelect label="Viewport" value={normalized.viewport} options={['desktop', 'tablet', 'phone']} onChange={(value) => update('viewport', value)} />
        </>
      )}
      fallbackControls={(
        <>
          <CreativeSelect label="Engine fallback" value={normalized.fallback} options={['runtime', 'static']} onChange={(value) => update('fallback', value)} />
          {normalized.fallback === 'runtime' ? <CreativeCheckbox label="Reduced motion" checked={normalized.reducedMotion} onChange={(value) => update('reducedMotion', value)} /> : null}
          {normalized.fallback === 'runtime' && meta.costTier !== 'low' ? <CreativeCheckbox label="Save-Data" checked={normalized.saveData} onChange={(value) => update('saveData', value)} /> : null}
        </>
      )}
    >
      <CreativeDiagnostics entries={[
        { label: 'Engine', value: meta.runtimeEngine },
        { label: 'Trigger', value: meta.trigger },
        { label: 'Cost', value: meta.costTier },
        { label: 'Decision', value: decision.mode === 'runtime' ? 'runtime' : decision.reason },
      ]} />
      <CreativeMotionProvider experienceMode={normalized.experience} viewport={normalized.viewport}>
        <CreativeMotionTarget
          config={motionConfig}
          className={cn(
            'mx-auto flex min-h-64 w-full max-w-xl flex-col justify-end overflow-hidden rounded-2xl border border-violet-200 bg-white p-6 shadow-sm',
            decision.mode === 'fallback' && 'border-dashed',
          )}
        >
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">{normalized.behaviorId}</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">{targetCopy[normalized.target][0]}</h2>
          <p className="mt-2 max-w-md text-sm text-slate-600">{targetCopy[normalized.target][1]}</p>
          <span className="mt-5 w-fit rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">
            {decision.mode === 'runtime' ? `${normalized.intensity} motion` : meta.reducedMotionFallback}
          </span>
        </CreativeMotionTarget>
      </CreativeMotionProvider>
    </CreativeWorkspace>
  );
};
