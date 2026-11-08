import { SHELL_EFFECT_CATALOG } from './catalog';
import { SHELL_EFFECT_IDS } from './types';
import type {
  ShellColorRef,
  ShellEffectFallback,
  ShellEffectLayerConfig,
  ShellEffectStackConfig,
  ShellEffectTarget,
  ShellEffectVariant,
  ShellViewport,
} from './types';

export type ShellEffectValidationCode =
  | 'stack.too-many-layers'
  | 'stack.duplicate-layer-id'
  | 'stack.motion-budget-exceeded'
  | 'layer.invalid-id'
  | 'layer.unknown-effect'
  | 'layer.unsupported-target'
  | 'layer.invalid-palette'
  | 'layer.invalid-seed'
  | 'layer.invalid-interaction'
  | 'config.invalid-value'
  | 'config.invalid-asset';

export type ShellEffectValidationIssue = {
  code: ShellEffectValidationCode;
  path: string;
  message: string;
};

export type ShellEffectValidationResult = {
  valid: boolean;
  issues: readonly ShellEffectValidationIssue[];
};

export type ShellEffectPreferences = {
  reducedMotion?: boolean;
  reducedTransparency?: boolean;
  reducedData?: boolean;
};

const LAYER_ID = /^layer-[a-z0-9-]{1,48}$/;
const LOCAL_ASSET =
  /^\/assets\/workspace\/[a-f0-9]{64}\.(?:png|jpg|jpeg|webp|avif|svg|ico)$/;
const HEX = /^#[0-9a-f]{6}$/i;
const EFFECT_IDS = new Set<string>(SHELL_EFFECT_IDS);

type UnionToIntersection<Union> = (
  Union extends unknown ? (value: Union) => void : never
) extends (value: infer Intersection) => void
  ? Intersection
  : never;
type ShellEffectConfigView = UnionToIntersection<ShellEffectVariant['config']>;

function inRange(value: unknown, min: number, max: number, step = 1, origin = min): boolean {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max &&
    (value - origin) % step === 0
  );
}

function oneOf<T>(value: unknown, values: readonly T[]): value is T {
  return values.includes(value as T);
}

function validColorRef(color: ShellColorRef): boolean {
  if (color.source === 'semantic') return true;
  const { value } = color;
  const [a, b, c] = value.components;
  const componentsValid =
    value.colorSpace === 'oklch'
      ? a >= 0 && a <= 1 && b >= 0 && b <= 0.4 && c >= 0 && c < 360
      : [a, b, c].every((component) => component >= 0 && component <= 1);
  return componentsValid && value.alpha >= 0 && value.alpha <= 1 && HEX.test(value.hex);
}

