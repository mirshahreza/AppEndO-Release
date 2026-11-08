import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/utils';

export type OrbitBorderPreset = 'rainbow' | 'accent' | 'sunset' | 'fire' | 'ember' | 'ocean' | 'mono';

export type OrbitBorderPalette = {
  /** Color ramp from tail → head. Sampled into `colorSteps` comet layers. */
  stops: readonly string[];
  head: string;
  core: string;
  mid: string;
  tail: string;
  glow: string;
  track: string;
};

const ACCENT = 'rgb(var(--app-accent-rgb, 0 162 138))';
const ACCENT_HEX = '#00a28a';

const paletteOf = (
  stops: readonly string[],
  glow: string,
  track: string,
): OrbitBorderPalette => ({
  stops,
  tail: stops[0] ?? glow,
  mid: stops[Math.floor((stops.length - 1) * 0.4)] ?? glow,
  core: stops[Math.floor((stops.length - 1) * 0.7)] ?? glow,
  head: stops[stops.length - 1] ?? '#ffffff',
  glow,
  track,
});

export const ORBIT_BORDER_PRESETS: Record<OrbitBorderPreset, OrbitBorderPalette> = {
  rainbow: paletteOf(
    ['#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#6366f1', '#a855f7', '#ffffff'],
    '#a78bfa',
    'rgb(148 163 184 / 0.35)',
  ),
  accent: paletteOf(
    [ACCENT_HEX, '#2dd4bf', '#ffffff'],
    ACCENT,
    'rgb(var(--app-accent-rgb, 0 162 138) / 0.22)',
  ),
  sunset: paletteOf(
    ['#7c3aed', '#c084fc', '#f472b6', '#fb923c', '#fff7ed'],
    '#fb7185',
    'rgb(251 146 60 / 0.28)',
  ),
  fire: paletteOf(
    ['#450a0a', '#b91c1c', '#ea580c', '#fbbf24', '#fff7ed'],
    '#f97316',
    'rgb(234 88 12 / 0.42)',
  ),
  /** Light orange / amber comet — Hawiety public Next CTA and similar warm accents. */
  ember: paletteOf(
    ['#fff7ed', '#ffedd5', '#fed7aa', '#fdba74', '#fb923c', '#f97316'],
    '#fb923c',
    'rgb(253 186 116 / 0.3)',
  ),
  ocean: paletteOf(
    ['#312e81', '#6366f1', '#38bdf8', '#22d3ee', '#ecfeff'],
    '#22d3ee',
    'rgb(6 182 212 / 0.28)',
  ),
  mono: paletteOf(
    ['#334155', '#64748b', '#94a3b8', '#f8fafc'],
    'rgb(148 163 184)',
    'rgb(148 163 184 / 0.32)',
  ),
};

/** @deprecated Use ORBIT_BORDER_PRESETS — kept so existing imports keep compiling. */
export const ORBIT_BORDER_PRESET_GRADIENTS = ORBIT_BORDER_PRESETS;

export type OrbitBorderFrameProps = {
  children: React.ReactNode;
  /** When false, renders children only — no orbit wrapper. */
  enabled?: boolean;
  /** Comet stroke thickness in px. */
  borderWidth?: number;
  borderRadius?: string;
  /** Host fill behind the inner content. Use `transparent` for a hollow frame. */
  hostBackground?: string;
  showGlow?: boolean;
  glowBlur?: number;
  glowOpacity?: number;
  /** Full orbit duration in seconds. */
  durationSeconds?: number;
  preset?: OrbitBorderPreset;
  /** Tail length as a percentage of the perimeter (5–100). */
  tailLength?: number;
  /** Color stops along the comet (4–10). */
  colorSteps?: number;
  /** When true, the palette ramp runs head ← tail (flipped from the preset order). */
  reverseColors?: boolean;
  /** How many comets share the path (1–10). */
  cometCount?: number;
  /** Faint static path the comet travels. */
  showTrack?: boolean;
  direction?: 'forward' | 'reverse';
  reducedMotion?: boolean;
  className?: string;
  innerClassName?: string;
};

