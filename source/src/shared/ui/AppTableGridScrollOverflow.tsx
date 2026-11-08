import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import {
  applyAppTableGridHorizontalScrollOffset,
  normalizeAppTableGridHorizontalScrollOffset,
  resolveHorizontalThumbDragDelta,
} from '../lib/appTableGridHorizontalScroll';
import {
  APP_TABLE_GRID_OVERLAY_SCROLLBAR_SIZE_PX,
  computeOverlayScrollbarAxisMetrics,
  scrollOffsetFromThumbDrag,
  type OverlayScrollbarAxisMetrics,
} from './appTableGridOverlayScrollbars';

/**
 * NN/G: when a table scrolls horizontally, the last visible column must look
 * cut off so users discover more data. A trailing fade is that affordance.
 */
export const APP_TABLE_GRID_SCROLL_OVERFLOW_FADE_CLASS =
  'pointer-events-none absolute inset-y-0 end-0 z-[18] w-8 bg-gradient-to-l from-white to-transparent';

export function useTableScrollOverflowHint(
  scrollRef: React.RefObject<HTMLElement | null>,
  enabled: boolean,
) {
  const [showEndFade, setShowEndFade] = useState(false);

  useLayoutEffect(() => {
    if (!enabled) {
      setShowEndFade(false);
      return;
    }
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    const update = () => {
      const overflow = element.scrollWidth - element.clientWidth;
      if (overflow <= 4) {
        setShowEndFade(false);
        return;
      }
      const remaining = overflow - normalizeAppTableGridHorizontalScrollOffset(element);
      setShowEndFade(remaining > 4);
    };

    update();
    element.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      element.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [enabled, scrollRef]);

  return showEndFade;
}

type AppTableGridScrollOverflowFrameProps = {
  enabled: boolean;
  showEndFade: boolean;
  className?: string;
  children: React.ReactNode;
};

export const AppTableGridScrollOverflowFrame: React.FC<AppTableGridScrollOverflowFrameProps> = ({
  enabled,
  showEndFade,
  className,
  children,
}) => {
  if (!enabled) {
    return className ? <div className={className}>{children}</div> : <>{children}</>;
  }

  return (
    <div className={cn('relative min-h-0 min-w-0 flex-1', className)}>
      {children}
      {showEndFade ? <div aria-hidden className={APP_TABLE_GRID_SCROLL_OVERFLOW_FADE_CLASS} /> : null}
    </div>
  );
};

const EMPTY_AXIS: OverlayScrollbarAxisMetrics = {
  visible: false,
  thumbSize: 0,
  thumbOffset: 0,
};

const OVERLAY_THUMB_CLASS = cn(
  'pointer-events-auto absolute rounded-full',
  'bg-[var(--color-ink-a14)] hover:bg-[var(--color-ink-a22)] active:bg-[var(--color-ink-a24)]',
  'transition-[background-color] duration-150',
);

type OverlayAxis = 'vertical' | 'horizontal';

function readOverlayAxisMetrics(element: HTMLElement, axis: OverlayAxis): OverlayScrollbarAxisMetrics {
  if (axis === 'vertical') {
    return computeOverlayScrollbarAxisMetrics(
      element.scrollHeight,
      element.clientHeight,
      element.scrollTop,
    );
  }
  return computeOverlayScrollbarAxisMetrics(
    element.scrollWidth,
    element.clientWidth,
    normalizeAppTableGridHorizontalScrollOffset(element),
  );
}

type AppTableGridOverlayScrollbarsProps = {
  viewportRef: React.RefObject<HTMLElement | null>;
};

/** Visible overlay thumbs (`z-[30]`) — native bars stay hidden on the viewport. */
export const AppTableGridOverlayScrollbars: React.FC<AppTableGridOverlayScrollbarsProps> = ({
  viewportRef,
}) => {
  const [vertical, setVertical] = useState<OverlayScrollbarAxisMetrics>(EMPTY_AXIS);
  const [horizontal, setHorizontal] = useState<OverlayScrollbarAxisMetrics>(EMPTY_AXIS);
  const dragRef = useRef<{
    axis: OverlayAxis;
    startPointer: number;
    startScroll: number;
  } | null>(null);

  const sync = useCallback(() => {
    const element = viewportRef.current;
    if (!element) {
      setVertical(EMPTY_AXIS);
      setHorizontal(EMPTY_AXIS);
      return;
    }
    setVertical(readOverlayAxisMetrics(element, 'vertical'));
    setHorizontal(readOverlayAxisMetrics(element, 'horizontal'));
  }, [viewportRef]);

  useLayoutEffect(() => {
    sync();
    const element = viewportRef.current;
    if (!element) {
      return;
    }
    element.addEventListener('scroll', sync, { passive: true });
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => sync())
      : null;
    observer?.observe(element);
    const innerTable = element.querySelector('table');
    if (innerTable) {
      observer?.observe(innerTable);
    }
    return () => {
      element.removeEventListener('scroll', sync);
      observer?.disconnect();
    };
  }, [sync, viewportRef]);

  const onThumbPointerDown = useCallback((axis: OverlayAxis) => (event: React.PointerEvent<HTMLDivElement>) => {
    const element = viewportRef.current;
    if (!element) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = {
      axis,
      startPointer: axis === 'vertical' ? event.clientY : event.clientX,
      startScroll: axis === 'vertical'
        ? element.scrollTop
        : normalizeAppTableGridHorizontalScrollOffset(element),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [viewportRef]);

  const onThumbPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const element = viewportRef.current;
    if (!drag || !element) {
      return;
    }
    const pointer = drag.axis === 'vertical' ? event.clientY : event.clientX;
    const delta = pointer - drag.startPointer;
    if (drag.axis === 'vertical') {
      const metrics = readOverlayAxisMetrics(element, 'vertical');
      element.scrollTop = scrollOffsetFromThumbDrag(
        delta,
        element.clientHeight,
        metrics.thumbSize,
        element.scrollHeight,
        element.clientHeight,
        drag.startScroll,
      );
    } else {
      const metrics = readOverlayAxisMetrics(element, 'horizontal');
      const dragDelta = resolveHorizontalThumbDragDelta(element, delta);
      applyAppTableGridHorizontalScrollOffset(
        element,
        scrollOffsetFromThumbDrag(
          dragDelta,
          element.clientWidth,
          metrics.thumbSize,
          element.scrollWidth,
          element.clientWidth,
          drag.startScroll,
        ),
      );
    }
  }, [viewportRef]);

  const onThumbPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      dragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  }, []);

  if (!vertical.visible && !horizontal.visible) {
    return null;
  }

  const sizePx = APP_TABLE_GRID_OVERLAY_SCROLLBAR_SIZE_PX;

  return (
    <>
      {vertical.visible ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-1 end-0 z-[30] w-[9px]"
          data-table-grid-overlay-scrollbar="vertical"
        >
          <div
            role="presentation"
            className={cn(OVERLAY_THUMB_CLASS, 'end-0.5')}
            style={{
              width: sizePx,
              height: vertical.thumbSize,
              top: vertical.thumbOffset,
            }}
            onPointerDown={onThumbPointerDown('vertical')}
            onPointerMove={onThumbPointerMove}
            onPointerUp={onThumbPointerUp}
            onPointerCancel={onThumbPointerUp}
          />
        </div>
      ) : null}
      {horizontal.visible ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-1 bottom-0 z-[30] h-[9px]"
          data-table-grid-overlay-scrollbar="horizontal"
        >
          <div
            role="presentation"
            className={cn(OVERLAY_THUMB_CLASS, 'bottom-0.5')}
            style={{
              height: sizePx,
              width: horizontal.thumbSize,
              insetInlineStart: `${horizontal.thumbOffset}px`,
            }}
            onPointerDown={onThumbPointerDown('horizontal')}
            onPointerMove={onThumbPointerMove}
            onPointerUp={onThumbPointerUp}
            onPointerCancel={onThumbPointerUp}
          />
        </div>
      ) : null}
    </>
  );
};

export type AppScrollOverlayHostProps = {
  children: React.ReactNode;
  className?: string;
  scrollClassName?: string;
  'data-testid'?: string;
};

/** Bounded overflow with hidden native bars + overlay thumbs (default platform scroll). */
export const AppScrollOverlayHost: React.FC<AppScrollOverlayHostProps> = ({
  children,
  className,
  scrollClassName,
  'data-testid': dataTestId,
}) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  return (
    <div className={cn('relative flex min-h-0 min-w-0 flex-1 flex-col', className)}>
      <div
        ref={scrollRef}
        className={cn('min-h-0 min-w-0 overflow-auto app-scroll-overlay', scrollClassName)}
        data-testid={dataTestId}
        data-scroll-overlay-host=""
      >
        {children}
      </div>
      <AppTableGridOverlayScrollbars viewportRef={scrollRef} />
    </div>
  );
};
