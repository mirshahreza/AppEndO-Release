import type { GridColumnCardRole, GridColumnHideBelow, GridFilterType } from '../../shared/lib/appTableGridQuery';
import {
  isAppTableGridColumnTextDirection,
  type AppTableGridColumnTextDirection,
} from '../../shared/lib/appTableGridColumnTextDirection';
import { humanizeFieldName } from './apiFieldToControl';
import { getNodePaletteItemId } from './runtimeShared';
import type { DesignerDocument } from './types';
import type {
  DesignerGridActionDisplay,
  DesignerGridActionIntent,
  DesignerGridRowAction,
  DesignerGridRowActionBehavior,
  DesignerGridRowDisableRule,
} from './designerGridActionColumns';
import {
  parseDesignerGridRowActionBehavior,
  parseDesignerGridRowActions,
  GRID_DETAIL_ACTION_ID,
} from './designerGridActionColumns';
import { parseDesignerGridRowDisableRule } from './designerGridRowDisableRules';
import {
  parseDesignerGridRichCellFields,
  type DesignerGridRichCellFields,
} from './designerGridRichCellColumns';
import {
  DEFAULT_DESIGNER_APP_TABLE_GRID_COLUMNS as defaultAppTableGridColumns,
  DEFAULT_DESIGNER_APP_TABLE_GRID_COLUMNS_JSON,
  DEFAULT_DESIGNER_APP_TABLE_GRID_SORT_OPTIONS as defaultAppTableGridSortOptions,
  DEFAULT_DESIGNER_APP_TABLE_GRID_SORT_OPTIONS_JSON,
  DEFAULT_DESIGNER_DATA_GRID_COLUMNS as defaultDataGridColumns,
  DEFAULT_DESIGNER_DATA_GRID_COLUMNS_JSON,
} from './designerDataGridDefaults';

export {
  DEFAULT_DESIGNER_APP_TABLE_GRID_COLUMNS_JSON,
  DEFAULT_DESIGNER_APP_TABLE_GRID_SORT_OPTIONS_JSON,
  DEFAULT_DESIGNER_DATA_GRID_COLUMNS_JSON,
};

export type {
  DesignerGridActionDisplay,
  DesignerGridActionIntent,
  DesignerGridRowAction,
  DesignerGridRowActionBehavior,
  DesignerGridRowActionBehaviorKind,
  DesignerGridRowDisableRule,
} from './designerGridActionColumns';

export type DesignerDataGridColumnKind = 'field' | 'action' | 'action-group';

export type DesignerDataGridColumnCellKind =
  | 'text'
  | 'boolean-icon'
  | 'date'
  | 'badge'
  | 'color-swatch'
  | 'avatar'
  | 'account'
  | 'link'
  | 'lookup'
  | 'status-badge'
  | 'icon-from-lookup'
  | 'chips'
  | 'audit'
  | 'lock-status'
  | 'file-tile'
  | 'hwy-registered-icon'
  | 'hwy-member-face'
  | 'hwy-imagefix-thumbs'
  | 'hwy-imagefix-member-actions'
  | 'hwy-member-personal-documents-link';

