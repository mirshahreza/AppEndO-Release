import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import {
  ORBIT_BORDER_PRESETS,
  clampOrbitColorSteps,
  resolveOrbitPaletteStops,
  type OrbitBorderPreset,
} from './OrbitBorderFrame';

export type OrbitBgPreset = OrbitBorderPreset;
export type OrbitBgEffect = 'orbs' | 'aurora' | 'mesh' | 'beam' | 'ripple';
export type OrbitBgMotion = 'orbit' | 'edges' | 'drift';
export type OrbitBgShape = 'circle' | 'line' | 'scribble';
export type OrbitBgEdgeLane = 'rect' | 'x' | 'y';

export const ORBIT_BG_PRESETS = ORBIT_BORDER_PRESETS;
export const ORBIT_BG_EFFECTS: readonly OrbitBgEffect[] = ['orbs', 'aurora', 'mesh', 'beam', 'ripple'];
export const ORBIT_BG_MOTIONS: readonly OrbitBgMotion[] = ['orbit', 'edges', 'drift'];
export const ORBIT_BG_SHAPES: readonly OrbitBgShape[] = ['circle', 'line', 'scribble'];

export type OrbitBgFrameProps = {
  children: React.ReactNode;
  /** When false, renders children only — no orbit wash. */
  enabled?: boolean;
  preset?: OrbitBgPreset;
  /** Motion recipe filling the host. */
  effect?: OrbitBgEffect;
  /** Path the bodies travel: circular orbit, corners/edges, or irregular wind. */
  motion?: OrbitBgMotion;
  /** Silhouette of each body: disc, straight stroke, or irregular stroke. */
  shape?: OrbitBgShape;
  borderRadius?: string;
  /** Host fill behind the animation. Use `transparent` to sit over an existing surface. */
  hostBackground?: string;
  showGlow?: boolean;
  glowBlur?: number;
  glowOpacity?: number;
  /** Full cycle duration in seconds. */
  durationSeconds?: number;
  /** How far the bodies travel across the host (20–100). */
  coverage?: number;
  /** Body size as a percent of the host’s shorter side (8–100). */
  size?: number;
  /** Color stops sampled into bodies (4–10). */
  colorSteps?: number;
  /** When true, the palette ramp runs in reverse. */
  reverseColors?: boolean;
  /** How many moving bodies share the fill (1–10). */
  blobCount?: number;
  /** Soft palette wash under the moving bodies. */
  showWash?: boolean;
  direction?: 'forward' | 'reverse';
  reducedMotion?: boolean;
  className?: string;
  innerClassName?: string;
};

export const clampOrbitBlobCount = (value: number) => Math.min(10, Math.max(1, Math.round(value)));
export const clampOrbitCoverage = (value: number) => Math.min(100, Math.max(20, Math.round(value)));
export const clampOrbitBgSize = (value: number) => Math.min(100, Math.max(8, Math.round(value)));

type OrbitBody = {
  id: string;
  lane: OrbitBgEdgeLane;
  path: string;
  style: React.CSSProperties;
};

const SCRIBBLE_PATHS = [
  'M6 28 C32 6 58 50 86 18 C112 0 138 42 168 16 C190 2 210 36 230 22',
  'M8 16 C36 44 62 4 90 32 C118 54 146 8 176 28 C198 42 218 10 232 24',
  'M4 22 C40 8 48 48 84 24 C120 2 128 46 164 20 C192 6 208 40 228 18',
  'M10 30 C28 4 70 12 92 36 C114 52 150 6 172 22 C196 40 214 8 226 26',
  'M5 20 C44 48 56 4 98 26 C130 44 142 8 178 34 C200 48 216 6 234 20',
] as const;

const sampleStop = (stops: readonly string[], t: number): string => {
  if (stops.length === 0) return '#ffffff';
  if (stops.length === 1 || t <= 0) return stops[0];
  if (t >= 1) return stops[stops.length - 1];
  return stops[Math.min(stops.length - 1, Math.round(t * (stops.length - 1)))];
};

