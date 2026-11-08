import type { DesignerGridRowActionBehavior } from './designerGridActionColumns';
import { parseDesignerGridRowActionBehavior } from './designerGridActionColumns';
import type { DesignerDataGridColumn } from './designerDataGridColumns';
import { isActionGridColumn } from './designerDataGridColumns';
import { isActionGroupColumn } from './designerGridActionColumns';
import type { WhereField } from '../../shared/ui/where-builder/whereBuilderModel';
import type { GridQueryState } from '../../shared/lib/appTableGridQuery';
import {
  DEFAULT_FILTER_MATCH_LOGIC,
  parseFilterMatchLogic,
  type FilterMatchLogic,
} from '../../shared/lib/filterMatchLogic';
import { LIST_INCLUDE_COUNT_PAGE1_ONLY_BINDING } from './bindingQueryParams';
import { readNestedContextValue } from './bindingResourceModel';
import {
  parseDesignerGridToolbarBulkActions,
  type DesignerGridToolbarBulkAction,
} from './designerGridSelectionRuntime';

export type { DesignerGridToolbarBulkAction };

export type DesignerGridToolbarSearchConfig = {
  enabled: boolean;
  placeholder?: string;
  storePath?: string;
  apiParam?: string;
  debounceMs?: number;
};

/** @deprecated Prefer `fieldFilters` with `controlType: 'checkbox-group'`. Kept for document migration. */
export type DesignerGridToolbarRoleFiltersConfig = {
  enabled: boolean;
  roles?: string[];
  storePath?: string;
  apiParam?: string;
};

export type DesignerGridToolbarParamFilterOption = {
  value: string;
  label: string;
};

/** @deprecated Prefer `fieldFilters` with `controlType: 'radio-group'`. Kept for document migration. */
export type DesignerGridToolbarParamFilter = {
  id: string;
  label: string;
  options: DesignerGridToolbarParamFilterOption[];
  storePath: string;
  apiParam: string;
  defaultValue?: string;
};

/** @deprecated Prefer top-level `fieldFilters`. */
export type DesignerGridToolbarParamFiltersConfig = {
  enabled: boolean;
  filters: DesignerGridToolbarParamFilter[];
};

export type DesignerGridToolbarFieldFilterControlType = 'checkbox-group' | 'radio-group' | 'select';
export type DesignerGridToolbarFieldFilterOptionsSource = 'static' | 'lov';

export type DesignerGridToolbarFieldFilterOption = {
  value: string;
  label: string;
  labelTranslationKey?: string;
};

/**
 * Generic toolbar field filter (Phase 26 / U9).
 * Replaces hard-coded `roleFilters` + radio-only `paramFilters` with checkbox/radio/select on any field,
 * optional AND/OR match logic (checkbox), and static or LOV options.
 */
export type DesignerGridToolbarFieldFilterConfig = {
  id: string;
  /** Data-source field this filter targets (e.g. `roles`, `status`, `personTypeCode`). */
  field: string;
  label: string;
  labelTranslationKey?: string;
  controlType: DesignerGridToolbarFieldFilterControlType;
  optionsSource: DesignerGridToolbarFieldFilterOptionsSource;
  options?: DesignerGridToolbarFieldFilterOption[];
  lovRef?: string;
  /** Checkbox-group only — design-time default / runtime seed (`and` | `or`). */
  matchLogic?: FilterMatchLogic;
  /** Query param for match logic (Users API uses `roleMatch`). */
  matchLogicApiParam?: string;
  matchLogicStorePath?: string;
  apiParam: string;
  storePath: string;
  /** Optional initial selection for radio/select filters. */
  defaultValue?: string;
  /**
   * Select only — allow picking several options.
   * Store value is a comma-separated list (same shape as checkbox-group serialization);
   * pair with `filter[field][in]` for Data API multi-value queries.
   */
  multiple?: boolean;
  /** Overrides ToolbarFilterSelect host width (e.g. narrower multi-select on dense toolbars). */
  selectHostClassName?: string;
};

export type DesignerGridToolbarCreateConfig = {
  enabled: boolean;
  label?: string;
  icon?: string;
  behavior?: DesignerGridRowActionBehavior;
};

export type DesignerGridToolbarRefreshConfig = {
  enabled: boolean;
};

/**
 * Phase 48 — toolbar Export button.
 * When enabled, exports the current filtered/sorted grid rows (not the raw unfiltered set).
 * Default format is CSV (client-side); the button menu also offers Excel/PDF via the server.
 */
export type DesignerGridToolbarExportConfig = {
  enabled: boolean;
  /** Default format when the primary Export control is clicked (menu still offers all three). */
  defaultFormat?: 'csv' | 'xlsx' | 'pdf';
};

export type DesignerGridServerQueryColumnFilterMapping = {
  columnId: string;
  apiParam: string;
  kind: 'text' | 'boolean' | 'dateFrom' | 'dateTo';
};

export type DesignerGridServerQueryConfig = {
  enabled?: boolean;
  /** Edge model id for query-surface manifest (list where fields + presets). */
  edgeModelId?: string;
  sortByParam?: string;
  sortDirParam?: string;
  sortByStorePath?: string;
  sortDirStorePath?: string;
  pageParam?: string;
  pageSizeParam?: string;
  pageStorePath?: string;
  pageSizeStorePath?: string;
  /** When set, binds `view=static:{value}` on list hydration (Data API `query.views`). */
  listView?: string;
  columnFilters?: DesignerGridServerQueryColumnFilterMapping[];
};