export type DesignerDataGridColumn = {
  key: string;
  label: string;
  kind?: DesignerDataGridColumnKind;
  actionId?: string;
  actionDisplay?: DesignerGridActionDisplay;
  actionIcon?: string;
  actionIntent?: DesignerGridActionIntent;
  actionTooltip?: string;
  actionBehavior?: DesignerGridRowActionBehavior;
  actionDisabledWhen?: DesignerGridRowDisableRule;
  actions?: DesignerGridRowAction[];
  /** Inline icon budget before remaining actions collapse into a dropdown. */
  maxVisibleActions?: number;
  sort?: boolean;
  filter?: boolean;
  filterType?: GridFilterType;
  cellKind?: DesignerDataGridColumnCellKind;
  cellFields?: DesignerGridRichCellFields;
  cellClickBehavior?: DesignerGridRowActionBehavior;
  cellClickActionId?: string;
  cellDisabledWhen?: DesignerGridRowDisableRule;
  cardRole?: GridColumnCardRole;
  /** Card layout sort; meta with priority &lt; 0 leads the catalog header (e.g. color swatch). */
  cardPriority?: number;
  cardPhoneRole?: GridColumnCardRole;
  cardTabletRole?: GridColumnCardRole;
  hideBelow?: GridColumnHideBelow;
  layoutHideable?: boolean;
  layoutResizable?: boolean;
  layoutReorderable?: boolean;
  /** Freeze column while horizontal scrolling (`position: sticky` in AppTableGrid / data-grid). */
  layoutPinned?: 'left' | 'right';
  headerClassName?: string;
  cellClassName?: string;
  textDirection?: AppTableGridColumnTextDirection;
  /** When true, Preview/Export renders an inline cell editor for this field column. */
  editable?: boolean;
  /**
   * Palette item id used as the inline editor control (e.g. `heroui.input`, `input-text`,
   * `heroui.select`). Defaults to a plain text input when omitted.
   */
  cellEditorPaletteItemId?: string;
  /**
   * Dynamic Action chain fired after an inline edit commits (blur/Enter).
   * Typically a Phase-24 `callMutation` PATCH with the changed field value.
   */
  onCellChangeActions?: import('./types').DesignerDynamicAction[];
  /** When set, column header uses `culture.t(labelTranslationKey)` at runtime (English `label` remains design-time fallback). */
  labelTranslationKey?: string;
  width?: string;
};

export type DesignerGridSortOption = {
  value: string;
  label: string;
  labelTranslationKey?: string;
};

export const APP_TABLE_GRID_PALETTE_ITEM_ID = 'heroui.app-table-grid';

export const DATA_TABLE_PALETTE_ITEM_ID = 'heroui.table';

const sanitizeAppTableGridVarSuffix = (nodeId: string): string => nodeId.replace(/[^a-zA-Z0-9_]/g, '_');

/**
 * Deterministic React state/hook variable names for one App Table Grid node's exported codegen —
 * shared by the preamble hook generator (bindingCodegen.ts) and the JSX renderer
 * (tsxPhase2Palette.ts) so both sides reference the exact same declared identifiers.
 */
export const resolveAppTableGridVarNames = (nodeId: string) => {
  const suffix = sanitizeAppTableGridVarSuffix(nodeId);
  return {
    columns: `gridColumns_${suffix}`,
    query: `gridQuery_${suffix}`,
    setQuery: `setGridQuery_${suffix}`,
    page: `gridPage_${suffix}`,
    setPage: `setGridPage_${suffix}`,
    pageSize: `gridPageSize_${suffix}`,
    setPageSize: `setGridPageSize_${suffix}`,
    listMode: `gridListMode_${suffix}`,
    setListMode: `setGridListMode_${suffix}`,
    columnLayout: `gridColumnLayout_${suffix}`,
    setColumnLayout: `setGridColumnLayout_${suffix}`,
    searchInput: `gridSearchInput_${suffix}`,
    setSearchInput: `setGridSearchInput_${suffix}`,
    roleFilters: `gridRoleFilters_${suffix}`,
    setRoleFilters: `setGridRoleFilters_${suffix}`,
    checkboxSelections: `gridCheckboxSelections_${suffix}`,
    setCheckboxSelections: `setGridCheckboxSelections_${suffix}`,
    radioSelections: `gridRadioSelections_${suffix}`,
    setRadioSelections: `setGridRadioSelections_${suffix}`,
    matchLogicByFilterId: `gridMatchLogic_${suffix}`,
    setMatchLogicByFilterId: `setGridMatchLogic_${suffix}`,
    filteredRows: `gridFilteredRows_${suffix}`,
    aggregatedRows: `gridAggregatedRows_${suffix}`,
    totalCount: `gridTotalCount_${suffix}`,
    apiTotal: `gridApiTotal_${suffix}`,
    paging: `gridPaging_${suffix}`,
    cellClickHandler: `handleGridCellClick_${suffix}`,
    debouncedSearch: `gridDebouncedSearch_${suffix}`,
    setDebouncedSearch: `setGridDebouncedSearch_${suffix}`,
    searchDebounceRef: `gridSearchDebounceRef_${suffix}`,
    sortOptions: `gridSortOptions_${suffix}`,
    toolbarLovData: (filterId: string) => `gridToolbarLovData_${filterId.replace(/[^a-zA-Z0-9_]/g, '_')}_${suffix}`,
  } as const;
};

