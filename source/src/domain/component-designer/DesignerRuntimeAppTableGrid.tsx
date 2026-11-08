import * as React from 'react';
import { useLocation } from 'react-router-dom';
import { AlertCircle, RefreshCw } from 'lucide-react';
import {
  applyClientGridQuery,
  EMPTY_GRID_QUERY,
  sanitizeGridQuery,
  type AppTableGridColumnDef,
  type GridSortDirection,
  type GridQueryState,
} from '../../shared/lib/appTableGridQuery';
import {
  areColumnLayoutsEqual,
  buildColumnLayoutDefinitionSignature,
  createDefaultColumnLayout,
  mergeStoredColumnLayoutWidths,
  sanitizeColumnLayout,
  type GridColumnLayoutChangeMeta,
  type GridColumnLayoutState,
} from '../../shared/lib/appTableGridColumnLayout';
import { parseGridCompactFromProps } from '../../shared/lib/gridCompactViewport';
import { sanitizeGridCardBelow } from '../../shared/lib/appTableGridPresentation';
import type { GridListMode } from '../../shared/lib/gridPagingConstants';
import { resolveAppTableGridSizeFromDensity } from '../../shared/lib/appTableGridDensity';
import { readDocumentReadingDirection, resolveCultureShellIsRtl } from '../../core/culture/cultureShellDirection';
import { renderBooleanIcon } from '../../shared/lib/gridCellRenderers';
import {
  HwyNewlineStackedLinesCell,
  resolveHwyStackedLinesTextAlignFromGridColumn,
  HwyElectoralProvinceFallbackCell,
} from '../../shared/lib/hwyMemberDirectoryPathDisplay';
import { HwyMemberDirectoryElectoralDivisionGridCell } from '../../shared/ui/hwy/HwyMemberDirectoryElectoralDivisionGridCell';
import {
  applyHwyMemberDirectoryElectoralColumnCellAlign,
  applyHwyMemberDirectoryListFaceColumnWidth,
  reorderHwyMemberDirectoryElectoralColumnThird,
  applyHwyMemberNakhebinListNameColumnWidth,
  applyHwyMembersAllListMembershipOnColumnWidth,
  applyHwyMembersAllListPhoneColumnWidth,
  applyHwyMembersAllListResidenceColumnWidth,
  applyHwyNakhebinListVotedColumnCenter,
  enforceHwyMemberDirectoryListFaceColumnGridDef,
  enforceHwyMemberDirectoryElectoralColumnGridDef,
  enforceHwyMemberDirectorySegmentListRtlColumnGridDef,
  enforceHwyMemberDirectoryJobTypePlaceColumnGridDef,
  enforceHwyMemberNakhebinListNameColumnGridDef,
  enforceHwyMembersAllListMembershipOnColumnGridDef,
  enforceHwyMembersAllListNakhebinColumnGridDef,
  enforceHwyMembersAllListPhoneColumnGridDef,
  enforceHwyNakhebinListVotedColumnGridDef,
  enforceHwyNakhebinListWrapTextColumnGridDef,
  enforceHwyMembersAllListResidenceColumnGridDef,
  isHwyMemberDirectorySegmentListGrid,
  isHwyMembersAllListGrid,
  isHwyNakhebinListGrid,
} from '../hwy/hwyMemberNakhebinListColumnWidths';
import {
  enforceHwyInstitutesIdColumnGridDef,
  isHwyInstitutesListGrid,
} from '../hwy/hwyInstitutesListColumnAlign';
import { resolveHwyInstituteDisplayLogoUrl } from '../hwy/hwyInstituteLogoUrl';
import { rowShowsHwyFamilyHouseholdCellClick } from '../hwy/hwyFamilyHousehold';
import { openHwyFamilyHouseholdFromDesignerGrid } from '../hwy/hwyFamilyHouseholdRuntime';
import {
  openHwyImageFixEditorFromDesignerGrid,
  registerImageFixEditorPageMembers,
  registerHwyImageFixListRefreshHandler,
  rowShowsHwyImageFixEditorCellClick,
} from '../hwy/hwyImageFixEditorRuntime';
import { HwyImageFixListToolbar } from '../hwy/HwyImageFixListToolbar';
import { HwyImageFixRuntimeDialogs } from '../hwy/HwyImageFixRuntimeDialogs';
import {
  openHwyMemberListScopedEditFromDesignerGrid,
  registerHwyMemberListScopedEditListScope,
  rowShowsHwyMemberListScopedEditCellClick,
} from '../hwy/hwyMemberListScopedEditRuntime';
import { HwyMemberListScopedEditRuntimeDialogs } from '../hwy/HwyMemberListScopedEditRuntimeDialogs';
import { resolveHwyMemberListScopedEditProfile } from '../hwy/hwyMemberListScopedEditCatalog';
import {
  applyHwyMemberListScopedEditCharacterColumnChrome,
  mergeHwyMemberListScopedEditDesignerColumns,
} from '../hwy/hwyMemberListScopedEditGridColumns';
import {
  buildHwyMemberImageFixListFilterStorePatches,
  createDefaultHwyMemberImageFixListFilters,
  createHwyMemberImageFixListFiltersForSimpleSearch,
  readHwyMemberImageFixListFiltersFromStore,
  type HwyMemberImageFixListFilterState,
} from '../hwy/hwyMemberImageFixListFilters';
import { HwyLegacyFieldFilterBarToggle } from '../../shared/ui/hwy/HwyLegacyFieldFilterBarToggle';
import { useHwyLegacyFieldFilterBarMode } from '../../shared/ui/hwy/useHwyLegacyFieldFilterBarMode';
import { HwyMemberDirectoryLegacyFieldByFieldPanel } from '../hwy/HwyMemberDirectoryLegacyFieldByFieldPanel';
import { isHwyMemberListStructuredFieldByFieldLegacyScope } from '../hwy/hwyMemberListStructuredFieldByFieldScopes';
import { HWY_MEMBER_DIRECTORY_MEMBERSHIP_FILTER_STORE_PATH } from '../hwy/HwyMemberDirectoryLegacyMembershipCheckboxes';
import {
  HWY_MONTADHEMIN_INSTITUTE_FILTER_STORE_PATH,
  HWY_MONTADHEMIN_INSTITUTE_MATCH_STORE_PATH,
} from '../hwy/hwyMontadheminInstituteFilterOptions';
import { localizeHwyMemberDirectoryListWhereFields } from '../hwy/hwyMemberDirectoryListWhereFieldLabels';
import { buildClearHwyMemberDirectoryLegacyFilterStorePatches } from '../hwy/hwyMemberDirectoryLegacyFilterModel';
import { isHwyMemberImageFixListScope } from '../hwy/hwyMemberImageFixCatalog';
import {
  HWY_MEMBER_IMAGE_FIX_PAGE_NAME,
  resolveHwyMemberDirectoryFooterSortOptions,
} from '../hwy/hwyMemberDirectoryListSort';
import {
  enforceHwyImageFixListActionsColumnGridDef,
  enforceHwyImageFixListDocumentsColumnGridDef,
  enforceHwyImageFixListMemberColumnGridDef,
  enforceHwyImageFixListRegisteredColumnGridDef,
  isHwyMemberImageFixListFromScope,
} from '../hwy/hwyMemberImageFixListColumnWidths';
import { HwyFamilyHouseholdLinkTrigger } from '../hwy/HwyFamilyHouseholdLinkTrigger';
import {
  appendHwyWaitedListMembershipActionsColumn,
  resolveHwyMemberMembershipListActionsFromPathname,
} from '../hwy/hwyMemberWaitedListMembershipQueue';
import { HwyRejectionListRuntimeProvider } from '../hwy/hwyRejectedLocalManageListRuntime';
import {
  enforceHwyMemberRejectionListParityColumnGridDef,
  omitHwyMemberRejectedLocalManageCreatedAtColumn,
  omitHwyMemberRejectedLocalManageMembershipStatusUpdatedOnColumn,
  omitHwyMemberRejectedLocalManagePhoneColumn,
  omitHwyMemberRejectionListGovernorateColumn,
} from '../hwy/hwyMemberRejectionListParity';
import {
  enforceHwyMemberRejectionListElectoralAsGovernorateColumnGridDef,
  insertHwyMemberRejectionListParityColumns,
} from '../hwy/hwyMemberRejectionListParityColumns';
import { resolveHwyMemberMembershipListActionsKind } from '../hwy/hwyMemberMembershipListActionsPath';
import {
  shouldHideMemberDirectoryTrackingCodeColumn,
  shouldHideMemberRegisteredIconColumnOnMemberDirectoryGrid,
  shouldHideHwyMemberDirectoryGridColumn,
  shouldHideMembershipOnColumnOnMemberDirectoryGrid,
} from '../hwy/hwyMemberSegmentListCatalog';
import {
  HWY_MEMBER_QUICK_SEARCH_LIST_PAGE_SIZE,
  isHwyMemberQuickSearchListScope,
  shouldHideHwyMemberQuickSearchGridColumn,
} from '../hwy/hwyMemberQuickSearchCatalog';
import {
  isHwyMemberDirectoryListApiEndpoint,
  resolveHwyMemberDirectoryListScopeLegacy,
} from '../hwy/hwyMemberDirectoryListScopeResolve';
import { designerGridColumnAllowsCellClickInvoke } from './designerGridRichCellColumns';
import { NativeButton } from '../../shared/ui/NativeButton';
import { normalizeHexColor, readGridColumnRawValue } from '../../shared/lib/uiColorUtils';
import { resolveCultureLabel } from '../../core/culture/cultureShellKeys';
import type { TranslationFn } from '../../core/culture/TranslationRuntime';
import { MountGridDateText } from '../../app/platform/MountGridDateText';
import { normalizeGridDateInput } from '../../shared/lib/gridDateFormat';
import {
  AppButton,
  AppTableGrid,
  GridPagingFooter,
  ListPageShell,
  ListFilterDialog,
  ListFilterSummaryBand,
  isListWhereTreeActive,
  parseListWhereTreeParam,
  serializeListWhereTree,
  useListFilter,
} from '../../shared/ui';
import { createEmptyWhereTree, DEFAULT_WHERE_OPERATORS } from '../../shared/ui/where-builder/whereBuilderModel';
import { DEFAULT_APP_TABLE_GRID_COLUMN_TEXT_DIRECTION } from '../../shared/lib/appTableGridColumnTextDirection';
import {
  APP_TABLE_GRID_ACTION_CELL_CLASS,
  APP_TABLE_GRID_ACTION_HEADER_CLASS,
} from '../../shared/ui/surfaceClasses';
import { showAppFeedbackToast } from '../../shared/ui/appFeedbackToast';
import { useOptionalCulture } from '../../core/culture/CultureContext';
import { parseGridDetailFlowConfig } from './bindingGridDetailEngine';
import { getNodeGridListResourceBinding, getNodeGridListResourceRef } from './bindingGridEngine';
import { resolveCanvasMockEventProps } from './bindingCanvasResolver';
import { resolveCanvasPreviewEventProps } from './bindingPreviewHandlers';
import { resolveMutationRuntimeUrl } from './bindingDynamicActionsEngine';
import { designerFetch, parseApiErrorMessage } from './bindingMutationRuntime';
import { readNestedContextValue, resolveCallMutationOperation, resolveDataSourceOperationEndpoint } from './bindingResourceModel';
import {
  parseQueryPresetsStoreValue,
  serializeQueryPresetsStoreValue,
  useQuerySurfaceRuntimeQuery,
  useResolveEdgeModelIdQuery,
} from '../../shared/api/queries/query-surfaces';
import {
  buildDataGridPageNumbers,
  appendServerInfiniteGridRows,
  resolveDataGridPagingConfig,
  resolveDataGridTotalCount,
  resolveDesignerDataGridShellStyle,
  resolveEffectiveAppTableGridQueryMode,
  resolveGridColumnWidth,
  sliceDataGridRowsForDisplay,
  type DataGridQueryMode,
} from './designerDataGridRuntime';
import {
  applyGridAggregation,
  GRID_GROUP_LEVEL_KEY,
  GRID_GROUP_PATH_KEY,
  GRID_ROW_KIND_KEY,
  isGridAggregationEnabled,
  parseGridAggregationConfig,
  resolveGridAggregationCellText,
  resolveGridAggregationGroupIndentRem,
  resolveGridAggregationRowClassName,
  type GridAggregationConfig,
  type GridDisplayRow,
} from './designerGridAggregation';
import {
  APP_TABLE_GRID_PALETTE_ITEM_ID,
  DEFAULT_DESIGNER_APP_TABLE_GRID_SORT_OPTIONS,
  isActionGridColumn,
  MOCK_DESIGNER_APP_TABLE_GRID_ROWS,
  parseDesignerAppTableGridColumns,
  parseDesignerGridSortOptions,
  resolveActionGridColumnId,
  type DesignerDataGridColumn,
  type DesignerDataGridColumnCellKind,
  type DesignerGridSortOption,
} from './designerDataGridColumns';
import {
  createDefaultGridRowAction,
  isActionGroupColumn,
  type DesignerGridRowAction,
} from './designerGridActionColumns';
import {
  executeDesignerGridRowActionBehavior,
  type GridRowActionRuntimeContext,
} from './bindingGridRowActionRuntime';
import {
  isRichCellKind,
  resolveRichCellFilterValue,
  resolveRichCellSortValue,
} from './designerGridRichCellColumns';
import { DesignerGridRichCell } from './designerGridRichCellRuntime';
import { resolveDesignerGridCultureText } from './designerGridCultureKeys';
import { DesignerGridPageToolbar } from './designerGridPageToolbar';
import { DesignerGridPageToolbarPreview } from './designerGridPageToolbarPreview';
import {
  applyDesignerGridToolbarClientFilters,
  buildServerQueryStorePatches,
  designerGridColumnsToListWhereFields,
  mergeManifestListWhereFieldsWithColumnLabels,
  fieldFilterSupportsMatchLogic,
  filterChangedStorePatches,
  isDesignerGridToolbarEnabled,
  parseDesignerGridToolbarConfig,
  resolveDesignerGridToolbarConfigForHwyMemberDirectoryList,
  resolveEffectiveFieldFilters,
  resolveFieldFilterStaticOptions,
  serializeRoleFilterSelection,
  storePatchValuesEqual,
} from './designerGridToolbarConfig';
import {
  DEFAULT_FILTER_MATCH_LOGIC,
  parseFilterMatchLogic,
  type FilterMatchLogic,
} from '../../shared/lib/filterMatchLogic';
import { patchNestedStoreValue } from './designerPreviewResolvers';
import {
  DESIGNER_GRID_COLUMN_LAYOUT_STORE_PATH,
  isDesignerGridRowDisabled,
} from './designerGridRowDisableRules';
import {
  mergeGridColumnLayout,
  parseUserGridColumnLayouts,
  resolveStoredGridColumnLayout,
} from '../../shared/lib/userGridColumnLayouts';
import { resolveStoredColumnLayout } from '../../shared/lib/listPreferencesStorage';
import {
  DesignerGridActionGroupCell,
  DesignerGridIconActionCell,
} from './designerGridActionRuntime';
import { DesignerGridInlineEditCell } from './designerGridInlineEditCell';
import { DesignerGridBulkActionsBar } from './designerGridBulkActionsBar';
import {
  DEFAULT_GRID_SELECTION_STORE_PATH,
  readSelectedKeysFromStore,
} from './designerGridSelectionRuntime';
import { useResolvedToolbarFieldFilters } from './useResolvedToolbarFieldFilters';
import type { DynamicActionRuntimeContext } from './bindingDynamicActionsRuntime';
import {
  exportDesignerData,
  registerDesignerExportSource,
  type DesignerExportFormat,
} from './designerDataExport';
import type { DesignerBindingDefinitions, DesignerNode } from './types';
import { mergeClassNames, readBoolean, readString, wrapDesignerChildSlot } from './runtimeShared';
import type { RuntimeRenderMode, RuntimeRenderOptions } from './runtimeTypes';

