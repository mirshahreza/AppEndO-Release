import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useOptionalPlatformMount } from '@/app/platform/PlatformMountContext';
import { resolvePublishedDesignerNavigateTarget } from '@/domain/component-designer/resolvePublishedDesignerNavigateTarget';
import { useCulture } from '@/core/culture/CultureContext';
import { useHwyFamilyHouseholdDialog } from '@/domain/hwy/useHwyFamilyHouseholdDialog';
import { buildAppTableGridColumns } from '@/domain/component-designer/DesignerRuntimeAppTableGrid';
import { applyClientGridQuery, EMPTY_GRID_QUERY, type GridQueryState } from '@/shared/lib/appTableGridQuery';
import { resolveDataGridTotalCount, sliceDataGridRowsForDisplay, buildDataGridPageNumbers, applyGridAggregation } from '@/domain/component-designer/designerDataGridRuntime';
import { applyDesignerGridToolbarClientFilters } from '@/domain/component-designer/designerGridToolbarConfig';
import { createDefaultColumnLayout } from '@/shared/lib/appTableGridColumnLayout';
import { AppTableGrid, GridPagingFooter, ListPageShell, ListPageToolbarFrame, PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS, PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS, ToolbarFilterSelect, UiCheckbox } from '@/shared/ui';

const parseApiErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json();
    if (payload && typeof payload === "object") {
      const record = payload as Record<string, unknown>;
      const message = record.message ?? record.error ?? record.detail;
      if (typeof message === "string" && message.trim().length > 0) {
        return message.trim();
      }
    }
  } catch {
    // fall through to status text
  }
  return response.statusText || `Request failed (${response.status})`;
};

const readBindingParamValue = (
  context: Record<string, unknown> | null | undefined,
  dataPath: string,
): unknown => {
  const segments = dataPath.split(".").map((segment) => segment.trim()).filter(Boolean);
  let cursor: unknown = context;
  for (const segment of segments) {
    if (cursor && typeof cursor === "object" && segment in (cursor as Record<string, unknown>)) {
      cursor = (cursor as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return cursor;
};

const resolveBindingTemplateValue = (
  template: string,
  context: Record<string, unknown> | null | undefined,
  paramPaths: Record<string, string>,
): string =>
  template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, paramName: string) => {
    const dataPath = paramPaths[paramName];
    if (!dataPath) {
      return "";
    }
    const cursor = readBindingParamValue(context, dataPath);
    return cursor === undefined || cursor === null ? "" : String(cursor);
  });

const resolveBindingUrl = (
  endpointTemplate: string,
  context: Record<string, unknown> | null | undefined,
  paramPaths: Record<string, string>,
): string => {
  const usedParamNames = new Set<string>();
  let resolvedPath = endpointTemplate.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, paramName: string) => {
    usedParamNames.add(paramName);
    const dataPath = paramPaths[paramName];
    if (!dataPath) {
      return "";
    }
    const cursor = readBindingParamValue(context, dataPath);
    return cursor === undefined || cursor === null ? "" : String(cursor);
  });
  for (const [paramName, dataPath] of Object.entries(paramPaths)) {
    if (usedParamNames.has(paramName)) {
      continue;
    }
    const colonParamPattern = new RegExp(`:${paramName}(?=/|$)`, "g");
    if (!colonParamPattern.test(resolvedPath)) {
      continue;
    }
    usedParamNames.add(paramName);
    const cursor = readBindingParamValue(context, dataPath);
    const text = cursor === undefined || cursor === null ? "" : String(cursor);
    resolvedPath = resolvedPath.replace(new RegExp(`:${paramName}(?=/|$)`, "g"), text);
  }
  const leftoverParams: Record<string, string> = {};
  for (const [paramName, dataPath] of Object.entries(paramPaths)) {
    if (usedParamNames.has(paramName)) {
      continue;
    }
    leftoverParams[paramName] = dataPath;
  }
  const searchParams = new URLSearchParams();
  const eqFilterFields = new Set<string>();
  for (const [paramName, dataPath] of Object.entries(leftoverParams)) {
    const match = /^filter\[([^\]]+)\]\[([^\]]+)\]$/.exec(paramName);
    if (!match || match[2] !== "eq" || dataPath.startsWith("static:")) {
      continue;
    }
    const cursor = readBindingParamValue(context, dataPath);
    if (cursor === undefined || cursor === null) {
      continue;
    }
    if (String(cursor).trim().length > 0) {
      eqFilterFields.add(match[1]!);
    }
  }
  for (const [paramName, dataPath] of Object.entries(leftoverParams)) {
    const match = /^filter\[([^\]]+)\]\[([^\]]+)\]$/.exec(paramName);
    if (match?.[2] === "in" && eqFilterFields.has(match[1]!)) {
      continue;
    }
    const cursor = dataPath.startsWith("static:")
      ? dataPath.slice("static:".length)
      : readBindingParamValue(context, dataPath);
    if (cursor === undefined || cursor === null) {
      continue;
    }
    const text = String(cursor).trim();
    if (text.length === 0) {
      continue;
    }
    searchParams.set(paramName, text);
  }
  const queryString = searchParams.toString();
  if (!queryString) {
    return resolvedPath;
  }
  return resolvedPath.includes("?") ? `${resolvedPath}&${queryString}` : `${resolvedPath}?${queryString}`;
};

const resolveBindingHeaders = (
  context: Record<string, unknown> | null | undefined,
  headerTemplates: Record<string, string>,
  paramPaths: Record<string, string>,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(headerTemplates).map(([key, template]) => [
      key,
      resolveBindingTemplateValue(template, context, paramPaths),
    ]),
  );

const setNestedPayloadValue = (target: Record<string, unknown>, path: string, value: unknown): void => {
  const segments = path.split(".").map((segment) => segment.trim()).filter(Boolean);
  if (segments.length === 0) {
    return;
  }
  let cursor: Record<string, unknown> = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const next = cursor[segment];
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      cursor[segment] = {};
    }
    cursor = cursor[segment] as Record<string, unknown>;
  }
  cursor[segments[segments.length - 1]] = value;
};