const washGradientFor = (stops: readonly string[]): string => {
  const a = sampleStop(stops, 0.12);
  const b = sampleStop(stops, 0.5);
  const c = sampleStop(stops, 0.88);
  return `linear-gradient(125deg, ${a} 0%, ${b} 48%, ${c} 100%)`;
};

const useOrbitBgSize = (hostRef: React.RefObject<HTMLDivElement | null>) => {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const update = () => {
      setSize({ width: host.clientWidth, height: host.clientHeight });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => observer.disconnect();
  }, [hostRef]);

  return size;
};

export const buildOrbitBgBodies = (
  effect: OrbitBgEffect,
  motion: OrbitBgMotion,
  shape: OrbitBgShape,
  colorSteps: number,
  coverage: number,
  size: number,
  blobCount: number,
  durationSeconds: number,
  glowBlur: number,
  stops: readonly string[],
  hostWidth: number,
  hostHeight: number,
): OrbitBody[] => {
  const count = clampOrbitBlobCount(blobCount);
  const span = clampOrbitCoverage(coverage);
  const sizePercent = clampOrbitBgSize(size);
  const steps = clampOrbitColorSteps(colorSteps);
  const palette = Array.from({ length: steps }, (_, index) => sampleStop(stops, steps === 1 ? 1 : index / (steps - 1)));
  const width = Math.max(hostWidth, 1);
  const height = Math.max(hostHeight, 1);
  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);

  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    const color = palette[index % palette.length];
    const lane: OrbitBgEdgeLane = index % 3 === 1 ? 'x' : index % 3 === 2 ? 'y' : 'rect';
    const isStroke = shape === 'line' || shape === 'scribble';
    const sizePx = Math.max(8, Math.round(shortSide * (sizePercent / 100)));
    const bodyWidth = isStroke
      ? Math.max(24, Math.round(longSide * (sizePercent / 100)))
      : sizePx;
    const bodyHeight = isStroke
      ? Math.max(6, Math.round(bodyWidth * (shape === 'scribble' ? 0.28 : 0.12)))
      : effect === 'aurora'
        ? Math.max(8, Math.round(sizePx * 0.42))
        : sizePx;
    const radiusScale = motion === 'edges' ? 0.36 : motion === 'drift' ? 0.28 : 0.2;
    const radiusX = Math.round(width * (radiusScale + span * 0.0014 + (index % 3) * 0.025));
    const radiusY = Math.round(height * (radiusScale * 0.85 + span * 0.0012 + (index % 4) * 0.02));
    const originX = motion === 'orbit'
      ? 50
      : motion === 'edges' && lane === 'y'
        ? (index % 2 === 0 ? 10 : 90)
        : motion === 'drift'
          ? 50 + Math.cos(angle) * 14
          : 50;
    const originY = motion === 'orbit'
      ? 50
      : motion === 'edges' && lane === 'x'
        ? (index % 2 === 0 ? 12 : 88)
        : motion === 'drift'
          ? 50 + Math.sin(angle) * 12
          : 50;
    const delay = `${((-index) / Math.max(count, 1)) * durationSeconds}s`;
    const duration = `${durationSeconds * (motion === 'drift' ? 0.78 + (index % 5) * 0.14 : 0.88 + (index % 4) * 0.08)}s`;
    const blur = Math.max(0, isStroke
      ? glowBlur * 0.35
      : glowBlur + (effect === 'aurora' || motion === 'drift' ? 10 : effect === 'ripple' ? -8 : 0));
    const tilt = isStroke ? (index % 5) * 18 - 36 : 0;

    return {
      id: `${effect}-${motion}-${shape}-${index}`,
      lane,
      path: SCRIBBLE_PATHS[index % SCRIBBLE_PATHS.length],
      style: {
        '--orb-color': color,
        '--orb-x': `${originX}%`,
        '--orb-y': `${originY}%`,
        '--orb-size': `${bodyWidth}px`,
        '--orb-height': `${bodyHeight}px`,
        '--orb-rx': `${radiusX}px`,
        '--orb-ry': `${radiusY}px`,
        '--orb-tilt': `${tilt}deg`,
        '--orb-stroke': `${Math.max(2, Math.round(bodyHeight * 0.38))}px`,
        '--orb-delay': delay,
        '--orb-duration': duration,
        '--orb-blur': `${blur}px`,
        animationDelay: delay,
        animationDuration: duration,
      } as React.CSSProperties,
    };
  });
};