/** Legacy auto-table card chrome — must not wrap page toolbar (Users / Records parity). */
const GRID_PADDING_CLASS_PATTERN = /^(?:(?:sm|md|lg|xl|2xl):)?p(?:[xytrblse])?-/;
const GRID_CARD_CHROME_CLASSES = new Set([
  'rounded-lg',
  'rounded-md',
  'rounded-xl',
  'border',
  'border-slate-200',
  'border-slate-100',
  'bg-white',
]);

const resolveAppTableGridShellClassNames = (
  className: string,
  toolbarEnabled: boolean,
): string => {
  const tokens = className.trim().split(/\s+/).filter(Boolean);
  if (!toolbarEnabled) {
    return className;
  }

  return tokens
    .filter((token) => !GRID_PADDING_CLASS_PATTERN.test(token) && !GRID_CARD_CHROME_CLASSES.has(token))
    .join(' ');
};

const designInteractionClass = (mode: RuntimeRenderMode, allowRowActions = false): string | undefined =>
  mode === 'design'
    ? allowRowActions
      ? 'pointer-events-none [&_thead]:pointer-events-auto [&_tbody_button]:pointer-events-auto'
      : 'pointer-events-none [&_thead]:pointer-events-auto'
    : undefined;

const filterCollapsedAggregationRows = <TRow extends GridDisplayRow>(
  rows: readonly TRow[],
  collapsedPaths: ReadonlySet<string>,
  config: GridAggregationConfig | null,
): TRow[] => {
  if (!config?.collapsibleGroups || collapsedPaths.size === 0) {
    return [...rows];
  }

  let skipDepth: number | null = null;
  const output: TRow[] = [];

  for (const row of rows) {
    const kind = row[GRID_ROW_KIND_KEY];
    const level = typeof row[GRID_GROUP_LEVEL_KEY] === 'number' ? row[GRID_GROUP_LEVEL_KEY]! : 0;
    const path = typeof row[GRID_GROUP_PATH_KEY] === 'string' ? row[GRID_GROUP_PATH_KEY]! : '';

    if (kind === 'group-header') {
      if (skipDepth !== null && level > skipDepth) {
        continue;
      }
      skipDepth = null;
      output.push(row);
      if (path && collapsedPaths.has(path)) {
        skipDepth = level;
      }
      continue;
    }

    if (skipDepth !== null && level > skipDepth) {
      continue;
    }

    output.push(row);
  }

  return output;
};

const wrapGridColumnsForAggregation = <TRow extends Record<string, unknown>>(
  columns: AppTableGridColumnDef<TRow>[],
  config: GridAggregationConfig | null,
): AppTableGridColumnDef<TRow>[] => {
  if (!config || !isGridAggregationEnabled(config)) {
    return columns;
  }

  return columns.map((column) => ({
    ...column,
    renderCell: (row) => {
      const displayRow = row as GridDisplayRow;
      const kind = displayRow[GRID_ROW_KIND_KEY];
      if (!kind || kind === 'data') {
        return column.renderCell(row);
      }

      const text = resolveGridAggregationCellText(displayRow, column.id, config, row[column.id]);
      if (kind === 'group-header' && config.groupByFields?.includes(column.id)) {
        const indentRem = resolveGridAggregationGroupIndentRem(displayRow);
        return (
          <span style={indentRem > 0 ? { paddingInlineStart: `${indentRem}rem` } : undefined}>
            {text}
          </span>
        );
      }

      return text;
    },
  }));
};

type DesignerRuntimeAppTableGridProps = {
  node: DesignerNode;
  options: RuntimeRenderOptions & {
    className?: string;
    children?: React.ReactNode;
  };
};

type DesignerGridRow = Record<string, unknown> & {
  __designerRowKey: string;
};

const readPageFromStore = (
  designerStore: Record<string, unknown> | undefined,
  pageStorePath: string,
): number | undefined => {
  if (!designerStore) {
    return undefined;
  }

  const value = readNestedContextValue(designerStore, pageStorePath);
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return undefined;
};

const applyDesignerStorePatches = (
  previewEvents: RuntimeRenderOptions['previewEvents'],
  patches: Record<string, unknown>,
  designerStore?: Record<string, unknown>,
): boolean => {
  if (Object.keys(patches).length === 0) {
    return false;
  }

  const currentStore = designerStore ?? previewEvents?.designerStore ?? {};
  const changedPatches: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(patches)) {
    const currentValue = readNestedContextValue(currentStore, path);
    if (!storePatchValuesEqual(currentValue, value)) {
      changedPatches[path] = value;
    }
  }

  if (Object.keys(changedPatches).length === 0) {
    return false;
  }

  if (previewEvents?.patchStoreState) {
    previewEvents.patchStoreState((store) => {
      let next = store;
      let changed = false;
      for (const [path, value] of Object.entries(changedPatches)) {
        const currentValue = readNestedContextValue(next, path);
        if (storePatchValuesEqual(currentValue, value)) {
          continue;
        }
        next = patchNestedStoreValue(next, path, value);
        changed = true;
      }
      return changed ? next : store;
    });
    return true;
  }

  if (!previewEvents?.patchStore) {
    return false;
  }

  for (const [path, value] of Object.entries(changedPatches)) {
    previewEvents.patchStore(path, value);
  }
  return true;
};

const buildInitialRoleFilters = (roles: readonly string[]): Record<string, boolean> =>
  Object.fromEntries(roles.map((role) => [role, false]));

const buildInitialCheckboxSelections = (
  fieldFilters: ReturnType<typeof resolveEffectiveFieldFilters>,
): Record<string, Record<string, boolean>> => {
  const next: Record<string, Record<string, boolean>> = {};
  for (const filter of fieldFilters) {
    if (filter.controlType !== 'checkbox-group') {
      continue;
    }
    next[filter.id] = Object.fromEntries(
      resolveFieldFilterStaticOptions(filter).map((option) => [option.value, false]),
    );
  }
  return next;
};

const buildInitialRadioSelections = (
  fieldFilters: ReturnType<typeof resolveEffectiveFieldFilters>,
): Record<string, string> => Object.fromEntries(
  fieldFilters
    .filter((filter) => filter.controlType === 'radio-group' || filter.controlType === 'select')
    .map((filter) => {
      const options = resolveFieldFilterStaticOptions(filter);
      const defaultValue = String(filter.defaultValue ?? '').trim();
      const initial = defaultValue && options.some((option) => option.value === defaultValue)
        ? defaultValue
        : '';
      return [filter.id, initial];
    }),
);

const buildInitialMatchLogicByFilterId = (
  fieldFilters: ReturnType<typeof resolveEffectiveFieldFilters>,
): Record<string, FilterMatchLogic> => Object.fromEntries(
  fieldFilters
    .filter((filter) => fieldFilterSupportsMatchLogic(filter))
    .map((filter) => [
      filter.id,
      parseFilterMatchLogic(filter.matchLogic ?? DEFAULT_FILTER_MATCH_LOGIC),
    ]),
);

const parseSortOptions = (value: unknown, columns: DesignerDataGridColumn[], translate?: (key: string) => string): DesignerGridSortOption[] => {
  const parsed = parseDesignerGridSortOptions(value);
  if (parsed.length > 0) {
    return parsed.map((option) => ({
      value: option.value,
      label: option.labelTranslationKey && translate
        ? translate(option.labelTranslationKey)
        : option.label,
    }));
  }

  const generated = columns
    .filter((column) => column.sort && !isActionGridColumn(column))
    .map((column) => ({
      value: column.key,
      label: column.labelTranslationKey && translate
        ? translate(column.labelTranslationKey)
        : (typeof column.label === 'string' ? column.label : column.key),
    }));

  return generated.length > 0 ? generated : DEFAULT_DESIGNER_APP_TABLE_GRID_SORT_OPTIONS;
};

const mapMemberDirectoryFooterSortOptionsForGrid = (
  pageName: string,
  translate?: (key: string) => string,
): DesignerGridSortOption[] => resolveHwyMemberDirectoryFooterSortOptions(pageName).map((option) => ({
  value: option.value,
  label: option.labelTranslationKey && translate
    ? translate(option.labelTranslationKey)
    : option.label,
}));

const resolveImageFixMemberDirectoryListFromOptions = (
  listScopeLegacy: string | null | undefined,
): boolean => isHwyMemberImageFixListScope(String(listScopeLegacy ?? '').trim() || null);

const resolveDesignerColumnLabel = (
  column: DesignerDataGridColumn,
  translate?: (key: string) => string,
): string => {
  const fallback = typeof column.label === 'string' ? column.label : column.key;
  const key = column.labelTranslationKey?.trim();
  if (key && translate) {
    return resolveCultureLabel(translate as TranslationFn, key, fallback);
  }
  return fallback;
};

const resolveListScopedEditCharacterEmptyLabel = (
  translate: ((key: string) => string) | undefined,
  listScopeLegacy: string | null | undefined,
): string => {
  const profile = resolveHwyMemberListScopedEditProfile(listScopeLegacy);
  if (profile?.kind === 'mehani_professional') {
    return resolveCultureLabel(
      translate as TranslationFn | undefined,
      'hwy.listScopedEdit.professional.empty',
      'Edit professional data',
    );
  }
  if (profile?.kind === 'gov_employment') {
    return resolveCultureLabel(
      translate as TranslationFn | undefined,
      'hwy.listScopedEdit.employment.empty',
      'Edit job data',
    );
  }
  const vocab = profile?.instituteCharacterVocab;
  const key = vocab?.emptyCellTranslationKey ?? 'hwy.listScopedEdit.character.empty';
  return resolveCultureLabel(translate as TranslationFn | undefined, key, 'Choose character');
};

const renderCellByKind = (
  rawValue: unknown,
  cellKind: DesignerDataGridColumnCellKind | undefined,
): React.ReactNode => {
  if (rawValue == null || rawValue === '') {
    return '';
  }

  switch (cellKind) {
    case 'boolean-icon':
      return renderBooleanIcon(
        typeof rawValue === 'boolean'
          ? rawValue
          : rawValue === 'true' || rawValue === 1 || rawValue === '1',
      );
    case 'date':
      return <MountGridDateText value={normalizeGridDateInput(rawValue)} />;
    case 'badge':
      return (
        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700">
          {String(rawValue)}
        </span>
      );
    case 'color-swatch': {
      const hex = normalizeHexColor(rawValue);
      if (!hex) {
        return '';
      }
      return (
        <span
          className="inline-block h-4 w-4 shrink-0 rounded-full border border-slate-200/90 shadow-sm"
          style={{ backgroundColor: hex }}
          title={hex}
          aria-label={`Color ${hex}`}
        />
      );
    }
    case 'text':
    default:
      return String(rawValue);
  }
};

const buildActionInvokeContext = (
  mode: RuntimeRenderMode,
  row: Record<string, unknown>,
  rowActionHandler: ((row: Record<string, unknown>, actionId: string) => void) | undefined,
  detailFlow: ReturnType<typeof parseGridDetailFlowConfig>,
  designerStore: Record<string, unknown> | undefined,
  columnActionDisabledWhen?: DesignerDataGridColumn['actionDisabledWhen'],
  onInvokeAction?: (action: DesignerGridRowAction) => void,
): {
  mode: RuntimeRenderMode;
  canInvoke: boolean;
  allowDesignInvoke: boolean;
  isActionDisabled?: (action: DesignerGridRowAction) => boolean;
  onInvokeAction?: (action: DesignerGridRowAction) => void;
  onInvoke: (actionId: string) => void;
} => {
  // Explicit invoker (open-modal / navigate / callMutation) must also enable clicks —
  // otherwise published pages with behavior-only actions stay permanently disabled.
  const canInvoke = Boolean(rowActionHandler) || Boolean(detailFlow) || Boolean(onInvokeAction);
  return {
    mode,
    canInvoke,
    allowDesignInvoke: mode !== 'design' || Boolean(rowActionHandler) || Boolean(onInvokeAction),
    isActionDisabled: (action) => isDesignerGridRowDisabled(
      row,
      action.disabledWhen ?? columnActionDisabledWhen,
      designerStore,
    ),
    onInvokeAction,
    onInvoke: (actionId: string) => {
      if (!canInvoke || (mode === 'design' && !rowActionHandler && !onInvokeAction)) {
        return;
      }
      rowActionHandler?.(row, actionId);
    },
  };
};

const resolveIconActionDefinition = (column: DesignerDataGridColumn): DesignerGridRowAction => {
  const actionId = resolveActionGridColumnId(column);
  return createDefaultGridRowAction(actionId, {
    icon: column.actionIcon ?? 'Settings2',
    intent: column.actionIntent ?? 'utility',
    tooltip: column.actionTooltip ?? column.label ?? actionId,
    label: column.label,
    ...(column.actionBehavior ? { behavior: column.actionBehavior } : {}),
    ...(column.actionDisabledWhen ? { disabledWhen: column.actionDisabledWhen } : {}),
  });
};

const buildDirectGridActionRuntimeContext = (
  options: {
    mode: RuntimeRenderMode;
    previewEvents?: RuntimeRenderOptions['previewEvents'];
    bindingDefinitions?: RuntimeRenderOptions['bindingDefinitions'];
    designerStore?: Record<string, unknown>;
  },
): GridRowActionRuntimeContext => ({
  patchStore: options.previewEvents?.patchStore ?? (() => undefined),
  patchStoreState: options.previewEvents?.patchStoreState,
  navigate: options.previewEvents?.navigate,
  refreshDataSource: options.previewEvents?.refreshDataSource,
  bindingDefinitions: options.bindingDefinitions,
  designerStore: options.designerStore,
  document: options.previewEvents?.document,
  seedRegionFromRow: options.previewEvents?.seedRegionFromRow,
});

type BuildAppTableGridColumnsOptions = {
  mode: RuntimeRenderMode;
  detailFlowRef: React.RefObject<ReturnType<typeof parseGridDetailFlowConfig>>;
  rowActionHandlerRef: React.RefObject<((row: Record<string, unknown>, actionId: string) => void) | undefined>;
  cellClickHandlerRef: React.RefObject<((row: Record<string, unknown>, column: DesignerDataGridColumn) => void) | undefined>;
  designerStoreRef: React.RefObject<Record<string, unknown> | undefined>;
  bindingDefinitions?: DesignerBindingDefinitions;
  dynamicActionRuntime?: DynamicActionRuntimeContext;
  previewEvents?: RuntimeRenderOptions['previewEvents'];
  translate?: (key: string) => string;
  /** When set, hides `membershipOn` on applicant queue member-directory lists (published layouts included). */
  hwyMemberDirectoryListScopeLegacy?: string | null;
  /** RTL shell — defaults from `<html dir>` when omitted (published TSX grids). */
  shellIsRtl?: boolean;
  onMembershipQueueDecisionSaved?: () => void;
};

const resolveBuildAppTableGridShellIsRtl = (
  options: BuildAppTableGridColumnsOptions,
): boolean => {
  if (options.shellIsRtl != null) {
    return options.shellIsRtl;
  }
  return readDocumentReadingDirection() === 'rtl';
};

