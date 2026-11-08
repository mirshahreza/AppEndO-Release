/**
 * Bug found (per-element gap #14 / Phase 43): `viz.kanban` rendered as a static board even in the
 * live Preview/export path. Cards could not move between columns, and the widget exposed no event
 * that a mutation/refresh chain could bind to. Fixed in `DesignerRuntimeKanban.tsx`,
 * `designerVizRuntime.tsx`, `bindingEngine.ts`, and `UiKanbanBoard.tsx` by enabling runtime-only
 * drag/drop plus a real `onCardMove` event payload.
 */
// @vitest-environment jsdom

import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import { DesignerVizKanban } from '../DesignerRuntimeKanban';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import { resolveNodeEventBindingTargets } from '../bindingEngine';
import { createDynamicAction } from '../bindingDynamicActionsEngine';

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
      id: 'todo',
      title: 'To Do',
      cards: [{ id: 'task-1', title: 'Draft spec', description: 'Prepare the initial draft.' }],
    },
    {
      id: 'done',
      title: 'Done',
      cards: [],
    },
  ],
});

const makeDragStart = (cardId: string): DragStartEvent => ({
  active: {
    id: cardId,
    data: { current: {} },
    rect: { current: { initial: null, translated: null } },
  },
} as unknown as DragStartEvent);

const makeDragOver = (cardId: string, overId: string): DragOverEvent => ({
  active: makeDragStart(cardId).active,
  over: {
    id: overId,
    data: { current: {} },
    rect: {},
  },
} as unknown as DragOverEvent);

const makeDragEnd = (cardId: string, overId: string): DragEndEvent => ({
  active: makeDragStart(cardId).active,
  over: {
    id: overId,
    data: { current: {} },
    rect: {},
  },
} as unknown as DragEndEvent);

describe('Phase 43 - viz.kanban', () => {
  it('moving a card to another column emits onCardMove with the new column payload', () => {
    const onCardMove = vi.fn();
    render(<DesignerVizKanban data={BOARD_DATA} interactive onCardMove={onCardMove} />);

    latestDndHandlers.onDragStart?.(makeDragStart('task-1'));
    latestDndHandlers.onDragOver?.(makeDragOver('task-1', 'done'));
    latestDndHandlers.onDragEnd?.(makeDragEnd('task-1', 'done'));

    expect(onCardMove).toHaveBeenCalledTimes(1);
    const payload = (onCardMove.mock.calls[0][0] as { target: { value: Record<string, unknown> } }).target.value;
    expect(payload).toMatchObject({
      cardId: 'task-1',
      fromColumnId: 'todo',
      toColumnId: 'done',
      toColumnTitle: 'Done',
      toIndex: 0,
    });
  });

  it('export exposes onCardMove as a bindable event on viz.kanban', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'viz.kanban',
      parentId: state.document.rootNodeId,
    });
    const nodeId = state.document.nodes[state.document.rootNodeId].children[0] as string;
    const refreshAction = createDynamicAction('refreshDataSource');
    refreshAction.dataSourceRef = 'tasks';
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId,
      bindingKey: 'event:onCardMove',
      definition: {
        sourceType: 'static',
        targetEvent: 'onCardMove',
        storeWritePath: 'board.lastMove',
        trueActions: [refreshAction],
      },
    });

    const node = state.document.nodes[nodeId]!;
    expect(resolveNodeEventBindingTargets(node)).toEqual(expect.arrayContaining(['onCardMove']));

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('onCardMove={handleonCardMove_');
    expect(tsx).toContain('handleonCardMove_');
    expect(tsx).toContain(' interactive');
  });

  it('export patches storeWritePath before running onCardMove trueActions', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'viz.kanban',
      parentId: state.document.rootNodeId,
    });
    const nodeId = state.document.nodes[state.document.rootNodeId].children[0] as string;
    const openDialog = createDynamicAction('showHide');
    openDialog.targetNodeId = 'dialog-node';
    openDialog.showHideEffect = 'show';
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId,
      bindingKey: 'event:onCardMove',
      definition: {
        sourceType: 'static',
        targetEvent: 'onCardMove',
        storeWritePath: 'board.lastMove',
        trueActions: [openDialog],
      },
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    const handlerIndex = tsx.indexOf('handleonCardMove_');
    expect(handlerIndex).toBeGreaterThan(-1);
    const handlerSlice = tsx.slice(handlerIndex, handlerIndex + 500);
    expect(handlerSlice).toContain('patchDesignerStore("board.lastMove"');
    expect(handlerSlice.indexOf('patchDesignerStore("board.lastMove"'))
      .toBeLessThan(handlerSlice.indexOf('patchDesignerStore("ui.visibility.'));
  });

  it('enables drag when onCardMove is wired but interactive prop is omitted', () => {
    const onCardMove = vi.fn();
    render(<DesignerVizKanban data={BOARD_DATA} onCardMove={onCardMove} />);

    latestDndHandlers.onDragStart?.(makeDragStart('task-1'));
    latestDndHandlers.onDragOver?.(makeDragOver('task-1', 'done'));
    latestDndHandlers.onDragEnd?.(makeDragEnd('task-1', 'done'));

    expect(onCardMove).toHaveBeenCalledTimes(1);
  });

  it('keeps the optimistic column layout when bound data is still stale after a move', () => {
    const onCardMove = vi.fn();
    const { rerender } = render(
      <DesignerVizKanban data={BOARD_DATA} interactive onCardMove={onCardMove} />,
    );

    latestDndHandlers.onDragStart?.(makeDragStart('task-1'));
    latestDndHandlers.onDragOver?.(makeDragOver('task-1', 'done'));
    latestDndHandlers.onDragEnd?.(makeDragEnd('task-1', 'done'));

    expect(onCardMove).toHaveBeenCalledTimes(1);

    rerender(
      <DesignerVizKanban data={BOARD_DATA} interactive onCardMove={onCardMove} />,
    );

    const todoColumn = screen.getByText('To Do').closest('div.rounded-lg');
    const doneColumn = screen.getByText('Done').closest('div.rounded-lg');
    expect(doneColumn?.textContent).toContain('Draft spec');
    expect(todoColumn?.textContent).not.toContain('Draft spec');
  });
});
