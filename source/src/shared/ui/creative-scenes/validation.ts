import {
  CREATIVE_SCENE_APP_ALLOWLIST,
  CREATIVE_SCENE_CATALOG,
  sceneSupportsExperience,
} from './catalog';
import { CREATIVE_SCENE_IDS } from './types';
import type {
  CreativeSceneCapabilities,
  CreativeSceneConfig,
  CreativeSceneExperience,
  CreativeSceneProjection,
  CreativeSceneSemanticColor,
} from './types';

export type CreativeSceneValidationCode =
  | 'scene.invalid-object'
  | 'scene.unknown-field'
  | 'scene.invalid-instance-id'
  | 'scene.unknown-id'
  | 'scene.incompatible-experience'
  | 'scene.unsupported-host'
  | 'scene.invalid-plane'
  | 'scene.invalid-preset'
  | 'scene.invalid-density'
  | 'scene.invalid-interaction'
  | 'scene.invalid-seed'
  | 'scene.invalid-palette'
  | 'scene.invalid-content'
  | 'scene.invalid-asset'
  | 'host.too-many-scenes'
  | 'host.duplicate-instance-id'
  | 'host.duplicate-foreground';

export type CreativeSceneValidationIssue = {
  code: CreativeSceneValidationCode;
  path: string;
  message: string;
};

export type CreativeSceneValidationResult = {
  valid: boolean;
  issues: readonly CreativeSceneValidationIssue[];
};

const IDS = new Set<string>(CREATIVE_SCENE_IDS);
const APP_IDS = new Set<string>(CREATIVE_SCENE_APP_ALLOWLIST);
const INSTANCE_ID = /^scene-instance-[a-z0-9-]{1,48}$/;
const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,47}$/;
const LOCAL_ASSET =
  /^\/assets\/workspace\/[a-f0-9]{64}\.(?:png|jpg|jpeg|webp|avif|svg)$/;
