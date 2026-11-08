import { useEffect, useState } from 'react';

const ATTENTION_VARIANTS = ['shimmer', 'lift', 'hue'] as const;

export type AppEndOAttentionVariant = (typeof ATTENTION_VARIANTS)[number];

export type AppEndOAttentionCue = {
  variant: AppEndOAttentionVariant;
  tiltX: string;
  tiltY: string;
};

const MIN_INTERVAL_MS = 35_000;
const MAX_INTERVAL_MS = 95_000;
const CUE_DURATION_MS = 3_000;

function pickRandomVariant(): AppEndOAttentionVariant {
  return ATTENTION_VARIANTS[Math.floor(Math.random() * ATTENTION_VARIANTS.length)];
}

function randomTiltDegrees(): Pick<AppEndOAttentionCue, 'tiltX' | 'tiltY'> {
  const tiltX = (Math.random() * 8 - 4).toFixed(1);
  const tiltY = (Math.random() * 8 - 4).toFixed(1);
  return { tiltX: `${tiltX}deg`, tiltY: `${tiltY}deg` };
}

function buildCue(variant: AppEndOAttentionVariant): AppEndOAttentionCue {
  return { variant, ...randomTiltDegrees() };
}

function randomIntervalMs(): number {
  return MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Occasionally nudges the shell AppEndO trigger when the panel is closed. */
export function useAppEndOAttentionCue(isPaused: boolean): AppEndOAttentionCue | null {
  const [cue, setCue] = useState<AppEndOAttentionCue | null>(null);

  useEffect(() => {
    if (isPaused || prefersReducedMotion()) {
      setCue(null);
      return;
    }

    let scheduleTimeoutId: ReturnType<typeof setTimeout> | undefined;
    let clearCueTimeoutId: ReturnType<typeof setTimeout> | undefined;

    const scheduleNextCue = () => {
      scheduleTimeoutId = setTimeout(() => {
        setCue(buildCue(pickRandomVariant()));
        clearCueTimeoutId = setTimeout(() => {
          setCue(null);
          scheduleNextCue();
        }, CUE_DURATION_MS);
      }, randomIntervalMs());
    };

    scheduleNextCue();

    return () => {
      if (scheduleTimeoutId !== undefined) {
        clearTimeout(scheduleTimeoutId);
      }
      if (clearCueTimeoutId !== undefined) {
        clearTimeout(clearCueTimeoutId);
      }
    };
  }, [isPaused]);

  return cue;
}
