import type { AppendooFaceRig } from './appendooFaceRig';
import { pathFromAppendooSchematicStroke } from './appendooSchematic';

export const APPENDOO_SHAPE_IDS = [
  'none',
  'peach',
  'blot',
  'bacteria',
  'barbapapa',
  'sponge',
  'crab',
] as const;

export type AppendooShapeId = (typeof APPENDOO_SHAPE_IDS)[number];

export const APPENDOO_SIZE_STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export const APPENDOO_SIZE_MIN = 1;
export const APPENDOO_SIZE_MAX = 10;
export const APPENDOO_SIZE_UNIT = 5;
/** New 1 = old 4 (0.8×). Step 2 is the 72×82 rest size. Step 10 is 2.6×. */
export const APPENDOO_SIZE_SHIFT = 3;
export const APPENDOO_DEFAULT_SIZE = 5;

export const APPENDOO_WONK_STEPS = APPENDOO_SIZE_STEPS;
export const APPENDOO_WONK_MIN = 1;
export const APPENDOO_WONK_MAX = 10;
export const APPENDOO_DEFAULT_WONK = 1;
export const APPENDOO_DEFAULT_WONK_SCATTER = false;
export const APPENDOO_DEFAULT_WONK_SEED = 1;

export const APPENDOO_LEAN_IDS = ['none', 'left', 'right', 'both'] as const;
export type AppendooLeanId = (typeof APPENDOO_LEAN_IDS)[number];
export const APPENDOO_DEFAULT_LEAN: AppendooLeanId = 'none';
export const APPENDOO_LEAN_ROTATE = 14;

export const APPENDOO_LEAN_META: Record<AppendooLeanId, { id: AppendooLeanId; label: string; note: string }> = {
  none: { id: 'none', label: 'None', note: 'Stands upright. Wonk still messes the edge.' },
  left: { id: 'left', label: 'Left', note: 'The body tips to the left from the feet.' },
  right: { id: 'right', label: 'Right', note: 'The body tips to the right from the feet.' },
  both: { id: 'both', label: 'Both', note: 'The body sways both ways, like an S-curve.' },
};

export const isAppendooLeanId = (value: string): value is AppendooLeanId => (
  (APPENDOO_LEAN_IDS as readonly string[]).includes(value)
);

export const APPENDOO_COMPANION_BASE_WIDTH = 72;
export const APPENDOO_COMPANION_BASE_HEIGHT = 82;

export type AppendooBodyRig = {
  shape: AppendooShapeId;
  size: number;
  wonk: number;
  wonkScatter: boolean;
  wonkSeed: number;
  lean: AppendooLeanId;
  bodyAsym: number;
  rimAsym: number;
  rimWeight: number;
  rimScale: number;
  rimShiftX: number;
  rimShiftY: number;
  trimMotion: number;
};

export type AppendooShapeMeta = {
  id: AppendooShapeId;
  label: string;
  note: string;
};

export type AppendooShapeExtraKind = 'glass' | 'accent' | 'stroke' | 'groove' | 'leaf';

export type AppendooShapeExtra = {
  id: string;
  d: string;
  kind: AppendooShapeExtraKind;
  className?: string;
  originX?: number;
  originY?: number;
};

type Harmonic = { k: number; amp: number; phase: number };
type Lobe = { theta: number; width: number; amp: number };
type Scallop = { start: number; end: number; count: number; amp: number };
type Point = { x: number; y: number };

type ShapeProfile = {
  cx: number;
  cy: number;
  radius: number;
  squashX?: number;
  squashY?: number;
  lean?: number;
  sampleCount?: number;
  /** Chebyshev square blended toward a circle. 0 = sharp square, 1 = circle. */
  square?: boolean;
  cornerRound?: number;
  harmonics: readonly Harmonic[];
  lobes?: readonly Lobe[];
  scallop?: Scallop;
  face: Partial<AppendooFaceRig>;
  shine: { cx: number; cy: number; rx: number; ry: number };
  caustic: { cx: number; cy: number; rx: number; ry: number };
  extras: readonly AppendooShapeExtra[];
};

export const APPENDOO_SILHOUETTE_SAMPLE_COUNT = 56;
const DEFAULT_SAMPLE_COUNT = APPENDOO_SILHOUETTE_SAMPLE_COUNT;
const TAU = Math.PI * 2;

export type AppendooSilhouettePoint = Point;

