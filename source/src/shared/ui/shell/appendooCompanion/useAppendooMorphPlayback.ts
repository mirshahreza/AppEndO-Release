import { useEffect, useRef, useState } from 'react';
import {
  easeAppendooMorph,
  mergeAppendooMorphRig,
  mixAppendooMorphLayers,
  type AppendooMorphRig,
} from './appendooMorph';
import type { AppendooSilhouetteLayers } from './appendooBodyShape';

const reducedMotionPreferred = (): boolean => (
  typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches
);

export const useAppendooMorphPlayback = (rig: AppendooMorphRig) => {
  const morph = mergeAppendooMorphRig(rig);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [runId, setRunId] = useState(0);
  const frameRef = useRef(0);
  const startedAtRef = useRef(0);
  const originTimeRef = useRef(0);
  const directionRef = useRef<1 | -1>(1);
  const fromRef = useRef<AppendooSilhouetteLayers | null>(null);
  const toRef = useRef<AppendooSilhouetteLayers | null>(null);
  const morphRef = useRef(morph);
  const timeRef = useRef(0);
  morphRef.current = morph;
  timeRef.current = time;

  const stop = () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    setPlaying(false);
  };

  const play = (from: AppendooSilhouetteLayers, to: AppendooSilhouetteLayers) => {
    fromRef.current = from;
    toRef.current = to;
    directionRef.current = 1;
    originTimeRef.current = 0;
    startedAtRef.current = typeof performance === 'undefined' ? 0 : performance.now();
    setTime(0);
    setRunId((current) => current + 1);
    setPlaying(true);
  };

  useEffect(() => {
    if (!playing) return undefined;
    const duration = morphRef.current.durationMs;
    if (reducedMotionPreferred()) {
      setTime(directionRef.current < 0 ? 0 : 1);
      setPlaying(false);
      return undefined;
    }
    const tick = (now: number) => {
      const elapsed = now - startedAtRef.current;
      const delta = duration <= 0 ? 1 : elapsed / duration;
      const next = directionRef.current < 0
        ? Math.max(0, originTimeRef.current - delta)
        : Math.min(1, originTimeRef.current + delta);
      setTime(next);
      if ((directionRef.current > 0 && next >= 1) || (directionRef.current < 0 && next <= 0)) {
        setPlaying(false);
        return;
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [playing, runId]);

  const from = fromRef.current;
  const to = toRef.current;
  const progress = easeAppendooMorph(morph, time);
  const layers = from && to ? mixAppendooMorphLayers(from, to, progress) : null;

  return {
    time,
    progress,
    playing,
    layers,
    extrasOpacity: layers ? 1 - progress : 1,
    play: (fromLayers: AppendooSilhouetteLayers, toLayers: AppendooSilhouetteLayers) => play(fromLayers, toLayers),
    reverse: () => {
      if (!fromRef.current || !toRef.current || timeRef.current <= 0) return;
      directionRef.current = -1;
      originTimeRef.current = timeRef.current;
      startedAtRef.current = typeof performance === 'undefined' ? 0 : performance.now();
      setRunId((current) => current + 1);
      setPlaying(true);
    },
    rest: () => {
      stop();
      fromRef.current = null;
      toRef.current = null;
      setTime(0);
    },
    stop,
  };
};
