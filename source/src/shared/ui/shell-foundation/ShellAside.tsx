import * as React from 'react';
import { cn } from '../../../lib/utils';
import { AppButton } from '../AppButton';
import { type ShellElementProps, type ShellLogicalSide } from './shellFoundation';

export type ShellAsideProps = ShellElementProps<HTMLElement> & {
  side?: ShellLogicalSide;
  behavior?: 'static' | 'sticky' | 'collapsible';
  width?: 'sm' | 'md' | 'lg';
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  collapseLabel?: string;
  expandLabel?: string;
};

const widths = { sm: 'w-56', md: 'w-72', lg: 'w-96' };

export const ShellAside = React.forwardRef<HTMLElement, ShellAsideProps>(function ShellAside({
  side = 'end',
  behavior = 'static',
  width = 'md',
  collapsed = false,
  onCollapsedChange,
  collapseLabel = 'Collapse aside',
  expandLabel = 'Expand aside',
  children,
  className,
  ...props
}, ref) {
  return (
    <aside
      ref={ref}
      data-shell-aside=""
      data-side={side}
      data-collapsed={collapsed || undefined}
      className={cn(
        'min-h-0 shrink-0 bg-content1 text-foreground',
        side === 'start' && 'order-first',
        collapsed ? 'w-12' : widths[width],
        behavior === 'sticky' && 'sticky top-0 max-h-dvh overflow-y-auto',
        behavior === 'collapsible' && 'transition-[width] motion-reduce:transition-none',
        className,
      )}
      {...props}
    >
      {behavior === 'collapsible' && (
        <AppButton
          className="m-1 inline-flex min-h-10 min-w-10 items-center justify-center rounded-medium text-foreground hover:bg-content2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          aria-expanded={!collapsed}
          aria-label={collapsed ? expandLabel : collapseLabel}
          onClick={() => onCollapsedChange?.(!collapsed)}
        >
          <span aria-hidden>{collapsed ? '›' : '‹'}</span>
        </AppButton>
      )}
      {!collapsed && children}
    </aside>
  );
});
