/**
 * Unified CRUD Set — list chrome + dialogs driven by CrudSetSpec props.
 * The Client Components wizard only sets these props. Living sample:
 * Base Components → CRUD Set.
 */

import React, { useCallback, useEffect, useMemo, useState, type UIEvent } from 'react';
import { useCrudSetOverlayDeepLink } from './crudSet/useCrudSetOverlayDeepLink';
import type { CrudSetDialogOverlayState } from './crudSet/crudSetWorkspaceOverlay';
import { Check, Eye, FileSpreadsheet, History, KeyRound, Loader2, Lock, LockOpen, Pencil, Plus, Shield, Trash2, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  applyCrudSetFilterBar,
  CRUD_SET_EXPORT_FORMAT_LABELS,
  CRUD_SET_FORM_WIDE_FIELD_COUNT,
  crudSetActionsAlign,
  crudSetActionsMaxVisible,
  crudSetAutoRefreshEnabled,
  crudSetAutoRefreshSeconds,
  crudSetCollectionActionConfirm,
  crudSetCollectionActionIntent,
  crudSetCollectionActions,
  crudSetColumnCardRole,
  crudSetColumnCellKind,
  crudSetColumnCellClassName,
  crudSetColumnHeaderClassName,
  crudSetColumnIsImageColumn,
  crudSetColumnConditionalBackground,
  crudSetColumnFilterable,
  crudSetColumnHideBelow,
  crudSetColumnId,
  crudSetColumnImageMask,
  crudSetColumnIsRowHeader,
  crudSetColumnLabel,
  crudSetColumnPinned,
  crudSetColumnSecondaryField,
  crudSetColumnSortable,
  crudSetColumnStack,
  crudSetColumnTransform,
  crudSetColumnWidth,
  formatCrudSetColumnExportValue,
  formatCrudSetColumnText,
  resolveCrudSetLinkHref,
  crudSetCreateSteps,
  crudSetDisabledWhenMatches,
  crudSetDialogBackdropBlur,
  crudSetDialogBackdropTint,
  crudSetDialogBackdropTransparency,
  crudSetDialogCloseOnEscape,
  crudSetDialogComponentName,
  crudSetDialogConfirmInitialFocus,
  crudSetDialogConfirmSize,
  crudSetDialogFormSizeForFieldCount,
  crudSetDialogShowCloseButton,
  crudSetDialogShowFooter,
  crudSetDialogShowHeader,
  recordFormFieldsIncludeSidePanel,
  recordFormSidePanelPropsFromDialogs,
  crudSetExportDefaultFormat,
  crudSetExportEnabled,
  crudSetExportFormats,
  crudSetFilterBarFilters,
  crudSetFilterBarFiltersForBody,
  crudSetFilterBarSearchClearEnabled,
  crudSetFilterBarSearchEnabled,
  crudSetFilterBarSearchPlaceholder,
  deriveCrudSetKanbanStatusColumns,
  crudSetFilterMatchLogic,
  crudSetGridAriaLabel,
  crudSetGridBorderWidth,
  crudSetGridCardBelow,
  crudSetGridChrome,
  crudSetGridColumnLayoutEnabled,
  crudSetGridCompactPropBag,
  crudSetGridDensity,
  crudSetGridEmptyMessage,
  crudSetGridFillHeight,
  crudSetGridLoadingMessage,
  crudSetGridMargin,
  crudSetGridPresentation,
  crudSetGridSelection,
  crudSetGridShowColumnLayoutControl,
  crudSetGridStickyHeader,
  crudSetListPreferenceKey,
  crudSetJsonViewText,
  crudSetKanbanDescriptionField,
  crudSetKanbanColumnLayout,
  crudSetKanbanColumnTone,
  crudSetKanbanColumnWidth,
  crudSetKanbanColoredColumns,
  crudSetKanbanDensity,
  crudSetKanbanEnableKeyboardMove,
  crudSetKanbanHeight,
  crudSetKanbanHideEmptyColumns,
  crudSetKanbanInteractive,
  crudSetKanbanShowCardCount,
  crudSetKanbanShowDescriptions,
  crudSetKanbanStatusField,
  crudSetKanbanTitleField,
  crudSetKanbanTone,
  crudSetKanbanWipLimit,
  crudSetLockedExportExtension,
  crudSetMapLabelField,
  crudSetMapLatField,
  crudSetMapLngField,
  crudSetOmittedUi,
  crudSetPaginationEnabled,
  crudSetPagingDefaultListMode,
  crudSetPagingDefaultPageSize,
  crudSetPagingFirstLastEnabled,
  crudSetPagingListModeSwitchEnabled,
  crudSetPagingPageNumbersEnabled,
  crudSetPagingPageSizes,
  crudSetPagingSummaryEnabled,
  crudSetPatchOpenFromColumnId,
  crudSetPatchOpensFromActions,
  crudSetRefreshEnabled,
  crudSetRowActions,
  crudSetSortingDefaultDirection,
  crudSetSortingDefaultField,
  crudSetSortingFooterEnabled,
  crudSetSortingFooterFields,
  crudSetSuggestedExportFilename,
  crudSetThreadMessages,
  crudSetViewKind,
  isBooleanTogglePatch,
  resolveCrudSetFilterBarOptions,
  type CrudSetCollectionAction,
  type CrudSetCreateApi,
  type CrudSetExportFormat,
  type CrudSetExportQuery,
  type CrudSetFilterMatchLogic,
  type CrudSetGridColumn,
  type CrudSetHistoryConfig,
  type CrudSetPatchApi,
  type CrudSetRowAction,
  type CrudSetSpec,
} from '../../domain/component-designer/crudSetSpec';
import {
  type GridListMode,
} from '../lib/gridPagingConstants';
import { useGridListPresentation } from '../lib/useGridListPresentation';
import { ListPageShell, ListPageToolbarFrame } from './list-page/listPageToolbarChrome';
import {
  gridActionsColumnWidth,
  resolveGridActionSlotCount,
} from '../lib/gridRowActions';
import type { AppTableGridColumnDef } from '../lib/appTableGridQuery';
import { parseGridCompactFromProps } from '../lib/gridCompactViewport';
import { renderBooleanIcon } from '../lib/gridCellRenderers';
import {
  PLATFORM_DATA_EXPORT_API_PATH,
  requestDesignerServerExport,
} from '../../domain/component-designer/designerDataExport';
import { resolveGridPagingFooterChrome } from '../lib/appTableGridShell';
import { RECORD_CHANGE_REASON_REVERTED, type RecordEventPublicRow } from '../api/contracts/record-events';
import { restoreRecordEventValue, useRecordSubjectHistory } from '../lib/useRecordSubjectHistory';
import { RecordEventHistoryDialog } from './RecordEventHistoryDialog';
import { recordEventHistoryFieldChromeToggle } from './RecordEventHistoryIcon';
import { AppButton } from './AppButton';
import { AppSelectionToggle, APP_SELECTION_TOGGLE_WRAP_CLASS } from './AppSelectionToggle';
import { UiChip } from './UiChip';
import { AppGridRowActions, type GridRowActionItem } from './AppGridRowActions';
import { ToolbarCreateControl } from './ToolbarCreateControl';
import { AppTableGrid } from './AppTableGrid';
import { ConfirmDialogShell } from './ConfirmDialogShell';
import {
  ChangeReasonFields,
  attachChangeReason,
  emptyChangeReason,
  type ChangeReasonValue,
} from './ChangeReasonFields';
import {
  changeReasonAskIsOn,
  changeReasonValueSatisfiesPolicy,
  type ChangeReasonPolicy,
} from '../api/contracts/record-events';
import { CreateEditModalShell } from './CreateEditModalShell';
import { GridPagingFooter } from './GridPagingFooter';
import { showAppFeedbackToast } from './appFeedbackToast';
import { UiCheckbox } from './HeroFieldControls';
import { UiInput } from './ai-field-assist/AiAssistInput';
import {
  defaultRecordFormFieldValue,
  isRecordFormBooleanField,
  isRecordFormChipsField,
  LOOKUP_RECORD_FORM_FIELDS,
  PARENT_RECORD_FORM_FIELDS,
  RecordForm,
  RECORD_FORM_DOCKED_DIALOG_CHROME,
} from './RecordForm';
import { UiSegmentedControl } from './UiSegmentedControl';
import { UiKanbanBoard, type UiKanbanColumn } from './UiKanbanBoard';
import { UiMapPin } from './UiMap';
import { StepWizardShell } from './StepWizardShell';
import { ToolbarRefreshButton } from './ToolbarRefreshButton';
import {
  applyCrudSetListWhereFilter,
  crudSetColumnsToWhereFields,
  crudSetListWhereFilterEnabled,
} from './crudSetListWhere';
import {
  ListFilterDialog,
  ListFilterSummaryBand,
  ListFilterToolbarControl,
  useListFilter,
} from './list-filter';
import { createEmptyWhereTree, DEFAULT_WHERE_OPERATORS } from './where-builder/whereBuilderModel';
import { ToolbarSearchInput } from './ToolbarSearchInput';
import { ToolbarFilterCheckbox } from './ToolbarFilterCheckbox';
import { ToolbarFilterCheckboxGroupItem } from './ToolbarFilterCheckbox';
import { ToolbarFilterMatchLogicBadge } from './ToolbarFilterMatchLogicBadge';
import { ToolbarFilterRadioGroup } from './ToolbarFilterRadioGroup';
import { ToolbarFilterSelect } from './ToolbarFilterSelect';
import {
  APP_TABLE_GRID_ACTION_CELL_CLASS,
  APP_TABLE_GRID_ACTION_HEADER_CLASS,
  GRID_PAGING_FOOTER_SEPARATOR_CLASS,
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS,
  PAGE_TOOLBAR_FILTER_CHECKBOX_GROUP_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  PAGE_TOOLBAR_SINGLE_ROW_CLASS,
} from './surfaceClasses';

export type CrudSetRow = Record<string, unknown> & {
  id?: string;
  parentId?: string;
  __depth?: number;
};

