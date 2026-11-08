import React, { useEffect, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '../../lib/utils';

export type UiSortableListItem = {
  id: string;
  label: string;
};

export type UiSortableListProps = {
  items: readonly UiSortableListItem[];
  onReorder?: (items: UiSortableListItem[]) => void;
  disabled?: boolean;
  className?: string;
};

const SortableRow: React.FC<{
  item: UiSortableListItem;
  disabled?: boolean;
}> = ({ item, disabled }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5',
        isDragging && 'z-10 border-emerald-300 shadow-sm',
      )}
    >
      <button
        type="button"
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-400 hover:text-slate-600"
        aria-label={`Reorder ${item.label}`}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-0 truncate text-sm text-slate-800">{item.label}</span>
    </li>
  );
};

/** Reorderable list with drag handles — shared @dnd-kit/sortable kit. */
export const UiSortableList: React.FC<UiSortableListProps> = ({
  items,
  onReorder,
  disabled,
  className,
}) => {
  const [rows, setRows] = useState<UiSortableListItem[]>(() => [...items]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    setRows([...items]);
  }, [items]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const from = rows.findIndex((row) => row.id === active.id);
    const to = rows.findIndex((row) => row.id === over.id);
    if (from < 0 || to < 0) {
      return;
    }
    const next = arrayMove(rows, from, to);
    setRows(next);
    onReorder?.(next);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={rows.map((row) => row.id)} strategy={verticalListSortingStrategy}>
        <ul className={cn('flex w-full max-w-sm flex-col gap-1.5', className)}>
          {rows.map((item) => (
            <SortableRow key={item.id} item={item} disabled={disabled} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
};