export const APPENDOO_DEFAULT_BODY: AppendooBodyRig = {
  shape: 'peach',
  size: APPENDOO_DEFAULT_SIZE,
  wonk: APPENDOO_DEFAULT_WONK,
  wonkScatter: APPENDOO_DEFAULT_WONK_SCATTER,
  wonkSeed: APPENDOO_DEFAULT_WONK_SEED,
  lean: APPENDOO_DEFAULT_LEAN,
  bodyAsym: 0.28,
  rimAsym: 0.42,
  rimWeight: 1.35,
  rimScale: 1.04,
  rimShiftX: 0.22,
  rimShiftY: -0.12,
  trimMotion: 0.7,
};

export const APPENDOO_SHAPE_META: Record<AppendooShapeId, AppendooShapeMeta> = {
  none: { id: 'none', label: 'None', note: 'No body. Only the face, plus accessories if they are on.' },
  peach: { id: 'peach', label: 'Peach', note: 'Round fruit, top cleft, stem, and a green leaf.' },
  blot: { id: 'blot', label: 'Paint blot', note: 'Irregular stain with hanging drips.' },
  bacteria: { id: 'bacteria', label: 'Mr. Bacteria', note: 'Tiny one-eyed copepod, two spiked antennae, and stick limbs.' },
  barbapapa: { id: 'barbapapa', label: 'Barbapapa', note: 'One-piece pink pear: round dome, fat base, no neck or legs, and mitten paws.' },
  sponge: { id: 'sponge', label: 'Sponge', note: 'Kitchen sponge: tall rounded square, pores, white shirt, red tie, brown pants, and stick limbs.' },
  crab: { id: 'crab', label: 'Crab', note: 'Wide shell, eyestalks, one big claw, and short legs.' },
};

const ellipse = (cx: number, cy: number, rx: number, ry: number): string => (
  `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`
);

const roundedRect = (x: number, y: number, w: number, h: number, r: number): string => {
  const rr = Math.min(r, w / 2, h / 2);
  return [
    `M ${x + rr} ${y}`,
    `H ${x + w - rr}`,
    `A ${rr} ${rr} 0 0 1 ${x + w} ${y + rr}`,
    `V ${y + h - rr}`,
    `A ${rr} ${rr} 0 0 1 ${x + w - rr} ${y + h}`,
    `H ${x + rr}`,
    `A ${rr} ${rr} 0 0 1 ${x} ${y + h - rr}`,
    `V ${y + rr}`,
    `A ${rr} ${rr} 0 0 1 ${x + rr} ${y}`,
    'Z',
  ].join(' ');
};

const mapLeafPoint = (
  x: number,
  y: number,
  ox: number,
  oy: number,
  rot: number,
  scale: number,
): string => {
  const xr = x * scale * Math.cos(rot) - y * scale * Math.sin(rot);
  const yr = x * scale * Math.sin(rot) + y * scale * Math.cos(rot);
  return `${(ox + xr).toFixed(2)} ${(oy + yr).toFixed(2)}`;
};

const makeLeaf = (
  id: string,
  ox: number,
  oy: number,
  rotDeg: number,
  scale = 1,
): AppendooShapeExtra => {
  const rot = (rotDeg * Math.PI) / 180;
  const p = (x: number, y: number) => mapLeafPoint(x, y, ox, oy, rot, scale);
  return {
    id,
    kind: 'leaf',
    className: 'appendoo-companion-accent-leaf appendoo-companion-trim-leaf',
    originX: ox,
    originY: oy,
    d: `M ${p(0, 0)} C ${p(6.5, -10.5)} ${p(19.5, -8.8)} ${p(22.4, 1.6)} C ${p(16.2, 6.2)} ${p(7.4, 5.8)} ${p(0, 0)} Z`,
  };
};

