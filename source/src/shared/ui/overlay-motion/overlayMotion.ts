import { cn } from '../../../lib/utils';

export type OverlayMotionKind = 'drawer' | 'flyout' | 'popover' | 'dialog';

export type OverlayMotionOrigin =
  | 'start'
  | 'end'
  | 'top'
  | 'bottom'
  | 'top-start'
  | 'top-end'
  | 'bottom-start'
  | 'bottom-end'
  | 'center';

export type OverlayMotionDir = 'ltr' | 'rtl';

export const OVERLAY_MOTION_DURATION_MS = 280;
export const OVERLAY_MOTION_PANEL_CLASS = 'overlay-motion-panel';
export const OVERLAY_MOTION_BACKDROP_CLASS = 'overlay-motion-backdrop';
export const OVERLAY_MOTION_ENTER_CLASS = 'overlay-motion-enter';

export function overlayMotionDocumentDir(): OverlayMotionDir {
  if (typeof document === 'undefined') {
    return 'ltr';
  }
  return document.documentElement.getAttribute('dir') === 'rtl' ? 'rtl' : 'ltr';
}

export type OverlayMotionProps = {
  className: string;
  'data-overlay-kind': OverlayMotionKind;
  'data-overlay-origin': OverlayMotionOrigin;
  'data-overlay-open'?: 'true' | 'false';
  'data-overlay-dir'?: OverlayMotionDir;
};

/** Popover placement (`bottom-start`) → motion origin (the edge that stays against the trigger). */
export function overlayOriginFromPopoverPlacement(placement: string): OverlayMotionOrigin {
  const vertical = placement.startsWith('top') ? 'bottom' : placement.startsWith('bottom') ? 'top' : null;
  const horizontal = placement.endsWith('end') ? 'end' : placement.endsWith('start') ? 'start' : null;
  if (vertical && horizontal) {
    return `${vertical}-${horizontal}` as OverlayMotionOrigin;
  }
  if (vertical) {
    return vertical;
  }
  if (horizontal) {
    return horizontal;
  }
  return 'center';
}

export function overlayMotionPanelProps(options: {
  kind: OverlayMotionKind;
  origin: OverlayMotionOrigin;
  open?: boolean;
  dir?: OverlayMotionDir;
  enterOnMount?: boolean;
  className?: string;
}): OverlayMotionProps {
  const enterOnMount = options.enterOnMount ?? options.kind !== 'drawer';
  return {
    className: cn(
      OVERLAY_MOTION_PANEL_CLASS,
      enterOnMount && OVERLAY_MOTION_ENTER_CLASS,
      options.className,
    ),
    'data-overlay-kind': options.kind,
    'data-overlay-origin': options.origin,
    ...(typeof options.open === 'boolean'
      ? { 'data-overlay-open': options.open ? 'true' : 'false' }
      : {}),
    ...(options.dir ? { 'data-overlay-dir': options.dir } : {}),
  };
}

export function overlayMotionBackdropProps(options: {
  open?: boolean;
  className?: string;
}): {
  className: string;
  'data-overlay-open'?: 'true' | 'false';
} {
  return {
    className: cn(OVERLAY_MOTION_BACKDROP_CLASS, options.className),
    ...(typeof options.open === 'boolean'
      ? { 'data-overlay-open': options.open ? 'true' : 'false' }
      : {}),
  };
}