function validateConfig(layer: ShellEffectLayerConfig): string[] {
  // The effectId switch below guarantees which member is read from this correlated union.
  const config = layer.config as ShellEffectConfigView;
  switch (layer.effectId) {
    case 'animated-gradient':
      return [
        inRange(config.angle, 0, 345, 15, 0),
        inRange(config.duration, 8, 60),
        oneOf(config.stops, [2, 3, 4]),
      ].every(Boolean)
        ? []
        : ['angle, duration, or stops is outside the closed range'];
    case 'mesh-gradient':
      return [
        inRange(config.points, 3, 8),
        inRange(config.morph, 0, 100, 10, 0),
        inRange(config.blur, 16, 96, 8, 16),
      ].every(Boolean)
        ? []
        : ['points, morph, or blur is outside the closed range'];
    case 'aurora':
      return [
        inRange(config.bands, 1, 5),
        inRange(config.spread, 20, 100, 10, 20),
        inRange(config.wave, 0, 100, 10, 0),
      ].every(Boolean)
        ? []
        : ['bands, spread, or wave is outside the closed range'];
    case 'gradient-orbs':
      return [
        inRange(config.orbs, 1, 6),
        inRange(config.blur, 16, 96, 8, 16),
        inRange(config.drift, 0, 100, 10, 0),
      ].every(Boolean)
        ? []
        : ['orbs, blur, or drift is outside the closed range'];
    case 'floating-blobs':
      return [
        inRange(config.blobs, 1, 6),
        inRange(config.complexity, 3, 8),
        inRange(config.morph, 0, 100, 10, 0),
      ].every(Boolean)
        ? []
        : ['blobs, complexity, or morph is outside the closed range'];
    case 'flowing-waves':
      return [
        inRange(config.waves, 1, 8),
        inRange(config.amplitude, 4, 80, 4, 4),
        inRange(config.frequency, 1, 8),
      ].every(Boolean)
        ? []
        : ['waves, amplitude, or frequency is outside the closed range'];
    case 'light-rays':
      return [
        inRange(config.rays, 2, 12),
        inRange(config.spread, 10, 120, 10, 10),
        inRange(config.rotation, 0, 345, 15, 0),
      ].every(Boolean)
        ? []
        : ['rays, spread, or rotation is outside the closed range'];
    case 'conic-rays':
      return [
        inRange(config.rays, 4, 24, 2, 4),
        inRange(config.rotation, 0, 345, 15, 0),
        inRange(config.softness, 0, 100, 10, 0),
      ].every(Boolean)
        ? []
        : ['rays, rotation, or softness is outside the closed range'];
    case 'shimmer-bands':
      return [
        inRange(config.bands, 1, 5),
        inRange(config.width, 4, 40, 4, 4),
        inRange(config.angle, 0, 345, 15, 0),
      ].every(Boolean)
        ? []
        : ['bands, width, or angle is outside the closed range'];
    case 'film-grain':
      return [
        inRange(config.grain, 5, 100, 5, 5),
        typeof config.monochrome === 'boolean',
        oneOf(config.frameRate, [6, 12, 24]),
      ].every(Boolean)
        ? []
        : ['grain, monochrome, or frameRate is outside the closed range'];
    case 'particle-field':
      return [
        inRange(config.count, 10, 120),
        inRange(config.size, 1, 8),
        inRange(config.drift, 0, 100, 10, 0),
        typeof config.connections === 'boolean',
      ].every(Boolean)
        ? []
        : ['count, size, drift, or connections is outside the closed range'];
    case 'starfield':
      return [
        inRange(config.count, 10, 120),
        inRange(config.twinkle, 0, 100, 10, 0),
        inRange(config.depth, 1, 5),
      ].every(Boolean)
        ? []
        : ['count, twinkle, or depth is outside the closed range'];
    case 'animated-dot-field':
      return [
        inRange(config.count, 10, 120),
        inRange(config.size, 1, 8),
        inRange(config.pulse, 0, 100, 10, 0),
      ].every(Boolean)
        ? []
        : ['count, size, or pulse is outside the closed range'];
    case 'perspective-grid':
      return [
        inRange(config.spacing, 8, 64, 8, 8),
        inRange(config.perspective, 100, 1200, 100, 100),
        inRange(config.horizon, 10, 90, 10, 10),
      ].every(Boolean)
        ? []
        : ['spacing, perspective, or horizon is outside the closed range'];
    case 'floating-geometry':
      return [
        inRange(config.shapes, 1, 12),
        inRange(config.rotation, 0, 100, 10, 0),
        inRange(config.drift, 0, 100, 10, 0),
      ].every(Boolean)
        ? []
        : ['shapes, rotation, or drift is outside the closed range'];
    case 'image-depth-pan':
      return [
        inRange(config.zoom, 100, 130, 5, 100),
        inRange(config.pan, 0, 100, 10, 0),
        inRange(config.focalX, 0, 100),
        inRange(config.focalY, 0, 100),
      ].every(Boolean)
        ? LOCAL_ASSET.test(config.assetRef)
          ? []
          : ['assetRef']
        : ['zoom, pan, focalX, or focalY is outside the closed range'];
    case 'scroll-parallax':
      return [
        inRange(config.layers, 2, 6),
        inRange(config.depth, 1, 5),
        oneOf(config.axis, ['x', 'y', 'both']),
        inRange(config.range, 10, 100, 10, 10),
      ].every(Boolean)
        ? []
        : ['layers, depth, axis, or range is outside the closed range'];
    case 'pointer-parallax':
      return [
        inRange(config.layers, 2, 6),
        inRange(config.depth, 1, 5),
        inRange(config.lag, 0, 100, 10, 0),
        inRange(config.range, 4, 48, 4, 4),
      ].every(Boolean)
        ? []
        : ['layers, depth, lag, or range is outside the closed range'];
    case 'cursor-spotlight':
      return [
        inRange(config.radius, 40, 400, 20, 40),
        inRange(config.softness, 0, 100, 10, 0) || config.softness === 35,
        inRange(config.lag, 0, 100, 10, 0) || config.lag === 15,
      ].every(Boolean)
        ? []
        : ['radius, softness, or lag is outside the closed range'];
    case 'section-reveal':
      return [
        oneOf(config.style, ['fade', 'slide', 'scale', 'mask']),
        inRange(config.distance, 0, 64, 8, 0),
        inRange(config.stagger, 0, 300, 50, 0),
        oneOf(config.threshold, [0.1, 0.25, 0.5, 0.75]),
        typeof config.once === 'boolean',
      ].every(Boolean)
        ? []
        : ['style, distance, stagger, threshold, or once is outside the closed range'];
  }
}