export type DesignerGridToolbarConfig = {
  enabled?: boolean;
  search?: DesignerGridToolbarSearchConfig;
  /** @deprecated Migrated into `fieldFilters` on parse/normalize. */
  roleFilters?: DesignerGridToolbarRoleFiltersConfig;
  /** @deprecated Migrated into `fieldFilters` on parse/normalize. */
  paramFilters?: DesignerGridToolbarParamFiltersConfig;
  /** Generic checkbox/radio/select field filters (Phase 26 + select). */
  fieldFilters?: DesignerGridToolbarFieldFilterConfig[];
  create?: DesignerGridToolbarCreateConfig;
  refresh?: DesignerGridToolbarRefreshConfig;
  /**
   * Phase 48 — show Export on the page toolbar.
   * Prefer `export.enabled`; `showExportButton` is accepted as a boolean alias for older docs/specs.
   */
  export?: DesignerGridToolbarExportConfig;
  /** @deprecated Prefer `export.enabled`. Parsed as alias for `export: { enabled: true }`. */
  showExportButton?: boolean;
  serverQuery?: DesignerGridServerQueryConfig;
  /** Nested where-builder list filter (server `where` JSON). Default true when `serverQuery` is on. */
  listWhereFilter?: boolean;
  listWhereApiParam?: string;
  listWhereStorePath?: string;
  queryPresetsApiParam?: string;
  queryPresetsStorePath?: string;
  /** Query-surface preset chips (Published / Drafts / …). Default on when server query + edge model. */
  queryPresetChips?: boolean;
  /**
   * Bulk actions shown when row selection is non-empty (Phase 35).
   * Requires `selectionMode: 'multiple'` (or single) on the grid node.
   */
  bulkActions?: DesignerGridToolbarBulkAction[];
  /** Store path holding the selected primary-key array (default `gridSelection.selectedKeys`). */
  selectionStorePath?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const parseBoolean = (value: unknown, fallback = false): boolean =>
  value === true || value === false ? value : fallback;

const parseSearchConfig = (value: unknown): DesignerGridToolbarSearchConfig | undefined => {
  if (!isRecord(value) || value.enabled !== true) {
    return undefined;
  }

  return {
    enabled: true,
    ...(readTrimmedString(value.placeholder) ? { placeholder: readTrimmedString(value.placeholder) } : {}),
    ...(readTrimmedString(value.storePath) ? { storePath: readTrimmedString(value.storePath) } : {}),
    ...(readTrimmedString(value.apiParam) ? { apiParam: readTrimmedString(value.apiParam) } : {}),
    ...(typeof value.debounceMs === 'number' && value.debounceMs >= 0 ? { debounceMs: value.debounceMs } : {}),
  };
};

const parseRoleFiltersConfig = (value: unknown): DesignerGridToolbarRoleFiltersConfig | undefined => {
  if (!isRecord(value) || value.enabled !== true) {
    return undefined;
  }

  const roles = Array.isArray(value.roles)
    ? value.roles.map((entry) => String(entry).trim()).filter((entry) => entry.length > 0)
    : undefined;

  return {
    enabled: true,
    ...(roles && roles.length > 0 ? { roles } : {}),
    ...(readTrimmedString(value.storePath) ? { storePath: readTrimmedString(value.storePath) } : {}),
    ...(readTrimmedString(value.apiParam) ? { apiParam: readTrimmedString(value.apiParam) } : {}),
  };
};

const parseFieldFilterOption = (value: unknown): DesignerGridToolbarFieldFilterOption | null => {
  if (!isRecord(value)) {
    return null;
  }
  const optionValue = readTrimmedString(value.value);
  const optionLabel = readTrimmedString(value.label);
  if (!optionValue || !optionLabel) {
    return null;
  }
  const optionLabelTranslationKey = readTrimmedString(value.labelTranslationKey);
  return {
    value: optionValue,
    label: optionLabel,
    ...(optionLabelTranslationKey ? { labelTranslationKey: optionLabelTranslationKey } : {}),
  };
};

export const resolveFieldFilterOptionDisplayLabel = (
  option: DesignerGridToolbarFieldFilterOption,
  translate?: (key: string, options?: { missing?: 'silent' }) => string,
): string => {
  const key = option.labelTranslationKey?.trim();
  if (key && translate) {
    const translated = translate(key, { missing: 'silent' });
    if (translated && translated !== key) {
      return translated;
    }
  }
  return option.label;
};

const parseFieldFilterOptions = (value: unknown): DesignerGridToolbarFieldFilterOption[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => parseFieldFilterOption(entry))
    .filter((entry): entry is DesignerGridToolbarFieldFilterOption => entry !== null);
};

const parseFieldFilterControlType = (value: unknown): DesignerGridToolbarFieldFilterControlType | undefined => {
  if (value === 'checkbox-group' || value === 'radio-group' || value === 'select') {
    return value;
  }
  return undefined;
};

const parseFieldFilterOptionsSource = (value: unknown): DesignerGridToolbarFieldFilterOptionsSource => {
  if (value === 'lov') {
    return 'lov';
  }
  return 'static';
};

export const defaultMatchLogicApiParamForFieldFilter = (
  filter: Pick<DesignerGridToolbarFieldFilterConfig, 'field' | 'apiParam'>,
): string => {
  if (filter.field === 'roles' || filter.apiParam === 'roleNames') {
    return 'roleMatch';
  }
  return `${filter.apiParam}Match`;
};

export const defaultMatchLogicStorePathForFieldFilter = (
  filter: Pick<DesignerGridToolbarFieldFilterConfig, 'field' | 'storePath'>,
): string => {
  if (filter.field === 'roles' || filter.storePath === 'gridToolbar.roleNames') {
    return 'gridToolbar.roleMatch';
  }
  return `${filter.storePath}Match`;
};

/** Checkbox groups and multi-select toolbar filters may expose AND/OR match logic. */
export const fieldFilterSupportsMatchLogic = (
  filter: Pick<DesignerGridToolbarFieldFilterConfig, 'controlType' | 'multiple' | 'matchLogicApiParam'>,
): boolean => (
  filter.controlType === 'checkbox-group'
  || (filter.controlType === 'select' && filter.multiple === true && Boolean(filter.matchLogicApiParam))
);

export const parseFieldFilterConfig = (value: unknown): DesignerGridToolbarFieldFilterConfig | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = readTrimmedString(value.id);
  const field = readTrimmedString(value.field);
  const label = readTrimmedString(value.label);
  const apiParam = readTrimmedString(value.apiParam);
  const storePath = readTrimmedString(value.storePath);
  const controlType = parseFieldFilterControlType(value.controlType);
  if (!id || !field || !label || !apiParam || !storePath || !controlType) {
    return null;
  }

  const optionsSource = parseFieldFilterOptionsSource(value.optionsSource);
  const options = parseFieldFilterOptions(value.options);
  const lovRef = readTrimmedString(value.lovRef);

  if (optionsSource === 'static' && options.length === 0) {
    return null;
  }
  if (optionsSource === 'lov' && !lovRef && options.length === 0) {
    return null;
  }

  const multiple = controlType === 'select' && value.multiple === true;
  const selectMatchLogicConfigured = multiple && (
    readTrimmedString(value.matchLogicApiParam) != null
    || readTrimmedString(value.matchLogicStorePath) != null
  );
  const supportsMatchLogic = controlType === 'checkbox-group' || selectMatchLogicConfigured;
  const matchLogic = supportsMatchLogic
    ? parseFilterMatchLogic(value.matchLogic ?? DEFAULT_FILTER_MATCH_LOGIC)
    : undefined;
  const matchLogicApiParam = supportsMatchLogic
    ? (readTrimmedString(value.matchLogicApiParam) ?? defaultMatchLogicApiParamForFieldFilter({ field, apiParam }))
    : undefined;
  const matchLogicStorePath = supportsMatchLogic
    ? (readTrimmedString(value.matchLogicStorePath) ?? defaultMatchLogicStorePathForFieldFilter({ field, storePath }))
    : undefined;
  const defaultValue = (
    controlType === 'radio-group' || controlType === 'select'
  )
    ? readTrimmedString(value.defaultValue)
    : undefined;
  const labelTranslationKey = readTrimmedString(value.labelTranslationKey);
  const selectHostClassName = readTrimmedString(value.selectHostClassName);

  return {
    id,
    field,
    label,
    controlType,
    optionsSource,
    ...(labelTranslationKey ? { labelTranslationKey } : {}),
    ...(options.length > 0 ? { options } : {}),
    ...(lovRef ? { lovRef } : {}),
    ...(matchLogic ? { matchLogic } : {}),
    ...(matchLogicApiParam ? { matchLogicApiParam } : {}),
    ...(matchLogicStorePath ? { matchLogicStorePath } : {}),
    ...(defaultValue && options.some((option) => option.value === defaultValue)
      ? { defaultValue }
      : {}),
    ...(multiple ? { multiple: true } : {}),
    ...(selectHostClassName ? { selectHostClassName } : {}),
    apiParam,
    storePath,
  };
};

