import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FolderPlus, ChevronDown, ChevronUp, ImageIcon, Pencil, Plus, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { snapCenterToCursor } from '../../../shared/lib/dndKitModifiers';
import type {
  ColumnFormWidget,
  ColumnFormWidgetProps,
  ColumnFilterRole,
  ColumnSearchRole,
  EdgeModelAssociation,
  EdgeModelColumn,
  EdgeModelDefinition,
  RelationFormWidget,
} from '../../../shared/api/contracts/data-api';
import {
  COLUMN_FILTER_ROLE_OPTIONS,
  DEFAULT_COLUMN_FILTER_ROLE,
  DEFAULT_COLUMN_SEARCH_ROLE,
  createEmptyColumnFormWidgetProps,
  resolveBelongsToFormWidget,
} from '../../../shared/api/contracts/data-api';
import { NavigationIcon } from '../../../shared/lib/navigationIcons/NavigationIcon';
import { AppButton, FormSection, NativeButton, UiInput } from '../../../shared/ui';
import {
  ICON_ACTION_BUTTON_SM_CLASS,
  ICON_ACTION_CANCEL_CLASS,
} from '../../../shared/ui/surfaceClasses';
import { NAV_DEFAULT_ICON_COLOR } from '../../platform-navigations/constants';
import { NavigationIconPickerDialog } from '../../platform-navigations/components/dialogs/NavigationIconPickerDialog';
import { NavigationTailwindColorPicker } from '../../platform-navigations/components/NavigationTailwindColorPicker';
import { resolveNavColor } from '../../platform-navigations/lib/navigationTailwindColorOptions';
import {
  MODELER_CAPTION_CLASS,
  MODELER_CARD_SURFACE_CLASS,
  MODELER_CHIP_FOCUS_CLASS,
  MODELER_EMPTY_STATE_CLASS,
  MODELER_FIELD_CHIP_CLASS,
  MODELER_GROUP_ACCENT_BAR_CLASS,
  MODELER_NEUTRAL_ICON_CLASS,
} from '../lib/modelerChipStyles';
import type { RelationAttachedField } from '../lib/belongsToAttachedFields';
import {
  UNGROUPED_COLUMN_GROUP,
  buildColumnLayoutBuckets,
  createNamedColumnGroup,
  flattenBucketsToLayout,
  moveColumnGroupInBuckets,
  moveColumnInBuckets,
  pruneColumnGroupPresentation,
  removeNamedColumnGroup,
  renameNamedColumnGroup,
  type EdgeModelColumnStudioLayout,
} from '../lib/edgeModelColumnLayout';
import { EdgeModelModelerColumnDialog } from './EdgeModelModelerColumnDialog';
import { useDataStudioModelerColumnOverlayDeepLink } from '../hooks/useDataStudioModelerColumnOverlayDeepLink';
import {
  columnHistoryFromMeta,
  emptyColumnHistoryForm,
  pruneColumnHistory,
} from './EdgeModelHistoryFields';

type ColumnStudioLayoutPatch = Pick<
  EdgeModelColumnStudioLayout,
  | 'columnGroups'
  | 'columnSortOrders'
  | 'columnGroupOrder'
  | 'columnGroupIcons'
  | 'columnGroupColors'
>;

const toLayoutPatch = (layout: EdgeModelColumnStudioLayout): ColumnStudioLayoutPatch => {
  const presentation = pruneColumnGroupPresentation(layout);
  return {
    columnGroups: layout.columnGroups,
    columnSortOrders: layout.columnSortOrders,
    columnGroupOrder: layout.columnGroupOrder,
    columnGroupIcons: presentation.columnGroupIcons,
    columnGroupColors: presentation.columnGroupColors,
  };
};

const COLUMN_DND_PREFIX = 'col:';
const GROUP_DND_PREFIX = 'group:';

const toColumnDndId = (columnName: string) => `${COLUMN_DND_PREFIX}${columnName}`;
const toGroupDndId = (groupId: string) => (
  `${GROUP_DND_PREFIX}${groupId === UNGROUPED_COLUMN_GROUP ? '__ungrouped__' : groupId}`
);

const parseColumnDndId = (id: string): string | null => (
  id.startsWith(COLUMN_DND_PREFIX) ? id.slice(COLUMN_DND_PREFIX.length) : null
);

const parseGroupDndId = (id: string): string | null => {
  if (!id.startsWith(GROUP_DND_PREFIX)) {
    return null;
  }
  const raw = id.slice(GROUP_DND_PREFIX.length);
  return raw === '__ungrouped__' ? UNGROUPED_COLUMN_GROUP : raw;
};

/** Prefer column chips over group buckets so empty-group drops still resolve. */
const columnGroupCollisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  const collisions = pointerHits.length > 0 ? pointerHits : closestCorners(args);

  const columnHit = collisions.find((collision) => (
    parseColumnDndId(String(collision.id)) !== null
  ));
  if (columnHit) {
    return [columnHit];
  }

  const groupHit = collisions.find((collision) => (
    parseGroupDndId(String(collision.id)) !== null
  ));
  if (groupHit) {
    return [groupHit];
  }

  return collisions;
};

