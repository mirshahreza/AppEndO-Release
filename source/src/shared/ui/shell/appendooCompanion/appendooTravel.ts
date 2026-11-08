export const APPENDOO_TRAVEL_EASING_IDS = [
  'linear',
  'ease',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'ease-in-sine',
  'ease-out-sine',
  'ease-in-out-sine',
  'ease-in-cubic',
  'ease-out-cubic',
  'ease-in-out-cubic',
  'ease-in-back',
  'ease-out-back',
  'ease-in-out-back',
  'custom',
] as const;

export type AppendooTravelEasingId = (typeof APPENDOO_TRAVEL_EASING_IDS)[number];

export type AppendooCubicBezier = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type AppendooTravelRig = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  durationMs: number;
  easing: AppendooTravelEasingId;
  bezierX1: number;
  bezierY1: number;
  bezierX2: number;
  bezierY2: number;
  loop: boolean;
};

export type AppendooTravelEasingMeta = {
  id: AppendooTravelEasingId;
  label: string;
  note: string;
  bezier: AppendooCubicBezier;
};

export const APPENDOO_TRAVEL_EASING_META: Record<AppendooTravelEasingId, AppendooTravelEasingMeta> = {
  linear: { id: 'linear', label: 'Linear', note: 'Constant speed.', bezier: { x1: 0, y1: 0, x2: 1, y2: 1 } },
  ease: { id: 'ease', label: 'Ease', note: 'CSS default: slow start and finish.', bezier: { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 } },
  'ease-in': { id: 'ease-in', label: 'Ease in', note: 'Starts slow, then accelerates.', bezier: { x1: 0.42, y1: 0, x2: 1, y2: 1 } },
  'ease-out': { id: 'ease-out', label: 'Ease out', note: 'Starts fast, then settles.', bezier: { x1: 0, y1: 0, x2: 0.58, y2: 1 } },
  'ease-in-out': { id: 'ease-in-out', label: 'Ease in-out', note: 'Slow at both ends.', bezier: { x1: 0.42, y1: 0, x2: 0.58, y2: 1 } },
  'ease-in-sine': { id: 'ease-in-sine', label: 'Sine in', note: 'Gentle acceleration.', bezier: { x1: 0.12, y1: 0, x2: 0.39, y2: 0 } },
  'ease-out-sine': { id: 'ease-out-sine', label: 'Sine out', note: 'Gentle deceleration.', bezier: { x1: 0.61, y1: 1, x2: 0.88, y2: 1 } },
  'ease-in-out-sine': { id: 'ease-in-out-sine', label: 'Sine in-out', note: 'Soft S-curve.', bezier: { x1: 0.37, y1: 0, x2: 0.63, y2: 1 } },
  'ease-in-cubic': { id: 'ease-in-cubic', label: 'Cubic in', note: 'Stronger acceleration.', bezier: { x1: 0.32, y1: 0, x2: 0.67, y2: 0 } },
  'ease-out-cubic': { id: 'ease-out-cubic', label: 'Cubic out', note: 'Stronger settle.', bezier: { x1: 0.33, y1: 1, x2: 0.68, y2: 1 } },
  'ease-in-out-cubic': { id: 'ease-in-out-cubic', label: 'Cubic in-out', note: 'Punchy S-curve.', bezier: { x1: 0.65, y1: 0, x2: 0.35, y2: 1 } },
  'ease-in-back': { id: 'ease-in-back', label: 'Back in', note: 'Pulls back, then goes.', bezier: { x1: 0.36, y1: 0, x2: 0.66, y2: -0.56 } },
  'ease-out-back': { id: 'ease-out-back', label: 'Back out', note: 'Overshoots, then lands.', bezier: { x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 } },
  'ease-in-out-back': { id: 'ease-in-out-back', label: 'Back in-out', note: 'Pull back and overshoot.', bezier: { x1: 0.68, y1: -0.6, x2: 0.32, y2: 1.6 } },
  custom: { id: 'custom', label: 'Custom', note: 'Four cubic-bezier handles you set yourself.', bezier: { x1: 0.33, y1: 1, x2: 0.68, y2: 1 } },
};

export const APPENDOO_DEFAULT_TRAVEL: AppendooTravelRig = {
  fromX: 50,
  fromY: 50,
  toX: 84,
  toY: 18,
  durationMs: 900,
  easing: 'ease-out-cubic',
  bezierX1: 0.33,
  bezierY1: 1,
  bezierX2: 0.68,
  bezierY2: 1,
  loop: false,
};