const PROFILES: Record<AppendooShapeId, ShapeProfile> = {
  none: {
    cx: 50,
    cy: 58,
    radius: 8,
    harmonics: [],
    face: {},
    shine: { cx: 50, cy: 48, rx: 4, ry: 3 },
    caustic: { cx: 54, cy: 66, rx: 3, ry: 2 },
    extras: [],
  },
  peach: {
    cx: 50,
    cy: 60,
    radius: 34.2,
    squashX: 1.08,
    squashY: 0.94,
    lean: 0.5,
    harmonics: [{ k: 2, amp: 0.04, phase: 0.1 }],
    lobes: [{ theta: 0, width: 0.2, amp: -0.16 }],
    face: { eyeY: 58.2, eyeGap: 25.4, mouthY: 72.4 },
    shine: { cx: 34, cy: 38, rx: 16, ry: 11 },
    caustic: { cx: 70, cy: 76, rx: 12, ry: 8 },
    extras: [
      {
        id: 'peach-stem',
        kind: 'accent',
        className: 'appendoo-companion-accent-stem',
        d: 'M 48.8 31 C 48.2 16 53.8 9.5 56.6 15.2 C 53.6 16.4 51.6 22.5 50.6 31 Z',
      },
      makeLeaf('peach-leaf', 56, 18, -22, 1.08),
      {
        id: 'peach-cleft',
        kind: 'groove',
        className: 'appendoo-companion-accent-groove',
        d: 'M 50.2 34 Q 46.8 56 50.6 80',
      },
    ],
  },
  blot: {
    cx: 50,
    cy: 50,
    radius: 31.5,
    squashX: 1.06,
    squashY: 0.9,
    lean: 1.5,
    sampleCount: 64,
    harmonics: [
      { k: 3, amp: 0.14, phase: 0.35 },
      { k: 5, amp: 0.09, phase: 1.2 },
      { k: 7, amp: 0.05, phase: 2.1 },
    ],
    lobes: [
      { theta: 0.62, width: 0.3, amp: 0.24 },
      { theta: 5.65, width: 0.26, amp: 0.18 },
      { theta: 2.88, width: 0.14, amp: 0.42 },
      { theta: 3.18, width: 0.1, amp: 0.56 },
      { theta: 3.52, width: 0.13, amp: 0.34 },
    ],
    face: { eyeY: 48.8, eyeGap: 24.6, mouthY: 62.8 },
    shine: { cx: 30, cy: 34, rx: 14, ry: 11 },
    caustic: { cx: 72, cy: 62, rx: 12, ry: 9 },
    extras: [
      { id: 'blot-drip', kind: 'glass', d: ellipse(61, 90, 4.4, 8.2) },
      { id: 'blot-drop', kind: 'glass', d: ellipse(72, 102, 3.4, 4.8) },
    ],
  },
  bacteria: {
    cx: 50,
    cy: 62,
    radius: 16.8,
    squashX: 0.92,
    squashY: 1.12,
    lean: 0.35,
    sampleCount: 56,
    harmonics: [{ k: 2, amp: 0.04, phase: 0.2 }],
    face: {
      eyeY: 58.6,
      eyeGap: 0.6,
      eyeSize: 8.4,
      mouthY: 74.2,
      mouthWidth: 3.6,
      browY: 10.2,
      browGap: 1.4,
      browLength: 11.8,
      browWeight: 2.55,
    },
    shine: { cx: 42, cy: 48, rx: 8, ry: 6 },
    caustic: { cx: 60, cy: 72, rx: 7, ry: 5 },
    extras: [
      { id: 'bacteria-antenna-left', kind: 'glass', d: 'M 42 46 C 34 28 28 10 36 8 C 32 16 36 30 44 48 Z' },
      { id: 'bacteria-antenna-right', kind: 'glass', d: 'M 58 46 C 64 26 74 8 66 6 C 70 16 64 30 56 48 Z' },
      { id: 'bacteria-nub-left', kind: 'glass', d: ellipse(32, 18, 2.4, 3.2) },
      { id: 'bacteria-nub-right', kind: 'glass', d: ellipse(70, 16, 2.6, 3.4) },
      { id: 'bacteria-arm-left', kind: 'glass', d: 'M 36 68 C 22 70 16 78 20 82 C 26 78 34 74 38 70 Z' },
      { id: 'bacteria-arm-right', kind: 'glass', d: 'M 64 68 C 78 66 86 76 82 82 C 74 76 66 72 62 70 Z' },
      { id: 'bacteria-leg-left', kind: 'glass', d: 'M 44 82 C 40 92 36 98 40 100 C 44 94 46 88 48 82 Z' },
      { id: 'bacteria-leg-right', kind: 'glass', d: 'M 56 82 C 60 92 66 98 62 100 C 58 94 56 88 52 82 Z' },
    ],
  },
  barbapapa: {
    cx: 50,
    cy: 55,
    radius: 28.4,
    squashX: 0.84,
    squashY: 1.3,
    lean: 0.06,
    sampleCount: 72,
    harmonics: [
      { k: 1, amp: -0.2, phase: 0 },
      { k: 2, amp: 0.02, phase: 0 },
    ],
    lobes: [
      { theta: 0, width: 0.42, amp: 0.18 },
      { theta: Math.PI, width: 0.62, amp: 0.16 },
      { theta: 1.7, width: 0.13, amp: 0.08 },
      { theta: -1.7, width: 0.13, amp: 0.08 },
    ],
    face: {
      eyeY: 36.4,
      eyeGap: 12.8,
      mouthY: 49.2,
      eyeSize: 4,
      browY: 6.1,
      browGap: 13.2,
      browLength: 7.2,
      mouthWidth: 8.2,
    },
    shine: { cx: 39, cy: 26, rx: 10, ry: 8 },
    caustic: { cx: 63, cy: 88, rx: 13, ry: 10 },
    extras: [
      {
        id: 'barbapapa-arm-left',
        kind: 'glass',
        d: 'M 27.5 64.5 C 20 63 15.5 65.5 14 70 C 12.2 73.5 13.5 77.2 17.2 76.8 C 15.4 79.8 16.8 83.2 20.2 81.6 C 21.4 84.6 24.8 84.2 25.6 80.4 C 28.2 75.2 30 68.5 27.5 64.5 Z',
      },
      {
        id: 'barbapapa-arm-right',
        kind: 'glass',
        d: 'M 72.5 64.5 C 80 63 84.5 65.5 86 70 C 87.8 73.5 86.5 77.2 82.8 76.8 C 84.6 79.8 83.2 83.2 79.8 81.6 C 78.6 84.6 75.2 84.2 74.4 80.4 C 71.8 75.2 70 68.5 72.5 64.5 Z',
      },
    ],
  },
  sponge: {
    cx: 50,
    cy: 44,
    radius: 30,
    squashX: 0.96,
    squashY: 1.16,
    lean: 0.04,
    sampleCount: 80,
    square: true,
    cornerRound: 0.34,
    harmonics: [],
    scallop: { start: 0, end: TAU, count: 18, amp: 0.048 },
    face: {
      eyeY: 34.2,
      eyeGap: 17.6,
      mouthY: 48.4,
      eyeSize: 5.1,
      browY: 7.1,
      browGap: 18.4,
      browLength: 9.4,
      mouthWidth: 10.8,
    },
    shine: { cx: 36, cy: 20, rx: 11, ry: 7 },
    caustic: { cx: 64, cy: 46, rx: 10, ry: 7 },
    extras: [
      { id: 'sponge-arm-left', kind: 'glass', d: 'M 23 55 C 14 56 10 62 9.2 70 C 8.6 76 10.5 80 14 79 C 15.4 73 17 64 24 56 Z' },
      { id: 'sponge-hand-left', kind: 'glass', d: ellipse(12.2, 82.4, 6.3, 5.9) },
      { id: 'sponge-arm-right', kind: 'glass', d: 'M 77 55 C 86 56 90 62 90.8 70 C 91.4 76 89.5 80 86 79 C 84.6 73 83 64 76 56 Z' },
      { id: 'sponge-hand-right', kind: 'glass', d: ellipse(87.8, 82.4, 6.3, 5.9) },
      { id: 'sponge-leg-left', kind: 'glass', d: 'M 38 75 C 35 75 34 78 34 84 C 33.6 90 33.4 96 34.2 99 C 36.4 100 41 100 42.4 99 C 43.2 96 43 90 42.6 84 C 42.4 78 41.4 75 38 75 Z' },
      { id: 'sponge-leg-right', kind: 'glass', d: 'M 62 75 C 65 75 66 78 66 84 C 66.4 90 66.6 96 65.8 99 C 63.6 100 59 100 57.6 99 C 56.8 96 57 90 57.4 84 C 57.6 78 58.6 75 62 75 Z' },
      { id: 'sponge-pore-a', kind: 'accent', className: 'appendoo-companion-pore', d: ellipse(28.5, 16.5, 5.1, 4.2) },
      { id: 'sponge-pore-b', kind: 'accent', className: 'appendoo-companion-pore', d: ellipse(70.5, 14.8, 3.8, 3.2) },
      { id: 'sponge-pore-c', kind: 'accent', className: 'appendoo-companion-pore', d: ellipse(26.2, 31.5, 3.4, 2.8) },
      { id: 'sponge-pore-d', kind: 'accent', className: 'appendoo-companion-pore', d: ellipse(73.8, 29.2, 4.6, 3.6) },
      { id: 'sponge-pore-e', kind: 'accent', className: 'appendoo-companion-pore', d: ellipse(27.4, 46.2, 2.5, 2.1) },
      { id: 'sponge-pore-f', kind: 'accent', className: 'appendoo-companion-pore', d: ellipse(72.6, 43.8, 2.8, 2.3) },
      { id: 'sponge-pore-g', kind: 'accent', className: 'appendoo-companion-pore', d: ellipse(41.2, 17.2, 2.1, 1.8) },
      { id: 'sponge-pore-h', kind: 'accent', className: 'appendoo-companion-pore', d: ellipse(61.6, 15.6, 2.4, 2) },
      { id: 'sponge-collar', kind: 'accent', className: 'appendoo-companion-clothes-shirt', d: 'M 24.5 53.2 H 75.5 L 71.2 60.6 H 56.2 L 50 66.2 L 43.8 60.6 H 28.8 Z' },
      { id: 'sponge-shirt', kind: 'accent', className: 'appendoo-companion-clothes-shirt', d: roundedRect(24.5, 58.4, 51, 7.6, 1.2) },
      { id: 'sponge-pants', kind: 'accent', className: 'appendoo-companion-clothes-pants', d: roundedRect(24.5, 64.6, 51, 12.8, 2.4) },
      { id: 'sponge-belt', kind: 'accent', className: 'appendoo-companion-clothes-belt', d: roundedRect(24.5, 63.4, 51, 3.3, 0.6) },
      { id: 'sponge-buckle', kind: 'accent', className: 'appendoo-companion-clothes-buckle', d: roundedRect(46.2, 62.8, 7.6, 4.4, 0.7) },
      { id: 'sponge-tie', kind: 'accent', className: 'appendoo-companion-clothes-tie', d: 'M 50 53.6 L 53.6 57.4 L 52.4 73.8 L 50 77.6 L 47.6 73.8 L 46.4 57.4 Z' },
      { id: 'sponge-sock-left', kind: 'accent', className: 'appendoo-companion-clothes-sock', d: roundedRect(33.4, 90.2, 9.4, 9.6, 2.8) },
      { id: 'sponge-sock-right', kind: 'accent', className: 'appendoo-companion-clothes-sock', d: roundedRect(57.2, 90.2, 9.4, 9.6, 2.8) },
      { id: 'sponge-sock-stripe-left', kind: 'accent', className: 'appendoo-companion-clothes-sock-stripe', d: roundedRect(33.4, 92.6, 9.4, 2.1, 0.6) },
      { id: 'sponge-sock-stripe-right', kind: 'accent', className: 'appendoo-companion-clothes-sock-stripe', d: roundedRect(57.2, 92.6, 9.4, 2.1, 0.6) },
      { id: 'sponge-shoe-left', kind: 'accent', className: 'appendoo-companion-shoe', d: 'M 28.4 97.2 C 28.4 93.6 32.2 92.2 36.4 92.2 C 42.2 92.2 46.6 94.4 46.6 98.6 C 46.6 103.2 41.4 106.4 36.2 106.4 C 30.4 106.4 28.4 102.4 28.4 97.2 Z' },
      { id: 'sponge-shoe-right', kind: 'accent', className: 'appendoo-companion-shoe', d: 'M 71.6 97.2 C 71.6 93.6 67.8 92.2 63.6 92.2 C 57.8 92.2 53.4 94.4 53.4 98.6 C 53.4 103.2 58.6 106.4 63.8 106.4 C 69.6 106.4 71.6 102.4 71.6 97.2 Z' },
    ],
  },
  crab: {
    cx: 50,
    cy: 64,
    radius: 24.6,
    squashX: 1.22,
    squashY: 0.82,
    lean: 0.3,
    harmonics: [{ k: 2, amp: 0.05, phase: Math.PI }],
    face: { eyeY: 30.4, eyeGap: 22.8, mouthY: 70.6, eyeSize: 3.5, browY: 5.4, browLength: 7.5 },
    shine: { cx: 36, cy: 56, rx: 12, ry: 8 },
    caustic: { cx: 68, cy: 74, rx: 10, ry: 6 },
    extras: [
      { id: 'crab-stalk-left', kind: 'glass', d: ellipse(38, 40, 4.2, 14) },
      { id: 'crab-stalk-right', kind: 'glass', d: ellipse(62, 38, 4.4, 13.2) },
      { id: 'crab-claw-left', kind: 'glass', d: 'M 22 60 C 6 48 -2 42 6 36 C 16 34 22 46 24 52 C 10 50 4 58 12 68 C 16 72 24 68 22 60 Z' },
      { id: 'crab-claw-right', kind: 'glass', d: 'M 78 62 C 90 54 96 50 92 44 C 86 42 80 52 78 56 C 90 56 94 64 86 70 C 82 72 78 68 78 62 Z' },
      { id: 'crab-leg-a', kind: 'glass', d: ellipse(34, 86, 4.2, 6.5) },
      { id: 'crab-leg-b', kind: 'glass', d: ellipse(50, 90, 4.6, 6.8) },
      { id: 'crab-leg-c', kind: 'glass', d: ellipse(66, 86, 4.2, 6.4) },
    ],
  },
};