/** Evaluated at click/render time — handler refs are often assigned after the column def is built. */
const resolveRuntimeGridCellClickInvokable = (
  options: Pick<
    BuildAppTableGridColumnsOptions,
    'cellClickHandlerRef' | 'rowActionHandlerRef' | 'detailFlowRef'
  >,
  column: DesignerDataGridColumn,
): boolean => (
  Boolean(options.cellClickHandlerRef.current)
  || Boolean(options.rowActionHandlerRef.current && column.cellClickActionId?.trim())
  || Boolean(column.cellClickBehavior && column.cellClickBehavior.kind !== 'none')
);

const invokeRuntimeGridColumnCellClick = (
  row: Record<string, unknown>,
  column: DesignerDataGridColumn,
  options: BuildAppTableGridColumnsOptions,
  rowActionHandler: ((row: Record<string, unknown>, actionId: string) => void) | undefined,
): void => {
  const cellClickHandler = options.cellClickHandlerRef.current;
  if (cellClickHandler) {
    cellClickHandler(row, column);
    return;
  }
  if (
    column.cellClickBehavior
    && executeDesignerGridRowActionBehavior(
      row,
      column.cellClickBehavior,
      buildDirectGridActionRuntimeContext({
        mode: options.mode,
        previewEvents: options.previewEvents,
        bindingDefinitions: options.bindingDefinitions,
        designerStore: options.designerStoreRef.current,
      }),
    )
  ) {
    return;
  }
  const actionId = column.cellClickActionId?.trim();
  if (actionId) {
    rowActionHandler?.(row, actionId);
  }
};

const buildExplicitActionInvoker = (
  row: Record<string, unknown>,
  options: {
    mode: RuntimeRenderMode;
    previewEvents?: RuntimeRenderOptions['previewEvents'];
    bindingDefinitions?: RuntimeRenderOptions['bindingDefinitions'];
    designerStore?: Record<string, unknown>;
    rowActionHandler?: (row: Record<string, unknown>, actionId: string) => void;
  },
): ((action: DesignerGridRowAction) => void) => {
  const directContext = buildDirectGridActionRuntimeContext(options);
  const canRunDirectBehavior = (behavior: DesignerGridRowAction['behavior']): boolean => {
    if (!behavior || behavior.kind === 'none') {
      return false;
    }
    if (behavior.kind === 'open-modal') {
      return Boolean(options.previewEvents?.patchStore || options.previewEvents?.patchStoreState);
    }
    if (behavior.kind === 'navigate') {
      return Boolean(options.previewEvents?.navigate);
    }
    if (behavior.kind === 'callMutation') {
      return Boolean(options.bindingDefinitions);
    }
    return false;
  };

  return (action: DesignerGridRowAction) => {
    if (
      canRunDirectBehavior(action.behavior)
      && executeDesignerGridRowActionBehavior(row, action.behavior, directContext)
    ) {
      return;
    }
    options.rowActionHandler?.(row, action.actionId);
  };
};

const readColumnAlignClass = (value?: string): string | undefined => {
  const trimmed = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
  if (!trimmed || trimmed === 'text-start') {
    return undefined;
  }
  return trimmed;
};

export const resolveDesignerAppTableGridColumnAlign = (
  column: DesignerDataGridColumn,
): {
  headerClassName?: string;
  cellClassName?: string;
  textDirection?: typeof DEFAULT_APP_TABLE_GRID_COLUMN_TEXT_DIRECTION;
} => {
  const authoredHeader = readColumnAlignClass(column.headerClassName);
  const authoredCell = readColumnAlignClass(column.cellClassName);
  if (isActionGroupColumn(column) || isActionGridColumn(column)) {
    return {
      headerClassName: authoredHeader ?? APP_TABLE_GRID_ACTION_HEADER_CLASS,
      cellClassName: authoredCell ?? APP_TABLE_GRID_ACTION_CELL_CLASS,
    };
  }
  if (authoredHeader || authoredCell) {
    return {
      headerClassName: authoredHeader,
      cellClassName: authoredCell,
      textDirection: column.textDirection ?? DEFAULT_APP_TABLE_GRID_COLUMN_TEXT_DIRECTION,
    };
  }
  return {
    textDirection: column.textDirection ?? DEFAULT_APP_TABLE_GRID_COLUMN_TEXT_DIRECTION,
  };
};

/**
 * Pure column-def builder shared by the live canvas/preview AND the exported/published TSX
 * (see `renderAppTableGridCustomJsx` in tsxPhase2Palette.ts) — reused verbatim in codegen'd
 * output so exported grids get the exact same rich-cell/action/disable-rule rendering as the
 * Designer canvas, instead of a separately hand-written (and previously nonexistent) copy.
 */
export const buildAppTableGridColumns = <TRow extends Record<string, unknown>>(
  columns: DesignerDataGridColumn[],
  gridQueryMode: DataGridQueryMode,
  options: BuildAppTableGridColumnsOptions,
): AppTableGridColumnDef<TRow>[] => {
  const isMembersAllList = isHwyMembersAllListGrid(columns);
  const isNakhebinList = isHwyNakhebinListGrid(columns);
  const isInstitutesList = isHwyInstitutesListGrid(columns);
  const isImageFixList = isHwyMemberImageFixListFromScope(options.hwyMemberDirectoryListScopeLegacy);
  const scopedEditColumns = mergeHwyMemberListScopedEditDesignerColumns(
    columns,
    options.hwyMemberDirectoryListScopeLegacy,
  );
  const hideMembershipOnOnApplicantQueue = shouldHideMembershipOnColumnOnMemberDirectoryGrid({
    columnKeys: scopedEditColumns.map((column) => column.key),
    listScopeLegacy: options.hwyMemberDirectoryListScopeLegacy,
  });
  const hideQueueFamilyUiColumns = shouldHideMemberRegisteredIconColumnOnMemberDirectoryGrid({
    listScopeLegacy: options.hwyMemberDirectoryListScopeLegacy,
  });
  const hideTrackingCodeColumn = shouldHideMemberDirectoryTrackingCodeColumn({
    listScopeLegacy: options.hwyMemberDirectoryListScopeLegacy,
  });
  const scopedEditAwareColumns = scopedEditColumns.map((column) => (
    applyHwyMemberListScopedEditCharacterColumnChrome(column, options.hwyMemberDirectoryListScopeLegacy)
  ));
  const isMemberDirectorySegmentList = isHwyMemberDirectorySegmentListGrid(scopedEditAwareColumns);
  const isMemberDirectoryFaceGrid = isMemberDirectorySegmentList || isMembersAllList;
  const listScopeLegacy = String(options.hwyMemberDirectoryListScopeLegacy ?? '').trim();
  const isMemberDirectoryListGrid = isMembersAllList
    || isMemberDirectorySegmentList
    || isImageFixList
    || Boolean(listScopeLegacy);
  const isQuickSearchListGrid = isHwyMemberQuickSearchListScope(listScopeLegacy);
  const shellIsRtl = resolveBuildAppTableGridShellIsRtl(options);
  const visibleColumns = scopedEditAwareColumns.filter((column) => {
    if (isQuickSearchListGrid && shouldHideHwyMemberQuickSearchGridColumn(column)) {
      return false;
    }
    if (isMemberDirectoryListGrid && shouldHideHwyMemberDirectoryGridColumn(column.key)) {
      return false;
    }
    if (isNakhebinList && column.key === 'genderCodeTitle') {
      return false;
    }
    if (hideMembershipOnOnApplicantQueue && column.key === 'membershipOn') {
      return false;
    }
    if (hideQueueFamilyUiColumns && column.key === 'nakhebinJoinTasjilStateCodeTitle') {
      return false;
    }
    if (hideQueueFamilyUiColumns && column.key === 'nakhebinId') {
      return false;
    }
    if ((hideTrackingCodeColumn || isMemberDirectoryListGrid) && column.key === 'trackingCode') {
      return false;
    }
    return true;
  });
  const orderedVisibleColumns = isMemberDirectoryListGrid
    ? reorderHwyMemberDirectoryElectoralColumnThird(visibleColumns)
    : visibleColumns;
  const normalizedColumns = orderedVisibleColumns.map((column) => {
    const withFaceWidth = applyHwyMemberDirectoryListFaceColumnWidth(
      column,
      options.hwyMemberDirectoryListScopeLegacy,
    );
    const withNameWidth = applyHwyMemberNakhebinListNameColumnWidth(withFaceWidth);
    const withPhoneWidth = applyHwyMembersAllListPhoneColumnWidth(withNameWidth, orderedVisibleColumns);
    const withMembershipWidth = applyHwyMembersAllListMembershipOnColumnWidth(withPhoneWidth, orderedVisibleColumns);
    const withResidenceWidth = applyHwyMembersAllListResidenceColumnWidth(withMembershipWidth, orderedVisibleColumns);
    const withElectoralAlign = applyHwyMemberDirectoryElectoralColumnCellAlign(
      applyHwyNakhebinListVotedColumnCenter(withResidenceWidth, orderedVisibleColumns),
    );
    return withElectoralAlign;
  });
  const builtColumns = normalizedColumns.map((column) => {
    const columnLabel = resolveDesignerColumnLabel(column, options.translate);
    const align = resolveDesignerAppTableGridColumnAlign(column);
    if (isActionGroupColumn(column)) {
      const actions = column.actions ?? [];

      return {
        id: column.key,
        label: columnLabel,
        sort: false,
        filter: false,
        layout: {
          hideable: column.layoutHideable !== false,
          resizable: false,
          reorderable: false,
          ...(column.layoutPinned === 'left' || column.layoutPinned === 'right'
            ? { pinned: column.layoutPinned }
            : {}),
        },
        card: column.cardRole ? { role: column.cardRole } : { role: 'actions' as const },
        hideBelow: column.hideBelow,
        width: resolveGridColumnWidth(column.width),
        headerClassName: align.headerClassName,
        cellClassName: align.cellClassName,
        textDirection: align.textDirection,
        renderCell: (row) => (
          <DesignerGridActionGroupCell
            actions={actions}
            maxVisible={column.maxVisibleActions}
            context={buildActionInvokeContext(
              options.mode,
              row,
              options.rowActionHandlerRef.current,
              options.detailFlowRef.current,
              options.designerStoreRef.current,
              undefined,
              buildExplicitActionInvoker(row, {
                mode: options.mode,
                previewEvents: options.previewEvents,
                bindingDefinitions: options.bindingDefinitions,
                designerStore: options.designerStoreRef.current,
                rowActionHandler: options.rowActionHandlerRef.current,
              }),
            )}
          />
        ),
      };
    }

    if (isActionGridColumn(column)) {
      const actionId = resolveActionGridColumnId(column);
      const label = column.label || 'Details';
      const actionDefinition = column.actionDisplay === 'icon'
        ? resolveIconActionDefinition(column)
        : createDefaultGridRowAction(actionId, {
          icon: 'Eye',
          intent: 'view',
          tooltip: label,
          label,
          ...(column.actionBehavior ? { behavior: column.actionBehavior } : {}),
          ...(column.actionDisabledWhen ? { disabledWhen: column.actionDisabledWhen } : {}),
        });

      return {
        id: column.key,
        label,
        sort: false,
        filter: false,
        layout: {
          hideable: column.layoutHideable !== false,
          resizable: false,
          reorderable: false,
          ...(column.layoutPinned === 'left' || column.layoutPinned === 'right'
            ? { pinned: column.layoutPinned }
            : {}),
        },
        card: column.cardRole ? { role: column.cardRole } : { role: 'actions' as const },
        width: resolveGridColumnWidth(column.width),
        headerClassName: align.headerClassName,
        cellClassName: align.cellClassName,
        textDirection: align.textDirection,
        renderCell: (row) => (
          <DesignerGridIconActionCell
            action={actionDefinition}
            label={label}
            display={column.actionDisplay === 'icon' ? 'icon' : 'button'}
            context={buildActionInvokeContext(
              options.mode,
              row,
              options.rowActionHandlerRef.current,
              options.detailFlowRef.current,
              options.designerStoreRef.current,
              column.actionDisabledWhen,
              buildExplicitActionInvoker(row, {
                mode: options.mode,
                previewEvents: options.previewEvents,
                bindingDefinitions: options.bindingDefinitions,
                designerStore: options.designerStoreRef.current,
                rowActionHandler: options.rowActionHandlerRef.current,
              }),
            )}
          />
        ),
      };
    }

    const filterType = column.filterType ?? 'text';
    const detailFlow = options.detailFlowRef.current;
    const designerStore = options.designerStoreRef.current;

    const layoutWithPin = {
      hideable: column.layoutHideable !== false,
      resizable: column.layoutResizable !== false,
      reorderable: column.layoutReorderable !== false,
      ...(column.layoutPinned === 'left' || column.layoutPinned === 'right'
        ? { pinned: column.layoutPinned }
        : {}),
    };

    const renderEditableOrDefault = (row: TRow) => {
      if (column.editable === true && !isActionGridColumn(column)) {
        const rowKey = String(
          (row as Record<string, unknown>).__designerRowKey
          ?? (row as Record<string, unknown>).id
          ?? '',
        );
        return (
          <DesignerGridInlineEditCell
            column={column}
            row={row as Record<string, unknown>}
            rowKey={rowKey}
            mode={options.mode === 'design' ? 'design' : 'runtime'}
            bindingDefinitions={options.bindingDefinitions}
            runtime={options.dynamicActionRuntime}
          />
        );
      }
      if (column.key === 'electoralDivisionPath') {
        return (
          <HwyMemberDirectoryElectoralDivisionGridCell
            row={row as Record<string, unknown>}
            electoralFallbackField={column.cellFields?.electoralFallbackField}
          />
        );
      }
      if (column.key === 'residenceSummary') {
        const rowRecord = row as Record<string, unknown>;
        return (
          <HwyElectoralProvinceFallbackCell
            value={rowRecord.addrProvinceTitle ?? rowRecord.addr_province_title}
          />
        );
      }
      if (column.key === 'memberInstitutesSummary') {
        return (
          <HwyNewlineStackedLinesCell
            value={readGridColumnRawValue(row as Record<string, unknown>, column.key)}
            textAlign={resolveHwyStackedLinesTextAlignFromGridColumn(column)}
          />
        );
      }
      const cellKind = column.cellKind
        ?? (column.key === 'createdAt' || column.key === 'membershipStatusUpdatedOn' ? 'date' : undefined);
      return renderCellByKind(
        readGridColumnRawValue(row as Record<string, unknown>, column.key),
        cellKind,
      );
    };

    if (isRichCellKind(column.cellKind)) {
      return {
        id: column.key,
        label: columnLabel,
        width: resolveGridColumnWidth(column.width),
        hideBelow: column.hideBelow,
        headerClassName: align.headerClassName,
        cellClassName: align.cellClassName,
        textDirection: align.textDirection,
        sort: column.sort ? { mode: gridQueryMode } : false,
        filter: column.filter
          ? { mode: gridQueryMode, type: filterType }
          : false,
        layout: layoutWithPin,
        card: column.cardRole
          ? {
            role: column.cardRole,
            label: columnLabel,
            ...(column.cardPhoneRole ? { phoneRole: column.cardPhoneRole } : {}),
            ...(column.cardTabletRole ? { tabletRole: column.cardTabletRole } : {}),
          }
          : undefined,
        getSortValue: (row) => resolveRichCellSortValue(row, column),
        getFilterValue: (row) => resolveRichCellFilterValue(row, column),
        renderCell: (row) => {
          const rowRecord = row as Record<string, unknown>;
          const gridRow = column.key === 'logoUrl'
            ? {
              ...rowRecord,
              logoUrl: resolveHwyInstituteDisplayLogoUrl(
                rowRecord.logoUrl,
                rowRecord.code,
                rowRecord.id,
              ) ?? rowRecord.logoUrl,
            }
            : rowRecord;
          return column.editable === true ? (
            renderEditableOrDefault(row)
          ) : (
            <DesignerGridRichCell
              row={gridRow}
              column={column}
              mode={options.mode}
              hwyMemberDirectoryListScopeLegacy={options.hwyMemberDirectoryListScopeLegacy}
              canInvokeCellClick={
                resolveRuntimeGridCellClickInvokable(options, column)
                || rowShowsHwyFamilyHouseholdCellClick(row as Record<string, unknown>, column)
                || rowShowsHwyImageFixEditorCellClick(row as Record<string, unknown>, column)
                || rowShowsHwyMemberListScopedEditCellClick(column, options.hwyMemberDirectoryListScopeLegacy)
              }
              designerStore={designerStore}
              navigate={options.previewEvents?.navigate}
              onBeforeNavigate={(linkRow) => {
                const recordId = linkRow.id ?? linkRow[columns[0]?.key ?? 'id'];
                if (recordId !== undefined && recordId !== null && options.previewEvents?.patchStore) {
                  options.previewEvents.patchStore('selection.id', recordId);
                }
              }}
              onCellClick={() => {
                const rowRecord = row as Record<string, unknown>;
                const invokeCellClick = resolveRuntimeGridCellClickInvokable(options, column)
                  || rowShowsHwyFamilyHouseholdCellClick(rowRecord, column)
                  || rowShowsHwyImageFixEditorCellClick(rowRecord, column)
                  || rowShowsHwyMemberListScopedEditCellClick(column, options.hwyMemberDirectoryListScopeLegacy);
                if (!invokeCellClick || options.mode === 'design') {
                  return;
                }
                if (rowShowsHwyFamilyHouseholdCellClick(rowRecord, column)) {
                  openHwyFamilyHouseholdFromDesignerGrid(row, column.key, column);
                  return;
                }
                if (rowShowsHwyImageFixEditorCellClick(rowRecord, column)) {
                  openHwyImageFixEditorFromDesignerGrid(rowRecord);
                  return;
                }
                if (rowShowsHwyMemberListScopedEditCellClick(column, options.hwyMemberDirectoryListScopeLegacy)) {
                  openHwyMemberListScopedEditFromDesignerGrid(rowRecord);
                  return;
                }
                invokeRuntimeGridColumnCellClick(
                  rowRecord,
                  column,
                  options,
                  options.rowActionHandlerRef.current,
                );
              }}
            />
          );
        },
      };
    }

    return {
      id: column.key,
      label: columnLabel,
      width: resolveGridColumnWidth(column.width),
      hideBelow: column.hideBelow,
      headerClassName: align.headerClassName,
      cellClassName: align.cellClassName,
      textDirection: align.textDirection,
      sort: column.sort ? { mode: gridQueryMode } : false,
      filter: column.filter
        ? { mode: gridQueryMode, type: filterType }
        : false,
      layout: layoutWithPin,
      card: column.cardRole
        ? {
          role: column.cardRole,
          label: columnLabel,
          ...(typeof column.cardPriority === 'number' ? { priority: column.cardPriority } : {}),
          ...(column.cardPhoneRole ? { phoneRole: column.cardPhoneRole } : {}),
          ...(column.cardTabletRole ? { tabletRole: column.cardTabletRole } : {}),
        }
        : undefined,
      getSortValue: (row) => readGridColumnRawValue(row as Record<string, unknown>, column.key) as string | number | boolean | null | undefined,
      getFilterValue: (row) => readGridColumnRawValue(row as Record<string, unknown>, column.key) as string | number | boolean | null | undefined,
      renderCell: (row) => {
        const content = renderEditableOrDefault(row);
        const cellKind = column.cellKind as import('./designerGridRichCellColumns').DesignerGridRichCellKind | undefined;
        const scopedEditClick = rowShowsHwyMemberListScopedEditCellClick(
          column,
          options.hwyMemberDirectoryListScopeLegacy,
        );
        const columnAllowsClick = designerGridColumnAllowsCellClickInvoke(column, cellKind) || scopedEditClick;
        const rowRecord = row as Record<string, unknown>;
        const invokeCellClick = resolveRuntimeGridCellClickInvokable(options, column)
          || rowShowsHwyFamilyHouseholdCellClick(rowRecord, column)
          || rowShowsHwyImageFixEditorCellClick(rowRecord, column)
          || scopedEditClick;
        if (options.mode === 'design' || !invokeCellClick || !columnAllowsClick) {
          return content;
        }
        if (rowShowsHwyFamilyHouseholdCellClick(rowRecord, column)) {
          return (
            <HwyFamilyHouseholdLinkTrigger
              align="start"
              primary={content}
              onClick={() => openHwyFamilyHouseholdFromDesignerGrid(row, column.key, column)}
            />
          );
        }
        if (rowShowsHwyMemberListScopedEditCellClick(column, options.hwyMemberDirectoryListScopeLegacy)) {
          const scopedEditRaw = readGridColumnRawValue(rowRecord, column.key);
          const scopedEditHasValue = scopedEditRaw != null && String(scopedEditRaw).trim().length > 0;
          const scopedEditEmptyLabel = resolveListScopedEditCharacterEmptyLabel(
            options.translate,
            options.hwyMemberDirectoryListScopeLegacy,
          );
          return (
            <NativeButton
              type="button"
              onClick={() => openHwyMemberListScopedEditFromDesignerGrid(rowRecord)}
              className="block w-full min-w-0 text-center text-sky-800 hover:text-sky-950 hover:underline"
            >
              {scopedEditHasValue ? content : (
                <span className="text-slate-500 italic">{scopedEditEmptyLabel}</span>
              )}
            </NativeButton>
          );
        }
        if (rowShowsHwyImageFixEditorCellClick(rowRecord, column)) {
          return (
            <NativeButton
              type="button"
              onClick={() => openHwyImageFixEditorFromDesignerGrid(rowRecord)}
              className="block w-full min-w-0 text-start"
            >
              {content}
            </NativeButton>
          );
        }
        return (
          <NativeButton
            type="button"
            onClick={() => invokeRuntimeGridColumnCellClick(
              rowRecord,
              column,
              options,
              options.rowActionHandlerRef.current,
            )}
            className="block w-full min-w-0 text-start text-sky-700 underline-offset-2 hover:underline"
          >
            {content}
          </NativeButton>
        );
      },
    };
  }).map((column) => enforceHwyMemberDirectoryJobTypePlaceColumnGridDef(
    enforceHwyInstitutesIdColumnGridDef(
    enforceHwyImageFixListMemberColumnGridDef(
    enforceHwyImageFixListRegisteredColumnGridDef(
      enforceHwyImageFixListDocumentsColumnGridDef(
        enforceHwyImageFixListActionsColumnGridDef(
        enforceHwyNakhebinListVotedColumnGridDef(
          enforceHwyNakhebinListWrapTextColumnGridDef(
            enforceHwyMemberDirectoryElectoralColumnGridDef(
              enforceHwyMembersAllListResidenceColumnGridDef(
                enforceHwyMembersAllListMembershipOnColumnGridDef(
                  enforceHwyMembersAllListPhoneColumnGridDef(
                    enforceHwyMembersAllListNakhebinColumnGridDef(
                      enforceHwyMemberDirectoryListFaceColumnGridDef(
                        enforceHwyMemberNakhebinListNameColumnGridDef(column),
                        {
                          isMemberDirectoryFaceGrid,
                          listScopeLegacy: options.hwyMemberDirectoryListScopeLegacy,
                        },
                      ),
                      isMembersAllList,
                    ),
                    isMembersAllList,
                    isNakhebinList,
                  ),
                  isMembersAllList,
                ),
                isMembersAllList,
              ),
              isMemberDirectorySegmentList,
            ),
            isNakhebinList,
          ),
          isNakhebinList,
        ),
          isImageFixList,
        ),
        isImageFixList,
      ),
      isImageFixList,
    ),
    isImageFixList,
    ),
    isInstitutesList,
    ),
  )).map((column) => enforceHwyMemberDirectorySegmentListRtlColumnGridDef(
    column,
    isMemberDirectorySegmentList,
    shellIsRtl,
  ));
  const finalizeMemberDirectoryColumnOrder = (
    columns: AppTableGridColumnDef<TRow>[],
  ): AppTableGridColumnDef<TRow>[] => (
    isMemberDirectoryListGrid
      ? reorderHwyMemberDirectoryElectoralColumnThird(columns)
      : columns
  );

  if (options.mode !== 'runtime') {
    return finalizeMemberDirectoryColumnOrder(builtColumns);
  }

  const listActionsKind = resolveHwyMemberMembershipListActionsKind({
    listScopeLegacy: options.hwyMemberDirectoryListScopeLegacy,
    pathname: typeof window !== 'undefined' ? window.location.pathname : '',
  });
  if (!listActionsKind) {
    return finalizeMemberDirectoryColumnOrder(builtColumns);
  }

  const withRejectionParity = insertHwyMemberRejectionListParityColumns(
    builtColumns,
    options.hwyMemberDirectoryListScopeLegacy,
    options.translate,
  );
  const withLocalManageColumnAdjustments = omitHwyMemberRejectedLocalManageCreatedAtColumn(
    omitHwyMemberRejectedLocalManagePhoneColumn(
      omitHwyMemberRejectedLocalManageMembershipStatusUpdatedOnColumn(
        omitHwyMemberRejectionListGovernorateColumn(
          withRejectionParity,
          options.hwyMemberDirectoryListScopeLegacy,
        ),
        options.hwyMemberDirectoryListScopeLegacy,
      ),
      options.hwyMemberDirectoryListScopeLegacy,
    ),
    options.hwyMemberDirectoryListScopeLegacy,
  ).map((column) => enforceHwyMemberRejectionListElectoralAsGovernorateColumnGridDef(
    enforceHwyMemberRejectionListParityColumnGridDef(
      column,
      options.hwyMemberDirectoryListScopeLegacy,
    ),
    options.hwyMemberDirectoryListScopeLegacy,
    options.translate,
  ));
  return finalizeMemberDirectoryColumnOrder(
    appendHwyWaitedListMembershipActionsColumn(
      withLocalManageColumnAdjustments,
      listActionsKind,
      options.translate,
      options.onMembershipQueueDecisionSaved,
    ),
  );
};

