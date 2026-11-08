import { useCallback, useEffect, useRef, useState } from 'react';
import { takePageGuideOrigin } from './pageGuideStore';
import { pageGuideTravelDistance, samplePageGuideHop } from './pageGuideTravel';
import {
  PAGE_GUIDE_TRAVEL_MS,
  type PageGuidePoint,
} from './pageGuide.types';

const reducedMotionPreferred = (): boolean => (
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches
);

export const usePageGuideTravel = (target: PageGuidePoint | null) => {
  const [point, setPoint] = useState<PageGuidePoint>(() => (
    takePageGuideOrigin() ?? target ?? { x: 24, y: 24 }
  ));
  const [traveling, setTraveling] = useState(false);
  const retargetNonceRef = useRef(0);
  const [retargetNonce, setRetargetNonce] = useState(0);
  const fromRef = useRef<PageGuidePoint>(point);
  const frameRef = useRef(0);
  const startedAtRef = useRef(0);
  const targetRef = useRef(target);
  targetRef.current = target;

  useEffect(() => {
    if (!target) {
      setTraveling(false);
      return undefined;
    }
    const from = fromRef.current;
    if (pageGuideTravelDistance(from, target) < 8 || reducedMotionPreferred()) {
      fromRef.current = target;
      setPoint(target);
      setTraveling(false);
      return undefined;
    }

    startedAtRef.current = performance.now();
    setTraveling(true);
    const tick = (now: number) => {
      const nextTarget = targetRef.current;
      if (!nextTarget) return;
      const time = (now - startedAtRef.current) / PAGE_GUIDE_TRAVEL_MS;
      if (time >= 1) {
        fromRef.current = nextTarget;
        setPoint(nextTarget);
        setTraveling(false);
        return;
      }
      setPoint(samplePageGuideHop(from, nextTarget, time));
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [retargetNonce, target?.x, target?.y]);

  const snapTo = useCallback((next: PageGuidePoint) => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    fromRef.current = next;
    setPoint(next);
    setTraveling(false);
  }, []);

  const retarget = useCallback(() => {
    retargetNonceRef.current += 1;
    setRetargetNonce(retargetNonceRef.current);
  }, []);

  return { point, traveling, snapTo, retarget };
};