export function resolveShellEffectFallback(
  layer: ShellEffectLayerConfig,
  viewport: ShellViewport,
  requested: ShellEffectFallback = 'runtime',
  preferences: ShellEffectPreferences = {},
): ShellEffectFallback {
  if (requested !== 'runtime') return requested;
  if (!layer.visibility[viewport]) return 'hidden';
  if (viewport === 'phone' && SHELL_EFFECT_CATALOG[layer.effectId].costTier === 'high') return 'static';
  if (preferences.reducedMotion) return SHELL_EFFECT_CATALOG[layer.effectId].reducedMotion;
  if (preferences.reducedData && SHELL_EFFECT_CATALOG[layer.effectId].costTier !== 'low') {
    return 'simplified';
  }
  if (
    preferences.reducedTransparency &&
    (layer.opacity === 'visible' || layer.opacity === 'strong')
  ) {
    return 'simplified';
  }
  return 'runtime';
}

export function getShellEffectMovingUnits(
  layer: ShellEffectLayerConfig,
  viewport: ShellViewport,
  fallback: ShellEffectFallback = 'runtime',
): number {
  const effectiveFallback = resolveShellEffectFallback(layer, viewport, fallback);
  if (effectiveFallback === 'hidden' || effectiveFallback === 'static' || layer.speed === 'still') {
    return 0;
  }
  return SHELL_EFFECT_CATALOG[layer.effectId].costTier === 'high' ? 2 : 1;
}

export function getShellEffectStackCost(
  layers: readonly ShellEffectLayerConfig[],
  viewport: ShellViewport,
  fallback: ShellEffectFallback = 'runtime',
): {
  units: number;
  limit: 1 | 2 | 3;
  withinBudget: boolean;
  byLayer: readonly { id: string; units: number }[];
} {
  const limit = viewport === 'desktop' ? 3 : viewport === 'tablet' ? 2 : 1;
  const byLayer = layers.map((layer) => ({
    id: layer.id,
    units: getShellEffectMovingUnits(layer, viewport, fallback),
  }));
  const units = byLayer.reduce((sum, layer) => sum + layer.units, 0);
  return { units, limit, withinBudget: units <= limit, byLayer };
}

