import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { APPENDOO_COMPANION_DRAG_THRESHOLD_PX } from '../appendooCompanion/appendooCompanion.types';
import {
  PAGE_GUIDE_COMPANION_HEIGHT_PX,
  PAGE_GUIDE_COMPANION_WIDTH_PX,
  PAGE_GUIDE_VIEWPORT_MARGIN_PX,
  type PageGuidePoint,
} from './pageGuide.types';

type DragSession = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  moved: boolean;
};

const clampDragPoint = (point: PageGuidePoint): PageGuidePoint => {
  const margin = PAGE_GUIDE_VIEWPORT_MARGIN_PX;
  const maxX = Math.max(margin, window.innerWidth - PAGE_GUIDE_COMPANION_WIDTH_PX - margin);
  const maxY = Math.max(margin, window.innerHeight - PAGE_GUIDE_COMPANION_HEIGHT_PX - margin);
  return {
    x: Math.min(maxX, Math.max(margin, point.x)),
    y: Math.min(maxY, Math.max(margin, point.y)),
  };
};

export const usePageGuideCompanionDrag = (
  originRef: { current: PageGuidePoint },
  onDrop: (point: PageGuidePoint) => void,
) => {
  const [held, setHeld] = useState<PageGuidePoint | null>(null);
  const [dragging, setDragging] = useState(false);
  const sessionRef = useRef<DragSession | null>(null);
  const skipClickRef = useRef(false);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const origin = originRef.current;
    sessionRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: origin.x,
      originY: origin.y,
      moved: false,
    };
    try {
      if (typeof event.currentTarget.setPointerCapture === 'function') {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    } catch {
      // jsdom and detached nodes have no active pointer to capture.
    }
  }, [originRef]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const session = sessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const dx = event.clientX - session.startX;
    const dy = event.clientY - session.startY;
    if (!session.moved && Math.hypot(dx, dy) < APPENDOO_COMPANION_DRAG_THRESHOLD_PX) return;
    session.moved = true;
    setDragging(true);
    setHeld(clampDragPoint({
      x: session.originX + dx,
      y: session.originY + dy,
    }));
  }, []);

  const finish = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const session = sessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    sessionRef.current = null;
    try {
      if (
        typeof event.currentTarget.hasPointerCapture === 'function'
        && event.currentTarget.hasPointerCapture(event.pointerId)
        && typeof event.currentTarget.releasePointerCapture === 'function'
      ) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Capture may already be released.
    }
    const drop = clampDragPoint({
      x: session.originX + (event.clientX - session.startX),
      y: session.originY + (event.clientY - session.startY),
    });
    setHeld(null);
    setDragging(false);
    if (session.moved) {
      skipClickRef.current = true;
      onDrop(drop);
    }
  }, [onDrop]);

  const consumeClick = useCallback((): boolean => {
    if (!skipClickRef.current) return false;
    skipClickRef.current = false;
    return true;
  }, []);

  return {
    held,
    dragging,
    consumeClick,
    onPointerDown,
    onPointerMove,
    onPointerUp: finish,
    onPointerCancel: finish,
  };
};
