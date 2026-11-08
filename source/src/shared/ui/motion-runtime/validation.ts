import { CREATIVE_MOTION_CATALOG } from './catalog';
import { CREATIVE_MOTION_IDS } from './types';
import type {
  AuthoringTier,
  CostTier,
  CreativeMotionConfig,
  CreativeMotionId,
  CreativeMotionMetadata,
  RuntimeEngine,
} from './types';

export type CreativeMotionValidation =
  | { valid: true; config: CreativeMotionConfig }
  | { valid: false; errors: readonly string[] };

type FieldRule =
  | { kind: 'number'; min: number; max: number; integer?: boolean; required?: boolean }
  | { kind: 'enum'; values: readonly unknown[]; required?: boolean };

const COMMON_REVEAL = {
  durationMs: { kind: 'number', min: 80, max: 2_000 },
  delayMs: { kind: 'number', min: 0, max: 1_000 },
  threshold: { kind: 'number', min: 0, max: 1 },
  once: { kind: 'enum', values: [true, false] },
} satisfies Record<string, FieldRule>;

const RULES: Readonly<Record<CreativeMotionId, Readonly<Record<string, FieldRule>>>> = {
  'reveal-fade': COMMON_REVEAL,
  'reveal-slide': {
    ...COMMON_REVEAL,
    distancePx: { kind: 'number', min: 0, max: 96 },
    axis: { kind: 'enum', values: ['x', 'y'] },
    direction: { kind: 'enum', values: [-1, 1] },
  },
  'reveal-scale': {
    ...COMMON_REVEAL,
    fromScale: { kind: 'number', min: 0.7, max: 1 },
  },
  'reveal-mask': {
    ...COMMON_REVEAL,
    direction: { kind: 'enum', values: ['top', 'right', 'bottom', 'left'] },
  },
  'reveal-stagger': {
    ...COMMON_REVEAL,
    itemCount: { kind: 'number', min: 1, max: 24, integer: true, required: true },
    staggerMs: { kind: 'number', min: 0, max: 240 },
  },
  'metric-count-up': {
    from: { kind: 'number', min: -1_000_000_000, max: 1_000_000_000 },
    to: { kind: 'number', min: -1_000_000_000, max: 1_000_000_000, required: true },
    durationMs: { kind: 'number', min: 100, max: 5_000 },
    decimals: { kind: 'number', min: 0, max: 4, integer: true },
  },
  'hover-lift': {
    distancePx: { kind: 'number', min: 0, max: 24 },
    durationMs: { kind: 'number', min: 80, max: 600 },
  },
  'pointer-tilt': {
    maxDegrees: { kind: 'number', min: 0, max: 18 },
    perspectivePx: { kind: 'number', min: 300, max: 2_000 },
    smoothing: { kind: 'number', min: 0.05, max: 1 },
  },
  'pointer-attract': {
    maxDistancePx: { kind: 'number', min: 0, max: 32 },
    smoothing: { kind: 'number', min: 0.05, max: 1 },
  },
  'track-marquee': {
    durationMs: { kind: 'number', min: 4_000, max: 60_000 },
    direction: { kind: 'enum', values: [-1, 1] },
  },
  'scroll-progress': { axis: { kind: 'enum', values: ['x', 'y'] } },
  'scroll-parallax-layers': {
    depthPx: { kind: 'number', min: 0, max: 120 },
    layerCount: { kind: 'number', min: 2, max: 8, integer: true, required: true },
  },
  'sticky-chapter': { topPx: { kind: 'number', min: 0, max: 240 } },
  'scene-scrub': {
    start: { kind: 'number', min: 0, max: 1 },
    end: { kind: 'number', min: 0, max: 1 },
  },
  'scene-camera-path': {
    durationMs: { kind: 'number', min: 1_000, max: 60_000 },
    mode: { kind: 'enum', values: ['scroll', 'time'] },
  },
  'scene-orbit': {
    durationMs: { kind: 'number', min: 1_000, max: 60_000 },
    interaction: { kind: 'enum', values: ['drag', 'time'] },
  },
  'scene-object-focus': {
    stateCount: { kind: 'number', min: 1, max: 16, integer: true, required: true },
    initialState: { kind: 'number', min: 0, max: 15, integer: true },
  },
  'route-crossfade': { durationMs: { kind: 'number', min: 80, max: 800 } },
};

const VALID_TUPLES: ReadonlySet<string> = new Set([
  'static:low:core',
  'css-svg:low:core',
  'css-svg:medium:core',
  'orchestrated-dom:medium:enhanced',
  'orchestrated-dom:high:enhanced',
  'canvas-2d:high:enhanced',
  'webgl-three:high:advanced',
  'webgl-three:extreme:advanced',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isCreativeMotionId(value: unknown): value is CreativeMotionId {
  return typeof value === 'string' && (CREATIVE_MOTION_IDS as readonly string[]).includes(value);
}

export function validateCreativeMotionMetadata(metadata: CreativeMotionMetadata): readonly string[] {
  const errors: string[] = [];
  const tuple = `${metadata.runtimeEngine}:${metadata.costTier}:${metadata.authoringTier}`;
  if (!VALID_TUPLES.has(tuple)) errors.push(`Invalid runtime/cost/authoring tuple: ${tuple}`);
  if (metadata.id !== CREATIVE_MOTION_CATALOG[metadata.id]?.id) errors.push('Unknown metadata ID');
  return errors;
}

export function isValidRuntimeTuple(
  runtimeEngine: RuntimeEngine,
  costTier: CostTier,
  authoringTier: AuthoringTier,
): boolean {
  return VALID_TUPLES.has(`${runtimeEngine}:${costTier}:${authoringTier}`);
}

export function validateCreativeMotionConfig(value: unknown): CreativeMotionValidation {
  if (!isRecord(value) || !isCreativeMotionId(value.id)) {
    return { valid: false, errors: ['Motion config must have a registered id'] };
  }
  const rules = RULES[value.id];
  const allowed = new Set(['id', ...Object.keys(rules)]);
  const errors = Object.keys(value)
    .filter((key) => !allowed.has(key))
    .map((key) => `Unknown field "${key}"`);

  for (const [field, rule] of Object.entries(rules)) {
    const fieldValue = value[field];
    if (fieldValue === undefined) {
      if (rule.required) errors.push(`Missing required field "${field}"`);
      continue;
    }
    if (rule.kind === 'number') {
      if (
        typeof fieldValue !== 'number'
        || !Number.isFinite(fieldValue)
        || fieldValue < rule.min
        || fieldValue > rule.max
        || (rule.integer === true && !Number.isInteger(fieldValue))
      ) {
        errors.push(`Field "${field}" must be between ${rule.min} and ${rule.max}`);
      }
    } else if (!rule.values.includes(fieldValue)) {
      errors.push(`Field "${field}" has an unsupported value`);
    }
  }

  if (value.id === 'scene-scrub') {
    const start = typeof value.start === 'number' ? value.start : 0;
    const end = typeof value.end === 'number' ? value.end : 1;
    if (start >= end) errors.push('Scene scrub start must be less than end');
  }
  if (value.id === 'scene-object-focus' && typeof value.initialState === 'number') {
    if (typeof value.stateCount === 'number' && value.initialState >= value.stateCount) {
      errors.push('Initial state must be below state count');
    }
  }

  return errors.length > 0
    ? { valid: false, errors }
    : { valid: true, config: value as CreativeMotionConfig };
}