export const documentUsesAppTableGrid = (document: DesignerDocument): boolean =>
  Object.values(document.nodes).some(
    (node) => getNodePaletteItemId(node) === APP_TABLE_GRID_PALETTE_ITEM_ID,
  );

export { GRID_DETAIL_ACTION_ID };

export const DEFAULT_DESIGNER_DATA_GRID_COLUMNS: DesignerDataGridColumn[] = defaultDataGridColumns;

export const DEFAULT_DESIGNER_APP_TABLE_GRID_COLUMNS: DesignerDataGridColumn[] = defaultAppTableGridColumns;

export const DEFAULT_DESIGNER_APP_TABLE_GRID_SORT_OPTIONS: DesignerGridSortOption[] =
  defaultAppTableGridSortOptions;

export const DEFAULT_DESIGNER_DATA_GRID_COLUMN_KEYS = DEFAULT_DESIGNER_DATA_GRID_COLUMNS.map((column) => column.key);

export const isDefaultGridTemplateFieldList = (fields: readonly string[]): boolean => {
  if (fields.length !== DEFAULT_DESIGNER_DATA_GRID_COLUMN_KEYS.length) {
    return false;
  }

  return fields.every((field, index) => field === DEFAULT_DESIGNER_DATA_GRID_COLUMN_KEYS[index]);
};

export const labelToDataGridColumnKey = (label: string): string =>
  label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

export const isActionGridColumn = (column: DesignerDataGridColumn): boolean =>
  column.kind === 'action' || column.kind === 'action-group' || column.key.startsWith('__action_');

export const resolveActionGridColumnId = (column: DesignerDataGridColumn): string => {
  if (column.actionId?.trim()) {
    return column.actionId.trim();
  }

  if (column.key.startsWith('__action_')) {
    return column.key.slice('__action_'.length) || GRID_DETAIL_ACTION_ID;
  }

  return GRID_DETAIL_ACTION_ID;
};

export const createActionGridColumn = (
  label: string,
  actionId: string = GRID_DETAIL_ACTION_ID,
): DesignerDataGridColumn => ({
  key: `__action_${actionId}`,
  label: label.trim() || 'Details',
  kind: 'action',
  actionId,
  width: '108px',
});

export const serializeDesignerDataGridColumns = (columns: DesignerDataGridColumn[]): string =>
  JSON.stringify(columns);

export const serializeDesignerGridSortOptions = (options: DesignerGridSortOption[]): string =>
  JSON.stringify(options);

export const buildDesignerGridColumnQuerySignature = (columns: DesignerDataGridColumn[]): string =>
  columns.map((column) => (
    `${column.key}:${column.sort ? 1 : 0}:${column.filter ? 1 : 0}:${column.filterType ?? ''}`
  )).join('|');

export const buildDesignerGridColumnLayoutSignature = (columns: DesignerDataGridColumn[]): string =>
  columns.map((column) => (
    `${column.key}:${column.layoutHideable !== false ? 1 : 0}:${column.layoutResizable !== false ? 1 : 0}:${column.layoutReorderable !== false ? 1 : 0}:${column.layoutPinned ?? ''}:${column.editable === true ? 1 : 0}`
  )).join('|');

export const isDefaultDesignerDataGridColumnsValue = (value: unknown): boolean => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return true;
  }

  return value.trim() === DEFAULT_DESIGNER_DATA_GRID_COLUMNS_JSON;
};

export const buildGridColumnsFromApiFields = (
  fields: readonly string[],
  options: {
    preserveActionColumns?: DesignerDataGridColumn[];
  } = {},
): DesignerDataGridColumn[] => {
  const actionColumns = options.preserveActionColumns ?? [];
  const seen = new Set<string>();
  const fieldColumns: DesignerDataGridColumn[] = [];

  for (const rawField of fields) {
    const key = rawField.trim();
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    fieldColumns.push({
      key,
      label: humanizeFieldName(key),
      kind: 'field',
      sort: key !== 'note' && !key.endsWith('_note'),
    });
  }

  return fieldColumns.length > 0
    ? [...fieldColumns, ...actionColumns]
    : [...actionColumns];
};