const clamp = (value: number, min: number, max: number): number => (
  Math.min(max, Math.max(min, value))
);

const sampleCurve = (t: number, p1: number, p2: number): number => {
  const rest = 1 - t;
  return (3 * rest * rest * t * p1) + (3 * rest * t * t * p2) + (t * t * t);
};

const sampleCurveDerivative = (t: number, p1: number, p2: number): number => {
  const rest = 1 - t;
  return (3 * rest * rest * p1) + (6 * rest * t * (p2 - p1)) + (3 * t * t * (1 - p2));
};

export const isAppendooTravelEasingId = (value: string): value is AppendooTravelEasingId => (
  (APPENDOO_TRAVEL_EASING_IDS as readonly string[]).includes(value)
);

export const mergeAppendooTravelRig = (
  ...parts: Array<Partial<AppendooTravelRig> | undefined>
): AppendooTravelRig => {
  const merged = { ...APPENDOO_DEFAULT_TRAVEL };
  for (const part of parts) {
    if (!part) continue;
    Object.assign(merged, part);
  }
  merged.fromX = clamp(merged.fromX, 0, 100);
  merged.fromY = clamp(merged.fromY, 0, 100);
  merged.toX = clamp(merged.toX, 0, 100);
  merged.toY = clamp(merged.toY, 0, 100);
  merged.durationMs = clamp(merged.durationMs, 120, 6000);
  merged.bezierX1 = clamp(merged.bezierX1, 0, 1);
  merged.bezierX2 = clamp(merged.bezierX2, 0, 1);
  merged.bezierY1 = clamp(merged.bezierY1, -1, 2);
  merged.bezierY2 = clamp(merged.bezierY2, -1, 2);
  if (!isAppendooTravelEasingId(merged.easing)) merged.easing = 'custom';
  return merged;
};

export const applyAppendooTravelEasing = (
  rig: AppendooTravelRig,
  easing: AppendooTravelEasingId,
): AppendooTravelRig => {
  const bezier = APPENDOO_TRAVEL_EASING_META[easing].bezier;
  return mergeAppendooTravelRig(rig, {
    easing,
    bezierX1: bezier.x1,
    bezierY1: bezier.y1,
    bezierX2: bezier.x2,
    bezierY2: bezier.y2,
  });
};

export const resolveAppendooTravelBezier = (rig: AppendooTravelRig): AppendooCubicBezier => ({
  x1: rig.bezierX1,
  y1: rig.bezierY1,
  x2: rig.bezierX2,
  y2: rig.bezierY2,
});

export const cssAppendooTravelEasing = (rig: AppendooTravelRig): string => {
  const bezier = resolveAppendooTravelBezier(rig);
  return `cubic-bezier(${bezier.x1}, ${bezier.y1}, ${bezier.x2}, ${bezier.y2})`;
};

export const easeAppendooTravel = (rig: AppendooTravelRig, time: number): number => {
  const x = clamp(time, 0, 1);
  const { x1, y1, x2, y2 } = resolveAppendooTravelBezier(rig);
  if (x <= 0) return 0;
  if (x >= 1) return sampleCurve(1, y1, y2);
  let guess = x;
  for (let index = 0; index < 8; index += 1) {
    const currentX = sampleCurve(guess, x1, x2);
    const delta = currentX - x;
    if (Math.abs(delta) < 1e-6) break;
    const derivative = sampleCurveDerivative(guess, x1, x2);
    if (Math.abs(derivative) < 1e-6) break;
    guess = clamp(guess - delta / derivative, 0, 1);
  }
  return sampleCurve(guess, y1, y2);
};

export const sampleAppendooTravel = (
  rig: AppendooTravelRig,
  time: number,
): { x: number; y: number; progress: number } => {
  const progress = easeAppendooTravel(rig, time);
  return {
    x: rig.fromX + (rig.toX - rig.fromX) * progress,
    y: rig.fromY + (rig.toY - rig.fromY) * progress,
    progress,
  };
};

export const pingPongAppendooTravelTime = (elapsedMs: number, durationMs: number, loop: boolean): {
  time: number;
  done: boolean;
} => {
  if (durationMs <= 0) return { time: 1, done: true };
  if (!loop) {
    const time = elapsedMs / durationMs;
    return { time: Math.min(1, Math.max(0, time)), done: time >= 1 };
  }
  const cycle = elapsedMs / durationMs;
  const ping = Math.floor(cycle) % 2 === 0;
  const local = cycle - Math.floor(cycle);
  return { time: ping ? local : 1 - local, done: false };
};
