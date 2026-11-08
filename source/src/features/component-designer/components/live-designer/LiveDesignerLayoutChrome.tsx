import * as React from 'react';
import { Plus } from 'lucide-react';
import type { LayoutStructureHint, LayoutTrackAxis } from '../../../../domain/component-designer/layoutStructure';
import { cn } from '../../../../lib/utils';
import type { LiveDesignerOutlineRect } from './liveDesignerHitTest';

export type LiveDesignerLayoutChromeProps = {
  rect: LiveDesignerOutlineRect;
  hint: LayoutStructureHint;
  onAddTrack: (axis: LayoutTrackAxis, place: 'before' | 'after') => void;
};

const CHIP_CLASS =
  'pointer-events-auto inline-flex h-5 w-5 items-center justify-center rounded-full border border-white bg-cyan-500 text-white shadow-sm hover:bg-cyan-600';

export const LiveDesignerLayoutChrome: React.FC<LiveDesignerLayoutChromeProps> = ({
  rect,
  hint,
  onAddTrack,
}) => {
  const stop = (event: React.SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const add = (axis: LayoutTrackAxis, place: 'before' | 'after') =>
    (event: React.MouseEvent | React.PointerEvent) => {
      stop(event);
      onAddTrack(axis, place);
    };

  return (
    <div
      className="pointer-events-none absolute z-30"
      style={{
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      }}
      data-testid="live-designer-layout-chrome"
      data-layout-kind={hint.kind}
    >
      {hint.canAddRow ? (
        <>
          <button
            type="button"
            className={cn(CHIP_CLASS, 'absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2')}
            aria-label={`${hint.addRowLabel} above`}
            onPointerDown={stop}
            onClick={add('row', 'before')}
          >
            <Plus className="h-3 w-3" strokeWidth={2.5} />
          </button>
          <button
            type="button"
            className={cn(CHIP_CLASS, 'absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2')}
            aria-label={`${hint.addRowLabel} below`}
            onPointerDown={stop}
            onClick={add('row', 'after')}
          >
            <Plus className="h-3 w-3" strokeWidth={2.5} />
          </button>
        </>
      ) : null}
      {hint.canAddColumn ? (
        <>
          <button
            type="button"
            className={cn(CHIP_CLASS, 'absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2')}
            aria-label={`${hint.addColumnLabel} before`}
            onPointerDown={stop}
            onClick={add('column', 'before')}
          >
            <Plus className="h-3 w-3" strokeWidth={2.5} />
          </button>
          <button
            type="button"
            className={cn(CHIP_CLASS, 'absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2')}
            aria-label={`${hint.addColumnLabel} after`}
            onPointerDown={stop}
            onClick={add('column', 'after')}
          >
            <Plus className="h-3 w-3" strokeWidth={2.5} />
          </button>
        </>
      ) : null}
    </div>
  );
};
