import type { AppendooCompanionFace } from './appendooCompanion.types';

/**
 * Parametric face rig inspired by Ekman/FACS action units, compressed into a
 * kawaii blob (features clustered, mouth close to eyes, brows always present).
 *
 * AU1 inner brow raise · AU2 outer brow raise · AU4 brow lower/knit
 * AU5 lid raise (eyeOpen > 1) · AU6 cheek raise · AU12 smile · AU15 frown
 * AU20 mouth stretch · AU26 jaw drop · AU14 contempt (asymmetric corner)
 */
export const APPENDOO_EMOTION_IDS = [
  'neutral',
  'joy',
  'sadness',
  'surprise',
  'fear',
  'anger',
  'disgust',
  'contempt',
  'curious',
  'thinking',
  'sleepy',
  'worry',
  'celebrate',
  'grabbed',
] as const;

export type AppendooEmotionId = (typeof APPENDOO_EMOTION_IDS)[number];

export type AppendooFaceRig = {
  browInnerY: number;
  browOuterY: number;
  browKnit: number;
  browAsym: number;
  browY: number;
  browGap: number;
  browLength: number;
  browWeight: number;
  eyeOpen: number;
  eyeSize: number;
  eyeGap: number;
  eyeY: number;
  lookX: number;
  lookY: number;
  winkLeft: number;
  winkRight: number;
  mouthCurve: number;
  mouthOpen: number;
  mouthWidth: number;
  mouthY: number;
  mouthAsym: number;
  blush: number;
  cheekRaise: number;
  noseWrinkle: number;
  spark: boolean;
  zzz: boolean;
};

export type AppendooEmotionMeta = {
  id: AppendooEmotionId;
  label: string;
  facs: string;
  note: string;
};

export const APPENDOO_DEFAULT_RIG: AppendooFaceRig = {
  browInnerY: 0.08,
  browOuterY: 0.04,
  browKnit: 0.08,
  browAsym: 0,
  browY: 8.2,
  browGap: 24.5,
  browLength: 11.2,
  browWeight: 1.7,
  eyeOpen: 1,
  eyeSize: 4.15,
  eyeGap: 25.2,
  eyeY: 56.2,
  lookX: 0,
  lookY: 0,
  winkLeft: 0,
  winkRight: 0,
  mouthCurve: 0.22,
  mouthOpen: 0,
  mouthWidth: 7.4,
  mouthY: 70.4,
  mouthAsym: 0,
  blush: 0.32,
  cheekRaise: 0,
  noseWrinkle: 0,
  spark: false,
  zzz: false,
};

export const APPENDOO_EMOTION_META: Record<AppendooEmotionId, AppendooEmotionMeta> = {
  neutral: { id: 'neutral', label: 'Neutral', facs: 'rest', note: 'Brows slightly arched, small smile, features clustered.' },
  joy: { id: 'joy', label: 'Joy', facs: 'AU6 + AU12', note: 'Cheek raise squints the eyes; lip corners pull up. Genuine smile needs the eyes.' },
  sadness: { id: 'sadness', label: 'Sadness', facs: 'AU1 + AU4 + AU15', note: 'Inner brows up, brows knit, mouth corners down.' },
  surprise: { id: 'surprise', label: 'Surprise', facs: 'AU1 + AU2 + AU5 + AU26', note: 'Brows high and round, eyes wide, jaw drop. No knit.' },
  fear: { id: 'fear', label: 'Fear', facs: 'AU1 + AU2 + AU4 + AU5 + AU20', note: 'Brows raised AND knit, eyes wide, mouth stretched.' },
  anger: { id: 'anger', label: 'Anger', facs: 'AU4 + AU5 + AU7 + AU24', note: 'Brows lowered and drawn together; lids tight; lips pressed.' },
  disgust: { id: 'disgust', label: 'Disgust', facs: 'AU9 + AU10 + AU15', note: 'Upper lip lift, nose-adjacent wrinkle cue, corners slightly down.' },
  contempt: { id: 'contempt', label: 'Contempt', facs: 'AU12 + AU14 (one side)', note: 'Asymmetric smirk — only one mouth corner rises.' },
  curious: { id: 'curious', label: 'Curious', facs: 'AU1 + AU2 mild + wink', note: 'One brow higher, one eye closed — playful attention.' },
  thinking: { id: 'thinking', label: 'Thinking', facs: 'AU1 mild', note: 'Inner brow lift, gaze up, tiny mouth.' },
  sleepy: { id: 'sleepy', label: 'Sleepy', facs: 'AU41/43 lids', note: 'Brows low and heavy, eyes almost shut, mouth slack.' },
  worry: { id: 'worry', label: 'Worry', facs: 'AU1 + AU4 mild', note: 'Inner brows up and knit, small open mouth — the “oops” face.' },
  celebrate: { id: 'celebrate', label: 'Celebrate', facs: 'AU6 + AU12 strong', note: 'Joy plus extra blush and a spark.' },
  grabbed: { id: 'grabbed', label: 'Grabbed', facs: 'AU24 + lids', note: 'Squashed lids and a pressed line — physical, not an emotion.' },
};