const parseFieldFiltersConfig = (value: unknown): DesignerGridToolbarFieldFilterConfig[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const filters = value
    .map((entry) => parseFieldFilterConfig(entry))
    .filter((entry): entry is DesignerGridToolbarFieldFilterConfig => entry !== null);
  return filters.length > 0 ? filters : undefined;
};

const parseParamFilter = (value: unknown): DesignerGridToolbarParamFilter | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = readTrimmedString(value.id);
  const label = readTrimmedString(value.label);
  const storePath = readTrimmedString(value.storePath);
  const apiParam = readTrimmedString(value.apiParam);
  if (!id || !label || !storePath || !apiParam) {
    return null;
  }

  const options = parseFieldFilterOptions(value.options);
  if (options.length === 0) {
    return null;
  }

  const defaultValue = readTrimmedString(value.defaultValue);
  return {
    id,
    label,
    options,
    storePath,
    apiParam,
    ...(defaultValue && options.some((option) => option.value === defaultValue)
      ? { defaultValue }
      : {}),
  };
};

const parseParamFiltersConfig = (value: unknown): DesignerGridToolbarParamFiltersConfig | undefined => {
  if (!isRecord(value) || value.enabled !== true) {
    return undefined;
  }

  const filters = Array.isArray(value.filters)
    ? value.filters
      .map((entry) => parseParamFilter(entry))
      .filter((entry): entry is DesignerGridToolbarParamFilter => entry !== null)
    : [];

  if (filters.length === 0) {
    return undefined;
  }

  return { enabled: true, filters };
};

/** Migrate legacy `roleFilters` into a generic field filter (`field: 'roles'`). */
export const migrateRoleFiltersToFieldFilter = (
  roleFilters: DesignerGridToolbarRoleFiltersConfig,
): DesignerGridToolbarFieldFilterConfig => {
  const apiParam = roleFilters.apiParam?.trim() || 'roleNames';
  const storePath = roleFilters.storePath?.trim() || 'gridToolbar.roleNames';
  const roles = roleFilters.roles ?? [];
  return {
    id: 'roles',
    field: 'roles',
    label: 'Roles',
    controlType: 'checkbox-group',
    optionsSource: 'static',
    options: roles.map((role) => ({ value: role, label: role })),
    matchLogic: DEFAULT_FILTER_MATCH_LOGIC,
    matchLogicApiParam: 'roleMatch',
    matchLogicStorePath: 'gridToolbar.roleMatch',
    apiParam,
    storePath,
  };
};

/** Extract Edge/Data API field name from `filter[field][op]` api params when present. */
export const resolveFieldNameFromFilterApiParam = (apiParam: string, fallbackId: string): string => {
  const match = /^filter\[([^\]]+)\]\[([^\]]+)\]$/.exec(apiParam.trim());
  if (match?.[1]) {
    return match[1];
  }
  return fallbackId.trim() || apiParam.trim();
};

/** Migrate legacy radio `paramFilters` entry into a generic field filter. */
export const migrateParamFilterToFieldFilter = (
  filter: DesignerGridToolbarParamFilter,
): DesignerGridToolbarFieldFilterConfig => ({
  id: filter.id,
  field: resolveFieldNameFromFilterApiParam(filter.apiParam, filter.id),
  label: filter.label,
  controlType: 'radio-group',
  optionsSource: 'static',
  options: filter.options,
  apiParam: filter.apiParam,
  storePath: filter.storePath,
  ...(filter.defaultValue ? { defaultValue: filter.defaultValue } : {}),
});

/**
 * Canonical field-filter list: prefers `fieldFilters`, otherwise migrates legacy
 * `roleFilters` / `paramFilters` so older documents keep working without data loss.
 */
export const resolveEffectiveFieldFilters = (
  config: DesignerGridToolbarConfig | undefined,
): DesignerGridToolbarFieldFilterConfig[] => {
  if (!config) {
    return [];
  }
  if (config.fieldFilters && config.fieldFilters.length > 0) {
    return config.fieldFilters;
  }

  const migrated: DesignerGridToolbarFieldFilterConfig[] = [];
  if (config.roleFilters?.enabled === true) {
    migrated.push(migrateRoleFiltersToFieldFilter(config.roleFilters));
  }
  if (config.paramFilters?.enabled === true) {
    for (const filter of config.paramFilters.filters) {
      migrated.push(migrateParamFilterToFieldFilter(filter));
    }
  }
  return migrated;
};

export const resolveFieldFilterStaticOptions = (
  filter: DesignerGridToolbarFieldFilterConfig,
): DesignerGridToolbarFieldFilterOption[] => filter.options ?? [];

/** Mirror a roles checkbox field-filter back to legacy `roleFilters` for older consumers. */
export const mirrorFieldFiltersToLegacyRoleFilters = (
  fieldFilters: readonly DesignerGridToolbarFieldFilterConfig[],
): DesignerGridToolbarRoleFiltersConfig | undefined => {
  const rolesFilter = fieldFilters.find((filter) => (
    filter.controlType === 'checkbox-group'
    && (filter.field === 'roles' || filter.id === 'roles' || filter.apiParam === 'roleNames')
  ));
  if (!rolesFilter) {
    return undefined;
  }
  return {
    enabled: true,
    roles: resolveFieldFilterStaticOptions(rolesFilter).map((option) => option.value),
    storePath: rolesFilter.storePath,
    apiParam: rolesFilter.apiParam,
  };
};

/** True for single-value toolbar filters (radio chips or single-select). */
export const isSingleValueFieldFilter = (
  filter: Pick<DesignerGridToolbarFieldFilterConfig, 'controlType' | 'multiple'>,
): boolean => (
  filter.controlType === 'radio-group'
  || (filter.controlType === 'select' && filter.multiple !== true)
);

/** Mirror single-value field-filters back to legacy `paramFilters`. */
export const mirrorFieldFiltersToLegacyParamFilters = (
  fieldFilters: readonly DesignerGridToolbarFieldFilterConfig[],
): DesignerGridToolbarParamFiltersConfig | undefined => {
  const singleValue = fieldFilters.filter((filter) => isSingleValueFieldFilter(filter));
  if (singleValue.length === 0) {
    return undefined;
  }
  return {
    enabled: true,
    filters: singleValue.map((filter) => ({
      id: filter.id,
      label: filter.label,
      options: resolveFieldFilterStaticOptions(filter),
      storePath: filter.storePath,
      apiParam: filter.apiParam,
      ...(filter.defaultValue ? { defaultValue: filter.defaultValue } : {}),
    })),
  };
};

