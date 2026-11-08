import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../../lib/utils';
import {
  overlayMotionDocumentDir,
  overlayMotionPanelProps,
  overlayOriginFromPopoverPlacement,
} from '../overlay-motion/overlayMotion';

export type ShellResponsivePopoverPlacement =
  | 'bottom-start'
  | 'bottom-end'
  | 'top-start'
  | 'top-end';

export type ShellResponsivePopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactElement;
  children: React.ReactNode;
  placement?: ShellResponsivePopoverPlacement;
  fallbackPlacement?: ShellResponsivePopoverPlacement;
  dismissOnOutside?: boolean;
  dismissOnEscape?: boolean;
  dismissOnBlur?: boolean;
  ariaLabel?: string;
  className?: string;
  /**
   * Render the panel in a body portal with fixed positioning.
   * Use inside overflow-hidden / transformed shells.
   */
  portal?: boolean;
  /** Stacking order for portaled panels — use above parent popovers (e.g. nested pickers). */
  portalZIndex?: number;
  /**
   * Max height for portaled panels. Defaults to compact popovers (`24rem`), capped to viewport.
   * Pass `false` to use all viewport space below/above the trigger (pickers).
   */
  portalMaxHeight?: string | false;
  /** Stretch the trigger root to fill a host cell (embedded swatch pickers). */
  fillTrigger?: boolean;
  /** Extra horizontal gap (px) between trigger and portaled panel edge. */
  portalSkidPx?: number;
};

const placementClasses: Record<ShellResponsivePopoverPlacement, string> = {
  'bottom-start': 'start-0 top-full mt-1',
  'bottom-end': 'end-0 top-full mt-1',
  'top-start': 'bottom-full start-0 mb-1',
  'top-end': 'bottom-full end-0 mb-1',
};

const PANEL_GAP_PX = 4;
const VIEWPORT_MARGIN_PX = 8;

const flipVerticalPlacement = (
  value: ShellResponsivePopoverPlacement,
): ShellResponsivePopoverPlacement => (
  value.startsWith('bottom')
    ? (value.replace('bottom', 'top') as ShellResponsivePopoverPlacement)
    : (value.replace('top', 'bottom') as ShellResponsivePopoverPlacement)
);

const flipHorizontalPlacement = (
  value: ShellResponsivePopoverPlacement,
): ShellResponsivePopoverPlacement => (
  value.endsWith('start')
    ? (value.replace('start', 'end') as ShellResponsivePopoverPlacement)
    : (value.replace('end', 'start') as ShellResponsivePopoverPlacement)
);

const DEFAULT_PORTAL_Z_INDEX = 1000;

const DEFAULT_PORTAL_MAX_HEIGHT = `min(24rem, calc(100dvh - ${VIEWPORT_MARGIN_PX * 2}px))`;

const getAvailableSpace = (triggerRect: DOMRect) => ({
  below: window.innerHeight - triggerRect.bottom - PANEL_GAP_PX - VIEWPORT_MARGIN_PX,
  above: triggerRect.top - PANEL_GAP_PX - VIEWPORT_MARGIN_PX,
});

const resolveVerticalPlacement = (
  preferred: ShellResponsivePopoverPlacement,
  triggerRect: DOMRect,
  panelHeight: number,
): ShellResponsivePopoverPlacement => {
  const { below, above } = getAvailableSpace(triggerRect);
  const estimatedHeight = Math.max(panelHeight, 160);

  if (preferred.startsWith('bottom')) {
    if (below < estimatedHeight && above > below) {
      return flipVerticalPlacement(preferred);
    }
    return preferred;
  }

  if (above < estimatedHeight && below > above) {
    return flipVerticalPlacement(preferred);
  }
  return preferred;
};

const getHorizontalAlignSpace = (triggerRect: DOMRect) => ({
  atStart: window.innerWidth - triggerRect.left - VIEWPORT_MARGIN_PX,
  atEnd: triggerRect.right - VIEWPORT_MARGIN_PX,
});

const resolveHorizontalPlacement = (
  placement: ShellResponsivePopoverPlacement,
  triggerRect: DOMRect,
  panelWidth: number,
): ShellResponsivePopoverPlacement => {
  const estimatedWidth = Math.max(panelWidth, 192);
  const { atStart, atEnd } = getHorizontalAlignSpace(triggerRect);

  if (placement.endsWith('start')) {
    if (estimatedWidth > atStart && atEnd > atStart) {
      return flipHorizontalPlacement(placement);
    }
    return placement;
  }

  if (estimatedWidth > atEnd && atStart > atEnd) {
    return flipHorizontalPlacement(placement);
  }
  return placement;
};