export type CrudSetProps = {
  spec: CrudSetSpec;
  rows: ReadonlyArray<CrudSetRow>;
  getRowKey?: (row: CrudSetRow) => string;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  onCreate?: (create: CrudSetCreateApi, values: Record<string, unknown>) => void | Promise<void>;
  onPatch?: (patch: CrudSetPatchApi, row: CrudSetRow, values: Record<string, unknown>) => void | Promise<void>;
  onDelete?: (row: CrudSetRow, values?: Record<string, unknown>) => void | Promise<void>;
  onHostAction?: (action: CrudSetRowAction, row: CrudSetRow) => void | Promise<void>;
  onCollectionAction?: (action: CrudSetCollectionAction) => void | Promise<void>;
  /** Row key of the signed-in operator — used by `disabledWhen: row-is-self`. */
  currentRowKey?: string;
  /**
   * Fetch every row that matches the active list query (search, toolbar filters, sort).
   * Required when the list is server-paged — the host must walk all pages, not return the
   * current `rows` slice. When omitted, export uses the in-memory queried set (tests / demos).
   */
  onFetchExportRows?: (query: CrudSetExportQuery) => Promise<ReadonlyArray<CrudSetRow>>;
  /** Fired when `grid.selection` is single or multiple. */
  onSelectionChange?: (keys: string[]) => void;
  /** Named-API Ask / Capture / vocab. Omitted policy defaults Ask off. */
  changeReasonPolicy?: ChangeReasonPolicy;
  /** Catalog preview: dialogs stay inside the frame. */
  contained?: boolean;
  className?: string;
};

type DialogState =
  | { kind: 'none' }
  | { kind: 'create'; createId: string }
  | { kind: 'form-patch'; patchId: string; rowKey: string }
  | { kind: 'toggle-confirm'; patchId: string; rowKey: string; nextValue: boolean }
  | { kind: 'delete'; rowKey: string }
  | { kind: 'export' }
  | { kind: 'view'; actionId: string; rowKey: string }
  | { kind: 'host-confirm'; actionId: string; rowKey: string }
  | { kind: 'collection-confirm'; actionId: string };

const EXPORT_DIALOG_HEADER_BAND_CLASS =
  '!overflow-visible !py-2 !border-border-subtle !bg-white';

const EXPORT_DIALOG_SHELL_CLASS =
  'flex h-[500px] min-h-[500px] max-h-[500px] flex-col overflow-hidden';

const EXPORT_DIALOG_BODY_OUTER_CLASS = 'flex min-h-0 flex-1 flex-col overflow-hidden';

const EXPORT_DIALOG_BODY_INNER_CLASS = '!min-h-0 flex-1 overflow-y-auto !p-2';

const stringifyCell = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  return String(value);
};

const UNSPECIFIED_KANBAN_COLUMN = '__unspecified__';

const readFiniteNumber = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const asBooleanCell = (value: unknown): boolean => (
  value === true || value === 1 || value === '1' || value === 'true'
);

const chipValues = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => stringifyCell(item)).filter(Boolean);
  }
  const text = stringifyCell(value);
  if (!text) {
    return [];
  }
  if (text.includes(',')) {
    return text.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [text];
};

const CRUD_SET_STACKED_CELL_CLASS = 'flex w-full flex-col items-start gap-0.5 text-start leading-tight';
const CRUD_SET_STACKED_INLINE_CELL_CLASS = 'inline-flex w-full items-baseline gap-1.5 text-start leading-tight';
const CRUD_SET_STACKED_SECONDARY_CLASS = 'text-[11px] text-start text-slate-500';
const CRUD_SET_FORM_PATCH_LINK_CLASS = 'text-start text-indigo-700 hover:underline';

const renderCrudSetStackedSecondary = (secondary: string): React.ReactNode => (
  <span className={CRUD_SET_STACKED_SECONDARY_CLASS}>{secondary}</span>
);

const wrapCrudSetCellForFormPatch = (
  column: CrudSetGridColumn,
  row: CrudSetRow,
  onOpen: () => void,
): React.ReactNode => {
  const secondaryField = crudSetColumnSecondaryField(column);
  const stack = crudSetColumnStack(column);
  const secondary = secondaryField ? stringifyCell(row[secondaryField]) : '';
  const primary = renderCrudSetPrimaryCell(column, row);

  if (!secondary || stack === 'none') {
    return (
      <button
        type="button"
        className={cn('block w-full', CRUD_SET_FORM_PATCH_LINK_CLASS)}
        onClick={onOpen}
      >
        {primary}
      </button>
    );
  }

  const secondaryNode = renderCrudSetStackedSecondary(secondary);
  if (stack === 'inline') {
    return (
      <span className={CRUD_SET_STACKED_INLINE_CELL_CLASS}>
        <button type="button" className={CRUD_SET_FORM_PATCH_LINK_CLASS} onClick={onOpen}>
          {primary}
        </button>
        {secondaryNode}
      </span>
    );
  }

  return (
    <span className={CRUD_SET_STACKED_CELL_CLASS}>
      <button type="button" className={cn('block', CRUD_SET_FORM_PATCH_LINK_CLASS)} onClick={onOpen}>
        {primary}
      </button>
      {secondaryNode}
    </span>
  );
};

const renderCrudSetPrimaryCell = (column: CrudSetGridColumn, row: CrudSetRow): React.ReactNode => {
  const value = row[column.field];
  const kind = crudSetColumnCellKind(column);
  const transform = crudSetColumnTransform(column);
  if (kind === 'image') {
    const src = stringifyCell(value);
    if (!src) {
      return '';
    }
    return (
      <span className="mx-auto flex h-8 w-8 items-center justify-center">
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          className={cn(
            'h-full w-full object-cover',
            crudSetColumnImageMask(column) === 'circle' ? 'rounded-full' : 'rounded-md',
          )}
        />
      </span>
    );
  }
  if (kind === 'boolean-icon') {
    if (
      transform === 'boolean-yes-no'
      || transform === 'boolean-on-off'
      || transform === 'boolean-true-false'
    ) {
      const label = formatCrudSetColumnText(column, value);
      return label || '';
    }
    if (value == null || value === '') {
      return renderBooleanIcon(null);
    }
    return renderBooleanIcon(asBooleanCell(value));
  }
  if (kind === 'lock-status') {
    if (value == null || value === '') {
      return '';
    }
    const locked = asBooleanCell(value);
    const at = stringifyCell(row[locked ? 'lockedAt' : 'unlockedAt']);
    const by = stringifyCell(row[locked ? 'lockedBy' : 'unlockedBy']);
    const icon = locked
      ? <Lock className="h-3.5 w-3.5 text-rose-600" aria-label="Locked" />
      : <LockOpen className="h-3.5 w-3.5 text-emerald-600" aria-label="Unlocked" />;
    if (!at && !by) {
      return icon;
    }
    return (
      <span className="flex items-start gap-1.5 text-start leading-tight">
        <span className="mt-0.5 inline-flex shrink-0">{icon}</span>
        <span className="flex min-w-0 flex-col items-start gap-0.5">
          {at ? (
            <span className="font-mono text-[11px] text-slate-400">
              {formatCrudSetColumnText({ field: 'lockedAt', transform: 'date' }, at)}
            </span>
          ) : null}
          {by ? <span className="text-[10px] text-slate-600">{by}</span> : null}
        </span>
      </span>
    );
  }
  if (kind === 'chips') {
    if (value == null || value === '') {
      return '';
    }
    if (transform === 'chips-comma' || transform === 'chips-count') {
      const text = formatCrudSetColumnText(column, value);
      return text ? <span>{text}</span> : '';
    }
    return (
      <span className="inline-flex flex-wrap gap-1">
        {chipValues(value).map((item) => (
          <UiChip key={item} size="sm" variant="soft">{item}</UiChip>
        ))}
      </span>
    );
  }
  const text = formatCrudSetColumnText(column, value);
  if (!text) {
    return '';
  }
  if (kind === 'badge') {
    const formatted = crudSetColumnConditionalBackground(column, value);
    return (
      <span
        className={cn(
          'inline-flex self-start rounded-full px-2 py-0.5 text-[11px] font-medium text-slate-700',
          formatted ? null : 'border border-slate-200 bg-slate-50',
        )}
      >
        {text}
      </span>
    );
  }
  if (kind === 'date' || kind === 'audit') {
    return <span className="font-mono text-[11px] text-slate-600">{text}</span>;
  }
  if (kind === 'link') {
    const href = resolveCrudSetLinkHref(value);
    if (!href || !text) {
      return text || '';
    }
    const external = /^https?:\/\//i.test(href);
    return (
      <a
        href={href}
        className="text-indigo-700 hover:underline"
        target={external ? '_blank' : undefined}
        rel={external ? 'noreferrer' : undefined}
      >
        {text}
      </a>
    );
  }
  return text;
};

const renderCrudSetCellValue = (column: CrudSetGridColumn, row: CrudSetRow): React.ReactNode => {
  const primary = renderCrudSetPrimaryCell(column, row);
  const secondaryField = crudSetColumnSecondaryField(column);
  const stack = crudSetColumnStack(column);
  if (!secondaryField || stack === 'none') {
    return primary;
  }
  const secondary = stringifyCell(row[secondaryField]);
  if (!secondary) {
    return primary;
  }
  const secondaryNode = renderCrudSetStackedSecondary(secondary);
  if (stack === 'inline') {
    return (
      <span className={CRUD_SET_STACKED_INLINE_CELL_CLASS}>
        {primary}
        {secondaryNode}
      </span>
    );
  }
  return (
    <span className={CRUD_SET_STACKED_CELL_CLASS}>
      {primary}
      {secondaryNode}
    </span>
  );
};

const crudSetColumnFilterConfig = (
  column: CrudSetGridColumn,
): AppTableGridColumnDef<CrudSetRow>['filter'] => {
  if (!crudSetColumnFilterable(column)) {
    return false;
  }
  const kind = crudSetColumnCellKind(column);
  if (kind === 'boolean-icon' || kind === 'lock-status') {
    return { type: 'boolean' };
  }
  if (kind === 'date' || kind === 'audit') {
    return { type: 'dateRange' };
  }
  return { type: 'text' };
};

const sortFilterValue = (column: CrudSetGridColumn, value: unknown): string | number | boolean | null => {
  const kind = crudSetColumnCellKind(column);
  if (kind === 'boolean-icon' || kind === 'lock-status') {
    if (value == null || value === '') {
      return null;
    }
    return asBooleanCell(value);
  }
  if (kind === 'date' || kind === 'audit' || crudSetColumnTransform(column).startsWith('date')) {
    return formatCrudSetColumnText(column, value);
  }
  return stringifyCell(value);
};

