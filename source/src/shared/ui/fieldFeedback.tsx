import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';

export type FieldFeedbackPlacement = 'overlay' | 'below';
export type FieldFeedbackOverlaySide = 'above' | 'below';

/** App-wide default: validation hints render as an overlay balloon (prefer above). */
export const DEFAULT_FIELD_FEEDBACK_PLACEMENT: FieldFeedbackPlacement = 'overlay';

export const FIELD_FEEDBACK_ERROR_CLASS = 'text-xs font-medium text-rose-600';
export const FIELD_FEEDBACK_DESCRIPTION_CLASS = 'text-xs text-slate-500';

/** Gap between the control and the overlay balloon (also clears the caret). */
export const FIELD_FEEDBACK_OVERLAY_GAP_PX = 6;
/** Keep the balloon inside the clip edge instead of flush against it. */
export const FIELD_FEEDBACK_OVERLAY_MARGIN_PX = 8;

const CLIPPING_OVERFLOW = new Set(['auto', 'scroll', 'hidden', 'clip', 'overlay']);

type FieldFeedbackContentProps = {
  description?: string;
  errorMessage?: string;
  isInvalid?: boolean;
  placement?: FieldFeedbackPlacement;
};

export const hasFieldErrorFeedback = (
  errorMessage?: string,
  isInvalid?: boolean,
): boolean => Boolean(isInvalid && errorMessage);

export const isFieldFeedbackClippingOverflow = (overflow: string): boolean => (
  CLIPPING_OVERFLOW.has(overflow)
);

export const resolveFieldFeedbackOverlaySide = ({
  availableAbove,
  availableBelow,
  overlayHeight,
}: {
  availableAbove: number;
  availableBelow: number;
  overlayHeight: number;
}): FieldFeedbackOverlaySide => {
  if (availableAbove >= overlayHeight) {
    return 'above';
  }
  if (availableBelow >= overlayHeight) {
    return 'below';
  }
  return availableBelow > availableAbove ? 'below' : 'above';
};

export const measureFieldFeedbackOverlaySpace = (
  controlRect: Pick<DOMRect, 'top' | 'bottom'>,
  clip: { top: number; bottom: number },
): { availableAbove: number; availableBelow: number } => ({
  availableAbove: controlRect.top - clip.top - FIELD_FEEDBACK_OVERLAY_GAP_PX - FIELD_FEEDBACK_OVERLAY_MARGIN_PX,
  availableBelow: clip.bottom - controlRect.bottom - FIELD_FEEDBACK_OVERLAY_GAP_PX - FIELD_FEEDBACK_OVERLAY_MARGIN_PX,
});

export const getFieldFeedbackViewportHeight = (): number => {
  if (typeof window === 'undefined') {
    return 0;
  }
  return window.innerHeight || document.documentElement.clientHeight || 0;
};

/** Visible vertical window: viewport intersected with overflow-clipping ancestors. */
export const getFieldFeedbackClipRect = (
  node: HTMLElement,
  viewportHeight = getFieldFeedbackViewportHeight(),
): { top: number; bottom: number } => {
  let top = 0;
  let bottom = viewportHeight;
  let current: HTMLElement | null = node.parentElement;
  while (current) {
    const style = window.getComputedStyle(current);
    if (
      isFieldFeedbackClippingOverflow(style.overflowY)
      || isFieldFeedbackClippingOverflow(style.overflow)
    ) {
      const rect = current.getBoundingClientRect();
      top = Math.max(top, rect.top);
      bottom = Math.min(bottom, rect.bottom);
    }
    current = current.parentElement;
  }
  return { top, bottom };
};

