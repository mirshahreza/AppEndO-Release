import type { AppendooAccessoryMood, AppendooAccessoryPose } from './appendooAccessories';

export const APPENDOO_POINTER_LOOK_RANGE = 90;

export type AppendooPointerLook = {
  lookX: number;
  lookY: number;
};

const clamp = (value: number, min: number, max: number): number => (
  Math.min(max, Math.max(min, value))
);

export const APPENDOO_POINTER_LOOK_REST: AppendooPointerLook = { lookX: 0, lookY: 0 };

export const resolveAppendooPointerLook = (
  clientX: number,
  clientY: number,
  origin: { x: number; y: number },
  range = APPENDOO_POINTER_LOOK_RANGE,
): AppendooPointerLook => ({
  lookX: clamp((clientX - origin.x) / range, -1, 1),
  lookY: clamp((clientY - origin.y) / range, -1, 1),
});

const biasPose = (
  pose: AppendooAccessoryPose,
  look: AppendooPointerLook,
  amount: { tilt: number; shiftX: number; lift: number },
): AppendooAccessoryPose => ({
  ...pose,
  tilt: pose.tilt + look.lookX * amount.tilt,
  shiftX: pose.shiftX + look.lookX * amount.shiftX,
  lift: pose.lift - look.lookY * amount.lift,
});

export const applyAppendooPointerLookToMood = (
  mood: AppendooAccessoryMood,
  look: AppendooPointerLook,
): AppendooAccessoryMood => ({
  hat: biasPose(mood.hat, look, { tilt: 10, shiftX: 1.6, lift: 2.2 }),
  glasses: biasPose(mood.glasses, look, { tilt: 4, shiftX: 2.2, lift: 1.4 }),
  headphones: biasPose(mood.headphones, look, { tilt: 6, shiftX: 1.1, lift: 1.2 }),
});