const crudSetRowIdentity = (spec: { columns: CrudSetGridColumn[] }, row: CrudSetRow): string => {
  const header = spec.columns.find((column, index) => crudSetColumnIsRowHeader(column, index));
  const fallback = spec.columns.find((column) => crudSetColumnCellKind(column) !== 'image') ?? spec.columns[0];
  const column = header ?? fallback;
  if (!column) {
    return stringifyCell(row.id);
  }
  return formatCrudSetColumnText(column, row[column.field]) || stringifyCell(row.id);
};

const stripExportExtension = (filename: string): string => (
  filename.replace(/\.(xlsx|csv)$/i, '')
);

export const CrudSet: React.FC<CrudSetProps> = ({
  spec,
  rows,
  getRowKey,
  isLoading = false,
  isError = false,
  errorMessage,
  isRefreshing = false,
  onRefresh,
  onCreate,
  onPatch,
  onDelete,
  onHostAction,
  onCollectionAction,
  currentRowKey,
  onFetchExportRows,
  onSelectionChange,
  changeReasonPolicy,
  contained = false,
  className,
}) => {
  const omitted = crudSetOmittedUi(spec);
  const paginationOn = crudSetPaginationEnabled(spec);
  const exportOn = crudSetExportEnabled(spec);
  const refreshOn = crudSetRefreshEnabled(spec);
  const searchOn = crudSetFilterBarSearchEnabled(spec);
  const listWhereOn = crudSetListWhereFilterEnabled(spec);
  const toolbarFilters = crudSetFilterBarFiltersForBody(spec);
  const whereFields = useMemo(
    () => crudSetColumnsToWhereFields(spec.columns),
    [spec.columns],
  );
  const [listWhereTree, setListWhereTree] = useState(createEmptyWhereTree);
  const listFilter = useListFilter({
    value: listWhereTree,
    fields: whereFields,
    operators: DEFAULT_WHERE_OPERATORS,
    onApply: setListWhereTree,
  });
  const pagingPageSize = crudSetPagingDefaultPageSize(spec);
  const pagingListMode = crudSetPagingDefaultListMode(spec);
  const pagingSortField = crudSetSortingDefaultField(spec);
  const pagingSortDirection = crudSetSortingDefaultDirection(spec);
  const selectionMode = crudSetGridSelection(spec);
  const maxVisibleActions = crudSetActionsMaxVisible(spec);
  const actionsAlign = crudSetActionsAlign(spec);
  const columnLayoutOn = crudSetGridColumnLayoutEnabled(spec);
  const [search, setSearch] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [checkboxSelections, setCheckboxSelections] = useState<Record<string, Record<string, boolean>>>({});
  const [radioSelections, setRadioSelections] = useState<Record<string, string>>({});
  const [matchLogicByFilterId, setMatchLogicByFilterId] = useState<Record<string, CrudSetFilterMatchLogic>>({});
  const [pageSize, setPageSize] = useState(pagingPageSize);
  const [listMode, setListMode] = useState<GridListMode>(pagingListMode);
  const [sortBy, setSortBy] = useState(pagingSortField);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(pagingSortDirection);
  const [dialog, setDialog] = useState<DialogState>({ kind: 'none' });
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [changeReason, setChangeReason] = useState<ChangeReasonValue>(emptyChangeReason());
  const [createStep, setCreateStep] = useState(0);
  const [autoRefreshOn, setAutoRefreshOn] = useState(crudSetAutoRefreshEnabled(spec));
  const [exportColumns, setExportColumns] = useState<string[]>(spec.columns.map(crudSetColumnId));
  const [exportFilename, setExportFilename] = useState(crudSetSuggestedExportFilename(spec));
  const [exportIncludeHeader, setExportIncludeHeader] = useState(spec.export?.defaultIncludeHeader !== false);
  const [exportFormat, setExportFormat] = useState<CrudSetExportFormat>(crudSetExportDefaultFormat(spec));
  const [busy, setBusy] = useState(false);
  const [historyPeekKey, setHistoryPeekKey] = useState<string | null>(null);
  const [reasonOverlay, setReasonOverlay] = useState<
    | null
    | { kind: 'patch' }
    | { kind: 'kanban'; rowKey: string; nextStatus: string }
  >(null);
  const [kanbanRevertSignal, setKanbanRevertSignal] = useState(0);
  const effectiveChangeReasonPolicy = changeReasonPolicy ?? {
    reasonAsk: 'off' as const,
    reasonCapture: 'both' as const,
  };
  const reasonAskOn = changeReasonAskIsOn(effectiveChangeReasonPolicy.reasonAsk);
  const reasonRequired = effectiveChangeReasonPolicy.reasonAsk === 'required';
  const reasonReady = changeReasonValueSatisfiesPolicy(changeReason, effectiveChangeReasonPolicy);

  const resolveRowKey = useCallback((row: CrudSetRow): string => {
    if (getRowKey) {
      return getRowKey(row);
    }
    if (row.id != null && String(row.id)) {
      return String(row.id);
    }
    return stringifyCell(row[spec.columns[0]?.field ?? '']);
  }, [getRowKey, spec.columns]);

  useEffect(() => {
    setPageSize(pagingPageSize);
  }, [pagingPageSize]);
  useEffect(() => {
    setListMode(pagingListMode);
  }, [pagingListMode]);
  useEffect(() => {
    setSortBy(pagingSortField);
  }, [pagingSortField]);
  useEffect(() => {
    setSortDirection(pagingSortDirection);
  }, [pagingSortDirection]);
  useEffect(() => {
    setAutoRefreshOn(crudSetAutoRefreshEnabled(spec));
  }, [spec.autoRefresh?.enabled, spec.refresh]);

  useEffect(() => {
    if (!spec.columns.some((column) => column.field === sortBy)) {
      setSortBy(crudSetSortingDefaultField(spec));
    }
  }, [spec.columns, sortBy]);

  useEffect(() => {
    setAutoRefreshOn(crudSetAutoRefreshEnabled(spec));
  }, [spec.autoRefresh?.enabled, spec.refresh]);

  useEffect(() => {
    if (!autoRefreshOn || !crudSetAutoRefreshEnabled(spec) || !onRefresh) {
      return undefined;
    }
    const timer = window.setInterval(() => onRefresh(), crudSetAutoRefreshSeconds(spec) * 1000);
    return () => window.clearInterval(timer);
  }, [autoRefreshOn, onRefresh, spec.autoRefresh?.enabled, spec.autoRefresh?.seconds, spec.refresh]);

  const filteredRows = useMemo(() => {
    const afterBar = applyCrudSetFilterBar(rows, spec, {
      searchText: search,
      checkboxSelections,
      radioSelections,
      matchLogicByFilterId,
    });
    return listWhereOn ? applyCrudSetListWhereFilter(afterBar, listWhereTree) : afterBar;
  }, [
    checkboxSelections,
    listWhereOn,
    listWhereTree,
    matchLogicByFilterId,
    radioSelections,
    rows,
    search,
    spec,
  ]);

  const queriedRows = useMemo(() => {
    const next = [...filteredRows];
    next.sort((left, right) => {
      const compared = stringifyCell(left[sortBy]).localeCompare(
        stringifyCell(right[sortBy]),
        undefined,
        { numeric: true },
      );
      return sortDirection === 'asc' ? compared : -compared;
    });
    return next;
  }, [filteredRows, sortBy, sortDirection]);

  const presentation = useGridListPresentation({
    items: queriedRows,
    pageSize,
    listMode,
    resetKeys: [search, spec.name, sortBy, sortDirection, listWhereTree],
  });

  const onGridScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    if (!paginationOn) return;
    presentation.handleScrollEnd(event, queriedRows.length, presentation.hasMore);
  }, [paginationOn, presentation, queriedRows.length]);

  const displayRows = paginationOn ? presentation.displayItems : queriedRows;
  const keyedRows = useMemo(
    () => new Map(rows.map((row) => [resolveRowKey(row), row])),
    [rows, resolveRowKey],
  );
  const historySpec: CrudSetHistoryConfig | undefined = spec.history;
  const historyRowKey = (
    dialog.kind === 'form-patch'
    || dialog.kind === 'view'
    || dialog.kind === 'delete'
    || dialog.kind === 'toggle-confirm'
      ? dialog.rowKey
      : historyPeekKey
  );
  const historyRow = historyRowKey ? keyedRows.get(historyRowKey) : undefined;
  const historySubjectId = historyRow
    ? String(historyRow[historySpec?.subjectIdField ?? 'id'] ?? historyRowKey ?? '')
    : '';
  const history = useRecordSubjectHistory({
    subjectKind: historySpec?.subjectKind ?? '',
    subjectId: historySubjectId,
    fieldMap: historySpec?.fieldMap,
    trackedFields: historySpec?.trackedFields,
    enabled: Boolean(historySpec?.subjectKind) && dialog.kind !== 'create',
  });

  const rowKeySet = useMemo(
    () => new Set(rows.map((row) => resolveRowKey(row))),
    [resolveRowKey, rows],
  );
  const createIdSet = useMemo(
    () => new Set((spec.createApis ?? []).map((item) => item.id)),
    [spec.createApis],
  );
  const patchIdSet = useMemo(
    () => new Set(spec.patches.map((item) => item.id)),
    [spec.patches],
  );
  const rowActionIdSet = useMemo(
    () => new Set([
      ...(spec.rowActions ?? []).map((item) => item.id),
      ...(spec.collectionActions ?? []).map((item) => item.id),
    ]),
    [spec.collectionActions, spec.rowActions],
  );

  const dialogOverlayState = dialog as CrudSetDialogOverlayState;

  useCrudSetOverlayDeepLink({
    enabled: !contained,
    dialog: dialogOverlayState,
    setDialog: (next) => {
      if (next.kind === 'history') {
        return;
      }
      setDialog(next as DialogState);
    },
    filterOpen: listFilter.filterOpen,
    openFilter: listFilter.openFilter,
    closeFilter: listFilter.closeFilter,
    historyOpen: history.dialogOpen,
    historyRowKey: history.dialogOpen ? (historyRowKey ?? null) : null,
    openHistoryForRow: (rowKey) => {
      setHistoryPeekKey(rowKey);
    },
    rowKeys: rowKeySet,
    validateCreateId: (createId) => createIdSet.has(createId),
    validatePatchId: (patchId) => patchIdSet.has(patchId),
    validateActionId: (actionId) => rowActionIdSet.has(actionId),
  });

  useEffect(() => {
    if (!historyPeekKey || !history.available || history.dialogOpen) {
      return;
    }
    history.openHistory();
  }, [history, historyPeekKey]);

  const kanbanStatusField = crudSetKanbanStatusField(spec);
  const kanbanTitleField = crudSetKanbanTitleField(spec);
  const kanbanDescriptionField = crudSetKanbanDescriptionField(spec);
  const kanbanWipLimit = crudSetKanbanWipLimit(spec);
  const kanbanStatusColumns = useMemo(
    () => deriveCrudSetKanbanStatusColumns(spec, queriedRows),
    [queriedRows, spec],
  );
  const kanbanColumns = useMemo((): UiKanbanColumn[] => {
    const buckets = new Map<string, CrudSetRow[]>();
    for (const column of kanbanStatusColumns) {
      buckets.set(column.value, []);
    }
    for (const row of displayRows) {
      const status = stringifyCell(row[kanbanStatusField]).trim() || UNSPECIFIED_KANBAN_COLUMN;
      const bucket = buckets.get(status) ?? [];
      bucket.push(row);
      buckets.set(status, bucket);
    }
    const orderedStatuses = kanbanStatusColumns.length > 0
      ? kanbanStatusColumns.map((column) => column.value)
      : [...buckets.keys()];
    const columns = orderedStatuses.map((status, index) => {
      const bucket = buckets.get(status) ?? [];
      const preset = kanbanStatusColumns.find((column) => column.value === status);
      return {
        id: status,
        title: status === UNSPECIFIED_KANBAN_COLUMN
          ? 'Unspecified'
          : (preset?.label ?? status),
        tone: crudSetKanbanColumnTone(index, spec),
        cards: bucket.map((row) => ({
          id: resolveRowKey(row),
          title: stringifyCell(row[kanbanTitleField]) || resolveRowKey(row),
          description: stringifyCell(row[kanbanDescriptionField]) || undefined,
        })),
      };
    });
    if (kanbanStatusColumns.length === 0) {
      for (const [status, bucket] of buckets.entries()) {
        if (!orderedStatuses.includes(status)) {
          columns.push({
            id: status,
            title: status === UNSPECIFIED_KANBAN_COLUMN ? 'Unspecified' : status,
            tone: crudSetKanbanColumnTone(columns.length, spec),
            cards: bucket.map((row) => ({
              id: resolveRowKey(row),
              title: stringifyCell(row[kanbanTitleField]) || resolveRowKey(row),
              description: stringifyCell(row[kanbanDescriptionField]) || undefined,
            })),
          });
        }
      }
    }
    return crudSetKanbanHideEmptyColumns(spec)
      ? columns.filter((column) => column.cards.length > 0)
      : columns;
  }, [
    displayRows,
    kanbanDescriptionField,
    kanbanStatusColumns,
    kanbanStatusField,
    kanbanTitleField,
    resolveRowKey,
    spec,
  ]);
  const mapPins = useMemo(() => {
    const latField = crudSetMapLatField(spec);
    const lngField = crudSetMapLngField(spec);
    const labelField = crudSetMapLabelField(spec);
    return displayRows.flatMap((row) => {
      const lat = readFiniteNumber(row[latField]);
      const lng = readFiniteNumber(row[lngField]);
      if (lat == null || lng == null) {
        return [];
      }
      return [{
        id: resolveRowKey(row),
        lat,
        lng,
        label: stringifyCell(row[labelField]) || stringifyCell(row.title) || resolveRowKey(row),
      }];
    });
  }, [displayRows, resolveRowKey, spec.map]);

  const closeDialog = () => {
    setDialog({ kind: 'none' });
    setFormValues({});
    setChangeReason(emptyChangeReason());
    setReasonOverlay(null);
    setBusy(false);
    setHistoryPeekKey(null);
  };

  const openCreate = (create: CrudSetCreateApi) => {
    const values: Record<string, unknown> = {};
    for (const field of create.acceptedFields) {
      const column = spec.columns.find((item) => item.field === field);
      const kind = crudSetColumnCellKind(column ?? { field });
      values[field] = defaultRecordFormFieldValue(field, kind);
    }
    setFormValues(values);
    setCreateStep(0);
    setDialog({ kind: 'create', createId: create.id });
  };

  const openFormPatch = useCallback((patch: CrudSetPatchApi, row: CrudSetRow) => {
    const values: Record<string, unknown> = {};
    for (const field of patch.acceptedFields) {
      const column = spec.columns.find((item) => item.field === field);
      const kind = crudSetColumnCellKind(column ?? { field });
      if (isRecordFormChipsField(field, kind, row[field])) {
        values[field] = chipValues(row[field]);
      } else {
        values[field] = row[field] ?? (isRecordFormBooleanField(field, kind, row[field]) ? false : '');
      }
    }
    setFormValues(values);
    setDialog({ kind: 'form-patch', patchId: patch.id, rowKey: resolveRowKey(row) });
  }, [resolveRowKey, spec.columns]);

  const kanbanEditPatch = useMemo(() => {
    const formPatches = spec.patches.filter((patch) => !isBooleanTogglePatch(patch));
    return formPatches.find((patch) => patch.kind === 'content')
      ?? formPatches.find((patch) => !crudSetPatchOpenFromColumnId(patch, spec));
  }, [spec]);

  const handleKanbanCardClick = useCallback(({ cardId }: { cardId: string }) => {
    if (!kanbanEditPatch) {
      return;
    }
    const row = keyedRows.get(cardId)
      ?? displayRows.find((item) => resolveRowKey(item) === cardId);
    if (row) {
      openFormPatch(kanbanEditPatch, row);
    }
  }, [displayRows, kanbanEditPatch, keyedRows, openFormPatch, resolveRowKey]);

  const applyToggle = useCallback(async (patch: CrudSetPatchApi, row: CrudSetRow, nextValue: boolean) => {
    const field = patch.acceptedFields[0];
    if (!field) {
      return;
    }
    if (reasonRequired && !reasonReady) {
      showAppFeedbackToast('A change reason is required.', { type: 'error' });
      return;
    }
    setBusy(true);
    try {
      await onPatch?.(patch, row, attachChangeReason({ [field]: nextValue }, changeReason));
      showAppFeedbackToast(`${patch.label} saved.`, { type: 'success' });
      closeDialog();
      onRefresh?.();
    } catch (error) {
      showAppFeedbackToast(error instanceof Error ? error.message : 'Update failed.', { type: 'error' });
      setBusy(false);
    }
  }, [changeReason, onPatch, onRefresh, reasonReady, reasonRequired]);

  const applyKanbanStatus = useCallback(async (row: CrudSetRow, nextStatus: string) => {
    const patch = spec.patches.find((item) => (
      !isBooleanTogglePatch(item) && item.acceptedFields.includes(kanbanStatusField)
    ));
    if (!patch || nextStatus === UNSPECIFIED_KANBAN_COLUMN) {
      return;
    }
    if (reasonRequired && !reasonReady) {
      showAppFeedbackToast('A change reason is required.', { type: 'error' });
      return;
    }
    setBusy(true);
    try {
      await onPatch?.(patch, row, attachChangeReason({ [kanbanStatusField]: nextStatus }, changeReason));
      showAppFeedbackToast(`${patch.label} saved.`, { type: 'success' });
      setChangeReason(emptyChangeReason());
      setReasonOverlay(null);
      onRefresh?.();
    } catch (error) {
      showAppFeedbackToast(error instanceof Error ? error.message : 'Update failed.', { type: 'error' });
      setKanbanRevertSignal((current) => current + 1);
    } finally {
      setBusy(false);
    }
  }, [changeReason, kanbanStatusField, onPatch, onRefresh, reasonReady, reasonRequired, spec.patches]);

  const handleToggleClick = useCallback((patch: CrudSetPatchApi, row: CrudSetRow) => {
    const field = patch.acceptedFields[0];
    if (!field) {
      return;
    }
    const nextValue = !Boolean(row[field]);
    if (patch.toggleConfirm || reasonAskOn) {
      setDialog({
        kind: 'toggle-confirm',
        patchId: patch.id,
        rowKey: resolveRowKey(row),
        nextValue,
      });
      return;
    }
    void applyToggle(patch, row, nextValue);
  }, [applyToggle, reasonAskOn, resolveRowKey]);

  const sortOptions = crudSetSortingFooterFields(spec).map((column) => ({
    value: column.field,
    label: crudSetColumnLabel(column),
  }));

  const pagingFooter = paginationOn ? (
    <div data-testid="crud-set-paging">
      <GridPagingFooter
        chrome={resolveGridPagingFooterChrome(crudSetGridChrome(spec))}
        totalCount={presentation.totalCount}
        safePage={presentation.safePage}
        pageSize={pageSize}
        pageSizes={crudSetPagingPageSizes(spec)}
        onPageSizeChange={setPageSize}
        sortBy={sortBy}
        sortOptions={sortOptions.length > 0 ? sortOptions : [{
          value: crudSetSortingDefaultField(spec),
          label: crudSetSortingDefaultField(spec),
        }]}
        onSortByChange={setSortBy}
        sortDirection={sortDirection}
        onToggleSortDirection={() => setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))}
        totalPages={presentation.totalPages}
        pageNumbers={presentation.pageNumbers}
        onPageChange={presentation.setPage}
        listMode={listMode}
        onListModeChange={crudSetPagingListModeSwitchEnabled(spec) ? setListMode : undefined}
        visibleInfiniteCount={presentation.visibleInfiniteCount}
        showSortControls={crudSetSortingFooterEnabled(spec)}
        showSummary={crudSetPagingSummaryEnabled(spec)}
        showFirstLast={crudSetPagingFirstLastEnabled(spec)}
        showPageNumbers={crudSetPagingPageNumbersEnabled(spec)}
      />
    </div>
  ) : null;

  const extraRowActions = crudSetRowActions(spec);

  const isRowActionDisabled = useCallback((
    disabledWhen: CrudSetPatchApi['disabledWhen'] | CrudSetRowAction['disabledWhen'] | CrudSetSpec['deleteDisabledWhen'],
    row: CrudSetRow,
  ): boolean => crudSetDisabledWhenMatches(
    disabledWhen,
    row,
    currentRowKey,
    (item) => resolveRowKey(item as CrudSetRow),
  ), [currentRowKey, resolveRowKey]);

  const openRowView = useCallback((action: CrudSetRowAction, row: CrudSetRow) => {
    const fields = action.acceptedFields?.length
      ? action.acceptedFields
      : spec.columns.map((column) => column.field);
    const values: Record<string, unknown> = {};
    for (const field of fields) {
      values[field] = row[field];
    }
    setFormValues(values);
    setDialog({ kind: 'view', actionId: action.id, rowKey: resolveRowKey(row) });
  }, [resolveRowKey, spec.columns]);

  const runHostAction = useCallback(async (action: CrudSetRowAction, row: CrudSetRow) => {
    setBusy(true);
    try {
      await onHostAction?.(action, row);
      showAppFeedbackToast(`${action.label} done.`, { type: 'success' });
      closeDialog();
      onRefresh?.();
    } catch (error) {
      showAppFeedbackToast(error instanceof Error ? error.message : 'Action failed.', { type: 'error' });
      setBusy(false);
    }
  }, [onHostAction, onRefresh]);

  const handleRowActionClick = useCallback((action: CrudSetRowAction, row: CrudSetRow) => {
    if (action.interaction === 'view') {
      openRowView(action, row);
      return;
    }
    if (action.interaction === 'confirm') {
      setDialog({ kind: 'host-confirm', actionId: action.id, rowKey: resolveRowKey(row) });
      return;
    }
    void runHostAction(action, row);
  }, [openRowView, resolveRowKey, runHostAction]);

  const cardRowActionsForRow = useCallback((row: CrudSetRow): GridRowActionItem[] => {
    const togglePatches = spec.patches.filter((patch) => isBooleanTogglePatch(patch));
    const formPatches = spec.patches.filter((patch) => !isBooleanTogglePatch(patch));
    const contentPatch = formPatches.find((patch) => patch.kind === 'content');
    const purposeFormPatches = formPatches.filter((patch) => patch.kind === 'purpose');
    const actions: GridRowActionItem[] = [];
    for (const patch of togglePatches) {
      if (crudSetPatchOpenFromColumnId(patch, spec)) {
        continue;
      }
      const field = patch.acceptedFields[0];
      const locked = Boolean(field ? row[field] : false);
      actions.push({
        id: patch.id,
        label: patch.label,
        intent: 'warning',
        icon: <Lock className="h-3.5 w-3.5" />,
        title: locked ? `${patch.label} (on)` : patch.label,
        disabled: isRowActionDisabled(patch.disabledWhen, row),
        onClick: () => handleToggleClick(patch, row),
      });
    }
    for (const patch of purposeFormPatches) {
      if (crudSetPatchOpenFromColumnId(patch, spec)) {
        continue;
      }
      actions.push({
        id: patch.id,
        label: patch.label,
        intent: 'utility',
        icon: <Check className="h-3.5 w-3.5" />,
        disabled: isRowActionDisabled(patch.disabledWhen, row),
        onClick: () => openFormPatch(patch, row),
      });
    }
    if (contentPatch && !crudSetPatchOpenFromColumnId(contentPatch, spec)) {
      actions.push({
        id: contentPatch.id,
        label: contentPatch.label,
        intent: 'edit',
        icon: <Pencil className="h-3.5 w-3.5" />,
        disabled: isRowActionDisabled(contentPatch.disabledWhen, row),
        onClick: () => openFormPatch(contentPatch, row),
      });
    }
    for (const action of extraRowActions) {
      if (action.openFromColumnId && action.openFromColumnId !== 'actions') {
        continue;
      }
      actions.push({
        id: action.id,
        label: action.label,
        intent: action.intent ?? (action.interaction === 'view' ? 'view' : 'access'),
        icon: action.interaction === 'view'
          ? <Eye className="h-3.5 w-3.5" />
          : <Shield className="h-3.5 w-3.5" />,
        disabled: isRowActionDisabled(action.disabledWhen, row),
        onClick: () => handleRowActionClick(action, row),
      });
    }
    if (spec.deleteApi) {
      actions.push({
        id: 'delete',
        label: 'Delete',
        intent: 'delete',
        icon: <Trash2 className="h-3.5 w-3.5" />,
        disabled: isRowActionDisabled(spec.deleteDisabledWhen, row),
        onClick: () => setDialog({ kind: 'delete', rowKey: resolveRowKey(row) }),
      });
    }
    if (historySpec?.subjectKind) {
      actions.unshift({
        id: 'history',
        label: 'History',
        intent: 'view',
        icon: <History className="h-3.5 w-3.5" />,
        onClick: () => {
          setHistoryPeekKey(resolveRowKey(row));
          history.openHistory();
        },
      });
    }
    return actions;
  }, [
    extraRowActions,
    handleRowActionClick,
    handleToggleClick,
    history,
    historySpec,
    isRowActionDisabled,
    openFormPatch,
    resolveRowKey,
    spec,
  ]);

  const gridColumns = useMemo((): AppTableGridColumnDef<CrudSetRow>[] => {
    const dataColumns: AppTableGridColumnDef<CrudSetRow>[] = spec.columns.map((column, columnIndex) => {
      const columnId = crudSetColumnId(column);
      const openPatch = spec.patches.find((patch) => {
        const openFrom = crudSetPatchOpenFromColumnId(patch, spec);
        return openFrom === columnId || openFrom === column.field;
      });
      return {
        id: columnId,
        label: crudSetColumnLabel(column),
        width: crudSetColumnWidth(column, columnIndex),
        cellClassName: crudSetColumnCellClassName(column),
        headerClassName: crudSetColumnHeaderClassName(column),
        getCellStyle: (row) => {
          const background = crudSetColumnConditionalBackground(column, row[column.field]);
          return background ? { backgroundColor: background } : undefined;
        },
        getSortValue: (row) => sortFilterValue(column, row[column.field]),
        getFilterValue: (row) => sortFilterValue(column, row[column.field]),
        sort: crudSetColumnSortable(column) ? undefined : false,
        filter: crudSetColumnFilterConfig(column),
        isRowHeader: crudSetColumnIsRowHeader(column, columnIndex),
        hideBelow: crudSetColumnHideBelow(column),
        layout: {
          hideable: columnLayoutOn && column.hideable !== false,
          resizable: column.resizable !== false,
          reorderable: columnLayoutOn && column.reorderable !== false,
          ...(columnLayoutOn && crudSetColumnPinned(column) !== 'none'
            ? { pinned: crudSetColumnPinned(column) }
            : {}),
        },
        card: {
          role: crudSetColumnCardRole(column, spec.columns, columnIndex),
          ...(crudSetColumnIsImageColumn(column)
            ? {}
            : { label: column.cardLabel?.trim() || crudSetColumnLabel(column) }),
          ...(typeof column.cardPriority === 'number' ? { priority: column.cardPriority } : {}),
          ...(column.phoneRole ? { phoneRole: column.phoneRole } : {}),
          ...(column.tabletRole ? { tabletRole: column.tabletRole } : {}),
        },
        renderCell: (row) => {
          const depth = typeof row.__depth === 'number' ? row.__depth : 0;
          const rendered = openPatch && !isBooleanTogglePatch(openPatch) && !crudSetColumnIsImageColumn(column)
            ? wrapCrudSetCellForFormPatch(column, row, () => openFormPatch(openPatch, row))
            : renderCrudSetCellValue(column, row);
          if (spec.listBody === 'tree-grid' && columnIndex === 0) {
            return <span style={{ paddingInlineStart: depth * 16 }}>{rendered}</span>;
          }
          return rendered;
        },
      };
    });

    const actionsForRow = cardRowActionsForRow;

    const hasActions = spec.patches.some((patch) => !crudSetPatchOpenFromColumnId(patch, spec))
      || Boolean(spec.deleteApi)
      || extraRowActions.some((action) => !action.openFromColumnId || action.openFromColumnId === 'actions');
    if (!hasActions) {
      return dataColumns;
    }
    const sampleCount = actionsForRow({}).length;
    const width = gridActionsColumnWidth(resolveGridActionSlotCount(sampleCount, maxVisibleActions));
    return [
      ...dataColumns,
      {
        id: '__actions',
        label: 'Actions',
        width,
        headerClassName: APP_TABLE_GRID_ACTION_HEADER_CLASS,
        cellClassName: APP_TABLE_GRID_ACTION_CELL_CLASS,
        sort: false,
        filter: false,
        layout: false,
        card: { role: 'actions' },
        renderCell: (row) => (
          <AppGridRowActions
            actions={actionsForRow(row)}
            maxVisible={maxVisibleActions}
            align={actionsAlign}
          />
        ),
      },
    ];
  }, [cardRowActionsForRow, extraRowActions, spec, maxVisibleActions, actionsAlign, columnLayoutOn]);

  const activeCreate = dialog.kind === 'create'
    ? spec.createApis.find((create) => create.id === dialog.createId)
    : undefined;
  const activeCreateSteps = activeCreate ? crudSetCreateSteps(activeCreate) : [];
  const extraRowActionById = useMemo(
    () => new Map(extraRowActions.map((action) => [action.id, action])),
    [extraRowActions],
  );
  const collectionActionById = useMemo(
    () => new Map(crudSetCollectionActions(spec).map((action) => [action.id, action])),
    [spec.collectionActions],
  );
  const activePatch = dialog.kind === 'form-patch' || dialog.kind === 'toggle-confirm'
    ? spec.patches.find((patch) => patch.id === dialog.patchId)
    : undefined;
  const activeRow = dialog.kind === 'form-patch'
    || dialog.kind === 'delete'
    || dialog.kind === 'toggle-confirm'
    || dialog.kind === 'view'
    || dialog.kind === 'host-confirm'
    ? keyedRows.get(dialog.rowKey)
    : undefined;
  const activeRowAction = dialog.kind === 'view' || dialog.kind === 'host-confirm'
    ? extraRowActionById.get(dialog.actionId)
    : undefined;
  const activeCollectionAction = dialog.kind === 'collection-confirm'
    ? collectionActionById.get(dialog.actionId)
    : undefined;

  const submitCreate = async () => {
    if (!activeCreate) {
      return;
    }
    setBusy(true);
    try {
      await onCreate?.(activeCreate, formValues);
      showAppFeedbackToast(`${activeCreate.label} saved.`, { type: 'success' });
      closeDialog();
      onRefresh?.();
    } catch (error) {
      showAppFeedbackToast(error instanceof Error ? error.message : 'Create failed.', { type: 'error' });
      setBusy(false);
    }
  };

  const submitPatch = async () => {
    if (!activePatch || !activeRow) {
      return;
    }
    if (!reasonReady) {
      showAppFeedbackToast('A change reason is required.', { type: 'error' });
      return;
    }
    setBusy(true);
    try {
      await onPatch?.(activePatch, activeRow, attachChangeReason(formValues, changeReason));
      showAppFeedbackToast(`${activePatch.label} saved.`, { type: 'success' });
      closeDialog();
      onRefresh?.();
    } catch (error) {
      showAppFeedbackToast(error instanceof Error ? error.message : 'Update failed.', { type: 'error' });
      setBusy(false);
    }
  };

  const restoreHistoryField = async (event: RecordEventPublicRow) => {
    const value = restoreRecordEventValue(event.fromValue);
    if (value === undefined || !event.field || !historyRow || !onPatch) return;
    const contentPatch = spec.patches.find((patch) => patch.kind === 'content');
    if (!contentPatch) return;
    const formField = Object.entries(historySpec?.fieldMap ?? {}).find(([, mapped]) => mapped === event.field)?.[0]
      ?? event.field;
    try {
      await onPatch(contentPatch, historyRow, attachChangeReason({
        [formField]: value,
        __revertedFromSeq: event.subjectSeq,
        __revertedFromEventId: event.id,
      }, {
        code: RECORD_CHANGE_REASON_REVERTED,
        text: 'Restored previous value',
      }));
      if (history.dialogOpen) {
        history.openHistory(history.dialogField ?? undefined);
      }
      onRefresh?.();
    } catch (error) {
      showAppFeedbackToast(error instanceof Error ? error.message : 'Restore failed.', { type: 'error' });
    }
  };

  const submitDelete = async () => {
    if (!activeRow) {
      return;
    }
    setBusy(true);
    try {
      await onDelete?.(activeRow, attachChangeReason({}, changeReason));
      showAppFeedbackToast('Record deleted.', { type: 'success' });
      closeDialog();
      onRefresh?.();
    } catch (error) {
      showAppFeedbackToast(error instanceof Error ? error.message : 'Delete failed.', { type: 'error' });
      setBusy(false);
    }
  };

  const submitExport = async () => {
    const selected = spec.columns.filter((column) => exportColumns.includes(crudSetColumnId(column)));
    const exportSpecColumns = selected.length > 0 ? selected : spec.columns;
    const columns = exportSpecColumns.map((column) => ({
      key: crudSetColumnId(column),
      label: crudSetColumnLabel(column),
    }));
    const exportQuery: CrudSetExportQuery = {
      searchText: search,
      checkboxSelections,
      radioSelections,
      matchLogicByFilterId,
      sortBy,
      sortDirection,
    };
    setBusy(true);
    try {
      const sourceRows = onFetchExportRows
        ? await onFetchExportRows(exportQuery)
        : queriedRows;
      const exportRows = sourceRows.map((row) => {
        const next: Record<string, unknown> = {};
        for (const column of exportSpecColumns) {
          next[crudSetColumnId(column)] = formatCrudSetColumnExportValue(column, row);
        }
        return next;
      });
      await requestDesignerServerExport({
        format: exportFormat,
        rows: exportRows,
        columns,
        filename: stripExportExtension(exportFilename),
        includeHeader: exportIncludeHeader,
        apiPath: PLATFORM_DATA_EXPORT_API_PATH,
      });
      showAppFeedbackToast('Export downloaded.', { type: 'success' });
      closeDialog();
    } catch (error) {
      showAppFeedbackToast(error instanceof Error ? error.message : 'Export failed.', { type: 'error' });
      setBusy(false);
    }
  };

  const fieldSelectOptions = (field: string, kind: ReturnType<typeof crudSetColumnCellKind>): string[] => {
    if (PARENT_RECORD_FORM_FIELDS.has(field)) {
      const seen = new Set<string>();
      for (const row of rows) {
        if (activeRow && resolveRowKey(row) === resolveRowKey(activeRow)) {
          continue;
        }
        const title = stringifyCell(row.title).trim();
        if (title) {
          seen.add(title);
        }
      }
      return [...seen];
    }
    const fromFilter = crudSetFilterBarFilters(spec)
      .find((filter) => filter.field === field)
      ?.options.map((option) => option.value.trim())
      .filter(Boolean) ?? [];
    if (fromFilter.length > 0) {
      return fromFilter;
    }
    if (kind !== 'badge' && !LOOKUP_RECORD_FORM_FIELDS.has(field)) {
      return [];
    }
    const seen = new Set<string>();
    for (const row of rows) {
      const text = stringifyCell(row[field]).trim();
      if (text) {
        seen.add(text);
      }
    }
    return [...seen];
  };

  const fieldChipOptions = (field: string): string[] => {
    const seen = new Set(chipValues(formValues[field]));
    for (const row of rows) {
      for (const item of chipValues(row[field])) {
        seen.add(item);
      }
    }
    return [...seen];
  };

  const renderRecordForm = (mode: 'create' | 'edit' | 'view', formFields: readonly string[]) => (
    <RecordForm
      mode={mode}
      columns={spec.columns}
      fields={formFields}
      values={formValues}
      onChange={setFormValues}
      selectOptions={fieldSelectOptions}
      chipOptions={fieldChipOptions}
      {...recordFormSidePanelPropsFromDialogs(spec)}
      componentName={crudSetDialogComponentName(spec, mode === 'create' ? 'create' : mode === 'edit' ? 'edit' : 'view')}
      historyTrackedFields={historySpec?.trackedFields}
      historyFieldMap={historySpec?.fieldMap}
      onOpenRecordHistory={
        mode === 'create' || !history.available
          ? undefined
          : () => history.openHistory()
      }
      onOpenFieldHistory={
        mode === 'create' || !history.available || !history.fieldIconsVisible
          ? undefined
          : history.openHistory
      }
    />
  );

  const createChrome = omitted.create || spec.createApis.length === 0 ? null : (
    <ToolbarCreateControl
      data-testid="crud-set-create"
      items={spec.createApis.map((create) => ({
        id: create.id,
        label: create.label ?? 'Create',
        onClick: () => openCreate(create),
      }))}
      triggerAriaLabel={spec.createApis.length === 1
        ? (spec.createApis[0]?.label ?? 'Create')
        : 'Create'}
    />
  );

  const collectionActions = crudSetCollectionActions(spec);
  const autoRefreshAvailable = crudSetAutoRefreshEnabled(spec);
  const filtersOn = searchOn || toolbarFilters.length > 0 || listWhereOn;
  const actionsOn = Boolean(createChrome) || exportOn || refreshOn || collectionActions.length > 0 || autoRefreshAvailable;
  const toolbarOn = filtersOn || actionsOn;
  const dialogBackdropChrome = {
    showCloseButton: crudSetDialogShowCloseButton(spec),
    closeOnEscape: crudSetDialogCloseOnEscape(spec),
    backdropTint: crudSetDialogBackdropTint(spec),
    backdropBlur: crudSetDialogBackdropBlur(spec),
    backdropTransparency: crudSetDialogBackdropTransparency(spec),
  };
  const formDialogChrome = (formFields: readonly string[], docked?: boolean) => {
    const dockSide = docked ?? recordFormFieldsIncludeSidePanel(spec.columns, formFields);
    return {
      size: crudSetDialogFormSizeForFieldCount(spec, formFields.length),
      showHeader: crudSetDialogShowHeader(spec),
      ...(dockSide ? RECORD_FORM_DOCKED_DIALOG_CHROME : {}),
      ...dialogBackdropChrome,
    };
  };
  const confirmDialogChrome = {
    size: crudSetDialogConfirmSize(spec),
    showCloseButton: crudSetDialogShowCloseButton(spec),
    closeOnEscape: crudSetDialogCloseOnEscape(spec),
    initialFocus: crudSetDialogConfirmInitialFocus(spec),
    backdropTint: crudSetDialogBackdropTint(spec),
    backdropBlur: crudSetDialogBackdropBlur(spec),
    backdropTransparency: crudSetDialogBackdropTransparency(spec),
  };

  const reasonFields = reasonAskOn ? (
    <div className="mt-4">
      <ChangeReasonFields
        value={changeReason}
        onChange={setChangeReason}
        required={reasonRequired}
        capture={effectiveChangeReasonPolicy.reasonCapture}
        vocabNodeId={effectiveChangeReasonPolicy.reasonVocabNodeId}
        includeGeneral={effectiveChangeReasonPolicy.reasonIncludeGeneral}
      />
    </div>
  ) : null;

  return (
    <ListPageShell
      data-testid="crud-set"
      onGridScroll={onGridScroll}
      className={cn(contained && 'relative', className)}
    >
      {toolbarOn ? (
      <ListPageToolbarFrame className="justify-between">
        <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS} data-testid="crud-set-toolbar">
          {searchOn ? (
            <ToolbarSearchInput
              value={search}
              onChange={setSearch}
              placeholder={crudSetFilterBarSearchPlaceholder(spec)}
              ariaLabel="Search list"
              showClear={crudSetFilterBarSearchClearEnabled(spec)}
            />
          ) : null}
          {toolbarFilters.map((filter) => {
            const options = resolveCrudSetFilterBarOptions(filter, rows);
            if (options.length === 0) {
              return null;
            }
            if (filter.controlType === 'checkbox-group') {
              const selection = checkboxSelections[filter.id] ?? {};
              return (
                <div
                  key={filter.id}
                  className={PAGE_TOOLBAR_FILTER_CHECKBOX_GROUP_CLASS}
                  data-testid={`crud-set-filter-${filter.id}`}
                >
                  <ToolbarFilterMatchLogicBadge
                    value={crudSetFilterMatchLogic(filter, matchLogicByFilterId[filter.id])}
                    onChange={(next) => setMatchLogicByFilterId((current) => ({
                      ...current,
                      [filter.id]: next,
                    }))}
                    ariaLabel={`${filter.label} match logic`}
                  />
                  <span className="h-4 w-px shrink-0 bg-slate-200" aria-hidden />
                  {options.map((option) => (
                    <ToolbarFilterCheckboxGroupItem
                      key={option.value}
                      id={`crud-set-filter-${filter.id}-${option.value}`}
                      checked={Boolean(selection[option.value])}
                      onChange={(checked) => setCheckboxSelections((current) => ({
                        ...current,
                        [filter.id]: {
                          ...(current[filter.id] ?? {}),
                          [option.value]: checked,
                        },
                      }))}
                    >
                      {option.label}
                    </ToolbarFilterCheckboxGroupItem>
                  ))}
                </div>
              );
            }
            if (filter.controlType === 'select') {
              return (
                <ToolbarFilterSelect
                  key={filter.id}
                  value={radioSelections[filter.id] ?? filter.defaultValue ?? ''}
                  options={options}
                  onChange={(value) => setRadioSelections((current) => ({
                    ...current,
                    [filter.id]: value,
                  }))}
                  ariaLabel={filter.label}
                  multiple={filter.multiple === true}
                />
              );
            }
            return (
              <ToolbarFilterRadioGroup
                key={filter.id}
                value={radioSelections[filter.id] ?? filter.defaultValue ?? ''}
                options={options}
                onChange={(value) => setRadioSelections((current) => ({
                  ...current,
                  [filter.id]: value,
                }))}
                ariaLabel={filter.label}
              />
            );
          })}
          {listWhereOn ? (
            <ListFilterToolbarControl
              filterButtonProps={listFilter.filterButtonProps}
              separatorBefore={searchOn || toolbarFilters.some((filter) => {
                const options = resolveCrudSetFilterBarOptions(filter, rows);
                return options.length > 0;
              })}
            />
          ) : null}
        </div>
        <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
          {createChrome}
          {collectionActions.map((action) => (
            <AppButton
              key={action.id}
              type="button"
              intent={crudSetCollectionActionIntent(action)}
              size="sm"
              data-testid={`crud-set-collection-${action.id}`}
              onClick={() => {
                if (crudSetCollectionActionConfirm(action)) {
                  setDialog({ kind: 'collection-confirm', actionId: action.id });
                  return;
                }
                void (async () => {
                  setBusy(true);
                  try {
                    await onCollectionAction?.(action);
                    showAppFeedbackToast(`${action.label} done.`, { type: 'success' });
                    setBusy(false);
                    onRefresh?.();
                  } catch (error) {
                    showAppFeedbackToast(error instanceof Error ? error.message : 'Action failed.', { type: 'error' });
                    setBusy(false);
                  }
                })();
              }}
            >
              {crudSetCollectionActionIntent(action) === 'destructive-soft'
                ? <Trash2 className="h-3.5 w-3.5" />
                : <Check className="h-3.5 w-3.5" />}
              {action.label}
            </AppButton>
          ))}
          {exportOn ? (
            <AppButton
              type="button"
              intent="secondary"
              size="sm"
              data-testid="crud-set-export"
              onClick={() => {
                setExportColumns(spec.columns.map(crudSetColumnId));
                setExportFilename(crudSetSuggestedExportFilename(spec));
                setExportIncludeHeader(spec.export?.defaultIncludeHeader !== false);
                setExportFormat(crudSetExportDefaultFormat(spec));
                setDialog({ kind: 'export' });
              }}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
              Export
            </AppButton>
          ) : null}
          {autoRefreshAvailable ? (
            <ToolbarFilterCheckbox
              id="crud-set-auto-refresh"
              checked={autoRefreshOn}
              onChange={setAutoRefreshOn}
            >
              {`Auto-refresh (${crudSetAutoRefreshSeconds(spec)}s)`}
            </ToolbarFilterCheckbox>
          ) : null}
          {refreshOn ? (
            <ToolbarRefreshButton
              onClick={() => onRefresh?.()}
              isRefreshing={isRefreshing}
              separatorBefore={
                Boolean(createChrome)
                || exportOn
                || collectionActions.length > 0
                || autoRefreshAvailable
              }
            />
          ) : null}
        </div>
      </ListPageToolbarFrame>
      ) : null}
      {listWhereOn ? <ListFilterSummaryBand {...listFilter.filterSummaryProps} /> : null}

      <div className="flex min-h-0 w-full flex-1 flex-col">
        {spec.listBody === 'kanban' ? (
          <div className="flex min-h-0 flex-1 flex-col" data-testid="crud-set-kanban">
            {isLoading ? (
              <p className="p-4 text-sm text-slate-500">{crudSetGridLoadingMessage(spec)}</p>
            ) : isError ? (
              <p className="p-4 text-sm text-rose-600">{errorMessage ?? 'Could not load records.'}</p>
            ) : queriedRows.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">{crudSetGridEmptyMessage(spec)}</p>
            ) : (
              <>
                <div className="flex min-h-0 flex-1 flex-col p-3">
                  <UiKanbanBoard
                    columns={kanbanColumns}
                    revertSignal={kanbanRevertSignal}
                    height={crudSetKanbanHeight(spec)}
                    tone={crudSetKanbanTone(spec)}
                    columnWidth={crudSetKanbanColumnWidth(spec)}
                    columnLayout={crudSetKanbanColumnLayout(spec)}
                    density={crudSetKanbanDensity(spec)}
                    showCardCount={crudSetKanbanShowCardCount(spec)}
                    showDescriptions={crudSetKanbanShowDescriptions(spec)}
                    interactive={crudSetKanbanInteractive(spec) && !busy && reasonOverlay == null}
                    enableKeyboardMove={crudSetKanbanEnableKeyboardMove(spec)}
                    canMoveCard={kanbanWipLimit > 0
                      ? ({ toColumnId, columns }) => {
                        const target = columns.find((column) => column.id === toColumnId);
                        return (target?.cards.length ?? 0) < kanbanWipLimit;
                      }
                      : undefined}
                    onCardMove={({ cardId, toColumnId, fromColumnId }) => {
                      if (toColumnId === fromColumnId) {
                        return;
                      }
                      const row = keyedRows.get(cardId)
                        ?? displayRows.find((item) => resolveRowKey(item) === cardId);
                      if (row) {
                        if (reasonAskOn) {
                          setKanbanRevertSignal((current) => current + 1);
                          setReasonOverlay({
                            kind: 'kanban',
                            rowKey: resolveRowKey(row),
                            nextStatus: toColumnId,
                          });
                          return;
                        }
                        void applyKanbanStatus(row, toColumnId);
                      }
                    }}
                    onCardClick={kanbanEditPatch
                      ? ({ card }) => handleKanbanCardClick({ cardId: card.id })
                      : undefined}
                  />
                </div>
                {pagingFooter}
              </>
            )}
          </div>
        ) : spec.listBody === 'map' ? (
          <div className="flex min-h-0 flex-1 flex-col" data-testid="crud-set-map">
            {isLoading ? (
              <p className="p-4 text-sm text-slate-500">{crudSetGridLoadingMessage(spec)}</p>
            ) : isError ? (
              <p className="p-4 text-sm text-rose-600">{errorMessage ?? 'Could not load records.'}</p>
            ) : mapPins.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">{crudSetGridEmptyMessage(spec)}</p>
            ) : (
              <UiMapPin
                data={mapPins}
                clusterMarkers
                height={520}
                className="h-full min-h-[320px] w-full"
              />
            )}
          </div>
        ) : (
        <AppTableGrid
          fillHeight={crudSetGridFillHeight(spec)}
          stickyHeader={crudSetGridStickyHeader(spec)}
          chrome={crudSetGridChrome(spec)}
          size={crudSetGridDensity(spec) === 'compact' ? 'xs' : 'sm'}
          presentation={crudSetGridPresentation(spec)}
          cardBelow={crudSetGridCardBelow(spec)}
          getCardRowActions={cardRowActionsForRow}
          cardActionsMaxVisible={maxVisibleActions}
          margin={crudSetGridMargin(spec)}
          borderWidth={crudSetGridBorderWidth(spec)}
          ariaLabel={crudSetGridAriaLabel(spec)}
          persistListKey={crudSetListPreferenceKey(spec)}
          enableColumnLayout={columnLayoutOn}
          showColumnLayoutControl={crudSetGridShowColumnLayoutControl(spec)}
          compact={parseGridCompactFromProps(crudSetGridCompactPropBag(spec))}
          selectionMode={selectionMode}
          selectedKeys={selectionMode === 'none' ? undefined : selectedKeys}
          onSelectionChange={selectionMode === 'none'
            ? undefined
            : (keys) => {
              setSelectedKeys(keys);
              onSelectionChange?.(keys);
            }}
          columns={gridColumns}
          rows={displayRows}
          getRowKey={resolveRowKey}
          isLoading={isLoading}
          loadingMessage={crudSetGridLoadingMessage(spec)}
          isEmpty={!isLoading && !isError && displayRows.length === 0}
          emptyMessage={crudSetGridEmptyMessage(spec)}
          errorContent={isError ? (errorMessage ?? 'Could not load records.') : undefined}
          footer={pagingFooter ?? undefined}
        />
        )}
      </div>

      {dialog.kind === 'create' && activeCreate && activeCreateSteps.length >= 2 ? (
        <StepWizardShell
          contained={contained}
          title={activeCreate.label}
          steps={activeCreateSteps.map((step, index) => ({
            title: step.title,
            icon: index === 0 ? KeyRound : index === activeCreateSteps.length - 1 ? Shield : Pencil,
          }))}
          step={createStep}
          onStepChange={setCreateStep}
          onClose={closeDialog}
          size={crudSetDialogFormSizeForFieldCount(spec, activeCreate.acceptedFields.length)}
          finalStepAction={{
            label: busy ? 'Saving...' : activeCreate.label,
            icon: <Plus className="h-3.5 w-3.5" />,
            disabled: busy,
            onClick: () => void submitCreate(),
          }}
        >
          {renderRecordForm('create', activeCreateSteps[createStep]?.acceptedFields ?? activeCreate.acceptedFields)}
        </StepWizardShell>
      ) : null}

      {dialog.kind === 'create' && activeCreate && activeCreateSteps.length < 2 ? (
        <CreateEditModalShell
          contained={contained}
          title={activeCreate.label}
          onClose={closeDialog}
          {...formDialogChrome(activeCreate.acceptedFields)}
          footer={crudSetDialogShowFooter(spec) ? (
            <>
              <AppButton type="button" intent="cancel" onClick={closeDialog}>Cancel</AppButton>
              <AppButton type="button" intent="create" onClick={() => void submitCreate()} disabled={busy}>
                {busy ? 'Saving...' : activeCreate.label}
              </AppButton>
            </>
          ) : undefined}
        >
          {renderRecordForm('create', activeCreate.acceptedFields)}
        </CreateEditModalShell>
      ) : null}

      {dialog.kind === 'form-patch' && activePatch && activeRow ? (
        <CreateEditModalShell
          contained={contained}
          title={activePatch.label}
          onClose={closeDialog}
          {...formDialogChrome(activePatch.acceptedFields)}
          headerExtra={recordEventHistoryFieldChromeToggle(history)}
          footer={crudSetDialogShowFooter(spec) ? (
            <>
              <AppButton type="button" intent="cancel" onClick={closeDialog}>Cancel</AppButton>
              <AppButton
                type="button"
                intent="primary"
                onClick={() => {
                  if (reasonAskOn) {
                    setReasonOverlay({ kind: 'patch' });
                    return;
                  }
                  void submitPatch();
                }}
                disabled={busy}
              >
                {busy ? 'Saving...' : 'Save'}
              </AppButton>
            </>
          ) : undefined}
        >
          {renderRecordForm('edit', activePatch.acceptedFields)}
        </CreateEditModalShell>
      ) : null}

      {dialog.kind === 'toggle-confirm' && activePatch && activeRow ? (
        <ConfirmDialogShell
          contained={contained}
          title={activePatch.label}
          onClose={closeDialog}
          {...confirmDialogChrome}
          confirmIntent="primary"
          confirmLabel={activePatch.label}
          onConfirm={() => void applyToggle(activePatch, activeRow, dialog.nextValue)}
          isConfirming={busy}
          confirmDisabled={!reasonReady}
        >
          <p className="text-sm text-slate-600">
            {crudSetRowIdentity(spec, activeRow)}
            {' '}
            will become
            {' '}
            {dialog.nextValue ? 'on' : 'off'}
            .
          </p>
          {reasonFields}
        </ConfirmDialogShell>
      ) : null}

      {dialog.kind === 'delete' && activeRow ? (
        <ConfirmDialogShell
          contained={contained}
          tone="danger"
          confirmIntent="destructive"
          title="Delete record"
          confirmLabel="Delete"
          onClose={closeDialog}
          {...confirmDialogChrome}
          size={spec.columns.length > CRUD_SET_FORM_WIDE_FIELD_COUNT ? 'lg' : confirmDialogChrome.size}
          onConfirm={() => void submitDelete()}
          isConfirming={busy}
          confirmDisabled={!reasonReady}
        >
          <RecordForm
            mode="view"
            columns={spec.columns}
            fields={spec.columns.map((column) => column.field)}
            values={activeRow}
            {...recordFormSidePanelPropsFromDialogs(spec)}
            componentName={crudSetDialogComponentName(spec, 'view')}
            onOpenRecordHistory={history.available ? () => history.openHistory() : undefined}
          />
          {reasonFields}
        </ConfirmDialogShell>
      ) : null}

      {dialog.kind === 'view' && activeRow && activeRowAction ? (
        <CreateEditModalShell
          contained={contained}
          title={activeRowAction.label}
          onClose={closeDialog}
          {...formDialogChrome(
            activeRowAction.acceptedFields?.length
              ? activeRowAction.acceptedFields
              : spec.columns.map((column) => column.field),
            crudSetViewKind(spec) === 'record-form'
              ? undefined
              : false,
          )}
          headerExtra={recordEventHistoryFieldChromeToggle(history)}
          footer={crudSetDialogShowFooter(spec) ? (
            <AppButton type="button" intent="cancel" onClick={closeDialog}>Close</AppButton>
          ) : undefined}
        >
          {crudSetViewKind(spec) === 'json' ? (
            <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-slate-700">
              {crudSetJsonViewText(activeRow, spec) || '—'}
            </pre>
          ) : crudSetViewKind(spec) === 'thread' ? (
            <div className="flex max-h-[60vh] flex-col gap-2 overflow-auto">
              {crudSetThreadMessages(activeRow, spec).map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-sm whitespace-pre-wrap break-words',
                    message.role === 'user'
                      ? 'border-indigo-100 bg-indigo-50 text-indigo-900'
                      : message.role === 'system'
                        ? 'border-amber-100 bg-amber-50 text-amber-900'
                        : 'border-slate-200 bg-slate-50 text-slate-800',
                  )}
                >
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide opacity-70">{message.role}</p>
                  {message.body}
                </div>
              ))}
            </div>
          ) : (
            renderRecordForm('view', activeRowAction.acceptedFields?.length
              ? activeRowAction.acceptedFields
              : spec.columns.map((column) => column.field))
          )}
        </CreateEditModalShell>
      ) : null}

      {dialog.kind === 'host-confirm' && activeRow && activeRowAction ? (
        <ConfirmDialogShell
          contained={contained}
          title={activeRowAction.label}
          onClose={closeDialog}
          {...confirmDialogChrome}
          confirmLabel={activeRowAction.label}
          onConfirm={() => void runHostAction(activeRowAction, activeRow)}
          isConfirming={busy}
        >
          <p className="text-sm text-slate-600">
            {crudSetRowIdentity(spec, activeRow)}
          </p>
        </ConfirmDialogShell>
      ) : null}

      {dialog.kind === 'collection-confirm' && activeCollectionAction ? (
        <ConfirmDialogShell
          contained={contained}
          {...(crudSetCollectionActionIntent(activeCollectionAction) === 'destructive-soft'
            ? { tone: 'danger' as const }
            : {})}
          confirmIntent={crudSetCollectionActionIntent(activeCollectionAction) === 'destructive-soft' ? 'destructive' : 'primary'}
          title={activeCollectionAction.label}
          confirmLabel={activeCollectionAction.label}
          onClose={closeDialog}
          {...confirmDialogChrome}
          onConfirm={() => {
            void (async () => {
              setBusy(true);
              try {
                await onCollectionAction?.(activeCollectionAction);
                showAppFeedbackToast(`${activeCollectionAction.label} done.`, { type: 'success' });
                closeDialog();
                onRefresh?.();
              } catch (error) {
                showAppFeedbackToast(error instanceof Error ? error.message : 'Action failed.', { type: 'error' });
                setBusy(false);
              }
            })();
          }}
          isConfirming={busy}
        >
          <p className="text-sm text-slate-600">
            Apply {activeCollectionAction.label.toLowerCase()} to the queried set.
          </p>
        </ConfirmDialogShell>
      ) : null}

      {dialog.kind === 'export' ? (
        <CreateEditModalShell
          contained={false}
          title="Export"
          onClose={closeDialog}
          {...dialogBackdropChrome}
          size="2xl"
          shellClassName={EXPORT_DIALOG_SHELL_CLASS}
          bodyOuterClassName={EXPORT_DIALOG_BODY_OUTER_CLASS}
          bodyClassName={EXPORT_DIALOG_BODY_INNER_CLASS}
          subtitleTone="elevated"
          subtitleClassName={EXPORT_DIALOG_HEADER_BAND_CLASS}
          subtitle={(
            <div className="flex w-full min-w-0 flex-wrap items-center gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                  File name
                </span>
                <UiInput
                  value={exportFilename}
                  ariaLabel="Export file name"
                  aiAssist={false}
                  className="min-w-0 flex-1"
                  endContent={crudSetLockedExportExtension(exportFormat)}
                  endContentClassName="bg-slate-50 px-2.5 text-xs font-semibold text-slate-600"
                  onChange={(event) => setExportFilename(stripExportExtension(event.target.value))}
                />
              </div>
              <span className={GRID_PAGING_FOOTER_SEPARATOR_CLASS} aria-hidden />
              <UiSegmentedControl
                ariaLabel="Export format"
                items={crudSetExportFormats(spec).map((format) => ({
                  id: format,
                  label: CRUD_SET_EXPORT_FORMAT_LABELS[format],
                }))}
                selectedKey={exportFormat}
                onSelectionChange={(key) => {
                  if (key === 'csv' || key === 'xlsx') {
                    setExportFormat(key);
                  }
                }}
              />
            </div>
          )}
          metaBandTone="elevated"
          metaBandClassName={EXPORT_DIALOG_HEADER_BAND_CLASS}
          metaBand={(
            <UiCheckbox
              checked={exportIncludeHeader}
              onChange={(event) => setExportIncludeHeader(event.target.checked)}
            >
              Include header
            </UiCheckbox>
          )}
          footer={(
            <>
              <AppButton type="button" intent="cancel" onClick={closeDialog}>
                <X className="h-3.5 w-3.5" />
                Cancel
              </AppButton>
              <AppButton type="button" intent="primary" onClick={() => void submitExport()} disabled={busy}>
                {busy
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <FileSpreadsheet className="h-3.5 w-3.5" />}
                {busy ? 'Exporting...' : 'Export'}
              </AppButton>
            </>
          )}
        >
          <div className={APP_SELECTION_TOGGLE_WRAP_CLASS}>
            {spec.columns.map((column) => {
              const columnId = crudSetColumnId(column);
              const selected = exportColumns.includes(columnId);
              return (
                <AppSelectionToggle
                  key={columnId}
                  selected={selected}
                  onClick={() => {
                    setExportColumns((current) => {
                      if (current.includes(columnId)) {
                        return current.filter((id) => id !== columnId);
                      }
                      return spec.columns
                        .map(crudSetColumnId)
                        .filter((id) => id === columnId || current.includes(id));
                    });
                  }}
                >
                  {crudSetColumnLabel(column)}
                </AppSelectionToggle>
              );
            })}
          </div>
        </CreateEditModalShell>
      ) : null}
      {reasonOverlay && reasonAskOn ? (
        <ConfirmDialogShell
          contained={contained}
          title={reasonOverlay.kind === 'kanban' ? 'Confirm status change' : 'Confirm save'}
          onClose={() => {
            if (reasonOverlay.kind === 'kanban') {
              setChangeReason(emptyChangeReason());
              setKanbanRevertSignal((current) => current + 1);
            }
            setReasonOverlay(null);
          }}
          {...confirmDialogChrome}
          confirmIntent="primary"
          confirmLabel="Save"
          onConfirm={() => {
            const pending = reasonOverlay;
            if (pending.kind === 'patch') {
              void submitPatch();
              return;
            }
            const row = keyedRows.get(pending.rowKey)
              ?? displayRows.find((item) => resolveRowKey(item) === pending.rowKey);
            if (row) {
              void applyKanbanStatus(row, pending.nextStatus);
            }
          }}
          isConfirming={busy}
          confirmDisabled={!reasonReady}
        >
          {reasonFields}
        </ConfirmDialogShell>
      ) : null}
      <RecordEventHistoryDialog
        open={history.dialogOpen}
        title={history.dialogField ? `History · ${history.dialogField}` : 'History'}
        subjectKind={history.subjectKind}
        subjectId={history.subjectId}
        field={history.dialogField}
        fieldMap={historySpec?.fieldMap}
        contained={contained}
        onClose={() => {
          history.closeHistory();
          setHistoryPeekKey(null);
        }}
        onRestore={historySpec?.restore === false ? undefined : (item) => void restoreHistoryField(item)}
      />
      {listWhereOn ? <ListFilterDialog {...listFilter.filterDialogProps} /> : null}
    </ListPageShell>
  );
};
