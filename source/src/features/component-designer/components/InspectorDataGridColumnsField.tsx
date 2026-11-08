import * as React from 'react';
import {
  ArrowRightLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  GripVertical,
  Group,
  MousePointerClick,
  Plus,
  Table2,
  Trash2,
  Zap,
} from 'lucide-react';
import type { DesignerAction, DesignerBindingDefinitions, DesignerDocument, DesignerNode } from '../../../domain/component-designer/types';
import {
  APP_TABLE_GRID_PALETTE_ITEM_ID,
  createActionGridColumn,
  createActionGroupColumn,
  createIconActionColumn,
  DEFAULT_DESIGNER_APP_TABLE_GRID_COLUMNS,
  DEFAULT_DESIGNER_DATA_GRID_COLUMNS,
  GRID_DETAIL_ACTION_ID,
  labelToDataGridColumnKey,
  parseDesignerAppTableGridColumns,
  parseDesignerDataGridColumns,
  resolveInspectorColumnType,
  serializeDesignerDataGridColumns,
  isActionGridColumn,
  isRichCellKind,
  type DesignerDataGridColumn,
  type DesignerDataGridColumnCellKind,
} from '../../../domain/component-designer/designerDataGridColumns';
import { createDefaultGridRowAction } from '../../../domain/component-designer/designerGridActionColumns';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from '../../../domain/component-designer/propRegistry';
import { getNodeGridListResourceRef } from '../../../domain/component-designer/bindingGridEngine';
import { ensureGridDetailActionColumn } from '../../../domain/component-designer/bindingGridDetailEngine';
import { AppButton } from '../../../shared/ui/AppButton';
import { AppSurfaceBox } from '../../../shared/ui/AppSurfaceBox';
import { UiInput, UiSelect } from '../../../shared/ui';
import { ICON_ACTION_CANCEL_CLASS, ICON_ACTION_DELETE_CLASS } from '../../../shared/ui/surfaceClasses';
import { DesignerFieldRow } from './DesignerFieldRow';
import { InspectorGridActionColumnFields } from './InspectorGridActionColumnFields';
import { InspectorGridRichCellFields } from './InspectorGridRichCellFields';
import { defaultRichCellFieldsForKind } from '../../../domain/component-designer/designerGridRichCellColumns';
import { preventInspectorDetailsToggle } from './inspectorDetailsGuard';
import {
  INSPECTOR_TEXT_2XS,
  INSPECTOR_TEXT_SM,
  INSPECTOR_TEXT_XS,
  NESTED_LAYER_DIVIDER_CLASS,
} from './inspectorDesignTokens';
import {
  InspectorFieldGroup,
  InspectorMicroLabel,
  InspectorSectionValueBadge,
  InspectorSegmentedControl,
  InspectorToggleChipGroup,
} from './inspectorFieldPrimitives';

const COLUMN_PIN_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
] as const;

type InspectorDataGridColumnsFieldProps = {
  node: DesignerNode;
  document: DesignerDocument;
  bindingDefinitions: DesignerBindingDefinitions;
  dispatch: React.Dispatch<DesignerAction>;
};

const readColumns = (node: DesignerNode): DesignerDataGridColumn[] => {
  const isAppTableGrid = node.props[DESIGNER_PALETTE_ITEM_ID_PROP] === APP_TABLE_GRID_PALETTE_ITEM_ID;
  const parseColumns = isAppTableGrid ? parseDesignerAppTableGridColumns : parseDesignerDataGridColumns;
  const defaultColumns = isAppTableGrid ? DEFAULT_DESIGNER_APP_TABLE_GRID_COLUMNS : DEFAULT_DESIGNER_DATA_GRID_COLUMNS;

  const parsed = parseColumns(node.props.columns);
  if (node.props.columns === undefined || (typeof node.props.columns === 'string' && node.props.columns.trim().length === 0)) {
    return [...defaultColumns];
  }

  return parsed;
};

const createEmptyColumn = (index: number): DesignerDataGridColumn => ({
  key: `field_${index + 1}`,
  label: `Column ${index + 1}`,
  sort: true,
});

const COLUMN_TYPE_ICON: Record<string, React.FC<{ className?: string }>> = {
  field: Table2,
  action: MousePointerClick,
  'icon-action': Zap,
  'action-group': Group,
};

