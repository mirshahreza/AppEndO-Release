import { mergeAppendooBodyRig, type AppendooBodyRig } from './appendooBodyShape';
import type { AppendooEmotionId } from './appendooFaceRig';

export type AppendooEmotionRim = {
  rimAsym: number;
  rimShiftX: number;
  rimShiftY: number;
  rimScale: number;
  size: number;
};

export const APPENDOO_EMOTION_RIM_DURATION_MS = 640;

/**
 * Halo lean plus a size multiplier on top of the playground size.
 * Neutral tucks a little; surprise and celebrate puff up.
 */
export const APPENDOO_EMOTION_RIM: Record<AppendooEmotionId, AppendooEmotionRim> = {
  neutral: { rimAsym: 0, rimShiftX: 0, rimShiftY: 0, rimScale: 0, size: 0.94 },
  joy: { rimAsym: 0.14, rimShiftX: 0.2, rimShiftY: -0.16, rimScale: 0.024, size: 1.06 },
  sadness: { rimAsym: 0.1, rimShiftX: -0.14, rimShiftY: 0.2, rimScale: -0.018, size: 0.92 },
  surprise: { rimAsym: 0.18, rimShiftX: 0.04, rimShiftY: -0.28, rimScale: 0.04, size: 1.14 },
  fear: { rimAsym: 0.22, rimShiftX: -0.26, rimShiftY: 0.08, rimScale: 0.016, size: 1.08 },
  anger: { rimAsym: 0.16, rimShiftX: 0.14, rimShiftY: 0.06, rimScale: 0.028, size: 1.05 },
  disgust: { rimAsym: 0.2, rimShiftX: 0.26, rimShiftY: 0.12, rimScale: 0.008, size: 0.98 },
  contempt: { rimAsym: 0.24, rimShiftX: 0.32, rimShiftY: -0.08, rimScale: 0.012, size: 1.02 },
  curious: { rimAsym: 0.12, rimShiftX: -0.22, rimShiftY: -0.14, rimScale: 0.016, size: 1.04 },
  thinking: { rimAsym: 0.08, rimShiftX: 0.1, rimShiftY: -0.2, rimScale: 0.006, size: 0.97 },
  sleepy: { rimAsym: 0.06, rimShiftX: 0.06, rimShiftY: 0.18, rimScale: -0.028, size: 0.9 },
  worry: { rimAsym: 0.18, rimShiftX: -0.16, rimShiftY: 0.12, rimScale: 0.01, size: 0.97 },
  celebrate: { rimAsym: 0.2, rimShiftX: 0.18, rimShiftY: -0.24, rimScale: 0.036, size: 1.12 },
  grabbed: { rimAsym: 0.28, rimShiftX: 0.02, rimShiftY: 0.22, rimScale: -0.036, size: 0.88 },
};

export const resolveAppendooEmotionRim = (emotion: AppendooEmotionId): AppendooEmotionRim => (
  APPENDOO_EMOTION_RIM[emotion]
);

export const easeAppendooEmotionRim = (t: number): number => {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - (1 - clamped) ** 3;
};

export const lerpAppendooEmotionRim = (
  from: AppendooEmotionRim,
  to: AppendooEmotionRim,
  t: number,
): AppendooEmotionRim => {
  const mix = (start: number, end: number) => start + (end - start) * Math.min(1, Math.max(0, t));
  return {
    rimAsym: mix(from.rimAsym, to.rimAsym),
    rimShiftX: mix(from.rimShiftX, to.rimShiftX),
    rimShiftY: mix(from.rimShiftY, to.rimShiftY),
    rimScale: mix(from.rimScale, to.rimScale),
    size: mix(from.size, to.size),
  };
};

const clampSize = (value: number): number => Math.min(14, Math.max(0.8, value));

export const applyAppendooEmotionRim = (
  body: AppendooBodyRig,
  rim: AppendooEmotionRim | AppendooEmotionId,
): AppendooBodyRig => {
  const mood = typeof rim === 'string' ? APPENDOO_EMOTION_RIM[rim] : rim;
  const next = mergeAppendooBodyRig(body, {
    rimAsym: body.rimAsym + mood.rimAsym,
    rimShiftX: body.rimShiftX + mood.rimShiftX,
    rimShiftY: body.rimShiftY + mood.rimShiftY,
    rimScale: body.rimScale + mood.rimScale,
  });
  return { ...next, size: clampSize(body.size * mood.size) };
};