const wrapAngle = (value: number): number => {
  let next = value;
  while (next > Math.PI) next -= TAU;
  while (next < -Math.PI) next += TAU;
  return next;
};

const wrapTau = (value: number): number => {
  let next = value % TAU;
  if (next < 0) next += TAU;
  return next;
};

const radiusAt = (
  theta: number,
  profile: ShapeProfile,
  asym: number,
  wobble: number,
  wonkLumps: number,
): number => {
  let radius = 1;
  if (profile.square) {
    const cheb = 1 / Math.max(Math.abs(Math.sin(theta)), Math.abs(Math.cos(theta)), 1e-4);
    const round = profile.cornerRound ?? 0.3;
    radius += (1 - round) * (cheb - 1);
  }
  for (const harmonic of profile.harmonics) {
    radius += harmonic.amp * Math.cos(harmonic.k * theta + harmonic.phase);
  }
  for (const lobe of profile.lobes ?? []) {
    const delta = wrapAngle(theta - lobe.theta);
    radius += lobe.amp * Math.exp(-(delta * delta) / (2 * lobe.width * lobe.width));
  }
  if (profile.scallop) {
    const t = wrapTau(theta);
    const { start, end, count, amp } = profile.scallop;
    if (t >= start && t <= end) {
      const u = (t - start) / (end - start);
      radius += amp * Math.sin(u * Math.PI * count);
    }
  }
  radius += asym * 0.15 * Math.sin(theta);
  radius += asym * 0.08 * Math.sin(2 * theta + 0.55);
  radius += asym * 0.05 * Math.cos(3 * theta + 1.15);
  radius += wobble * 0.035 * Math.sin(5 * theta + 0.7);
  if (wonkLumps > 0) {
    radius += wonkLumps * 0.055 * Math.sin(8 * theta + 0.9);
    radius += wonkLumps * 0.042 * Math.cos(12 * theta + 1.4);
    radius += wonkLumps * 0.032 * Math.sin(18 * theta + 0.3);
    radius += wonkLumps * 0.024 * Math.cos(24 * theta + 2.1);
    radius += wonkLumps * 0.018 * Math.sin(31 * theta + 1.7);
  }
  return Math.max(0.38, radius);
};

