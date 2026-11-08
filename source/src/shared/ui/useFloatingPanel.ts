import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ADMIN_SHELL_SIDEBAR_WIDTH_EXPANDED_DEFAULT_PX } from './adminShellSidebarWidth';

export type FloatingPanelBounds = {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maximizeInset?: number;
};

export type FloatingPanelInitialPosition = 'center' | 'bottom-right' | 'top-right' | 'top-left';

export type FloatingPanelMinimizedAnchor = 'preserve' | 'bottom-left';

export type FloatingPanelRestoredAnchor = 'preserve' | 'top-right';

export type FloatingPanelInitialOffset = {
  x?: number;
  y?: number;
};

export type UseFloatingPanelOptions = {
  open: boolean;
  bounds: FloatingPanelBounds;
  defaultWidth: number;
  defaultHeight: number;
  initialPosition?: FloatingPanelInitialPosition;
  initialOffset?: FloatingPanelInitialOffset;
  /** Where the panel docks when minimized. Default `preserve` (same x/y, header height only). */
  minimizedAnchor?: FloatingPanelMinimizedAnchor;
  /** Gap from the minimized anchor edges. Default `24`. */
  minimizedGap?: number;
  /** Element whose right edge the minimized panel sits next to (`bottom-left` only). */
  minimizedBesideSelector?: string;
  /** Element whose top edge the minimized panel sits above (`bottom-left` only). */
  minimizedAboveSelector?: string;
  /** Where the panel docks when restored from minimize. Default `preserve`. */
  restoredAnchor?: FloatingPanelRestoredAnchor;
  /** Gap from the restored anchor edges. Default `10`. */
  restoredGap?: number;
  /** Element whose left edge the restored panel sits before (`top-right` only). */
  restoredBeforeSelector?: string;
  /** Element whose bottom edge the restored panel sits below (`top-right` only). */
  restoredBelowSelector?: string;
  /** Element whose top edge the restored panel sits above (`top-right` only). */
  restoredAboveSelector?: string;
  enableDrag?: boolean;
  enableResize?: boolean;
  enableMaximize?: boolean;
  /** Opens already maximized (still toggleable via the header button/`togglePanelMaximize`). Default false. */
  initialMaximized?: boolean;
};

const DEFAULT_MAXIMIZE_INSET = 16;
const BOTTOM_RIGHT_POS = { x: 24, y: 90 };
/** Inset from the viewport top-right corner (`x` = right, `y` = top). */
const TOP_RIGHT_POS = { x: 40, y: 72 };
/** Gap from the admin sidebar / viewport edge for top-left panels (`y` = top). */
const TOP_LEFT_GAP = { x: 17, y: 72 };
const MINIMIZED_PANEL_INSET = 24;
const MINIMIZED_PANEL_HEIGHT = 40;

const capturePanelPointer = (event: React.PointerEvent<HTMLElement>) => {
  if (typeof event.currentTarget.setPointerCapture !== 'function' || event.pointerId == null) {
    return;
  }
  try {
    event.currentTarget.setPointerCapture(event.pointerId);
  } catch {
    // jsdom and detached nodes cannot capture.
  }
};

const getDefaultPanelHeight = (defaultHeight: number) => Math.min(defaultHeight, window.innerHeight - 120);

const getCenteredPanelPos = (width: number, height: number) => ({
  x: Math.max(10, Math.round((window.innerWidth - width) / 2)),
  y: Math.max(10, Math.round((window.innerHeight - height) / 2)),
});

const readAdminShellSidebarWidth = (): number => {
  if (typeof window === 'undefined') {
    return ADMIN_SHELL_SIDEBAR_WIDTH_EXPANDED_DEFAULT_PX;
  }

  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--admin-shell-sidebar-width')
    .trim();
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : ADMIN_SHELL_SIDEBAR_WIDTH_EXPANDED_DEFAULT_PX;
};

