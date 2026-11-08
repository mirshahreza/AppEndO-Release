import * as React from 'react';
import { cn } from '../../../lib/utils';
import { safeAreaClass, type ShellDirection, type ShellElementProps, type ShellSafeArea } from './shellFoundation';
import {
  shellBoundedChromeBaseClass,
  SHELL_BOUNDED_EDGE_CLASS,
  type ShellBoundedEdge,
  type ShellBoundedMaxWidth,
  type ShellLayoutWidth,
} from './shellLayoutWidth';

export type ShellFrameProps = ShellElementProps<HTMLDivElement> & {
  direction?: ShellDirection;
  viewport?: 'screen' | 'dynamic' | 'content';
  safeArea?: ShellSafeArea;
  colorScheme?: 'light' | 'dark' | 'mixed';
  layoutWidth?: ShellLayoutWidth;
  boundedMaxWidth?: ShellBoundedMaxWidth;
  boundedEdge?: ShellBoundedEdge;
  effectUnderlay?: React.ReactNode;
  header?: React.ReactNode;
  sidebar?: React.ReactNode;
  hero?: React.ReactNode;
  aside?: React.ReactNode;
  footer?: React.ReactNode;
};

export const ShellFrame = React.forwardRef<HTMLDivElement, ShellFrameProps>(function ShellFrame({
  direction,
  viewport = 'dynamic',
  safeArea = 'all',
  colorScheme = 'light',
  layoutWidth = 'fluid',
  boundedMaxWidth = 'lg',
  boundedEdge = 'outset',
  effectUnderlay,
  header,
  sidebar,
  hero,
  aside,
  footer,
  children,
  className,
  ...props
}, ref) {
  const bounded = layoutWidth === 'bounded';
  const viewportMinClass =
    viewport === 'screen' ? 'min-h-screen' : viewport === 'dynamic' ? 'min-h-dvh' : '';
  const chrome = (
    <>
      {header}
      {hero}
      <div className="flex min-h-0 min-w-0 flex-1">
        {sidebar}
        <main className="min-h-0 min-w-0 flex-1" data-shell-main="">
          {children}
        </main>
        {aside}
      </div>
      {footer}
    </>
  );

  return (
    <div
      ref={ref}
      dir={direction}
      data-shell-frame=""
      data-shell-layout-width={layoutWidth}
      data-color-scheme={colorScheme}
      className={cn(
        'relative isolate flex min-w-0 flex-col text-foreground',
        bounded ? cn('w-full', viewportMinClass) : cn('bg-background w-full', viewportMinClass),
        safeAreaClass[safeArea],
        colorScheme === 'dark' && 'dark color-scheme-dark',
        colorScheme === 'light' && 'color-scheme-light',
        className,
      )}
      {...props}
    >
      {effectUnderlay ? (
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
          {effectUnderlay}
        </div>
      ) : null}
      {bounded ? (
        <div
          className={cn(
            'relative z-[1] flex min-h-0 w-full flex-1 flex-col',
            shellBoundedChromeBaseClass(boundedMaxWidth),
            SHELL_BOUNDED_EDGE_CLASS[boundedEdge],
          )}
          data-shell-bounded-chrome=""
          data-shell-bounded-max={boundedMaxWidth}
        >
          <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
            {chrome}
          </div>
        </div>
      ) : (
        chrome
      )}
    </div>
  );
});
