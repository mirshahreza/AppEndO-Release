import React from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, RotateCcw, Settings2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  getColumnLayoutLabel,
  reorderColumn,
  resetColumnLayout,
  resolveColumnLayoutOptions,
  toggleColumnVisibility,
  type GridColumnLayoutChangeMeta,
  type GridColumnLayoutState,
} from '../lib/appTableGridColumnLayout';
import type { AppTableGridColumnDef } from '../lib/appTableGridQuery';
import { AppButton } from './AppButton';
import {
  SPLIT_BUTTON_MENU_PANEL_FIXED_CLASS,
  overlayOriginFromFixedMenuStyle,
  useFixedDropDownMenuStyle,
  useSplitButtonMenu,
} from './AppSplitButton';
import { NativeButton } from './NativeButton';
import { overlayMotionDocumentDir, overlayMotionPanelProps } from './overlay-motion/overlayMotion';
import { useCultureT } from '../../core/culture/CultureContext';
import { UiCheckbox } from './HeroFieldControls';
import {
  ICON_ACTION_BUTTON_SM_CLASS,
  ICON_ACTION_CANCEL_CLASS,
} from './surfaceClasses';

export type AppTableGridColumnLayoutControlProps<TRow = unknown> = {
  columns: ReadonlyArray<AppTableGridColumnDef<TRow>>;
  layout: GridColumnLayoutState;
  onLayoutChange: (layout: GridColumnLayoutState, meta: GridColumnLayoutChangeMeta) => void;
  className?: string;
  visible?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type SortableColumnRowProps = {
  column: AppTableGridColumnDef<unknown>;
  layout: GridColumnLayoutState;
  onVisibilityChange: (columnId: string, visible: boolean) => void;
};

function SortableColumnRow({
  column,
  layout,
  onVisibilityChange,
}: SortableColumnRowProps) {
  const options = resolveColumnLayoutOptions(column.layout);
  const isVisible = !layout.hidden.includes(column.id);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
    disabled: !options.reorderable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 rounded-md border border-transparent px-1 py-1.5',
        isDragging && 'border-slate-200 bg-slate-50 shadow-sm',
      )}
    >
      <NativeButton
        type="button"
        className={cn(
          'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border-0 bg-transparent text-slate-400 transition-colors',
          options.reorderable ? 'cursor-grab hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing' : 'cursor-default opacity-40',
        )}
        aria-label={`Reorder ${getColumnLayoutLabel(column)}`}
        disabled={!options.reorderable}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </NativeButton>

      <UiCheckbox
        checked={isVisible}
        disabled={!options.hideable}
        onChange={(event) => onVisibilityChange(column.id, event.target.checked)}
        aria-label={`Show ${getColumnLayoutLabel(column)}`}
      >
        <span className="min-w-0 truncate text-xs font-medium text-slate-700">
          {getColumnLayoutLabel(column)}
        </span>
      </UiCheckbox>
    </div>
  );
}

export function AppTableGridColumnLayoutControl<TRow>({
  columns,
  layout,
  onLayoutChange,
  className,
  visible = false,
  onOpenChange,
}: AppTableGridColumnLayoutControlProps<TRow>) {
  const t = useCultureT();
  const [isOpen, setIsOpen] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const isControlVisible = visible || isOpen;
  const setOpen = React.useCallback((nextOpen: boolean) => {
    setIsOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }, [onOpenChange]);
  const triggerRef = useSplitButtonMenu(isOpen, setOpen, [panelRef]);
  const panelStyle = useFixedDropDownMenuStyle(isOpen, triggerRef, {
    align: 'end',
    minWidth: 256,
    maxHeight: 400,
    flip: true,
    panelRef,
  });
  const panelMotion = overlayMotionPanelProps({
    kind: 'popover',
    origin: overlayOriginFromFixedMenuStyle(panelStyle),
    dir: overlayMotionDocumentDir(),
  });

  const managedColumns = React.useMemo(
    () => columns.filter((column) => column.layout !== false) as AppTableGridColumnDef<unknown>[],
    [columns],
  );

  const orderedColumns = React.useMemo(() => {
    const columnById = new Map(managedColumns.map((column) => [column.id, column]));
    const ordered = layout.order
      .map((columnId) => columnById.get(columnId))
      .filter((column): column is AppTableGridColumnDef<unknown> => column != null);
    for (const column of managedColumns) {
      if (!ordered.some((entry) => entry.id === column.id)) {
        ordered.push(column);
      }
    }
    return ordered;
  }, [layout.order, managedColumns]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    onLayoutChange(
      reorderColumn(layout, String(active.id), String(over.id)),
      { source: 'reorder', columnId: String(active.id) },
    );
  };

  const handleVisibilityChange = (columnId: string, visibleColumn: boolean) => {
    onLayoutChange(
      toggleColumnVisibility(layout, columnId, visibleColumn),
      { source: 'visibility', columnId },
    );
  };

  const handleReset = () => {
    onLayoutChange(resetColumnLayout(columns), { source: 'reset' });
  };

  const layoutPanel = isOpen ? (
    <div
      ref={panelRef}
      className={cn(SPLIT_BUTTON_MENU_PANEL_FIXED_CLASS, 'w-[16rem] p-3', panelMotion.className)}
      data-overlay-kind={panelMotion['data-overlay-kind']}
      data-overlay-origin={panelMotion['data-overlay-origin']}
      data-overlay-dir={panelMotion['data-overlay-dir']}
      style={panelStyle}
      role="dialog"
      aria-label={t('grid.columns.title')}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-slate-800">{t('grid.columns.title')}</p>
          <p className="text-[11px] text-slate-500">{t('grid.hint.columnsShowHideReorder')}</p>
        </div>
        <AppButton type="button" intent="utility" onClick={handleReset}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          {t('grid.columns.reset')}
        </AppButton>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={orderedColumns.map((column) => column.id)} strategy={verticalListSortingStrategy}>
          <div className="max-h-72 space-y-0.5 overflow-y-auto">
            {orderedColumns.map((column) => (
              <SortableColumnRow
                key={column.id}
                column={column}
                layout={layout}
                onVisibilityChange={handleVisibilityChange}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  ) : null;

  return (
    <div
      ref={triggerRef}
      className={cn(
        'relative transition-opacity duration-150',
        isControlVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
        className,
      )}
    >
      <NativeButton
        type="button"
        className={cn(
          ICON_ACTION_BUTTON_SM_CLASS,
          ICON_ACTION_CANCEL_CLASS,
          'rounded-md bg-white/90 shadow-sm ring-1 ring-slate-200/80 backdrop-blur-sm cursor-pointer',
        )}
        aria-label={t('grid.columnSettings')}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setOpen(!isOpen)}
      >
        <Settings2 className="h-3.5 w-3.5" />
      </NativeButton>
      {layoutPanel && typeof document !== 'undefined'
        ? createPortal(layoutPanel, document.body)
        : layoutPanel}
    </div>
  );
}
