import { readNestedContextValue } from './bindingResourceModel';

export type DesignerChartToolbarSearchConfig = {
  enabled: boolean;
  placeholder?: string;
  storePath?: string;
  apiParam?: string;
  debounceMs?: number;
};

export type DesignerChartToolbarSelectFilterConfig = {
  id: string;
  label: string;
  apiParam: string;
  storePath: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
};

export type DesignerChartToolbarDateRangeConfig = {
  enabled: boolean;
  label?: string;
  fromApiParam?: string;
  toApiParam?: string;
  fromStorePath?: string;
  toStorePath?: string;
};

export type DesignerChartToolbarRefreshConfig = {
  enabled: boolean;
};

export type DesignerChartToolbarConfig = {
  enabled?: boolean;
  /** When true, end users can change filters at runtime. */
  runtimeEnabled?: boolean;
  search?: DesignerChartToolbarSearchConfig;
  selectFilters?: DesignerChartToolbarSelectFilterConfig[];
  dateRange?: DesignerChartToolbarDateRangeConfig;
  refresh?: DesignerChartToolbarRefreshConfig;
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

const parseSearchConfig = (value: unknown): DesignerChartToolbarSearchConfig | undefined => {
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

const parseSelectFilters = (value: unknown): DesignerChartToolbarSelectFilterConfig[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const filters = value
    .map((entry): DesignerChartToolbarSelectFilterConfig | null => {
      if (!isRecord(entry)) {
        return null;
      }
      const id = readTrimmedString(entry.id);
      const label = readTrimmedString(entry.label);
      const apiParam = readTrimmedString(entry.apiParam);
      const storePath = readTrimmedString(entry.storePath);
      if (!id || !label || !apiParam || !storePath) {
        return null;
      }
      const options = Array.isArray(entry.options)
        ? entry.options
          .map((option) => {
            if (!isRecord(option)) {
              return null;
            }
            const optionValue = readTrimmedString(option.value);
            const optionLabel = readTrimmedString(option.label);
            if (!optionValue || !optionLabel) {
              return null;
            }
            return { value: optionValue, label: optionLabel };
          })
          .filter((option): option is { value: string; label: string } => option !== null)
        : [];

      return {
        id,
        label,
        apiParam,
        storePath,
        options,
        ...(readTrimmedString(entry.placeholder) ? { placeholder: readTrimmedString(entry.placeholder) } : {}),
      };
    })
    .filter((entry): entry is DesignerChartToolbarSelectFilterConfig => entry !== null);

  return filters.length > 0 ? filters : undefined;
};

const parseDateRangeConfig = (value: unknown): DesignerChartToolbarDateRangeConfig | undefined => {
  if (!isRecord(value) || value.enabled !== true) {
    return undefined;
  }

  return {
    enabled: true,
    ...(readTrimmedString(value.label) ? { label: readTrimmedString(value.label) } : {}),
    ...(readTrimmedString(value.fromApiParam) ? { fromApiParam: readTrimmedString(value.fromApiParam) } : {}),
    ...(readTrimmedString(value.toApiParam) ? { toApiParam: readTrimmedString(value.toApiParam) } : {}),
    ...(readTrimmedString(value.fromStorePath) ? { fromStorePath: readTrimmedString(value.fromStorePath) } : {}),
    ...(readTrimmedString(value.toStorePath) ? { toStorePath: readTrimmedString(value.toStorePath) } : {}),
  };
};

const parseRefreshConfig = (value: unknown): DesignerChartToolbarRefreshConfig | undefined => {
  if (!isRecord(value) || value.enabled !== true) {
    return undefined;
  }
  return { enabled: true };
};

export const parseDesignerChartToolbarConfig = (raw: unknown): DesignerChartToolbarConfig => {
  if (typeof raw === 'string') {
    try {
      return parseDesignerChartToolbarConfig(JSON.parse(raw));
    } catch {
      return { enabled: false };
    }
  }

  if (!isRecord(raw)) {
    return { enabled: false };
  }

  const search = parseSearchConfig(raw.search);
  const selectFilters = parseSelectFilters(raw.selectFilters);
  const dateRange = parseDateRangeConfig(raw.dateRange);
  const refresh = parseRefreshConfig(raw.refresh);
  const hasFilters = Boolean(search || (selectFilters && selectFilters.length > 0) || dateRange || refresh);

  if (raw.enabled !== true && !hasFilters) {
    return { enabled: false };
  }

  return {
    enabled: true,
    runtimeEnabled: raw.runtimeEnabled === false ? false : true,
    ...(search ? { search } : {}),
    ...(selectFilters ? { selectFilters } : {}),
    ...(dateRange ? { dateRange } : {}),
    ...(refresh ? { refresh } : {}),
  };
};

export const resolveChartFilterStorePrefix = (nodeId: string): string => {
  const suffix = nodeId.replace(/[^a-zA-Z0-9_]/g, '_');
  return `chartQuery_${suffix}`;
};

export const buildDefaultChartToolbarConfig = (nodeId: string): DesignerChartToolbarConfig => {
  const prefix = resolveChartFilterStorePrefix(nodeId);
  return {
    enabled: true,
    runtimeEnabled: true,
    search: {
      enabled: true,
      placeholder: 'chart data…',
      storePath: `${prefix}.search`,
      apiParam: 'search',
      debounceMs: 300,
    },
    refresh: { enabled: true },
  };
};

export const normalizeDesignerChartToolbarConfig = (
  config: DesignerChartToolbarConfig,
  nodeId: string,
): DesignerChartToolbarConfig => {
  if (config.enabled !== true) {
    return { enabled: false };
  }

  const prefix = resolveChartFilterStorePrefix(nodeId);
  const hasActiveFilters = Boolean(
    config.search?.enabled
    || (config.selectFilters && config.selectFilters.length > 0)
    || config.dateRange?.enabled
    || config.refresh?.enabled,
  );
  const normalized: DesignerChartToolbarConfig = {
    enabled: true,
    runtimeEnabled: config.runtimeEnabled === false ? false : hasActiveFilters,
  };

  if (config.search?.enabled === true) {
    normalized.search = {
      enabled: true,
      placeholder: config.search.placeholder ?? 'chart data…',
      storePath: config.search.storePath ?? `${prefix}.search`,
      apiParam: config.search.apiParam ?? 'search',
      debounceMs: config.search.debounceMs ?? 300,
    };
  }

  if (config.selectFilters && config.selectFilters.length > 0) {
    normalized.selectFilters = config.selectFilters.map((filter, index) => ({
      id: filter.id || `filter-${index + 1}`,
      label: filter.label,
      apiParam: filter.apiParam,
      storePath: filter.storePath || `${prefix}.${filter.id || `filter-${index + 1}`}`,
      options: filter.options ?? [],
      ...(filter.placeholder ? { placeholder: filter.placeholder } : {}),
    }));
  }

  if (config.dateRange?.enabled === true) {
    normalized.dateRange = {
      enabled: true,
      label: config.dateRange.label ?? 'Date range',
      fromApiParam: config.dateRange.fromApiParam ?? 'from',
      toApiParam: config.dateRange.toApiParam ?? 'to',
      fromStorePath: config.dateRange.fromStorePath ?? `${prefix}.dateFrom`,
      toStorePath: config.dateRange.toStorePath ?? `${prefix}.dateTo`,
    };
  }

  if (config.refresh?.enabled === true) {
    normalized.refresh = { enabled: true };
  }

  return normalized;
};

export const serializeDesignerChartToolbarConfig = (
  config: DesignerChartToolbarConfig,
  nodeId: string,
): string => JSON.stringify(normalizeDesignerChartToolbarConfig(config, nodeId));

export const buildChartListQueryParamBindings = (
  config: DesignerChartToolbarConfig | undefined,
  nodeId: string,
): Record<string, string> => {
  const normalized = normalizeDesignerChartToolbarConfig(config ?? { enabled: false }, nodeId);
  if (normalized.enabled !== true) {
    return {};
  }

  const bindings: Record<string, string> = {};
  const assign = (apiParam: string | undefined, storePath: string | undefined) => {
    if (apiParam && storePath) {
      bindings[apiParam] = storePath;
    }
  };

  if (normalized.search?.enabled === true) {
    assign(normalized.search.apiParam ?? 'search', normalized.search.storePath);
  }

  for (const filter of normalized.selectFilters ?? []) {
    assign(filter.apiParam, filter.storePath);
  }

  if (normalized.dateRange?.enabled === true) {
    assign(normalized.dateRange.fromApiParam ?? 'from', normalized.dateRange.fromStorePath);
    assign(normalized.dateRange.toApiParam ?? 'to', normalized.dateRange.toStorePath);
  }

  return bindings;
};

export const readChartToolbarStoreValue = (
  designerStore: Record<string, unknown>,
  storePath: string,
): unknown => readNestedContextValue(designerStore, storePath);

export const chartToolbarHasRuntimeFilters = (config: DesignerChartToolbarConfig | undefined): boolean => {
  const normalized = config ?? { enabled: false };
  if (normalized.enabled !== true || normalized.runtimeEnabled === false) {
    return false;
  }
  return Boolean(
    normalized.search?.enabled
    || (normalized.selectFilters && normalized.selectFilters.length > 0)
    || normalized.dateRange?.enabled
    || normalized.refresh?.enabled,
  );
};
