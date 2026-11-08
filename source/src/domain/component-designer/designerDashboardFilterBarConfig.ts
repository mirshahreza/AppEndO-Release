// This module is imported by designerVizPalette.ts, which catalog.ts spreads at module-eval time.
// Do not import from bindingResourceModel.ts (or anything else that imports catalog.ts) here —
// it creates a circular import that leaves DESIGNER_VIZ_PALETTE_ITEMS undefined when catalog.ts loads.
// Runtime store-reading logic for this config lives in DesignerRuntimeFilterBar.tsx instead.
export const DASHBOARD_FILTER_BAR_CONFIG_PROP = 'filterBarConfig';

export type DesignerDashboardFilterType = 'text' | 'select' | 'dateRange';

export type DesignerDashboardFilterDefinition = {
  id: string;
  label: string;
  type: DesignerDashboardFilterType;
  /** List query param name (text/select). */
  apiParam?: string;
  /** Dot path within designerStore (text/select). */
  storePath?: string;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  /** Date range — separate store paths and API params. */
  fromApiParam?: string;
  toApiParam?: string;
  fromStorePath?: string;
  toStorePath?: string;
};

export type DesignerDashboardFilterBarConfig = {
  filters: DesignerDashboardFilterDefinition[];
};

const createFilterId = (): string =>
  `filter_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

const sanitizeFilterDefinition = (value: unknown): DesignerDashboardFilterDefinition | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const type = record.type;
  if (type !== 'text' && type !== 'select' && type !== 'dateRange') {
    return null;
  }

  const label = typeof record.label === 'string' && record.label.trim().length > 0
    ? record.label.trim()
    : 'Filter';
  const id = typeof record.id === 'string' && record.id.trim().length > 0
    ? record.id.trim()
    : createFilterId();

  const base: DesignerDashboardFilterDefinition = {
    id,
    label,
    type,
    placeholder: typeof record.placeholder === 'string' ? record.placeholder : undefined,
  };

  if (type === 'dateRange') {
    return {
      ...base,
      fromApiParam: typeof record.fromApiParam === 'string' ? record.fromApiParam.trim() : 'from',
      toApiParam: typeof record.toApiParam === 'string' ? record.toApiParam.trim() : 'to',
      fromStorePath: typeof record.fromStorePath === 'string' ? record.fromStorePath.trim() : `dashboardFilters.${id}.from`,
      toStorePath: typeof record.toStorePath === 'string' ? record.toStorePath.trim() : `dashboardFilters.${id}.to`,
    };
  }

  const storePath = typeof record.storePath === 'string' && record.storePath.trim().length > 0
    ? record.storePath.trim()
    : `dashboardFilters.${id}`;
  const apiParam = typeof record.apiParam === 'string' && record.apiParam.trim().length > 0
    ? record.apiParam.trim()
    : storePath.split('.').pop() ?? id;

  const options = Array.isArray(record.options)
    ? record.options
      .map((entry): { label: string; value: string } | null => {
        if (typeof entry !== 'object' || entry === null) {
          return null;
        }
        const optionRecord = entry as Record<string, unknown>;
        const optionLabel = typeof optionRecord.label === 'string' ? optionRecord.label.trim() : '';
        const optionValue = typeof optionRecord.value === 'string' ? optionRecord.value.trim() : '';
        if (!optionLabel || !optionValue) {
          return null;
        }
        return { label: optionLabel, value: optionValue };
      })
      .filter((entry): entry is { label: string; value: string } => entry !== null)
    : undefined;

  return {
    ...base,
    apiParam,
    storePath,
    ...(type === 'select' && options && options.length > 0 ? { options } : {}),
  };
};

export const normalizeDashboardFilterBarConfig = (
  config: DesignerDashboardFilterBarConfig | undefined,
): DesignerDashboardFilterBarConfig => ({
  filters: (config?.filters ?? []).map((filter) => sanitizeFilterDefinition(filter)).filter(Boolean) as DesignerDashboardFilterDefinition[],
});

export const parseDashboardFilterBarConfig = (raw: unknown): DesignerDashboardFilterBarConfig => {
  if (typeof raw === 'string') {
    try {
      return parseDashboardFilterBarConfig(JSON.parse(raw));
    } catch {
      return { filters: [] };
    }
  }
  if (typeof raw !== 'object' || raw === null) {
    return { filters: [] };
  }
  const record = raw as Record<string, unknown>;
  const filters = Array.isArray(record.filters)
    ? record.filters
      .map((entry) => sanitizeFilterDefinition(entry))
      .filter((entry): entry is DesignerDashboardFilterDefinition => entry !== null)
    : [];
  return { filters };
};

export const serializeDashboardFilterBarConfig = (config: DesignerDashboardFilterBarConfig): string =>
  JSON.stringify(normalizeDashboardFilterBarConfig(config));

export const buildDashboardFilterBarQueryParamBindings = (
  config: DesignerDashboardFilterBarConfig | undefined,
): Record<string, string> => {
  const bindings: Record<string, string> = {};
  const assign = (apiParam: string | undefined, storePath: string | undefined) => {
    if (apiParam && storePath) {
      bindings[apiParam] = storePath;
    }
  };

  for (const filter of normalizeDashboardFilterBarConfig(config).filters) {
    if (filter.type === 'dateRange') {
      assign(filter.fromApiParam ?? 'from', filter.fromStorePath);
      assign(filter.toApiParam ?? 'to', filter.toStorePath);
    } else {
      assign(filter.apiParam, filter.storePath);
    }
  }

  return bindings;
};

export const DEFAULT_DASHBOARD_FILTER_BAR_CONFIG: DesignerDashboardFilterBarConfig = {
  filters: [
    {
      id: 'category',
      label: 'Category',
      type: 'select',
      apiParam: 'category',
      storePath: 'dashboardFilters.category',
      placeholder: 'All categories',
      options: [
        { label: 'Product A', value: 'a' },
        { label: 'Product B', value: 'b' },
      ],
    },
    {
      id: 'period',
      label: 'Date range',
      type: 'dateRange',
      fromApiParam: 'from',
      toApiParam: 'to',
      fromStorePath: 'dashboardFilters.period.from',
      toStorePath: 'dashboardFilters.period.to',
    },
  ],
};
