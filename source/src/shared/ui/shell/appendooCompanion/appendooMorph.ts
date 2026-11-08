import {
  APPENDOO_SHAPE_META,
  APPENDOO_SILHOUETTE_SAMPLE_COUNT,
  pathFromAppendooSilhouettePoints,
  sampleAppendooSilhouetteLayers,
  type AppendooBodyGeometry,
  type AppendooBodyRig,
  type AppendooShapeId,
  type AppendooSilhouetteLayers,
  type AppendooSilhouettePoint,
} from './appendooBodyShape';
import type { AppendooFaceRig } from './appendooFaceRig';
import { pathFromAppendooSchematicStroke } from './appendooSchematic';
import {
  APPENDOO_DEFAULT_TRAVEL,
  APPENDOO_TRAVEL_EASING_META,
  easeAppendooTravel,
  isAppendooTravelEasingId,
  mergeAppendooTravelRig,
  type AppendooTravelEasingId,
} from './appendooTravel';

export const APPENDOO_MORPH_SYMBOL_IDS = [
  'question',
  'exclaim',
  'lightning',
  'cloud',
  'random',
] as const;

export const APPENDOO_MORPH_SHAPE_IDS = [
  'peach',
  'blot',
  'bacteria',
  'barbapapa',
  'sponge',
  'crab',
] as const;

export const APPENDOO_MORPH_TARGET_IDS = [
  ...APPENDOO_MORPH_SYMBOL_IDS,
  ...APPENDOO_MORPH_SHAPE_IDS,
] as const;

export type AppendooMorphSymbolId = (typeof APPENDOO_MORPH_SYMBOL_IDS)[number];
export type AppendooMorphTargetId = (typeof APPENDOO_MORPH_TARGET_IDS)[number];

export type AppendooMorphMeta = {
  id: AppendooMorphTargetId;
  label: string;
  note: string;
};

export const APPENDOO_MORPH_TARGET_META: Record<AppendooMorphTargetId, AppendooMorphMeta> = {
  question: { id: 'question', label: 'Question mark', note: 'The body melts into a fat gel question mark.' },
  exclaim: { id: 'exclaim', label: 'Exclamation', note: 'A tall bang with a connected dot.' },
  lightning: { id: 'lightning', label: 'Lightning', note: 'A zigzag bolt with rounded gel corners.' },
  cloud: { id: 'cloud', label: 'Cloud', note: 'Cartoon gel cloud: round crown puffs, side cheeks, and a pillow belly.' },
  random: { id: 'random', label: 'Random blob', note: 'A new irregular silhouette each time you morph.' },
  peach: { id: 'peach', label: APPENDOO_SHAPE_META.peach.label, note: 'The body melts into the peach.' },
  blot: { id: 'blot', label: APPENDOO_SHAPE_META.blot.label, note: 'The body melts into the paint blot.' },
  bacteria: { id: 'bacteria', label: APPENDOO_SHAPE_META.bacteria.label, note: 'The body melts into Mr. Bacteria.' },
  barbapapa: { id: 'barbapapa', label: APPENDOO_SHAPE_META.barbapapa.label, note: 'The body melts into Barbapapa.' },
  sponge: { id: 'sponge', label: APPENDOO_SHAPE_META.sponge.label, note: 'The body melts into the sponge.' },
  crab: { id: 'crab', label: APPENDOO_SHAPE_META.crab.label, note: 'The body melts into the crab.' },
};

export type AppendooMorphRig = {
  target: AppendooMorphTargetId;
  durationMs: number;
  easing: AppendooTravelEasingId;
  bezierX1: number;
  bezierY1: number;
  bezierX2: number;
  bezierY2: number;
  seed: number;
};

export const APPENDOO_DEFAULT_MORPH: AppendooMorphRig = {
  target: 'question',
  durationMs: 1100,
  easing: 'ease-in-out-cubic',
  bezierX1: 0.65,
  bezierY1: 0,
  bezierX2: 0.35,
  bezierY2: 1,
  seed: 1,
};

const TAU = Math.PI * 2;
const SAMPLE_COUNT = APPENDOO_SILHOUETTE_SAMPLE_COUNT;