const COLUMN_CHIP_CLASS = cn(
  'inline-flex h-7 max-w-full items-center gap-1 rounded-md border px-1.5 text-xs shadow-sm',
  'transition-colors focus-visible:outline-none',
  MODELER_CHIP_FOCUS_CLASS,
);

type ColumnChipVisualProps = {
  column: EdgeModelColumn;
  icon?: string;
  locked: boolean;
  dragging?: boolean;
  /** Show a + badge when this FK column has attached target fields. */
  hasAttachedFields?: boolean;
};

const ColumnChipVisual: React.FC<ColumnChipVisualProps> = ({
  column,
  icon,
  locked,
  dragging = false,
  hasAttachedFields = false,
}) => {
  const iconRef = icon?.trim();

  return (
    <div
      className={cn(
        COLUMN_CHIP_CLASS,
        'flex-nowrap',
        MODELER_FIELD_CHIP_CLASS,
        locked && 'opacity-90',
        dragging && 'shadow-md ring-2 ring-slate-200',
      )}
    >
      <span className="inline-flex min-w-0 shrink-0 items-center gap-1">
        {iconRef ? (
          <NavigationIcon
            iconRef={iconRef}
            className={cn('h-3 w-3 shrink-0', MODELER_NEUTRAL_ICON_CLASS)}
          />
        ) : null}
        <span className="truncate font-mono">{column.name}</span>
      </span>
      {hasAttachedFields ? (
        <span
          className={cn(
            'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white',
            MODELER_NEUTRAL_ICON_CLASS,
          )}
          title="Has attached fields from related table"
          aria-label="Has attached fields"
        >
          <Plus className="h-2.5 w-2.5" aria-hidden="true" />
        </span>
      ) : null}
    </div>
  );
};

type SortableColumnChipProps = {
  column: EdgeModelColumn;
  icon?: string;
  locked: boolean;
  layoutEditable: boolean;
  hasAttachedFields?: boolean;
  onOpen: () => void;
};

const SortableColumnChip: React.FC<SortableColumnChipProps> = ({
  column,
  icon,
  locked,
  layoutEditable,
  hasAttachedFields = false,
  onOpen,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: toColumnDndId(column.name),
    disabled: !layoutEditable,
    data: { type: 'column', columnName: column.name },
  });
  const skipClickRef = useRef(false);

  useEffect(() => {
    if (isDragging) {
      skipClickRef.current = true;
    }
  }, [isDragging]);

  const handleClick = useCallback(() => {
    if (skipClickRef.current) {
      skipClickRef.current = false;
      return;
    }
    onOpen();
  }, [onOpen]);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: isDragging ? undefined : CSS.Transform.toString(transform),
        transition: isDragging ? undefined : transition,
        opacity: isDragging ? 0 : 1,
      }}
      className={cn(
        'group relative',
        layoutEditable && 'touch-none select-none',
        layoutEditable && !isDragging && 'cursor-grab',
        !layoutEditable && 'cursor-pointer',
        isDragging && 'cursor-grabbing',
      )}
      aria-label={`Open column ${column.name}`}
      onClick={handleClick}
      {...(layoutEditable ? { ...attributes, ...listeners } : {})}
    >
      <ColumnChipVisual
        column={column}
        icon={icon}
        locked={locked}
        hasAttachedFields={hasAttachedFields}
      />
    </div>
  );
};

type ColumnGroupBucketProps = {
  groupId: string;
  title: string;
  columnNames: string[];
  columnsByName: Map<string, EdgeModelColumn>;
  columnIcons: Record<string, string>;
  belongsToByForeignKey: Map<string, Extract<EdgeModelAssociation, { kind: 'belongsTo' }>>;
  peerModelIds: ReadonlySet<string>;
  relationAttachedFields: Record<string, RelationAttachedField[]>;
  groupIcon?: string;
  groupColor?: string;
  layoutEditable: boolean;
  isStructuralColumnLocked: (columnName: string) => boolean;
  columnsReadOnly: boolean;
  onOpenColumn: (columnName: string) => void;
  onRenameGroup?: (nextTitle: string) => void;
  onRemoveGroup?: () => void;
  onPickGroupIcon?: () => void;
  onChangeGroupColor?: (color: string) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
};

