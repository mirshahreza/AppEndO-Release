/**
 * CRM plan زیرفاز 3c-pre acceptance: "drag a card → drop on a terminal column → Cancel in
 * ConfirmDialogShell → the board must return EXACTLY to its pre-drag arrangement."
 *
 * Bug (documented in plans/packages/todo/crm-package/p-packages-crm.md §کار پایه‌ای Base
 * Components before this fix): `DesignerVizKanban` keeps the optimistic post-drop board and
 * only re-syncs to the resolved/bound `data` when `isBoardAheadOfResolved` says the local board
 * is NOT ahead — but after an optimistic drop, the local board IS always "ahead" of a `data`
 * prop that never actually changed (no server mutation happened on Cancel), so the effect never
 * fires and the card stays in the wrong column forever, even across re-renders with identical
 * `data`. Fixed by adding an explicit `revertSignal` prop that force-reverts to the resolved
 * board regardless of the "ahead" heuristic — the confirm-dialog's Cancel handler bumps it.
 */
// @vitest-environment jsdom

import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import { DesignerVizKanban } from '../DesignerRuntimeKanban';

let latestDndHandlers: {
  onDragStart?: (event: DragStartEvent) => void;
  onDragOver?: (event: DragOverEvent) => void;
  onDragEnd?: (event: DragEndEvent) => void;
} = {};

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({
    children,
    onDragStart,
    onDragOver,
    onDragEnd,
  }: {
    children: React.ReactNode;
    onDragStart?: (event: DragStartEvent) => void;
    onDragOver?: (event: DragOverEvent) => void;
    onDragEnd?: (event: DragEndEvent) => void;
  }) => {
    latestDndHandlers = { onDragStart, onDragOver, onDragEnd };
    return <>{children}</>;
  },
  DragOverlay: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PointerSensor: function PointerSensor() {},
  KeyboardSensor: function KeyboardSensor() {},
  closestCorners: () => null,
  useDroppable: () => ({ setNodeRef: () => undefined }),
  useSensor: () => ({}),
  useSensors: () => ([]),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  arrayMove: (items: unknown[], from: number, to: number) => {
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  },
  defaultAnimateLayoutChanges: () => ({}),
  sortableKeyboardCoordinates: () => ({ x: 0, y: 0 }),
  useSortable: ({ id }: { id: string }) => ({
    attributes: { 'data-sortable-id': id },
    listeners: {},
    setNodeRef: () => undefined,
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
  verticalListSortingStrategy: {},
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Translate: { toString: () => '' } },
}));

afterEach(() => {
  cleanup();
  latestDndHandlers = {};
});

const BOARD_DATA = JSON.stringify({
  columns: [
    {
      id: 'new',
      title: 'New',
      cards: [{ id: 'opp-1', title: 'Acme deal' }],
    },
    {
      id: 'won',
      title: 'Won',
      cards: [],
    },
  ],
});

const makeDragStart = (cardId: string): DragStartEvent => ({
  active: { id: cardId, data: { current: {} }, rect: { current: { initial: null, translated: null } } },
} as unknown as DragStartEvent);

const makeDragOver = (cardId: string, overId: string): DragOverEvent => ({
  active: makeDragStart(cardId).active,
  over: { id: overId, data: { current: {} }, rect: {} },
} as unknown as DragOverEvent);

const makeDragEnd = (cardId: string, overId: string): DragEndEvent => ({
  active: makeDragStart(cardId).active,
  over: { id: overId, data: { current: {} }, rect: {} },
} as unknown as DragEndEvent);

describe('DesignerVizKanban — Cancel reverts a dropped card (3c-pre acceptance)', () => {
  it('drag New → Won, then bump revertSignal (Cancel) → board returns to the pre-drag arrangement', () => {
    const onCardMove = vi.fn();
    const { rerender } = render(
      <DesignerVizKanban data={BOARD_DATA} interactive onCardMove={onCardMove} revertSignal={0} />,
    );

    // Pre-drag sanity: card starts in "New".
    const newColumnBefore = screen.getByText('New').closest('div.rounded-lg');
    expect(newColumnBefore?.textContent).toContain('Acme deal');

    // Drag New -> Won.
    latestDndHandlers.onDragStart?.(makeDragStart('opp-1'));
    latestDndHandlers.onDragOver?.(makeDragOver('opp-1', 'won'));
    latestDndHandlers.onDragEnd?.(makeDragEnd('opp-1', 'won'));
    expect(onCardMove).toHaveBeenCalledTimes(1);

    rerender(<DesignerVizKanban data={BOARD_DATA} interactive onCardMove={onCardMove} revertSignal={0} />);
    const wonColumnAfterDrop = screen.getByText('Won').closest('div.rounded-lg');
    expect(wonColumnAfterDrop?.textContent).toContain('Acme deal');
    const newColumnAfterDrop = screen.getByText('New').closest('div.rounded-lg');
    expect(newColumnAfterDrop?.textContent).not.toContain('Acme deal');

    // Cancel: caller bumps revertSignal. `data` is unchanged (no mutation happened), so without
    // the fix `isBoardAheadOfResolved` would keep the post-drop state forever.
    rerender(<DesignerVizKanban data={BOARD_DATA} interactive onCardMove={onCardMove} revertSignal={1} />);

    const newColumnAfterCancel = screen.getByText('New').closest('div.rounded-lg');
    const wonColumnAfterCancel = screen.getByText('Won').closest('div.rounded-lg');
    expect(newColumnAfterCancel?.textContent).toContain('Acme deal');
    expect(wonColumnAfterCancel?.textContent).not.toContain('Acme deal');
  });
});
