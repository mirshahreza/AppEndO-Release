import * as React from 'react';
import { cn } from '../../../lib/utils';
import { safeAreaClass, type ShellElementProps } from './shellFoundation';

export type ShellFooterProps = ShellElementProps<HTMLElement> & {
  mode?: 'simple' | 'multi-column' | 'action-bar';
  behavior?: 'static' | 'sticky';
};

export const ShellFooter = React.forwardRef<HTMLElement, ShellFooterProps>(function ShellFooter({
  mode = 'simple',
  behavior = 'static',
  children,
  className,
  ...props
}, ref) {
  return (
    <footer
      ref={ref}
      data-shell-footer=""
      className={cn(
        'z-20 min-w-0 bg-content1 text-foreground',
        mode === 'simple' && 'flex items-center justify-between p-4',
        mode === 'multi-column' && 'grid grid-cols-1 gap-6 p-6 md:grid-cols-2 lg:grid-cols-4',
        mode === 'action-bar' && 'flex min-h-14 items-center justify-end gap-2 border-t border-divider px-4',
        behavior === 'sticky' && 'sticky bottom-0 shadow-[0_-2px_8px_hsl(var(--heroui-foreground)/0.08)]',
        safeAreaClass.all,
        className,
      )}
      {...props}
    >
      {children}
    </footer>
  );
});
