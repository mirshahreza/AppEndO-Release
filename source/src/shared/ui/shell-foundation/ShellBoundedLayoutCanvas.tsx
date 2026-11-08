import * as React from 'react';
import { cn } from '../../../lib/utils';
import {
  shellBoundedChromeBaseClass,
  SHELL_BOUNDED_EDGE_CLASS,
  type ShellBoundedEdge,
  type ShellBoundedMaxWidth,
  type ShellLayoutWidth,
} from './shellLayoutWidth';

export type ShellBoundedLayoutCanvasProps = {
  layoutWidth: ShellLayoutWidth;
  boundedMaxWidth?: ShellBoundedMaxWidth;
  boundedEdge?: ShellBoundedEdge;
  backdropStyle?: React.CSSProperties;
  className?: string;
  children: React.ReactNode;
};

/**
 * Bounded vs fluid chrome. Keeps a stable wrapper tree so toggling width during
 * Appearance live preview does not remount the admin shell subtree.
 */
export const ShellBoundedLayoutCanvas: React.FC<ShellBoundedLayoutCanvasProps> = ({
  layoutWidth,
  boundedMaxWidth = 'lg',
  boundedEdge = 'outset',
  backdropStyle,
  className,
  children,
}) => {
  const isBounded = layoutWidth === 'bounded';

  return (
    <div
      data-shell-layout-canvas=""
      data-shell-layout-width={isBounded ? 'bounded' : 'fluid'}
      className={cn(
        'relative flex min-h-full w-full min-w-0 flex-col',
        isBounded && 'shell-atmosphere',
        className,
      )}
      style={isBounded ? backdropStyle : undefined}
    >
      <div
        data-shell-bounded-chrome=""
        className={cn(
          isBounded
            ? cn(
              shellBoundedChromeBaseClass(boundedMaxWidth),
              SHELL_BOUNDED_EDGE_CLASS[boundedEdge],
              'max-lg:shadow-none',
            )
            : 'flex min-h-full w-full min-w-0 flex-1 flex-col',
        )}
        data-shell-bounded-max={isBounded ? boundedMaxWidth : undefined}
      >
        {children}
      </div>
    </div>
  );
};