export type GridColumnWizardRow = {
  key: string;
  label: string;
  enabled: boolean;
  sort?: boolean;
  filter?: boolean;
  isAction?: boolean;
  actionId?: string;
  width?: string;
};

export const wizardRowsToGridColumns = (rows: readonly GridColumnWizardRow[]): DesignerDataGridColumn[] =>
  rows
    .filter((row) => row.enabled)
    .map((row) => ({
      key: row.key,
      label: row.label.trim() || row.key,
      ...(row.isAction
        ? {
          kind: 'action' as const,
          actionId: row.actionId ?? resolveActionGridColumnId({ key: row.key, label: row.label }),
        }
        : {}),
      ...(row.sort === true ? { sort: true } : {}),
      ...(row.filter === true ? { filter: true } : {}),
      ...(row.width?.trim() ? { width: row.width.trim() } : {}),
    }));

export const buildGridColumnWizardRows = (
  columnsValue: unknown,
  dataSourceFields: readonly string[],
  hasExistingListBinding: boolean,
): GridColumnWizardRow[] => {
  const existing = parseDesignerDataGridColumns(columnsValue);
  const actionColumns = existing.filter((column) => isActionGridColumn(column));
  const existingFieldColumns = existing.filter((column) => !isActionGridColumn(column));
  const existingByKey = new Map(existingFieldColumns.map((column) => [column.key, column]));
  const autoGenerate = shouldAutoGenerateGridColumns(columnsValue, dataSourceFields, hasExistingListBinding);

  const seen = new Set<string>();
  const fieldRows: GridColumnWizardRow[] = [];

  for (const rawField of dataSourceFields) {
    const key = rawField.trim();
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    const existingColumn = existingByKey.get(key);
    const generated = buildGridColumnsFromApiFields([key])[0];

    fieldRows.push({
      key,
      label: existingColumn?.label ?? generated?.label ?? humanizeFieldName(key),
      enabled: autoGenerate ? true : existingColumn !== undefined,
      sort: existingColumn?.sort ?? generated?.sort,
      filter: existingColumn?.filter === true,
    });
  }

  for (const column of existingFieldColumns) {
    if (seen.has(column.key) || autoGenerate) {
      continue;
    }

    fieldRows.push({
      key: column.key,
      label: column.label,
      enabled: true,
      sort: column.sort,
      filter: column.filter,
      width: column.width,
    });
  }

  const actionRows: GridColumnWizardRow[] = actionColumns.map((column) => ({
    key: column.key,
    label: column.label,
    enabled: true,
    sort: column.sort,
    filter: column.filter,
      isAction: column.kind === 'action' || column.kind === 'action-group',
    actionId: column.actionId,
    width: column.width,
  }));

  return [...fieldRows, ...actionRows];
};

export const shouldAutoGenerateGridColumns = (
  columnsValue: unknown,
  dataSourceFields: readonly string[],
  hasExistingListBinding: boolean,
): boolean => {
  if (dataSourceFields.length === 0) {
    return false;
  }

  if (isDefaultDesignerDataGridColumnsValue(columnsValue)) {
    return true;
  }

  if (!hasExistingListBinding) {
    const parsed = parseDesignerDataGridColumns(columnsValue);
    const dataColumns = parsed.filter((column) => !isActionGridColumn(column));
    if (dataColumns.length === 0) {
      return true;
    }

    const columnKeys = new Set(dataColumns.map((column) => column.key));
    const overlap = dataSourceFields.filter((field) => columnKeys.has(field)).length;
    return overlap === 0;
  }

  return false;
};