export const clampOrbitColorSteps = (value: number) => Math.min(10, Math.max(4, Math.round(value)));
export const clampOrbitCometCount = (value: number) => Math.min(10, Math.max(1, Math.round(value)));

const clampTail = (value: number) => Math.min(100, Math.max(5, value));

const parseHex = (value: string): [number, number, number] | null => {
  const match = /^#([0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return null;
  const n = Number.parseInt(match[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const mixHex = (from: string, to: string, t: number): string => {
  const a = parseHex(from);
  const b = parseHex(to);
  if (!a || !b) return t < 0.5 ? from : to;
  const lerp = (x: number, y: number) => Math.round(x + (y - x) * t);
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(lerp(a[0], b[0]))}${toHex(lerp(a[1], b[1]))}${toHex(lerp(a[2], b[2]))}`;
};

const sampleRamp = (stops: readonly string[], t: number): string => {
  if (stops.length === 0) return '#ffffff';
  if (stops.length === 1 || t <= 0) return stops[0];
  if (t >= 1) return stops[stops.length - 1];
  const scaled = t * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(scaled));
  return mixHex(stops[index], stops[index + 1], scaled - index);
};

type CometStep = {
  color: string;
  dash: number;
  gap: number;
  opacity: number;
  width: number;
};

export const resolveOrbitPaletteStops = (
  stops: readonly string[],
  reverseColors: boolean,
): readonly string[] => (reverseColors ? [...stops].reverse() : stops);

export const buildOrbitCometSteps = (
  colorSteps: number,
  tailLength: number,
  borderWidth: number,
  stops: readonly string[],
): CometStep[] => {
  const count = clampOrbitColorSteps(colorSteps);
  const tail = clampTail(tailLength);
  return Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 1 : index / (count - 1);
    const dash = Math.max(0.8, tail * (1 - t * 0.88));
    return {
      color: sampleRamp(stops, t),
      dash,
      gap: Math.max(0, 100 - dash),
      /* Head opaque; tail layers thin + faint (comet tapers along the trail). */
      opacity: 0.14 + t * 0.58,
      width: borderWidth * (0.22 + t * 1.05),
    };
  });
};

const roundedRectPath = (width: number, height: number, radius: number, inset: number): string => {
  const x = inset;
  const y = inset;
  const w = Math.max(0, width - inset * 2);
  const h = Math.max(0, height - inset * 2);
  if (w < 1 || h < 1) return '';
  const r = Math.min(Math.max(0, radius - inset * 0.15), w / 2, h / 2);
  if (r <= 0.5) {
    return `M${x} ${y} H${x + w} V${y + h} H${x} Z`;
  }
  return [
    `M${x + r} ${y}`,
    `H${x + w - r}`,
    `A${r} ${r} 0 0 1 ${x + w} ${y + r}`,
    `V${y + h - r}`,
    `A${r} ${r} 0 0 1 ${x + w - r} ${y + h}`,
    `H${x + r}`,
    `A${r} ${r} 0 0 1 ${x} ${y + h - r}`,
    `V${y + r}`,
    `A${r} ${r} 0 0 1 ${x + r} ${y}`,
    'Z',
  ].join(' ');
};

const useOrbitPath = (
  hostRef: React.RefObject<HTMLDivElement | null>,
  borderWidth: number,
  borderRadius: string,
) => {
  const [orbit, setOrbit] = useState({ d: '', width: 0, height: 0 });

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const update = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      const radius = Number.parseFloat(getComputedStyle(host).borderTopLeftRadius) || 0;
      const inset = borderWidth * 0.5 + 1;
      setOrbit({
        d: roundedRectPath(width, height, radius, inset),
        width,
        height,
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => observer.disconnect();
  }, [borderRadius, borderWidth, hostRef]);

  return orbit;
};

type OrbitPathLayerProps = {
  d: string;
  className: string;
  style?: React.CSSProperties;
};

const OrbitPathLayer: React.FC<OrbitPathLayerProps> = ({ d, className, style }) => (
  <path d={d} className={className} pathLength={100} fill="none" style={style} />
);

export const OrbitBorderFrame: React.FC<OrbitBorderFrameProps> = ({
  children,
  enabled = true,
  borderWidth = 1.5,
  borderRadius = 'var(--app-radius-xl)',
  hostBackground = 'transparent',
  showGlow = true,
  glowBlur = 8,
  glowOpacity = 0.55,
  durationSeconds = 12,
  preset = 'rainbow',
  tailLength = 5,
  colorSteps = 6,
  reverseColors = true,
  cometCount = 1,
  showTrack = true,
  direction = 'forward',
  reducedMotion = false,
  className,
  innerClassName,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const { d: path, width: viewWidth, height: viewHeight } = useOrbitPath(hostRef, borderWidth, borderRadius);
  const palette = ORBIT_BORDER_PRESETS[preset];
  const tail = clampTail(tailLength);
  const count = clampOrbitCometCount(cometCount);
  const stops = useMemo(
    () => resolveOrbitPaletteStops(palette.stops, reverseColors),
    [palette.stops, reverseColors],
  );
  const steps = useMemo(
    () => buildOrbitCometSteps(colorSteps, tail, borderWidth, stops),
    [borderWidth, colorSteps, stops, tail],
  );

  const hostStyle = useMemo(() => ({
    '--orbit-border-width': `${borderWidth}px`,
    '--orbit-border-radius': borderRadius,
    '--orbit-border-host-bg': hostBackground,
    '--orbit-border-duration': `${durationSeconds}s`,
    '--orbit-border-glow-blur': `${glowBlur}px`,
    '--orbit-border-glow-opacity': String(glowOpacity),
    '--orbit-dash-tail': String(tail),
    '--orbit-gap-tail': String(Math.max(0, 100 - tail)),
    '--orbit-color-glow': palette.glow,
    '--orbit-color-track': palette.track,
  }) as React.CSSProperties, [
    borderRadius,
    borderWidth,
    durationSeconds,
    glowBlur,
    glowOpacity,
    hostBackground,
    palette.glow,
    palette.track,
    tail,
  ]);

  if (!enabled) {
    return <>{children}</>;
  }

  const renderComet = (slot: number) => {
    const delay = count <= 1 ? undefined : `${((-slot) / count) * durationSeconds}s`;
    const delayStyle = delay ? { animationDelay: delay } : undefined;
    const motionClass = 'orbit-border-comet';
    return (
      <React.Fragment key={slot}>
        {showGlow ? (
          <OrbitPathLayer
            d={path}
            className={cn(motionClass, 'orbit-border-layer-glow')}
            style={delayStyle}
          />
        ) : null}
        {steps.map((step, index) => (
          <OrbitPathLayer
            key={`${slot}-${index}`}
            d={path}
            className={motionClass}
            style={{
              stroke: step.color,
              strokeWidth: step.width,
              strokeDasharray: `${step.dash} ${step.gap}`,
              opacity: step.opacity,
              ...delayStyle,
            }}
          />
        ))}
      </React.Fragment>
    );
  };

  return (
    <div
      ref={hostRef}
      className={cn('orbit-border-host', className)}
      style={hostStyle}
      data-orbit-preset={preset}
      data-orbit-direction={direction}
      data-orbit-reverse-colors={reverseColors ? 'true' : 'false'}
      data-orbit-motion={reducedMotion ? 'reduced' : 'normal'}
    >
      <svg
        className="orbit-border-svg"
        aria-hidden="true"
        viewBox={viewWidth > 0 && viewHeight > 0 ? `0 0 ${viewWidth} ${viewHeight}` : undefined}
      >
        {path ? (
          <>
            {showTrack ? (
              <OrbitPathLayer d={path} className="orbit-border-layer-track" />
            ) : null}
            <g className="orbit-border-comets">
              {Array.from({ length: count }, (_, slot) => renderComet(slot))}
            </g>
          </>
        ) : null}
      </svg>
      <div className={cn('orbit-border-inner', innerClassName)}>
        {children}
      </div>
    </div>
  );
};
