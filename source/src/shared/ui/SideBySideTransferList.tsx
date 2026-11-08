import React, { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '../../lib/utils';
import type { AppSurfaceBoxTone } from './surfaceClasses';

export type SideBySideTransferColumn = {
  key: string;
  label: string;
  className?: string;
};

export type SideBySideTransferItem = {
  id: string;
  cells: React.ReactNode[];
};

export type SideBySideTransferListProps = {
  listId: string;
  leftTitle: string;
  rightTitle: string;
  leftHint?: string;
  rightHint?: string;
  columns: SideBySideTransferColumn[];
  leftItems: SideBySideTransferItem[];
  rightItems: SideBySideTransferItem[];
  onMoveToRight: (id: string) => void;
  onMoveToLeft: (id: string) => void;
  leftEmptyMessage?: string;
  rightEmptyMessage?: string;
  tone?: AppSurfaceBoxTone;
  className?: string;
  /** Shorter panels for height-constrained wizard steps. */
  compact?: boolean;
};

type TransferPanel = 'left' | 'right';

const PANEL_HEADER_TONE_CLASS: Record<AppSurfaceBoxTone, string> = {
  cyan: 'bg-cyan-50/80 text-cyan-900 border-cyan-100',
  violet: 'bg-violet-50/80 text-violet-900 border-violet-100',
  emerald: 'bg-emerald-50/80 text-emerald-900 border-emerald-100',
  indigo: 'bg-indigo-50/80 text-indigo-900 border-indigo-100',
  amber: 'bg-amber-50/80 text-amber-900 border-amber-100',
  rose: 'bg-rose-50/80 text-rose-900 border-rose-100',
  slate: 'bg-slate-50 text-slate-700 border-slate-200',
};

type TransferRowProps = {
  item: SideBySideTransferItem;
  columns: SideBySideTransferColumn[];
  panel: TransferPanel;
  onDoubleClick: () => void;
};

function TransferRow({
  item,
  columns,
  panel,
  onDoubleClick,
}: TransferRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: item.id,
    data: { panel, item },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        'cursor-pointer select-none hover:bg-slate-50',
        isDragging && 'opacity-40',
      )}
      onDoubleClick={onDoubleClick}
      {...attributes}
      {...listeners}
    >
      {item.cells.map((cell, index) => (
        <td key={`${item.id}-${index}`} className="px-2 py-1.5 text-slate-700">
          {cell}
        </td>
      ))}
      {columns.length > item.cells.length
        ? Array.from({ length: columns.length - item.cells.length }).map((_, index) => (
          <td key={`${item.id}-pad-${index}`} className="px-2 py-1.5" />
        ))
        : null}
    </tr>
  );
}

type TransferPanelProps = {
  panel: TransferPanel;
  droppableId: string;
  title: string;
  hint?: string;
  count: number;
  tone: AppSurfaceBoxTone;
  columns: SideBySideTransferColumn[];
  items: SideBySideTransferItem[];
  emptyMessage: string;
  onMoveOut: (id: string) => void;
  compact?: boolean;
};

function TransferPanel({
  panel,
  droppableId,
  title,
  hint,
  count,
  tone,
  columns,
  items,
  emptyMessage,
  onMoveOut,
  compact = false,
}: TransferPanelProps) {
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className={cn('rounded-t-md border border-b-0 px-3 py-2', PANEL_HEADER_TONE_CLASS[tone])}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider">{title}</span>
          <span className="text-[11px] font-semibold tabular-nums opacity-80">{count}</span>
        </div>
        {hint ? (
          <p className="mt-[2px] text-[11px] font-normal normal-case tracking-normal opacity-80 ps-[4px]">
            {hint}
          </p>
        ) : null}
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 overflow-auto rounded-b-md border border-slate-200 bg-white transition-colors',
          compact ? 'min-h-0' : 'min-h-[10rem]',
          isOver && 'border-slate-400 bg-slate-50/80 ring-1 ring-slate-300/60',
        )}
      >
        {items.length === 0 ? (
          <div className={cn(
            'flex h-full items-center justify-center px-4 py-4 text-center text-xs text-slate-500',
            compact ? 'min-h-[5rem]' : 'min-h-[10rem]',
          )}>
            {emptyMessage}
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 border-b border-slate-200 bg-slate-50">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={column.className ?? 'px-2 py-2 text-start font-bold text-[10px] uppercase tracking-wider text-slate-500'}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <TransferRow
                  key={item.id}
                  item={item}
                  columns={columns}
                  panel={panel}
                  onDoubleClick={() => onMoveOut(item.id)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function SideBySideTransferList({
  listId,
  leftTitle,
  rightTitle,
  leftHint,
  rightHint,
  columns,
  leftItems,
  rightItems,
  onMoveToRight,
  onMoveToLeft,
  leftEmptyMessage = 'No items.',
  rightEmptyMessage = 'No items.',
  tone = 'slate',
  className,
  compact = false,
}: SideBySideTransferListProps) {
  const [activeItem, setActiveItem] = useState<SideBySideTransferItem | null>(null);

  const leftDroppableId = `${listId}-left`;
  const rightDroppableId = `${listId}-right`;

  const itemLookup = useMemo(() => {
    const map = new Map<string, SideBySideTransferItem>();
    leftItems.forEach((item) => map.set(item.id, item));
    rightItems.forEach((item) => map.set(item.id, item));
    return map;
  }, [leftItems, rightItems]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const item = itemLookup.get(String(event.active.id));
    setActiveItem(item ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveItem(null);
    const { active, over } = event;
    if (!over) return;

    const fromPanel = active.data.current?.panel as TransferPanel | undefined;
    const overId = String(over.id);
    let toPanel: TransferPanel | null = overId === leftDroppableId
      ? 'left'
      : overId === rightDroppableId
        ? 'right'
        : (over.data.current?.panel as TransferPanel | undefined) ?? null;

    if (!fromPanel || !toPanel || fromPanel === toPanel) return;

    const itemId = String(active.id);
    if (toPanel === 'right') {
      onMoveToRight(itemId);
    } else {
      onMoveToLeft(itemId);
    }
  };

  const handleDragCancel = () => {
    setActiveItem(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className={cn('grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2', className)}>
        <TransferPanel
          panel="left"
          droppableId={leftDroppableId}
          title={leftTitle}
          hint={leftHint}
          count={leftItems.length}
          tone={tone}
          columns={columns}
          items={leftItems}
          emptyMessage={leftEmptyMessage}
          onMoveOut={onMoveToRight}
          compact={compact}
        />
        <TransferPanel
          panel="right"
          droppableId={rightDroppableId}
          title={rightTitle}
          hint={rightHint}
          count={rightItems.length}
          tone={tone}
          columns={columns}
          items={rightItems}
          emptyMessage={rightEmptyMessage}
          onMoveOut={onMoveToLeft}
          compact={compact}
        />
      </div>

      <DragOverlay dropAnimation={null}>
        {activeItem ? (
          <div className="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2 text-xs shadow-md">
            <span className="truncate text-slate-700">{activeItem.cells[0] ?? activeItem.id}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