export const OrbitBgFrame: React.FC<OrbitBgFrameProps> = ({
  children,
  enabled = true,
  preset = 'rainbow',
  effect = 'orbs',
  motion = 'orbit',
  shape = 'circle',
  borderRadius = 'var(--app-radius-xl)',
  hostBackground = 'transparent',
  showGlow = true,
  glowBlur = 16,
  glowOpacity = 0.7,
  durationSeconds = 12,
  coverage = 58,
  size = 40,
  colorSteps = 6,
  reverseColors = true,
  blobCount = 3,
  showWash = true,
  direction = 'forward',
  reducedMotion = false,
  className,
  innerClassName,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const { width, height } = useOrbitBgSize(hostRef);
  const palette = ORBIT_BG_PRESETS[preset];
  const span = clampOrbitCoverage(coverage);
  const sizePercent = clampOrbitBgSize(size);
  const count = clampOrbitBlobCount(blobCount);
  const stops = useMemo(
    () => resolveOrbitPaletteStops(palette.stops, reverseColors),
    [palette.stops, reverseColors],
  );
  const bodies = useMemo(
    () => buildOrbitBgBodies(effect, motion, shape, colorSteps, span, sizePercent, count, durationSeconds, glowBlur, stops, width, height),
    [colorSteps, count, durationSeconds, effect, glowBlur, height, motion, shape, sizePercent, span, stops, width],
  );

  const hostStyle = useMemo(() => ({
    '--orbit-bg-radius': borderRadius,
    '--orbit-bg-host-bg': hostBackground,
    '--orbit-bg-duration': `${durationSeconds}s`,
    '--orbit-bg-glow-blur': `${glowBlur}px`,
    '--orbit-bg-glow-opacity': String(glowOpacity),
    '--orbit-bg-coverage': String(span),
    '--orbit-bg-orb-opacity': String(0.42 + glowOpacity * 0.5),
    '--orbit-bg-wash': washGradientFor(stops),
    '--orbit-bg-wash-opacity': showWash ? String(0.16 + glowOpacity * 0.18) : '0',
    '--orbit-bg-beam-color': palette.glow,
    '--orbit-color-glow': palette.glow,
    '--orbit-bg-shift-x': `${Math.max(24, Math.round(width * 0.12))}px`,
    '--orbit-bg-shift-y': `${Math.max(16, Math.round(height * 0.1))}px`,
  }) as React.CSSProperties, [
    borderRadius,
    durationSeconds,
    glowBlur,
    glowOpacity,
    height,
    hostBackground,
    palette.glow,
    showWash,
    stops,
    span,
    width,
  ]);

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <div
      ref={hostRef}
      className={cn('orbit-bg-host', className)}
      style={hostStyle}
      data-orbit-bg-preset={preset}
      data-orbit-bg-effect={effect}
      data-orbit-bg-motion={motion}
      data-orbit-bg-shape={shape}
      data-orbit-direction={direction}
      data-orbit-motion={reducedMotion ? 'reduced' : 'normal'}
      data-orbit-glow={showGlow ? 'on' : 'off'}
    >
      <div className="orbit-bg-layer" aria-hidden="true">
        <div className="orbit-bg-wash">
          <div className="orbit-bg-wash-fill" />
        </div>
        {effect === 'beam' ? (
          <div className="orbit-bg-beam">
            <div className="orbit-bg-beam-fill" />
          </div>
        ) : null}
        {bodies.map((body) => (
          <div
            key={body.id}
            className={cn('orbit-bg-body', `orbit-bg-body--${effect}`)}
            data-orbit-bg-lane={body.lane}
            style={body.style}
          >
            <div className="orbit-bg-body-fill">
              {shape === 'scribble' ? (
                <svg className="orbit-bg-scribble" viewBox="0 0 240 56" aria-hidden="true">
                  <path d={body.path} />
                </svg>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <div className={cn('orbit-bg-inner', innerClassName)}>
        {children}
      </div>
    </div>
  );
};
