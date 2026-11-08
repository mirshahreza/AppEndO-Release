import React from 'react';
import {
  LandingWidgetRenderer,
} from '../landing-widgets';
import type {
  LandingAction,
  LandingWidgetConfig,
} from '../landing-widgets';
import {
  CreativeMotionProvider,
  CreativeMotionTarget,
} from '../motion-runtime';
import type { CreativeMotionConfig } from '../motion-runtime';
import {
  CreativeSceneHost as VisualEngineHost,
} from '../visual-engines';
import type {
  LocalModelAsset,
  LocalRasterAsset,
  VisualEngineConfig,
} from '../visual-engines';
import { CREATIVE_SCENE_CATALOG } from './catalog';
import type {
  CreativeSceneCompositionProps,
  CreativeSceneConfig,
  CreativeSceneId,
  CreativeSceneItem,
} from './types';
import {
  resolveCreativeSceneProjection,
  validateCreativeSceneConfig,
} from './validation';

const ASSET_HASH = 'c6209123bc7fe941c7dff953e6c35f232ff69336f7409566d6d14b769793120f';
const RASTER_ASSET = `/assets/workspace/${ASSET_HASH}.png` as LocalRasterAsset;
const MODEL_ASSET = `/assets/workspace/${ASSET_HASH}.glb` as LocalModelAsset;

function actions(config: CreativeSceneConfig): readonly LandingAction[] {
  return config.content.actions.map((action, index) => ({
    label: action.label,
    href: action.href,
    kind: index === 0 ? 'primary' : 'secondary',
  }));
}

function features(items: readonly CreativeSceneItem[]) {
  return items.map((item) => ({ title: item.title, description: item.description }));
}

function media(config: CreativeSceneConfig) {
  return {
    assetRef: config.content.posterAsset ?? config.fallbackAsset ?? RASTER_ASSET,
    alt: `${config.content.heading} poster`,
    caption: 'A deterministic local fallback remains available without the advanced engine.',
  };
}

export function buildCreativeSceneWidgets(
  config: CreativeSceneConfig,
): readonly LandingWidgetConfig[] {
  const common = {
    eyebrow: config.content.eyebrow,
    heading: config.content.heading,
    copy: config.content.body,
    actions: actions(config),
  };
  switch (config.sceneId) {
    case 'scene-layered-hero':
    case 'scene-ambient-landscape':
    case 'scene-ambient-particles':
      return [{ id: 'landing-hero-centered', props: common }];
    case 'scene-product-orbit':
    case 'scene-product-explode':
      return [{
        id: 'landing-hero-product-stage',
        props: {
          ...common,
          media: media(config),
          trustCue: 'The poster and semantic callouts are always available.',
        },
      }];
    case 'scene-editorial-chapters':
    case 'scene-image-reveal-story':
      return [{
        id: 'landing-timeline',
        props: {
          ...common,
          milestones: config.content.items.map((item, index) => ({
            date: `Chapter ${index + 1}`,
            title: item.title,
            description: item.description,
          })),
        },
      }];
    case 'scene-spatial-gallery':
      return [{
        id: 'landing-media-gallery',
        props: {
          ...common,
          media: config.content.items.map((item) => ({
            assetRef: item.assetRef ?? RASTER_ASSET,
            alt: item.title,
            caption: item.description,
          })),
        },
      }];
    case 'scene-data-constellation':
      return [
        {
          id: 'landing-stat-strip',
          props: {
            ...common,
            metrics: config.content.items.slice(0, 6).map((item, index) => ({
              value: item.value ?? String(index + 1),
              label: item.title,
            })),
          },
        },
        {
          id: 'landing-feature-grid',
          props: { ...common, heading: 'Connected nodes', features: features(config.content.items) },
        },
      ];
    case 'scene-globe-network':
      return [
        { id: 'landing-hero-split', props: { ...common, media: media(config) } },
        {
          id: 'landing-feature-grid',
          props: { ...common, heading: 'Registered locations', features: features(config.content.items) },
        },
      ];
    case 'scene-portal-tunnel':
      return [{
        id: 'landing-process-steps',
        props: { ...common, steps: features(config.content.items) },
      }];
    case 'scene-kinetic-cards':
      return [{
        id: 'landing-bento-features',
        props: { ...common, features: features(config.content.items) },
      }];
  }
}

