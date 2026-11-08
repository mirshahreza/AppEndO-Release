import { arrayMove } from '@dnd-kit/sortable';
import { describe, expect, it } from 'vitest';
import {
  createDashboardOverlayLockModifier,
  readDashboardDragOrigin,
  readDashboardWidgetMoveRect,
  resolveDashboardDragOverlayRect,
  resolveDashboardWidgetMoveIndex,
} from '../dashboardWidgetDnd';

const rect = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  width,
  height,
});

describe('resolveDashboardWidgetMoveIndex', () => {
  const order = ['health', 'my-links', 'feedback'];

  it('inserts after a neighbor on the trailing side', () => {
    expect(resolveDashboardWidgetMoveIndex(
      order,
      'health',
      'my-links',
      rect(400, 0, 200, 80),
      rect(200, 0, 200, 80),
    )).toBe(1);
  });

  it('inserts before a neighbor on the leading side', () => {
    expect(resolveDashboardWidgetMoveIndex(
      order,
      'feedback',
      'my-links',
      rect(0, 0, 120, 80),
      rect(200, 0, 200, 80),
    )).toBe(1);
  });

  it('uses vertical side when the drop is above or below', () => {
    expect(resolveDashboardWidgetMoveIndex(
      order,
      'health',
      'feedback',
      rect(0, 240, 200, 80),
      rect(0, 80, 200, 80),
    )).toBe(2);
    expect(resolveDashboardWidgetMoveIndex(
      order,
      'feedback',
      'health',
      rect(0, 0, 200, 80),
      rect(0, 160, 200, 80),
    )).toBe(0);
  });

  it('flips the horizontal insert side in RTL', () => {
    expect(resolveDashboardWidgetMoveIndex(
      order,
      'health',
      'my-links',
      rect(0, 0, 200, 80),
      rect(200, 0, 200, 80),
      true,
    )).toBe(1);
  });

  it('keeps the item in place when ids are unknown', () => {
    expect(resolveDashboardWidgetMoveIndex(order, 'missing', 'my-links', rect(0, 0, 10, 10), rect(0, 0, 10, 10))).toBe(-1);
  });

  it('moves a leading tile after its neighbor', () => {
    const nextIndex = resolveDashboardWidgetMoveIndex(
      order,
      'health',
      'my-links',
      rect(400, 0, 200, 80),
      rect(200, 0, 200, 80),
    );
    expect(arrayMove([...order], 0, nextIndex)).toEqual(['my-links', 'health', 'feedback']);
  });
});

describe('readDashboardWidgetMoveRect', () => {
  it('reads a plain rect or a ref current', () => {
    expect(readDashboardWidgetMoveRect(rect(1, 2, 3, 4))).toEqual(rect(1, 2, 3, 4));
    expect(readDashboardWidgetMoveRect({ current: rect(5, 6, 7, 8) })).toEqual(rect(5, 6, 7, 8));
    expect(readDashboardWidgetMoveRect(null)).toBeNull();
  });
});

describe('dashboard drag overlay lock', () => {
  it('records the grab point on the source tile', () => {
    expect(readDashboardDragOrigin(
      { clientX: 140, clientY: 90 } as PointerEvent,
      rect(100, 40, 200, 80),
    )).toEqual({
      left: 100,
      top: 40,
      width: 200,
      height: 80,
      grabOffsetX: 40,
      grabOffsetY: 50,
    });
  });

  it('moves the overlay by the pointer delta from that origin', () => {
    const origin = readDashboardDragOrigin(
      { clientX: 140, clientY: 90 } as PointerEvent,
      rect(100, 40, 200, 80),
    );
    expect(origin).not.toBeNull();
    expect(resolveDashboardDragOverlayRect(origin!, { x: 30, y: -10 })).toEqual(rect(130, 30, 200, 80));
  });

  it('cancels source-node drift so the overlay stays on the grab point', () => {
    const origin = readDashboardDragOrigin(
      { clientX: 140, clientY: 90 } as PointerEvent,
      rect(100, 40, 200, 80),
    );
    const modifier = createDashboardOverlayLockModifier(() => origin);
    expect(modifier({
      draggingNodeRect: { left: 180, top: 120, width: 200, height: 80, right: 380, bottom: 200 },
      transform: { x: 30, y: -10, scaleX: 1.2, scaleY: 0.8 },
    } as never)).toEqual({
      x: -50,
      y: -90,
      scaleX: 1,
      scaleY: 1,
    });
  });
});