type ColumnSummaryBadge = {
  key: string;
  label: string;
};

/** Active opt-in flags + pin for the collapsed summary bar (Phase 5). */
const collectActiveColumnBadges = (column: DesignerDataGridColumn): ColumnSummaryBadge[] => {
  const badges: ColumnSummaryBadge[] = [];
  if (column.sort === true) {
    badges.push({ key: 'sort', label: 'Sortable' });
  }
  if (column.filter === true) {
    badges.push({ key: 'filter', label: 'Filterable' });
  }
  if (column.editable === true) {
    badges.push({ key: 'editable', label: 'Editable' });
  }
  if (column.layoutPinned === 'left') {
    badges.push({ key: 'pin', label: 'Pinned L' });
  } else if (column.layoutPinned === 'right') {
    badges.push({ key: 'pin', label: 'Pinned R' });
  }
  return badges;
};

const ColumnSubsectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className={`ps-[4px] ${INSPECTOR_TEXT_2XS} font-semibold uppercase tracking-[0.08em] text-slate-500`}>
    {children}
  </span>
);

export const InspectorDataGridColumnsField: React.FC<InspectorDataGridColumnsFieldProps> = ({
  node,
  document,
  bindingDefinitions,
  dispatch,
}) => {
  const [columns, setColumns] = React.useState<DesignerDataGridColumn[]>(() => readColumns(node));
  /** Accordion expand: only one column open at a time (Phase 5). */
  const [expandedColumnIndex, setExpandedColumnIndex] = React.useState<number | null>(null);
  const skipPropsSyncRef = React.useRef(false);

  React.useEffect(() => {
    if (skipPropsSyncRef.current) {
      skipPropsSyncRef.current = false;
      return;
    }

    setColumns(readColumns(node));
    setExpandedColumnIndex(null);
  }, [node.id, node.props.columns]);

  const persistColumns = React.useCallback((nextColumns: DesignerDataGridColumn[]) => {
    const safeColumns = nextColumns.length > 0 ? nextColumns : [createEmptyColumn(0)];
    skipPropsSyncRef.current = true;
    setColumns(safeColumns);
    dispatch({
      type: 'set-node-prop',
      nodeId: node.id,
      key: 'columns',
      value: serializeDesignerDataGridColumns(safeColumns),
    });
  }, [dispatch, node.id]);

  const updateColumn = (index: number, patch: Partial<DesignerDataGridColumn>) => {
    persistColumns(columns.map((column, columnIndex) => (
      columnIndex === index ? { ...column, ...patch } : column
    )));
  };

  const addColumn = () => {
    persistColumns([...columns, createEmptyColumn(columns.length)]);
  };

  const addColumnFromField = (fieldKey: string) => {
    const trimmed = fieldKey.trim();
    if (!trimmed || columns.some((column) => column.key === trimmed)) {
      return;
    }

    const label = trimmed
      .split(/[_-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

    persistColumns([
      ...columns,
      {
        key: trimmed,
        label: label || trimmed,
        sort: true,
      },
    ]);
  };

  const removeColumn = (index: number) => {
    const nextColumns = columns.filter((_, columnIndex) => columnIndex !== index);
    persistColumns(nextColumns.length > 0 ? nextColumns : [createEmptyColumn(0)]);
    setExpandedColumnIndex((current) => {
      if (current === null) return null;
      if (current === index) return null;
      if (current > index) return current - 1;
      return current;
    });
  };

  const moveColumn = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= columns.length) {
      return;
    }

    const nextColumns = [...columns];
    const [moved] = nextColumns.splice(index, 1);
    if (!moved) {
      return;
    }

    nextColumns.splice(targetIndex, 0, moved);
    persistColumns(nextColumns);
    setExpandedColumnIndex((current) => {
      if (current === null) return null;
      if (current === index) return targetIndex;
      if (current === targetIndex) return index;
      return current;
    });
  };

  const toggleColumnExpanded = (index: number) => {
    setExpandedColumnIndex((current) => (current === index ? null : index));
  };

  const resourceRef = getNodeGridListResourceRef(node);
  const resourceFields = resourceRef ? bindingDefinitions.dataSources[resourceRef]?.fields ?? [] : [];
  const unusedResourceFields = resourceFields.filter((field) =>
    !columns.some((column) => column.key === field),
  );
  const isAppTableGrid = node.props[DESIGNER_PALETTE_ITEM_ID_PROP] === APP_TABLE_GRID_PALETTE_ITEM_ID;

  const applyColumnType = (index: number, nextType: string, column: DesignerDataGridColumn) => {
    if (nextType === 'action-group') {
      updateColumn(index, createActionGroupColumn([
        createDefaultGridRowAction('details', {
          icon: 'Eye',
          intent: 'view',
          tooltip: 'Details',
          behavior: { kind: 'detail-flow' },
        }),
      ], {
        key: column.key === 'actions' ? 'actions' : `actions_${index + 1}`,
        width: '140px',
        layoutHideable: false,
      }));
      return;
    }

    if (nextType === 'icon-action') {
      updateColumn(index, createIconActionColumn(
        column.actionId ?? GRID_DETAIL_ACTION_ID,
        {
          label: column.label,
          width: column.width,
          layoutHideable: column.layoutHideable,
        },
      ));
      return;
    }

    if (nextType === 'action') {
      updateColumn(index, createActionGridColumn(column.label || 'Details', GRID_DETAIL_ACTION_ID));
      return;
    }

    updateColumn(index, {
      kind: 'field',
      actionId: undefined,
      actionDisplay: undefined,
      actionIcon: undefined,
      actionIntent: undefined,
      actionTooltip: undefined,
      actionBehavior: undefined,
      actions: undefined,
      key: labelToDataGridColumnKey(column.label || `field_${index + 1}`),
    });
  };

  const renderColumnActions = (index: number, options?: { alwaysVisible?: boolean }) => (
    <div
      className={[
        'flex items-center gap-1',
        options?.alwaysVisible
          ? undefined
          : 'opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100',
      ].filter(Boolean).join(' ')}
      data-column-actions
    >
      <AppButton
        type="button"
        size="icon-sm"
        className={ICON_ACTION_CANCEL_CLASS}
        aria-label={`Move column ${index + 1} up`}
        disabled={index === 0}
        onClick={(event) => {
          event.stopPropagation();
          moveColumn(index, -1);
        }}
      >
        <ChevronUp className="h-3.5 w-3.5" />
      </AppButton>
      <AppButton
        type="button"
        size="icon-sm"
        className={ICON_ACTION_CANCEL_CLASS}
        aria-label={`Move column ${index + 1} down`}
        disabled={index === columns.length - 1}
        onClick={(event) => {
          event.stopPropagation();
          moveColumn(index, 1);
        }}
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </AppButton>
      <AppButton
        type="button"
        size="icon-sm"
        className={ICON_ACTION_DELETE_CLASS}
        aria-label={`Remove column ${index + 1}`}
        disabled={columns.length <= 1}
        onClick={(event) => {
          event.stopPropagation();
          removeColumn(index);
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </AppButton>
    </div>
  );

  return (
    <DesignerFieldRow label="Columns" layout="stack" align="start">
      <div className="flex w-full flex-col gap-2" {...preventInspectorDetailsToggle}>
        <AppSurfaceBox
          tone="cyan"
          title="Grid columns"
          layout="panel"
          collapsible
          defaultOpen
          headerExtra={(
            <InspectorSectionValueBadge
              count={columns.length}
              label={`${columns.length} column${columns.length === 1 ? '' : 's'}`}
              active={columns.length > 0}
            />
          )}
        >
          <div className="space-y-2">
            {columns.map((column, index) => {
              const isExpanded = expandedColumnIndex === index;
              const columnType = resolveInspectorColumnType(column);
              const TypeIcon = COLUMN_TYPE_ICON[columnType] ?? Table2;
              const badges = collectActiveColumnBadges(column);
              const showAppTableBehavior = isAppTableGrid && !isActionGridColumn(column);

              return (
                <div
                  key={`${node.id}:grid-column:${index}`}
                  className={`group flex flex-col gap-2 rounded-lg ${NESTED_LAYER_DIVIDER_CLASS} bg-slate-50/50 p-2 shadow-sm`}
                  data-column-card
                  data-column-index={index}
                  data-expanded={isExpanded ? 'true' : 'false'}
                >
                  {/* Collapsed summary row (always visible) */}
                  <div
                    data-column-summary
                    className="flex min-h-8 items-center gap-1.5 rounded-md px-0.5"
                  >
                    <span
                      className="inline-flex shrink-0 text-slate-400"
                      aria-hidden
                      title="Reorder with the up/down buttons"
                    >
                      <GripVertical className="h-3.5 w-3.5" />
                    </span>
                    <button
                      type="button"
                      data-column-expand
                      aria-expanded={isExpanded}
                      aria-label={`Column ${index + 1}: ${column.label || column.key || 'Untitled'}`}
                      className={`flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-md text-start outline-none focus-visible:ring-2 focus-visible:ring-indigo-300`}
                      onClick={() => toggleColumnExpanded(index)}
                    >
                      <TypeIcon className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
                      <span className={`min-w-0 flex-1 truncate ${INSPECTOR_TEXT_SM} font-medium text-slate-700`}>
                        {column.label?.trim() || column.key || `Column ${index + 1}`}
                      </span>
                      {badges.length > 0 ? (
                        <span className="flex max-w-[42%] flex-wrap items-center justify-end gap-1" data-column-badges>
                          {badges.map((badge) => (
                            <span
                              key={badge.key}
                              data-column-badge={badge.key}
                              className={`inline-flex items-center rounded-full bg-indigo-50 px-1.5 py-0.5 ${INSPECTOR_TEXT_2XS} font-medium text-indigo-700`}
                            >
                              {badge.key === 'pin' ? <ArrowRightLeft className="me-0.5 h-2.5 w-2.5" aria-hidden /> : null}
                              {badge.label}
                            </span>
                          ))}
                        </span>
                      ) : null}
                      <span className="inline-flex shrink-0 text-slate-400" aria-hidden>
                        {isExpanded
                          ? <ChevronDown className="h-3.5 w-3.5" />
                          : <ChevronRight className="h-3.5 w-3.5" />}
                      </span>
                    </button>
                    {renderColumnActions(index)}
                  </div>

                  {isExpanded ? (
                    <div className="flex flex-col gap-3 border-t border-slate-200/60 pt-2" data-column-editor>
                      {/* Identity */}
                      <div className="flex flex-col gap-2" data-column-section="identity">
                        <ColumnSubsectionTitle>Identity</ColumnSubsectionTitle>
                        <InspectorFieldGroup columns={2}>
                          <div className="flex flex-col gap-[2px]">
                            <InspectorMicroLabel>Header Label</InspectorMicroLabel>
                            <UiInput
                              size="sm"
                              nested
                              className="w-full bg-white text-slate-700"
                              placeholder="Category"
                              value={column.label}
                              onChange={(event) => {
                                const nextLabel = event.target.value;
                                const patch: Partial<DesignerDataGridColumn> = { label: nextLabel };
                                if (!isActionGridColumn(column) && (!column.key.trim() || column.key === labelToDataGridColumnKey(column.label))) {
                                  patch.key = labelToDataGridColumnKey(nextLabel);
                                }
                                updateColumn(index, patch);
                              }}
                              ariaLabel={`Column ${index + 1} header`}
                            />
                          </div>
                          <div className="flex flex-col gap-[2px]">
                            <InspectorMicroLabel>Field Key</InspectorMicroLabel>
                            <UiInput
                              size="sm"
                              nested
                              className={`w-full bg-white font-mono ${INSPECTOR_TEXT_XS} text-slate-700`}
                              placeholder="category_name"
                              value={column.key}
                              disabled={isActionGridColumn(column)}
                              onChange={(event) => updateColumn(index, { key: event.target.value })}
                              ariaLabel={`Column ${index + 1} field key`}
                            />
                          </div>
                        </InspectorFieldGroup>

                        <div className="grid grid-cols-[1fr_100px] gap-2 items-end">
                          <div className="flex flex-col gap-[2px]">
                            <InspectorMicroLabel>Column Type</InspectorMicroLabel>
                            <UiSelect
                              size="sm"
                              nested
                              className="w-full bg-white text-slate-700"
                              value={columnType}
                              onChange={(event) => applyColumnType(index, event.target.value, column)}
                            >
                              <option value="field">Data Field</option>
                              <option value="action">Text Action</option>
                              {isAppTableGrid ? (
                                <>
                                  <option value="icon-action">Icon Action</option>
                                  <option value="action-group">Action Group</option>
                                </>
                              ) : null}
                            </UiSelect>
                          </div>
                          <div className="flex flex-col gap-[2px]">
                            <InspectorMicroLabel>Width</InspectorMicroLabel>
                            <UiInput
                              size="sm"
                              nested
                              className="w-full bg-white text-slate-700"
                              placeholder="e.g. 120px"
                              value={column.width ?? ''}
                              onChange={(event) => {
                                const nextWidth = event.target.value.trim();
                                updateColumn(index, { width: nextWidth.length > 0 ? nextWidth : undefined });
                              }}
                              ariaLabel={`Column ${index + 1} width`}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Behavior — Phase 6: toggle chips + exclusive Pin segmented control */}
                      <div className="flex flex-col gap-2" data-column-section="behavior">
                        <div className="flex items-center justify-between gap-2">
                          <ColumnSubsectionTitle>Behavior</ColumnSubsectionTitle>
                          {renderColumnActions(index, { alwaysVisible: true })}
                        </div>
                        {(() => {
                          const actionDisabled = isActionGridColumn(column);
                          const behaviorOptions = [
                            { key: 'sort', label: 'Sortable', disabled: actionDisabled },
                            { key: 'filter', label: 'Filterable', disabled: actionDisabled },
                            ...(showAppTableBehavior
                              ? [
                                  { key: 'hideable', label: 'Hideable' },
                                  { key: 'resizable', label: 'Resizable' },
                                  { key: 'reorderable', label: 'Reorderable' },
                                  { key: 'editable', label: 'Editable' },
                                ]
                              : []),
                          ];
                          const activeKeys = new Set<string>();
                          if (column.sort === true) activeKeys.add('sort');
                          if (column.filter === true) activeKeys.add('filter');
                          if (showAppTableBehavior) {
                            if (column.layoutHideable !== false) activeKeys.add('hideable');
                            if (column.layoutResizable !== false) activeKeys.add('resizable');
                            if (column.layoutReorderable !== false) activeKeys.add('reorderable');
                            if (column.editable === true) activeKeys.add('editable');
                          }
                          return (
                            <InspectorToggleChipGroup
                              aria-label={`Column ${index + 1} behavior flags`}
                              options={behaviorOptions}
                              activeKeys={activeKeys}
                              onToggle={(key) => {
                                if (key === 'sort') {
                                  const next = !(column.sort === true);
                                  updateColumn(index, { sort: next ? true : undefined });
                                  return;
                                }
                                if (key === 'filter') {
                                  const next = !(column.filter === true);
                                  updateColumn(index, {
                                    filter: next ? true : undefined,
                                    filterType: next ? (column.filterType ?? 'text') : undefined,
                                  });
                                  return;
                                }
                                if (key === 'hideable') {
                                  updateColumn(index, {
                                    layoutHideable: column.layoutHideable === false ? true : false,
                                  });
                                  return;
                                }
                                if (key === 'resizable') {
                                  updateColumn(index, {
                                    layoutResizable: column.layoutResizable === false ? true : false,
                                  });
                                  return;
                                }
                                if (key === 'reorderable') {
                                  updateColumn(index, {
                                    layoutReorderable: column.layoutReorderable === false ? true : false,
                                  });
                                  return;
                                }
                                if (key === 'editable') {
                                  updateColumn(index, {
                                    editable: column.editable === true ? undefined : true,
                                  });
                                }
                              }}
                            />
                          );
                        })()}
                        {showAppTableBehavior ? (
                          <div className="flex flex-col gap-[2px]">
                            <InspectorMicroLabel>Pin</InspectorMicroLabel>
                            <InspectorSegmentedControl
                              name="pin"
                              aria-label="Column pin side"
                              options={COLUMN_PIN_OPTIONS}
                              value={column.layoutPinned ?? ''}
                              onChange={(next) => {
                                updateColumn(index, {
                                  layoutPinned: next === 'left' || next === 'right' ? next : undefined,
                                });
                              }}
                            />
                          </div>
                        ) : null}
                      </div>

                      {/* Display */}
                      <div className="flex flex-col gap-2" data-column-section="display">
                        <ColumnSubsectionTitle>Display</ColumnSubsectionTitle>
                        {isActionGridColumn(column) ? (
                          <InspectorGridActionColumnFields
                            node={node}
                            document={document}
                            column={column}
                            columnIndex={index}
                            onChange={(patch) => updateColumn(index, patch)}
                          />
                        ) : null}

                        {showAppTableBehavior ? (
                          <InspectorFieldGroup columns={2}>
                            <div className="flex flex-col gap-[2px]">
                              <InspectorMicroLabel>Filter Type</InspectorMicroLabel>
                              <UiSelect
                                size="sm"
                                nested
                                className="w-full bg-white text-slate-700"
                                value={column.filterType ?? 'text'}
                                disabled={column.filter !== true}
                                onChange={(event) => updateColumn(index, {
                                  filterType: event.target.value as DesignerDataGridColumn['filterType'],
                                })}
                              >
                                <option value="text">Text</option>
                                <option value="boolean">Boolean</option>
                                <option value="dateRange">Date Range</option>
                                <option value="select">Select</option>
                              </UiSelect>
                            </div>
                            <div className="flex flex-col gap-[2px]">
                              <InspectorMicroLabel>Cell Display</InspectorMicroLabel>
                              <UiSelect
                                size="sm"
                                nested
                                className="w-full bg-white text-slate-700"
                                value={column.cellKind ?? 'text'}
                                onChange={(event) => {
                                  const nextKind = event.target.value as DesignerDataGridColumnCellKind;
                                  const patch: Partial<DesignerDataGridColumn> = { cellKind: nextKind };
                                  if (isRichCellKind(nextKind)) {
                                    patch.cellFields = defaultRichCellFieldsForKind(nextKind);
                                  }
                                  updateColumn(index, patch);
                                }}
                              >
                                <option value="text">Text</option>
                                <option value="boolean-icon">Boolean Icon</option>
                                <option value="date">Date</option>
                                <option value="badge">Badge</option>
                                <option value="avatar">Avatar</option>
                                <option value="account">Account</option>
                                <option value="link">Clickable link</option>
                                <option value="lookup">Lookup title</option>
                                <option value="status-badge">Status badge (HTML)</option>
                                <option value="icon-from-lookup">Icon from lookup</option>
                                <option value="chips">Chips</option>
                                <option value="audit">Audit</option>
                                <option value="lock-status">Lock status</option>
                                <option value="file-tile">File tile</option>
                              </UiSelect>
                            </div>
                            <div className="flex flex-col gap-[2px]">
                              <InspectorMicroLabel>Card Role</InspectorMicroLabel>
                              <UiSelect
                                size="sm"
                                nested
                                className="w-full bg-white text-slate-700"
                                value={column.cardRole ?? ''}
                                onChange={(event) => {
                                  const nextRole = event.target.value.trim();
                                  updateColumn(index, {
                                    cardRole: nextRole.length > 0
                                      ? nextRole as NonNullable<DesignerDataGridColumn['cardRole']>
                                      : undefined,
                                  });
                                }}
                              >
                                <option value="">(none)</option>
                                <option value="title">Title</option>
                                <option value="subtitle">Subtitle</option>
                                <option value="meta">Meta</option>
                                <option value="field">Field</option>
                                <option value="actions">Actions</option>
                                <option value="hidden">Hidden</option>
                              </UiSelect>
                            </div>
                            <div className="flex flex-col gap-[2px]">
                              <InspectorMicroLabel>Hide Below</InspectorMicroLabel>
                              <UiSelect
                                size="sm"
                                nested
                                className="w-full bg-white text-slate-700"
                                value={column.hideBelow ?? ''}
                                onChange={(event) => {
                                  const nextValue = event.target.value;
                                  updateColumn(index, {
                                    hideBelow: nextValue === 'md' || nextValue === 'lg' ? nextValue : undefined,
                                  });
                                }}
                              >
                                <option value="">(always)</option>
                                <option value="md">phone</option>
                                <option value="lg">tablet</option>
                              </UiSelect>
                            </div>
                            <div className="flex flex-col gap-[2px]">
                              <InspectorMicroLabel>Phone Role</InspectorMicroLabel>
                              <UiSelect
                                size="sm"
                                nested
                                className="w-full bg-white text-slate-700"
                                value={column.cardPhoneRole ?? ''}
                                onChange={(event) => {
                                  const nextRole = event.target.value.trim();
                                  updateColumn(index, {
                                    cardPhoneRole: nextRole.length > 0
                                      ? nextRole as NonNullable<DesignerDataGridColumn['cardPhoneRole']>
                                      : undefined,
                                  });
                                }}
                              >
                                <option value="">(same)</option>
                                <option value="title">Title</option>
                                <option value="subtitle">Subtitle</option>
                                <option value="meta">Meta</option>
                                <option value="field">Field</option>
                                <option value="actions">Actions</option>
                                <option value="hidden">Hidden</option>
                              </UiSelect>
                            </div>
                            <div className="flex flex-col gap-[2px]">
                              <InspectorMicroLabel>Tablet Role</InspectorMicroLabel>
                              <UiSelect
                                size="sm"
                                nested
                                className="w-full bg-white text-slate-700"
                                value={column.cardTabletRole ?? ''}
                                onChange={(event) => {
                                  const nextRole = event.target.value.trim();
                                  updateColumn(index, {
                                    cardTabletRole: nextRole.length > 0
                                      ? nextRole as NonNullable<DesignerDataGridColumn['cardTabletRole']>
                                      : undefined,
                                  });
                                }}
                              >
                                <option value="">(same)</option>
                                <option value="title">Title</option>
                                <option value="subtitle">Subtitle</option>
                                <option value="meta">Meta</option>
                                <option value="field">Field</option>
                                <option value="actions">Actions</option>
                                <option value="hidden">Hidden</option>
                              </UiSelect>
                            </div>
                            {isRichCellKind(column.cellKind) ? (
                              <InspectorGridRichCellFields
                                node={node}
                                document={document}
                                bindingDefinitions={bindingDefinitions}
                                column={column}
                                columnIndex={index}
                                onChange={(patch) => updateColumn(index, patch)}
                              />
                            ) : null}
                          </InspectorFieldGroup>
                        ) : !isActionGridColumn(column) ? (
                          <p className={`ps-[4px] ${INSPECTOR_TEXT_XS} text-slate-500`}>
                            No display options for this column type.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <AppButton type="button" size="sm" intent="secondary" onClick={addColumn}>
                <Plus className="h-3.5 w-3.5" />
                Add data column
              </AppButton>
              <AppButton
                type="button"
                size="sm"
                intent="secondary"
                onClick={() => persistColumns(ensureGridDetailActionColumn(columns, 'Details'))}
              >
                <Plus className="h-3.5 w-3.5" />
                Add details action
              </AppButton>
              {isAppTableGrid ? (
                <>
                  <AppButton
                    type="button"
                    size="sm"
                    intent="secondary"
                    onClick={() => persistColumns([
                      ...columns,
                      createIconActionColumn('custom-action', {
                        label: '',
                        icon: 'Settings2',
                        intent: 'utility',
                        tooltip: 'Action',
                      }),
                    ])}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add icon action
                  </AppButton>
                  <AppButton
                    type="button"
                    size="sm"
                    intent="secondary"
                    onClick={() => persistColumns([
                      ...columns,
                      createActionGroupColumn([
                        createDefaultGridRowAction('details', {
                          icon: 'Eye',
                          intent: 'view',
                          tooltip: 'Details',
                        }),
                      ]),
                    ])}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add action group
                  </AppButton>
                </>
              ) : null}
            </div>
          </div>
        </AppSurfaceBox>

        {unusedResourceFields.length > 0 ? (
          <AppSurfaceBox tone="indigo" layout="strip">
            <div className="flex flex-col gap-[2px]">
              <span className={`ps-[4px] ${INSPECTOR_TEXT_2XS} font-semibold uppercase tracking-[0.08em] text-indigo-800`}>
                Add from API resource
              </span>
              <p className={`ps-[4px] ${INSPECTOR_TEXT_XS} leading-snug text-slate-600`}>
                One click adds a column using the exact API field name.
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {unusedResourceFields.map((field) => (
                  <AppButton
                    key={field}
                    type="button"
                    size="sm"
                    intent="secondary"
                    className={`h-7 px-2 font-mono ${INSPECTOR_TEXT_XS}`}
                    onClick={() => addColumnFromField(field)}
                  >
                    <Plus className="h-3 w-3" />
                    {field}
                  </AppButton>
                ))}
              </div>
            </div>
          </AppSurfaceBox>
        ) : (
          <p className={`ps-[4px] ${INSPECTOR_TEXT_2XS} leading-snug text-slate-500`}>
            Field key must match the API response property (for example <span className="font-mono">category_name</span>).
            Connect the grid to an API to quick-add fields.
          </p>
        )}
      </div>
    </DesignerFieldRow>
  );
};