const LOCAL_HREF = /^(?:\/[a-zA-Z0-9/_?&=.%#-]*|#[a-zA-Z0-9_-]+)$/;
const PALETTE = new Set<CreativeSceneSemanticColor>([
  'surface',
  'surface-elevated',
  'surface-foreground',
  'surface-muted',
  'accent',
  'neutral',
  'info',
  'success',
  'warning',
]);
const TOP_LEVEL_FIELDS = new Set([
  'instanceId',
  'sceneId',
  'experienceMode',
  'host',
  'plane',
  'preset',
  'palette',
  'density',
  'interaction',
  'seed',
  'fallbackAsset',
  'content',
]);
const CONTENT_FIELDS = new Set([
  'eyebrow',
  'heading',
  'body',
  'posterAsset',
  'items',
  'actions',
]);
const ITEM_FIELDS = new Set(['id', 'title', 'description', 'value', 'assetRef', 'x', 'y']);
const ACTION_FIELDS = new Set(['id', 'label', 'href']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedText(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && value.trim().length >= min && value.length <= max;
}

function unknownFields(value: Record<string, unknown>, allowed: ReadonlySet<string>): string[] {
  return Object.keys(value).filter((key) => !allowed.has(key));
}

function issue(
  issues: CreativeSceneValidationIssue[],
  code: CreativeSceneValidationCode,
  path: string,
  message: string,
): void {
  issues.push({ code, path, message });
}

export function validateCreativeSceneConfig(value: unknown): CreativeSceneValidationResult {
  const issues: CreativeSceneValidationIssue[] = [];
  if (!isRecord(value)) {
    return {
      valid: false,
      issues: [
        {
          code: 'scene.invalid-object',
          path: '',
          message: 'Creative scene config must be a closed object.',
        },
      ],
    };
  }

  for (const field of unknownFields(value, TOP_LEVEL_FIELDS)) {
    issue(issues, 'scene.unknown-field', field, `Unknown creative scene field ${field}.`);
  }
  if (typeof value.instanceId !== 'string' || !INSTANCE_ID.test(value.instanceId)) {
    issue(
      issues,
      'scene.invalid-instance-id',
      'instanceId',
      'Instance ID must use the scene-instance-* format.',
    );
  }
  if (typeof value.sceneId !== 'string' || !IDS.has(value.sceneId)) {
    issue(issues, 'scene.unknown-id', 'sceneId', 'Scene ID is not in the frozen catalog.');
    return { valid: false, issues };
  }

  const sceneId = value.sceneId as keyof typeof CREATIVE_SCENE_CATALOG;
  const metadata = CREATIVE_SCENE_CATALOG[sceneId];
  if (value.experienceMode !== 'site' && value.experienceMode !== 'app') {
    issue(
      issues,
      'scene.incompatible-experience',
      'experienceMode',
      'Experience mode must be site or app.',
    );
  } else if (!sceneSupportsExperience(sceneId, value.experienceMode)) {
    issue(
      issues,
      'scene.incompatible-experience',
      'experienceMode',
      `${sceneId} is not in the exact app allowlist.`,
    );
  }
  if (
    typeof value.host !== 'string' ||
    !metadata.allowedHosts.includes(value.host as never)
  ) {
    issue(
      issues,
      'scene.unsupported-host',
      'host',
      `${sceneId} does not support the selected host.`,
    );
  }
  if (value.plane !== 'background' && value.plane !== 'foreground') {
    issue(issues, 'scene.invalid-plane', 'plane', 'Plane must be background or foreground.');
  }
  if (!['calm', 'balanced', 'expressive'].includes(value.preset as string)) {
    issue(issues, 'scene.invalid-preset', 'preset', 'Preset is outside the closed set.');
  }
  if (!['sparse', 'normal', 'dense'].includes(value.density as string)) {
    issue(issues, 'scene.invalid-density', 'density', 'Density is outside the closed set.');
  }
  if (value.interaction !== metadata.interaction) {
    issue(
      issues,
      'scene.invalid-interaction',
      'interaction',
      `${sceneId} requires ${metadata.interaction} interaction.`,
    );
  }
  if (
    typeof value.seed !== 'number' ||
    !Number.isInteger(value.seed) ||
    value.seed < 0 ||
    value.seed > 2_147_483_647
  ) {
    issue(
      issues,
      'scene.invalid-seed',
      'seed',
      'Seed must be an integer from 0 through 2147483647.',
    );
  }
  if (
    !Array.isArray(value.palette) ||
    value.palette.length < 1 ||
    value.palette.length > 4 ||
    !value.palette.every((color) => typeof color === 'string' && PALETTE.has(color as never))
  ) {
    issue(
      issues,
      'scene.invalid-palette',
      'palette',
      'Palette must contain one to four registered semantic colors.',
    );
  }
  for (const assetField of ['fallbackAsset'] as const) {
    const asset = value[assetField];
    if (asset !== undefined && (typeof asset !== 'string' || !LOCAL_ASSET.test(asset))) {
      issue(
        issues,
        'scene.invalid-asset',
        assetField,
        'Scene assets must be sanitized local workspace assets.',
      );
    }
  }

  if (!isRecord(value.content)) {
    issue(issues, 'scene.invalid-content', 'content', 'Scene content must be a closed object.');
    return { valid: false, issues };
  }
  const content = value.content;
  for (const field of unknownFields(content, CONTENT_FIELDS)) {
    issue(
      issues,
      'scene.unknown-field',
      `content.${field}`,
      `Unknown scene content field ${field}.`,
    );
  }
  if (
    !boundedText(content.heading, 1, 120) ||
    !boundedText(content.body, 1, 600) ||
    (content.eyebrow !== undefined && !boundedText(content.eyebrow, 1, 60))
  ) {
    issue(
      issues,
      'scene.invalid-content',
      'content',
      'Heading, body, or eyebrow exceeds the closed text bounds.',
    );
  }
  if (
    content.posterAsset !== undefined &&
    (typeof content.posterAsset !== 'string' || !LOCAL_ASSET.test(content.posterAsset))
  ) {
    issue(
      issues,
      'scene.invalid-asset',
      'content.posterAsset',
      'Poster must be a sanitized local workspace asset.',
    );
  }

  const [minItems, maxItems] = metadata.itemBounds;
  if (
    !Array.isArray(content.items) ||
    content.items.length < minItems ||
    content.items.length > maxItems
  ) {
    issue(
      issues,
      'scene.invalid-content',
      'content.items',
      `${sceneId} requires ${minItems} through ${maxItems} semantic items.`,
    );
  } else {
    const itemIds = new Set<string>();
    content.items.forEach((candidate, index) => {
      const path = `content.items.${index}`;
      if (!isRecord(candidate)) {
        issue(issues, 'scene.invalid-content', path, 'Scene item must be a closed object.');
        return;
      }
      for (const field of unknownFields(candidate, ITEM_FIELDS)) {
        issue(issues, 'scene.unknown-field', `${path}.${field}`, `Unknown item field ${field}.`);
      }
      if (
        typeof candidate.id !== 'string' ||
        !SAFE_ID.test(candidate.id) ||
        itemIds.has(candidate.id) ||
        !boundedText(candidate.title, 1, 80) ||
        !boundedText(candidate.description, 1, 300) ||
        (candidate.value !== undefined && !boundedText(candidate.value, 1, 40))
      ) {
        issue(issues, 'scene.invalid-content', path, 'Scene item is invalid or duplicated.');
      }
      if (typeof candidate.id === 'string') itemIds.add(candidate.id);
      if (
        candidate.assetRef !== undefined &&
        (typeof candidate.assetRef !== 'string' || !LOCAL_ASSET.test(candidate.assetRef))
      ) {
        issue(
          issues,
          'scene.invalid-asset',
          `${path}.assetRef`,
          'Item asset must be a sanitized local workspace asset.',
        );
      }
      for (const coordinate of ['x', 'y'] as const) {
        const coordinateValue = candidate[coordinate];
        if (
          coordinateValue !== undefined &&
          (typeof coordinateValue !== 'number' ||
            !Number.isFinite(coordinateValue) ||
            coordinateValue < 0 ||
            coordinateValue > 100)
        ) {
          issue(
            issues,
            'scene.invalid-content',
            `${path}.${coordinate}`,
            'Coordinates must be finite percentages from 0 through 100.',
          );
        }
      }
    });
  }

  if (!Array.isArray(content.actions) || content.actions.length > 2) {
    issue(
      issues,
      'scene.invalid-content',
      'content.actions',
      'Scene content accepts at most two actions.',
    );
  } else {
    content.actions.forEach((candidate, index) => {
      const path = `content.actions.${index}`;
      if (!isRecord(candidate)) {
        issue(issues, 'scene.invalid-content', path, 'Scene action must be a closed object.');
        return;
      }
      for (const field of unknownFields(candidate, ACTION_FIELDS)) {
        issue(issues, 'scene.unknown-field', `${path}.${field}`, `Unknown action field ${field}.`);
      }
      if (
        typeof candidate.id !== 'string' ||
        !SAFE_ID.test(candidate.id) ||
        !boundedText(candidate.label, 1, 40) ||
        typeof candidate.href !== 'string' ||
        !LOCAL_HREF.test(candidate.href)
      ) {
        issue(
          issues,
          'scene.invalid-content',
          path,
          'Scene actions require safe IDs, bounded labels, and local routes.',
        );
      }
    });
  }

  return { valid: issues.length === 0, issues };
}

export function validateCreativeSceneHost(
  scenes: readonly unknown[],
  experienceMode: CreativeSceneExperience,
): CreativeSceneValidationResult {
  const issues: CreativeSceneValidationIssue[] = [];
  if (scenes.length > 3) {
    issue(issues, 'host.too-many-scenes', 'scenes', 'A document supports at most three scenes.');
  }
  const instanceIds = new Set<string>();
  const foregroundHosts = new Set<string>();
  scenes.forEach((scene, index) => {
    const result = validateCreativeSceneConfig(scene);
    result.issues.forEach((entry) =>
      issues.push({ ...entry, path: `scenes.${index}.${entry.path}` }),
    );
    if (!isRecord(scene)) return;
    if (typeof scene.instanceId === 'string') {
      if (instanceIds.has(scene.instanceId)) {
        issue(
          issues,
          'host.duplicate-instance-id',
          `scenes.${index}.instanceId`,
          `Duplicate scene instance ${scene.instanceId}.`,
        );
      }
      instanceIds.add(scene.instanceId);
    }
    if (scene.experienceMode !== experienceMode) {
      issue(
        issues,
        'scene.incompatible-experience',
        `scenes.${index}.experienceMode`,
        'Scene experience must match its composition host.',
      );
    }
    if (scene.plane === 'foreground' && typeof scene.host === 'string') {
      if (foregroundHosts.has(scene.host)) {
        issue(
          issues,
          'host.duplicate-foreground',
          `scenes.${index}.plane`,
          `Only one foreground scene may target ${scene.host}.`,
        );
      }
      foregroundHosts.add(scene.host);
    }
  });
  return { valid: issues.length === 0, issues };
}

export function resolveCreativeSceneProjection(
  config: CreativeSceneConfig,
  capabilities: CreativeSceneCapabilities = {},
): CreativeSceneProjection {
  const metadata = CREATIVE_SCENE_CATALOG[config.sceneId];
  const fallback = (reason: CreativeSceneProjection['reason']): CreativeSceneProjection => ({
    mode: 'fallback',
    fallbackId: metadata.fallbackId,
    reason,
    renderAdvancedModule: false,
  });
  if (capabilities.server ?? typeof window === 'undefined') return fallback('server');
  if (capabilities.test) return fallback('test');
  if (capabilities.print) return fallback('print');
  if (capabilities.forcedColors) return fallback('forced-colors');
  if (capabilities.reducedData) return fallback('reduced-data');
  if (capabilities.reducedMotion) return fallback('reduced-motion');
  if (capabilities.viewport === 'phone' && metadata.costTier !== 'medium') return fallback('phone');
  if (capabilities.visible === false) return fallback('offscreen');
  if (capabilities.budgetEligible === false) return fallback('budget');
  if (metadata.advancedModule && capabilities.advancedEngines === false && !metadata.moduleOptional) {
    return fallback('engine-unavailable');
  }
  return {
    mode: 'primary',
    fallbackId: metadata.fallbackId,
    reason: 'none',
    renderAdvancedModule: Boolean(metadata.advancedModule && capabilities.advancedEngines !== false),
  };
}

export function isCreativeSceneAppCompatible(sceneId: string): boolean {
  return APP_IDS.has(sceneId);
}