export const parseDesignerDataGridColumns = (value: unknown): DesignerDataGridColumn[] => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return DEFAULT_DESIGNER_DATA_GRID_COLUMNS;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return DEFAULT_DESIGNER_DATA_GRID_COLUMNS;
    }

    const columns = parsed
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }

        const record = entry as Record<string, unknown>;
        const key = typeof record.key === 'string' ? record.key.trim() : '';
        const label = typeof record.label === 'string' ? record.label.trim() : key;
        const labelTranslationKey = typeof record.labelTranslationKey === 'string' && record.labelTranslationKey.trim()
          ? record.labelTranslationKey.trim()
          : undefined;
        if (!key) {
          return null;
        }

        const kind = record.kind === 'action'
          ? 'action' as const
          : record.kind === 'action-group'
            ? 'action-group' as const
            : undefined;
        const actionId = typeof record.actionId === 'string' && record.actionId.trim()
          ? record.actionId.trim()
          : undefined;
        const actionDisplay = record.actionDisplay === 'icon' || record.actionDisplay === 'button'
          ? record.actionDisplay
          : undefined;
        const actionIcon = typeof record.actionIcon === 'string' && record.actionIcon.trim()
          ? record.actionIcon.trim()
          : undefined;
        const actionIntent = record.actionIntent === 'view'
          || record.actionIntent === 'edit'
          || record.actionIntent === 'delete'
          || record.actionIntent === 'access'
          || record.actionIntent === 'utility'
          || record.actionIntent === 'warning'
          ? record.actionIntent
          : undefined;
        const actionTooltip = typeof record.actionTooltip === 'string' && record.actionTooltip.trim()
          ? record.actionTooltip.trim()
          : undefined;
        const actionBehavior = parseDesignerGridRowActionBehavior(record.actionBehavior);
        const actionDisabledWhen = parseDesignerGridRowDisableRule(record.actionDisabledWhen);
        const actions = parseDesignerGridRowActions(record.actions);
        const cellFields = parseDesignerGridRichCellFields(record.cellFields);
        const cellClickBehavior = parseDesignerGridRowActionBehavior(record.cellClickBehavior);
        const cellClickActionId = typeof record.cellClickActionId === 'string' && record.cellClickActionId.trim()
          ? record.cellClickActionId.trim()
          : undefined;
        const cellDisabledWhen = parseDesignerGridRowDisableRule(record.cellDisabledWhen);

        const filterType = record.filterType;
        const cellKind = record.cellKind;
        const cardRole = record.cardRole;
        const hideBelow = record.hideBelow;
        const cardPhoneRole = record.cardPhoneRole;
        const cardTabletRole = record.cardTabletRole;
        const maxVisibleActions = typeof record.maxVisibleActions === 'number' && Number.isFinite(record.maxVisibleActions)
          ? Math.min(6, Math.max(1, Math.round(record.maxVisibleActions)))
          : undefined;

        return {
          key,
          label,
          ...(labelTranslationKey ? { labelTranslationKey } : {}),
          ...(kind ? { kind } : {}),
          ...(actionId ? { actionId } : {}),
          ...(actionDisplay ? { actionDisplay } : {}),
          ...(actionIcon ? { actionIcon } : {}),
          ...(actionIntent ? { actionIntent } : {}),
          ...(actionTooltip ? { actionTooltip } : {}),
          ...(actionBehavior ? { actionBehavior } : {}),
          ...(actionDisabledWhen ? { actionDisabledWhen } : {}),
          ...(actions.length > 0 ? { actions } : {}),
          ...(maxVisibleActions ? { maxVisibleActions } : {}),
          ...(record.sort === true ? { sort: true } : {}),
          ...(record.filter === true ? { filter: true } : {}),
          ...(filterType === 'text' || filterType === 'boolean' || filterType === 'dateRange' || filterType === 'select'
            ? { filterType }
            : {}),
          ...(cellKind === 'text'
            || cellKind === 'boolean-icon'
            || cellKind === 'date'
            || cellKind === 'badge'
            || cellKind === 'color-swatch'
            || cellKind === 'avatar'
            || cellKind === 'account'
            || cellKind === 'link'
            || cellKind === 'lookup'
            || cellKind === 'status-badge'
            || cellKind === 'icon-from-lookup'
            || cellKind === 'chips'
            || cellKind === 'audit'
            || cellKind === 'lock-status'
            || cellKind === 'file-tile'
            || cellKind === 'hwy-registered-icon'
            || cellKind === 'hwy-member-face'
            || cellKind === 'hwy-imagefix-thumbs'
            || cellKind === 'hwy-imagefix-member-actions'
            || cellKind === 'hwy-member-personal-documents-link'
            ? { cellKind }
            : {}),
          ...(cellFields ? { cellFields } : {}),
          ...(cellClickBehavior ? { cellClickBehavior } : {}),
          ...(cellClickActionId ? { cellClickActionId } : {}),
          ...(cellDisabledWhen ? { cellDisabledWhen } : {}),
          ...(cardRole === 'title' || cardRole === 'subtitle' || cardRole === 'meta'
            || cardRole === 'field' || cardRole === 'actions' || cardRole === 'hidden'
            ? { cardRole }
            : {}),
          ...(cardPhoneRole === 'title' || cardPhoneRole === 'subtitle' || cardPhoneRole === 'meta'
            || cardPhoneRole === 'field' || cardPhoneRole === 'actions' || cardPhoneRole === 'hidden'
            ? { cardPhoneRole }
            : {}),
          ...(cardTabletRole === 'title' || cardTabletRole === 'subtitle' || cardTabletRole === 'meta'
            || cardTabletRole === 'field' || cardTabletRole === 'actions' || cardTabletRole === 'hidden'
            ? { cardTabletRole }
            : {}),
          ...(typeof record.cardPriority === 'number' && Number.isFinite(record.cardPriority)
            ? { cardPriority: record.cardPriority }
            : {}),
          ...(hideBelow === 'md' || hideBelow === 'lg' ? { hideBelow } : {}),
          ...(record.layoutHideable === true || record.layoutHideable === false ? { layoutHideable: record.layoutHideable } : {}),
          ...(record.layoutResizable === true || record.layoutResizable === false ? { layoutResizable: record.layoutResizable } : {}),
          ...(record.layoutReorderable === true || record.layoutReorderable === false ? { layoutReorderable: record.layoutReorderable } : {}),
          ...(record.layoutPinned === 'left' || record.layoutPinned === 'right'
            ? { layoutPinned: record.layoutPinned }
            : {}),
          ...(record.editable === true ? { editable: true } : {}),
          ...(typeof record.cellEditorPaletteItemId === 'string' && record.cellEditorPaletteItemId.trim()
            ? { cellEditorPaletteItemId: record.cellEditorPaletteItemId.trim() }
            : {}),
          ...(Array.isArray(record.onCellChangeActions) && record.onCellChangeActions.length > 0
            ? {
              onCellChangeActions: record.onCellChangeActions.filter(
                (entry): entry is import('./types').DesignerDynamicAction => (
                  Boolean(entry)
                  && typeof entry === 'object'
                  && typeof (entry as { id?: unknown }).id === 'string'
                  && typeof (entry as { type?: unknown }).type === 'string'
                ),
              ),
            }
            : {}),
          ...(typeof record.width === 'string' && record.width.trim().length > 0
            ? { width: record.width.trim() }
            : {}),
          ...(typeof record.headerClassName === 'string' && record.headerClassName.trim().length > 0
            ? { headerClassName: record.headerClassName.trim() }
            : {}),
          ...(typeof record.cellClassName === 'string' && record.cellClassName.trim().length > 0
            ? { cellClassName: record.cellClassName.trim() }
            : {}),
          ...(isAppTableGridColumnTextDirection(record.textDirection)
            ? { textDirection: record.textDirection }
            : {}),
        } satisfies DesignerDataGridColumn;
      })
      .filter((entry) => entry !== null) as DesignerDataGridColumn[];

    return columns.length > 0 ? columns : DEFAULT_DESIGNER_DATA_GRID_COLUMNS;
  } catch {
    return DEFAULT_DESIGNER_DATA_GRID_COLUMNS;
  }
};