const ColumnGroupBucket: React.FC<ColumnGroupBucketProps> = ({
  groupId,
  title,
  columnNames,
  columnsByName,
  columnIcons,
  belongsToByForeignKey,
  peerModelIds,
  relationAttachedFields,
  groupIcon = '',
  groupColor = '',
  layoutEditable,
  isStructuralColumnLocked,
  columnsReadOnly,
  onOpenColumn,
  onRenameGroup,
  onRemoveGroup,
  onPickGroupIcon,
  onChangeGroupColor,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: toGroupDndId(groupId),
    disabled: !layoutEditable,
    data: { type: 'column-group', groupId },
  });
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const isUngrouped = groupId === UNGROUPED_COLUMN_GROUP;
  const resolvedGroupColor = resolveNavColor(groupColor, NAV_DEFAULT_ICON_COLOR);

  useEffect(() => {
    if (!editingTitle) {
      setTitleDraft(title);
    }
  }, [editingTitle, title]);

  const commitTitle = () => {
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === title) {
      setEditingTitle(false);
      setTitleDraft(title);
      return;
    }
    onRenameGroup?.(trimmed);
    setEditingTitle(false);
  };

  const showGroupChrome = !isUngrouped && layoutEditable;
  const chromeRevealClass = cn(
    'opacity-0 transition-opacity',
    'group-hover/modeler-group:opacity-100 group-focus-within/modeler-group:opacity-100',
  );

  return (
    <div
      className={cn(
        MODELER_CARD_SURFACE_CLASS,
        'group/modeler-group relative overflow-hidden px-2.5 py-2',
        !isUngrouped && 'ps-3',
        isOver && layoutEditable && 'border-slate-300 bg-slate-50/80',
      )}
    >
      {!isUngrouped ? (
        <span
          className={cn(MODELER_GROUP_ACCENT_BAR_CLASS, resolvedGroupColor)}
          aria-hidden
        />
      ) : null}
      <div className="mb-1.5 flex min-h-6 items-center gap-1.5">
        {showGroupChrome && onPickGroupIcon ? (
          <NativeButton
            type="button"
            className={cn(
              ICON_ACTION_BUTTON_SM_CLASS,
              !groupIcon.trim() && chromeRevealClass,
            )}
            aria-label={`Choose icon for group ${title}`}
            onClick={onPickGroupIcon}
          >
            {groupIcon.trim() ? (
              <NavigationIcon
                iconRef={groupIcon}
                className={cn('h-3.5 w-3.5', resolvedGroupColor)}
              />
            ) : (
              <ImageIcon className={cn('h-3.5 w-3.5', MODELER_NEUTRAL_ICON_CLASS)} />
            )}
          </NativeButton>
        ) : !isUngrouped && groupIcon.trim() ? (
          <NavigationIcon
            iconRef={groupIcon}
            className={cn('h-3.5 w-3.5 shrink-0', resolvedGroupColor)}
          />
        ) : null}
        {showGroupChrome && onChangeGroupColor ? (
          <NavigationTailwindColorPicker
            variant="swatch"
            value={resolvedGroupColor}
            defaultColor={NAV_DEFAULT_ICON_COLOR}
            ariaLabel={`Color for group ${title}`}
            onChange={(nextValue) => onChangeGroupColor(nextValue ?? '')}
          />
        ) : null}
        {editingTitle && onRenameGroup ? (
          <UiInput
            size="sm"
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={commitTitle}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitTitle();
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                setEditingTitle(false);
                setTitleDraft(title);
              }
            }}
            className="max-w-[14rem]"
            aria-label="Group name"
            autoFocus
          />
        ) : (
          <span
            className={cn(
              'ps-[4px] text-xs font-semibold tracking-wide',
              isUngrouped ? 'text-slate-500' : resolvedGroupColor,
              !isUngrouped && layoutEditable && onRenameGroup && 'cursor-pointer select-none',
            )}
            onDoubleClick={() => {
              if (!isUngrouped && layoutEditable && onRenameGroup) {
                setEditingTitle(true);
              }
            }}
          >
            {title}
          </span>
        )}
        <span className={MODELER_CAPTION_CLASS}>
          {columnNames.length}
        </span>
        {showGroupChrome && onRenameGroup && !editingTitle ? (
          <NativeButton
            type="button"
            className={cn(ICON_ACTION_BUTTON_SM_CLASS, chromeRevealClass)}
            aria-label={`Rename group ${title}`}
            title="Rename group"
            onClick={() => setEditingTitle(true)}
          >
            <Pencil className="h-3 w-3" />
          </NativeButton>
        ) : null}
        <div className={cn('ms-auto flex items-center gap-0.5', showGroupChrome && chromeRevealClass)}>
          {showGroupChrome && onMoveUp ? (
            <NativeButton
              type="button"
              className={ICON_ACTION_BUTTON_SM_CLASS}
              aria-label={`Move group ${title} up`}
              disabled={!canMoveUp}
              onClick={onMoveUp}
            >
              <ChevronUp className="h-3 w-3" />
            </NativeButton>
          ) : null}
          {showGroupChrome && onMoveDown ? (
            <NativeButton
              type="button"
              className={ICON_ACTION_BUTTON_SM_CLASS}
              aria-label={`Move group ${title} down`}
              disabled={!canMoveDown}
              onClick={onMoveDown}
            >
              <ChevronDown className="h-3 w-3" />
            </NativeButton>
          ) : null}
          {showGroupChrome && onRemoveGroup ? (
            <NativeButton
              type="button"
              className={cn(ICON_ACTION_BUTTON_SM_CLASS, ICON_ACTION_CANCEL_CLASS)}
              aria-label={`Remove group ${title}`}
              onClick={onRemoveGroup}
            >
              <X className="h-3 w-3" />
            </NativeButton>
          ) : null}
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-11 flex-wrap content-start gap-1.5 rounded-md px-0.5 py-0.5',
          layoutEditable && 'outline-none',
          isOver && layoutEditable && 'bg-slate-100/80',
        )}
      >
        {columnNames.length === 0 ? (
          <p className={cn('ps-[4px] py-1.5', MODELER_CAPTION_CLASS)}>
            {layoutEditable ? 'Drop columns here' : 'No columns'}
          </p>
        ) : (
          columnNames.map((columnName) => {
            const column = columnsByName.get(columnName);
            if (!column) {
              return null;
            }
            const belongsTo = belongsToByForeignKey.get(column.name) ?? null;
            const hasAttachedFields = Boolean(
              belongsTo
              && peerModelIds.has(belongsTo.targetModelId)
              && (relationAttachedFields[belongsTo.id]?.length ?? 0) > 0,
            );
            return (
              <SortableColumnChip
                key={column.name}
                column={column}
                icon={columnIcons[column.name]}
                locked={columnsReadOnly || isStructuralColumnLocked(column.name)}
                layoutEditable={layoutEditable}
                hasAttachedFields={hasAttachedFields}
                onOpen={() => onOpenColumn(column.name)}
              />
            );
          })
        )}
      </div>
    </div>
  );
};