const parseCreateConfig = (value: unknown): DesignerGridToolbarCreateConfig | undefined => {
  if (!isRecord(value) || value.enabled !== true) {
    return undefined;
  }

  const behavior = parseDesignerGridRowActionBehavior(value.behavior);
  const icon = readTrimmedString(value.icon);

  return {
    enabled: true,
    ...(readTrimmedString(value.label) ? { label: readTrimmedString(value.label) } : {}),
    ...(icon ? { icon } : {}),
    ...(behavior ? { behavior } : {}),
  };
};

const parseRefreshConfig = (value: unknown): DesignerGridToolbarRefreshConfig | undefined => {
  if (!isRecord(value) || typeof value.enabled !== 'boolean') {
    return undefined;
  }

  return { enabled: value.enabled };
};

const parseExportFormat = (value: unknown): 'csv' | 'xlsx' | 'pdf' | undefined => {
  if (value === 'csv' || value === 'xlsx' || value === 'pdf') {
    return value;
  }
  return undefined;
};

const parseExportConfig = (
  value: unknown,
  showExportButtonAlias?: unknown,
): DesignerGridToolbarExportConfig | undefined => {
  if (isRecord(value) && value.enabled === true) {
    const defaultFormat = parseExportFormat(value.defaultFormat);
    return {
      enabled: true,
      ...(defaultFormat ? { defaultFormat } : {}),
    };
  }
  if (showExportButtonAlias === true) {
    return { enabled: true, defaultFormat: 'csv' };
  }
  return undefined;
};

const parseColumnFilterMapping = (value: unknown): DesignerGridServerQueryColumnFilterMapping | null => {
  if (!isRecord(value)) {
    return null;
  }

  const columnId = readTrimmedString(value.columnId);
  const apiParam = readTrimmedString(value.apiParam);
  const kind = value.kind;
  if (!columnId || !apiParam) {
    return null;
  }
  if (kind !== 'text' && kind !== 'boolean' && kind !== 'dateFrom' && kind !== 'dateTo') {
    return null;
  }

  return { columnId, apiParam, kind };
};

const parseServerQueryConfig = (value: unknown): DesignerGridServerQueryConfig | undefined => {
  if (!isRecord(value) || value.enabled !== true) {
    return undefined;
  }

  const columnFilters = Array.isArray(value.columnFilters)
    ? value.columnFilters
      .map((entry) => parseColumnFilterMapping(entry))
      .filter((entry): entry is DesignerGridServerQueryColumnFilterMapping => entry !== null)
    : undefined;

  return {
    enabled: true,
    ...(readTrimmedString(value.sortByParam) ? { sortByParam: readTrimmedString(value.sortByParam) } : {}),
    ...(readTrimmedString(value.sortDirParam) ? { sortDirParam: readTrimmedString(value.sortDirParam) } : {}),
    ...(readTrimmedString(value.sortByStorePath) ? { sortByStorePath: readTrimmedString(value.sortByStorePath) } : {}),
    ...(readTrimmedString(value.sortDirStorePath) ? { sortDirStorePath: readTrimmedString(value.sortDirStorePath) } : {}),
    ...(readTrimmedString(value.pageParam) ? { pageParam: readTrimmedString(value.pageParam) } : {}),
    ...(readTrimmedString(value.pageSizeParam) ? { pageSizeParam: readTrimmedString(value.pageSizeParam) } : {}),
    ...(readTrimmedString(value.pageStorePath) ? { pageStorePath: readTrimmedString(value.pageStorePath) } : {}),
    ...(readTrimmedString(value.pageSizeStorePath) ? { pageSizeStorePath: readTrimmedString(value.pageSizeStorePath) } : {}),
    ...(readTrimmedString(value.edgeModelId) ? { edgeModelId: readTrimmedString(value.edgeModelId) } : {}),
    ...(columnFilters && columnFilters.length > 0 ? { columnFilters } : {}),
  };
};

