import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { AppButton } from '../AppButton';
import { getFocusableElements, safeAreaClass, type ShellLogicalSide } from './shellFoundation';
import { overlayMotionBackdropProps, overlayMotionDocumentDir, overlayMotionPanelProps } from '../overlay-motion/overlayMotion';

export type ShellResponsiveDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  side?: ShellLogicalSide;
  title?: React.ReactNode;
  /** Secondary line under the title (patch context, path, etc.). */
  subtitle?: React.ReactNode;
  ariaLabel?: string;
  closeLabel?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  className?: string;
  headerClassName?: string;
  /** Defaults to scrollable body; use `overflow-hidden flex flex-col` when children manage their own scroll regions. */
  bodyClassName?: string;
  portal?: boolean;
};

export const ShellResponsiveDrawer: React.FC<ShellResponsiveDrawerProps> = ({
  open,
  onOpenChange,
  children,
  side = 'start',
  title,
  subtitle,
  ariaLabel = 'Navigation drawer',
  closeLabel = 'Close drawer',
  closeOnBackdrop = true,
  closeOnEscape = true,
  className,
  headerClassName,
  bodyClassName,
  portal = true,
}) => {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const returnFocusRef = React.useRef<HTMLElement | null>(null);
  const titleId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const frame = window.requestAnimationFrame(() => {
      const focusable = getFocusableElements(panelRef.current);
      (focusable[0] ?? panelRef.current)?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeOnEscape) {
        event.preventDefault();
        onOpenChange(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = getFocusableElements(panelRef.current);
      if (!focusable.length) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [closeOnEscape, onOpenChange, open]);

  if (!open || typeof document === 'undefined') return null;
  const drawerMotion = overlayMotionPanelProps({
    kind: 'drawer',
    origin: side,
    open: true,
    enterOnMount: true,
    dir: overlayMotionDocumentDir(),
  });
  const backdropMotion = overlayMotionBackdropProps({
    open: true,
    className: 'absolute inset-0 bg-overlay/50',
  });
  const content = (
    <div className="fixed inset-0 z-50" data-shell-responsive-drawer="">
      <AppButton
        aria-label={closeLabel}
        tabIndex={-1}
        className={backdropMotion.className}
        data-overlay-open={backdropMotion['data-overlay-open']}
        onClick={() => closeOnBackdrop && onOpenChange(false)}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title ? undefined : ariaLabel}
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        data-side={side}
        data-overlay-kind={drawerMotion['data-overlay-kind']}
        data-overlay-origin={drawerMotion['data-overlay-origin']}
        data-overlay-open={drawerMotion['data-overlay-open']}
        data-overlay-dir={drawerMotion['data-overlay-dir']}
        className={cn(
          drawerMotion.className,
          'absolute inset-y-0 flex w-[min(22rem,90vw)] flex-col bg-content1 text-foreground shadow-large outline-none',
          side === 'start' ? 'start-0' : 'end-0',
          safeAreaClass.all,
          className,
        )}
      >
        <div
          className={cn(
            'flex gap-2 border-b border-divider px-3',
            subtitle ? 'items-start py-2.5' : 'min-h-12 items-center',
            headerClassName,
          )}
        >
          {title ? (
            <div id={titleId} className="min-w-0 flex-1">
              <h2 className="truncate text-base font-bold">{title}</h2>
              {subtitle ? (
                <p className="mt-0.5 line-clamp-2 text-start text-xs font-normal leading-snug text-slate-600">
                  {subtitle}
                </p>
              ) : null}
            </div>
          ) : (
            <span className="flex-1" />
          )}
          <AppButton
            closeIcon
            aria-label={closeLabel}
            onClick={() => onOpenChange(false)}
          >
            <X aria-hidden className="h-3.5 w-3.5" />
          </AppButton>
        </div>
        <div className={cn('min-h-0 flex-1 overflow-y-auto', bodyClassName)}>{children}</div>
      </div>
    </div>
  );
  return portal ? createPortal(content, document.body) : content;
};