const pointAt = (
  profile: ShapeProfile,
  theta: number,
  scale: number,
  asym: number,
  wobble: number,
  shiftX: number,
  shiftY: number,
  wonkLumps: number,
): Point => {
  const radius = profile.radius * scale * radiusAt(theta, profile, asym, wobble, wonkLumps);
  const squashX = profile.squashX ?? 1;
  const squashY = profile.squashY ?? 1;
  const lean = profile.lean ?? 0;
  return {
    x: profile.cx + shiftX + radius * Math.sin(theta) * squashX + lean * Math.sin(theta),
    y: profile.cy + shiftY - radius * Math.cos(theta) * squashY,
  };
};

const closedCatmullRomPath = (points: readonly Point[]): string => {
  const count = points.length;
  const parts: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const previous = points[(index - 1 + count) % count];
    const current = points[index];
    const next = points[(index + 1) % count];
    const after = points[(index + 2) % count];
    if (index === 0) {
      parts.push(`M ${current.x.toFixed(2)} ${current.y.toFixed(2)}`);
    }
    parts.push(
      `C ${(current.x + (next.x - previous.x) / 6).toFixed(2)} ${(current.y + (next.y - previous.y) / 6).toFixed(2)} ${(next.x - (after.x - current.x) / 6).toFixed(2)} ${(next.y - (after.y - current.y) / 6).toFixed(2)} ${next.x.toFixed(2)} ${next.y.toFixed(2)}`,
    );
  }
  parts.push('Z');
  return parts.join(' ');
};