export const APPENDOO_EMOTION_PRESETS: Record<AppendooEmotionId, Partial<AppendooFaceRig>> = {
  neutral: {},
  joy: {
    browInnerY: 0.18,
    browOuterY: 0.22,
    browKnit: 0,
    eyeOpen: 0.22,
    mouthCurve: 0.92,
    mouthWidth: 9.4,
    blush: 0.62,
    cheekRaise: 0.85,
  },
  sadness: {
    browInnerY: 0.72,
    browOuterY: -0.28,
    browKnit: 0.62,
    browY: 7.4,
    eyeOpen: 0.72,
    lookY: 0.35,
    mouthCurve: -0.78,
    mouthWidth: 6.6,
    blush: 0.18,
  },
  surprise: {
    browInnerY: 0.92,
    browOuterY: 0.88,
    browKnit: 0,
    browY: 10.4,
    browLength: 12.4,
    eyeOpen: 1.28,
    eyeSize: 4.6,
    mouthCurve: 0.05,
    mouthOpen: 0.82,
    mouthWidth: 5.2,
    blush: 0.22,
  },
  fear: {
    browInnerY: 0.82,
    browOuterY: 0.55,
    browKnit: 0.78,
    browY: 9.6,
    eyeOpen: 1.22,
    eyeSize: 4.45,
    mouthCurve: -0.12,
    mouthOpen: 0.42,
    mouthWidth: 10.2,
    blush: 0.16,
  },
  anger: {
    browInnerY: -0.72,
    browOuterY: 0.18,
    browKnit: 0.88,
    browY: 6.4,
    browWeight: 2.05,
    eyeOpen: 0.86,
    eyeSize: 3.9,
    mouthCurve: -0.22,
    mouthOpen: 0,
    mouthWidth: 6.2,
    blush: 0.28,
    noseWrinkle: 0.18,
  },
  disgust: {
    browInnerY: -0.22,
    browOuterY: -0.08,
    browKnit: 0.42,
    browY: 7.2,
    eyeOpen: 0.62,
    mouthCurve: -0.35,
    mouthOpen: 0.28,
    mouthWidth: 7.8,
    mouthY: 69.2,
    blush: 0.2,
    noseWrinkle: 0.82,
  },
  contempt: {
    browInnerY: 0.04,
    browOuterY: 0.12,
    browKnit: 0.12,
    browAsym: 0.28,
    eyeOpen: 0.9,
    mouthCurve: 0.28,
    mouthWidth: 6.8,
    mouthAsym: 0.78,
    blush: 0.12,
  },
  curious: {
    browInnerY: 0.42,
    browOuterY: 0.62,
    browKnit: 0.12,
    browAsym: 0.62,
    browY: 9.2,
    winkLeft: 1,
    eyeOpen: 1.08,
    mouthCurve: 0.38,
    mouthWidth: 6.4,
    blush: 0.4,
  },
  thinking: {
    browInnerY: 0.48,
    browOuterY: 0.08,
    browKnit: 0.22,
    browAsym: 0.32,
    browY: 9,
    lookX: 0.12,
    lookY: -0.72,
    mouthCurve: 0.04,
    mouthOpen: 0.18,
    mouthWidth: 3.2,
    blush: 0.24,
    spark: true,
  },
  sleepy: {
    browInnerY: -0.08,
    browOuterY: -0.18,
    browKnit: 0.12,
    browY: 6.6,
    eyeOpen: 0.12,
    lookY: 0.4,
    mouthCurve: 0.08,
    mouthWidth: 5.8,
    blush: 0.22,
    zzz: true,
  },
  worry: {
    browInnerY: 0.68,
    browOuterY: 0.12,
    browKnit: 0.7,
    browY: 9,
    eyeOpen: 1.1,
    mouthCurve: -0.08,
    mouthOpen: 0.38,
    mouthWidth: 5.4,
    blush: 0.26,
  },
  celebrate: {
    browInnerY: 0.28,
    browOuterY: 0.34,
    browKnit: 0,
    eyeOpen: 0.18,
    mouthCurve: 1,
    mouthWidth: 10.2,
    blush: 0.78,
    cheekRaise: 1,
    spark: true,
  },
  grabbed: {
    browInnerY: -0.12,
    browOuterY: -0.18,
    browKnit: 0.2,
    browY: 6.2,
    eyeOpen: 0.08,
    mouthCurve: 0,
    mouthOpen: 0,
    mouthWidth: 8.4,
    blush: 0.45,
  },
};