export function buildCreativeSceneMotion(config: CreativeSceneConfig): CreativeMotionConfig {
  switch (config.sceneId) {
    case 'scene-product-orbit':
      return { id: 'scene-orbit', interaction: 'drag' };
    case 'scene-product-explode':
    case 'scene-spatial-gallery':
    case 'scene-data-constellation':
    case 'scene-globe-network':
      return { id: 'scene-object-focus', stateCount: Math.max(1, config.content.items.length) };
    case 'scene-editorial-chapters':
      return { id: 'sticky-chapter', topPx: 80 };
    case 'scene-image-reveal-story':
      return { id: 'scene-scrub', start: 0, end: 1 };
    case 'scene-portal-tunnel':
      return { id: 'scene-camera-path', mode: 'scroll' };
    case 'scene-kinetic-cards':
      return { id: 'hover-lift', distancePx: 8 };
    default:
      return { id: 'reveal-fade', durationMs: 500, once: true };
  }
}

function callouts(config: CreativeSceneConfig) {
  return config.content.items.slice(0, 8).map((item, index) => ({
    id: item.id,
    label: item.title,
    body: item.description,
    x: item.x ?? 15 + ((index * 23) % 70),
    y: item.y ?? 20 + ((index * 19) % 60),
  }));
}

export function buildCreativeSceneEngine(
  config: CreativeSceneConfig,
): VisualEngineConfig | null {
  const engineId = CREATIVE_SCENE_CATALOG[config.sceneId].advancedModule;
  switch (engineId) {
    case 'canvas-particle-system':
      return {
        engineId,
        seed: config.seed,
        particleCount: config.density === 'sparse' ? 36 : config.density === 'dense' ? 120 : 72,
        linkCount: config.density === 'dense' ? 72 : 36,
        radius: 1.5,
        speed: config.preset === 'calm' ? 0.25 : config.preset === 'expressive' ? 0.8 : 0.5,
        color: '#4f46e5',
        background: '#ffffff',
      };
    case 'canvas-vector-field':
      return {
        engineId,
        seed: config.seed,
        columns: 24,
        rows: 14,
        forces: [{ x: 0.5, y: 0.5, strength: 0.8, radius: 0.4 }],
        lineLength: 12,
        color: '#4f46e5',
        background: '#ffffff',
      };
    case 'three-product-stage':
      return {
        engineId,
        modelAsset: MODEL_ASSET,
        posterAsset: RASTER_ASSET,
        triangleCount: 60_000,
        materialCount: 3,
        textureCount: 3,
        exposure: 1,
        callouts: callouts(config),
      };
    case 'three-model-orbit':
      return {
        engineId,
        modelAsset: MODEL_ASSET,
        posterAsset: RASTER_ASSET,
        triangleCount: 90_000,
        materialCount: 4,
        textureCount: 4,
        orbitRadius: 5,
        annotations: callouts(config),
      };
    case 'three-spatial-gallery':
      return {
        engineId,
        seed: config.seed,
        images: config.content.items.slice(0, 20).map((item) => ({
          id: item.id,
          assetRef: RASTER_ASSET,
          alt: item.title,
        })),
        spacing: 1.4,
      };
    case 'three-data-constellation': {
      const nodes = config.content.items.slice(0, 96).map((item, index) => ({
        id: item.id,
        label: item.title,
        value: Number.parseFloat(item.value ?? '') || index + 1,
        group: index % 4,
      }));
      return {
        engineId,
        seed: config.seed,
        nodes,
        edges: nodes.slice(1).map((node, index) => ({
          source: nodes[index].id,
          target: node.id,
          weight: 0.5,
        })),
        color: '#4f46e5',
      };
    }
    case 'shader-image-reveal':
      return {
        engineId,
        imageAsset: RASTER_ASSET,
        alt: config.content.heading,
        shaderId: 'image-soft-wipe-v1',
        uniforms: { progress: 0.5, softness: 0.12, displacement: 0.25, grain: 0.05 },
      };
    case 'shader-ambient-field':
      return {
        engineId,
        seed: config.seed,
        shaderId: 'ambient-flow-v1',
        uniforms: {
          scale: 2,
          speed: 0.35,
          warp: 0.6,
          noise: 0.45,
          colorA: '#4f46e5',
          colorB: '#0891b2',
        },
      };
    case null:
      return null;
  }
}