/** Convert a left inset into the shell's `right`-based x coordinate. */
const getTopLeftPanelPos = (width: number) => {
  const leftInset = readAdminShellSidebarWidth() + TOP_LEFT_GAP.x;
  return {
    x: Math.max(10, Math.round(window.innerWidth - width - leftInset)),
    y: TOP_LEFT_GAP.y,
  };
};

const getInitialPanelPos = (
  width: number,
  height: number,
  initialPosition: FloatingPanelInitialPosition,
  initialOffset?: FloatingPanelInitialOffset,
) => {
  const base = initialPosition === 'bottom-right'
    ? BOTTOM_RIGHT_POS
    : initialPosition === 'top-right'
      ? TOP_RIGHT_POS
      : initialPosition === 'top-left'
        ? getTopLeftPanelPos(width)
        : getCenteredPanelPos(width, height);

  return {
    x: Math.max(10, base.x + (initialOffset?.x ?? 0)),
    y: Math.max(10, base.y + (initialOffset?.y ?? 0)),
  };
};

const getMaximizedPanelBounds = (bounds: FloatingPanelBounds) => {
  const inset = bounds.maximizeInset ?? DEFAULT_MAXIMIZE_INSET;
  return {
    x: inset,
    y: inset,
    width: Math.max(bounds.minWidth, window.innerWidth - inset * 2),
    height: Math.max(bounds.minHeight, window.innerHeight - inset * 2),
  };
};

const getTopRightRestoredPanelBounds = (
  width: number,
  minHeight: number,
  gap: number,
  beforeSelector?: string,
  belowSelector?: string,
  aboveSelector?: string,
) => {
  const beforeRect = queryMinimizedAnchorRect(beforeSelector);
  const belowRect = queryMinimizedAnchorRect(belowSelector);
  const aboveRect = queryMinimizedAnchorRect(aboveSelector);
  const rightEdge = beforeRect ? beforeRect.left - gap : window.innerWidth - gap;
  const y = Math.max(gap, (belowRect ? belowRect.bottom : 0) + gap);
  const bottomEdge = aboveRect ? aboveRect.top : window.innerHeight;
  return {
    x: Math.max(gap, window.innerWidth - rightEdge),
    y,
    width,
    height: Math.max(minHeight, bottomEdge - gap - y),
  };
};

const queryMinimizedAnchorRect = (selector: string | undefined): DOMRect | null => {
  if (!selector || typeof document === 'undefined') {
    return null;
  }
  return document.querySelector(selector)?.getBoundingClientRect() ?? null;
};

const getBottomLeftMinimizedPanelPos = (
  width: number,
  height: number,
  gap = MINIMIZED_PANEL_INSET,
  besideSelector?: string,
  aboveSelector?: string,
) => {
  const besideRect = queryMinimizedAnchorRect(besideSelector);
  const aboveRect = queryMinimizedAnchorRect(aboveSelector);
  const left = besideRect ? besideRect.right + gap : readAdminShellSidebarWidth() + gap;
  const bottomEdge = aboveRect ? aboveRect.top : window.innerHeight;
  return {
    x: Math.max(gap, window.innerWidth - left - width),
    y: Math.max(gap, bottomEdge - height - gap),
  };
};

