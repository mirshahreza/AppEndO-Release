import { useEffect, useRef, useState } from 'react';
import {
  APPENDOO_EMOTION_RIM_DURATION_MS,
  easeAppendooEmotionRim,
  lerpAppendooEmotionRim,
  resolveAppendooEmotionRim,
  type AppendooEmotionRim,
} from './appendooEmotionRim';
import type { AppendooEmotionId } from './appendooFaceRig';

const reducedMotionPreferred = (): boolean => (
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches
);

export const useAppendooEmotionRim = (emotion: AppendooEmotionId): AppendooEmotionRim => {
  const target = resolveAppendooEmotionRim(emotion);
  const [current, setCurrent] = useState(target);
  const currentRef = useRef(current);
  currentRef.current = current;

  useEffect(() => {
    const next = resolveAppendooEmotionRim(emotion);
    if (reducedMotionPreferred()) {
      setCurrent(next);
      return undefined;
    }
    const from = currentRef.current;
    if (
      from.rimAsym === next.rimAsym
      && from.rimShiftX === next.rimShiftX
      && from.rimShiftY === next.rimShiftY
      && from.rimScale === next.rimScale
      && from.size === next.size
    ) {
      return undefined;
    }
    const startedAt = typeof performance === 'undefined' ? 0 : performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = easeAppendooEmotionRim((now - startedAt) / APPENDOO_EMOTION_RIM_DURATION_MS);
      setCurrent(lerpAppendooEmotionRim(from, next, t));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
  }, [emotion]);

  return current;
};