export type EdgeModelModelerColumnsSectionProps = {
  columns: EdgeModelColumn[];
  associations?: ReadonlyArray<EdgeModelAssociation>;
  peerModels?: ReadonlyArray<Pick<
    EdgeModelDefinition,
    'id' | 'objectName' | 'labels' | 'columns' | 'primaryKey'
  >>;
  relationAttachedFields?: Record<string, RelationAttachedField[]>;
  columnDisplayLabels: Record<string, string>;
  columnIcons: Record<string, string>;
  columnFormWidgets: Record<string, ColumnFormWidget>;
  columnFormWidgetProps: Record<string, ColumnFormWidgetProps>;
  columnRequired: Record<string, boolean>;
  columnSearchRoles: Record<string, ColumnSearchRole>;
  columnFilterRoles: Record<string, ColumnFilterRole>;
  columnDeveloperNotes: Record<string, string>;
  columnInterfaceNotes: Record<string, string>;
  columnCubeMeasures?: Record<string, NonNullable<EdgeModelColumnStudioLayout['columnCubeMeasures']>[string]>;
  columnHistories?: Record<string, NonNullable<EdgeModelColumnStudioLayout['columnHistories']>[string]>;
  lifecycleField?: string | null;
  columnGroups: Record<string, string>;
  columnSortOrders: Record<string, number>;
  columnGroupOrder: string[];
  columnGroupIcons: Record<string, string>;
  columnGroupColors: Record<string, string>;
  relationFormWidgets?: Record<string, RelationFormWidget>;
  columnsReadOnly: boolean;
  canEditTable: boolean;
  layoutEditable?: boolean;
  isStructuralColumnLocked: (columnName: string) => boolean;
  onEditTable: () => void;
  onApplyColumnStudioLayout: (layout: ColumnStudioLayoutPatch) => void;
  onUpdateColumnDisplayLabel: (columnName: string, displayLabel: string) => void;
  onUpdateColumnIcon: (columnName: string, icon: string) => void;
  onUpdateColumnFormWidget: (
    columnName: string,
    formWidget: ColumnFormWidget | '',
    formWidgetProps?: ColumnFormWidgetProps | null,
  ) => void;
  onUpdateColumnRequired: (columnName: string, required: boolean) => void;
  onUpdateColumnSearchRole: (columnName: string, searchRole: ColumnSearchRole) => void;
  onUpdateColumnFilterRole: (columnName: string, filterRole: ColumnFilterRole) => void;
  onUpdateColumnDeveloperNotes: (columnName: string, developerNotes: string) => void;
  onUpdateColumnInterfaceNotes: (columnName: string, interfaceNotes: string) => void;
  onUpdateColumnCubeMeasure: (
    columnName: string,
    cubeMeasure: NonNullable<EdgeModelColumnStudioLayout['columnCubeMeasures']>[string] | null,
  ) => void;
  onUpdateColumnHistory: (
    columnName: string,
    history: NonNullable<EdgeModelColumnStudioLayout['columnHistories']>[string] | null,
  ) => void;
  onUpdateRelationFormWidget?: (
    relationKey: string,
    formWidget: RelationFormWidget | '',
  ) => void;
  onApplyRelationAttachedFields?: (
    relationKey: string,
    attachedFields: ReadonlyArray<RelationAttachedField>,
  ) => void;
};

