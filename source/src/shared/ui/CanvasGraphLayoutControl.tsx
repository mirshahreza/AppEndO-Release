import React from 'react';
import { Circle, Columns2, Rows2, Triangle } from 'lucide-react';
import {
  CANVAS_GRAPH_LAYOUT_OPTIONS,
  type CanvasGraphLayoutMode,
} from '../lib/canvasGraphLayout';
import { AppButton } from './AppButton';
import { cn } from '../../lib/utils';

const LAYOUT_ICONS: Record<CanvasGraphLayoutMode, React.ReactNode> = {
  horizontal: <Columns2 className="h-3.5 w-3.5" />,
  vertical: <Rows2 className="h-3.5 w-3.5" />,
  triangle: <Triangle className="h-3.5 w-3.5" />,
  radial: <Circle className="h-3.5 w-3.5" />,
};

export type CanvasGraphLayoutControlProps = {
  disabled?: boolean;
  activeMode?: CanvasGraphLayoutMode | null;
  onApplyLayout: (mode: CanvasGraphLayoutMode) => void;
  className?: string;
};

/** Icon-button layout cluster for pan/zoom canvases (workflows, schema relations, …). */
export const CanvasGraphLayoutControl: React.FC<CanvasGraphLayoutControlProps> = ({
  disabled = false,
  activeMode = null,
  onApplyLayout,
  className,
}) => (
  <div
    className={cn(
      'flex items-center gap-0.5 rounded-md border border-slate-200 bg-white/95 p-0.5 shadow-sm backdrop-blur-sm',
      className,
    )}
    onPointerDown={(event) => event.stopPropagation()}
  >
    {CANVAS_GRAPH_LAYOUT_OPTIONS.map((option) => {
      const active = activeMode === option.value;
      return (
        <AppButton
          key={option.value}
          type="button"
          intent={active ? 'secondary' : 'utility'}
          size="icon-sm"
          className={cn('!h-7 !min-h-7 !px-1.5', active && 'ring-1 ring-slate-300')}
          disabled={disabled}
          aria-label={option.label}
          aria-pressed={active}
          title={option.label}
          onClick={() => onApplyLayout(option.value)}
        >
          {LAYOUT_ICONS[option.value]}
        </AppButton>
      );
    })}
  </div>
);