export const MOCK_DESIGNER_DATA_GRID_ROWS: Array<Record<string, string>> = [
  { id: 'row-1', name: 'Alpha record', status: 'Active' },
  { id: 'row-2', name: 'Beta record', status: 'Pending' },
  { id: 'row-3', name: 'Gamma record', status: 'Inactive' },
];

export const MOCK_DESIGNER_APP_TABLE_GRID_ROWS: Array<Record<string, unknown>> = [
  { id: 'row-1', name: 'Alpha record', status: 'Active', active: true, created_at: '2026-01-15' },
  { id: 'row-2', name: 'Beta record', status: 'Pending', active: false, created_at: '2026-02-20' },
  { id: 'row-3', name: 'Gamma record', status: 'Inactive', active: true, created_at: '2026-03-10' },
  { id: 'row-4', name: 'Delta record', status: 'Active', active: true, created_at: '2026-04-05' },
  { id: 'row-5', name: 'Epsilon record', status: 'Pending', active: false, created_at: '2026-05-12' },
];

export const parseDesignerAppTableGridColumns = (value: unknown): DesignerDataGridColumn[] => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return DEFAULT_DESIGNER_APP_TABLE_GRID_COLUMNS;
  }

  const parsed = parseDesignerDataGridColumns(value);
  if (parsed === DEFAULT_DESIGNER_DATA_GRID_COLUMNS) {
    return DEFAULT_DESIGNER_APP_TABLE_GRID_COLUMNS;
  }

  return parsed;
};

