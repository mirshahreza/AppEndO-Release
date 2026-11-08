import type { PageGuidePoint } from './pageGuide.types';
import { PAGE_GUIDE_ARC_MAX_PX } from './pageGuide.types';

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** Ease-out back — overshoots then settles onto the next stop. */
export const easePageGuideHop = (time: number): number => {
  const t = clamp01(time);
  const overshoot = 1.70158;
  const peak = overshoot + 1;
  return 1 + peak * (t - 1) ** 3 + overshoot * (t - 1) ** 2;
};

export const samplePageGuideHop = (
  from: PageGuidePoint,
  to: PageGuidePoint,
  time: number,
): PageGuidePoint => {
  const t = easePageGuideHop(time);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const arc = Math.min(PAGE_GUIDE_ARC_MAX_PX, Math.max(28, distance * 0.32));
  return {
    x: from.x + dx * t,
    y: from.y + dy * t - Math.sin(Math.PI * clamp01(time)) * arc,
  };
};

export const pageGuideTravelDistance = (from: PageGuidePoint, to: PageGuidePoint): number => (
  Math.hypot(to.x - from.x, to.y - from.y)
);
