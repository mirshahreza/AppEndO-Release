import React from 'react';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  CANVAS_SEGMENTED_CONTROL_BUTTON_CLASS,
  CANVAS_VIEWPORT_CONTROLS_CLASS,
} from './surfaceClasses';

const ICON_CLASS = 'h-3 w-3';

export type CanvasViewportControlsProps = {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  canZoomIn?: boolean;
  canZoomOut?: boolean;
  disabled?: boolean;
  className?: string;
};

/**
 * Standard canvas viewport cluster: zoom in, zoom out, fit view.
 * Gold sample: workflow editor. Always bottom-left on every pan/zoom canvas.
 */
export const CanvasViewportControls: React.FC<CanvasViewportControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onFitView,
  canZoomIn = true,
  canZoomOut = true,
  disabled = false,
  className,
}) => (
  <div
    className={cn(CANVAS_VIEWPORT_CONTROLS_CLASS, className)}
    role="group"
    aria-label="Canvas viewport"
    onPointerDown={(event) => event.stopPropagation()}
  >
    <button
      type="button"
      className={CANVAS_SEGMENTED_CONTROL_BUTTON_CLASS}
      disabled={disabled || !canZoomIn}
      aria-label="Zoom in"
      title="Zoom in"
      onClick={onZoomIn}
    >
      <Plus className={ICON_CLASS} aria-hidden />
    </button>
    <button
      type="button"
      className={CANVAS_SEGMENTED_CONTROL_BUTTON_CLASS}
      disabled={disabled || !canZoomOut}
      aria-label="Zoom out"
      title="Zoom out"
      onClick={onZoomOut}
    >
      <Minus className={ICON_CLASS} aria-hidden />
    </button>
    <button
      type="button"
      className={CANVAS_SEGMENTED_CONTROL_BUTTON_CLASS}
      disabled={disabled}
      aria-label="Fit view"
      title="Fit view"
      onClick={onFitView}
    >
      <Maximize2 className={ICON_CLASS} aria-hidden />
    </button>
  </div>
);