const mapDesignerListBoxItems = (rawItems: unknown): Array<{ id: string; textValue: string }> => {
  const items = Array.isArray(rawItems) ? rawItems : [];
  return items
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const record = entry as Record<string, unknown>;
      const id = String(record.id ?? "").trim();
      if (!id || id === "100" || id === "102") {
        return null;
      }
      const textValue = String(record.textValue ?? record.label ?? record.title ?? id).trim();
      return { id, textValue: textValue || id };
    })
    .filter((entry): entry is { id: string; textValue: string } => entry !== null);
};

const mapDesignerLovItems = (
  rawItems: unknown,
  returnColumn: string,
  displayColumn: string,
): Array<{ id: string; textValue: string }> => {
  const items = Array.isArray(rawItems) ? rawItems : [];
  return items
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const record = entry as Record<string, unknown>;
      const id = String(record[returnColumn] ?? "").trim();
      if (!id) {
        return null;
      }
      const textValue = String(record[displayColumn] ?? id).trim();
      return { id, textValue: textValue || id };
    })
    .filter((entry): entry is { id: string; textValue: string } => entry !== null);
};

const collectRegionFormDataFromContainer = (
  container: ParentNode,
  formFieldNames: readonly string[],
): FormData => {
  const formData = new FormData();
  for (const formFieldName of formFieldNames) {
    const escapedName = formFieldName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const field = container.querySelector(`[name="${escapedName}"]`);
    if (!field) {
      continue;
    }
    if (field instanceof HTMLInputElement) {
      if (field.type === "checkbox" || field.type === "radio") {
        formData.set(formFieldName, field.checked ? "true" : "false");
      } else {
        formData.set(formFieldName, field.value);
      }
      continue;
    }
    if (field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
      formData.set(formFieldName, field.value);
      continue;
    }
    formData.set(formFieldName, field.getAttribute("value") ?? "");
  }
  return formData;
};

const applyPayloadFieldTransform = (value: FormDataEntryValue | null, transform?: string): unknown => {
  const raw = value === null ? "" : String(value);
  switch (transform) {
    case "number": {
      const trimmed = raw.trim();
      if (!trimmed) return null;
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : null;
    }
    case "boolean":
      return raw === "true" || raw === "1" || raw === "on";
    case "nullableString":
      return raw.trim().length > 0 ? raw : null;
    case "nullableBoolean": {
      const trimmed = raw.trim().toLowerCase();
      if (!trimmed) return null;
      if (trimmed === "true" || trimmed === "1" || trimmed === "on") return true;
      if (trimmed === "false" || trimmed === "0" || trimmed === "off") return false;
      return null;
    }
    case "commaSeparatedArray":
      return raw.split(",").map((entry) => entry.trim()).filter(Boolean);
    default:
      return raw;
  }
};

// --- AUTH / TOKEN LIFECYCLE INJECTION POINT ---
// Register your application-wide 401 interceptor and token refresh handler here before production.
// Example: const designerFetch = createAuthenticatedFetch({ getAccessToken, refreshTokens, onSessionExpired });
const designerFetch: typeof fetch = fetch;