export const parseDesignerGridToolbarConfig = (value: unknown): DesignerGridToolbarConfig | undefined => {
  if (typeof value === 'string') {
    if (value.trim().length === 0) {
      return undefined;
    }
    try {
      return parseDesignerGridToolbarConfig(JSON.parse(value) as unknown);
    } catch {
      return undefined;
    }
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const search = parseSearchConfig(value.search);
  const roleFilters = parseRoleFiltersConfig(value.roleFilters);
  const paramFilters = parseParamFiltersConfig(value.paramFilters);
  const parsedFieldFilters = parseFieldFiltersConfig(value.fieldFilters);
  const create = parseCreateConfig(value.create);
  const refresh = parseRefreshConfig(value.refresh);
  const exportConfig = parseExportConfig(value.export, value.showExportButton);
  const serverQuery = parseServerQueryConfig(value.serverQuery);
  const bulkActions = parseDesignerGridToolbarBulkActions(value.bulkActions);
  const selectionStorePath = readTrimmedString(value.selectionStorePath);

  // Prefer explicit fieldFilters; otherwise migrate legacy roleFilters/paramFilters so older
  // documents (and USERS_GRID_TOOLBAR_PRESET) load without losing settings.
  const fieldFilters = parsedFieldFilters
    ?? (() => {
      const migrated: DesignerGridToolbarFieldFilterConfig[] = [];
      if (roleFilters) {
        migrated.push(migrateRoleFiltersToFieldFilter(roleFilters));
      }
      if (paramFilters) {
        for (const filter of paramFilters.filters) {
          migrated.push(migrateParamFilterToFieldFilter(filter));
        }
      }
      return migrated.length > 0 ? migrated : undefined;
    })();

  const enabled = parseBoolean(
    value.enabled,
    Boolean(
      search
      || roleFilters
      || paramFilters
      || fieldFilters
      || create
      || refresh?.enabled
      || exportConfig
      || serverQuery
      || bulkActions.length > 0,
    ),
  );

  if (!enabled) {
    return undefined;
  }

  const listWhereFilter = value.listWhereFilter === false ? false : undefined;
  const queryPresetChips = value.queryPresetChips === false ? false : undefined;

  return {
    enabled: true,
    ...(search ? { search } : {}),
    ...(roleFilters ? { roleFilters } : {}),
    ...(paramFilters ? { paramFilters } : {}),
    ...(fieldFilters ? { fieldFilters } : {}),
    ...(create ? { create } : {}),
    ...(refresh ? { refresh } : {}),
    ...(exportConfig ? { export: exportConfig, showExportButton: true } : {}),
    ...(serverQuery ? { serverQuery } : {}),
    ...(bulkActions.length > 0 ? { bulkActions } : {}),
    ...(selectionStorePath ? { selectionStorePath } : {}),
    ...(listWhereFilter === false ? { listWhereFilter: false } : {}),
    ...(queryPresetChips === false ? { queryPresetChips: false } : {}),
  };
};

const normalizeFieldFilter = (
  filter: DesignerGridToolbarFieldFilterConfig,
): DesignerGridToolbarFieldFilterConfig => {
  const apiParam = filter.apiParam.trim() || 'filter';
  const storePath = filter.storePath.trim() || `gridToolbar.${filter.id}`;
  const options = resolveFieldFilterStaticOptions(filter);
  const controlType = filter.controlType;
  const optionsSource = filter.optionsSource === 'lov' ? 'lov' : 'static';

  return {
    id: filter.id.trim(),
    field: filter.field.trim(),
    label: filter.label.trim() || filter.field.trim(),
    ...(filter.labelTranslationKey?.trim() ? { labelTranslationKey: filter.labelTranslationKey.trim() } : {}),
    controlType,
    optionsSource,
    ...(options.length > 0 ? { options } : {}),
    ...(filter.lovRef?.trim() ? { lovRef: filter.lovRef.trim() } : {}),
    ...(fieldFilterSupportsMatchLogic(filter)
      ? {
        matchLogic: parseFilterMatchLogic(filter.matchLogic ?? DEFAULT_FILTER_MATCH_LOGIC),
        matchLogicApiParam: filter.matchLogicApiParam?.trim()
          || defaultMatchLogicApiParamForFieldFilter({ field: filter.field, apiParam }),
        matchLogicStorePath: filter.matchLogicStorePath?.trim()
          || defaultMatchLogicStorePathForFieldFilter({ field: filter.field, storePath }),
      }
      : {}),
    ...(filter.defaultValue
      && (controlType === 'radio-group' || controlType === 'select')
      && options.some((option) => option.value === filter.defaultValue)
      ? { defaultValue: filter.defaultValue }
      : {}),
    ...(controlType === 'select' && filter.multiple === true ? { multiple: true } : {}),
    ...(filter.selectHostClassName?.trim() ? { selectHostClassName: filter.selectHostClassName.trim() } : {}),
    apiParam,
    storePath,
  };
};

export const normalizeDesignerGridToolbarConfig = (
  config: DesignerGridToolbarConfig,
): DesignerGridToolbarConfig => {
  if (config.enabled !== true) {
    return { enabled: false };
  }

  const normalized: DesignerGridToolbarConfig = { enabled: true };

  if (config.search?.enabled === true) {
    normalized.search = {
      enabled: true,
      placeholder: config.search.placeholder ?? DEFAULT_GRID_TOOLBAR_SEARCH.placeholder,
      storePath: config.search.storePath ?? DEFAULT_GRID_TOOLBAR_SEARCH.storePath,
      apiParam: config.search.apiParam ?? DEFAULT_GRID_TOOLBAR_SEARCH.apiParam,
      debounceMs: config.search.debounceMs ?? DEFAULT_GRID_TOOLBAR_SEARCH.debounceMs,
    };
  }

  const effectiveFieldFilters = resolveEffectiveFieldFilters(config)
    .map((filter) => normalizeFieldFilter(filter))
    .filter((filter) => {
      if (filter.optionsSource === 'lov') {
        return Boolean(filter.lovRef?.trim()) || (filter.options?.length ?? 0) > 0;
      }
      return (filter.options?.length ?? 0) > 0;
    });

  if (effectiveFieldFilters.length > 0) {
    normalized.fieldFilters = effectiveFieldFilters;
    // Keep legacy mirrors so Auto Table/CRUD + older runtime paths that still read
    // roleFilters/paramFilters continue to compile and behave the same.
    const legacyRoles = mirrorFieldFiltersToLegacyRoleFilters(effectiveFieldFilters);
    if (legacyRoles) {
      normalized.roleFilters = legacyRoles;
    }
    const legacyParams = mirrorFieldFiltersToLegacyParamFilters(effectiveFieldFilters);
    if (legacyParams) {
      normalized.paramFilters = legacyParams;
    }
  } else if (config.roleFilters?.enabled === true) {
    // Empty roles list is still a valid "enabled but waiting for options" state.
    normalized.roleFilters = {
      enabled: true,
      roles: config.roleFilters.roles ?? [],
      storePath: config.roleFilters.storePath ?? DEFAULT_GRID_TOOLBAR_ROLE_FILTERS.storePath,
      apiParam: config.roleFilters.apiParam ?? DEFAULT_GRID_TOOLBAR_ROLE_FILTERS.apiParam,
    };
  }

  if (config.create?.enabled === true) {
    normalized.create = {
      enabled: true,
      label: config.create.label ?? DEFAULT_GRID_TOOLBAR_CREATE.label,
      icon: config.create.icon ?? DEFAULT_GRID_TOOLBAR_CREATE.icon,
      ...(config.create.behavior ? { behavior: config.create.behavior } : {}),
    };
  }

  if (typeof config.refresh?.enabled === 'boolean') {
    normalized.refresh = { enabled: config.refresh.enabled };
  }

  if (config.export?.enabled === true || config.showExportButton === true) {
    const defaultFormat = config.export?.defaultFormat === 'xlsx' || config.export?.defaultFormat === 'pdf'
      ? config.export.defaultFormat
      : 'csv';
    normalized.export = { enabled: true, defaultFormat };
    normalized.showExportButton = true;
  }

  if (config.serverQuery?.enabled === true) {
    normalized.serverQuery = {
      ...DEFAULT_GRID_SERVER_QUERY_CONFIG,
      ...config.serverQuery,
      enabled: true,
      columnFilters: config.serverQuery.columnFilters ?? [],
    };
  }

  if (config.listWhereFilter === false) {
    normalized.listWhereFilter = false;
  }
  if (config.queryPresetChips === false) {
    normalized.queryPresetChips = false;
  }

  if (config.bulkActions && config.bulkActions.length > 0) {
    normalized.bulkActions = config.bulkActions;
  }
  if (config.selectionStorePath?.trim()) {
    normalized.selectionStorePath = config.selectionStorePath.trim();
  }

  return normalized;
};

export const serializeDesignerGridToolbarConfig = (config: DesignerGridToolbarConfig): string =>
  JSON.stringify(normalizeDesignerGridToolbarConfig(config));

export const DEFAULT_GRID_TOOLBAR_SEARCH: DesignerGridToolbarSearchConfig = {
  enabled: true,
  placeholder: '…',
  storePath: 'gridToolbar.search',
  apiParam: 'search',
  debounceMs: 300,
};

/** Hawiety member-directory lists always expose toolbar quick search (`?search=`). */
export const resolveDesignerGridToolbarConfigForHwyMemberDirectoryList = (
  config: DesignerGridToolbarConfig | undefined,
  isMemberDirectoryList: boolean,
): DesignerGridToolbarConfig | undefined => {
  if (!config?.enabled || !isMemberDirectoryList || config.search?.enabled === true) {
    return config;
  }
  return {
    ...config,
    search: {
      enabled: true,
      placeholder: config.search?.placeholder?.trim() || 'Search members…',
      storePath: config.search?.storePath ?? DEFAULT_GRID_TOOLBAR_SEARCH.storePath,
      apiParam: config.search?.apiParam ?? DEFAULT_GRID_TOOLBAR_SEARCH.apiParam,
      debounceMs: config.search?.debounceMs ?? DEFAULT_GRID_TOOLBAR_SEARCH.debounceMs,
    },
  };
};

/** Generic checkbox-filter defaults — leave `roles` empty so each grid defines its own options. */
export const DEFAULT_GRID_TOOLBAR_ROLE_FILTERS: DesignerGridToolbarRoleFiltersConfig = {
  enabled: true,
  roles: [],
  storePath: 'gridToolbar.roleNames',
  apiParam: 'roleNames',
};

export const DEFAULT_GRID_TOOLBAR_CREATE: DesignerGridToolbarCreateConfig = {
  enabled: true,
  label: 'Add',
  icon: 'Plus',
};

export const DEFAULT_GRID_TOOLBAR_REFRESH: DesignerGridToolbarRefreshConfig = {
  enabled: true,
};

export const DEFAULT_GRID_TOOLBAR_EXPORT: DesignerGridToolbarExportConfig = {
  enabled: true,
  defaultFormat: 'csv',
};

export const DEFAULT_GRID_SERVER_QUERY_CONFIG: DesignerGridServerQueryConfig = {
  enabled: true,
  sortByParam: 'sortBy',
  sortDirParam: 'sortDir',
  sortByStorePath: 'gridQuery.sortBy',
  sortDirStorePath: 'gridQuery.sortDir',
  pageParam: 'page',
  pageSizeParam: 'pageSize',
  pageStorePath: 'gridQuery.page',
  pageSizeStorePath: 'gridQuery.pageSize',
  columnFilters: [],
};

export const DEFAULT_GRID_TOOLBAR_PRESET: DesignerGridToolbarConfig = {
  enabled: true,
  search: DEFAULT_GRID_TOOLBAR_SEARCH,
  create: DEFAULT_GRID_TOOLBAR_CREATE,
  refresh: DEFAULT_GRID_TOOLBAR_REFRESH,
};

export const buildServerQueryColumnFiltersFromGridColumns = (
  columns: readonly DesignerDataGridColumn[],
): DesignerGridServerQueryColumnFilterMapping[] => {
  const mappings: DesignerGridServerQueryColumnFilterMapping[] = [];

  for (const column of columns) {
    if (!column.filter || isActionGridColumn(column) || isActionGroupColumn(column)) {
      continue;
    }

    if (column.filterType === 'dateRange') {
      mappings.push(
        { columnId: column.key, apiParam: `filter[${column.key}][gte]`, kind: 'dateFrom' },
        { columnId: column.key, apiParam: `filter[${column.key}][lte]`, kind: 'dateTo' },
      );
      continue;
    }

    mappings.push({
      columnId: column.key,
      apiParam: column.filterType === 'boolean'
        ? `filter[${column.key}][eq]`
        : `filter[${column.key}][like]`,
      kind: column.filterType === 'boolean' ? 'boolean' : 'text',
    });
  }

  return mappings;
};

const designerGridColumnWhereType = (
  column: DesignerDataGridColumn,
): WhereField['type'] => {
  if (column.cellKind === 'date' || column.filterType === 'dateRange') {
    return 'date';
  }
  if (
    column.filterType === 'boolean'
    || column.cellKind === 'boolean-icon'
    || column.cellKind === 'lock-status'
  ) {
    return 'boolean';
  }
  return 'text';
};

/** List-filter field list for designer grids — one entry per non-action column (`key`, not legacy `field`). */
export const designerGridColumnsToListWhereFields = (
  columns: readonly DesignerDataGridColumn[],
  resolveColumnLabel?: (column: DesignerDataGridColumn) => string,
): WhereField[] => columns
  .filter((column) => !isActionGridColumn(column) && !isActionGroupColumn(column))
  .map((column) => ({
    id: column.key,
    label: resolveColumnLabel?.(column) ?? column.label?.trim() ?? column.key,
    type: designerGridColumnWhereType(column),
  }));

/** Overlay grid column labels onto query-surface manifest fields (same `id`). */
export const mergeManifestListWhereFieldsWithColumnLabels = (
  manifestFields: readonly WhereField[],
  columnFields: readonly WhereField[],
): WhereField[] => {
  if (manifestFields.length === 0) {
    return [...columnFields];
  }
  const columnLabelById = new Map(
    columnFields
      .filter((field) => field.label.trim() && field.label !== field.id)
      .map((field) => [field.id, field.label] as const),
  );
  return manifestFields.map((field) => {
    const columnLabel = columnLabelById.get(field.id);
    if (!columnLabel) {
      return field;
    }
    return { ...field, label: columnLabel };
  });
};

export const storePatchValuesEqual = (currentValue: unknown, nextValue: unknown): boolean => {
  if (Object.is(currentValue, nextValue)) {
    return true;
  }

  const isEmpty = (value: unknown) => value === undefined || value === null || value === '';
  if (isEmpty(currentValue) && isEmpty(nextValue)) {
    return true;
  }

  if (typeof currentValue === 'number' && typeof nextValue === 'string') {
    return String(currentValue) === nextValue.trim();
  }
  if (typeof nextValue === 'number' && typeof currentValue === 'string') {
    return String(nextValue) === currentValue.trim();
  }

  if (typeof currentValue === 'boolean' && typeof nextValue === 'string') {
    const normalized = nextValue.trim().toLowerCase();
    return (normalized === 'true' && currentValue) || (normalized === 'false' && !currentValue);
  }
  if (typeof nextValue === 'boolean' && typeof currentValue === 'string') {
    const normalized = currentValue.trim().toLowerCase();
    return (normalized === 'true' && nextValue) || (normalized === 'false' && !nextValue);
  }

  return false;
};

export const filterChangedStorePatches = (
  patches: Record<string, unknown>,
  store: Record<string, unknown>,
): Record<string, unknown> => {
  const changed: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(patches)) {
    const currentValue = readNestedContextValue(store, path);
    if (!storePatchValuesEqual(currentValue, value)) {
      changed[path] = value;
    }
  }
  return changed;
};

