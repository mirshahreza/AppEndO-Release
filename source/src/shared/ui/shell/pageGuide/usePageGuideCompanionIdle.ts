import { useEffect, useRef, useState } from 'react';
import {
  APPENDOO_POINTER_LOOK_REST,
  resolveAppendooPointerLook,
  type AppendooPointerLook,
} from '../appendooCompanion/appendooPointerLook';
import {
  PAGE_GUIDE_COMPANION_HEIGHT_PX,
  PAGE_GUIDE_COMPANION_WIDTH_PX,
  type PageGuidePoint,
} from './pageGuide.types';

export type PageGuideCompanionIdlePose = {
  scaleX: number;
  scaleY: number;
  tilt: number;
};

const IDLE_POSE_REST: PageGuideCompanionIdlePose = { scaleX: 1, scaleY: 1, tilt: 0 };
export const PAGE_GUIDE_WONK_REST = 1;
export const PAGE_GUIDE_WONK_PEAK = 10;
export const PAGE_GUIDE_WONK_PER_PX = 0.016;
export const PAGE_GUIDE_WONK_FALL_PER_MS = 9 / 820;
const HOVER_PAD_PX = 14;

const randomBetween = (min: number, max: number): number => min + Math.random() * (max - min);

const nextIdlePose = (): PageGuideCompanionIdlePose => {
  const squash = randomBetween(-0.07, 0.08);
  const scale = randomBetween(0.94, 1.08);
  return {
    scaleX: scale * (1 + squash),
    scaleY: scale * (1 - squash),
    tilt: randomBetween(-7, 7),
  };
};

const prefersReducedMotion = (): boolean => (
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches
);

const clamp = (value: number, min: number, max: number): number => (
  Math.min(max, Math.max(min, value))
);

export const stepPageGuideHoverWonk = (
  current: number,
  over: boolean,
  movePx: number,
  dtMs: number,
): number => {
  const next = over
    ? current + movePx * PAGE_GUIDE_WONK_PER_PX
    : current - dtMs * PAGE_GUIDE_WONK_FALL_PER_MS;
  return clamp(next, PAGE_GUIDE_WONK_REST, PAGE_GUIDE_WONK_PEAK);
};

const isOverCompanion = (clientX: number, clientY: number, origin: PageGuidePoint): boolean => (
  clientX >= origin.x - HOVER_PAD_PX
  && clientX <= origin.x + PAGE_GUIDE_COMPANION_WIDTH_PX + HOVER_PAD_PX
  && clientY >= origin.y - HOVER_PAD_PX
  && clientY <= origin.y + PAGE_GUIDE_COMPANION_HEIGHT_PX + HOVER_PAD_PX
);

export const usePageGuideCompanionIdle = (origin: PageGuidePoint, enabled: boolean) => {
  const [look, setLook] = useState<AppendooPointerLook>(APPENDOO_POINTER_LOOK_REST);
  const [pose, setPose] = useState<PageGuideCompanionIdlePose>(IDLE_POSE_REST);
  const [wonk, setWonk] = useState(PAGE_GUIDE_WONK_REST);
  const hoveringRef = useRef(false);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const wonkRef = useRef(PAGE_GUIDE_WONK_REST);
  const originRef = useRef(origin);
  originRef.current = origin;

  useEffect(() => {
    if (!enabled || prefersReducedMotion()) {
      setLook(APPENDOO_POINTER_LOOK_REST);
      hoveringRef.current = false;
      lastPointerRef.current = null;
      wonkRef.current = PAGE_GUIDE_WONK_REST;
      setWonk(PAGE_GUIDE_WONK_REST);
      return undefined;
    }

    const onMove = (event: PointerEvent) => {
      const box = originRef.current;
      setLook(resolveAppendooPointerLook(event.clientX, event.clientY, {
        x: box.x + PAGE_GUIDE_COMPANION_WIDTH_PX / 2,
        y: box.y + PAGE_GUIDE_COMPANION_HEIGHT_PX / 2,
      }));

      const over = isOverCompanion(event.clientX, event.clientY, box);
      hoveringRef.current = over;
      if (!over) {
        lastPointerRef.current = null;
        return;
      }

      const previous = lastPointerRef.current;
      lastPointerRef.current = { x: event.clientX, y: event.clientY };
      if (!previous) return;
      const movePx = Math.hypot(event.clientX - previous.x, event.clientY - previous.y);
      if (movePx < 0.4) return;
      wonkRef.current = stepPageGuideHoverWonk(wonkRef.current, true, movePx, 0);
      setWonk(wonkRef.current);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || prefersReducedMotion()) return undefined;

    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(48, now - last);
      last = now;
      if (!hoveringRef.current && wonkRef.current > PAGE_GUIDE_WONK_REST) {
        wonkRef.current = stepPageGuideHoverWonk(wonkRef.current, false, 0, dt);
        setWonk(wonkRef.current);
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || prefersReducedMotion()) {
      setPose(IDLE_POSE_REST);
      return undefined;
    }

    let timer = 0;
    const schedule = () => {
      timer = window.setTimeout(() => {
        setPose(nextIdlePose());
        schedule();
      }, randomBetween(2800, 6200));
    };
    timer = window.setTimeout(() => {
      setPose(nextIdlePose());
      schedule();
    }, 900);
    return () => window.clearTimeout(timer);
  }, [enabled]);

  return { look, pose, wonk };
};