function SceneComposition({
  config,
  capabilities = {},
  className,
  style,
}: CreativeSceneCompositionProps) {
  const validation = validateCreativeSceneConfig(config);
  if (!validation.valid) {
    return (
      <section
        role="status"
        data-creative-scene-invalid={config.sceneId}
        className={className}
        style={style}
      >
        Creative scene configuration is invalid.
      </section>
    );
  }
  const metadata = CREATIVE_SCENE_CATALOG[config.sceneId];
  const projection = resolveCreativeSceneProjection(config, capabilities);
  const engine = buildCreativeSceneEngine(config);
  const viewport = capabilities.viewport ?? 'desktop';
  const semanticContent = (
    <CreativeMotionTarget config={buildCreativeSceneMotion(config)}>
      {buildCreativeSceneWidgets(config).map((widget, index) => (
        <LandingWidgetRenderer
          key={`${widget.id}-${index}`}
          config={widget}
          target={config.experienceMode}
        />
      ))}
    </CreativeMotionTarget>
  );

  return (
    <article
      className={className}
      style={style}
      data-creative-scene-id={config.sceneId}
      data-creative-scene-instance={config.instanceId}
      data-creative-scene-projection={projection.mode}
      data-creative-scene-fallback={projection.fallbackId}
      data-creative-scene-fallback-reason={projection.reason}
      data-creative-scene-signature={metadata.signature.compositionTopology}
      data-runtime-engine={metadata.runtimeEngine}
      data-cost-tier={metadata.costTier}
      data-authoring-tier={metadata.authoringTier}
    >
      {engine ? (
        <VisualEngineHost
          scenes={[engine]}
          viewport={viewport}
          enabled={projection.renderAdvancedModule}
          paused={projection.mode === 'fallback'}
          capabilityOverride={{
            viewport,
            visible: capabilities.visible,
            reducedMotion: capabilities.reducedMotion,
            saveData: capabilities.reducedData,
            forcedColors: capabilities.forcedColors,
            printing: capabilities.print,
            snapshot: capabilities.test || capabilities.server,
            webgl2: capabilities.advancedEngines,
          }}
        />
      ) : null}
      {semanticContent}
    </article>
  );
}

type SceneProps<Id extends CreativeSceneId> = Omit<CreativeSceneCompositionProps, 'config'> & {
  config: Extract<CreativeSceneConfig, { sceneId: Id }>;
};

function scene<Id extends CreativeSceneId>(expected: Id, props: SceneProps<Id>) {
  if (props.config.sceneId !== expected) return null;
  return <SceneComposition {...props} />;
}

export const SceneLayeredHero = (props: SceneProps<'scene-layered-hero'>) =>
  scene('scene-layered-hero', props);
export const SceneProductOrbit = (props: SceneProps<'scene-product-orbit'>) =>
  scene('scene-product-orbit', props);
export const SceneProductExplode = (props: SceneProps<'scene-product-explode'>) =>
  scene('scene-product-explode', props);
export const SceneEditorialChapters = (props: SceneProps<'scene-editorial-chapters'>) =>
  scene('scene-editorial-chapters', props);
export const SceneSpatialGallery = (props: SceneProps<'scene-spatial-gallery'>) =>
  scene('scene-spatial-gallery', props);
export const SceneDataConstellation = (props: SceneProps<'scene-data-constellation'>) =>
  scene('scene-data-constellation', props);
export const SceneGlobeNetwork = (props: SceneProps<'scene-globe-network'>) =>
  scene('scene-globe-network', props);
export const SceneAmbientLandscape = (props: SceneProps<'scene-ambient-landscape'>) =>
  scene('scene-ambient-landscape', props);
export const SceneImageRevealStory = (props: SceneProps<'scene-image-reveal-story'>) =>
  scene('scene-image-reveal-story', props);
export const ScenePortalTunnel = (props: SceneProps<'scene-portal-tunnel'>) =>
  scene('scene-portal-tunnel', props);
export const SceneKineticCards = (props: SceneProps<'scene-kinetic-cards'>) =>
  scene('scene-kinetic-cards', props);
export const SceneAmbientParticles = (props: SceneProps<'scene-ambient-particles'>) =>
  scene('scene-ambient-particles', props);

export const CREATIVE_SCENE_RENDERERS = {
  'scene-layered-hero': SceneLayeredHero,
  'scene-product-orbit': SceneProductOrbit,
  'scene-product-explode': SceneProductExplode,
  'scene-editorial-chapters': SceneEditorialChapters,
  'scene-spatial-gallery': SceneSpatialGallery,
  'scene-data-constellation': SceneDataConstellation,
  'scene-globe-network': SceneGlobeNetwork,
  'scene-ambient-landscape': SceneAmbientLandscape,
  'scene-image-reveal-story': SceneImageRevealStory,
  'scene-portal-tunnel': ScenePortalTunnel,
  'scene-kinetic-cards': SceneKineticCards,
  'scene-ambient-particles': SceneAmbientParticles,
} as const;

export function CreativeSceneRenderer(props: CreativeSceneCompositionProps) {
  return <SceneComposition {...props} />;
}

export function CreativeSceneCompositionProvider({
  config,
  capabilities,
  className,
  style,
}: CreativeSceneCompositionProps) {
  return (
    <CreativeMotionProvider
      experienceMode={config.experienceMode}
      viewport={capabilities?.viewport}
      paused={capabilities?.visible === false}
    >
      <CreativeSceneRenderer
        config={config}
        capabilities={capabilities}
        className={className}
        style={style}
      />
    </CreativeMotionProvider>
  );
}
