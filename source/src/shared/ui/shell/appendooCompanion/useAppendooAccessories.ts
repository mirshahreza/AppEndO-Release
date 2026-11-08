import { useEffect, useRef, useState } from 'react';
import { APPENDOO_EMOTION_RIM_DURATION_MS, easeAppendooEmotionRim } from './appendooEmotionRim';
import {
  APPENDOO_ACCESSORY_IDS,
  lerpAppendooAccessoryMood,
  resolveAppendooAccessoryMood,
  type AppendooAccessoryMood,
} from './appendooAccessories';
import type { AppendooEmotionId } from './appendooFaceRig';

const reducedMotionPreferred = (): boolean => (
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches
);

const sameMood = (a: AppendooAccessoryMood, b: AppendooAccessoryMood): boolean => (
  APPENDOO_ACCESSORY_KEYS.every((id) => (
    a[id].lift === b[id].lift
    && a[id].shiftX === b[id].shiftX
    && a[id].scale === b[id].scale
    && a[id].tilt === b[id].tilt
  ))
);

const APPENDOO_ACCESSORY_KEYS = APPENDOO_ACCESSORY_IDS;

export const useAppendooAccessories = (emotion: AppendooEmotionId): AppendooAccessoryMood => {
  const target = resolveAppendooAccessoryMood(emotion);
  const [current, setCurrent] = useState(target);
  const currentRef = useRef(current);
  currentRef.current = current;

  useEffect(() => {
    const next = resolveAppendooAccessoryMood(emotion);
    if (reducedMotionPreferred()) {
      setCurrent(next);
      return undefined;
    }
    const from = currentRef.current;
    if (sameMood(from, next)) return undefined;
    const startedAt = typeof performance === 'undefined' ? 0 : performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = easeAppendooEmotionRim((now - startedAt) / APPENDOO_EMOTION_RIM_DURATION_MS);
      setCurrent(lerpAppendooAccessoryMood(from, next, t));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
  }, [emotion]);

  return current;
};
