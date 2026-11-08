import * as React from 'react';
import { cn } from '../../../lib/utils';
import { safeAreaClass, type ShellElementProps, type ShellLogicalSide, type ShellSafeArea } from './shellFoundation';

export type ShellSidebarProps = ShellElementProps<HTMLElement> & {
  side?: ShellLogicalSide;
  layout?: 'fixed' | 'rail' | 'overlay' | 'floating';
  width?: 'compact' | 'comfortable' | 'spacious';
  safeArea?: ShellSafeArea;
  labelledBy?: string;
};

const widths = { compact: 'w-16', comfortable: 'w-64', spacious: 'w-80' };

export const ShellSidebar = React.forwardRef<HTMLElement, ShellSidebarProps>(function ShellSidebar({
  side = 'start',
  layout = 'fixed',
  width = 'comfortable',
  safeArea = 'inline',
  labelledBy,
  children,
  className,
  ...props
}, ref) {
  return (
    <nav
      ref={ref}
      aria-labelledby={labelledBy}
      data-shell-sidebar=""
      data-side={side}
      className={cn(
        'z-20 min-h-0 shrink-0 bg-content1 text-foreground',
        side === 'end' && 'order-last',
        layout === 'rail' ? 'w-16' : widths[width],
        layout === 'fixed' && 'sticky top-0 h-dvh overflow-y-auto',
        layout === 'overlay' && 'fixed inset-y-0 start-0 shadow-large data-[side=end]:start-auto data-[side=end]:end-0',
        layout === 'floating' && 'm-3 max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-large border border-divider shadow-medium',
        safeAreaClass[safeArea],
        className,
      )}
      {...props}
    >
      {children}
    </nav>
  );
});
