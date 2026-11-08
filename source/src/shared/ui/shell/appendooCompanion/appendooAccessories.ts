import type { AppendooEmotionId } from './appendooFaceRig';

export const APPENDOO_ACCESSORY_IDS = ['hat', 'glasses', 'headphones'] as const;
export type AppendooAccessoryId = (typeof APPENDOO_ACCESSORY_IDS)[number];

export type AppendooAccessoryFlags = Record<AppendooAccessoryId, boolean>;

export type AppendooAccessoryPose = {
  lift: number;
  shiftX: number;
  scale: number;
  tilt: number;
};

export type AppendooAccessoryMood = Record<AppendooAccessoryId, AppendooAccessoryPose>;

export const APPENDOO_DEFAULT_ACCESSORIES: AppendooAccessoryFlags = {
  hat: false,
  glasses: false,
  headphones: false,
};

export const APPENDOO_ACCESSORY_META: Record<AppendooAccessoryId, { id: AppendooAccessoryId; label: string; note: string }> = {
  hat: { id: 'hat', label: 'Hat', note: 'Knit beanie with a pom-pom. Pops on surprise, curious, and thinking.' },
  glasses: { id: 'glasses', label: 'Glasses', note: 'Round frames. Widen on surprise and search; slip on sleepy.' },
  headphones: { id: 'headphones', label: 'Headphones', note: 'Over-ear cans. Tilt on thinking; slump on sleepy.' },
};

export const APPENDOO_ACCESSORY_PAINT_IDS = [
  'cherry',
  'cobalt',
  'honey',
  'mint',
  'grape',
  'ink',
  'cream',
] as const;

export type AppendooAccessoryPaintId = (typeof APPENDOO_ACCESSORY_PAINT_IDS)[number];

export type AppendooAccessoryPaint = {
  id: AppendooAccessoryPaintId;
  label: string;
  note: string;
  hi: string;
  mid: string;
  lo: string;
  ink: string;
  lens: string;
};

export const APPENDOO_DEFAULT_ACCESSORY_PAINT_ID: AppendooAccessoryPaintId = 'cherry';

export const APPENDOO_ACCESSORY_PAINT: Record<AppendooAccessoryPaintId, AppendooAccessoryPaint> = {
  cherry: {
    id: 'cherry',
    label: 'Cherry',
    note: 'Warm red that sits apart from the gel body.',
    hi: '#ffd4d8',
    mid: '#e85b6a',
    lo: '#c43b4a',
    ink: '#5a2228',
    lens: 'rgb(255 228 232 / 0.32)',
  },
  cobalt: {
    id: 'cobalt',
    label: 'Cobalt',
    note: 'Clear blue frames and knit.',
    hi: '#d6e6ff',
    mid: '#3d7ee8',
    lo: '#2458b8',
    ink: '#1c3358',
    lens: 'rgb(214 232 255 / 0.34)',
  },
  honey: {
    id: 'honey',
    label: 'Honey',
    note: 'Mustard yellow, not the sponge gel.',
    hi: '#ffe9b8',
    mid: '#e8b02a',
    lo: '#c48e10',
    ink: '#5c4210',
    lens: 'rgb(255 236 196 / 0.32)',
  },
  mint: {
    id: 'mint',
    label: 'Mint',
    note: 'Cool teal for cans and cuffs.',
    hi: '#d4f5ea',
    mid: '#3cbfa0',
    lo: '#2a8f78',
    ink: '#1c4a40',
    lens: 'rgb(214 245 234 / 0.34)',
  },
  grape: {
    id: 'grape',
    label: 'Grape',
    note: 'Violet knit and frames.',
    hi: '#ead8ff',
    mid: '#8b5cf0',
    lo: '#6d3cc9',
    ink: '#3a2460',
    lens: 'rgb(236 220 255 / 0.34)',
  },
  ink: {
    id: 'ink',
    label: 'Ink',
    note: 'Near-black plastic and wool.',
    hi: '#cfd4dc',
    mid: '#4a5160',
    lo: '#2c313c',
    ink: '#16181e',
    lens: 'rgb(220 228 240 / 0.24)',
  },
  cream: {
    id: 'cream',
    label: 'Cream',
    note: 'Off-white felt and wire.',
    hi: '#fffdf8',
    mid: '#f0e6c8',
    lo: '#d4c49a',
    ink: '#5a4e32',
    lens: 'rgb(255 252 240 / 0.38)',
  },
};

export const isAppendooAccessoryPaintId = (value: string): value is AppendooAccessoryPaintId => (
  (APPENDOO_ACCESSORY_PAINT_IDS as readonly string[]).includes(value)
);

export const resolveAppendooAccessoryPaint = (id?: string): AppendooAccessoryPaint => (
  APPENDOO_ACCESSORY_PAINT[(id && isAppendooAccessoryPaintId(id) ? id : APPENDOO_DEFAULT_ACCESSORY_PAINT_ID)]
);

const REST: AppendooAccessoryPose = { lift: 0, shiftX: 0, scale: 1, tilt: 0 };

const pose = (partial: Partial<AppendooAccessoryPose> = {}): AppendooAccessoryPose => ({
  ...REST,
  ...partial,
});