export const parseDesignerGridSortOptions = (value: unknown): DesignerGridSortOption[] => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return DEFAULT_DESIGNER_APP_TABLE_GRID_SORT_OPTIONS;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return DEFAULT_DESIGNER_APP_TABLE_GRID_SORT_OPTIONS;
    }

    const options = parsed
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }

        const record = entry as Record<string, unknown>;
        const optionValue = typeof record.value === 'string' ? record.value.trim() : '';
        const optionLabel = typeof record.label === 'string' ? record.label.trim() : optionValue;
        const labelTranslationKey = typeof record.labelTranslationKey === 'string' && record.labelTranslationKey.trim()
          ? record.labelTranslationKey.trim()
          : undefined;
        if (!optionValue) {
          return null;
        }

        return {
          value: optionValue,
          label: optionLabel || optionValue,
          ...(labelTranslationKey ? { labelTranslationKey } : {}),
        } satisfies DesignerGridSortOption;
      })
      .filter((entry) => entry !== null) as DesignerGridSortOption[];

    return options.length > 0 ? options : DEFAULT_DESIGNER_APP_TABLE_GRID_SORT_OPTIONS;
  } catch {
    return DEFAULT_DESIGNER_APP_TABLE_GRID_SORT_OPTIONS;
  }
};

export const parseGridColumnsForPalette = (
  paletteItemId: string | undefined,
  value: unknown,
): DesignerDataGridColumn[] => (
  paletteItemId === APP_TABLE_GRID_PALETTE_ITEM_ID
    ? parseDesignerAppTableGridColumns(value)
    : parseDesignerDataGridColumns(value)
);

export {
  collectGridRowActionsFromColumns,
  createActionGroupColumn,
  createDefaultGridRowAction,
  createIconActionColumn,
  isActionGroupColumn,
  isIconActionColumn,
  resolveInspectorColumnType,
  USERS_ACTION_GROUP_COLUMN_PRESET,
  USERS_LOGIN_AS_ACTION_PRESET,
  USERS_ROW_ACTIONS_PRESET,
} from './designerGridActionColumns';

export {
  defaultRichCellFieldsForKind,
  isRichCellKind,
  USERS_ACCOUNT_COLUMN_PRESET,
  USERS_AVATAR_COLUMN_PRESET,
  USERS_CREATED_AUDIT_COLUMN_PRESET,
  USERS_LOCK_STATUS_COLUMN_PRESET,
  USERS_PROFILE_LINK_COLUMN_PRESET,
  USERS_RICH_COLUMNS_PRESET,
  USERS_ROLES_CHIPS_COLUMN_PRESET,
  USERS_UPDATED_AUDIT_COLUMN_PRESET,
} from './designerGridRichCellColumns';