export const EdgeModelModelerColumnsSection: React.FC<EdgeModelModelerColumnsSectionProps> = ({
  columns,
  associations = [],
  peerModels = [],
  relationAttachedFields = {},
  columnDisplayLabels,
  columnIcons,
  columnFormWidgets,
  columnFormWidgetProps,
  columnRequired,
  columnSearchRoles,
  columnFilterRoles,
  columnDeveloperNotes,
  columnInterfaceNotes,
  columnCubeMeasures = {},
  columnHistories = {},
  lifecycleField = null,
  columnGroups,
  columnSortOrders,
  columnGroupOrder,
  columnGroupIcons,
  columnGroupColors,
  relationFormWidgets = {},
  columnsReadOnly,
  canEditTable,
  layoutEditable = true,
  isStructuralColumnLocked,
  onEditTable,
  onApplyColumnStudioLayout,
  onUpdateColumnDisplayLabel,
  onUpdateColumnIcon,
  onUpdateColumnFormWidget,
  onUpdateColumnRequired,
  onUpdateColumnSearchRole,
  onUpdateColumnFilterRole,
  onUpdateColumnDeveloperNotes,
  onUpdateColumnInterfaceNotes,
  onUpdateColumnCubeMeasure,
  onUpdateColumnHistory,
  onUpdateRelationFormWidget,
  onApplyRelationAttachedFields,
}) => {
  const [selectedColumnName, setSelectedColumnName] = useState<string | null>(null);
  const columnNames = useMemo(() => columns.map((column) => column.name), [columns]);
  useDataStudioModelerColumnOverlayDeepLink({
    enabled: columnNames.length > 0,
    selectedColumnName,
    setSelectedColumnName,
    columnNames,
  });
  const [activeColumnName, setActiveColumnName] = useState<string | null>(null);
  const [groupIconPickerGroupName, setGroupIconPickerGroupName] = useState<string | null>(null);

  const primaryKeyColumns = useMemo(
    () => columns.filter((column) => column.isPrimaryKey),
    [columns],
  );
  const layoutColumns = useMemo(
    () => columns.filter((column) => !column.isPrimaryKey),
    [columns],
  );

  const studioLayout = useMemo<EdgeModelColumnStudioLayout>(() => ({
    columnDisplayLabels,
    columnIcons,
    columnFormWidgets,
    columnFormWidgetProps,
    columnRequired,
    columnSearchRoles,
    columnDeveloperNotes,
    columnInterfaceNotes,
    columnCubeMeasures,
    columnHistories,
    columnGroups,
    columnSortOrders,
    columnGroupOrder,
    columnGroupIcons,
    columnGroupColors,
  }), [
    columnDeveloperNotes,
    columnDisplayLabels,
    columnFormWidgetProps,
    columnFormWidgets,
    columnGroupColors,
    columnGroupIcons,
    columnGroupOrder,
    columnGroups,
    columnIcons,
    columnInterfaceNotes,
    columnCubeMeasures,
    columnHistories,
    columnRequired,
    columnSearchRoles,
    columnSortOrders,
  ]);

  const buckets = useMemo(
    () => buildColumnLayoutBuckets(layoutColumns, studioLayout),
    [layoutColumns, studioLayout],
  );

  const columnsByName = useMemo(
    () => new Map(columns.map((column) => [column.name, column])),
    [columns],
  );

  const belongsToByForeignKey = useMemo(() => {
    const map = new Map<string, Extract<EdgeModelAssociation, { kind: 'belongsTo' }>>();
    for (const association of associations) {
      if (association.kind !== 'belongsTo') {
        continue;
      }
      const foreignKey = association.foreignKey.trim();
      if (!foreignKey || map.has(foreignKey)) {
        continue;
      }
      map.set(foreignKey, association);
    }
    return map;
  }, [associations]);

  const peerModelsById = useMemo(
    () => new Map(peerModels.map((model) => [model.id, model])),
    [peerModels],
  );
  const peerModelIds = useMemo(
    () => new Set(peerModels.map((model) => model.id)),
    [peerModels],
  );

  const applyBucketsLayout = useCallback((nextBuckets: ReturnType<typeof buildColumnLayoutBuckets>) => {
    const nextLayout = flattenBucketsToLayout(nextBuckets, studioLayout);
    const columnGroupsNext = { ...nextLayout.columnGroups };
    const columnSortOrdersNext = { ...nextLayout.columnSortOrders };

    // Keep primary keys out of rearrangeable field groups/order.
    primaryKeyColumns.forEach((column, index) => {
      delete columnGroupsNext[column.name];
      columnSortOrdersNext[column.name] = studioLayout.columnSortOrders[column.name] ?? -(index + 1);
    });

    onApplyColumnStudioLayout(toLayoutPatch({
      ...nextLayout,
      columnGroups: columnGroupsNext,
      columnSortOrders: columnSortOrdersNext,
    }));
  }, [onApplyColumnStudioLayout, primaryKeyColumns, studioLayout]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const namedBucketIds = useMemo(
    () => buckets
      .filter((bucket) => bucket.id !== UNGROUPED_COLUMN_GROUP)
      .map((bucket) => bucket.id),
    [buckets],
  );
  const sortableColumnIds = useMemo(
    () => layoutColumns.map((column) => toColumnDndId(column.name)),
    [layoutColumns],
  );

  useEffect(() => {
    if (!selectedColumnName) {
      return;
    }
    if (columns.some((column) => column.name === selectedColumnName)) {
      return;
    }
    setSelectedColumnName(null);
  }, [columns, selectedColumnName]);

  const selectedColumn = selectedColumnName
    ? columns.find((column) => column.name === selectedColumnName) ?? null
    : null;
  const selectedBelongsTo = selectedColumn
    ? (belongsToByForeignKey.get(selectedColumn.name) ?? null)
    : null;
  const selectedBelongsToTarget = selectedBelongsTo
    && peerModelIds.has(selectedBelongsTo.targetModelId)
    ? (peerModelsById.get(selectedBelongsTo.targetModelId) ?? null)
    : null;

  const activeColumn = activeColumnName
    ? columnsByName.get(activeColumnName) ?? null
    : null;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const columnName = parseColumnDndId(String(event.active.id));
    setActiveColumnName(columnName);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveColumnName(null);
    if (!layoutEditable) {
      return;
    }
    const { active, over } = event;
    if (!over) {
      return;
    }

    const activeName = parseColumnDndId(String(active.id));
    if (!activeName) {
      return;
    }

    const overId = String(over.id);
    const overColumn = parseColumnDndId(overId);
    const overGroup = parseGroupDndId(overId);
    if (!overColumn && overGroup === null) {
      return;
    }

    const moved = moveColumnInBuckets(
      buckets,
      activeName,
      overColumn ?? overGroup!,
      overColumn === null,
    );
    if (!moved) {
      return;
    }

    applyBucketsLayout(moved);
  }, [applyBucketsLayout, buckets, layoutEditable]);

  const handleDragCancel = useCallback(() => {
    setActiveColumnName(null);
  }, []);

  const handleCreateGroup = () => {
    const { layout } = createNamedColumnGroup(studioLayout);
    onApplyColumnStudioLayout(toLayoutPatch(layout));
  };

  const handleRenameGroup = (fromName: string, toName: string) => {
    const layout = renameNamedColumnGroup(studioLayout, fromName, toName);
    onApplyColumnStudioLayout(toLayoutPatch(layout));
  };

  const handleRemoveGroup = (groupName: string) => {
    const layout = removeNamedColumnGroup(studioLayout, groupName);
    onApplyColumnStudioLayout(toLayoutPatch(layout));
  };

  const handleGroupIconSelect = (groupName: string, icon: string) => {
    const nextIcons = { ...studioLayout.columnGroupIcons };
    if (icon.trim()) {
      nextIcons[groupName] = icon.trim();
    } else {
      delete nextIcons[groupName];
    }
    onApplyColumnStudioLayout({
      ...toLayoutPatch(studioLayout),
      columnGroupIcons: nextIcons,
    });
    setGroupIconPickerGroupName(null);
  };

  const handleGroupColorChange = (groupName: string, color: string) => {
    const nextColors = { ...studioLayout.columnGroupColors };
    if (color.trim()) {
      nextColors[groupName] = color.trim();
    } else {
      delete nextColors[groupName];
    }
    onApplyColumnStudioLayout({
      ...toLayoutPatch(studioLayout),
      columnGroupColors: nextColors,
    });
  };

  const handleMoveGroup = useCallback((groupId: string, direction: -1 | 1) => {
    const moved = moveColumnGroupInBuckets(buckets, groupId, direction);
    if (!moved) {
      return;
    }
    applyBucketsLayout(moved);
  }, [applyBucketsLayout, buckets]);

  return (
    <>
      <FormSection
        title="Columns"
        ink="accent"
        hint="Fields on this table. Open a column to set labels, form widget, and notes."
        titleExtra={primaryKeyColumns.length > 0 ? (
          <div className="flex min-w-0 items-baseline gap-1.5">
            <span className="shrink-0 text-[11px] font-medium text-amber-700/90">
              {primaryKeyColumns.length === 1 ? 'Key:' : 'Keys:'}
            </span>
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
              {primaryKeyColumns.map((column, index) => (
                <React.Fragment key={column.name}>
                  {index > 0 ? (
                    <span className="text-[11px] text-slate-300" aria-hidden="true">·</span>
                  ) : null}
                  <NativeButton
                    type="button"
                    className={cn(
                      'max-w-[12rem] truncate border-0 bg-transparent p-0',
                      'font-mono text-[11px] font-medium text-amber-800',
                      'hover:text-amber-950 hover:underline',
                      'focus-visible:outline-none focus-visible:underline',
                    )}
                    aria-label={`Open primary key ${column.name}`}
                    onClick={() => setSelectedColumnName(column.name)}
                  >
                    {column.name}
                  </NativeButton>
                </React.Fragment>
              ))}
            </div>
          </div>
        ) : undefined}
        headerExtra={(
          <div className="flex items-center gap-1.5">
            {layoutEditable && layoutColumns.length > 0 ? (
              <AppButton
                intent="secondary"
                size="sm"
                onClick={handleCreateGroup}
              >
                <FolderPlus className="h-3.5 w-3.5" />
                New group
              </AppButton>
            ) : null}
            {canEditTable ? (
              <AppButton
                intent="secondary"
                size="sm"
                onClick={onEditTable}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </AppButton>
            ) : null}
          </div>
        )}
      >
        {columns.length === 0 ? (
          canEditTable ? (
            <button
              type="button"
              className={MODELER_EMPTY_STATE_CLASS}
              onClick={onEditTable}
            >
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
                <Pencil className={cn('h-3.5 w-3.5', MODELER_NEUTRAL_ICON_CLASS)} aria-hidden="true" />
                No columns yet
              </span>
              <span className={cn('ps-[4px]', MODELER_CAPTION_CLASS)}>
                Open the table designer to define fields.
              </span>
            </button>
          ) : (
            <p className={cn('ps-[4px]', MODELER_CAPTION_CLASS)}>
              No columns yet.
            </p>
          )
        ) : layoutColumns.length === 0 ? (
          canEditTable ? (
            <button
              type="button"
              className={MODELER_EMPTY_STATE_CLASS}
              onClick={onEditTable}
            >
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
                <Pencil className={cn('h-3.5 w-3.5', MODELER_NEUTRAL_ICON_CLASS)} aria-hidden="true" />
                No other columns yet
              </span>
              <span className={cn('ps-[4px]', MODELER_CAPTION_CLASS)}>
                Open the table designer to add fields.
              </span>
            </button>
          ) : (
            <p className={cn('ps-[4px]', MODELER_CAPTION_CLASS)}>
              No other columns yet.
            </p>
          )
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={columnGroupCollisionDetection}
            measuring={{
              droppable: {
                strategy: MeasuringStrategy.Always,
              },
            }}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext items={sortableColumnIds} strategy={rectSortingStrategy}>
              <div className="flex flex-col gap-2">
                {buckets.map((bucket) => {
                  const namedIndex = bucket.id === UNGROUPED_COLUMN_GROUP
                    ? -1
                    : namedBucketIds.indexOf(bucket.id);
                  return (
                  <ColumnGroupBucket
                    key={bucket.id || '__ungrouped__'}
                    groupId={bucket.id}
                    title={bucket.title}
                    columnNames={bucket.columnNames}
                    columnsByName={columnsByName}
                    columnIcons={columnIcons}
                    belongsToByForeignKey={belongsToByForeignKey}
                    peerModelIds={peerModelIds}
                    relationAttachedFields={relationAttachedFields}
                    groupIcon={bucket.id === UNGROUPED_COLUMN_GROUP
                      ? undefined
                      : columnGroupIcons[bucket.id]}
                    groupColor={bucket.id === UNGROUPED_COLUMN_GROUP
                      ? undefined
                      : columnGroupColors[bucket.id]}
                    layoutEditable={layoutEditable}
                    isStructuralColumnLocked={isStructuralColumnLocked}
                    columnsReadOnly={columnsReadOnly}
                    onOpenColumn={setSelectedColumnName}
                    onRenameGroup={bucket.id === UNGROUPED_COLUMN_GROUP
                      ? undefined
                      : (nextTitle) => handleRenameGroup(bucket.id, nextTitle)}
                    onRemoveGroup={bucket.id === UNGROUPED_COLUMN_GROUP
                      ? undefined
                      : () => handleRemoveGroup(bucket.id)}
                    onPickGroupIcon={bucket.id === UNGROUPED_COLUMN_GROUP
                      ? undefined
                      : () => setGroupIconPickerGroupName(bucket.id)}
                    onChangeGroupColor={bucket.id === UNGROUPED_COLUMN_GROUP
                      ? undefined
                      : (color) => handleGroupColorChange(bucket.id, color)}
                    canMoveUp={namedIndex > 0}
                    canMoveDown={namedIndex >= 0 && namedIndex < namedBucketIds.length - 1}
                    onMoveUp={bucket.id === UNGROUPED_COLUMN_GROUP
                      ? undefined
                      : () => handleMoveGroup(bucket.id, -1)}
                    onMoveDown={bucket.id === UNGROUPED_COLUMN_GROUP
                      ? undefined
                      : () => handleMoveGroup(bucket.id, 1)}
                  />
                  );
                })}
              </div>
            </SortableContext>
            <DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]}>
              {activeColumn ? (
                <ColumnChipVisual
                  column={activeColumn}
                  icon={columnIcons[activeColumn.name]}
                  locked={columnsReadOnly || isStructuralColumnLocked(activeColumn.name)}
                  dragging
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </FormSection>

      <EdgeModelModelerColumnDialog
        open={Boolean(selectedColumn)}
        column={selectedColumn}
        belongsToAttach={
          selectedBelongsTo && selectedBelongsToTarget && onApplyRelationAttachedFields
            ? {
              foreignKey: selectedBelongsTo.foreignKey,
              associationAs: selectedBelongsTo.as,
              targetModel: selectedBelongsToTarget,
            }
            : null
        }
        initialValues={{
          displayLabel: selectedColumn ? (columnDisplayLabels[selectedColumn.name] ?? '') : '',
          icon: selectedColumn ? (columnIcons[selectedColumn.name] ?? '') : '',
          formWidget: selectedColumn && !selectedBelongsTo
            ? (columnFormWidgets[selectedColumn.name] ?? '')
            : '',
          formWidgetProps: selectedColumn
            ? (columnFormWidgetProps[selectedColumn.name] ?? createEmptyColumnFormWidgetProps())
            : createEmptyColumnFormWidgetProps(),
          relationFormWidget: selectedBelongsTo
            ? resolveBelongsToFormWidget(relationFormWidgets[selectedBelongsTo.id])
            : '',
          required: selectedColumn
            ? (!selectedColumn.allowNull || Boolean(columnRequired[selectedColumn.name]))
            : false,
          searchRole: selectedColumn
            ? (columnSearchRoles[selectedColumn.name] ?? DEFAULT_COLUMN_SEARCH_ROLE)
            : DEFAULT_COLUMN_SEARCH_ROLE,
          filterRole: selectedColumn
            ? (columnFilterRoles[selectedColumn.name] ?? DEFAULT_COLUMN_FILTER_ROLE)
            : DEFAULT_COLUMN_FILTER_ROLE,
          developerNotes: selectedColumn ? (columnDeveloperNotes[selectedColumn.name] ?? '') : '',
          interfaceNotes: selectedColumn ? (columnInterfaceNotes[selectedColumn.name] ?? '') : '',
          attachedFields: selectedBelongsTo
            ? (relationAttachedFields[selectedBelongsTo.id] ?? [])
            : [],
          cubeMeasureEnabled: Boolean(selectedColumn && columnCubeMeasures?.[selectedColumn.name]),
          cubeAggregation: selectedColumn && columnCubeMeasures?.[selectedColumn.name]?.aggregation
            ? columnCubeMeasures[selectedColumn.name]!.aggregation
            : 'sum',
          cubeAdditivity: selectedColumn && columnCubeMeasures?.[selectedColumn.name]?.additivity
            ? columnCubeMeasures[selectedColumn.name]!.additivity
            : 'additive',
          cubeSemiAdditiveOver: selectedColumn
            ? (columnCubeMeasures?.[selectedColumn.name]?.semiAdditiveOverAssociation ?? '')
            : '',
          history: selectedColumn
            ? columnHistoryFromMeta(columnHistories[selectedColumn.name])
            : emptyColumnHistoryForm(),
        }}
        lifecycleField={lifecycleField}
        onSave={(values) => {
          if (!selectedColumn) {
            return;
          }
          const columnName = selectedColumn.name;
          onUpdateColumnDisplayLabel(columnName, values.displayLabel);
          onUpdateColumnIcon(columnName, values.icon);
          if (selectedBelongsTo) {
            onUpdateColumnFormWidget(columnName, '', null);
            onUpdateRelationFormWidget?.(
              selectedBelongsTo.id,
              resolveBelongsToFormWidget(values.relationFormWidget),
            );
          } else {
            onUpdateColumnFormWidget(columnName, values.formWidget, values.formWidgetProps);
          }
          // Non-nullable columns are always required in the UI; only persist for nullable.
          onUpdateColumnRequired(
            columnName,
            selectedColumn.allowNull ? values.required : false,
          );
          onUpdateColumnSearchRole(columnName, values.searchRole);
          onUpdateColumnFilterRole(columnName, values.filterRole);
          onUpdateColumnDeveloperNotes(columnName, values.developerNotes);
          onUpdateColumnInterfaceNotes(columnName, values.interfaceNotes);
          onUpdateColumnCubeMeasure(
            columnName,
            values.cubeMeasureEnabled
              ? {
                aggregation: values.cubeAdditivity === 'semi-additive' ? 'lastNonEmpty' : values.cubeAggregation,
                additivity: values.cubeAdditivity,
                ...(values.cubeAdditivity === 'semi-additive' && values.cubeSemiAdditiveOver.trim()
                  ? { semiAdditiveOverAssociation: values.cubeSemiAdditiveOver.trim() }
                  : {}),
              }
              : null,
          );
          onUpdateColumnHistory(columnName, pruneColumnHistory(values.history) ?? null);
          if (selectedBelongsTo && onApplyRelationAttachedFields) {
            onApplyRelationAttachedFields(selectedBelongsTo.id, values.attachedFields);
          }
        }}
        onClose={() => setSelectedColumnName(null)}
      />

      <NavigationIconPickerDialog
        open={Boolean(groupIconPickerGroupName)}
        selectedIcon={groupIconPickerGroupName
          ? (columnGroupIcons[groupIconPickerGroupName] ?? '')
          : ''}
        onSelect={(icon) => {
          if (groupIconPickerGroupName) {
            handleGroupIconSelect(groupIconPickerGroupName, icon);
          }
        }}
        onClose={() => setGroupIconPickerGroupName(null)}
      />
    </>
  );
};