export const COMPANION_FACE_TO_EMOTION: Record<AppendooCompanionFace, AppendooEmotionId> = {
  idle: 'neutral',
  happy: 'joy',
  curious: 'curious',
  thinking: 'thinking',
  surprised: 'surprise',
  sleepy: 'sleepy',
  celebrate: 'celebrate',
  oops: 'worry',
  grabbed: 'grabbed',
};

const clamp = (value: number, min: number, max: number): number => (
  Math.min(max, Math.max(min, value))
);

export const mergeAppendooFaceRig = (
  ...parts: Array<Partial<AppendooFaceRig> | undefined>
): AppendooFaceRig => {
  const merged = { ...APPENDOO_DEFAULT_RIG };
  for (const part of parts) {
    if (!part) continue;
    Object.assign(merged, part);
  }
  return merged;
};

export const resolveAppendooFaceRig = (input: {
  emotion: AppendooEmotionId;
  blinking?: boolean;
  layout?: Partial<AppendooFaceRig>;
  override?: Partial<AppendooFaceRig>;
}): AppendooFaceRig => {
  const rig = mergeAppendooFaceRig(input.layout, APPENDOO_EMOTION_PRESETS[input.emotion], input.override);
  if (input.blinking) {
    rig.eyeOpen = 0.08;
    rig.winkLeft = 1;
    rig.winkRight = 1;
  }
  rig.browInnerY = clamp(rig.browInnerY, -1, 1);
  rig.browOuterY = clamp(rig.browOuterY, -1, 1);
  rig.browKnit = clamp(rig.browKnit, 0, 1);
  rig.browAsym = clamp(rig.browAsym, -1, 1);
  rig.eyeOpen = clamp(rig.eyeOpen, 0, 1.4);
  rig.winkLeft = clamp(rig.winkLeft, 0, 1);
  rig.winkRight = clamp(rig.winkRight, 0, 1);
  rig.mouthCurve = clamp(rig.mouthCurve, -1, 1);
  rig.mouthOpen = clamp(rig.mouthOpen, 0, 1);
  rig.mouthAsym = clamp(rig.mouthAsym, -1, 1);
  rig.blush = clamp(rig.blush, 0, 1);
  rig.cheekRaise = clamp(rig.cheekRaise, 0, 1);
  rig.noseWrinkle = clamp(rig.noseWrinkle, 0, 1);
  rig.lookX = clamp(rig.lookX, -1, 1);
  rig.lookY = clamp(rig.lookY, -1, 1);
  return rig;
};

export const isAppendooEmotionId = (value: string): value is AppendooEmotionId => (
  (APPENDOO_EMOTION_IDS as readonly string[]).includes(value)
);
