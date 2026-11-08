import { CREATIVE_SCENE_CATALOG, sceneSupportsExperience } from './catalog';
import { CREATIVE_SCENE_IDS } from './types';
import type {
  CreativeSceneConfig,
  CreativeSceneExperience,
  CreativeSceneId,
  CreativeSceneItem,
} from './types';

export const CREATIVE_SCENE_FIXTURE_ASSET =
  '/assets/workspace/c6209123bc7fe941c7dff953e6c35f232ff69336f7409566d6d14b769793120f.svg';

const COPY: Readonly<
  Record<CreativeSceneId, { eyebrow: string; heading: string; body: string }>
> = {
  'scene-layered-hero': {
    eyebrow: 'Creative platform',
    heading: 'Build a clear story with depth',
    body: 'Semantic copy stays readable while optional visual layers add atmosphere.',
  },
  'scene-product-orbit': {
    eyebrow: 'Product detail',
    heading: 'Explore every important angle',
    body: 'Product callouts remain available beside a canonical poster when 3D is unavailable.',
  },
  'scene-product-explode': {
    eyebrow: 'Product anatomy',
    heading: 'Understand how each part contributes',
    body: 'Ordered annotations explain the assembly without depending on an interactive model.',
  },
  'scene-editorial-chapters': {
    eyebrow: 'Editorial story',
    heading: 'Follow the story chapter by chapter',
    body: 'Progressive media supports a linear article that works in every rendering mode.',
  },
  'scene-spatial-gallery': {
    eyebrow: 'Selected work',
    heading: 'Browse a spatial media collection',
    body: 'Every local image has a persistent caption and an accessible grid projection.',
  },
  'scene-data-constellation': {
    eyebrow: 'Connected insights',
    heading: 'See the relationships behind the numbers',
    body: 'Labeled nodes are paired with a semantic list and readable metric values.',
  },
  'scene-globe-network': {
    eyebrow: 'Global network',
    heading: 'Discover the places in our network',
    body: 'Registered locations remain available as a labeled list and local map poster.',
  },
  'scene-ambient-landscape': {
    eyebrow: 'Open horizon',
    heading: 'Create room for an important message',
    body: 'An abstract field stays decorative while the content remains ordinary document text.',
  },
  'scene-image-reveal-story': {
    eyebrow: 'Visual narrative',
    heading: 'Reveal the story through local imagery',
    body: 'Normal images and chapter copy remain visible when shader transitions are unavailable.',
  },
  'scene-portal-tunnel': {
    eyebrow: 'Guided journey',
    heading: 'Move through a sequence of clear milestones',
    body: 'A linear chapter stack preserves the journey without a fixed camera.',
  },
  'scene-kinetic-cards': {
    eyebrow: 'Focused capabilities',
    heading: 'Explore a bounded field of useful ideas',
    body: 'Keyboard-accessible cards remain a stable bento grid without motion.',
  },
  'scene-ambient-particles': {
    eyebrow: 'Calm momentum',
    heading: 'Keep the message in the foreground',
    body: 'Seeded particles are decorative and project to a deterministic static SVG field.',
  },
};

function items(count: number, withAssets = false, withValues = false): readonly CreativeSceneItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index + 1}`,
    title: `Chapter ${index + 1}`,
    description: `A concise semantic description for item ${index + 1}.`,
    ...(withValues ? { value: `${(index + 1) * 12}%` } : {}),
    ...(withAssets ? { assetRef: CREATIVE_SCENE_FIXTURE_ASSET } : {}),
    x: 15 + ((index * 23) % 70),
    y: 20 + ((index * 19) % 60),
  }));
}

const ITEM_COUNTS: Readonly<Record<CreativeSceneId, number>> = {
  'scene-layered-hero': 0,
  'scene-product-orbit': 3,
  'scene-product-explode': 4,
  'scene-editorial-chapters': 4,
  'scene-spatial-gallery': 6,
  'scene-data-constellation': 6,
  'scene-globe-network': 5,
  'scene-ambient-landscape': 0,
  'scene-image-reveal-story': 4,
  'scene-portal-tunnel': 4,
  'scene-kinetic-cards': 6,
  'scene-ambient-particles': 0,
};

const ASSET_SCENES = new Set<CreativeSceneId>([
  'scene-product-orbit',
  'scene-product-explode',
  'scene-spatial-gallery',
  'scene-globe-network',
  'scene-image-reveal-story',
  'scene-portal-tunnel',
]);

export function createCreativeSceneFixture(
  sceneId: CreativeSceneId,
  experienceMode: CreativeSceneExperience = 'site',
): CreativeSceneConfig {
  if (!sceneSupportsExperience(sceneId, experienceMode)) {
    throw new Error(`${sceneId} is not compatible with ${experienceMode}.`);
  }
  const metadata = CREATIVE_SCENE_CATALOG[sceneId];
  const copy = COPY[sceneId];
  const withAssets = ASSET_SCENES.has(sceneId);
  return {
    instanceId: `scene-instance-${sceneId.slice('scene-'.length)}`,
    sceneId,
    experienceMode,
    host: metadata.allowedHosts[0],
    plane: 'background',
    preset: 'balanced',
    palette: ['surface', 'surface-foreground', 'accent'],
    density: 'normal',
    interaction: metadata.interaction,
    seed: 41,
    ...(withAssets ? { fallbackAsset: CREATIVE_SCENE_FIXTURE_ASSET } : {}),
    content: {
      ...copy,
      ...(withAssets ? { posterAsset: CREATIVE_SCENE_FIXTURE_ASSET } : {}),
      items: items(
        ITEM_COUNTS[sceneId],
        withAssets,
        sceneId === 'scene-data-constellation',
      ),
      actions: [
        { id: 'learn-more', label: 'Learn more', href: '/learn-more' },
      ],
    },
  } as CreativeSceneConfig;
}

export const CREATIVE_SCENE_FIXTURES = CREATIVE_SCENE_IDS.map((sceneId) =>
  createCreativeSceneFixture(sceneId),
);

export const CREATIVE_SCENE_FIXTURE_BY_ID = Object.fromEntries(
  CREATIVE_SCENE_FIXTURES.map((fixture) => [fixture.sceneId, fixture]),
) as Readonly<Record<CreativeSceneId, CreativeSceneConfig>>;