export const DesignerRuntimeAppTableGrid: React.FC<DesignerRuntimeAppTableGridProps> = ({
  node,
  options,
}) => {
  const location = useLocation();
  const culture = useOptionalCulture();
  const translate = culture?.ready ? culture.t : options.translate;
  const columns = React.useMemo(
    () => parseDesignerAppTableGridColumns(node.props.columns),
    [node.props.columns],
  );
  const pagingConfig = resolveDataGridPagingConfig(node);
  const isLoading = readBoolean(node.props.isLoading) || options.gridListLoading === true;
  const rawEmptyContent = node.props.emptyContent;
  const emptyContentFallback = typeof rawEmptyContent === 'string'
    ? rawEmptyContent
    : readString(rawEmptyContent, 'No records found');
  const emptyContent = resolveDesignerGridCultureText(
    node,
    'emptyContentTranslationKey',
    emptyContentFallback,
    translate,
  );
  const errorContentFallback = readString(node.props.errorContent, 'Could not load records');
  const errorContent = resolveDesignerGridCultureText(
    node,
    'errorContentTranslationKey',
    errorContentFallback,
    translate,
  );
  const rawLoadingMessage = node.props.loadingMessage;
  const loadingMessageFallback = typeof rawLoadingMessage === 'string'
    ? rawLoadingMessage
    : readString(rawLoadingMessage, 'Loading records…');
  const loadingMessage = resolveDesignerGridCultureText(
    node,
    'loadingMessageTranslationKey',
    loadingMessageFallback,
    translate,
  );
  const gridQueryMode = pagingConfig.gridQueryMode;
  const presentation = readString(node.props.presentation, 'auto');
  const gridSize = resolveAppTableGridSizeFromDensity({
    density: node.props.density,
    size: node.props.size,
    fallbackDensity: 'default',
  });
  const fillHeight = node.props.fillHeight !== false && node.props.fillHeight !== 'false';
  const chromeRaw = readString(node.props.chrome, 'classic');
  const chrome = chromeRaw === 'hero' ? 'hero' as const : 'classic' as const;
  const cardBelow = readString(node.props.cardBelow, 'tablet');
  const compact = React.useMemo(
    () => parseGridCompactFromProps(node.props as Record<string, unknown>),
    [node.props],
  );
  const enableColumnLayout = node.props.enableColumnLayout !== false;
  const gridId = readString(node.props.gridId);
  const gridColumnLayoutStorePath = readString(
    node.props.gridColumnLayoutStorePath,
    DESIGNER_GRID_COLUMN_LAYOUT_STORE_PATH,
  );
  const showSortControls = node.props.showSortControls !== false;
  const showListModeControls = node.props.showListModeControls === true;
  const showPagingFooter = node.props.showPagingFooter !== false;
  const edgeAlignPagingFooter = node.props.edgeAlignPagingFooter === true;
  const rowKeyField = readString(node.props.rowKeyField, 'id');
  const listMode = readString(node.props.listMode, 'paging') === 'infinite' ? 'infinite' as const : 'paging' as const;
  const isImageFixListGridForSort = resolveImageFixMemberDirectoryListFromOptions(
    options.hwyMemberDirectoryListScopeLegacy,
  );
  const sortOptions = React.useMemo(
    () => {
      if (isImageFixListGridForSort) {
        return mapMemberDirectoryFooterSortOptionsForGrid(HWY_MEMBER_IMAGE_FIX_PAGE_NAME, translate);
      }
      return parseSortOptions(node.props.sortOptions, columns, translate);
    },
    [columns, isImageFixListGridForSort, node.props.sortOptions, translate, culture?.ready],
  );
  const footerSortFieldIds = React.useMemo(
    () => sortOptions.map((option) => option.value),
    [sortOptions],
  );
  const footerSortFieldIdsRef = React.useRef(footerSortFieldIds);
  footerSortFieldIdsRef.current = footerSortFieldIds;
  const defaultSortBy = readString(node.props.defaultSortBy, sortOptions[0]?.value ?? columns[0]?.key ?? 'id');
  const defaultSortDirection: GridSortDirection = readString(node.props.defaultSortDirection, 'asc') === 'desc'
    ? 'desc'
    : 'asc';
  const mockEvents = resolveCanvasMockEventProps(node);
  const previewHandlers = options.previewEvents
    ? resolveCanvasPreviewEventProps(node, {
      ...options.previewEvents,
      document: options.previewEvents.document,
      bindingDefinitions: options.previewEvents.bindingDefinitions,
    })
    : {};
  const detailFlow = parseGridDetailFlowConfig(node);
  const detailFlowRef = React.useRef(detailFlow);
  detailFlowRef.current = detailFlow;
  const rowActionHandlerRef = React.useRef(options.onGridRowAction);
  rowActionHandlerRef.current = options.onGridRowAction;
  const cellClickHandlerRef = React.useRef(options.onGridCellClick);
  cellClickHandlerRef.current = options.onGridCellClick;
  const designerStoreRef = React.useRef(options.designerStore);
  designerStoreRef.current = options.designerStore;
  const previewEventsRef = React.useRef(options.previewEvents);
  previewEventsRef.current = options.previewEvents;
  const lastServerQuerySyncSignatureRef = React.useRef('');
  const toolbarConfig = React.useMemo(
    () => parseDesignerGridToolbarConfig(node.props.toolbarConfig),
    [node.props.toolbarConfig],
  );
  const serverQueryEnabled = toolbarConfig?.serverQuery?.enabled === true;
  const previewBindingDefinitions = options.bindingDefinitions ?? options.previewEvents?.bindingDefinitions;
  const designerGridListWhereStorePath = toolbarConfig?.listWhereStorePath ?? 'gridToolbar.listWhere';
  const gridListDataSourceRef = getNodeGridListResourceRef(node);
  const listDataSource = React.useMemo(() => {
    const ref = gridListDataSourceRef;
    if (!ref || !previewBindingDefinitions?.dataSources) {
      return undefined;
    }
    return previewBindingDefinitions.dataSources[ref];
  }, [gridListDataSourceRef, previewBindingDefinitions]);
  const listEndpointForResolve = React.useMemo(() => {
    if (!listDataSource) {
      return '';
    }
    try {
      return resolveDataSourceOperationEndpoint(listDataSource, 'list');
    } catch {
      return listDataSource.endpoint?.trim() ?? '';
    }
  }, [listDataSource]);
  const configuredEdgeModelId = toolbarConfig?.serverQuery?.edgeModelId?.trim() ?? '';
  const shouldResolveEdgeModel = serverQueryEnabled && !configuredEdgeModelId && Boolean(listEndpointForResolve);
  const resolvedEdgeModelQuery = useResolveEdgeModelIdQuery(listEndpointForResolve, shouldResolveEdgeModel);
  const edgeModelId = configuredEdgeModelId || resolvedEdgeModelQuery.data?.edgeModelId;
  const querySurfaceRuntime = useQuerySurfaceRuntimeQuery(serverQueryEnabled ? edgeModelId : undefined);
  const queryPresetsStorePath = toolbarConfig?.queryPresetsStorePath ?? 'gridToolbar.queryPresets';
  const columnListWhereFields = React.useMemo(
    () => designerGridColumnsToListWhereFields(
      columns,
      translate
        ? (column) => resolveDesignerColumnLabel(column, translate)
        : undefined,
    ),
    [columns, translate, culture?.ready],
  );
  const listWhereFields = React.useMemo(() => {
    const manifestFields = querySurfaceRuntime.data?.listWhereFields;
    let fields = manifestFields && manifestFields.length > 0
      ? mergeManifestListWhereFieldsWithColumnLabels(manifestFields, columnListWhereFields)
      : columnListWhereFields;
    const memberDirectoryListApi = listEndpointForResolve.includes('member-directory')
      || Boolean(listDataSource?.endpoint?.includes('member-directory'));
    if (memberDirectoryListApi && translate) {
      fields = localizeHwyMemberDirectoryListWhereFields(fields, translate);
    }
    return fields;
  }, [
    columnListWhereFields,
    listDataSource?.endpoint,
    listEndpointForResolve,
    querySurfaceRuntime.data?.listWhereFields,
    translate,
    culture?.ready,
  ]);
  const listWhereTreeFromStore = React.useMemo(() => {
    const raw = readNestedContextValue(options.designerStore ?? {}, designerGridListWhereStorePath);
    if (typeof raw !== 'string' || !raw.trim()) {
      return createEmptyWhereTree();
    }
    return parseListWhereTreeParam(raw, listWhereFields, DEFAULT_WHERE_OPERATORS) ?? createEmptyWhereTree();
  }, [designerGridListWhereStorePath, listWhereFields, options.designerStore]);
  const listFilter = useListFilter({
    value: listWhereTreeFromStore,
    fields: listWhereFields,
    operators: DEFAULT_WHERE_OPERATORS,
    onApply: (next) => {
      const serialized = isListWhereTreeActive(next, DEFAULT_WHERE_OPERATORS)
        ? serializeListWhereTree(next)
        : '';
      options.previewEvents?.patchStore?.(designerGridListWhereStorePath, serialized);
      options.onGridRefresh?.();
    },
  });
  const listWhereFilterEnabled = toolbarConfig?.listWhereFilter !== false
    && toolbarConfig?.serverQuery?.enabled === true;
  const aggregationConfig = React.useMemo(
    () => parseGridAggregationConfig(node.props.gridAggregationConfig),
    [node.props.gridAggregationConfig],
  );
  const aggregationEnabled = isGridAggregationEnabled(aggregationConfig);
  const [collapsedGroupPaths, setCollapsedGroupPaths] = React.useState<Set<string>>(() => new Set());
  const effectiveGridQueryMode = resolveEffectiveAppTableGridQueryMode(gridQueryMode, serverQueryEnabled);
  const hydratedRows = options.gridRows;
  const fallbackRows = MOCK_DESIGNER_APP_TABLE_GRID_ROWS;
  const toolbarEnabled = isDesignerGridToolbarEnabled(toolbarConfig);
  const queryPresetSelectedIds = React.useMemo(
    () => parseQueryPresetsStoreValue(readNestedContextValue(options.designerStore ?? {}, queryPresetsStorePath)),
    [options.designerStore, queryPresetsStorePath],
  );
  const queryPresetChipsEnabled = toolbarConfig?.queryPresetChips !== false;
  const queryPresetChips = React.useMemo(
    () => (querySurfaceRuntime.data?.presets ?? []).map((preset) => ({
      id: preset.id,
      label: preset.label,
      application: preset.application,
      defaultSelected: preset.defaultSelected,
    })),
    [querySurfaceRuntime.data?.presets],
  );
  React.useEffect(() => {
    const defaults = querySurfaceRuntime.data?.defaultPresetIds;
    const patchStore = options.previewEvents?.patchStore;
    if (!serverQueryEnabled || !queryPresetChipsEnabled || !patchStore || !defaults?.length) {
      return;
    }
    const current = readNestedContextValue(options.designerStore ?? {}, queryPresetsStorePath);
    if (typeof current === 'string' && current.trim()) {
      return;
    }
    patchStore(queryPresetsStorePath, serializeQueryPresetsStoreValue(defaults));
    options.onGridRefresh?.();
  }, [
    options.designerStore,
    options.onGridRefresh,
    options.previewEvents?.patchStore,
    queryPresetsStorePath,
    queryPresetChipsEnabled,
    querySurfaceRuntime.data?.defaultPresetIds,
    serverQueryEnabled,
  ]);
  const handleQueryPresetChange = React.useCallback((nextIds: string[]) => {
    options.previewEvents?.patchStore?.(queryPresetsStorePath, serializeQueryPresetsStoreValue(nextIds));
    options.onGridRefresh?.();
  }, [options.onGridRefresh, options.previewEvents?.patchStore, queryPresetsStorePath]);
  const toolbarFieldFilters = React.useMemo(
    () => resolveEffectiveFieldFilters(toolbarConfig),
    [toolbarConfig],
  );
  const { fieldFilters: resolvedToolbarFieldFilters, revalidateLovFilter } = useResolvedToolbarFieldFilters(
    toolbarFieldFilters,
    previewBindingDefinitions,
  );
  const toolbarFieldFiltersStructureSignature = React.useMemo(
    () => JSON.stringify(toolbarFieldFilters.map((filter) => ({
      id: filter.id,
      controlType: filter.controlType,
      optionsSource: filter.optionsSource,
      lovRef: filter.lovRef,
      defaultValue: filter.defaultValue,
      matchLogic: filter.matchLogic,
      multiple: filter.multiple === true,
    }))),
    [toolbarFieldFilters],
  );
  const resolvedToolbarFieldFiltersRef = React.useRef(resolvedToolbarFieldFilters);
  resolvedToolbarFieldFiltersRef.current = resolvedToolbarFieldFilters;
  // Legacy mirrors for callers/tests that still assert roleFilters/paramFilters shapes.
  const toolbarRoles = React.useMemo(() => {
    if (toolbarConfig?.roleFilters?.roles) {
      return toolbarConfig.roleFilters.roles;
    }
    const rolesFilter = toolbarFieldFilters.find((filter) => (
      filter.field === 'roles' || filter.id === 'roles' || filter.apiParam === 'roleNames'
    ));
    return rolesFilter ? resolveFieldFilterStaticOptions(rolesFilter).map((option) => option.value) : [];
  }, [toolbarConfig?.roleFilters?.roles, toolbarFieldFilters]);
  const toolbarParamFilters = React.useMemo(() => (
    toolbarConfig?.paramFilters?.filters
      ?? resolvedToolbarFieldFilters
        .filter((filter) => filter.controlType === 'radio-group' || filter.controlType === 'select')
        .map((filter) => ({
          id: filter.id,
          label: filter.label,
          options: resolveFieldFilterStaticOptions(filter),
          storePath: filter.storePath,
          apiParam: filter.apiParam,
        }))
  ), [toolbarConfig?.paramFilters?.filters, resolvedToolbarFieldFilters]);
  const toolbarParamFiltersSignature = toolbarParamFilters.map((filter) => filter.id).join('|');
  const searchDebounceMs = toolbarConfig?.search?.debounceMs ?? 300;
  const [searchInput, setSearchInput] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [checkboxSelections, setCheckboxSelections] = React.useState<Record<string, Record<string, boolean>>>(
    () => buildInitialCheckboxSelections(resolvedToolbarFieldFilters),
  );
  const [radioSelections, setRadioSelections] = React.useState<Record<string, string>>(
    () => buildInitialRadioSelections(resolvedToolbarFieldFilters),
  );
  const [matchLogicByFilterId, setMatchLogicByFilterId] = React.useState<Record<string, FilterMatchLogic>>(
    () => buildInitialMatchLogicByFilterId(resolvedToolbarFieldFilters),
  );
  const roleFilters = React.useMemo(() => {
    const rolesFilter = resolvedToolbarFieldFilters.find((filter) => (
      filter.controlType === 'checkbox-group'
      && (filter.field === 'roles' || filter.id === 'roles' || filter.apiParam === 'roleNames')
    ));
    if (rolesFilter && checkboxSelections[rolesFilter.id]) {
      return checkboxSelections[rolesFilter.id]!;
    }
    const firstCheckbox = resolvedToolbarFieldFilters.find((filter) => filter.controlType === 'checkbox-group');
    if (firstCheckbox && checkboxSelections[firstCheckbox.id]) {
      return checkboxSelections[firstCheckbox.id]!;
    }
    return buildInitialRoleFilters(toolbarRoles);
  }, [checkboxSelections, resolvedToolbarFieldFilters, toolbarRoles]);
  const paramFilterValues = radioSelections;
  const tableInteractionClass = designInteractionClass(options.mode, Boolean(options.onGridRowAction));
  const previewDocument = options.designerDocument ?? options.previewEvents?.document;

  React.useEffect(() => {
    setCheckboxSelections(buildInitialCheckboxSelections(resolvedToolbarFieldFiltersRef.current));
    setRadioSelections(buildInitialRadioSelections(resolvedToolbarFieldFiltersRef.current));
    setMatchLogicByFilterId(buildInitialMatchLogicByFilterId(resolvedToolbarFieldFiltersRef.current));
  }, [node.id, toolbarFieldFiltersStructureSignature]);

  const gridBinding = getNodeGridListResourceBinding(node);
  const memberDirectoryGridListEndpoint = React.useMemo(() => {
    const dataSourceRef = gridBinding?.dataSourceRef?.trim()
      ?? gridBinding?.sourcePath?.trim();
    if (!dataSourceRef || !previewBindingDefinitions?.dataSources) {
      return '';
    }
    return previewBindingDefinitions.dataSources[dataSourceRef]?.endpoint?.trim() ?? '';
  }, [gridBinding?.dataSourceRef, gridBinding?.sourcePath, previewBindingDefinitions?.dataSources]);
  const hwyMemberDirectoryListScopeLegacy = React.useMemo(
    () => resolveHwyMemberDirectoryListScopeLegacy({
      queryListScope: gridBinding?.queryParams?.listScope ?? gridBinding?.queryParams?.listDefLegacy,
      pageName: previewDocument?.name,
    }),
    [
      gridBinding?.queryParams?.listDefLegacy,
      gridBinding?.queryParams?.listScope,
      previewDocument?.name,
    ],
  );
  const isQuickSearchMemberDirectoryList = isHwyMemberQuickSearchListScope(hwyMemberDirectoryListScopeLegacy);
  const memberDirectoryListWhereFilterEnabled = listWhereFilterEnabled && !isQuickSearchMemberDirectoryList;
  const memberDirectoryShowPagingFooter = showPagingFooter && !isQuickSearchMemberDirectoryList;
  const isHwyMemberDirectoryListGrid = isHwyMemberDirectoryListApiEndpoint(memberDirectoryGridListEndpoint)
    || Boolean(hwyMemberDirectoryListScopeLegacy)
    || Boolean(
      gridBinding?.dataSourceRef?.toLowerCase().includes('hwymemberdirectory')
      || gridBinding?.sourcePath?.toLowerCase().includes('hwymemberdirectory'),
    );
  const isImageFixMemberDirectoryList = isHwyMemberImageFixListScope(hwyMemberDirectoryListScopeLegacy);
  const isListScopedEditMemberDirectoryList = Boolean(
    resolveHwyMemberListScopedEditProfile(hwyMemberDirectoryListScopeLegacy),
  );

  const resolvedToolbarConfig = React.useMemo(
    () => resolveDesignerGridToolbarConfigForHwyMemberDirectoryList(
      toolbarConfig,
      isHwyMemberDirectoryListGrid,
    ),
    [isHwyMemberDirectoryListGrid, toolbarConfig],
  );
  const toolbarSearchDebounceMs = resolvedToolbarConfig?.search?.debounceMs ?? searchDebounceMs;

  React.useEffect(() => {
    if (options.mode === 'design' || !resolvedToolbarConfig?.search?.enabled) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, toolbarSearchDebounceMs);

    return () => window.clearTimeout(timer);
  }, [options.mode, resolvedToolbarConfig?.search?.enabled, searchInput, toolbarSearchDebounceMs]);

  const hwyListLegacyFieldFilterBarStorageKey = hwyMemberDirectoryListScopeLegacy
    ?? previewDocument?.name?.trim()
    ?? node.id;
  const hwyListUsesLegacyFieldFilterBar = Boolean(
    isHwyMemberDirectoryListGrid
    && options.mode !== 'design'
    && !isQuickSearchMemberDirectoryList,
  );
  const memberDirectoryPageStorePath = gridBinding?.dataPath?.trim() || 'gridQuery.page';
  const clearLegacyMemberDirectoryFilterStore = React.useCallback(() => {
    if (!options.previewEvents?.patchStore) {
      return;
    }
    const patches = {
      ...buildClearHwyMemberDirectoryLegacyFilterStorePatches(),
      [memberDirectoryPageStorePath]: 1,
    };
    applyDesignerStorePatches(
      options.previewEvents,
      patches,
      options.designerStore,
    );
  }, [memberDirectoryPageStorePath, options.designerStore, options.previewEvents]);
  const {
    legacyFieldFiltersVisible,
    toggleLegacyFieldFilters,
  } = useHwyLegacyFieldFilterBarMode(
    hwyListLegacyFieldFilterBarStorageKey,
    hwyListUsesLegacyFieldFilterBar ? clearLegacyMemberDirectoryFilterStore : undefined,
  );
  const legacyFieldFilterToggleNode = hwyListUsesLegacyFieldFilterBar ? (
    <HwyLegacyFieldFilterBarToggle
      active={legacyFieldFiltersVisible}
      onToggle={toggleLegacyFieldFilters}
    />
  ) : null;
  const imageFixLegacyFieldFilterLabeledToggleNode = isImageFixMemberDirectoryList ? (
    <HwyLegacyFieldFilterBarToggle
      active={legacyFieldFiltersVisible}
      onToggle={toggleLegacyFieldFilters}
      presentation="labeled"
    />
  ) : null;
  const legacyMemberDirectorySearchActive = hwyListUsesLegacyFieldFilterBar
    && legacyFieldFiltersVisible;
  const prevLegacyFieldFiltersVisibleRef = React.useRef(legacyFieldFiltersVisible);

  React.useEffect(() => {
    if (options.mode === 'design') {
      registerHwyMemberListScopedEditListScope(null);
      return undefined;
    }
    registerHwyMemberListScopedEditListScope(hwyMemberDirectoryListScopeLegacy);
    return () => registerHwyMemberListScopedEditListScope(null);
  }, [hwyMemberDirectoryListScopeLegacy, options.mode]);
  const imageFixFilters = React.useMemo(
    () => readHwyMemberImageFixListFiltersFromStore(options.designerStore),
    [options.designerStore],
  );
  const pageStorePath = memberDirectoryPageStorePath;
  const storePage = readPageFromStore(options.designerStore, pageStorePath);

  const [localPage, setLocalPage] = React.useState(() => storePage ?? pagingConfig.page);
  const [localPageSize, setLocalPageSize] = React.useState(pagingConfig.pageSize);
  React.useEffect(() => {
    if (options.mode !== 'runtime' || !isQuickSearchMemberDirectoryList) {
      return;
    }
    setLocalPageSize(HWY_MEMBER_QUICK_SEARCH_LIST_PAGE_SIZE);
    const pageSizeStorePath = resolvedToolbarConfig?.serverQuery?.pageSizeStorePath ?? 'gridQuery.pageSize';
    const previewEvents = options.previewEvents;
    if (!previewEvents?.patchStore) {
      return;
    }
    const current = readNestedContextValue(options.designerStore ?? {}, pageSizeStorePath);
    if (Number(current) !== HWY_MEMBER_QUICK_SEARCH_LIST_PAGE_SIZE) {
      previewEvents.patchStore(pageSizeStorePath, HWY_MEMBER_QUICK_SEARCH_LIST_PAGE_SIZE);
    }
  }, [
    isQuickSearchMemberDirectoryList,
    node.id,
    options.designerStore,
    options.mode,
    options.previewEvents,
    resolvedToolbarConfig?.serverQuery?.pageSizeStorePath,
  ]);
  const [localListMode, setLocalListMode] = React.useState<GridListMode>(listMode);
  const [infiniteFetchPage, setInfiniteFetchPage] = React.useState(1);
  const [infinitePagesLoaded, setInfinitePagesLoaded] = React.useState(0);
  const [infiniteAccumulatedRows, setInfiniteAccumulatedRows] = React.useState<Array<Record<string, unknown>>>([]);
  const lastMergedInfinitePageRef = React.useRef(0);
  const isInfiniteListMode = localListMode === 'infinite';

  const boundHydratedRows = React.useMemo(
    () => (hydratedRows ?? []) as Array<Record<string, unknown>>,
    [hydratedRows],
  );
  const allRows = React.useMemo(() => {
    if (!options.gridListBound) {
      return (hydratedRows && hydratedRows.length > 0 ? hydratedRows : fallbackRows) as Array<Record<string, unknown>>;
    }
    if (
      isInfiniteListMode
      && effectiveGridQueryMode === 'server'
      && infinitePagesLoaded > 0
    ) {
      return infiniteAccumulatedRows;
    }
    return boundHydratedRows;
  }, [
    boundHydratedRows,
    effectiveGridQueryMode,
    fallbackRows,
    hydratedRows,
    infiniteAccumulatedRows,
    infinitePagesLoaded,
    isInfiniteListMode,
    options.gridListBound,
  ]);

  React.useEffect(() => {
    if (!isImageFixMemberDirectoryList || options.mode === 'design') {
      return;
    }
    registerImageFixEditorPageMembers(
      allRows.map((row) => ({
        memberId: String(row.id ?? '').trim(),
        displayName: String(row.displayFullName ?? row.display_full_name ?? '').trim() || undefined,
        username: String(row.username ?? '').trim() || undefined,
      })).filter((entry) => entry.memberId.length > 0),
    );
  }, [allRows, isImageFixMemberDirectoryList, options.mode]);

  React.useEffect(() => {
    if (!isImageFixMemberDirectoryList || options.mode === 'design') {
      registerHwyImageFixListRefreshHandler(null);
      return undefined;
    }
    registerHwyImageFixListRefreshHandler(() => {
      options.onGridRefresh?.();
    });
    return () => registerHwyImageFixListRefreshHandler(null);
  }, [isImageFixMemberDirectoryList, options.mode, options.onGridRefresh]);

  const hasVisibleHydratedRows = Array.isArray(hydratedRows) && hydratedRows.length > 0;
  const showErrorState = options.gridListBound
    && !isLoading
    && errorContent.trim().length > 0
    && !hasVisibleHydratedRows
    && options.gridListError === true;

  const dynamicActionRuntime = React.useMemo((): DynamicActionRuntimeContext | undefined => {
    if (!options.previewEvents?.patchStore) {
      return undefined;
    }
    return {
      designerStore: options.designerStore ?? {},
      patchStore: options.previewEvents.patchStore,
      refreshDataSource: options.previewEvents.refreshDataSource,
      navigate: options.previewEvents.navigate,
    };
  }, [
    options.designerStore,
    options.previewEvents?.navigate,
    options.previewEvents?.patchStore,
    options.previewEvents?.refreshDataSource,
  ]);

  const gridColumns = React.useMemo(
    () => buildAppTableGridColumns(columns, effectiveGridQueryMode, {
      mode: options.mode,
      detailFlowRef,
      rowActionHandlerRef,
      cellClickHandlerRef,
      designerStoreRef,
      bindingDefinitions: previewBindingDefinitions,
      dynamicActionRuntime,
      previewEvents: options.previewEvents,
      translate,
      hwyMemberDirectoryListScopeLegacy,
      shellIsRtl: culture ? resolveCultureShellIsRtl(culture) : undefined,
      onMembershipQueueDecisionSaved: options.onGridRefresh,
    }),
    [
      columns,
      culture,
      dynamicActionRuntime,
      effectiveGridQueryMode,
      hwyMemberDirectoryListScopeLegacy,
      options.mode,
      options.onGridRefresh,
      options.previewEvents,
      translate,
      culture?.ready,
      previewBindingDefinitions,
    ],
  );
  const displayGridColumns = React.useMemo(
    () => wrapGridColumnsForAggregation(gridColumns, aggregationConfig),
    [aggregationConfig, gridColumns],
  );
  const gridColumnLayoutSignature = React.useMemo(
    () => buildColumnLayoutDefinitionSignature(gridColumns),
    [gridColumns],
  );

  const storedColumnLayouts = React.useMemo(() => {
    if (!gridId || !options.designerStore) {
      return null;
    }
    const rawLayouts = readNestedContextValue(options.designerStore, gridColumnLayoutStorePath);
    return parseUserGridColumnLayouts(rawLayouts);
  }, [gridColumnLayoutStorePath, gridId, options.designerStore]);

  const persistedColumnLayout = React.useMemo(
    () => (storedColumnLayouts ? resolveStoredGridColumnLayout(storedColumnLayouts, gridId) : null),
    [gridId, storedColumnLayouts],
  );
  const persistedColumnLayoutSignature = React.useMemo(
    () => (persistedColumnLayout ? JSON.stringify(persistedColumnLayout) : ''),
    [persistedColumnLayout],
  );

  const resolveGridColumnLayoutSeed = React.useCallback((
    stored: GridColumnLayoutState | null,
  ): GridColumnLayoutState => (
    enableColumnLayout
      ? sanitizeColumnLayout(stored ?? createDefaultColumnLayout(gridColumns), gridColumns)
      : mergeStoredColumnLayoutWidths(stored, gridColumns)
  ), [enableColumnLayout, gridColumns]);

  const [columnLayout, setColumnLayout] = React.useState<GridColumnLayoutState>(() => {
    const stored = persistedColumnLayout
      ?? (gridId ? resolveStoredColumnLayout(gridId) : null);
    return resolveGridColumnLayoutSeed(stored);
  });

  React.useEffect(() => {
    if (!gridId || options.mode === 'design') {
      return;
    }
    const stored = persistedColumnLayout
      ?? resolveStoredColumnLayout(gridId);
    const sanitized = resolveGridColumnLayoutSeed(stored);
    setColumnLayout((current) => (areColumnLayoutsEqual(current, sanitized) ? current : sanitized));
    // Intentionally keyed by signatures to avoid identity churn from column/store objects.
  }, [gridColumnLayoutSignature, gridId, options.mode, persistedColumnLayoutSignature, resolveGridColumnLayoutSeed]);

  React.useEffect(() => {
    if (options.mode === 'design') {
      return;
    }
    setColumnLayout((current) => {
      const sanitized = enableColumnLayout
        ? sanitizeColumnLayout(current, gridColumns)
        : mergeStoredColumnLayoutWidths(current, gridColumns);
      return areColumnLayoutsEqual(current, sanitized) ? current : sanitized;
    });
  }, [enableColumnLayout, gridColumnLayoutSignature, gridColumns, options.mode]);

  const storedColumnLayoutsRef = React.useRef(storedColumnLayouts);
  storedColumnLayoutsRef.current = storedColumnLayouts;

  const handleColumnLayoutChange = React.useCallback((
    nextLayout: GridColumnLayoutState,
    _meta: GridColumnLayoutChangeMeta,
  ) => {
    const sanitized = enableColumnLayout
      ? sanitizeColumnLayout(nextLayout, gridColumns)
      : mergeStoredColumnLayoutWidths(nextLayout, gridColumns);
    setColumnLayout((current) => (areColumnLayoutsEqual(current, sanitized) ? current : sanitized));

    if (!gridId || !previewEventsRef.current?.patchStore) {
      return;
    }

    const currentLayouts = storedColumnLayoutsRef.current ?? {};
    const mergedLayouts = mergeGridColumnLayout(currentLayouts, gridId, sanitized);
    previewEventsRef.current.patchStore(gridColumnLayoutStorePath, mergedLayouts);
  }, [
    enableColumnLayout,
    gridColumnLayoutStorePath,
    gridColumns,
    gridId,
  ]);

  const [query, setQuery] = React.useState<GridQueryState>(() => ({
    ...EMPTY_GRID_QUERY,
    sort: defaultSortBy ? { columnId: defaultSortBy, direction: defaultSortDirection } : null,
  }));

  React.useEffect(() => {
    setLocalPage(storePage ?? pagingConfig.page);
  }, [node.id, pagingConfig.page, pagingConfig.pageSize, storePage]);

  React.useEffect(() => {
    setLocalPageSize(pagingConfig.pageSize);
  }, [node.id, pagingConfig.pageSize]);

  React.useEffect(() => {
    setLocalListMode(listMode);
  }, [node.id, listMode]);

  const sortableColumnsSignature = React.useMemo(
    () => columns
      .filter((column) => column.sort)
      .map((column) => column.key)
      .sort()
      .join('|'),
    [columns],
  );

  const gridColumnsForQuerySyncRef = React.useRef(gridColumns);
  gridColumnsForQuerySyncRef.current = gridColumns;

  const footerSortFieldIdsSignature = footerSortFieldIds.join('|');

  React.useEffect(() => {
    const columnsForSanitize = gridColumnsForQuerySyncRef.current;
    const footerSortIds = footerSortFieldIdsRef.current;
    setQuery((current) => {
      const sortableKeys = new Set(
        sortableColumnsSignature.split('|').filter((key) => key.length > 0),
      );
      const footerSortKeys = new Set(footerSortIds);
      const currentSortStillValid = Boolean(
        current.sort?.columnId
        && (sortableKeys.has(current.sort.columnId) || footerSortKeys.has(current.sort.columnId)),
      );
      if (currentSortStillValid) {
        const nextQuery = sanitizeGridQuery(
          current,
          columnsForSanitize,
          effectiveGridQueryMode,
          footerSortIds,
        );
        return JSON.stringify(nextQuery) === JSON.stringify(current) ? current : nextQuery;
      }
      const nextSort = defaultSortBy
        ? { columnId: defaultSortBy, direction: current.sort?.direction ?? defaultSortDirection }
        : null;
      const nextQuery = sanitizeGridQuery(
        { ...current, sort: nextSort },
        columnsForSanitize,
        effectiveGridQueryMode,
        footerSortIds,
      );
      return JSON.stringify(nextQuery) === JSON.stringify(current) ? current : nextQuery;
    });
    // Intentionally keyed by sortable column ids + defaultSortBy — label/width/cellKind edits must
    // not wipe the user's interactive sort (parity audit item 75).
  }, [
    defaultSortBy,
    defaultSortDirection,
    effectiveGridQueryMode,
    footerSortFieldIdsSignature,
    node.id,
    sortableColumnsSignature,
  ]);

  const sanitizedQuery = React.useMemo(
    () => sanitizeGridQuery(query, gridColumns, effectiveGridQueryMode, footerSortFieldIds),
    [footerSortFieldIds, gridColumns, effectiveGridQueryMode, query],
  );
  const footerSortBy = sanitizedQuery.sort?.columnId ?? defaultSortBy;
  const footerSortDirection: GridSortDirection = sanitizedQuery.sort?.direction ?? defaultSortDirection;

  const roleFiltersSignature = React.useMemo(
    () => serializeRoleFilterSelection(roleFilters),
    [roleFilters],
  );
  const checkboxSelectionsSignature = React.useMemo(
    () => JSON.stringify(checkboxSelections),
    [checkboxSelections],
  );
  const matchLogicSignature = React.useMemo(
    () => JSON.stringify(matchLogicByFilterId),
    [matchLogicByFilterId],
  );
  const paramFilterValuesSignature = React.useMemo(
    () => JSON.stringify(paramFilterValues),
    [paramFilterValues],
  );
  const paramFilterStorePaths = React.useMemo(
    () => Object.fromEntries(toolbarParamFilters.map((filter) => [filter.id, filter.storePath])),
    [toolbarParamFiltersSignature],
  );

  const filteredRows = React.useMemo(() => {
    const queried = applyClientGridQuery(allRows, sanitizedQuery, gridColumns, effectiveGridQueryMode);
    // When sync-to-API is off, toolbar search/field filters would otherwise be dead — apply them
    // client-side on the currently loaded rows (parity audit items 73/74 + Phase 26).
    if (serverQueryEnabled) {
      return queried;
    }
    return applyDesignerGridToolbarClientFilters(queried, {
      searchText: debouncedSearch,
      fieldFilters: resolvedToolbarFieldFilters,
      checkboxSelections,
      radioSelections,
      matchLogicByFilterId,
      roleFilters,
    });
  }, [
    allRows,
    checkboxSelections,
    debouncedSearch,
    effectiveGridQueryMode,
    gridColumns,
    matchLogicByFilterId,
    radioSelections,
    roleFilters,
    sanitizedQuery,
    serverQueryEnabled,
    resolvedToolbarFieldFilters,
  ]);

  const aggregatedRows = React.useMemo(() => {
    if (!aggregationEnabled || !aggregationConfig) {
      return filteredRows;
    }
    return applyGridAggregation(filteredRows, aggregationConfig);
  }, [aggregationConfig, aggregationEnabled, filteredRows]);

  React.useEffect(() => {
    if (options.mode === 'design') {
      return undefined;
    }
    return registerDesignerExportSource('gridListResource', node.id, () => ({
      rows: filteredRows as Record<string, unknown>[],
      filename: `grid-${node.id}`,
    }));
  }, [filteredRows, node.id, options.mode]);

  const handleToolbarExport = React.useCallback((format: DesignerExportFormat) => {
    void exportDesignerData({
      format,
      rows: filteredRows as Record<string, unknown>[],
      filename: `grid-${node.id}`,
    }).catch((exportFailure: unknown) => {
      const message = exportFailure instanceof Error ? exportFailure.message : 'Export failed';
      showAppFeedbackToast(message, { variant: 'danger' });
    });
  }, [filteredRows, node.id]);

  const visibleAggregatedRows = React.useMemo(
    () => filterCollapsedAggregationRows(aggregatedRows, collapsedGroupPaths, aggregationConfig),
    [aggregatedRows, aggregationConfig, collapsedGroupPaths],
  );

  const querySignature = React.useMemo(
    () => JSON.stringify(sanitizedQuery),
    [sanitizedQuery],
  );

  const resetInfiniteListState = React.useCallback(() => {
    lastMergedInfinitePageRef.current = 0;
    setInfiniteFetchPage(1);
    setInfinitePagesLoaded(0);
    setInfiniteAccumulatedRows([]);
  }, []);

  React.useEffect(() => {
    setLocalPage(1);
    resetInfiniteListState();
  }, [
    debouncedSearch,
    localPageSize,
    matchLogicSignature,
    paramFilterValuesSignature,
    querySignature,
    resetInfiniteListState,
    roleFiltersSignature,
  ]);

  React.useEffect(() => {
    if (!isInfiniteListMode || !options.gridListBound || effectiveGridQueryMode !== 'server') {
      return;
    }
    if (isLoading) {
      return;
    }

    const pageRows = boundHydratedRows;
    if (infiniteFetchPage === 1) {
      lastMergedInfinitePageRef.current = 1;
      setInfiniteAccumulatedRows(pageRows);
      setInfinitePagesLoaded(1);
      return;
    }

    if (infiniteFetchPage > lastMergedInfinitePageRef.current) {
      lastMergedInfinitePageRef.current = infiniteFetchPage;
      setInfiniteAccumulatedRows((current) => (
        appendServerInfiniteGridRows(current, pageRows, rowKeyField)
      ));
      setInfinitePagesLoaded(infiniteFetchPage);
    }
  }, [
    boundHydratedRows,
    effectiveGridQueryMode,
    infiniteFetchPage,
    isInfiniteListMode,
    isLoading,
    options.gridListBound,
    rowKeyField,
  ]);

  const totalCount = isQuickSearchMemberDirectoryList
    ? Math.min(visibleAggregatedRows.length, HWY_MEMBER_QUICK_SEARCH_LIST_PAGE_SIZE)
    : resolveDataGridTotalCount(
      {
        ...pagingConfig,
        gridQueryMode: effectiveGridQueryMode,
        total: options.gridListTotalCount ?? pagingConfig.total,
      },
      visibleAggregatedRows.length,
    );
  const { displayRows, safePage, totalPages } = sliceDataGridRowsForDisplay(
    visibleAggregatedRows,
    localPage,
    localPageSize,
    totalCount,
    effectiveGridQueryMode,
  );
  const pageNumbers = buildDataGridPageNumbers(safePage, totalPages);
  const serverQueryPage = isInfiniteListMode ? infiniteFetchPage : safePage;
  const serverQueryPageSize = localPageSize;
  const infiniteLoadedRowCount = isInfiniteListMode
    ? (infinitePagesLoaded > 0 ? infiniteAccumulatedRows.length : boundHydratedRows.length)
    : 0;
  const visibleInfiniteCount = isInfiniteListMode
    ? Math.min(infiniteLoadedRowCount, totalCount)
    : undefined;
  const isFetchingNextInfinitePage = isInfiniteListMode && infiniteFetchPage > infinitePagesLoaded;
  const hasMoreInfiniteRows = isInfiniteListMode
    && infiniteLoadedRowCount < totalCount
    && !isFetchingNextInfinitePage;
  const shellStyle = resolveDesignerDataGridShellStyle(options.style);

  const hwyMembershipListActionsKind = React.useMemo(
    () => (options.mode === 'runtime'
      ? resolveHwyMemberMembershipListActionsKind({
        pathname: location.pathname,
        listScopeLegacy: hwyMemberDirectoryListScopeLegacy,
      })
      : null),
    [hwyMemberDirectoryListScopeLegacy, location.pathname, options.mode],
  );
  const rejectionListPageMemberIds = React.useMemo(() => {
    if (!hwyMembershipListActionsKind?.startsWith('rejected_')) {
      return [];
    }
    return displayRows
      .map((row) => String((row as Record<string, unknown>).id ?? '').trim())
      .filter((id) => id.length > 0);
  }, [displayRows, hwyMembershipListActionsKind]);

  const keyedRows = React.useMemo(
    () => displayRows.map((row, index) => ({
      ...row,
      __designerRowKey: String(
        row[GRID_ROW_KIND_KEY]
          ? `${row[GRID_ROW_KIND_KEY]}-${row[GRID_GROUP_PATH_KEY] ?? index}-${index}`
          : row[rowKeyField] ?? row.id ?? `page-${safePage}-row-${index}`,
      ),
    })),
    [displayRows, rowKeyField, safePage],
  );

  const handleAggregationRowClick = React.useCallback((row: DesignerGridRow) => {
    if (!aggregationConfig?.collapsibleGroups || options.mode === 'design') {
      return;
    }
    if (row[GRID_ROW_KIND_KEY] !== 'group-header') {
      return;
    }
    const path = typeof row[GRID_GROUP_PATH_KEY] === 'string' ? row[GRID_GROUP_PATH_KEY]! : '';
    if (!path) {
      return;
    }
    setCollapsedGroupPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, [aggregationConfig?.collapsibleGroups, options.mode]);

  const handleQueryChange = React.useCallback((nextQuery: GridQueryState) => {
    setQuery(nextQuery);
  }, []);

  const syncServerQueryToStore = React.useCallback((
    nextQuery: GridQueryState,
    page: number,
    pageSize: number,
    searchText: string,
    nextCheckboxSelections: Record<string, Record<string, boolean>>,
    nextRadioSelections: Record<string, string>,
    nextMatchLogicByFilterId: Record<string, FilterMatchLogic>,
  ) => {
    const previewEvents = previewEventsRef.current;
    const serverQuery = resolvedToolbarConfig?.serverQuery;
    if (
      gridQueryMode !== 'server'
      || serverQuery?.enabled !== true
      || options.mode !== 'runtime'
      || !previewEvents?.patchStore
    ) {
      return;
    }

    const patches = buildServerQueryStorePatches(nextQuery, {
      page,
      pageSize,
      searchText,
      fieldFilters: resolvedToolbarFieldFiltersRef.current,
      checkboxSelections: nextCheckboxSelections,
      radioSelections: nextRadioSelections,
      matchLogicByFilterId: nextMatchLogicByFilterId,
      paramFilterValues: nextRadioSelections,
      config: serverQuery,
      searchStorePath: resolvedToolbarConfig?.search?.storePath,
      roleStorePath: resolvedToolbarConfig?.roleFilters?.storePath,
      paramFilterStorePaths,
      queryPresetIds: queryPresetSelectedIds,
      queryPresetsStorePath,
    });
    const currentStore = designerStoreRef.current ?? previewEvents.designerStore ?? {};
    const changedPatches = filterChangedStorePatches(patches, currentStore);
    const signature = JSON.stringify(changedPatches);
    if (signature === lastServerQuerySyncSignatureRef.current) {
      return;
    }
    lastServerQuerySyncSignatureRef.current = signature;
    if (Object.keys(changedPatches).length === 0) {
      return;
    }
    applyDesignerStorePatches(previewEvents, changedPatches, currentStore);
  }, [
    gridQueryMode,
    options.mode,
    paramFilterStorePaths,
    queryPresetSelectedIds,
    queryPresetsStorePath,
    resolvedToolbarConfig,
    toolbarFieldFiltersStructureSignature,
  ]);

  const serverSearchText = debouncedSearch;

  React.useEffect(() => {
    syncServerQueryToStore(
      sanitizedQuery,
      serverQueryPage,
      serverQueryPageSize,
      serverSearchText,
      checkboxSelections,
      radioSelections,
      matchLogicByFilterId,
    );
  }, [
    checkboxSelectionsSignature,
    serverSearchText,
    matchLogicSignature,
    paramFilterValuesSignature,
    querySignature,
    serverQueryPage,
    serverQueryPageSize,
    syncServerQueryToStore,
  ]);

  const emitSortChange = React.useCallback((columnId: string, direction: GridSortDirection) => {
    if (options.mode !== 'runtime') {
      return;
    }

    const payload = { column: columnId, direction };
    const previewHandler = previewHandlers.onSortChange;
    if (previewHandler) {
      previewHandler({ target: { value: payload } } as unknown as Event);
      return;
    }

    if (mockEvents.onSortChange) {
      mockEvents.onSortChange({ target: { value: payload } } as unknown as Event);
      return;
    }

    if (gridBinding?.storeWritePath?.trim()) {
      options.previewEvents?.patchStore(gridBinding.storeWritePath.trim(), payload);
    }
  }, [gridBinding?.storeWritePath, mockEvents, options.mode, options.previewEvents, previewHandlers.onSortChange]);

  const handleFooterSortByChange = React.useCallback((nextSortBy: string) => {
    setQuery((current) => sanitizeGridQuery({
      ...current,
      sort: {
        columnId: nextSortBy,
        direction: current.sort?.direction ?? 'asc',
      },
    }, gridColumns, effectiveGridQueryMode, footerSortFieldIds));
    emitSortChange(nextSortBy, footerSortDirection);
  }, [emitSortChange, effectiveGridQueryMode, footerSortDirection, footerSortFieldIds, gridColumns]);

  const handleFooterSortDirectionToggle = React.useCallback(() => {
    const nextDirection: GridSortDirection = footerSortDirection === 'asc' ? 'desc' : 'asc';
    const nextColumnId = footerSortBy || defaultSortBy;
    if (!nextColumnId) {
      return;
    }

    setQuery((current) => sanitizeGridQuery({
      ...current,
      sort: {
        columnId: nextColumnId,
        direction: nextDirection,
      },
    }, gridColumns, effectiveGridQueryMode, footerSortFieldIds));
    emitSortChange(nextColumnId, nextDirection);
  }, [
    defaultSortBy,
    effectiveGridQueryMode,
    emitSortChange,
    footerSortBy,
    footerSortDirection,
    footerSortFieldIds,
    gridColumns,
  ]);

  const handlePageChange = React.useCallback((nextPage: number) => {
    const normalizedPage = Math.max(1, Math.min(nextPage, totalPages));
    setLocalPage(normalizedPage);

    if (options.mode !== 'runtime') {
      return;
    }

    const previewHandler = previewHandlers.onPageChange;
    if (previewHandler) {
      previewHandler({ target: { value: String(normalizedPage) } } as unknown as Event);
      return;
    }

    if (mockEvents.onPageChange) {
      mockEvents.onPageChange({ target: { value: String(normalizedPage) } } as unknown as Event);
      return;
    }

    options.previewEvents?.patchStore(pageStorePath, normalizedPage);
  }, [
    mockEvents.onPageChange,
    options.mode,
    options.previewEvents,
    pageStorePath,
    previewHandlers.onPageChange,
    totalPages,
  ]);

  const handlePageSizeChange = React.useCallback((nextSize: number) => {
    setLocalPageSize(nextSize);
    setLocalPage(1);
    resetInfiniteListState();
  }, [resetInfiniteListState]);

  const handleListModeChange = React.useCallback((nextMode: GridListMode) => {
    setLocalListMode(nextMode);
    setLocalPage(1);
    resetInfiniteListState();
    if (options.mode === 'runtime' && options.previewEvents?.patchStore) {
      options.previewEvents.patchStore(pageStorePath, 1);
    }
  }, [options.mode, options.previewEvents, pageStorePath, resetInfiniteListState]);

  const requestNextInfinitePage = React.useCallback(() => {
    if (!hasMoreInfiniteRows || isLoading || isFetchingNextInfinitePage) {
      return;
    }
    setInfiniteFetchPage(infinitePagesLoaded + 1);
  }, [hasMoreInfiniteRows, infinitePagesLoaded, isFetchingNextInfinitePage, isLoading]);

  const handleInfiniteScroll = React.useCallback((event: React.UIEvent<HTMLDivElement>) => {
    if (!hasMoreInfiniteRows) {
      return;
    }
    const element = event.currentTarget;
    const remaining = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (remaining <= 48) {
      requestNextInfinitePage();
    }
  }, [hasMoreInfiniteRows, requestNextInfinitePage]);

  const gridShellRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (
      options.mode === 'design'
      || !isInfiniteListMode
      || !hasMoreInfiniteRows
      || isLoading
      || isFetchingNextInfinitePage
    ) {
      return;
    }
    const scroller = gridShellRef.current?.querySelector<HTMLDivElement>(
      '[data-table-grid-scroll-owner="self"]',
    );
    if (!scroller) {
      return;
    }
    const fitsWithoutScroll = scroller.scrollHeight <= scroller.clientHeight + 1;
    if (fitsWithoutScroll) {
      requestNextInfinitePage();
    }
  }, [
    displayRows.length,
    hasMoreInfiniteRows,
    isFetchingNextInfinitePage,
    isInfiniteListMode,
    isLoading,
    options.mode,
    requestNextInfinitePage,
  ]);

  const presentationMode = presentation === 'table'
    || presentation === 'cards'
    || presentation === 'table-scroll'
    ? presentation
    : 'auto';
  const cardBelowTier = sanitizeGridCardBelow(cardBelow);
  const shellClassName = resolveAppTableGridShellClassNames(
    mergeClassNames(
      fillHeight
        ? 'relative z-0 flex min-h-0 w-full flex-1 flex-col'
        : 'relative z-0 flex w-full flex-col',
      options.className,
    ),
    toolbarEnabled,
  );
  const selectionModeRaw = readString(node.props.selectionMode, 'none');
  const selectionMode = selectionModeRaw === 'single' || selectionModeRaw === 'multiple'
    ? selectionModeRaw
    : 'none';
  const selectionStorePath = toolbarConfig?.selectionStorePath?.trim()
    || readString(node.props.selectionStorePath, DEFAULT_GRID_SELECTION_STORE_PATH);
  const storeSelectedKeys = readSelectedKeysFromStore(options.designerStore, selectionStorePath);
  const [localSelectedKeys, setLocalSelectedKeys] = React.useState<string[]>(storeSelectedKeys);
  React.useEffect(() => {
    setLocalSelectedKeys(storeSelectedKeys);
  }, [storeSelectedKeys.join('|')]);

  const handleSelectionChange = React.useCallback((keys: string[]) => {
    setLocalSelectedKeys(keys);
    options.previewEvents?.patchStore?.(selectionStorePath, keys);
    const selectionHandler = (previewHandlers as { onSelectionChange?: (event: Event) => void }).onSelectionChange
      ?? (mockEvents as { onSelectionChange?: (event: Event) => void }).onSelectionChange;
    selectionHandler?.({ target: { value: keys.join(',') } } as unknown as Event);
  }, [mockEvents, options.previewEvents, previewHandlers, selectionStorePath]);

  const bulkActions = toolbarConfig?.bulkActions ?? [];
  const bulkBar = options.mode !== 'design'
    && bulkActions.length > 0
    && localSelectedKeys.length > 0
    && previewBindingDefinitions
    && dynamicActionRuntime
    ? (
      <DesignerGridBulkActionsBar
        bulkActions={bulkActions}
        selectedKeys={localSelectedKeys}
        bindingDefinitions={previewBindingDefinitions}
        runtime={dynamicActionRuntime}
        selectionStorePath={selectionStorePath}
      />
    )
    : null;

  const hoistToolbar = toolbarEnabled && Boolean(toolbarConfig) && options.mode !== 'design';
  const listPageScrollEnabled = toolbarEnabled && Boolean(toolbarConfig) && options.mode !== 'design';
  const gridScrollExtra = isInfiniteListMode && options.mode !== 'design' ? handleInfiniteScroll : undefined;
  const hasChildren = React.Children.count(options.children) > 0;

  const applyImageFixFilters = React.useCallback((filters: HwyMemberImageFixListFilterState) => {
    const patches = {
      ...buildHwyMemberImageFixListFilterStorePatches(filters),
      [pageStorePath]: 1,
    };
    const changed = applyDesignerStorePatches(
      options.previewEvents,
      patches,
      options.designerStore,
    );
    if (changed) {
      options.onGridRefresh?.();
    }
  }, [options.designerStore, options.onGridRefresh, options.previewEvents, pageStorePath]);

  const handleLegacyMemberDirectoryFilterFieldChange = React.useCallback((
    storePath: string,
    value: string,
  ) => {
    if (storePath === HWY_MEMBER_DIRECTORY_MEMBERSHIP_FILTER_STORE_PATH) {
      setRadioSelections((current) => ({
        ...current,
        membershipStatusCode: value,
      }));
    }
    if (storePath === HWY_MONTADHEMIN_INSTITUTE_FILTER_STORE_PATH) {
      setRadioSelections((current) => ({
        ...current,
        montadheminInstituteId: value,
      }));
    }
    if (storePath === HWY_MONTADHEMIN_INSTITUTE_MATCH_STORE_PATH) {
      const matchLogic: FilterMatchLogic = value === 'and' ? 'and' : DEFAULT_FILTER_MATCH_LOGIC;
      setMatchLogicByFilterId((current) => ({
        ...current,
        montadheminInstituteId: matchLogic,
      }));
    }
    const patches = {
      [storePath]: value,
      [pageStorePath]: 1,
    };
    const changed = applyDesignerStorePatches(
      options.previewEvents,
      patches,
      options.designerStore,
    );
    if (changed) {
      options.onGridRefresh?.();
    }
  }, [
    options.designerStore,
    options.onGridRefresh,
    options.previewEvents,
    pageStorePath,
    setMatchLogicByFilterId,
    setRadioSelections,
  ]);

  const usesStructuredLegacyFieldByFieldPanel = isHwyMemberListStructuredFieldByFieldLegacyScope(
    hwyMemberDirectoryListScopeLegacy,
  );

  const memberDirectoryLegacyFilterBarNode = legacyMemberDirectorySearchActive
    && usesStructuredLegacyFieldByFieldPanel
    && hwyMemberDirectoryListScopeLegacy ? (
      <HwyMemberDirectoryLegacyFieldByFieldPanel
        listScopeLegacy={hwyMemberDirectoryListScopeLegacy}
        designerStore={options.designerStore}
        bindingDefinitions={previewBindingDefinitions}
        onFieldChange={handleLegacyMemberDirectoryFilterFieldChange}
        imageFixFilters={isImageFixMemberDirectoryList ? imageFixFilters : undefined}
        onImageFixFiltersChange={isImageFixMemberDirectoryList ? applyImageFixFilters : undefined}
      />
    ) : null;

  React.useEffect(() => {
    if (!hwyListUsesLegacyFieldFilterBar || !legacyFieldFiltersVisible || options.mode === 'design') {
      return;
    }
    for (const filter of resolvedToolbarFieldFilters) {
      if (filter.controlType === 'select') {
        void revalidateLovFilter(filter.id);
      }
    }
  }, [
    hwyListUsesLegacyFieldFilterBar,
    legacyFieldFiltersVisible,
    options.mode,
    revalidateLovFilter,
    resolvedToolbarFieldFilters,
  ]);

  React.useEffect(() => {
    if (!hwyListUsesLegacyFieldFilterBar) {
      return;
    }
    if (prevLegacyFieldFiltersVisibleRef.current === legacyFieldFiltersVisible) {
      return;
    }
    prevLegacyFieldFiltersVisibleRef.current = legacyFieldFiltersVisible;
    if (legacyFieldFiltersVisible) {
      if (isImageFixMemberDirectoryList) {
        applyImageFixFilters(createDefaultHwyMemberImageFixListFilters());
      }
      return;
    }
    setCheckboxSelections(buildInitialCheckboxSelections(resolvedToolbarFieldFiltersRef.current));
    setRadioSelections(buildInitialRadioSelections(resolvedToolbarFieldFiltersRef.current));
    setMatchLogicByFilterId(buildInitialMatchLogicByFilterId(resolvedToolbarFieldFiltersRef.current));
    if (isImageFixMemberDirectoryList) {
      applyImageFixFilters(createHwyMemberImageFixListFiltersForSimpleSearch());
    }
  }, [
    applyImageFixFilters,
    hwyListUsesLegacyFieldFilterBar,
    isImageFixMemberDirectoryList,
    legacyFieldFiltersVisible,
  ]);

  const imageFixSearchPlaceholder = resolveDesignerGridCultureText(
    node,
    'searchPlaceholderTranslationKey',
    resolvedToolbarConfig?.search?.placeholder ?? 'Search members…',
    translate,
  );

  const imageFixToolbarNode = isImageFixMemberDirectoryList && toolbarEnabled ? (
    <HwyImageFixListToolbar
      value={imageFixFilters}
      onChange={applyImageFixFilters}
      totalCount={totalCount}
      onRefresh={() => options.onGridRefresh?.()}
      isRefreshing={isLoading}
      searchInput={searchInput}
      onSearchInputChange={setSearchInput}
      searchPlaceholder={imageFixSearchPlaceholder}
      legacyFieldFiltersVisible={!hwyListUsesLegacyFieldFilterBar || legacyFieldFiltersVisible}
      legacyFieldFilterModeActive={
        hwyListUsesLegacyFieldFilterBar ? legacyFieldFiltersVisible : false
      }
      legacyFieldFilterToggle={legacyFieldFilterToggleNode}
      legacyFieldFilterLabeledToggle={imageFixLegacyFieldFilterLabeledToggleNode}
      memberDirectoryLegacyFilterBar={memberDirectoryLegacyFilterBarNode}
      structuredMemberFieldFiltersInStack={usesStructuredLegacyFieldByFieldPanel}
    />
  ) : null;

  const toolbarNode = isImageFixMemberDirectoryList && toolbarEnabled ? imageFixToolbarNode : (
    toolbarEnabled && resolvedToolbarConfig ? (
    options.mode === 'design' ? (
      <DesignerGridPageToolbarPreview config={resolvedToolbarConfig} />
    ) : (
      <DesignerGridPageToolbar
        node={node}
        document={previewDocument}
        bindingDefinitions={previewBindingDefinitions}
        config={resolvedToolbarConfig}
        mode={options.mode}
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        roleFilters={roleFilters}
        checkboxSelections={checkboxSelections}
        onCheckboxFilterChange={(filterId, optionValue, checked) => {
          setCheckboxSelections((current) => ({
            ...current,
            [filterId]: {
              ...(current[filterId] ?? {}),
              [optionValue]: checked,
            },
          }));
        }}
        matchLogicByFilterId={matchLogicByFilterId}
        onMatchLogicChange={(filterId, value) => {
          setMatchLogicByFilterId((current) => ({
            ...current,
            [filterId]: value,
          }));
        }}
        paramFilterValues={paramFilterValues}
        radioSelections={radioSelections}
        onRadioFilterChange={(filterId, value) => {
          setRadioSelections((current) => ({
            ...current,
            [filterId]: value,
          }));
        }}
        onRefresh={options.onGridRefresh}
        isRefreshing={isLoading}
        listTotalCount={
          isQuickSearchMemberDirectoryList
            ? undefined
            : serverQueryEnabled && resolvedToolbarConfig?.refresh?.enabled === true
              ? totalCount
              : undefined
        }
        onExport={handleToolbarExport}
        patchStore={options.previewEvents?.patchStore}
        patchStoreState={options.previewEvents?.patchStoreState}
        navigate={options.previewEvents?.navigate}
        designerStore={options.designerStore}
        onLovFilterOpen={(filterId) => {
          void revalidateLovFilter(filterId);
        }}
        listWhereFilterEnabled={memberDirectoryListWhereFilterEnabled}
        listFilterButtonProps={listFilter.filterButtonProps}
        showFieldFilters={!hwyListUsesLegacyFieldFilterBar}
        legacyFieldFilterToggle={legacyFieldFilterToggleNode}
        legacyFieldFilterModeActive={
          hwyListUsesLegacyFieldFilterBar ? legacyFieldFiltersVisible : false
        }
        globalSearchVisible={!hwyListUsesLegacyFieldFilterBar || !legacyFieldFiltersVisible}
        memberDirectoryLegacyFilterBar={memberDirectoryLegacyFilterBarNode}
        queryPresets={serverQueryEnabled && queryPresetChipsEnabled && edgeModelId ? queryPresetChips : undefined}
        queryPresetSelectedIds={queryPresetSelectedIds}
        onQueryPresetChange={serverQueryEnabled && queryPresetChipsEnabled && edgeModelId ? handleQueryPresetChange : undefined}
      />
    )
  ) : null);

  const tableGrid = (
    <AppTableGrid
      size={gridSize}
      presentation={presentationMode}
      cardBelow={cardBelowTier}
      fillHeight={fillHeight}
      chrome={chrome}
      compact={compact}
      columns={displayGridColumns}
      rows={keyedRows}
      getRowKey={(row) => String((row as DesignerGridRow).__designerRowKey)}
      getRowClassName={(row) => resolveGridAggregationRowClassName(row as GridDisplayRow)}
      onRowClick={aggregationConfig?.collapsibleGroups ? handleAggregationRowClick : undefined}
      onScroll={listPageScrollEnabled ? undefined : gridScrollExtra}
      enableColumnLayout={enableColumnLayout}
      persistListKey={gridId || `designer-grid:${node.id}`}
      columnLayout={gridId && options.mode !== 'design' ? columnLayout : undefined}
      onColumnLayoutChange={gridId && options.mode !== 'design' ? handleColumnLayoutChange : undefined}
      gridQueryMode={effectiveGridQueryMode}
      query={query}
      onQueryChange={handleQueryChange}
      selectionMode={selectionMode}
      selectedKeys={localSelectedKeys}
      onSelectionChange={options.mode === 'design' ? undefined : handleSelectionChange}
      isLoading={isLoading}
      loadingMessage={loadingMessage}
      errorContent={showErrorState ? (
        <div className="flex h-40 flex-col items-center justify-center gap-3 px-6 text-center">
          <AlertCircle className="h-5 w-5 text-rose-600" aria-hidden="true" />
          <p className="max-w-lg text-sm text-rose-600">{errorContent}</p>
          <AppButton
            type="button"
            intent="utility"
            disabled={!options.onGridRefresh}
            onClick={() => options.onGridRefresh?.()}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </AppButton>
        </div>
      ) : undefined}
      isEmpty={!isLoading && !showErrorState && keyedRows.length === 0}
      emptyMessage={emptyContent}
      footer={memberDirectoryShowPagingFooter ? (
        <GridPagingFooter
          chrome={chrome === 'hero' ? 'hero' : undefined}
          totalCount={totalCount}
          safePage={safePage}
          pageSize={localPageSize}
          onPageSizeChange={handlePageSizeChange}
          sortBy={footerSortBy}
          sortOptions={sortOptions}
          onSortByChange={handleFooterSortByChange}
          sortDirection={footerSortDirection}
          onToggleSortDirection={handleFooterSortDirectionToggle}
          showSortControls={showSortControls && sortOptions.length > 0}
          totalPages={totalPages}
          pageNumbers={pageNumbers}
          onPageChange={handlePageChange}
          listMode={showListModeControls ? localListMode : undefined}
          onListModeChange={showListModeControls ? handleListModeChange : undefined}
          visibleInfiniteCount={visibleInfiniteCount}
          edgeAlignInDialog={edgeAlignPagingFooter ? true : undefined}
        />
      ) : undefined}
    />
  );

  const gridShell = (
    <div
      ref={gridShellRef}
      className={mergeClassNames(shellClassName, tableInteractionClass)}
      style={shellStyle}
      data-designer-component={APP_TABLE_GRID_PALETTE_ITEM_ID}
    >
      {hasChildren ? (
        <div className="mb-2 shrink-0">
          {wrapDesignerChildSlot(options.children, options.mode)}
        </div>
      ) : null}

      {!hoistToolbar ? toolbarNode : null}
      {!hoistToolbar && memberDirectoryListWhereFilterEnabled ? (
        <ListFilterSummaryBand {...listFilter.filterSummaryProps} />
      ) : null}
      {bulkBar}
      {tableGrid}
    </div>
  );

  const listFilterDialog = memberDirectoryListWhereFilterEnabled
    ? <ListFilterDialog {...listFilter.filterDialogProps} />
    : null;

  const hoistedListBody = (
    <>
      {toolbarNode}
      {memberDirectoryListWhereFilterEnabled ? <ListFilterSummaryBand {...listFilter.filterSummaryProps} /> : null}
      <div
        className={mergeClassNames(
          fillHeight
            ? 'flex min-h-0 w-full flex-1 flex-col overflow-hidden'
            : 'flex w-full flex-col',
          tableInteractionClass,
        )}
        data-designer-component={APP_TABLE_GRID_PALETTE_ITEM_ID}
        style={shellStyle}
      >
        {hasChildren ? (
          <div className="mb-2 shrink-0">
            {wrapDesignerChildSlot(options.children, options.mode)}
          </div>
        ) : null}
        {bulkBar}
        {tableGrid}
      </div>
    </>
  );

  const listBody = hoistToolbar ? hoistedListBody : gridShell;

  const wrapListPageShell = (content: React.ReactNode) => (
    listPageScrollEnabled
      ? (
        <ListPageShell
          onGridScroll={gridScrollExtra}
          className={fillHeight ? 'min-h-0 flex-1' : undefined}
        >
          {content}
        </ListPageShell>
      )
      : content
  );

  const imageFixRuntimeDialogs = isImageFixMemberDirectoryList && options.mode !== 'design'
    ? <HwyImageFixRuntimeDialogs onSaved={options.onGridRefresh} />
    : null;
  const listScopedEditRuntimeDialogs = isListScopedEditMemberDirectoryList && options.mode !== 'design'
    ? <HwyMemberListScopedEditRuntimeDialogs onSaved={options.onGridRefresh} />
    : null;

  const listChrome = (
    <>
      {wrapListPageShell(listBody)}
      {listFilterDialog}
      {imageFixRuntimeDialogs}
      {listScopedEditRuntimeDialogs}
    </>
  );

  if (hwyMembershipListActionsKind?.startsWith('rejected_') && options.mode !== 'design') {
    return (
      <HwyRejectionListRuntimeProvider
        pageMemberIds={rejectionListPageMemberIds}
        listActionsKind={hwyMembershipListActionsKind}
        onRefresh={options.onGridRefresh}
      >
        {listChrome}
      </HwyRejectionListRuntimeProvider>
    );
  }

  return listChrome;
};