const resolvePlacement = (
  preferred: ShellResponsivePopoverPlacement,
  triggerRect: DOMRect,
  panelWidth: number,
  panelHeight: number,
): ShellResponsivePopoverPlacement => {
  const vertical = resolveVerticalPlacement(preferred, triggerRect, panelHeight);
  return resolveHorizontalPlacement(vertical, triggerRect, panelWidth);
};

const resolvePortalMaxHeight = (
  placement: ShellResponsivePopoverPlacement,
  triggerRect: DOMRect,
  portalMaxHeight: string | false | undefined,
): string | undefined => {
  const availableBelow = window.innerHeight - triggerRect.bottom - PANEL_GAP_PX - VIEWPORT_MARGIN_PX;
  const availableAbove = triggerRect.top - PANEL_GAP_PX - VIEWPORT_MARGIN_PX;
  const viewportPx = placement.startsWith('bottom')
    ? Math.max(availableBelow, 160)
    : Math.max(availableAbove, 160);

  if (portalMaxHeight === false) {
    return `${viewportPx}px`;
  }
  if (typeof portalMaxHeight === 'string') {
    return portalMaxHeight;
  }
  return `min(24rem, ${viewportPx}px)`;
};

const buildPortalPanelStyle = (
  triggerRect: DOMRect,
  placement: ShellResponsivePopoverPlacement,
  portalZIndex: number,
  portalMaxHeight: string | false | undefined,
  portalSkidPx: number,
): React.CSSProperties => {
  const style: React.CSSProperties = {
    position: 'fixed',
    zIndex: portalZIndex,
    maxWidth: `calc(100vw - ${VIEWPORT_MARGIN_PX * 2}px)`,
    maxHeight: resolvePortalMaxHeight(placement, triggerRect, portalMaxHeight),
  };

  if (placement.startsWith('bottom')) {
    style.top = triggerRect.bottom + PANEL_GAP_PX;
  } else {
    style.bottom = window.innerHeight - triggerRect.top + PANEL_GAP_PX;
  }

  if (placement.endsWith('start')) {
    style.left = triggerRect.left + portalSkidPx;
  } else {
    style.right = window.innerWidth - triggerRect.right + portalSkidPx;
  }

  return style;
};

