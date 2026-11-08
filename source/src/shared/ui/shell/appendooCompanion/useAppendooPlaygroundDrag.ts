import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { APPENDOO_COMPANION_DRAG_THRESHOLD_PX } from './appendooCompanion.types';

export type AppendooPlaygroundPoint = {
  x: number;
  y: number;
};

export const clampAppendooPlaygroundPoint = (x: number, y: number): AppendooPlaygroundPoint => ({
  x: Math.min(100, Math.max(0, x)),
  y: Math.min(100, Math.max(0, y)),
});

export const shiftAppendooPlaygroundPoint = (
  origin: AppendooPlaygroundPoint,
  dxPx: number,
  dyPx: number,
  board: { width: number; height: number },
): AppendooPlaygroundPoint => clampAppendooPlaygroundPoint(
  origin.x + (board.width > 0 ? (dxPx / board.width) * 100 : 0),
  origin.y + (board.height > 0 ? (dyPx / board.height) * 100 : 0),
);

type DragSession = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  moved: boolean;
};

export const useAppendooPlaygroundDrag = (
  boardRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  restPoint: AppendooPlaygroundPoint,
  playing = false,
  onGrab?: () => void,
) => {
  const [held, setHeld] = useState<AppendooPlaygroundPoint | null>(null);
  const [dragging, setDragging] = useState(false);
  const sessionRef = useRef<DragSession | null>(null);
  const restRef = useRef(restPoint);
  const heldRef = useRef(held);
  restRef.current = restPoint;
  heldRef.current = held;

  useEffect(() => {
    if (enabled && !playing) return;
    setHeld(null);
    setDragging(false);
    sessionRef.current = null;
  }, [enabled, playing]);

  const livePoint = enabled && held ? held : restPoint;

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (!enabled || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    onGrab?.();
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const origin = heldRef.current ?? restRef.current;
    sessionRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: origin.x,
      originY: origin.y,
      moved: false,
    };
    setHeld(origin);
  }, [enabled, onGrab]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const session = sessionRef.current;
    const board = boardRef.current;
    if (!enabled || !session || session.pointerId !== event.pointerId || !board) return;
    const dx = event.clientX - session.startX;
    const dy = event.clientY - session.startY;
    if (!session.moved && Math.hypot(dx, dy) < APPENDOO_COMPANION_DRAG_THRESHOLD_PX) return;
    session.moved = true;
    setDragging(true);
    const rect = board.getBoundingClientRect();
    setHeld(shiftAppendooPlaygroundPoint(
      { x: session.originX, y: session.originY },
      dx,
      dy,
      rect,
    ));
  }, [boardRef, enabled]);

  const finish = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const session = sessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    sessionRef.current = null;
    if (
      typeof event.currentTarget.hasPointerCapture === 'function'
      && event.currentTarget.hasPointerCapture(event.pointerId)
      && typeof event.currentTarget.releasePointerCapture === 'function'
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
    if (!session.moved) setHeld(null);
  }, []);

  return {
    point: livePoint,
    dragging,
    onPointerDown,
    onPointerMove,
    onPointerUp: finish,
    onPointerCancel: finish,
  };
};
