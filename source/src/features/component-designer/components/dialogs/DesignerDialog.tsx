import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { DIALOG_FOOTER_SURFACE_BG_CLASS } from '../../../../shared/ui/surfaceClasses';
import { DesignerDialogHostContext } from '../../../../shared/ui/designerDialogHostContext';
import { DialogBand } from '../../../../shared/ui';

const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Native `<dialog>` shell. Backdrop blur/tint is canonical in `index.css` (`.designer-dialog-native::backdrop`: rgba(15,23,42,0.12) + blur(4px)). See AGENTS.md § Dialog Backdrop Standard. */
export const DESIGNER_DIALOG_BACKDROP_CLASS = 'designer-dialog-native';

/** Edge-aligned white body slot; wrap content in an inner `bg-white p-[15px]` host. See AGENTS.md § Dialog Body Standard. */
export const DESIGNER_DIALOG_BODY_CLASS = '!bg-white !p-0 -mx-[15px]';

/** Full-height dialogs (e.g. New Layout). */
export const DESIGNER_DIALOG_BODY_FULL_HEIGHT_CLASS = `${DESIGNER_DIALOG_BODY_CLASS} flex-1 min-h-0 overflow-hidden`;

type DesignerDialogProps = {
  title: string;
  /** Optional name or meta shown after the title, in the same header row. */
  titleExtra?: React.ReactNode;
  titleIcon?: React.ReactNode;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Optional second header band under the title row (instructions, subtitle). */
  band?: React.ReactNode;
  footer?: React.ReactNode;
  tone?: 'default' | 'danger';
  surfaceClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  /** When false, backdrop clicks do not invoke `onClose`. Default true. */
  closeOnBackdrop?: boolean;
  /** When false, Escape does not invoke `onClose`. Default true. */
  closeOnEscape?: boolean;
};

export const DesignerDialog: React.FC<DesignerDialogProps> = ({
  title,
  titleExtra,
  titleIcon,
  open,
  onClose,
  children,
  band,
  footer,
  tone = 'default',
  surfaceClassName,
  bodyClassName,
  footerClassName,
  closeOnBackdrop = true,
  closeOnEscape = true,
}) => {
  const dialogRef = React.useRef<HTMLDialogElement | null>(null);
  const dialogSurfaceRef = React.useRef<HTMLDivElement | null>(null);
  const previousActiveElementRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    const handleDialogClose = () => {
      onClose();
    };

    dialog.addEventListener('close', handleDialogClose);
    return () => {
      dialog.removeEventListener('close', handleDialogClose);
    };
  }, [onClose]);

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open) {
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') {
          dialog.showModal();
        } else {
          dialog.setAttribute('open', '');
        }
      }
      return;
    }

    if (dialog.open) {
      if (typeof dialog.close === 'function') {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const handleDialogKeydown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') {
        return;
      }

      const host = dialogSurfaceRef.current;
      if (!host) {
        return;
      }

      const focusableElements = Array.from(host.querySelectorAll(FOCUSABLE_SELECTOR)) as HTMLElement[];

      if (focusableElements.length === 0) {
        event.preventDefault();
        host.focus();
        return;
      }

      const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (!activeElement || !host.contains(activeElement)) {
        event.preventDefault();
        if (event.shiftKey) {
          focusableElements[focusableElements.length - 1].focus();
        } else {
          focusableElements[0].focus();
        }
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
        return;
      }

      if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener('keydown', handleDialogKeydown);
    return () => {
      window.removeEventListener('keydown', handleDialogKeydown);
    };
  }, [open]);

  React.useEffect(() => {
    if (open) {
      previousActiveElementRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

      const handle = window.requestAnimationFrame(() => {
        const host = dialogSurfaceRef.current;
        if (!host) {
          return;
        }

        const firstFocusable = host.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);

        (firstFocusable ?? host).focus();
      });

      return () => {
        window.cancelAnimationFrame(handle);
      };
    }

    const previous = previousActiveElementRef.current;
    if (previous) {
      window.requestAnimationFrame(() => {
        previous.focus();
      });
      previousActiveElementRef.current = null;
    }

    return;
  }, [open]);

  return createPortal(
    <dialog
      ref={dialogRef}
      className={DESIGNER_DIALOG_BACKDROP_CLASS}
      data-designer-dialog-backdrop=""
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        if (closeOnEscape) {
          onClose();
        }
      }}
      onClick={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogSurfaceRef}
        tabIndex={-1}
        className={cn(
          'w-full rounded-xl border border-slate-200 bg-white px-[15px] shadow-2xl',
          surfaceClassName ?? 'max-w-2xl',
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className={cn(
            '-mx-[15px] flex items-center justify-between border-b px-[15px] py-[9px]',
            tone === 'danger'
              ? 'border-rose-200 bg-rose-50/80'
              : 'border-slate-200 bg-slate-50/80',
          )}
        >
          <div
            className={cn(
              'flex min-w-0 items-center gap-2',
              tone === 'danger' ? 'text-rose-800' : 'text-slate-800',
            )}
          >
            {titleIcon ? (
              <span className="inline-flex shrink-0 items-center overflow-hidden [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0" aria-hidden>
                {titleIcon}
              </span>
            ) : tone === 'danger' ? (
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden />
            ) : null}
            <span className="shrink-0 text-sm font-semibold">{title}</span>
            {titleExtra}
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700" aria-label="Close dialog">
            <X className="h-4 w-4" />
          </button>
        </div>

        {band ? (
          <DialogBand tone="muted" className="min-w-0 py-1.5 text-[11px] text-slate-600">
            {band}
          </DialogBand>
        ) : null}

        {/* Default body uses workspace texture; callers must override via bodyClassName per AGENTS.md § Dialog Body Standard. */}
        <div className={`bg-surface-workspace p-[15px] ${bodyClassName ?? ''}`}>
          <DesignerDialogHostContext.Provider value>
            {children}
          </DesignerDialogHostContext.Provider>
        </div>

        {footer ? (
          <div className={cn('-mx-[15px] border-t border-slate-200 px-[15px] py-[9px]', DIALOG_FOOTER_SURFACE_BG_CLASS, footerClassName)}>
            {footer}
          </div>
        ) : null}
      </div>
    </dialog>,
    document.body,
  );
};