export const ShellResponsivePopover: React.FC<ShellResponsivePopoverProps> = ({
  open,
  onOpenChange,
  trigger,
  children,
  placement = 'bottom-end',
  fallbackPlacement = 'bottom-start',
  dismissOnOutside = true,
  dismissOnEscape = true,
  dismissOnBlur = false,
  ariaLabel = 'Popover',
  className,
  portal = false,
  portalZIndex = DEFAULT_PORTAL_Z_INDEX,
  portalMaxHeight,
  fillTrigger = false,
  portalSkidPx = 0,
}) => {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const popoverId = React.useId();
  const [resolvedPlacement, setResolvedPlacement] = React.useState(placement);
  const [portalPanelStyle, setPortalPanelStyle] = React.useState<React.CSSProperties | undefined>();

  React.useEffect(() => {
    if (!open) {
      setResolvedPlacement(placement);
      setPortalPanelStyle(undefined);
    }
  }, [open, placement]);

  const resolveCollision = React.useCallback(() => {
    if (!triggerRef.current) {
      return;
    }

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const panelRect = panelRef.current?.getBoundingClientRect();
    const panelHeight = panelRef.current?.scrollHeight ?? panelRect?.height ?? 200;
    const panelWidth = panelRef.current?.scrollWidth ?? panelRect?.width ?? 200;

    setResolvedPlacement(resolvePlacement(placement, triggerRect, panelWidth, panelHeight));
  }, [placement]);

  React.useLayoutEffect(() => {
    if (!open || portal) return undefined;

    resolveCollision();
    window.addEventListener('resize', resolveCollision);
    return () => window.removeEventListener('resize', resolveCollision);
  }, [open, portal, placement, resolveCollision]);

  React.useLayoutEffect(() => {
    if (!open || !portal) {
      return undefined;
    }

    const updatePortalPosition = () => {
      if (!triggerRef.current) return;

      const triggerRect = triggerRef.current.getBoundingClientRect();
      const panelHeight = panelRef.current?.scrollHeight
        ?? panelRef.current?.getBoundingClientRect().height
        ?? 400;
      const panelWidth = panelRef.current?.scrollWidth
        ?? panelRef.current?.getBoundingClientRect().width
        ?? 400;
      const nextPlacement = resolvePlacement(placement, triggerRect, panelWidth, panelHeight);

      setResolvedPlacement(nextPlacement);
      setPortalPanelStyle(
        buildPortalPanelStyle(
          triggerRect,
          nextPlacement,
          portalZIndex,
          portalMaxHeight,
          portalSkidPx,
        ),
      );
    };

    updatePortalPosition();
    window.requestAnimationFrame(updatePortalPosition);
    window.addEventListener('resize', updatePortalPosition);
    window.addEventListener('scroll', updatePortalPosition, true);
    return () => {
      window.removeEventListener('resize', updatePortalPosition);
      window.removeEventListener('scroll', updatePortalPosition, true);
    };
  }, [open, portal, placement, portalMaxHeight, portalSkidPx, portalZIndex]);

  React.useEffect(() => {
    if (!open) return;
    const containsTarget = (target: Node) => (
      rootRef.current?.contains(target) || panelRef.current?.contains(target)
    );
    const onPointerDown = (event: PointerEvent) => {
      if (dismissOnOutside && !containsTarget(event.target as Node)) onOpenChange(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (dismissOnEscape && event.key === 'Escape') {
        event.preventDefault();
        onOpenChange(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    const onFocusIn = (event: FocusEvent) => {
      if (dismissOnBlur && !containsTarget(event.target as Node)) onOpenChange(false);
    };
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [dismissOnBlur, dismissOnEscape, dismissOnOutside, onOpenChange, open]);

  const popoverMotion = overlayMotionPanelProps({
    kind: 'popover',
    origin: overlayOriginFromPopoverPlacement(resolvedPlacement),
    dir: overlayMotionDocumentDir(),
  });
  const panelClassName = cn(
    popoverMotion.className,
    portal
      ? 'fixed flex min-h-0 min-w-48 flex-col overflow-visible rounded-medium border border-divider bg-content1 p-2 text-foreground shadow-large'
      : cn(
        'absolute z-50 max-h-[min(24rem,calc(100dvh-2rem))] min-w-48 max-w-[calc(100vw-2rem)] overflow-auto rounded-medium border border-divider bg-content1 p-2 text-foreground shadow-large',
        placementClasses[resolvedPlacement],
      ),
    className,
  );

  const panel = open ? (
    <div
      ref={panelRef}
      id={popoverId}
      role="dialog"
      aria-label={ariaLabel}
      data-fallback-placement={fallbackPlacement}
      data-placement={resolvedPlacement}
      data-overlay-kind={popoverMotion['data-overlay-kind']}
      data-overlay-origin={popoverMotion['data-overlay-origin']}
      data-overlay-dir={popoverMotion['data-overlay-dir']}
      className={panelClassName}
      style={portal ? portalPanelStyle : undefined}
    >
      {children}
    </div>
  ) : null;

  const triggerProps = trigger.props as Record<string, unknown>;
  const triggerClassName = triggerProps.className;
  return (
    <div
      ref={rootRef}
      className={cn('relative', fillTrigger ? 'flex h-full w-full min-h-0' : 'inline-flex')}
      data-shell-responsive-popover=""
    >
      {React.cloneElement(trigger, {
        className: cn(
          fillTrigger && 'h-full min-h-0 w-full min-w-0 flex-1',
          triggerClassName,
        ),
        ref: (node: HTMLElement | null) => {
          triggerRef.current = node;
          const originalRef = triggerProps.ref as React.Ref<HTMLElement> | undefined;
          if (typeof originalRef === 'function') originalRef(node);
          else if (originalRef) (originalRef as React.MutableRefObject<HTMLElement | null>).current = node;
        },
        'aria-expanded': open,
        'aria-controls': open ? popoverId : undefined,
        'aria-haspopup': 'dialog',
        onClick: (event: React.MouseEvent) => {
          (triggerProps.onClick as ((event: React.MouseEvent) => void) | undefined)?.(event);
          if (!event.defaultPrevented) onOpenChange(!open);
        },
      } as never)}
      {panel && portal && typeof document !== 'undefined'
        ? createPortal(panel, document.body)
        : panel}
    </div>
  );
};