/** @deprecated Example preset for the Users grid sample — not the generic default. */
export const USERS_GRID_SERVER_QUERY_CONFIG: DesignerGridServerQueryConfig = {
  enabled: true,
  sortByParam: 'sortBy',
  sortDirParam: 'sortDir',
  sortByStorePath: 'gridQuery.sortBy',
  sortDirStorePath: 'gridQuery.sortDir',
  pageParam: 'page',
  pageSizeParam: 'pageSize',
  pageStorePath: 'gridQuery.page',
  pageSizeStorePath: 'gridQuery.pageSize',
  columnFilters: [
    { columnId: 'email', apiParam: 'email', kind: 'text' },
    { columnId: 'full_name', apiParam: 'full_name', kind: 'text' },
    { columnId: 'roles', apiParam: 'roles', kind: 'text' },
    { columnId: 'locked', apiParam: 'locked', kind: 'boolean' },
    { columnId: 'created_at', apiParam: 'createdFrom', kind: 'dateFrom' },
    { columnId: 'created_at', apiParam: 'createdTo', kind: 'dateTo' },
    { columnId: 'updated_at', apiParam: 'updatedFrom', kind: 'dateFrom' },
    { columnId: 'updated_at', apiParam: 'updatedTo', kind: 'dateTo' },
  ],
};