const HAT: Record<AppendooEmotionId, AppendooAccessoryPose> = {
  neutral: pose({ tilt: -3 }),
  joy: pose({ lift: 2.4, tilt: -10, scale: 1.02 }),
  sadness: pose({ lift: -2.8, tilt: 12, scale: 0.98 }),
  surprise: pose({ lift: 9.2, tilt: -8, scale: 1.06 }),
  fear: pose({ lift: 7.2, tilt: 14, scale: 1.04 }),
  anger: pose({ lift: -0.8, tilt: -2 }),
  disgust: pose({ lift: -1.4, tilt: 8 }),
  contempt: pose({ tilt: 7, shiftX: 1.6 }),
  curious: pose({ lift: 6.2, tilt: 12, shiftX: 1.2 }),
  thinking: pose({ lift: 5.2, tilt: -7 }),
  sleepy: pose({ lift: -3.6, tilt: 22, scale: 0.96, shiftX: 2.4 }),
  worry: pose({ lift: 3.2, tilt: 8 }),
  celebrate: pose({ lift: 8.4, tilt: -14, scale: 1.08 }),
  grabbed: pose({ lift: -5.4, scale: 0.9, tilt: 4 }),
};

const GLASSES: Record<AppendooEmotionId, AppendooAccessoryPose> = {
  neutral: pose(),
  joy: pose({ scale: 1.04, lift: 0.6 }),
  sadness: pose({ lift: -1.2, scale: 0.98, tilt: 3 }),
  surprise: pose({ scale: 1.18, lift: 1.4 }),
  fear: pose({ scale: 1.14, lift: 0.8, tilt: -4 }),
  anger: pose({ scale: 0.97, tilt: -2 }),
  disgust: pose({ scale: 1.02, tilt: 5, lift: -0.6 }),
  contempt: pose({ tilt: 6, shiftX: 1.1, scale: 1.03 }),
  curious: pose({ scale: 1.12, tilt: -4, lift: 0.8 }),
  thinking: pose({ scale: 1.08, lift: 0.6, tilt: -2 }),
  sleepy: pose({ scale: 0.96, lift: -2.8, tilt: 8 }),
  worry: pose({ scale: 1.06, tilt: 4 }),
  celebrate: pose({ scale: 1.1, lift: 1.2 }),
  grabbed: pose({ scale: 0.9, lift: -1.8, tilt: 3 }),
};

const HEADPHONES: Record<AppendooEmotionId, AppendooAccessoryPose> = {
  neutral: pose(),
  joy: pose({ lift: 1.2, tilt: -6, scale: 1.02 }),
  sadness: pose({ lift: -1.6, tilt: 6, scale: 0.98 }),
  surprise: pose({ lift: 4.2, scale: 1.05, tilt: -4 }),
  fear: pose({ lift: 3.2, tilt: 8, scale: 1.03 }),
  anger: pose({ tilt: -3 }),
  disgust: pose({ tilt: 5, lift: -0.8 }),
  contempt: pose({ tilt: 7, shiftX: 1 }),
  curious: pose({ tilt: 10, lift: 2.2, scale: 1.04 }),
  thinking: pose({ tilt: -8, lift: 1.6, scale: 1.03 }),
  sleepy: pose({ tilt: 8, lift: -2.2, scale: 0.97 }),
  worry: pose({ tilt: 5, lift: 1 }),
  celebrate: pose({ lift: 3.6, tilt: -10, scale: 1.06 }),
  grabbed: pose({ scale: 0.92, lift: -2.4, tilt: 4 }),
};

const TABLES: Record<AppendooAccessoryId, Record<AppendooEmotionId, AppendooAccessoryPose>> = {
  hat: HAT,
  glasses: GLASSES,
  headphones: HEADPHONES,
};

export const isAppendooAccessoryId = (value: string): value is AppendooAccessoryId => (
  (APPENDOO_ACCESSORY_IDS as readonly string[]).includes(value)
);

export const mergeAppendooAccessories = (
  flags?: Partial<AppendooAccessoryFlags>,
): AppendooAccessoryFlags => ({
  ...APPENDOO_DEFAULT_ACCESSORIES,
  ...flags,
});

export const resolveAppendooAccessoryPose = (
  id: AppendooAccessoryId,
  emotion: AppendooEmotionId,
): AppendooAccessoryPose => TABLES[id][emotion] ?? REST;

export const resolveAppendooAccessoryMood = (emotion: AppendooEmotionId): AppendooAccessoryMood => ({
  hat: resolveAppendooAccessoryPose('hat', emotion),
  glasses: resolveAppendooAccessoryPose('glasses', emotion),
  headphones: resolveAppendooAccessoryPose('headphones', emotion),
});

export const lerpAppendooAccessoryPose = (
  from: AppendooAccessoryPose,
  to: AppendooAccessoryPose,
  t: number,
): AppendooAccessoryPose => {
  const mix = (start: number, end: number) => start + (end - start) * Math.min(1, Math.max(0, t));
  return {
    lift: mix(from.lift, to.lift),
    shiftX: mix(from.shiftX, to.shiftX),
    scale: mix(from.scale, to.scale),
    tilt: mix(from.tilt, to.tilt),
  };
};

export const lerpAppendooAccessoryMood = (
  from: AppendooAccessoryMood,
  to: AppendooAccessoryMood,
  t: number,
): AppendooAccessoryMood => ({
  hat: lerpAppendooAccessoryPose(from.hat, to.hat, t),
  glasses: lerpAppendooAccessoryPose(from.glasses, to.glasses, t),
  headphones: lerpAppendooAccessoryPose(from.headphones, to.headphones, t),
});

export const accessoryPoseCssVars = (poseValue: AppendooAccessoryPose): Record<string, string> => ({
  '--acc-x': String(poseValue.shiftX),
  '--acc-y': String(-poseValue.lift),
  '--acc-tilt': String(poseValue.tilt),
  '--acc-scale': String(poseValue.scale),
});