function useDataFetch<T>(url: string, options: { headers?: Record<string, string> } = {}) {
  const [data, setData] = React.useState<T | null>(null);
  const [isLoading, setIsLoading] = React.useState(Boolean(url));
  const [error, setError] = React.useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = React.useState(0);
  const headersKey = JSON.stringify(options.headers ?? {});

  const refresh = React.useCallback(async () => {
    setRefreshNonce((previous) => previous + 1);
  }, []);

  React.useEffect(() => {
    if (!url) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await designerFetch(url, {
          method: "GET",
          headers: options.headers,
        });
        if (!response.ok) {
          throw new Error(await parseApiErrorMessage(response));
        }
        const payload = (await response.json()) as T;
        if (!cancelled) {
          setData(payload);
        }
      } catch (loadError) {
        if (!cancelled) {
          setData(null);
          setError(loadError instanceof Error ? loadError.message : "Request failed");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [url, headersKey, refreshNonce]);

  return { data, setData, isLoading, error, refresh };
}

const readNestedContextValue = (
  context: Record<string, unknown> | null | undefined,
  path: string,
): unknown => {
  const segments = path.split(".").map((segment) => segment.trim()).filter(Boolean);
  let cursor: unknown = context;
  for (const segment of segments) {
    if (cursor && typeof cursor === "object" && segment in (cursor as Record<string, unknown>)) {
      cursor = (cursor as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return cursor;
};

const applyResponseDataPath = (
  payload: unknown,
  responseMapping?: { dataPath?: string; arrayPath?: string },
): unknown => {
  if (!responseMapping) {
    return payload;
  }
  const arrayPath = responseMapping.arrayPath?.trim();
  if (arrayPath) {
    const arrayValue = readNestedContextValue(
      payload && typeof payload === "object" ? payload as Record<string, unknown> : {},
      arrayPath,
    );
    if (Array.isArray(arrayValue)) {
      return arrayValue;
    }
  }
  const dataPath = responseMapping.dataPath?.trim();
  if (!dataPath || !payload || typeof payload !== "object") {
    return payload;
  }
  return readNestedContextValue(payload as Record<string, unknown>, dataPath);
};

const coerceApiRecordValue = (value: unknown): Record<string, unknown> | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.find(
      (entry): entry is Record<string, unknown> =>
        typeof entry === "object" && entry !== null && !Array.isArray(entry),
    );
  }
  if (typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return undefined;
};

const transformApiRowsToChartData = (
  rows: Array<Record<string, unknown>>,
  mapping: { categoryField: string; categoryAs?: string; series: Array<{ apiField: string; seriesKey: string; aggregation?: string }>; seriesGroupField?: string; sortBy?: { field: string; direction: "asc"|"desc" }; limitTopN?: { count: number; groupRestAsLabel: string } },
): Array<Record<string, string | number>> => {
  const categoryKey = mapping.categoryAs?.trim() || "label";
  const parseNum = (raw: unknown): number => {
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string") { const p = Number(raw); return Number.isFinite(p) ? p : 0; }
    return 0;
  };
  const sourceRows = mapping.categoryField === "__rowIndex"
    ? rows.map((row, index) => ({ ...row, __rowIndex: String(index + 1) }))
    : rows;
  const aggregate = (values: number[], agg: string): number => {
    if (values.length === 0) return 0;
    if (agg === "count") return values.length;
    if (agg === "avg") return values.reduce((s, v) => s + v, 0) / values.length;
    if (agg === "min") return Math.min(...values);
    if (agg === "max") return Math.max(...values);
    if (agg === "sum") return values.reduce((s, v) => s + v, 0);
    return values[0] ?? 0;
  };
  let chartRows: Array<Record<string, string | number>> = [];
  const groupField = mapping.seriesGroupField?.trim();
  if (groupField) {
    const valueField = mapping.series[0]?.apiField ?? "value";
    const grouped = new Map<string, Map<string, number[]>>();
    for (const row of sourceRows) {
      const category = String(row[mapping.categoryField] ?? "");
      const seriesName = String(row[groupField] ?? "Series");
      let catBucket = grouped.get(category);
      if (!catBucket) { catBucket = new Map(); grouped.set(category, catBucket); }
      const values = catBucket.get(seriesName) ?? [];
      values.push(parseNum(row[valueField]));
      catBucket.set(seriesName, values);
    }
    chartRows = Array.from(grouped.entries()).map(([category, seriesMap]) => {
      const chartRow: Record<string, string | number> = { [categoryKey]: category };
      for (const [seriesName, values] of seriesMap.entries()) {
        chartRow[seriesName] = aggregate(values, "sum");
      }
      return chartRow;
    });
  } else {
    const needsGrouping = mapping.series.some((s) => s.aggregation && s.aggregation !== "none");
    if (!needsGrouping) {
      chartRows = sourceRows.map((row) => {
        const chartRow: Record<string, string | number> = { [categoryKey]: String(row[mapping.categoryField] ?? "") };
        for (const series of mapping.series) { chartRow[series.seriesKey] = parseNum(row[series.apiField]); }
        return chartRow;
      });
    } else {
      const grouped = new Map<string, Array<Record<string, unknown>>>();
      for (const row of sourceRows) {
        const cat = String(row[mapping.categoryField] ?? "");
        const bucket = grouped.get(cat);
        if (bucket) bucket.push(row); else grouped.set(cat, [row]);
      }
      chartRows = Array.from(grouped.entries()).map(([category, groupRows]) => {
        const chartRow: Record<string, string | number> = { [categoryKey]: category };
        for (const series of mapping.series) {
          const values = groupRows.map((r) => parseNum(r[series.apiField]));
          chartRow[series.seriesKey] = aggregate(values, series.aggregation ?? "sum");
        }
        return chartRow;
      });
    }
  }
  if (mapping.sortBy?.field) {
    const field = mapping.sortBy.field;
    const direction = mapping.sortBy.direction;
    chartRows = [...chartRows].sort((a, b) => {
      const an = parseNum(a[field]); const bn = parseNum(b[field]);
      return direction === "asc" ? an - bn : bn - an;
    });
  }
  if (mapping.limitTopN && mapping.limitTopN.count > 0 && chartRows.length > mapping.limitTopN.count) {
    const top = chartRows.slice(0, mapping.limitTopN.count);
    const rest = chartRows.slice(mapping.limitTopN.count);
    const restRow: Record<string, string | number> = { [categoryKey]: mapping.limitTopN.groupRestAsLabel || "Other" };
    for (const series of mapping.series) {
      restRow[series.seriesKey] = rest.reduce((sum, row) => sum + parseNum(row[series.seriesKey]), 0);
    }
    chartRows = [...top, restRow];
  }
  return chartRows;
};

const mergeMultiSourceChartData = (
  datasets: Array<Array<Record<string, string | number>>>,
  xAxisKey: string,
): Array<Record<string, string | number>> => {
  if (datasets.length === 0) return [];
  if (datasets.length === 1) return datasets[0] ?? [];
  const merged = new Map<string, Record<string, string | number>>();
  for (const dataset of datasets) {
    for (const row of dataset) {
      const category = String(row[xAxisKey] ?? "");
      const existing = merged.get(category);
      merged.set(category, existing ? { ...existing, ...row } : { ...row });
    }
  }
  return Array.from(merged.values());
};

const readVizStringField = (row: Record<string, unknown>, field: string, fallback = ""): string => {
  const value = row[field];
  if (value === undefined || value === null) return fallback;
  return String(value);
};

const transformApiRowsToTreeNodes = (
  rows: Array<Record<string, unknown>>,
  mapping: { kind: "tree"; idField: string; labelField: string; parentIdField?: string },
): Array<{ id: string; label: string; children?: unknown[] }> => {
  const parentField = mapping.parentIdField?.trim();
  if (!parentField) {
    return rows.map((row, index) => ({
      id: readVizStringField(row, mapping.idField, `node-${index + 1}`),
      label: readVizStringField(row, mapping.labelField, `Item ${index + 1}`),
    }));
  }
  const nodeMap = new Map<string, { id: string; label: string; children: unknown[] }>();
  rows.forEach((row) => {
    const id = readVizStringField(row, mapping.idField);
    if (!id) return;
    nodeMap.set(id, { id, label: readVizStringField(row, mapping.labelField, id), children: [] });
  });
  const roots: Array<{ id: string; label: string; children?: unknown[] }> = [];
  rows.forEach((row) => {
    const id = readVizStringField(row, mapping.idField);
    if (!id) return;
    const node = nodeMap.get(id);
    if (!node) return;
    const parentId = readVizStringField(row, parentField);
    if (parentId && nodeMap.has(parentId)) {
      nodeMap.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
};

const readVizNumberField = (row: Record<string, unknown>, field: string): number | undefined => {
  const value = row[field];
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
};

const transformApiRowsToTimelineEvents = (
  rows: Array<Record<string, unknown>>,
  mapping: { kind: "timeline" | "gantt"; idField?: string; titleField: string; startField: string; endField?: string; descriptionField?: string; progressField?: string },
): Array<{ id?: string; title: string; start: string; end?: string; description?: string; progress?: number }> =>
  rows.map((row, index) => {
    const progress = mapping.progressField ? readVizNumberField(row, mapping.progressField) : undefined;
    return {
      id: mapping.idField ? readVizStringField(row, mapping.idField, `evt-${index + 1}`) : `evt-${index + 1}`,
      title: readVizStringField(row, mapping.titleField, `Event ${index + 1}`),
      start: readVizStringField(row, mapping.startField),
      ...(mapping.endField ? { end: readVizStringField(row, mapping.endField) } : {}),
      ...(mapping.descriptionField ? { description: readVizStringField(row, mapping.descriptionField) } : {}),
      ...(progress !== undefined ? { progress } : {}),
    };
  });

const transformApiRowsToKanbanBoard = (
  rows: Array<Record<string, unknown>>,
  mapping: { kind: "kanban"; cardIdField: string; cardTitleField: string; cardDescriptionField?: string; cardColumnField: string; columnOrder?: Array<{ id: string; title: string }> },
): { columns: Array<{ id: string; title: string; cards: Array<{ id: string; title: string; description?: string }> }> } => {
  const cardsByColumn = new Map<string, Array<{ id: string; title: string; description?: string }>>();
  rows.forEach((row, index) => {
    const columnKey = readVizStringField(row, mapping.cardColumnField, "default");
    const card = {
      id: readVizStringField(row, mapping.cardIdField, `card-${index + 1}`),
      title: readVizStringField(row, mapping.cardTitleField, `Card ${index + 1}`),
      ...(mapping.cardDescriptionField ? { description: readVizStringField(row, mapping.cardDescriptionField) } : {}),
    };
    cardsByColumn.set(columnKey, [...(cardsByColumn.get(columnKey) ?? []), card]);
  });
  const columnOrder = mapping.columnOrder && mapping.columnOrder.length > 0
    ? mapping.columnOrder
    : Array.from(cardsByColumn.keys()).map((key) => ({ id: key, title: key }));
  const columns = columnOrder.map((columnDef) => ({
    id: columnDef.id,
    title: columnDef.title,
    cards: cardsByColumn.get(columnDef.id) ?? cardsByColumn.get(columnDef.title) ?? [],
  }));
  cardsByColumn.forEach((cards, columnKey) => {
    if (!columns.some((column) => column.id === columnKey || column.title === columnKey)) {
      columns.push({ id: columnKey, title: columnKey, cards });
    }
  });
  return { columns };
};

const transformApiRowsToSheetData = (
  rows: Array<Record<string, unknown>>,
  mapping: { kind: "sheet"; columns: Array<{ header: string; field: string; type?: "text" | "number" | "select" | "formula"; options?: string[]; formula?: string; onCellChangeAction?: unknown[] }> },
): { columns: Array<{ key: string; header: string; type?: "text" | "number" | "select" | "formula"; options?: string[]; formula?: string; onCellChangeAction?: unknown[] }>; rows: Array<Record<string, unknown>> } => ({
  columns: mapping.columns.map((column) => ({
    key: column.field,
    header: column.header,
    type: column.type ?? "text",
    ...(Array.isArray(column.options) && column.options.length > 0 ? { options: [...column.options] } : {}),
    ...(column.type === "formula" && column.formula ? { formula: column.formula } : {}),
    ...(Array.isArray(column.onCellChangeAction) && column.onCellChangeAction.length > 0 ? { onCellChangeAction: [...column.onCellChangeAction] } : {}),
  })),
  rows: rows.map((row) => mapping.columns.reduce<Record<string, unknown>>((acc, column) => {
    acc[column.field] = row[column.field];
    return acc;
  }, {})),
});

type EntityPickerOption = { id: string; textValue: string };
type EntityPickerFieldMapping = { returnField: string; displayField: string };

function normalizeEntityPickerItems(payload: unknown, mapping?: EntityPickerFieldMapping): EntityPickerOption[] {
  const returnField = mapping?.returnField?.trim() || "id";
  const displayField = mapping?.displayField?.trim() || "label";
  if (Array.isArray(payload)) {
    return payload
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }
        const record = entry as Record<string, unknown>;
        const mappedId = record[returnField];
        const id = typeof mappedId === "string" && mappedId.trim()
          ? mappedId.trim()
          : typeof record.id === "string" && record.id.trim()
            ? record.id.trim()
            : typeof record.value === "string" && record.value.trim()
              ? record.value.trim()
              : "";
        const mappedLabel = record[displayField];
        const textValue = typeof mappedLabel === "string" && mappedLabel.trim()
          ? mappedLabel.trim()
          : typeof record.textValue === "string" && record.textValue.trim()
            ? record.textValue.trim()
            : typeof record.label === "string" && record.label.trim()
              ? record.label.trim()
              : typeof record.name === "string" && record.name.trim()
                ? record.name.trim()
                : id;
        if (!id || !textValue) {
          return null;
        }
        return { id, textValue };
      })
      .filter((entry): entry is EntityPickerOption => entry !== null);
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const items = record.items ?? record.results ?? record.data;
    return normalizeEntityPickerItems(items, mapping);
  }

  return [];
}

function useEntityPickerOptions(entityRef: string, searchParam: string, mapping?: EntityPickerFieldMapping) {
  const [items, setItems] = React.useState<EntityPickerOption[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  const loadOptions = React.useCallback(async (query: string) => {
    if (!entityRef) {
      setItems([]);
      return;
    }

    setIsLoading(true);
    try {
      const url = entityRef.startsWith("http")
        ? new URL(entityRef)
        : new URL(entityRef, window.location.origin);
      // Option A (parity audit items 31/32): Autocomplete is Select-based — no live typing.
      // Still honour an explicit non-empty query if a caller passes one, but initial load uses "".
      if (query.trim()) {
        url.searchParams.set(searchParam, query);
      }
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response));
      }
      const payload = await response.json();
      setItems(normalizeEntityPickerItems(payload, mapping));
    } catch {
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [entityRef, searchParam, mapping?.returnField, mapping?.displayField]);

  React.useEffect(() => {
    void loadOptions("");
  }, [loadOptions]);

  return { items, isLoading, loadOptions };
}

type DesignerLiveConnectionStatus = "idle" | "connecting" | "open" | "error" | "closed";

const parseLivePushPayload = (raw: string): { kind: "snapshot" | "append" | "refresh"; data?: unknown } | null => {
  const text = raw.trim();
  if (!text) { return null; }
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>;
      const type = typeof record.type === "string" ? record.type.trim().toLowerCase() : "";
      if (type === "refresh") { return { kind: "refresh" }; }
      if (type === "append") { return { kind: "append", data: record.data ?? record.payload ?? record.row ?? record.rows }; }
      if (type === "snapshot" || type === "data" || type === "message") {
        return { kind: "snapshot", data: "data" in record ? record.data : ("payload" in record ? record.payload : parsed) };
      }
      if ("data" in record) { return { kind: "snapshot", data: record.data }; }
    }
    return { kind: "snapshot", data: parsed };
  } catch {
    return { kind: "snapshot", data: text };
  }
};

const applyLiveAppend = (current: unknown, incoming: unknown): unknown => {
  const incomingRows = Array.isArray(incoming) ? incoming : [incoming];
  if (Array.isArray(current)) { return [...current, ...incomingRows]; }
  if (current && typeof current === "object") {
    const record = current as Record<string, unknown>;
    for (const key of ["data", "rows", "items", "results"] as const) {
      const value = record[key];
      if (Array.isArray(value)) { return { ...record, [key]: [...value, ...incomingRows] }; }
    }
  }
  return incomingRows;
};

const absolutizeLiveStreamUrl = (url: string, type: "sse" | "websocket"): string => {
  if (!url) { return ""; }
  if (type === "websocket") {
    if (url.startsWith("ws://") || url.startsWith("wss://")) { return url; }
    if (url.startsWith("http://") || url.startsWith("https://")) { return url.replace(/^http/, "ws"); }
    const absoluteHttp = new URL(url, window.location.origin).href;
    return absoluteHttp.replace(/^http/, "ws");
  }
  return url;
};

function useLiveDataSource(options: {
  url: string;
  type: "sse" | "websocket";
  enabled?: boolean;
  onSnapshot: (data: unknown) => void;
  onAppend?: (data: unknown) => void;
  onRefresh?: () => void;
}) {
  const { url, type, enabled = true, onSnapshot, onAppend, onRefresh } = options;
  const [status, setStatus] = React.useState<DesignerLiveConnectionStatus>("idle");
  const onSnapshotRef = React.useRef(onSnapshot);
  const onAppendRef = React.useRef(onAppend);
  const onRefreshRef = React.useRef(onRefresh);
  onSnapshotRef.current = onSnapshot;
  onAppendRef.current = onAppend;
  onRefreshRef.current = onRefresh;
  React.useEffect(() => {
    if (!enabled || !url.trim()) { setStatus("idle"); return undefined; }
    const absoluteUrl = absolutizeLiveStreamUrl(url, type);
    let closed = false;
    setStatus("connecting");
    const dispatchPayload = (raw: string) => {
      const message = parseLivePushPayload(raw);
      if (!message) { return; }
      if (message.kind === "refresh") { onRefreshRef.current?.(); return; }
      if (message.kind === "append") {
        if (onAppendRef.current) { onAppendRef.current(message.data); }
        else { onSnapshotRef.current(message.data); }
        return;
      }
      onSnapshotRef.current(message.data);
    };
    if (type === "sse") {
      const source = new EventSource(absoluteUrl, { withCredentials: true });
      source.onopen = () => { if (!closed) { setStatus("open"); } };
      source.onmessage = (event) => { if (!closed) { dispatchPayload(String(event.data ?? "")); } };
      source.onerror = () => { if (!closed) { setStatus("error"); } };
      return () => { closed = true; source.close(); setStatus("closed"); };
    }
    const socket = new WebSocket(absoluteUrl);
    socket.onopen = () => { if (!closed) { setStatus("open"); } };
    socket.onmessage = (event) => { if (!closed) { dispatchPayload(typeof event.data === "string" ? event.data : String(event.data)); } };
    socket.onerror = () => { if (!closed) { setStatus("error"); } };
    socket.onclose = () => { if (!closed) { setStatus("closed"); } };
    return () => { closed = true; try { socket.close(); } catch {} setStatus("closed"); };
  }, [enabled, url, type]);
  return { status };
}

function useDesignerStore<T extends Record<string, unknown>>(initial: T) {
  const [store, setStore] = React.useState<T>(initial);
  const patch = React.useCallback((path: string, value: unknown) => {
    setStore((previous) => {
      const next = { ...previous };
      setNestedPayloadValue(next, path, value);
      return next as T;
    });
  }, []);
  return { store, patch };
}

export const GeneratedComponent: React.FC = () => {
  const culture = useCulture();
  const routerNavigate = useNavigate();
  const location = useLocation();
  const mountPathPrefix = useOptionalPlatformMount()?.pathPrefix ?? null;
  const navigate = React.useCallback((to: string, options?: { replace?: boolean }) => {
    routerNavigate(resolvePublishedDesignerNavigateTarget(to, location.pathname, mountPathPrefix), { replace: options?.replace === true });
  }, [location.pathname, mountPathPrefix, routerNavigate]);
  const { store: designerStore, patch: patchDesignerStore } = useDesignerStore<Record<string, unknown>>({"gridQuery":{"page":1,"pageSize":50,"sortBy":"updatedAt","sortDir":"desc","search":"","filters":{}},"gridToolbar":{"search":"","filters":{"membershipStatusCode":""}}});
  const { dialog: hwyFamilyHouseholdDialog, openFromGridRow: openHwyFamilyHouseholdFromGridRow } = useHwyFamilyHouseholdDialog();
  const handleGridCellClick_heroui_app_table_grid_1793680967368_upmp3 = React.useCallback(async (row: Record<string, unknown>, column: { key?: string; id?: string }) => {
    const columnKey = String(column.key ?? column.id ?? '');
    switch (columnKey) {
      case "displayFullName": {
        patchDesignerStore("selection.id", row["id"] ?? null);
        navigate(("/hawiety/members-all/view/" + encodeURIComponent(String(designerStore?.selection?.id ?? ''))), { replace: false });
        return;
      }
      case "nakhebinId": {
        openHwyFamilyHouseholdFromGridRow(row, columnKey, column);
        return;
      }
      default:
        return;
    }
  }, [patchDesignerStore, navigate, openHwyFamilyHouseholdFromGridRow]);
  const { data: raw_gridData_heroui_app_table_grid_1793680967368_upmp3, isLoading: isLoading_gridData_heroui_app_table_grid_1793680967368_upmp3, error: error_gridData_heroui_app_table_grid_1793680967368_upmp3, refresh: refresh_gridData_heroui_app_table_grid_1793680967368_upmp3 } = useDataFetch<unknown>(resolveBindingUrl("/api/hwy/member-directory", designerStore, { "search": "gridToolbar.search", "sortBy": "gridQuery.sortBy", "sortDir": "gridQuery.sortDir", "page": "gridQuery.page", "pageSize": "gridQuery.pageSize", "includeCount": "static:page1Only", "where": "gridToolbar.listWhere", "lang": "static:ar", "listScope": "static:HWY_Members_List_Waited_2_Protectors" }), {});
  const gridData_heroui_app_table_grid_1793680967368_upmp3 = React.useMemo(() => applyResponseDataPath(raw_gridData_heroui_app_table_grid_1793680967368_upmp3, {"dataPath":"data","arrayPath":"data","totalPath":"count"}), [raw_gridData_heroui_app_table_grid_1793680967368_upmp3]);
  const gridColumns_heroui_app_table_grid_1793680967368_upmp3 = React.useMemo(() => buildAppTableGridColumns([{"key":"displayFullName","label":"Member","labelTranslationKey":"hwy.members.column.member","sort":true,"filter":true,"filterType":"text","cellKind":"hwy-member-face","cellFields":{"imageUrlField":"avatarUrl","fallbackTextField":"displayFullName","captionField":"username","captionFallbackField":"trackingCode","genderCodeField":"genderCode","avatarSizePx":43,"primaryField":"displayFullName","secondaryField":"birthYear"},"cellClickBehavior":{"kind":"navigate","primaryKeyField":"id","selectionStorePath":"selection.id","navigateTarget":"/hawiety/members-all/view/{selection.id}"},"cardRole":"title","layoutHideable":false,"layoutResizable":false,"width":"263px","headerClassName":"text-start [&>div]:justify-start whitespace-nowrap","cellClassName":"min-w-0 max-w-[263px] whitespace-normal leading-snug px-0.5"},{"key":"phone1","label":"Phone","labelTranslationKey":"hwy.members.column.phone","filter":true,"filterType":"text","cellKind":"account","cellFields":{"primaryField":"phone1","secondaryField":"phone2","accountLayout":"stacked-text-center"},"cardRole":"meta","layoutResizable":false,"width":"9.5rem","headerClassName":"text-center [&>div]:justify-center whitespace-nowrap","cellClassName":"text-center text-[13px] tabular-nums"},{"key":"nakhebinJoinTasjilStateCodeTitle","label":"Registered","labelTranslationKey":"hwy.family.column.cardStatus","cellKind":"hwy-registered-icon","cellFields":{"primaryField":"nakhebinJoinTasjilStateCodeTitle","secondaryField":"nakhebinJoinTasjilStateCode"},"layoutResizable":false,"width":"64px","headerClassName":"text-center [&>div]:justify-center whitespace-nowrap","cellClassName":"text-center"},{"key":"nakhebinId","label":"Family record","labelTranslationKey":"hwy.members.column.nakhebin","filter":true,"filterType":"text","cellKind":"account","cellFields":{"primaryField":"nakhebinId","secondaryField":"nakhebinFamilyCode","accountLayout":"stacked-text-center"},"cellClickBehavior":{"kind":"hwy-family-household"},"cardRole":"hidden","layoutResizable":false,"width":"78px","headerClassName":"text-center [&>div]:justify-center whitespace-nowrap","cellClassName":"text-center min-w-0 text-xs tabular-nums leading-snug"},{"key":"electoralDivisionPath","label":"Electoral division","labelTranslationKey":"hwy.members.column.electoralDivision","sort":true,"filter":true,"filterType":"text","cellKind":"account","cellFields":{"primaryField":"electoralDivisionLine1","secondaryField":"electoralDivisionLine2","electoralFallbackField":"addrProvinceTitle","accountLayout":"stacked-text"},"cardRole":"meta","cellClassName":"min-w-0 whitespace-normal text-xs leading-snug hwy-electoral-division-grid-cell align-middle"},{"key":"createdAt","label":"Registered on","labelTranslationKey":"hwy.members.column.createdAt","sort":true,"filter":true,"filterType":"text","cellKind":"date","cardRole":"meta","layoutResizable":false,"width":"102px","headerClassName":"text-center [&>div]:justify-center whitespace-nowrap","cellClassName":"text-xs tabular-nums text-center whitespace-nowrap"}], "server", {
    mode: 'runtime',
    detailFlowRef: { current: null },
    rowActionHandlerRef: { current: undefined },
    cellClickHandlerRef: { current: handleGridCellClick_heroui_app_table_grid_1793680967368_upmp3 },
    designerStoreRef: { current: designerStore },
    translate: (key) => culture.t(key),
    hwyMemberDirectoryListScopeLegacy: "HWY_Members_List_Waited_2_Protectors",
  }), [designerStore, handleGridCellClick_heroui_app_table_grid_1793680967368_upmp3, culture]);
  const gridSortOptions_heroui_app_table_grid_1793680967368_upmp3 = React.useMemo(() => [{"value":"updatedAt","label":"Modified on","labelTranslationKey":"hwy.members.column.updatedAt"},{"value":"createdAt","label":"Created on","labelTranslationKey":"hwy.members.column.createdAt"},{"value":"membershipOn","label":"Membership on","labelTranslationKey":"hwy.members.column.membershipOn"},{"value":"displayFullName","label":"Member","labelTranslationKey":"hwy.members.column.member"},{"value":"electoralDivisionPath","label":"Electoral division","labelTranslationKey":"hwy.members.column.electoralDivision"}].map((option) => ({ value: option.value, label: option.labelTranslationKey ? culture.t(option.labelTranslationKey) : option.label })), [culture]);
  const [gridQuery_heroui_app_table_grid_1793680967368_upmp3, setGridQuery_heroui_app_table_grid_1793680967368_upmp3] = React.useState<GridQueryState>(() => ({ ...EMPTY_GRID_QUERY, sort: { columnId: "updatedAt", direction: "asc" } }));
  const [gridPage_heroui_app_table_grid_1793680967368_upmp3, setGridPage_heroui_app_table_grid_1793680967368_upmp3] = React.useState(1);
  const [gridPageSize_heroui_app_table_grid_1793680967368_upmp3, setGridPageSize_heroui_app_table_grid_1793680967368_upmp3] = React.useState(50);
  const [gridListMode_heroui_app_table_grid_1793680967368_upmp3, setGridListMode_heroui_app_table_grid_1793680967368_upmp3] = React.useState<'paging' | 'infinite'>("paging");
  const [gridColumnLayout_heroui_app_table_grid_1793680967368_upmp3, setGridColumnLayout_heroui_app_table_grid_1793680967368_upmp3] = React.useState(() => createDefaultColumnLayout(gridColumns_heroui_app_table_grid_1793680967368_upmp3));
  const [gridSearchInput_heroui_app_table_grid_1793680967368_upmp3, setGridSearchInput_heroui_app_table_grid_1793680967368_upmp3] = React.useState('');
  const [gridDebouncedSearch_heroui_app_table_grid_1793680967368_upmp3, setGridDebouncedSearch_heroui_app_table_grid_1793680967368_upmp3] = React.useState('');
  const [gridCheckboxSelections_heroui_app_table_grid_1793680967368_upmp3, setGridCheckboxSelections_heroui_app_table_grid_1793680967368_upmp3] = React.useState<Record<string, Record<string, boolean>>>({});
  const [gridRadioSelections_heroui_app_table_grid_1793680967368_upmp3, setGridRadioSelections_heroui_app_table_grid_1793680967368_upmp3] = React.useState<Record<string, string>>({});
  const [gridMatchLogic_heroui_app_table_grid_1793680967368_upmp3, setGridMatchLogic_heroui_app_table_grid_1793680967368_upmp3] = React.useState<Record<string, 'and' | 'or'>>({});
  const gridRoleFilters_heroui_app_table_grid_1793680967368_upmp3 = {};
  const gridFilteredRows_heroui_app_table_grid_1793680967368_upmp3 = React.useMemo(() => applyClientGridQuery(((Array.isArray(gridData_heroui_app_table_grid_1793680967368_upmp3) ? gridData_heroui_app_table_grid_1793680967368_upmp3 : []) ?? []), gridQuery_heroui_app_table_grid_1793680967368_upmp3, gridColumns_heroui_app_table_grid_1793680967368_upmp3, "server"), [gridQuery_heroui_app_table_grid_1793680967368_upmp3, gridColumns_heroui_app_table_grid_1793680967368_upmp3]);
  const gridAggregatedRows_heroui_app_table_grid_1793680967368_upmp3 = gridFilteredRows_heroui_app_table_grid_1793680967368_upmp3;
  const gridApiTotal_heroui_app_table_grid_1793680967368_upmp3 = React.useMemo(() => {
    const raw = raw_gridData_heroui_app_table_grid_1793680967368_upmp3;
    const value = readNestedContextValue((raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}), "count");
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
  }, [raw_gridData_heroui_app_table_grid_1793680967368_upmp3]);
  const gridTotalCount_heroui_app_table_grid_1793680967368_upmp3 = resolveDataGridTotalCount({ page: gridPage_heroui_app_table_grid_1793680967368_upmp3, pageSize: gridPageSize_heroui_app_table_grid_1793680967368_upmp3, total: gridApiTotal_heroui_app_table_grid_1793680967368_upmp3, gridQueryMode: "server" }, gridAggregatedRows_heroui_app_table_grid_1793680967368_upmp3.length);
  const gridPaging_heroui_app_table_grid_1793680967368_upmp3 = sliceDataGridRowsForDisplay(gridAggregatedRows_heroui_app_table_grid_1793680967368_upmp3, gridPage_heroui_app_table_grid_1793680967368_upmp3, gridPageSize_heroui_app_table_grid_1793680967368_upmp3, gridTotalCount_heroui_app_table_grid_1793680967368_upmp3, "server");
  const handleGridQueryChange_heroui_app_table_grid_1793680967368_upmp3 = React.useCallback((nextQuery: GridQueryState) => {
    setGridQuery_heroui_app_table_grid_1793680967368_upmp3(nextQuery);
    setGridPage_heroui_app_table_grid_1793680967368_upmp3(1);
    patchDesignerStore("gridQuery.sortBy", nextQuery.sort?.columnId ?? '');
    patchDesignerStore("gridQuery.sortDir", nextQuery.sort?.direction ?? '');
  }, [patchDesignerStore]);
  const handleGridPageChange_heroui_app_table_grid_1793680967368_upmp3 = React.useCallback((nextPage: number) => {
    setGridPage_heroui_app_table_grid_1793680967368_upmp3(nextPage);
    patchDesignerStore("gridQuery.page", nextPage);
  }, [patchDesignerStore]);
  const handleGridPageSizeChange_heroui_app_table_grid_1793680967368_upmp3 = React.useCallback((nextSize: number) => {
    setGridPageSize_heroui_app_table_grid_1793680967368_upmp3(nextSize);
    setGridPage_heroui_app_table_grid_1793680967368_upmp3(1);
    patchDesignerStore("gridQuery.pageSize", nextSize);
  }, [patchDesignerStore]);
  const handleGridSortByChange_heroui_app_table_grid_1793680967368_upmp3 = React.useCallback((nextSortBy: string) => {
    setGridQuery_heroui_app_table_grid_1793680967368_upmp3((current: GridQueryState) => ({ ...current, sort: nextSortBy ? { columnId: nextSortBy, direction: current.sort?.direction ?? 'asc' } : null }));
  }, []);
  const handleGridToggleSortDirection_heroui_app_table_grid_1793680967368_upmp3 = React.useCallback(() => {
    setGridQuery_heroui_app_table_grid_1793680967368_upmp3((current: GridQueryState) => (current.sort ? { ...current, sort: { ...current.sort, direction: current.sort.direction === 'asc' ? 'desc' : 'asc' } } : current));
  }, []);
  const searchDebounceTimer_heroui_app_table_grid_1793680967368_upmp3 = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleGridSearchChange_heroui_app_table_grid_1793680967368_upmp3 = React.useCallback((nextValue: string) => {
    setGridSearchInput_heroui_app_table_grid_1793680967368_upmp3(nextValue);
    if (searchDebounceTimer_heroui_app_table_grid_1793680967368_upmp3.current) {
      clearTimeout(searchDebounceTimer_heroui_app_table_grid_1793680967368_upmp3.current);
    }
    searchDebounceTimer_heroui_app_table_grid_1793680967368_upmp3.current = setTimeout(() => {
      setGridDebouncedSearch_heroui_app_table_grid_1793680967368_upmp3(nextValue);
      setGridPage_heroui_app_table_grid_1793680967368_upmp3(1);
      patchDesignerStore("gridToolbar.search", nextValue);
    }, 300);
  }, [patchDesignerStore]);

  return (
    <>
      {hwyFamilyHouseholdDialog}
      <div className="h-full min-h-0 w-full min-w-0 space-y-3">
        <ListPageShell className="flex min-h-0 w-full flex-1 flex-col"><ListPageToolbarFrame><div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}><input type="text" value={gridSearchInput_heroui_app_table_grid_1793680967368_upmp3} onChange={(event) => handleGridSearchChange_heroui_app_table_grid_1793680967368_upmp3(event.target.value)} placeholder={culture.t("hwy.members.search.placeholder")} className="h-8 rounded-md border border-slate-200 px-2 text-sm" /></div><div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}><span className="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold tabular-nums text-slate-700" aria-live="polite">{gridTotalCount_heroui_app_table_grid_1793680967368_upmp3.toLocaleString()}</span><button type="button" onClick={() => { void refresh_gridData_heroui_app_table_grid_1793680967368_upmp3(); }} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">{culture.t("hwy.members.toolbar.refresh")}</button></div></ListPageToolbarFrame><AppTableGrid className="flex !h-full !min-h-0 !w-full flex-1 flex-col" showPagingFooter presentation="auto" cardBelow="tablet" size="xs" columns={gridColumns_heroui_app_table_grid_1793680967368_upmp3} rows={gridPaging_heroui_app_table_grid_1793680967368_upmp3.displayRows} getRowKey={(row) => String((row as Record<string, unknown>)["id"] ?? '')} enableColumnLayout={false} columnLayout={gridColumnLayout_heroui_app_table_grid_1793680967368_upmp3} onColumnLayoutChange={setGridColumnLayout_heroui_app_table_grid_1793680967368_upmp3} isLoading={isLoading_gridData_heroui_app_table_grid_1793680967368_upmp3} loadingMessage={culture.t("hwy.members.loading")} emptyMessage={culture.t("hwy.members.empty")} isEmpty={gridAggregatedRows_heroui_app_table_grid_1793680967368_upmp3.length === 0} errorContent={(error_gridData_heroui_app_table_grid_1793680967368_upmp3 ? culture.t("hwy.members.error") : undefined)} gridQueryMode={"server"} query={gridQuery_heroui_app_table_grid_1793680967368_upmp3} onQueryChange={handleGridQueryChange_heroui_app_table_grid_1793680967368_upmp3} compact={{ phone: { layout: "cards" }, tablet: { layout: "cards" } }} footer={<GridPagingFooter totalCount={gridTotalCount_heroui_app_table_grid_1793680967368_upmp3} safePage={gridPaging_heroui_app_table_grid_1793680967368_upmp3.safePage} pageSize={gridPageSize_heroui_app_table_grid_1793680967368_upmp3} onPageSizeChange={handleGridPageSizeChange_heroui_app_table_grid_1793680967368_upmp3} sortBy={gridQuery_heroui_app_table_grid_1793680967368_upmp3.sort?.columnId ?? ''} sortOptions={gridSortOptions_heroui_app_table_grid_1793680967368_upmp3} onSortByChange={handleGridSortByChange_heroui_app_table_grid_1793680967368_upmp3} sortDirection={gridQuery_heroui_app_table_grid_1793680967368_upmp3.sort?.direction ?? 'asc'} onToggleSortDirection={handleGridToggleSortDirection_heroui_app_table_grid_1793680967368_upmp3} showSortControls={true} totalPages={gridPaging_heroui_app_table_grid_1793680967368_upmp3.totalPages} pageNumbers={buildDataGridPageNumbers(gridPaging_heroui_app_table_grid_1793680967368_upmp3.safePage, gridPaging_heroui_app_table_grid_1793680967368_upmp3.totalPages)} onPageChange={handleGridPageChange_heroui_app_table_grid_1793680967368_upmp3} listMode={gridListMode_heroui_app_table_grid_1793680967368_upmp3} onListModeChange={setGridListMode_heroui_app_table_grid_1793680967368_upmp3} visibleInfiniteCount={gridListMode_heroui_app_table_grid_1793680967368_upmp3 === 'infinite' ? gridPaging_heroui_app_table_grid_1793680967368_upmp3.displayRows.length : undefined} />} /></ListPageShell>
      </div>
    </>
  );
};