const samplePoints = (
  profile: ShapeProfile,
  scale: number,
  asym: number,
  wobble: number,
  shiftX: number,
  shiftY: number,
  wonkLumps = 0,
): Point[] => {
  const sampleCount = profile.sampleCount ?? DEFAULT_SAMPLE_COUNT;
  return Array.from({ length: sampleCount }, (_, index) => {
    const theta = (index / sampleCount) * TAU;
    return pointAt(profile, theta, scale, asym, wobble, shiftX, shiftY, wonkLumps);
  });
};

const mulberry32 = (seed: number): (() => number) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let next = Math.imul(t ^ (t >>> 15), 1 | t);
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
};

const applyWonkToPoints = (
  points: readonly Point[],
  amount: number,
  scatter: boolean,
  seed: number,
  salt: number,
  origin: Point,
): Point[] => {
  if (amount <= 1e-6 || points.length === 0) return [...points];
  const rand = scatter ? mulberry32((Math.round(seed) * 0x9e3779b9 + salt) >>> 0) : null;
  return points.map((point, index) => {
    const dx = point.x - origin.x;
    const dy = point.y - origin.y;
    const radius = Math.hypot(dx, dy) || 1;
    const nx = dx / radius;
    const ny = dy / radius;
    const theta = (index / points.length) * TAU;
    const tick = ((index * 13) % 7) / 6 - 0.5;
    const radial = rand
      ? rand() * 2 - 1
      : Math.sin(7 * theta + 0.35) * 0.42
        + Math.sin(11 * theta + 1.2) * 0.28
        + Math.cos(16 * theta + 0.6) * 0.2
        + Math.sin(22 * theta + 2.4) * 0.14
        + tick * 0.55;
    const tangent = rand
      ? rand() * 2 - 1
      : Math.cos(9 * theta + 0.8) * 0.28
        + Math.sin(15 * theta + 1.9) * 0.18
        + tick * 0.22;
    const push = amount * 4.6;
    const slide = amount * 2.4;
    return {
      x: point.x + nx * radial * push - ny * tangent * slide,
      y: point.y + ny * radial * push + nx * tangent * slide,
    };
  });
};