/** @deprecated Example only — Users is one sample grid, not the generic toolbar model. */
export const USERS_GRID_TOOLBAR_PRESET: DesignerGridToolbarConfig = {
  enabled: true,
  search: {
    ...DEFAULT_GRID_TOOLBAR_SEARCH,
    placeholder: 'users…',
  },
  roleFilters: {
    enabled: true,
    roles: ['ADMIN', 'DEVELOPER'],
    storePath: 'gridToolbar.roleNames',
    apiParam: 'roleNames',
  },
  create: {
    ...DEFAULT_GRID_TOOLBAR_CREATE,
    label: 'Add User',
  },
  refresh: DEFAULT_GRID_TOOLBAR_REFRESH,
  serverQuery: USERS_GRID_SERVER_QUERY_CONFIG,
};

export const buildGridListQueryParamBindings = (
  config: DesignerGridToolbarConfig | undefined,
): Record<string, string> => {
  if (!config?.serverQuery?.enabled) {
    return {};
  }

  const bindings: Record<string, string> = {};
  const serverQuery = config.serverQuery;

  const assign = (apiParam: string | undefined, storePath: string | undefined) => {
    if (apiParam && storePath) {
      bindings[apiParam] = storePath;
    }
  };

  if (config.search?.enabled === true) {
    assign(config.search.apiParam ?? 'search', config.search.storePath ?? 'gridToolbar.search');
  }

  const fieldFilters = resolveEffectiveFieldFilters(config);
  for (const filter of fieldFilters) {
    assign(filter.apiParam, filter.storePath);
    if (fieldFilterSupportsMatchLogic(filter)) {
      assign(
        filter.matchLogicApiParam ?? defaultMatchLogicApiParamForFieldFilter(filter),
        filter.matchLogicStorePath ?? defaultMatchLogicStorePathForFieldFilter(filter),
      );
    }
  }

  // Legacy fallback when fieldFilters is empty but roleFilters/paramFilters remain.
  if (fieldFilters.length === 0) {
    if (config.roleFilters?.enabled === true) {
      assign(
        config.roleFilters.apiParam ?? 'roleNames',
        config.roleFilters.storePath ?? 'gridToolbar.roleNames',
      );
    }
    if (config.paramFilters?.enabled === true) {
      for (const filter of config.paramFilters.filters) {
        assign(filter.apiParam, filter.storePath);
      }
    }
  }

  assign(serverQuery.sortByParam ?? 'sortBy', serverQuery.sortByStorePath ?? 'gridQuery.sortBy');
  assign(serverQuery.sortDirParam ?? 'sortDir', serverQuery.sortDirStorePath ?? 'gridQuery.sortDir');
  assign(serverQuery.pageParam ?? 'page', serverQuery.pageStorePath ?? 'gridQuery.page');
  assign(serverQuery.pageSizeParam ?? 'pageSize', serverQuery.pageSizeStorePath ?? 'gridQuery.pageSize');
  bindings.includeCount = LIST_INCLUDE_COUNT_PAGE1_ONLY_BINDING;
  const listView = serverQuery.listView?.trim();
  if (listView) {
    bindings.view = `static:${listView}`;
  }

  if (config.listWhereFilter !== false) {
    assign(config.listWhereApiParam ?? 'where', config.listWhereStorePath ?? 'gridToolbar.listWhere');
  }
  if (
    config.queryPresetChips !== false
    && (config.queryPresetsStorePath || serverQuery.edgeModelId)
  ) {
    assign(
      config.queryPresetsApiParam ?? 'presets',
      config.queryPresetsStorePath ?? 'gridToolbar.queryPresets',
    );
  }

  for (const mapping of serverQuery.columnFilters ?? []) {
    const storePath = mapping.kind === 'dateFrom'
      ? `gridQuery.filters.${mapping.columnId}.from`
      : mapping.kind === 'dateTo'
        ? `gridQuery.filters.${mapping.columnId}.to`
        : `gridQuery.filters.${mapping.columnId}`;
    bindings[mapping.apiParam] = storePath;
  }

  return bindings;
};

export const serializeRoleFilterSelection = (
  roleFilters: Record<string, boolean>,
): string => Object.entries(roleFilters)
  .filter(([, checked]) => checked)
  .map(([role]) => role)
  .join(',');

export const serializeCheckboxFilterSelection = (
  selection: Record<string, boolean>,
): string => serializeRoleFilterSelection(selection);

