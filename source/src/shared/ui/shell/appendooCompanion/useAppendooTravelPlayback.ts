import { useEffect, useRef, useState } from 'react';
import {
  mergeAppendooTravelRig,
  pingPongAppendooTravelTime,
  sampleAppendooTravel,
  type AppendooTravelRig,
} from './appendooTravel';

const reducedMotionPreferred = (): boolean => (
  typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches
);

export const useAppendooTravelPlayback = (rig: AppendooTravelRig) => {
  const travel = mergeAppendooTravelRig(rig);
  const [playing, setPlaying] = useState(false);
  const [point, setPoint] = useState(() => sampleAppendooTravel(travel, 0));
  const frameRef = useRef(0);
  const startedAtRef = useRef(0);
  const reverseRef = useRef(false);
  const travelRef = useRef(travel);
  travelRef.current = travel;

  const stop = () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    setPlaying(false);
  };

  const play = (reverse = false) => {
    reverseRef.current = reverse;
    startedAtRef.current = typeof performance === 'undefined' ? 0 : performance.now();
    setPoint(sampleAppendooTravel(travelRef.current, reverse ? 1 : 0));
    setPlaying(true);
  };

  useEffect(() => {
    if (playing) return;
    setPoint(sampleAppendooTravel(travel, 0));
  }, [travel.fromX, travel.fromY, travel.toX, travel.toY]);

  useEffect(() => {
    if (!playing) return undefined;
    const current = travelRef.current;
    if (reducedMotionPreferred()) {
      setPoint(sampleAppendooTravel(current, reverseRef.current ? 0 : 1));
      setPlaying(false);
      return undefined;
    }
    const tick = (now: number) => {
      const next = travelRef.current;
      const elapsed = now - startedAtRef.current;
      const { time, done } = pingPongAppendooTravelTime(elapsed, next.durationMs, next.loop);
      setPoint(sampleAppendooTravel(next, reverseRef.current ? 1 - time : time));
      if (done) {
        setPlaying(false);
        return;
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [playing]);

  return {
    point,
    playing,
    play: () => play(false),
    reverse: () => play(true),
    stop,
  };
};