export const renderFieldFeedbackBelow = ({
  description,
  errorMessage,
  isInvalid,
  placement = DEFAULT_FIELD_FEEDBACK_PLACEMENT,
}: FieldFeedbackContentProps): React.ReactNode => {
  const showErrorBelow = placement === 'below' && hasFieldErrorFeedback(errorMessage, isInvalid);
  if (!description && !showErrorBelow) {
    return null;
  }

  return (
    <div className="mt-[2px] flex flex-col gap-[2px]">
      {description ? <p className={cn('ps-[4px]', FIELD_FEEDBACK_DESCRIPTION_CLASS)}>{description}</p> : null}
      {showErrorBelow ? (
        <p className={cn('ps-[4px]', FIELD_FEEDBACK_ERROR_CLASS)} role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
};

type FieldFeedbackShellProps = FieldFeedbackContentProps & {
  children: React.ReactNode;
  className?: string;
};

const OVERLAY_ERROR_BASE_CLASS =
  'pointer-events-none absolute left-0 z-[9999] max-w-xs rounded-md border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-medium text-rose-600 shadow-sm';

const FieldErrorOverlay: React.FC<{ message: string }> = ({ message }) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [side, setSide] = useState<FieldFeedbackOverlaySide>('above');

  const updateSide = useCallback(() => {
    const overlay = overlayRef.current;
    const host = overlay?.parentElement;
    if (!host || !overlay) {
      return;
    }

    const space = measureFieldFeedbackOverlaySpace(
      host.getBoundingClientRect(),
      getFieldFeedbackClipRect(host),
    );
    const next = resolveFieldFeedbackOverlaySide({
      ...space,
      overlayHeight: overlay.getBoundingClientRect().height,
    });
    setSide((current) => (current === next ? current : next));
  }, []);

  const setOverlayNode = useCallback((node: HTMLDivElement | null) => {
    overlayRef.current = node;
    if (node) {
      updateSide();
    }
  }, [updateSide]);

  useLayoutEffect(() => {
    updateSide();
    window.addEventListener('resize', updateSide);
    window.addEventListener('scroll', updateSide, true);
    const overlay = overlayRef.current;
    const observer = overlay && typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(updateSide)
      : null;
    observer?.observe(overlay);
    return () => {
      window.removeEventListener('resize', updateSide);
      window.removeEventListener('scroll', updateSide, true);
      observer?.disconnect();
    };
  }, [message, updateSide]);

  const above = side === 'above';

  return (
    <div
      ref={setOverlayNode}
      role="alert"
      data-side={side}
      className={cn(
        OVERLAY_ERROR_BASE_CLASS,
        above ? 'bottom-[calc(100%+6px)]' : 'top-[calc(100%+6px)]',
      )}
    >
      {message}
      {above ? (
        <>
          <span
            aria-hidden
            className="absolute left-4 top-full h-0 w-0 border-x-[6px] border-t-[6px] border-x-transparent border-t-rose-200"
          />
          <span
            aria-hidden
            className="absolute left-4 top-full h-0 w-0 -translate-y-px border-x-[5px] border-t-[5px] border-x-transparent border-t-white"
          />
        </>
      ) : (
        <>
          <span
            aria-hidden
            className="absolute bottom-full left-4 h-0 w-0 border-x-[6px] border-b-[6px] border-x-transparent border-b-rose-200"
          />
          <span
            aria-hidden
            className="absolute bottom-full left-4 h-0 w-0 translate-y-px border-x-[5px] border-b-[5px] border-x-transparent border-b-white"
          />
        </>
      )}
    </div>
  );
};

export const FieldFeedbackShell: React.FC<FieldFeedbackShellProps> = ({
  children,
  className,
  description,
  errorMessage,
  isInvalid,
  placement = DEFAULT_FIELD_FEEDBACK_PLACEMENT,
}) => {
  const useOverlayPlacement = placement === 'overlay';
  const showOverlay = useOverlayPlacement && hasFieldErrorFeedback(errorMessage, isInvalid);

  const control = useOverlayPlacement ? (
    <div
      data-field-feedback-host="true"
      className={cn('relative w-full overflow-visible', showOverlay && 'z-20')}
    >
      {children}
      {showOverlay && errorMessage ? <FieldErrorOverlay message={errorMessage} /> : null}
    </div>
  ) : (
    children
  );

  return (
    <div className={cn('w-full', className)}>
      {control}
      {renderFieldFeedbackBelow({ description, errorMessage, isInvalid, placement })}
    </div>
  );
};