type Point = AppendooSilhouettePoint;
type StrokeJoint = Point & { r: number };

const clamp = (value: number, min: number, max: number): number => (
  Math.min(max, Math.max(min, value))
);

const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a: Point, s: number): Point => ({ x: a.x * s, y: a.y * s });
const len = (a: Point): number => Math.hypot(a.x, a.y);
const norm = (a: Point): Point => {
  const size = len(a);
  return size < 1e-6 ? { x: 0, y: -1 } : { x: a.x / size, y: a.y / size };
};
const perp = (a: Point): Point => ({ x: -a.y, y: a.x });

const mulberry32 = (seed: number): (() => number) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let next = Math.imul(t ^ (t >>> 15), 1 | t);
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
};

const centroid = (points: readonly Point[]): Point => {
  const count = points.length || 1;
  const sum = points.reduce((total, point) => add(total, point), { x: 0, y: 0 });
  return { x: sum.x / count, y: sum.y / count };
};

const scaleAround = (points: readonly Point[], factor: number, origin: Point): Point[] => (
  points.map((point) => ({
    x: origin.x + (point.x - origin.x) * factor,
    y: origin.y + (point.y - origin.y) * factor,
  }))
);

const alignTopClockwise = (points: readonly Point[]): Point[] => {
  if (points.length < 3) return [...points];
  let topIndex = 0;
  points.forEach((point, index) => {
    const best = points[topIndex];
    if (point.y < best.y || (point.y === best.y && point.x < best.x)) topIndex = index;
  });
  const rotated = [...points.slice(topIndex), ...points.slice(0, topIndex)];
  const first = rotated[0];
  const second = rotated[1] ?? first;
  if (second.x + 0.01 < first.x) {
    return [rotated[0], ...rotated.slice(1).reverse()];
  }
  return rotated;
};

const resampleClosed = (points: readonly Point[], count: number): Point[] => {
  if (points.length === 0) return [];
  const ring = [...points, points[0]];
  const distances = [0];
  for (let index = 1; index < ring.length; index += 1) {
    distances.push(distances[index - 1] + Math.hypot(
      ring[index].x - ring[index - 1].x,
      ring[index].y - ring[index - 1].y,
    ));
  }
  const total = distances[distances.length - 1] || 1;
  const sampled: Point[] = [];
  let cursor = 1;
  for (let index = 0; index < count; index += 1) {
    const target = (index / count) * total;
    while (cursor < distances.length && distances[cursor] < target) cursor += 1;
    const end = Math.min(cursor, distances.length - 1);
    const start = Math.max(1, end);
    const span = distances[start] - distances[start - 1] || 1;
    const mix = clamp((target - distances[start - 1]) / span, 0, 1);
    sampled.push({
      x: ring[start - 1].x + (ring[start].x - ring[start - 1].x) * mix,
      y: ring[start - 1].y + (ring[start].y - ring[start - 1].y) * mix,
    });
  }
  return alignTopClockwise(sampled);
};

const fanCap = (center: Point, outward: Point, radius: number, steps: number): Point[] => {
  const tangent = norm(outward);
  const left = perp(tangent);
  const points: Point[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const angle = Math.PI * (index / steps);
    const dir = add(mul(left, Math.cos(angle)), mul(mul(tangent, -1), Math.sin(angle)));
    points.push(add(center, mul(dir, radius)));
  }
  return points;
};

const strokeToOutline = (joints: readonly StrokeJoint[]): Point[] => {
  if (joints.length < 2) return [];
  const left: Point[] = [];
  const right: Point[] = [];
  for (let index = 0; index < joints.length; index += 1) {
    const prev = joints[index - 1] ?? joints[index];
    const next = joints[index + 1] ?? joints[index];
    const incoming = norm(sub(joints[index], prev));
    const outgoing = norm(sub(next, joints[index]));
    const tangent = index === 0 ? outgoing : index === joints.length - 1 ? incoming : norm(add(incoming, outgoing));
    const normal = perp(tangent);
    left.push(add(joints[index], mul(normal, joints[index].r)));
    right.push(add(joints[index], mul(normal, -joints[index].r)));
  }
  const startDir = norm(sub(joints[1], joints[0]));
  const endDir = norm(sub(joints[joints.length - 1], joints[joints.length - 2]));
  return [
    ...left,
    ...fanCap(joints[joints.length - 1], endDir, joints[joints.length - 1].r, 7).slice(1, -1),
    ...right.reverse(),
    ...fanCap(joints[0], mul(startDir, -1), joints[0].r, 7).slice(1, -1),
  ];
};