export function validateShellEffectLayer(layer: ShellEffectLayerConfig): ShellEffectValidationResult {
  const issues: ShellEffectValidationIssue[] = [];
  if (!LAYER_ID.test(layer.id)) {
    issues.push({ code: 'layer.invalid-id', path: 'id', message: 'Layer ID is not safe.' });
  }
  if (!EFFECT_IDS.has(layer.effectId)) {
    issues.push({
      code: 'layer.unknown-effect',
      path: 'effectId',
      message: 'Effect ID is not in the closed catalog.',
    });
    return { valid: false, issues };
  }
  const meta = SHELL_EFFECT_CATALOG[layer.effectId];
  if (!meta.targets.includes(layer.target)) {
    issues.push({
      code: 'layer.unsupported-target',
      path: 'target',
      message: `${layer.effectId} does not support ${layer.target}.`,
    });
  }
  if (
    layer.palette.length < 1 ||
    layer.palette.length > 4 ||
    !layer.palette.every(validColorRef)
  ) {
    issues.push({
      code: 'layer.invalid-palette',
      path: 'palette',
      message: 'Palette must contain one to four safe semantic or structured colors.',
    });
  }
  if (!Number.isInteger(layer.seed) || layer.seed < 0 || layer.seed > 2_147_483_647) {
    issues.push({
      code: 'layer.invalid-seed',
      path: 'seed',
      message: 'Seed must be an integer from 0 through 2147483647.',
    });
  }
  const requiredInteraction =
    layer.effectId === 'pointer-parallax' || layer.effectId === 'cursor-spotlight'
      ? 'pointer'
      : layer.effectId === 'scroll-parallax' || layer.effectId === 'section-reveal'
        ? 'scroll'
        : null;
  if (requiredInteraction && layer.interaction !== requiredInteraction) {
    issues.push({
      code: 'layer.invalid-interaction',
      path: 'interaction',
      message: `${layer.effectId} requires ${requiredInteraction} interaction.`,
    });
  }
  const configErrors = validateConfig(layer);
  for (const error of configErrors) {
    issues.push({
      code: error === 'assetRef' ? 'config.invalid-asset' : 'config.invalid-value',
      path: error === 'assetRef' ? 'config.assetRef' : 'config',
      message:
        error === 'assetRef'
          ? 'Image effects accept only sanitized local workspace assets.'
          : error,
    });
  }
  return { valid: issues.length === 0, issues };
}

export function validateShellEffectStack(
  stack: ShellEffectStackConfig,
  viewport?: ShellViewport,
): ShellEffectValidationResult {
  const issues: ShellEffectValidationIssue[] = [];
  if (stack.layers.length > 4) {
    issues.push({
      code: 'stack.too-many-layers',
      path: 'layers',
      message: 'Effect stacks support at most four layers.',
    });
  }
  const seen = new Set<string>();
  stack.layers.forEach((layer, index) => {
    if (seen.has(layer.id)) {
      issues.push({
        code: 'stack.duplicate-layer-id',
        path: `layers.${index}.id`,
        message: `Duplicate layer ID ${layer.id}.`,
      });
    }
    seen.add(layer.id);
    const result = validateShellEffectLayer(layer);
    result.issues.forEach((issue) =>
      issues.push({ ...issue, path: `layers.${index}.${issue.path}` }),
    );
  });
  const viewports = viewport ? [viewport] : (['desktop', 'tablet', 'phone'] as const);
  viewports.forEach((candidate) => {
    const cost = getShellEffectStackCost(stack.layers, candidate);
    if (!cost.withinBudget) {
      issues.push({
        code: 'stack.motion-budget-exceeded',
        path: 'layers',
        message: `${candidate} uses ${cost.units} moving units; maximum is ${cost.limit}.`,
      });
    }
  });
  return { valid: issues.length === 0, issues };
}

export function effectSupportsTarget(effectId: string, target: ShellEffectTarget): boolean {
  return EFFECT_IDS.has(effectId) && SHELL_EFFECT_CATALOG[effectId as keyof typeof SHELL_EFFECT_CATALOG].targets.includes(target);
}

