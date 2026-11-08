import React from 'react';
import { cn } from '../../lib/utils';
import {
  WORKSPACE_VERTICAL_SPLIT_HANDLE_RESIZING_CLASS,
} from './WorkspaceVerticalSplitHandle';

/** Flex slot — spans full width between stacked workspace panes. */
export const WORKSPACE_HORIZONTAL_SPLIT_HANDLE_WRAPPER_CLASS =
  'relative h-[8px] w-full shrink-0';

export const WORKSPACE_HORIZONTAL_SPLIT_HANDLE_TRACK_CLASS =
  'absolute inset-x-0 top-0 h-full z-20 cursor-row-resize bg-slate-200 transition-colors hover:bg-primary-600/35 active:bg-primary-600/45';

export type WorkspaceHorizontalSplitHandleProps = {
  isResizing?: boolean;
  onMouseDown?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onPointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
  /** Responsive visibility on the flex wrapper. Default: `hidden xl:block`. */
  displayClassName?: string;
  className?: string;
  title?: string;
};

export const WorkspaceHorizontalSplitHandle: React.FC<WorkspaceHorizontalSplitHandleProps> = ({
  isResizing = false,
  onMouseDown,
  onPointerDown,
  displayClassName = 'hidden xl:block',
  className,
  title = 'Drag to resize',
}) => (
  <div className={cn(WORKSPACE_HORIZONTAL_SPLIT_HANDLE_WRAPPER_CLASS, displayClassName)}>
    <div
      onMouseDown={onPointerDown ? undefined : onMouseDown}
      onPointerDown={onPointerDown}
      className={cn(
        WORKSPACE_HORIZONTAL_SPLIT_HANDLE_TRACK_CLASS,
        isResizing && WORKSPACE_VERTICAL_SPLIT_HANDLE_RESIZING_CLASS,
        className,
      )}
      title={title}
      role="separator"
      aria-orientation="horizontal"
    />
  </div>
);
