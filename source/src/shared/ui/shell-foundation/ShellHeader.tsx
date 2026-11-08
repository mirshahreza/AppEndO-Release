import * as React from 'react';
import { cn } from '../../../lib/utils';
import { safeAreaClass, type ShellElementProps, type ShellSafeArea } from './shellFoundation';

export type ShellHeaderProps = ShellElementProps<HTMLElement> & {
  behavior?: 'static' | 'sticky' | 'sticky-shrink' | 'floating';
  height?: 'compact' | 'default' | 'tall';
  shrunk?: boolean;
  safeArea?: ShellSafeArea;
};

const heights = { compact: 'min-h-12', default: 'min-h-16', tall: 'min-h-20' };

export const ShellHeader = React.forwardRef<HTMLElement, ShellHeaderProps>(function ShellHeader({
  behavior = 'static',
  height = 'default',
  shrunk = false,
  safeArea = 'block-start',
  children,
  className,
  ...props
}, ref) {
  const isSticky = behavior === 'sticky' || behavior === 'sticky-shrink';
  return (
    <header
      ref={ref}
      data-shell-header=""
      data-shrunk={shrunk || undefined}
      className={cn(
        'z-30 flex min-w-0 items-center bg-background text-foreground',
        isSticky && 'sticky top-0',
        behavior === 'floating' && 'sticky top-3 mx-3 rounded-large border border-divider bg-content1 shadow-medium',
        heights[shrunk && behavior === 'sticky-shrink' ? 'compact' : height],
        behavior === 'sticky-shrink' && 'transition-[min-height] motion-reduce:transition-none',
        safeAreaClass[safeArea],
        className,
      )}
      {...props}
    >
      {children}
    </header>
  );
});