const applyLeanSway = (points: readonly Point[], sway: number, origin: Point): Point[] => {
  if (sway <= 1e-6) return [...points];
  return points.map((point) => ({
    x: point.x + 6.4 * sway * Math.sin(((point.y - origin.y) / 36) * Math.PI),
    y: point.y,
  }));
};

export const pathFromAppendooSilhouettePoints = (
  points: readonly AppendooSilhouettePoint[],
): string => closedCatmullRomPath(points);

const clamp = (value: number, min: number, max: number): number => (
  Math.min(max, Math.max(min, value))
);

export const mergeAppendooBodyRig = (
  ...parts: Array<Partial<AppendooBodyRig> | undefined>
): AppendooBodyRig => {
  const merged = { ...APPENDOO_DEFAULT_BODY };
  for (const part of parts) {
    if (!part) continue;
    Object.assign(merged, part);
  }
  merged.bodyAsym = clamp(merged.bodyAsym, 0, 1);
  merged.size = clamp(merged.size, APPENDOO_SIZE_MIN, APPENDOO_SIZE_MAX);
  merged.wonk = clamp(merged.wonk, APPENDOO_WONK_MIN, APPENDOO_WONK_MAX);
  merged.wonkScatter = Boolean(merged.wonkScatter);
  merged.wonkSeed = Math.max(1, Math.round(Number.isFinite(merged.wonkSeed) ? merged.wonkSeed : APPENDOO_DEFAULT_WONK_SEED));
  if (!isAppendooLeanId(merged.lean)) merged.lean = APPENDOO_DEFAULT_LEAN;
  merged.rimAsym = clamp(merged.rimAsym, 0, 1);
  merged.rimWeight = clamp(merged.rimWeight, 0.4, 4);
  merged.rimScale = clamp(merged.rimScale, 0.92, 1.18);
  merged.rimShiftX = clamp(merged.rimShiftX, -1, 1);
  merged.rimShiftY = clamp(merged.rimShiftY, -1, 1);
  merged.trimMotion = clamp(merged.trimMotion, 0, 1);
  if (!(APPENDOO_SHAPE_IDS as readonly string[]).includes(merged.shape)) {
    merged.shape = APPENDOO_DEFAULT_BODY.shape;
  }
  return merged;
};

export type AppendooBodyGeometry = {
  bodyPath: string;
  rimPath: string;
  innerTrimPath: string;
  schematicPath: string;
  extras: readonly AppendooShapeExtra[];
  shine: ShapeProfile['shine'];
  caustic: ShapeProfile['caustic'];
  face: Partial<AppendooFaceRig>;
};