const readRowFieldValues = (row: Record<string, unknown>, field: string): string[] => {
  const raw = row[field];
  if (Array.isArray(raw)) {
    return raw.map((entry) => String(entry).trim().toUpperCase()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw.split(',').map((entry) => entry.trim().toUpperCase()).filter(Boolean);
  }
  if (raw === null || raw === undefined) {
    return [];
  }
  return [String(raw).trim().toUpperCase()].filter(Boolean);
};

/**
 * Client-side fallback for toolbar search + field filters when "Sync filters to API" is off.
 * Without this, server-mode grids silently ignore toolbar input (parity audit items 73/74).
 * Checkbox filters: OR = any selected value; AND = all selected values (Phase 26 / U9).
 * When no checkbox values are checked, that filter is a no-op.
 */
export const applyDesignerGridToolbarClientFilters = <TRow extends Record<string, unknown>>(
  rows: readonly TRow[],
  options: {
    searchText?: string;
    /** @deprecated Prefer `fieldFilters` + `checkboxSelections`. */
    roleFilters?: Record<string, boolean>;
    rolesField?: string;
    fieldFilters?: readonly DesignerGridToolbarFieldFilterConfig[];
    checkboxSelections?: Record<string, Record<string, boolean>>;
    radioSelections?: Record<string, string>;
    matchLogicByFilterId?: Record<string, FilterMatchLogic>;
  } = {},
): TRow[] => {
  let result = [...rows];
  const search = options.searchText?.trim().toLowerCase();
  if (search) {
    result = result.filter((row) => Object.values(row).some((value) => {
      if (value === null || value === undefined) {
        return false;
      }
      if (Array.isArray(value)) {
        return value.some((entry) => String(entry).toLowerCase().includes(search));
      }
      if (typeof value === 'object') {
        return JSON.stringify(value).toLowerCase().includes(search);
      }
      return String(value).toLowerCase().includes(search);
    }));
  }

  const fieldFilters = options.fieldFilters ?? [];
  if (fieldFilters.length > 0) {
    for (const filter of fieldFilters) {
      if (filter.controlType === 'checkbox-group') {
        const selection = options.checkboxSelections?.[filter.id] ?? {};
        const activeValues = Object.entries(selection)
          .filter(([, checked]) => checked)
          .map(([value]) => value.trim().toUpperCase())
          .filter(Boolean);
        if (activeValues.length === 0) {
          continue;
        }
        const logic = parseFilterMatchLogic(
          options.matchLogicByFilterId?.[filter.id] ?? filter.matchLogic ?? DEFAULT_FILTER_MATCH_LOGIC,
        );
        result = result.filter((row) => {
          const rowValues = readRowFieldValues(row, filter.field);
          return logic === 'and'
            ? activeValues.every((value) => rowValues.includes(value))
            : activeValues.some((value) => rowValues.includes(value));
        });
        continue;
      }

      const selected = options.radioSelections?.[filter.id]?.trim();
      if (!selected) {
        continue;
      }
      const selectedValues = selected
        .split(',')
        .map((entry) => entry.trim().toUpperCase())
        .filter(Boolean);
      if (selectedValues.length === 0) {
        continue;
      }
      result = result.filter((row) => {
        const rowValues = readRowFieldValues(row, filter.field);
        return selectedValues.some((value) => rowValues.includes(value));
      });
    }
    return result;
  }

  // Legacy roleFilters path (pre-Phase-26 callers / tests).
  const activeRoles = Object.entries(options.roleFilters ?? {})
    .filter(([, checked]) => checked)
    .map(([role]) => role.trim().toUpperCase())
    .filter(Boolean);

  if (activeRoles.length > 0) {
    const rolesField = options.rolesField?.trim() || 'roles';
    result = result.filter((row) => {
      const rowRoles = readRowFieldValues(row, rolesField);
      return activeRoles.some((role) => rowRoles.includes(role));
    });
  }

  return result;
};

export const buildServerQueryStorePatches = (
  query: GridQueryState,
  options: {
    page: number;
    pageSize: number;
    searchText?: string;
    roleFilters?: Record<string, boolean>;
    paramFilterValues?: Record<string, string>;
    fieldFilters?: readonly DesignerGridToolbarFieldFilterConfig[];
    checkboxSelections?: Record<string, Record<string, boolean>>;
    radioSelections?: Record<string, string>;
    matchLogicByFilterId?: Record<string, FilterMatchLogic>;
    config: DesignerGridServerQueryConfig;
    searchStorePath?: string;
    roleStorePath?: string;
    paramFilterStorePaths?: Record<string, string>;
    queryPresetIds?: readonly string[];
    queryPresetsStorePath?: string;
  },
): Record<string, unknown> => {
  const patches: Record<string, unknown> = {};
  const assign = (path: string | undefined, value: unknown) => {
    if (!path?.trim()) {
      return;
    }
    patches[path.trim()] = value;
  };

  assign(options.config.sortByStorePath ?? 'gridQuery.sortBy', query.sort?.columnId ?? '');
  assign(options.config.sortDirStorePath ?? 'gridQuery.sortDir', query.sort?.direction ?? '');
  assign(options.config.pageStorePath ?? 'gridQuery.page', options.page);
  assign(options.config.pageSizeStorePath ?? 'gridQuery.pageSize', options.pageSize);
  assign(options.searchStorePath ?? 'gridToolbar.search', options.searchText?.trim() ?? '');

  const fieldFilters = options.fieldFilters ?? [];
  if (fieldFilters.length > 0) {
    for (const filter of fieldFilters) {
      if (filter.controlType === 'checkbox-group') {
        const selection = options.checkboxSelections?.[filter.id] ?? options.roleFilters ?? {};
        assign(filter.storePath, serializeCheckboxFilterSelection(selection));
        assign(
          filter.matchLogicStorePath ?? defaultMatchLogicStorePathForFieldFilter(filter),
          parseFilterMatchLogic(
            options.matchLogicByFilterId?.[filter.id] ?? filter.matchLogic ?? DEFAULT_FILTER_MATCH_LOGIC,
          ),
        );
      } else {
        assign(
          filter.storePath,
          options.radioSelections?.[filter.id]
            ?? options.paramFilterValues?.[filter.id]
            ?? '',
        );
        if (fieldFilterSupportsMatchLogic(filter)) {
          assign(
            filter.matchLogicStorePath ?? defaultMatchLogicStorePathForFieldFilter(filter),
            parseFilterMatchLogic(
              options.matchLogicByFilterId?.[filter.id] ?? filter.matchLogic ?? DEFAULT_FILTER_MATCH_LOGIC,
            ),
          );
        }
      }
    }
  } else {
    assign(
      options.roleStorePath ?? 'gridToolbar.roleNames',
      serializeRoleFilterSelection(options.roleFilters ?? {}),
    );
    for (const [filterId, storePath] of Object.entries(options.paramFilterStorePaths ?? {})) {
      assign(storePath, options.paramFilterValues?.[filterId] ?? '');
    }
  }

  if (
    options.config.queryPresetChips !== false
    && (options.queryPresetsStorePath || options.config.edgeModelId)
  ) {
    const presetIds = options.queryPresetIds ?? [];
    assign(
      options.queryPresetsStorePath ?? 'gridToolbar.queryPresets',
      presetIds.map((id) => id.trim()).filter(Boolean).join(','),
    );
  }

  for (const mapping of options.config.columnFilters ?? []) {
    const filter = query.filters[mapping.columnId];
    if (!filter) {
      assign(
        mapping.kind === 'dateFrom'
          ? `gridQuery.filters.${mapping.columnId}.from`
          : mapping.kind === 'dateTo'
            ? `gridQuery.filters.${mapping.columnId}.to`
            : `gridQuery.filters.${mapping.columnId}`,
        '',
      );
      continue;
    }

    if (mapping.kind === 'text' && filter.type === 'text') {
      assign(`gridQuery.filters.${mapping.columnId}`, filter.value ?? '');
    }
    if (mapping.kind === 'boolean' && filter.type === 'boolean') {
      assign(`gridQuery.filters.${mapping.columnId}`, filter.value ?? '');
    }
    if (mapping.kind === 'dateFrom' && filter.type === 'dateRange') {
      assign(`gridQuery.filters.${mapping.columnId}.from`, filter.from ?? '');
    }
    if (mapping.kind === 'dateTo' && filter.type === 'dateRange') {
      assign(`gridQuery.filters.${mapping.columnId}.to`, filter.to ?? '');
    }
  }

  return patches;
};

export const isDesignerGridToolbarEnabled = (config: DesignerGridToolbarConfig | undefined): boolean =>
  config?.enabled === true;
