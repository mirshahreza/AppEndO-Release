import {
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type ClientRect,
  type Modifier,
} from '@dnd-kit/core';
import type { SortingStrategy } from '@dnd-kit/sortable';

export type DashboardWidgetMoveRect = Pick<ClientRect, 'left' | 'top' | 'width' | 'height'>;

/**
 * Keep source tiles still while a DragOverlay follows the pointer.
 * Mixed-width Home tiles must not scale to the drop target.
 */
export const dashboardIdleSortingStrategy: SortingStrategy = () => ({
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
});

/** Ignore the source tile so a wide card does not trap the pointer on itself. */
export const detectDashboardWidgetCollision: CollisionDetection = (args) => {
  const droppableContainers = args.droppableContainers.filter(
    (container) => container.id !== args.active.id,
  );
  const nextArgs = { ...args, droppableContainers };
  const pointerHits = pointerWithin(nextArgs);
  if (pointerHits.length > 0) {
    return pointerHits;
  }
  return rectIntersection(nextArgs);
};

export type DashboardDragOrigin = DashboardWidgetMoveRect & {
  grabOffsetX: number;
  grabOffsetY: number;
};

const readPointerCoordinates = (event: Event | null | undefined): { x: number; y: number } | null => {
  if (!event) {
    return null;
  }
  if ('touches' in event) {
    const touch = (event as TouchEvent).touches[0] ?? (event as TouchEvent).changedTouches[0];
    if (!touch) {
      return null;
    }
    return { x: touch.clientX, y: touch.clientY };
  }
  if ('clientX' in event && 'clientY' in event) {
    const pointer = event as PointerEvent;
    if (typeof pointer.clientX === 'number' && typeof pointer.clientY === 'number') {
      return { x: pointer.clientX, y: pointer.clientY };
    }
  }
  return null;
};

export const readDashboardDragOrigin = (
  activatorEvent: Event | null | undefined,
  initialRect: DashboardWidgetMoveRect | null | undefined,
): DashboardDragOrigin | null => {
  if (!initialRect || initialRect.width <= 0 || initialRect.height <= 0) {
    return null;
  }
  const pointer = readPointerCoordinates(activatorEvent);
  if (!pointer) {
    return null;
  }
  return {
    ...initialRect,
    grabOffsetX: pointer.x - initialRect.left,
    grabOffsetY: pointer.y - initialRect.top,
  };
};

export const resolveDashboardDragOverlayRect = (
  origin: DashboardDragOrigin,
  delta: { x: number; y: number },
): DashboardWidgetMoveRect => ({
  left: origin.left + delta.x,
  top: origin.top + delta.y,
  width: origin.width,
  height: origin.height,
});

/**
 * Keep the overlay glued to the grab point even if live packing moves the source node.
 */
export const createDashboardOverlayLockModifier = (
  getOrigin: () => DashboardDragOrigin | null,
): Modifier => ({ draggingNodeRect, transform }) => {
  const origin = getOrigin();
  if (!origin || !draggingNodeRect) {
    return { ...transform, scaleX: 1, scaleY: 1 };
  }
  return {
    x: transform.x + (origin.left - draggingNodeRect.left),
    y: transform.y + (origin.top - draggingNodeRect.top),
    scaleX: 1,
    scaleY: 1,
  };
};

export const readDashboardWidgetMoveRect = (value: unknown): DashboardWidgetMoveRect | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const source = record.current && typeof record.current === 'object'
    ? record.current as Record<string, unknown>
    : record;
  if (
    typeof source.left !== 'number'
    || typeof source.top !== 'number'
    || typeof source.width !== 'number'
    || typeof source.height !== 'number'
  ) {
    return null;
  }

  return {
    left: source.left,
    top: source.top,
    width: source.width,
    height: source.height,
  };
};

const midX = (rect: DashboardWidgetMoveRect): number => rect.left + rect.width / 2;
const midY = (rect: DashboardWidgetMoveRect): number => rect.top + rect.height / 2;

export const resolveDashboardWidgetMoveIndex = (
  order: readonly string[],
  activeId: string,
  overId: string,
  activeRect: DashboardWidgetMoveRect,
  overRect: DashboardWidgetMoveRect,
  rtl = false,
): number => {
  const activeIndex = order.indexOf(activeId);
  const overIndex = order.indexOf(overId);
  if (activeIndex < 0 || overIndex < 0) {
    return activeIndex;
  }

  const dx = Math.abs(midX(activeRect) - midX(overRect));
  const dy = Math.abs(midY(activeRect) - midY(overRect));
  const placeAfter = dx >= dy
    ? (rtl ? midX(activeRect) < midX(overRect) : midX(activeRect) > midX(overRect))
    : midY(activeRect) > midY(overRect);

  const nextIndex = placeAfter
    ? (activeIndex < overIndex ? overIndex : overIndex + 1)
    : (activeIndex < overIndex ? overIndex - 1 : overIndex);

  return Math.min(order.length - 1, Math.max(0, nextIndex));
};

const SELECTION_ALLOWED_SELECTOR = 'input, textarea, select, [contenteditable], [contenteditable="true"]';

/** Stops a Home drag from painting a page-wide text selection. */
export const lockDashboardTextSelection = (): (() => void) => {
  if (typeof document === 'undefined') {
    return () => {};
  }
  document.getSelection()?.removeAllRanges();
  const blockSelectStart = (event: Event) => {
    const target = event.target;
    if (target instanceof Element && target.closest(SELECTION_ALLOWED_SELECTOR)) {
      return;
    }
    event.preventDefault();
  };
  document.addEventListener('selectstart', blockSelectStart);
  return () => {
    document.removeEventListener('selectstart', blockSelectStart);
  };
};