export function useFloatingPanel({
  open,
  bounds,
  defaultWidth,
  defaultHeight,
  initialPosition = 'center',
  initialOffset,
  minimizedAnchor = 'preserve',
  minimizedGap = MINIMIZED_PANEL_INSET,
  minimizedBesideSelector,
  minimizedAboveSelector,
  restoredAnchor = 'preserve',
  restoredGap = 10,
  restoredBeforeSelector,
  restoredBelowSelector,
  restoredAboveSelector,
  enableDrag = true,
  enableResize = true,
  enableMaximize = true,
  initialMaximized = false,
}: UseFloatingPanelOptions) {
  const resolvedDefaultHeight = getDefaultPanelHeight(defaultHeight);
  const initialOffsetX = initialOffset?.x ?? 0;
  const initialOffsetY = initialOffset?.y ?? 0;
  const resolvedInitialOffset = useMemo(
    () => ({ x: initialOffsetX, y: initialOffsetY }),
    [initialOffsetX, initialOffsetY],
  );
  const [panelPos, setPanelPos] = useState(() =>
    getInitialPanelPos(defaultWidth, resolvedDefaultHeight, initialPosition, resolvedInitialOffset),
  );
  const [panelSize, setPanelSize] = useState({
    width: defaultWidth,
    height: resolvedDefaultHeight,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isPanelMaximized, setIsPanelMaximized] = useState(enableMaximize && initialMaximized);
  const [isPanelMinimized, setIsPanelMinimized] = useState(false);
  const preMaximizePanelStateRef = useRef<{
    pos: { x: number; y: number };
    size: { width: number; height: number };
  } | null>(null);
  const preMinimizePanelStateRef = useRef<{
    pos: { x: number; y: number };
    size: { width: number; height: number };
    wasMaximized: boolean;
  } | null>(null);
  const dragStartRef = useRef({
    mouseX: 0,
    mouseY: 0,
    right: BOTTOM_RIGHT_POS.x,
    top: BOTTOM_RIGHT_POS.y,
  });
  const resizeStartRef = useRef({
    mouseX: 0,
    mouseY: 0,
    width: defaultWidth,
    height: resolvedDefaultHeight,
    right: BOTTOM_RIGHT_POS.x,
    top: BOTTOM_RIGHT_POS.y,
  });
  const hasLaidOutRef = useRef(false);

  const applyMaximizedPanelBounds = useCallback(() => {
    const nextBounds = getMaximizedPanelBounds(bounds);
    setPanelPos({ x: nextBounds.x, y: nextBounds.y });
    setPanelSize({ width: nextBounds.width, height: nextBounds.height });
  }, [bounds]);

  const applyRestoredPanelBounds = useCallback((width: number) => {
    const nextBounds = getTopRightRestoredPanelBounds(
      width,
      bounds.minHeight,
      restoredGap,
      restoredBeforeSelector,
      restoredBelowSelector,
      restoredAboveSelector,
    );
    setPanelPos({ x: nextBounds.x, y: nextBounds.y });
    setPanelSize({ width: nextBounds.width, height: nextBounds.height });
  }, [
    bounds.minHeight,
    restoredAboveSelector,
    restoredBeforeSelector,
    restoredBelowSelector,
    restoredGap,
  ]);

  const togglePanelMaximize = useCallback(() => {
    if (!enableMaximize || isPanelMinimized) return;

    if (isPanelMaximized) {
      const saved = preMaximizePanelStateRef.current;
      if (saved) {
        setPanelPos(saved.pos);
        setPanelSize(saved.size);
      }
      preMaximizePanelStateRef.current = null;
      setIsPanelMaximized(false);
      return;
    }

    preMaximizePanelStateRef.current = {
      pos: { ...panelPos },
      size: { ...panelSize },
    };
    setIsPanelMaximized(true);
    applyMaximizedPanelBounds();
  }, [applyMaximizedPanelBounds, enableMaximize, isPanelMinimized, isPanelMaximized, panelPos, panelSize]);

  const minimizePanel = useCallback(() => {
    if (!open) return;

    if (!isPanelMinimized) {
      preMinimizePanelStateRef.current = {
        pos: { ...panelPos },
        size: { ...panelSize },
        wasMaximized: isPanelMaximized,
      };

      if (isPanelMaximized) {
        setIsPanelMaximized(false);
        preMaximizePanelStateRef.current = null;
      }

      setIsPanelMinimized(true);
      const nextSize = { width: panelSize.width, height: MINIMIZED_PANEL_HEIGHT };
      setPanelSize(nextSize);
      if (minimizedAnchor === 'bottom-left') {
        setPanelPos(getBottomLeftMinimizedPanelPos(
          nextSize.width,
          nextSize.height,
          minimizedGap,
          minimizedBesideSelector,
          minimizedAboveSelector,
        ));
      }
      return;
    }

    if (minimizedAnchor === 'bottom-left') {
      setPanelPos(getBottomLeftMinimizedPanelPos(
        panelSize.width,
        MINIMIZED_PANEL_HEIGHT,
        minimizedGap,
        minimizedBesideSelector,
        minimizedAboveSelector,
      ));
    }
  }, [
    isPanelMaximized,
    isPanelMinimized,
    minimizedAboveSelector,
    minimizedAnchor,
    minimizedBesideSelector,
    minimizedGap,
    open,
    panelPos,
    panelSize,
  ]);

  const restorePanel = useCallback(() => {
    if (!isPanelMinimized) return;

    const saved = preMinimizePanelStateRef.current;
    if (restoredAnchor === 'top-right') {
      applyRestoredPanelBounds(saved?.size.width ?? panelSize.width);
      preMinimizePanelStateRef.current = null;
      setIsPanelMinimized(false);
      setIsPanelMaximized(false);
      return;
    }

    if (saved) {
      setPanelPos(saved.pos);
      setPanelSize(saved.size);
      setIsPanelMaximized(saved.wasMaximized);
      if (saved.wasMaximized) {
        applyMaximizedPanelBounds();
      }
    }

    preMinimizePanelStateRef.current = null;
    setIsPanelMinimized(false);
  }, [
    applyMaximizedPanelBounds,
    applyRestoredPanelBounds,
    isPanelMinimized,
    panelSize.width,
    restoredAnchor,
  ]);

  useEffect(() => {
    if (!open || !isPanelMaximized || !enableMaximize) return;

    const handleResize = () => {
      applyMaximizedPanelBounds();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [applyMaximizedPanelBounds, enableMaximize, isPanelMaximized, open]);

  useEffect(() => {
    if (!open || !isPanelMinimized || minimizedAnchor !== 'bottom-left') return;

    const applyMinimizedPos = () => {
      setPanelPos(getBottomLeftMinimizedPanelPos(
        panelSize.width,
        MINIMIZED_PANEL_HEIGHT,
        minimizedGap,
        minimizedBesideSelector,
        minimizedAboveSelector,
      ));
    };

    window.addEventListener('resize', applyMinimizedPos);

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(applyMinimizedPos);
    const besideEl = minimizedBesideSelector ? document.querySelector(minimizedBesideSelector) : null;
    const aboveEl = minimizedAboveSelector ? document.querySelector(minimizedAboveSelector) : null;
    if (observer && besideEl) observer.observe(besideEl);
    if (observer && aboveEl) observer.observe(aboveEl);

    return () => {
      window.removeEventListener('resize', applyMinimizedPos);
      observer?.disconnect();
    };
  }, [
    isPanelMinimized,
    minimizedAboveSelector,
    minimizedAnchor,
    minimizedBesideSelector,
    minimizedGap,
    open,
    panelSize.width,
  ]);

  useEffect(() => {
    hasLaidOutRef.current = false;
  }, [defaultHeight, defaultWidth, initialOffsetX, initialOffsetY, initialPosition]);

  useEffect(() => {
    if (!open) {
      setIsPanelMinimized(false);
      preMinimizePanelStateRef.current = null;
      hasLaidOutRef.current = false;
      setIsDragging(false);
      setIsResizing(false);
      return;
    }

    if (isPanelMinimized) return;

    if (isPanelMaximized) {
      applyMaximizedPanelBounds();
      return;
    }

    if (hasLaidOutRef.current) return;
    hasLaidOutRef.current = true;

    const height = getDefaultPanelHeight(defaultHeight);
    setPanelSize({ width: defaultWidth, height });
    setPanelPos(getInitialPanelPos(defaultWidth, height, initialPosition, resolvedInitialOffset));
  }, [
    applyMaximizedPanelBounds,
    defaultHeight,
    defaultWidth,
    initialPosition,
    initialOffsetX,
    initialOffsetY,
    isPanelMaximized,
    isPanelMinimized,
    open,
    resolvedInitialOffset,
  ]);

  const startDrag = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (!enableDrag || isPanelMaximized) return false;

    event.preventDefault();
    capturePanelPointer(event);
    setIsResizing(false);
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: event.clientX,
      mouseY: event.clientY,
      right: panelPos.x,
      top: panelPos.y,
    };
    return true;
  }, [enableDrag, isPanelMaximized, panelPos.x, panelPos.y]);

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (event: PointerEvent) => {
      const deltaX = dragStartRef.current.mouseX - event.clientX;
      const deltaY = event.clientY - dragStartRef.current.mouseY;

      const newRight = Math.max(
        10,
        Math.min(window.innerWidth - panelSize.width - 10, dragStartRef.current.right + deltaX),
      );
      const newTop = Math.max(
        10,
        Math.min(window.innerHeight - panelSize.height - 10, dragStartRef.current.top + deltaY),
      );

      setPanelPos({ x: newRight, y: newTop });
      if (preMinimizePanelStateRef.current) {
        preMinimizePanelStateRef.current = {
          ...preMinimizePanelStateRef.current,
          pos: { x: newRight, y: newTop },
        };
      }
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointercancel', handlePointerUp);
    window.addEventListener('blur', handlePointerUp);
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerUp);
      window.removeEventListener('blur', handlePointerUp);
    };
  }, [isDragging, panelSize.height, panelSize.width]);

  const startResize = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (!enableResize || isPanelMaximized || isPanelMinimized) return;

    event.preventDefault();
    event.stopPropagation();
    capturePanelPointer(event);
    setIsDragging(false);
    setIsResizing(true);
    resizeStartRef.current = {
      mouseX: event.clientX,
      mouseY: event.clientY,
      width: panelSize.width,
      height: panelSize.height,
      right: panelPos.x,
      top: panelPos.y,
    };
  }, [enableResize, isPanelMaximized, isPanelMinimized, panelPos.x, panelSize.height, panelSize.width]);

  useEffect(() => {
    if (!isResizing) return;

    const handlePointerMove = (event: PointerEvent) => {
      const deltaX = event.clientX - resizeStartRef.current.mouseX;
      const deltaY = event.clientY - resizeStartRef.current.mouseY;

      const maxHeight = window.innerHeight - resizeStartRef.current.top - 10;
      const newWidth = Math.max(
        bounds.minWidth,
        Math.min(bounds.maxWidth, resizeStartRef.current.width + deltaX),
      );
      const widthDelta = newWidth - resizeStartRef.current.width;
      const newRight = Math.max(
        10,
        Math.min(window.innerWidth - newWidth - 10, resizeStartRef.current.right - widthDelta),
      );
      const newHeight = Math.max(bounds.minHeight, Math.min(maxHeight, resizeStartRef.current.height + deltaY));

      setPanelSize({ width: newWidth, height: newHeight });
      setPanelPos((pos) => ({ ...pos, x: newRight }));
    };

    const handlePointerUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointercancel', handlePointerUp);
    window.addEventListener('blur', handlePointerUp);
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerUp);
      window.removeEventListener('blur', handlePointerUp);
    };
  }, [bounds.maxWidth, bounds.minHeight, bounds.minWidth, isResizing]);

  const panelCursor = !enableDrag && !enableResize
    ? 'default'
    : isPanelMaximized
      ? 'default'
      : isDragging
        ? 'grabbing'
        : isResizing
          ? 'se-resize'
          : enableDrag
            ? 'grab'
            : 'default';

  return {
    panelPos,
    panelSize,
    isDragging,
    isResizing,
    isPanelMaximized,
    isPanelMinimized,
    panelCursor,
    togglePanelMaximize,
    minimizePanel,
    restorePanel,
    startDrag,
    startResize,
  };
}