const polarBlob = (
  cx: number,
  cy: number,
  radius: number,
  radiusAt: (theta: number) => number,
  squashX = 1,
  squashY = 1,
): Point[] => Array.from({ length: SAMPLE_COUNT }, (_, index) => {
  const theta = (index / SAMPLE_COUNT) * TAU;
  const reach = radius * radiusAt(theta);
  return {
    x: cx + reach * Math.sin(theta) * squashX,
    y: cy - reach * Math.cos(theta) * squashY,
  };
});

const QUESTION_SPINE: StrokeJoint[] = [
  { x: 70, y: 38, r: 7.1 },
  { x: 64, y: 26, r: 7.4 },
  { x: 50, y: 20, r: 7.8 },
  { x: 36, y: 26, r: 7.4 },
  { x: 32, y: 40, r: 7.0 },
  { x: 40, y: 52, r: 6.2 },
  { x: 50, y: 60, r: 5.2 },
  { x: 50, y: 68, r: 3.1 },
  { x: 50, y: 84, r: 8.6 },
];

const EXCLAIM_SPINE: StrokeJoint[] = [
  { x: 50, y: 18, r: 8.4 },
  { x: 50, y: 34, r: 7.8 },
  { x: 50, y: 56, r: 6.6 },
  { x: 50, y: 66, r: 2.8 },
  { x: 50, y: 84, r: 8.8 },
];

const LIGHTNING_OUTLINE: Point[] = [
  { x: 61, y: 14 },
  { x: 42, y: 14 },
  { x: 30, y: 50 },
  { x: 46, y: 50 },
  { x: 28, y: 98 },
  { x: 74, y: 40 },
  { x: 54, y: 40 },
];

/** Cartoon gel cloud: three round crown puffs, side cheeks, and a flat pillow belly. */
const CLOUD_OUTLINE: Point[] = [
  { x: 42, y: 32 },
  { x: 44, y: 23 },
  { x: 50, y: 16 },
  { x: 56, y: 23 },
  { x: 58, y: 32 },
  { x: 63, y: 44 },
  { x: 68, y: 30 },
  { x: 74, y: 20 },
  { x: 82, y: 18 },
  { x: 88, y: 26 },
  { x: 92, y: 38 },
  { x: 96, y: 50 },
  { x: 98, y: 62 },
  { x: 95, y: 74 },
  { x: 88, y: 82 },
  { x: 76, y: 88 },
  { x: 62, y: 91 },
  { x: 50, y: 92 },
  { x: 38, y: 91 },
  { x: 24, y: 88 },
  { x: 12, y: 82 },
  { x: 5, y: 74 },
  { x: 2, y: 62 },
  { x: 4, y: 50 },
  { x: 8, y: 38 },
  { x: 12, y: 26 },
  { x: 18, y: 18 },
  { x: 26, y: 20 },
  { x: 32, y: 30 },
  { x: 37, y: 44 },
];

const randomRadius = (seed: number): ((theta: number) => number) => {
  const rand = mulberry32(seed || 1);
  const harmonics = Array.from({ length: 6 }, (_, index) => ({
    k: index + 2,
    amp: 0.04 + rand() * (index < 3 ? 0.16 : 0.1),
    phase: rand() * TAU,
  }));
  const lobes = Array.from({ length: 2 + Math.floor(rand() * 3) }, () => ({
    theta: rand() * TAU,
    width: 0.22 + rand() * 0.28,
    amp: (rand() - 0.35) * 0.28,
  }));
  return (theta: number) => {
    let radius = 0.92;
    for (const harmonic of harmonics) {
      radius += harmonic.amp * Math.cos(harmonic.k * theta + harmonic.phase);
    }
    for (const lobe of lobes) {
      let delta = theta - lobe.theta;
      while (delta > Math.PI) delta -= TAU;
      while (delta < -Math.PI) delta += TAU;
      radius += lobe.amp * Math.exp(-(delta * delta) / (2 * lobe.width * lobe.width));
    }
    return Math.max(0.42, radius);
  };
};

