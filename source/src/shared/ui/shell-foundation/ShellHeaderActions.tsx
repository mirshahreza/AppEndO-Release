import * as React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { AppButton } from '../AppButton';
import { type ShellElementProps, type ShellRegionPlacement } from './shellFoundation';

export type ShellHeaderActionsProps = ShellElementProps<HTMLDivElement> & {
  mode?: 'none' | 'single-cta' | 'action-group' | 'workspace-actions';
  placement?: ShellRegionPlacement;
  overflow?: React.ReactNode;
  overflowOpen?: boolean;
  onOverflowOpenChange?: (open: boolean) => void;
  overflowLabel?: string;
};

export const ShellHeaderActions = React.forwardRef<HTMLDivElement, ShellHeaderActionsProps>(function ShellHeaderActions({
  mode = 'action-group',
  placement = 'end',
  overflow,
  overflowOpen = false,
  onOverflowOpenChange,
  overflowLabel = 'More actions',
  children,
  className,
  ...props
}, ref) {
  if (mode === 'none') return null;
  return (
    <div
      ref={ref}
      data-shell-header-actions=""
      className={cn(
        'relative flex min-w-0 items-center gap-1',
        placement === 'start' && 'justify-start',
        placement === 'center' && 'justify-center',
        placement === 'end' && 'justify-end',
        placement === 'space-between' && 'justify-between',
        mode === 'workspace-actions' && 'overflow-x-auto',
        className,
      )}
      {...props}
    >
      {children}
      {overflow ? (
        <>
          <AppButton
            aria-label={overflowLabel}
            aria-expanded={overflowOpen}
            aria-haspopup="dialog"
            onClick={() => onOverflowOpenChange?.(!overflowOpen)}
            className="inline-flex size-9 items-center justify-center rounded-medium hover:bg-content2 focus-visible:outline-2 focus-visible:outline-focus"
          >
            <MoreHorizontal aria-hidden className="h-3.5 w-3.5" />
          </AppButton>
          {overflowOpen ? (
            <div role="dialog" aria-label={overflowLabel} className="absolute end-0 top-full z-50 mt-1 min-w-48 rounded-medium border border-divider bg-content1 p-2 shadow-large">
              {overflow}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
});
