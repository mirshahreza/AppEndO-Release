import * as React from 'react';
import { cn } from '../../../../lib/utils';
import type { LiveDesignerDropIndicator } from './liveDesignerDropResolve';

export type LiveDesignerDropMarkerProps = {
  indicator: LiveDesignerDropIndicator;
  /** Use `fixed` when the host scrolls independently of the marker layer. */
  position?: 'absolute' | 'fixed';
};

export const LiveDesignerDropMarker: React.FC<LiveDesignerDropMarkerProps> = ({
  indicator,
  position = 'absolute',
}) => {
  const boxStyle: React.CSSProperties = {
    position,
    top: indicator.top,
    left: indicator.left,
    width: indicator.width,
    height: indicator.height,
  };

  if (indicator.kind === 'invalid') {
    return (
      <div
        aria-hidden
        className="pointer-events-none z-20 border-2 border-dashed border-rose-400 bg-rose-400/10"
        style={boxStyle}
        data-testid="live-designer-drop-indicator"
        data-drop-kind="invalid"
      />
    );
  }

  if (indicator.kind === 'container') {
    return (
      <div
        aria-hidden
        className="pointer-events-none z-20 border-2 border-dashed border-cyan-500 bg-cyan-400/15"
        style={boxStyle}
        data-testid="live-designer-drop-indicator"
        data-drop-kind="container"
      >
        <span
          className={cn(
            'absolute left-1/2 top-1.5 -translate-x-1/2 rounded-full px-2 py-0.5',
            'bg-cyan-500 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm',
          )}
        >
          Drop inside
        </span>
      </div>
    );
  }

  return (
    <div
      aria-hidden
      className="pointer-events-none z-20"
      style={boxStyle}
      data-testid="live-designer-drop-indicator"
      data-drop-kind="line"
    >
      <span className="absolute inset-0 rounded-full bg-cyan-500 shadow-[0_0_0_1px_rgba(255,255,255,0.85)]" />
      <span
        className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-cyan-500 shadow-sm"
        style={{ left: 0 }}
      />
      <span
        className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-cyan-500 shadow-sm"
        style={{ left: '100%' }}
      />
    </div>
  );
};

export type LiveDesignerDragGhostProps = {
  label: string;
  x: number;
  y: number;
  position?: 'absolute' | 'fixed';
};

export const LiveDesignerDragGhost: React.FC<LiveDesignerDragGhostProps> = ({
  label,
  x,
  y,
  position = 'absolute',
}) => (
  <div
    aria-hidden
    className={cn(
      'pointer-events-none z-30 max-w-[220px] truncate rounded-md border-2 border-cyan-500 bg-white px-2 py-1',
      'text-[11px] font-semibold text-slate-800 shadow-md',
    )}
    style={{ position, top: y + 14, left: x + 14 }}
    data-testid="live-designer-drag-ghost"
  >
    {label}
  </div>
);