const bodyFromTarget = (target: AppendooMorphTargetId, seed: number, rig: AppendooBodyRig): Point[] => {
  if (isAppendooMorphShapeTarget(target)) {
    return sampleAppendooSilhouetteLayers({ ...rig, shape: target }).body;
  }
  if (target === 'question') return strokeToOutline(QUESTION_SPINE);
  if (target === 'exclaim') return strokeToOutline(EXCLAIM_SPINE);
  if (target === 'lightning') return LIGHTNING_OUTLINE;
  if (target === 'cloud') return CLOUD_OUTLINE;
  return polarBlob(50, 58, 33, randomRadius(seed), 1.05, 0.96);
};

const layersFromSampledBody = (body: readonly Point[], rig: AppendooBodyRig): AppendooSilhouetteLayers => (
  layersFromBodyPoints(resampleClosed(body, SAMPLE_COUNT), rig)
);

const layersFromBodyPoints = (body: readonly Point[], rig: AppendooBodyRig): AppendooSilhouetteLayers => {
  const origin = centroid(body);
  return {
    body,
    rim: scaleAround(body, rig.rimScale, origin).map((point, index) => ({
      x: point.x + rig.rimShiftX * 3.2 + (index % 5 === 0 ? rig.rimAsym * 0.4 : 0),
      y: point.y + rig.rimShiftY * 2.8,
    })),
    inner: scaleAround(body, 0.9, origin),
  };
};

export const isAppendooMorphTargetId = (value: string): value is AppendooMorphTargetId => (
  (APPENDOO_MORPH_TARGET_IDS as readonly string[]).includes(value)
);

export const isAppendooMorphShapeTarget = (value: string): value is AppendooShapeId & AppendooMorphTargetId => (
  (APPENDOO_MORPH_SHAPE_IDS as readonly string[]).includes(value)
);

export const mergeAppendooMorphRig = (
  ...parts: Array<Partial<AppendooMorphRig> | undefined>
): AppendooMorphRig => {
  const merged = { ...APPENDOO_DEFAULT_MORPH };
  for (const part of parts) {
    if (!part) continue;
    Object.assign(merged, part);
  }
  merged.durationMs = clamp(merged.durationMs, 200, 4000);
  merged.bezierX1 = clamp(merged.bezierX1, 0, 1);
  merged.bezierX2 = clamp(merged.bezierX2, 0, 1);
  merged.bezierY1 = clamp(merged.bezierY1, -1, 2);
  merged.bezierY2 = clamp(merged.bezierY2, -1, 2);
  merged.seed = Math.max(1, Math.round(merged.seed));
  if (!isAppendooMorphTargetId(merged.target)) merged.target = APPENDOO_DEFAULT_MORPH.target;
  if (!isAppendooTravelEasingId(merged.easing)) merged.easing = 'custom';
  return merged;
};

export const applyAppendooMorphEasing = (
  rig: AppendooMorphRig,
  easing: AppendooTravelEasingId,
): AppendooMorphRig => {
  const bezier = APPENDOO_TRAVEL_EASING_META[easing].bezier;
  return mergeAppendooMorphRig(rig, {
    easing,
    bezierX1: bezier.x1,
    bezierY1: bezier.y1,
    bezierX2: bezier.x2,
    bezierY2: bezier.y2,
  });
};

export const easeAppendooMorph = (rig: AppendooMorphRig, time: number): number => (
  easeAppendooTravel(mergeAppendooTravelRig(APPENDOO_DEFAULT_TRAVEL, {
    easing: rig.easing,
    bezierX1: rig.bezierX1,
    bezierY1: rig.bezierY1,
    bezierX2: rig.bezierX2,
    bezierY2: rig.bezierY2,
  }), time)
);

