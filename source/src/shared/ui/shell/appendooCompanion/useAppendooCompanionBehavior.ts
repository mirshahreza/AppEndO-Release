import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  APPENDOO_COMPANION_MOOD_EVENT,
  APPENDOO_COMPANION_NEAR_PX,
  APPENDOO_COMPANION_SLEEP_AFTER_MS,
  APPENDOO_COMPANION_SURPRISE_SPEED_PX_PER_MS,
  type AppendooCompanionFace,
  type AppendooCompanionMoodDetail,
} from './appendooCompanion.types';
import { resolveCompanionFace } from './resolveCompanionFace';
import { resolveAppendooPointerLook } from './appendooPointerLook';

const BLINK_MIN_MS = 2_800;
const BLINK_MAX_MS = 7_200;
const BLINK_HOLD_MS = 140;
const SURPRISE_HOLD_MS = 720;

const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

const randomBlinkDelay = (): number => (
  BLINK_MIN_MS + Math.random() * (BLINK_MAX_MS - BLINK_MIN_MS)
);

export const useAppendooCompanionBehavior = (
  rootRef: RefObject<HTMLElement | null>,
  dragged: boolean,
  hovered: boolean,
): {
  face: AppendooCompanionFace;
  blinking: boolean;
  reducedMotion: boolean;
} => {
  const [sleepy, setSleepy] = useState(false);
  const [surprised, setSurprised] = useState(false);
  const [near, setNear] = useState(false);
  const [override, setOverride] = useState<AppendooCompanionFace | null>(null);
  const [blinking, setBlinking] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);
  const lastPointerRef = useRef<{ x: number; y: number; at: number } | null>(null);
  const sleepTimerRef = useRef<number | undefined>(undefined);
  const surpriseTimerRef = useRef<number | undefined>(undefined);
  const overrideTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const bumpActivity = () => {
      setSleepy(false);
      if (sleepTimerRef.current !== undefined) {
        window.clearTimeout(sleepTimerRef.current);
      }
      sleepTimerRef.current = window.setTimeout(() => {
        setSleepy(true);
      }, APPENDOO_COMPANION_SLEEP_AFTER_MS);
    };

    bumpActivity();

    const onPointerMove = (event: PointerEvent) => {
      bumpActivity();
      const root = rootRef.current;
      if (!root) return;

      const rect = root.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = event.clientX - centerX;
      const dy = event.clientY - centerY;
      const distance = Math.hypot(dx, dy);
      setNear(distance < APPENDOO_COMPANION_NEAR_PX && distance > rect.width / 2);

      const look = resolveAppendooPointerLook(event.clientX, event.clientY, {
        x: centerX,
        y: centerY,
      });
      root.style.setProperty('--appendoo-look-x', look.lookX.toFixed(3));
      root.style.setProperty('--appendoo-look-y', look.lookY.toFixed(3));

      const previous = lastPointerRef.current;
      const now = event.timeStamp;
      if (previous) {
        const dt = now - previous.at;
        if (dt > 8 && dt < 80) {
          const speed = Math.hypot(event.clientX - previous.x, event.clientY - previous.y) / dt;
          if (
            speed >= APPENDOO_COMPANION_SURPRISE_SPEED_PX_PER_MS
            && distance < APPENDOO_COMPANION_NEAR_PX + 40
          ) {
            setSurprised(true);
            setSleepy(false);
            if (surpriseTimerRef.current !== undefined) {
              window.clearTimeout(surpriseTimerRef.current);
            }
            surpriseTimerRef.current = window.setTimeout(() => {
              setSurprised(false);
            }, SURPRISE_HOLD_MS);
          }
        }
      }
      lastPointerRef.current = { x: event.clientX, y: event.clientY, at: now };
    };

    const onKeyOrClick = () => bumpActivity();

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('keydown', onKeyOrClick);
    window.addEventListener('pointerdown', onKeyOrClick);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('keydown', onKeyOrClick);
      window.removeEventListener('pointerdown', onKeyOrClick);
      if (sleepTimerRef.current !== undefined) window.clearTimeout(sleepTimerRef.current);
      if (surpriseTimerRef.current !== undefined) window.clearTimeout(surpriseTimerRef.current);
    };
  }, [rootRef]);

  useEffect(() => {
    const onMood = (event: Event) => {
      const detail = (event as CustomEvent<AppendooCompanionMoodDetail>).detail;
      if (!detail?.face) return;
      setOverride(detail.face);
      setSleepy(false);
      if (overrideTimerRef.current !== undefined) {
        window.clearTimeout(overrideTimerRef.current);
      }
      overrideTimerRef.current = window.setTimeout(() => {
        setOverride(null);
      }, detail.durationMs ?? 1400);
    };

    window.addEventListener(APPENDOO_COMPANION_MOOD_EVENT, onMood as EventListener);
    return () => {
      window.removeEventListener(APPENDOO_COMPANION_MOOD_EVENT, onMood as EventListener);
      if (overrideTimerRef.current !== undefined) window.clearTimeout(overrideTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (reducedMotion || dragged) {
      setBlinking(false);
      return undefined;
    }

    let blinkTimeout: number | undefined;
    let holdTimeout: number | undefined;
    const schedule = () => {
      blinkTimeout = window.setTimeout(() => {
        setBlinking(true);
        holdTimeout = window.setTimeout(() => {
          setBlinking(false);
          schedule();
        }, BLINK_HOLD_MS);
      }, randomBlinkDelay());
    };
    schedule();
    return () => {
      if (blinkTimeout !== undefined) window.clearTimeout(blinkTimeout);
      if (holdTimeout !== undefined) window.clearTimeout(holdTimeout);
    };
  }, [dragged, reducedMotion]);

  return {
    face: resolveCompanionFace({
      dragged,
      hovered,
      sleepy,
      surprised,
      near,
      override,
    }),
    blinking,
    reducedMotion,
  };
};