export type AppendooSilhouetteLayers = {
  body: readonly AppendooSilhouettePoint[];
  rim: readonly AppendooSilhouettePoint[];
  inner: readonly AppendooSilhouettePoint[];
};

export const sampleAppendooSilhouetteLayers = (rig: AppendooBodyRig): AppendooSilhouetteLayers => {
  const profile = PROFILES[rig.shape] ?? PROFILES.peach;
  const wonk = resolveAppendooWonkAmount(rig.wonk);
  const origin = { x: profile.cx, y: profile.cy };
  const sway = resolveAppendooLeanPose(rig.lean).sway;
  const lump = (points: readonly Point[], salt: number) => (
    applyLeanSway(
      applyWonkToPoints(points, wonk, rig.wonkScatter, rig.wonkSeed, salt, origin),
      sway,
      origin,
    )
  );
  const bodyAsym = rig.bodyAsym;
  const rimAsym = rig.bodyAsym * 0.45 + rig.rimAsym;
  return {
    body: lump(samplePoints(profile, 1, bodyAsym, 0.08 + wonk * 0.85, 0, 0, wonk), 1),
    rim: lump(samplePoints(
      profile,
      rig.rimScale,
      rimAsym,
      0.18 + rig.rimAsym * 0.35 + wonk * 0.4,
      rig.rimShiftX * 3.2,
      rig.rimShiftY * 2.8,
      wonk,
    ), 2),
    inner: lump(samplePoints(
      profile,
      0.9,
      bodyAsym * 1.35,
      0.22 + wonk * 0.35,
      -1.4 + rig.rimShiftX * 0.8,
      -1.1 + rig.rimShiftY * 0.6,
      wonk,
    ), 3),
  };
};

export const resolveAppendooBodyGeometry = (rig: AppendooBodyRig): AppendooBodyGeometry => {
  const profile = PROFILES[rig.shape];
  const layers = sampleAppendooSilhouetteLayers(rig);
  const wonk = resolveAppendooWonkAmount(rig.wonk);
  return {
    bodyPath: pathFromAppendooSilhouettePoints(layers.body),
    rimPath: pathFromAppendooSilhouettePoints(layers.rim),
    innerTrimPath: pathFromAppendooSilhouettePoints(layers.inner),
    schematicPath: pathFromAppendooSchematicStroke(layers.body),
    extras: profile.extras,
    shine: profile.shine,
    caustic: profile.caustic,
    face: {
      ...profile.face,
      browAsym: (profile.face.browAsym ?? 0) + wonk * 0.72,
      mouthAsym: (profile.face.mouthAsym ?? 0) + wonk * 0.58,
    },
  };
};

export const isAppendooShapeId = (value: string): value is AppendooShapeId => (
  (APPENDOO_SHAPE_IDS as readonly string[]).includes(value)
);

export const appendooShapeShowsBody = (shape: AppendooShapeId): boolean => shape !== 'none';

export const resolveAppendooCompanionBox = (
  size: number,
  mood = 1,
): { width: number; height: number } => {
  const scale = ((clamp(size, 0.5, 14) + APPENDOO_SIZE_SHIFT) / APPENDOO_SIZE_UNIT) * mood;
  return {
    width: Math.round(APPENDOO_COMPANION_BASE_WIDTH * scale * 10) / 10,
    height: Math.round(APPENDOO_COMPANION_BASE_HEIGHT * scale * 10) / 10,
  };
};

export const nearestAppendooSizeStep = (size: number): number => (
  Math.round(clamp(size, APPENDOO_SIZE_MIN, APPENDOO_SIZE_MAX))
);

export const resolveAppendooWonkAmount = (wonk: number): number => (
  (clamp(wonk, APPENDOO_WONK_MIN, APPENDOO_WONK_MAX) - 1) / 9
);

export const nearestAppendooWonkStep = (wonk: number): number => (
  Math.round(clamp(wonk, APPENDOO_WONK_MIN, APPENDOO_WONK_MAX))
);

export const resolveAppendooLeanPose = (lean: AppendooLeanId): { rotate: number; sway: number } => {
  if (lean === 'left') return { rotate: -APPENDOO_LEAN_ROTATE, sway: 0 };
  if (lean === 'right') return { rotate: APPENDOO_LEAN_ROTATE, sway: 0 };
  if (lean === 'both') return { rotate: 0, sway: 1 };
  return { rotate: 0, sway: 0 };
};

export const nextAppendooWonkSeed = (seed: number): number => (
  Math.max(1, Math.round(seed) + 1)
);
