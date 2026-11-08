import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

/** Flex slot — stretches with workspace row/column siblings. */
export const WORKSPACE_VERTICAL_SPLIT_HANDLE_WRAPPER_CLASS =
  'hidden xl:block relative w-[8px] shrink-0 self-stretch min-h-full';

export const WORKSPACE_VERTICAL_SPLIT_HANDLE_TRACK_CLASS =
  'absolute inset-y-0 left-0 w-full z-20 cursor-col-resize bg-slate-200 transition-colors hover:bg-primary-600/35 active:bg-primary-600/45';

export const WORKSPACE_VERTICAL_SPLIT_HANDLE_RESIZING_CLASS = 'bg-primary-600/50';

export type WorkspaceVerticalSplitHandleSide = 'start' | 'end';
export type WorkspaceVerticalSplitHandleAppearance = 'default' | 'quiet' | 'ghost';

export type WorkspaceVerticalSplitHandleProps = {
  /** Panel on the leading (left) or trailing (right) side of the handle. */
  side: WorkspaceVerticalSplitHandleSide;
  collapsed?: boolean;
  isResizing?: boolean;
  onMouseDown?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onPointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
  onToggle?: () => void;
  /** Responsive visibility on the flex wrapper. Default: `hidden xl:block`. */
  displayClassName?: string;
  className?: string;
  title?: string;
  /**
   * `quiet` keeps an 8px hit target but hides the rail and chevron until hover,
   * focus, or a collapsed panel that needs an expand control.
   * `ghost` is hit-target only (`cursor-col-resize`) — never paints a rail, grip, or chevron.
   */
  appearance?: WorkspaceVerticalSplitHandleAppearance;
};

function resolveCollapseDirection(
  side: WorkspaceVerticalSplitHandleSide,
  collapsed: boolean,
): 'left' | 'right' {
  if (side === 'start') {
    return collapsed ? 'right' : 'left';
  }
  return collapsed ? 'left' : 'right';
}

function resolveToggleLabel(side: WorkspaceVerticalSplitHandleSide, collapsed: boolean): string {
  const panel = side === 'start' ? 'left panel' : 'right panel';
  return collapsed ? `Expand ${panel}` : `Collapse ${panel}`;
}

function CollapseArrow({ direction }: { direction: 'left' | 'right' }) {
  const Icon = direction === 'left' ? ChevronLeft : ChevronRight;

  return (
    <Icon
      aria-hidden="true"
      className="pointer-events-none h-[17px] w-[17px] shrink-0 text-primary-700"
      strokeWidth={3}
    />
  );
}

export const WorkspaceVerticalSplitHandle: React.FC<WorkspaceVerticalSplitHandleProps> = ({
  side,
  collapsed = false,
  isResizing = false,
  onMouseDown,
  onPointerDown,
  onToggle,
  displayClassName = 'hidden xl:block',
  className,
  title = 'Drag to resize',
  appearance = 'default',
}) => {
  const toggleLabel = resolveToggleLabel(side, collapsed);
  const arrowDirection = resolveCollapseDirection(side, collapsed);
  const quiet = appearance === 'quiet';
  const ghost = appearance === 'ghost';
  const showQuietChrome = collapsed || isResizing;

  return (
    <div
      className={cn(
        WORKSPACE_VERTICAL_SPLIT_HANDLE_WRAPPER_CLASS,
        displayClassName,
        (quiet || ghost) && 'group/split !w-0',
      )}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={title}
        onMouseDown={onPointerDown ? undefined : onMouseDown}
        onPointerDown={onPointerDown}
        className={cn(
          WORKSPACE_VERTICAL_SPLIT_HANDLE_TRACK_CLASS,
          isResizing && !ghost && WORKSPACE_VERTICAL_SPLIT_HANDLE_RESIZING_CLASS,
          quiet && '-left-1 !w-2 !bg-transparent hover:!bg-primary-600/20 group-hover/split:!bg-primary-600/20',
          quiet && isResizing && '!bg-primary-600/35',
          ghost && '-left-1 !w-2 !bg-transparent hover:!bg-transparent active:!bg-transparent',
          className,
        )}
        title={title}
      >
        {ghost ? null : onToggle ? (
          <button
            type="button"
            aria-label={toggleLabel}
            title={toggleLabel}
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
            }}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onDoubleClick={(event) => {
              event.stopPropagation();
              onToggle();
            }}
            className={cn(
              'absolute top-1/2 left-1/2 z-30 flex h-8 w-full -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center overflow-visible bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500/40',
              quiet && !showQuietChrome && 'opacity-0 group-hover/split:opacity-100 focus-visible:opacity-100',
            )}
          >
            <CollapseArrow direction={arrowDirection} />
          </button>
        ) : (
          <span
            aria-hidden="true"
            className={cn(
              'absolute top-1/2 left-1/2 h-7 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-400/50',
              quiet && !showQuietChrome && 'opacity-0 group-hover/split:opacity-100',
            )}
          />
        )}
      </div>
    </div>
  );
};

/** Width at or below which a workspace column is treated as collapsed. */
export const WORKSPACE_SPLIT_COLLAPSED_WIDTH_PX = 60;