export const cssAppendooMorphEasing = (rig: AppendooMorphRig): string => (
  `cubic-bezier(${rig.bezierX1}, ${rig.bezierY1}, ${rig.bezierX2}, ${rig.bezierY2})`
);

export const sampleAppendooMorphTargetLayers = (
  target: AppendooMorphTargetId,
  seed: number,
  rig: AppendooBodyRig,
): AppendooSilhouetteLayers => layersFromSampledBody(bodyFromTarget(target, seed, rig), rig);

export const sampleAppendooMorphSourceLayers = (rig: AppendooBodyRig): AppendooSilhouetteLayers => (
  layersFromSampledBody(sampleAppendooSilhouetteLayers(rig).body, rig)
);

const FACE_LAYOUT_KEYS = [
  'eyeY',
  'eyeGap',
  'mouthY',
  'eyeSize',
  'browY',
  'browGap',
  'browLength',
  'mouthWidth',
] as const;

export const mixAppendooFaceLayout = (
  from: Partial<AppendooFaceRig>,
  to: Partial<AppendooFaceRig>,
  t: number,
): Partial<AppendooFaceRig> => {
  const mix = clamp(t, 0, 1);
  const next: Partial<AppendooFaceRig> = { ...from };
  for (const key of FACE_LAYOUT_KEYS) {
    const start = from[key];
    const end = to[key];
    if (typeof start === 'number' && typeof end === 'number') {
      next[key] = start + (end - start) * mix;
    } else if (typeof end === 'number') {
      next[key] = end;
    }
  }
  return next;
};

const lerpPoints = (
  from: readonly Point[],
  to: readonly Point[],
  t: number,
): Point[] => {
  const count = Math.min(from.length, to.length);
  return Array.from({ length: count }, (_, index) => ({
    x: from[index].x + (to[index].x - from[index].x) * t,
    y: from[index].y + (to[index].y - from[index].y) * t,
  }));
};

export const mixAppendooMorphLayers = (
  from: AppendooSilhouetteLayers,
  to: AppendooSilhouetteLayers,
  t: number,
): AppendooSilhouetteLayers => {
  const mix = clamp(t, 0, 1);
  const puff = 1 + 0.14 * Math.sin(Math.PI * mix);
  const body = lerpPoints(from.body, to.body, mix);
  const origin = centroid(body);
  return {
    body: scaleAround(body, puff, origin),
    rim: scaleAround(lerpPoints(from.rim, to.rim, mix), puff, origin),
    inner: scaleAround(lerpPoints(from.inner, to.inner, mix), puff, origin),
  };
};

export const geometryFromAppendooMorphLayers = (
  layers: AppendooSilhouetteLayers,
  rest: AppendooBodyGeometry,
): AppendooBodyGeometry => ({
  ...rest,
  bodyPath: pathFromAppendooSilhouettePoints(layers.body),
  rimPath: pathFromAppendooSilhouettePoints(layers.rim),
  innerTrimPath: pathFromAppendooSilhouettePoints(layers.inner),
  schematicPath: pathFromAppendooSchematicStroke(layers.body),
});

export const resolveAppendooMorphGeometry = (
  rig: AppendooBodyRig,
  morph: AppendooMorphRig,
  time: number,
  fromLayers = sampleAppendooMorphSourceLayers(rig),
): { geometry: AppendooBodyGeometry; extrasOpacity: number; progress: number } => {
  const progress = easeAppendooMorph(morph, time);
  const to = sampleAppendooMorphTargetLayers(morph.target, morph.seed, rig);
  const layers = mixAppendooMorphLayers(fromLayers, to, progress);
  const rest = {
    extras: [],
    shine: { cx: 36, cy: 36, rx: 14, ry: 10 },
    caustic: { cx: 68, cy: 74, rx: 11, ry: 7 },
    face: {},
    bodyPath: '',
    rimPath: '',
    innerTrimPath: '',
    schematicPath: '',
  } satisfies AppendooBodyGeometry;
  return {
    geometry: geometryFromAppendooMorphLayers(layers, rest),
    extrasOpacity: 1 - progress,
    progress,
  };
};
