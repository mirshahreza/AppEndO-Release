import React from 'react';
import { cn } from '../../lib/utils';

export type CircuitTraceFieldProps = {
  className?: string;
};

/** Matches TechConstellation anchors: viewBox 1200×800, grid 120×100. */
const GRID_X = [0, 120, 240, 360, 480, 600, 720, 840, 960, 1080, 1200];
const GRID_Y = [0, 100, 200, 300, 400, 500, 600, 700, 800];
const NODE_POINTS: Array<[number, number]> = [
  [120, 100],
  [1080, 100],
  [240, 400],
  [1080, 400],
  [120, 600],
  [960, 700],
];

/**
 * Faint PCB-style grid + trace lines + solder-point nodes, tinted with the active accent theme.
 * Purely decorative (aria-hidden); reusable anywhere a "software world" backdrop accent
 * is wanted alongside AtmosphereBackdrop (auth today, admin/install surfaces later).
 */
export const CircuitTraceField: React.FC<CircuitTraceFieldProps> = ({ className }) => (
  <div
    className={cn('circuit-trace-field pointer-events-none absolute inset-0 overflow-hidden', className)}
    aria-hidden
  >
    <svg
      className="circuit-trace-field__svg"
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMid slice"
      focusable="false"
    >
      <g className="circuit-trace-field__orbits">
        <circle cx="720" cy="360" r="90" />
        <circle cx="720" cy="360" r="150" />
        <circle cx="720" cy="360" r="220" />
      </g>
      <g className="circuit-trace-field__grid">
        {GRID_X.map((x) => (
          <line key={`vx-${x}`} x1={x} y1={0} x2={x} y2={800} />
        ))}
        {GRID_Y.map((y) => (
          <line key={`hy-${y}`} x1={0} y1={y} x2={1200} y2={y} />
        ))}
      </g>

      <g className="circuit-trace-field__geometry">
        <rect x="480" y="200" width="240" height="200" rx="4" />
        <polygon points="960,200 1080,300 960,400 840,300" />
        <circle cx="600" cy="500" r="72" />
      </g>

      <g className="circuit-trace-field__group circuit-trace-field__group--a">
        <path d="M120 100 H1080" />
        <path d="M120 100 V600" />
        <path d="M240 400 H1080" />
        <path d="M120 600 H360 V700 H960" />
        {NODE_POINTS.map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="5" />
        ))}
      </g>
      <g className="circuit-trace-field__group circuit-trace-field__group--b">
        <path d="M1080 100 V400" />
        <path d="M960 200 V700" />
        <path d="M360 200 H720 V500" />
        <circle cx="360" cy="200" r="4" />
        <circle cx="720" cy="500" r="4" />
        <circle cx="960" cy="200" r="4" />
      </g>
    </svg>
  </div>
);
