import React from 'react';
import { buildAppTableGridColumns } from '@/domain/component-designer/DesignerRuntimeAppTableGrid';
import { applyClientGridQuery, EMPTY_GRID_QUERY, type GridQueryState } from '@/shared/lib/appTableGridQuery';
import { resolveDataGridTotalCount, sliceDataGridRowsForDisplay, buildDataGridPageNumbers, applyGridAggregation } from '@/domain/component-designer/designerDataGridRuntime';
import { applyDesignerGridToolbarClientFilters } from '@/domain/component-designer/designerGridToolbarConfig';
import { createDefaultColumnLayout } from '@/shared/lib/appTableGridColumnLayout';
import { validateDesignerFieldNode } from '@/domain/component-designer/previewFieldValidation';
import { AppTableGrid, ConfirmDialogShell, CreateEditModalShell, GridPagingFooter, ListPageShell, ListPageToolbarFrame, PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS, PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS, ToolbarFilterSelect, UiCheckbox } from '@/shared/ui';
import { UiInput } from '@/shared/ui/HeroFieldControls';
import { Button, InputTextarea, Toast, toast } from '@heroui/react';
import { Plus, Save, Trash2, X } from 'lucide-react';

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
function evaluateDesignerCondition(
  designerStore: Record<string, unknown>,
  dataContext: Record<string, unknown> | null,
  scope: { item?: unknown; index?: number },
  condition: string,
): boolean {
  const trimmed = condition.trim();
  if (!trimmed) {
    return true;
  }
  try {
    const formatPathChain = (root: string, path: string): string => {
      const chain = path
        .split('.')
        .filter(Boolean)
        .map((segment) => {
          if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(segment)) {
            return `?.${segment}`;
          }
          return `?.[${JSON.stringify(segment)}]`;
        })
        .join('');
      return `(${root}${chain})`;
    };
    let compiled = trimmed
      .replace(/\bstore\.([A-Za-z0-9_.-]+)/g, (_, path: string) => formatPathChain('designerStore', path))
      .replace(/\bdata\.([A-Za-z0-9_.-]+)/g, (_, path: string) => formatPathChain('dataContext', path))
      .replace(/\bdataContext\.([A-Za-z0-9_.-]+)/g, (_, path: string) => formatPathChain('dataContext', path));
    const evaluator = new Function('designerStore', 'dataContext', 'item', 'index', `return Boolean(${compiled});`);
    return Boolean(evaluator(designerStore, dataContext, scope.item, scope.index));
  } catch {
    return false;
  }
}

export const GeneratedComponent: React.FC = () => {
  const { store: designerStore, patch: patchDesignerStore } = useDesignerStore<Record<string, unknown>>({"selection":{"id":null}});
  const { data: raw_regionData_voteElectionsList_node_31cfa941_2f33_4038_b5fb_52b5141a187c, isLoading: isLoading_regionData_voteElectionsList_node_31cfa941_2f33_4038_b5fb_52b5141a187c, error: error_regionData_voteElectionsList_node_31cfa941_2f33_4038_b5fb_52b5141a187c, refresh: refresh_regionData_voteElectionsList_node_31cfa941_2f33_4038_b5fb_52b5141a187c } = useDataFetch<unknown>(resolveBindingUrl("/api/voting/elections", designerStore, { "id": "selection.id" }), {});
  const regionData_voteElectionsList_node_31cfa941_2f33_4038_b5fb_52b5141a187c = React.useMemo(() => coerceApiRecordValue(applyResponseDataPath(raw_regionData_voteElectionsList_node_31cfa941_2f33_4038_b5fb_52b5141a187c, {"dataPath":"data","arrayPath":"data","totalPath":"count"})), [raw_regionData_voteElectionsList_node_31cfa941_2f33_4038_b5fb_52b5141a187c]);
  const handleGridRowAction_heroui_app_table_grid_1794244658239_a050l = React.useCallback((row: Record<string, unknown>, actionId: string) => {
    switch (actionId) {
      case "edit": {
        patchDesignerStore("selection.id", row["id"] ?? null);
        patchDesignerStore("ui.visibility.node-a35cf43f-756f-41f1-9dd8-181832bb1e07", true);
        return;
      }
      case "delete": {
        patchDesignerStore("selection.id", row["id"] ?? null);
        patchDesignerStore("ui.visibility.node-eb7b6f3a-6c48-4db9-8940-9162d908f650", true);
        return;
      }
      default:
        return;
    }
  }, [patchDesignerStore]);
  const { data: raw_gridData_heroui_app_table_grid_1794244658239_a050l, isLoading: isLoading_gridData_heroui_app_table_grid_1794244658239_a050l, error: error_gridData_heroui_app_table_grid_1794244658239_a050l, refresh: refresh_gridData_heroui_app_table_grid_1794244658239_a050l } = useDataFetch<unknown>(resolveBindingUrl("/api/voting/elections", designerStore, { "search": "gridToolbar.search", "sortBy": "gridQuery.sortBy", "sortDir": "gridQuery.sortDir", "page": "gridQuery.page", "pageSize": "gridQuery.pageSize", "includeCount": "static:page1Only", "where": "gridToolbar.listWhere", "filter[title][like]": "gridQuery.filters.title", "filter[legacyCode][like]": "gridQuery.filters.legacyCode" }), {});
  const gridData_heroui_app_table_grid_1794244658239_a050l = React.useMemo(() => applyResponseDataPath(raw_gridData_heroui_app_table_grid_1794244658239_a050l, {"dataPath":"data","arrayPath":"data","totalPath":"count"}), [raw_gridData_heroui_app_table_grid_1794244658239_a050l]);
  const gridColumns_heroui_app_table_grid_1794244658239_a050l = React.useMemo(() => buildAppTableGridColumns([{"key":"title","label":"Title","sort":true,"filter":true,"filterType":"text","cardRole":"title"},{"key":"legacyCode","label":"Legacy code","sort":true,"filter":true,"filterType":"text","cardRole":"meta"},{"key":"startsAt","label":"Starts","sort":true,"cellKind":"date","cardRole":"meta"},{"key":"endsAt","label":"Ends","sort":true,"cellKind":"date","cardRole":"meta"},{"key":"updatedAt","label":"Updated","sort":true,"cellKind":"date","cardRole":"meta"},{"key":"actions","label":"","kind":"action-group","actions":[{"actionId":"edit","icon":"Pencil","intent":"edit","tooltip":"Edit","behavior":{"kind":"open-modal","modalNodeId":"node-a35cf43f-756f-41f1-9dd8-181832bb1e07","primaryKeyField":"id","selectionStorePath":"selection.id"}},{"actionId":"delete","icon":"Trash2","intent":"delete","tooltip":"Delete","behavior":{"kind":"open-modal","modalNodeId":"node-eb7b6f3a-6c48-4db9-8940-9162d908f650","primaryKeyField":"id","selectionStorePath":"selection.id"}}],"maxVisibleActions":3,"cardRole":"actions","layoutHideable":false,"layoutResizable":false,"layoutReorderable":false,"layoutPinned":"right","width":"57px"}], "server", {
    mode: 'runtime',
    detailFlowRef: { current: null },
    rowActionHandlerRef: { current: handleGridRowAction_heroui_app_table_grid_1794244658239_a050l },
    cellClickHandlerRef: { current: undefined },
    designerStoreRef: { current: designerStore },
  }), [designerStore, handleGridRowAction_heroui_app_table_grid_1794244658239_a050l]);
  const [gridQuery_heroui_app_table_grid_1794244658239_a050l, setGridQuery_heroui_app_table_grid_1794244658239_a050l] = React.useState<GridQueryState>(() => ({ ...EMPTY_GRID_QUERY, sort: { columnId: "title", direction: "asc" } }));
  const [gridPage_heroui_app_table_grid_1794244658239_a050l, setGridPage_heroui_app_table_grid_1794244658239_a050l] = React.useState(1);
  const [gridPageSize_heroui_app_table_grid_1794244658239_a050l, setGridPageSize_heroui_app_table_grid_1794244658239_a050l] = React.useState(50);
  const [gridListMode_heroui_app_table_grid_1794244658239_a050l, setGridListMode_heroui_app_table_grid_1794244658239_a050l] = React.useState<'paging' | 'infinite'>("paging");
  const [gridColumnLayout_heroui_app_table_grid_1794244658239_a050l, setGridColumnLayout_heroui_app_table_grid_1794244658239_a050l] = React.useState(() => createDefaultColumnLayout(gridColumns_heroui_app_table_grid_1794244658239_a050l));
  const [gridSearchInput_heroui_app_table_grid_1794244658239_a050l, setGridSearchInput_heroui_app_table_grid_1794244658239_a050l] = React.useState('');
  const [gridDebouncedSearch_heroui_app_table_grid_1794244658239_a050l, setGridDebouncedSearch_heroui_app_table_grid_1794244658239_a050l] = React.useState('');
  const [gridCheckboxSelections_heroui_app_table_grid_1794244658239_a050l, setGridCheckboxSelections_heroui_app_table_grid_1794244658239_a050l] = React.useState<Record<string, Record<string, boolean>>>({});
  const [gridRadioSelections_heroui_app_table_grid_1794244658239_a050l, setGridRadioSelections_heroui_app_table_grid_1794244658239_a050l] = React.useState<Record<string, string>>({});
  const [gridMatchLogic_heroui_app_table_grid_1794244658239_a050l, setGridMatchLogic_heroui_app_table_grid_1794244658239_a050l] = React.useState<Record<string, 'and' | 'or'>>({});
  const gridRoleFilters_heroui_app_table_grid_1794244658239_a050l = {};
  const gridFilteredRows_heroui_app_table_grid_1794244658239_a050l = React.useMemo(() => applyClientGridQuery(((Array.isArray(gridData_heroui_app_table_grid_1794244658239_a050l) ? gridData_heroui_app_table_grid_1794244658239_a050l : []) ?? []), gridQuery_heroui_app_table_grid_1794244658239_a050l, gridColumns_heroui_app_table_grid_1794244658239_a050l, "server"), [gridQuery_heroui_app_table_grid_1794244658239_a050l, gridColumns_heroui_app_table_grid_1794244658239_a050l]);
  const gridAggregatedRows_heroui_app_table_grid_1794244658239_a050l = gridFilteredRows_heroui_app_table_grid_1794244658239_a050l;
  const gridApiTotal_heroui_app_table_grid_1794244658239_a050l = React.useMemo(() => {
    const raw = raw_gridData_heroui_app_table_grid_1794244658239_a050l;
    const value = readNestedContextValue((raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}), "count");
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
  }, [raw_gridData_heroui_app_table_grid_1794244658239_a050l]);
  const gridTotalCount_heroui_app_table_grid_1794244658239_a050l = resolveDataGridTotalCount({ page: gridPage_heroui_app_table_grid_1794244658239_a050l, pageSize: gridPageSize_heroui_app_table_grid_1794244658239_a050l, total: gridApiTotal_heroui_app_table_grid_1794244658239_a050l, gridQueryMode: "server" }, gridAggregatedRows_heroui_app_table_grid_1794244658239_a050l.length);
  const gridPaging_heroui_app_table_grid_1794244658239_a050l = sliceDataGridRowsForDisplay(gridAggregatedRows_heroui_app_table_grid_1794244658239_a050l, gridPage_heroui_app_table_grid_1794244658239_a050l, gridPageSize_heroui_app_table_grid_1794244658239_a050l, gridTotalCount_heroui_app_table_grid_1794244658239_a050l, "server");
  const handleGridQueryChange_heroui_app_table_grid_1794244658239_a050l = React.useCallback((nextQuery: GridQueryState) => {
    setGridQuery_heroui_app_table_grid_1794244658239_a050l(nextQuery);
    setGridPage_heroui_app_table_grid_1794244658239_a050l(1);
    patchDesignerStore("gridQuery.sortBy", nextQuery.sort?.columnId ?? '');
    patchDesignerStore("gridQuery.sortDir", nextQuery.sort?.direction ?? '');
  }, [patchDesignerStore]);
  const handleGridPageChange_heroui_app_table_grid_1794244658239_a050l = React.useCallback((nextPage: number) => {
    setGridPage_heroui_app_table_grid_1794244658239_a050l(nextPage);
    patchDesignerStore("gridQuery.page", nextPage);
  }, [patchDesignerStore]);
  const handleGridPageSizeChange_heroui_app_table_grid_1794244658239_a050l = React.useCallback((nextSize: number) => {
    setGridPageSize_heroui_app_table_grid_1794244658239_a050l(nextSize);
    setGridPage_heroui_app_table_grid_1794244658239_a050l(1);
    patchDesignerStore("gridQuery.pageSize", nextSize);
  }, [patchDesignerStore]);
  const handleGridSortByChange_heroui_app_table_grid_1794244658239_a050l = React.useCallback((nextSortBy: string) => {
    setGridQuery_heroui_app_table_grid_1794244658239_a050l((current: GridQueryState) => ({ ...current, sort: nextSortBy ? { columnId: nextSortBy, direction: current.sort?.direction ?? 'asc' } : null }));
  }, []);
  const handleGridToggleSortDirection_heroui_app_table_grid_1794244658239_a050l = React.useCallback(() => {
    setGridQuery_heroui_app_table_grid_1794244658239_a050l((current: GridQueryState) => (current.sort ? { ...current, sort: { ...current.sort, direction: current.sort.direction === 'asc' ? 'desc' : 'asc' } } : current));
  }, []);
  const searchDebounceTimer_heroui_app_table_grid_1794244658239_a050l = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleGridSearchChange_heroui_app_table_grid_1794244658239_a050l = React.useCallback((nextValue: string) => {
    setGridSearchInput_heroui_app_table_grid_1794244658239_a050l(nextValue);
    if (searchDebounceTimer_heroui_app_table_grid_1794244658239_a050l.current) {
      clearTimeout(searchDebounceTimer_heroui_app_table_grid_1794244658239_a050l.current);
    }
    searchDebounceTimer_heroui_app_table_grid_1794244658239_a050l.current = setTimeout(() => {
      setGridDebouncedSearch_heroui_app_table_grid_1794244658239_a050l(nextValue);
      setGridPage_heroui_app_table_grid_1794244658239_a050l(1);
      patchDesignerStore("gridToolbar.search", nextValue);
    }, 300);
  }, [patchDesignerStore]);

  const dataContext: Record<string, unknown> | null = null;
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const handleonClick_node_c3fd1fc4_2699_4b83_a104_327db77fb087 = React.useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    let formData: FormData;
    const form = event.currentTarget instanceof HTMLFormElement ? event.currentTarget : event.currentTarget.closest('form');
    if (form) {
      formData = new FormData(form);
    } else {
      const regionRoot = document.querySelector("[data-designer-node-id=\"node-6b68e7f8-33d6-4c67-984c-acb818e1f65e\"]");
      if (!regionRoot) {
        return;
      }
      formData = collectRegionFormDataFromContainer(regionRoot, ["node-050d7d58-1b21-4434-aa23-a32d05a177c7","node-8f79b4c8-a1be-4892-a90b-0dbc8c170889","node-b64a06f4-cbb0-4425-8977-fb80c726c021","node-f1b48ebd-65ee-403d-9fdc-2de53beab9fc","node-9b5e6fbf-1332-45ae-a810-2b9fbc9af8f8","node-184e38d4-28d3-45df-a5e2-63ec73020206"]);
    }
    const fieldValidationEntries = [{"nodeId":"node-050d7d58-1b21-4434-aa23-a32d05a177c7","formFieldName":"node-050d7d58-1b21-4434-aa23-a32d05a177c7","props":{"_designerPaletteItemId":"heroui.input-text","isRequired":true}}] as Array<{ nodeId: string; formFieldName: string; props: Record<string, unknown> }>;
    const fieldValidationErrors: Record<string, string> = {};
    for (const entry of fieldValidationEntries) {
      const rawValue = formData.get(entry.formFieldName);
      const validationMessage = validateDesignerFieldNode(entry.props, typeof rawValue === 'string' ? rawValue : '');
      if (validationMessage) {
        fieldValidationErrors[entry.nodeId] = validationMessage;
      }
    }
    if (Object.keys(fieldValidationErrors).length > 0) {
      toast(Object.values(fieldValidationErrors).join(' '), { variant: 'danger' });
      return;
    }
    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {};
      payload["title"] = formData.get("node-050d7d58-1b21-4434-aa23-a32d05a177c7") ?? '';
      payload["statusCode"] = formData.get("node-8f79b4c8-a1be-4892-a90b-0dbc8c170889") ?? '';
      payload["legacyCode"] = formData.get("node-b64a06f4-cbb0-4425-8977-fb80c726c021") ?? '';
      payload["startsAt"] = formData.get("node-f1b48ebd-65ee-403d-9fdc-2de53beab9fc") ?? '';
      payload["endsAt"] = formData.get("node-9b5e6fbf-1332-45ae-a810-2b9fbc9af8f8") ?? '';
      payload["operatorNote"] = formData.get("node-184e38d4-28d3-45df-a5e2-63ec73020206") ?? '';
      const method = regionData_voteElectionsList_node_6b68e7f8_33d6_4c67_984c_acb818e1f65e?.id != null && String(regionData_voteElectionsList_node_6b68e7f8_33d6_4c67_984c_acb818e1f65e?.id).length > 0 ? "PUT" : 'POST';
      const url = (regionData_voteElectionsList_node_6b68e7f8_33d6_4c67_984c_acb818e1f65e?.id != null && String(regionData_voteElectionsList_node_6b68e7f8_33d6_4c67_984c_acb818e1f65e?.id).length > 0 ? (regionData_voteElectionsList_node_6b68e7f8_33d6_4c67_984c_acb818e1f65e?.id != null && String(regionData_voteElectionsList_node_6b68e7f8_33d6_4c67_984c_acb818e1f65e?.id).length > 0 ? ("/api/voting/elections/" + encodeURIComponent(String(regionData_voteElectionsList_node_6b68e7f8_33d6_4c67_984c_acb818e1f65e?.id)) + "") : "/api/voting/elections/:id") : "/api/voting/elections");
      const response = await designerFetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response));
      }
      patchDesignerStore("ui.visibility.node-8dc97fda-3194-4550-a03d-a6ad27355735", false);
      toast("Saved successfully", { variant: "success", timeout: 4000 });
      await refresh_gridData_heroui_app_table_grid_1794244658239_a050l();
      (document.querySelector("[data-designer-node-id=\"node-6b68e7f8-33d6-4c67-984c-acb818e1f65e\"]") as HTMLFormElement | null)?.reset?.();
    } catch (mutationFailure) {
      toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' });
    }
    finally {
      setIsSubmitting(false);
    }
  }, [regionData_voteElectionsList_node_6b68e7f8_33d6_4c67_984c_acb818e1f65e]);
  const handleonClick_node_2aa5010c_f614_4362_8d27_fe317351097a = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-8dc97fda-3194-4550-a03d-a6ad27355735", false);
  }, [patchDesignerStore]);
  const handleonClick_node_d371bf32_35dd_4454_8603_4f899f3762e1 = React.useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    let formData: FormData;
    const form = event.currentTarget instanceof HTMLFormElement ? event.currentTarget : event.currentTarget.closest('form');
    if (form) {
      formData = new FormData(form);
    } else {
      const regionRoot = document.querySelector("[data-designer-node-id=\"node-31cfa941-2f33-4038-b5fb-52b5141a187c\"]");
      if (!regionRoot) {
        return;
      }
      formData = collectRegionFormDataFromContainer(regionRoot, ["node-35146461-ff99-47f3-b624-fff638aaf3ee","node-3b1f020d-f466-4a0e-99ea-a0292b1eb6de","node-f60f84f8-6a69-48e1-8340-001158b5b2ed","node-2c542610-3b28-4a6e-9fea-08c1123490e8","node-a683d1d0-f8e0-4c65-992a-8aa1ccaf94f4","node-63c1c70c-2c9c-4b22-bef2-83e0623d5374"]);
    }
    const fieldValidationEntries = [{"nodeId":"node-35146461-ff99-47f3-b624-fff638aaf3ee","formFieldName":"node-35146461-ff99-47f3-b624-fff638aaf3ee","props":{"_designerPaletteItemId":"heroui.input-text","isRequired":true}}] as Array<{ nodeId: string; formFieldName: string; props: Record<string, unknown> }>;
    const fieldValidationErrors: Record<string, string> = {};
    for (const entry of fieldValidationEntries) {
      const rawValue = formData.get(entry.formFieldName);
      const validationMessage = validateDesignerFieldNode(entry.props, typeof rawValue === 'string' ? rawValue : '');
      if (validationMessage) {
        fieldValidationErrors[entry.nodeId] = validationMessage;
      }
    }
    if (Object.keys(fieldValidationErrors).length > 0) {
      toast(Object.values(fieldValidationErrors).join(' '), { variant: 'danger' });
      return;
    }
    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {};
      payload["title"] = formData.get("node-35146461-ff99-47f3-b624-fff638aaf3ee") ?? '';
      payload["statusCode"] = formData.get("node-3b1f020d-f466-4a0e-99ea-a0292b1eb6de") ?? '';
      payload["legacyCode"] = formData.get("node-f60f84f8-6a69-48e1-8340-001158b5b2ed") ?? '';
      payload["startsAt"] = formData.get("node-2c542610-3b28-4a6e-9fea-08c1123490e8") ?? '';
      payload["endsAt"] = formData.get("node-a683d1d0-f8e0-4c65-992a-8aa1ccaf94f4") ?? '';
      payload["operatorNote"] = formData.get("node-63c1c70c-2c9c-4b22-bef2-83e0623d5374") ?? '';
      const method = regionData_voteElectionsList_node_31cfa941_2f33_4038_b5fb_52b5141a187c?.id != null && String(regionData_voteElectionsList_node_31cfa941_2f33_4038_b5fb_52b5141a187c?.id).length > 0 ? "PUT" : 'POST';
      const url = (regionData_voteElectionsList_node_31cfa941_2f33_4038_b5fb_52b5141a187c?.id != null && String(regionData_voteElectionsList_node_31cfa941_2f33_4038_b5fb_52b5141a187c?.id).length > 0 ? (regionData_voteElectionsList_node_31cfa941_2f33_4038_b5fb_52b5141a187c?.id != null && String(regionData_voteElectionsList_node_31cfa941_2f33_4038_b5fb_52b5141a187c?.id).length > 0 ? ("/api/voting/elections/" + encodeURIComponent(String(regionData_voteElectionsList_node_31cfa941_2f33_4038_b5fb_52b5141a187c?.id)) + "") : "/api/voting/elections/:id") : "/api/voting/elections");
      const response = await designerFetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response));
      }
      patchDesignerStore("ui.visibility.node-a35cf43f-756f-41f1-9dd8-181832bb1e07", false);
      toast("Saved successfully", { variant: "success", timeout: 4000 });
      await refresh_gridData_heroui_app_table_grid_1794244658239_a050l();
    } catch (mutationFailure) {
      toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' });
    }
    finally {
      setIsSubmitting(false);
    }
  }, [regionData_voteElectionsList_node_31cfa941_2f33_4038_b5fb_52b5141a187c]);
  const handleonClick_node_02538aa8_f5a5_4adc_8837_47b885668976 = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-a35cf43f-756f-41f1-9dd8-181832bb1e07", false);
  }, [patchDesignerStore]);
  const handleonClick_node_f7a80788_dc54_4a2d_9662_f4eceb069b95 = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-eb7b6f3a-6c48-4db9-8940-9162d908f650", false);
  }, [patchDesignerStore]);
  const handleonClick_node_0593b734_753c_4f01_ba30_38d48ade18d3 = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    void (async () => {
      let mutationOk_da_mw9ixyrt_e6i3i = true;
      try {
        const response = await designerFetch(("/api/voting/elections/" + encodeURIComponent(String(designerStore?.selection?.id)) + ""), {
          method: "DELETE",
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) {
          toast(await parseApiErrorMessage(response), { variant: 'danger' });
          mutationOk_da_mw9ixyrt_e6i3i = false;
        }
      } catch (mutationFailure) {
        toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' });
        mutationOk_da_mw9ixyrt_e6i3i = false;
      }
      if (mutationOk_da_mw9ixyrt_e6i3i) {
        await refresh_gridData_heroui_app_table_grid_1794244658239_a050l();
        toast("Deleted", { variant: "success", timeout: 4000 });
        patchDesignerStore("ui.visibility.node-eb7b6f3a-6c48-4db9-8940-9162d908f650", false);
      }
    })();
  }, [patchDesignerStore, refresh_gridData_heroui_app_table_grid_1794244658239_a050l]);
  return (
    <>
      <Toast.Provider />
      <div className="h-full min-h-0 w-full min-w-0 space-y-3">
        <ListPageShell className="flex min-h-0 w-full flex-1 flex-col"><ListPageToolbarFrame><div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}><input type="text" value={gridSearchInput_heroui_app_table_grid_1794244658239_a050l} onChange={(event) => handleGridSearchChange_heroui_app_table_grid_1794244658239_a050l(event.target.value)} placeholder={"Search elections…"} className="h-8 rounded-md border border-slate-200 px-2 text-sm" /></div><div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}><span className="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold tabular-nums text-slate-700" aria-live="polite">{gridTotalCount_heroui_app_table_grid_1794244658239_a050l.toLocaleString()}</span><button type="button" onClick={() => { void refresh_gridData_heroui_app_table_grid_1794244658239_a050l(); }} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">Refresh</button></div></ListPageToolbarFrame><AppTableGrid className="flex !h-full !min-h-0 !w-full flex-1 flex-col" showPagingFooter presentation="auto" cardBelow="tablet" size="sm" columns={gridColumns_heroui_app_table_grid_1794244658239_a050l} rows={gridPaging_heroui_app_table_grid_1794244658239_a050l.displayRows} getRowKey={(row) => String((row as Record<string, unknown>)["id"] ?? '')} enableColumnLayout={false} columnLayout={gridColumnLayout_heroui_app_table_grid_1794244658239_a050l} onColumnLayoutChange={setGridColumnLayout_heroui_app_table_grid_1794244658239_a050l} isLoading={isLoading_gridData_heroui_app_table_grid_1794244658239_a050l} loadingMessage={"Loading elections…"} emptyMessage={"No elections found."} isEmpty={gridAggregatedRows_heroui_app_table_grid_1794244658239_a050l.length === 0} errorContent={(error_gridData_heroui_app_table_grid_1794244658239_a050l ? "Could not load elections." : undefined)} gridQueryMode={"server"} query={gridQuery_heroui_app_table_grid_1794244658239_a050l} onQueryChange={handleGridQueryChange_heroui_app_table_grid_1794244658239_a050l} onGridRowAction={handleGridRowAction_heroui_app_table_grid_1794244658239_a050l} footer={<GridPagingFooter totalCount={gridTotalCount_heroui_app_table_grid_1794244658239_a050l} safePage={gridPaging_heroui_app_table_grid_1794244658239_a050l.safePage} pageSize={gridPageSize_heroui_app_table_grid_1794244658239_a050l} onPageSizeChange={handleGridPageSizeChange_heroui_app_table_grid_1794244658239_a050l} sortBy={gridQuery_heroui_app_table_grid_1794244658239_a050l.sort?.columnId ?? ''} sortOptions={[{"value":"title","label":"Title"},{"value":"legacyCode","label":"Legacy code"},{"value":"startsAt","label":"Starts"},{"value":"endsAt","label":"Ends"},{"value":"updatedAt","label":"Updated"}]} onSortByChange={handleGridSortByChange_heroui_app_table_grid_1794244658239_a050l} sortDirection={gridQuery_heroui_app_table_grid_1794244658239_a050l.sort?.direction ?? 'asc'} onToggleSortDirection={handleGridToggleSortDirection_heroui_app_table_grid_1794244658239_a050l} showSortControls={true} totalPages={gridPaging_heroui_app_table_grid_1794244658239_a050l.totalPages} pageNumbers={buildDataGridPageNumbers(gridPaging_heroui_app_table_grid_1794244658239_a050l.safePage, gridPaging_heroui_app_table_grid_1794244658239_a050l.totalPages)} onPageChange={handleGridPageChange_heroui_app_table_grid_1794244658239_a050l} visibleInfiniteCount={gridListMode_heroui_app_table_grid_1794244658239_a050l === 'infinite' ? gridPaging_heroui_app_table_grid_1794244658239_a050l.displayRows.length : undefined} />} /></ListPageShell>
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "(store.ui.visibility.node-8dc97fda-3194-4550-a03d-a6ad27355735 === true) && (store.ui.visibility.node-8dc97fda-3194-4550-a03d-a6ad27355735 !== false)") && (
          <CreateEditModalShell title={"Create election"} size="lg" onClose={() => { patchDesignerStore("ui.visibility.node-8dc97fda-3194-4550-a03d-a6ad27355735", false); }} onBackdropClick={() => { patchDesignerStore("ui.visibility.node-8dc97fda-3194-4550-a03d-a6ad27355735", false); }} gradient={false} bodyOuterClassName="-mb-[15px]" bodyClassName="!p-0" footerClassName="!mt-0">
            <form className="flex !min-h-0 flex-col gap-0 bg-white" method="post" id="node-6b68e7f8-33d6-4c67-984c-acb818e1f65e" data-designer-node-id="node-6b68e7f8-33d6-4c67-984c-acb818e1f65e">
              <div className="flex !min-w-0 flex-col gap-2 bg-white p-[15px]">
                <UiInput isRequired type="text" placeholder="Title" label="Title" aria-label="Title" size="sm" data-page-guide="" data-page-guide-title="Title" data-page-guide-hint="Required. Enter title." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_voteElectionsList_node_6b68e7f8_33d6_4c67_984c_acb818e1f65e?.title} name="node-050d7d58-1b21-4434-aa23-a32d05a177c7" />
                <UiInput type="text" placeholder="Status (Base Info id)" label="Status (Base Info id)" aria-label="Status (Base Info id)" size="sm" data-page-guide="" data-page-guide-title="Status (Base Info id)" data-page-guide-hint="Enter status (Base Info id)." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_voteElectionsList_node_6b68e7f8_33d6_4c67_984c_acb818e1f65e?.statusCode} name="node-8f79b4c8-a1be-4892-a90b-0dbc8c170889" />
                <UiInput type="text" placeholder="Legacy code" label="Legacy code" aria-label="Legacy code" size="sm" data-page-guide="" data-page-guide-title="Legacy code" data-page-guide-hint="Enter legacy code." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_voteElectionsList_node_6b68e7f8_33d6_4c67_984c_acb818e1f65e?.legacyCode} name="node-b64a06f4-cbb0-4425-8977-fb80c726c021" />
                <UiInput type="text" placeholder="Starts at (ISO)" label="Starts at (ISO)" aria-label="Starts at (ISO)" size="sm" data-page-guide="" data-page-guide-title="Starts at (ISO)" data-page-guide-hint="Enter starts at (ISO)." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_voteElectionsList_node_6b68e7f8_33d6_4c67_984c_acb818e1f65e?.startsAt} name="node-f1b48ebd-65ee-403d-9fdc-2de53beab9fc" />
                <UiInput type="text" placeholder="Ends at (ISO)" label="Ends at (ISO)" aria-label="Ends at (ISO)" size="sm" data-page-guide="" data-page-guide-title="Ends at (ISO)" data-page-guide-hint="Enter ends at (ISO)." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_voteElectionsList_node_6b68e7f8_33d6_4c67_984c_acb818e1f65e?.endsAt} name="node-9b5e6fbf-1332-45ae-a810-2b9fbc9af8f8" />
                <InputTextarea data-page-guide="" data-page-guide-title="Operator note" data-page-guide-hint="Enter operator note." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_voteElectionsList_node_6b68e7f8_33d6_4c67_984c_acb818e1f65e?.operatorNote} name="node-184e38d4-28d3-45df-a5e2-63ec73020206" />
              </div>
            </form>
            <div className="flex !w-full shrink-0 !items-center !justify-end gap-2">
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 border border-slate-200 text-slate-600 hover:bg-slate-100" variant="outline" size="md" onClick={handleonClick_node_2aa5010c_f614_4362_8d27_fe317351097a}><X className="h-3.5 w-3.5" /> Cancel</Button>
              <Button type="submit" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 bg-primary-600 hover:bg-primary-700 text-white" form="node-6b68e7f8-33d6-4c67-984c-acb818e1f65e" variant="primary" size="md" href="#" target="_self" isDisabled={isSubmitting} onClick={handleonClick_node_c3fd1fc4_2699_4b83_a104_327db77fb087}><Plus className="h-3.5 w-3.5" /> Create election</Button>
            </div>
          </CreateEditModalShell>
        )}
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "(store.ui.visibility.node-a35cf43f-756f-41f1-9dd8-181832bb1e07 === true) && (store.ui.visibility.node-a35cf43f-756f-41f1-9dd8-181832bb1e07 !== false)") && (
          <CreateEditModalShell title={"Edit election"} size="lg" onClose={() => { patchDesignerStore("ui.visibility.node-a35cf43f-756f-41f1-9dd8-181832bb1e07", false); }} onBackdropClick={() => { patchDesignerStore("ui.visibility.node-a35cf43f-756f-41f1-9dd8-181832bb1e07", false); }} gradient={false} bodyOuterClassName="-mb-[15px]" bodyClassName="!p-0" footerClassName="!mt-0">
            <form className="flex !min-h-0 flex-col gap-0 bg-white" method="post" id="node-31cfa941-2f33-4038-b5fb-52b5141a187c" data-designer-node-id="node-31cfa941-2f33-4038-b5fb-52b5141a187c">
              <div className="flex !min-w-0 flex-col gap-2 bg-white p-[15px]">
                <UiInput isRequired type="text" placeholder="Title" label="Title" aria-label="Title" size="sm" data-page-guide="" data-page-guide-title="Title" data-page-guide-hint="Required. Enter title." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_voteElectionsList_node_31cfa941_2f33_4038_b5fb_52b5141a187c?.title} name="node-35146461-ff99-47f3-b624-fff638aaf3ee" />
                <UiInput type="text" placeholder="Status (Base Info id)" label="Status (Base Info id)" aria-label="Status (Base Info id)" size="sm" data-page-guide="" data-page-guide-title="Status (Base Info id)" data-page-guide-hint="Enter status (Base Info id)." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_voteElectionsList_node_31cfa941_2f33_4038_b5fb_52b5141a187c?.statusCode} name="node-3b1f020d-f466-4a0e-99ea-a0292b1eb6de" />
                <UiInput type="text" placeholder="Legacy code" label="Legacy code" aria-label="Legacy code" size="sm" data-page-guide="" data-page-guide-title="Legacy code" data-page-guide-hint="Enter legacy code." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_voteElectionsList_node_31cfa941_2f33_4038_b5fb_52b5141a187c?.legacyCode} name="node-f60f84f8-6a69-48e1-8340-001158b5b2ed" />
                <UiInput type="text" placeholder="Starts at (ISO)" label="Starts at (ISO)" aria-label="Starts at (ISO)" size="sm" data-page-guide="" data-page-guide-title="Starts at (ISO)" data-page-guide-hint="Enter starts at (ISO)." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_voteElectionsList_node_31cfa941_2f33_4038_b5fb_52b5141a187c?.startsAt} name="node-2c542610-3b28-4a6e-9fea-08c1123490e8" />
                <UiInput type="text" placeholder="Ends at (ISO)" label="Ends at (ISO)" aria-label="Ends at (ISO)" size="sm" data-page-guide="" data-page-guide-title="Ends at (ISO)" data-page-guide-hint="Enter ends at (ISO)." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_voteElectionsList_node_31cfa941_2f33_4038_b5fb_52b5141a187c?.endsAt} name="node-a683d1d0-f8e0-4c65-992a-8aa1ccaf94f4" />
                <InputTextarea data-page-guide="" data-page-guide-title="Operator note" data-page-guide-hint="Enter operator note." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_voteElectionsList_node_31cfa941_2f33_4038_b5fb_52b5141a187c?.operatorNote} name="node-63c1c70c-2c9c-4b22-bef2-83e0623d5374" />
              </div>
            </form>
            <div className="flex !w-full shrink-0 !items-center !justify-end gap-2">
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 border border-slate-200 text-slate-600 hover:bg-slate-100" variant="outline" size="md" onClick={handleonClick_node_02538aa8_f5a5_4adc_8837_47b885668976}><X className="h-3.5 w-3.5" /> Cancel</Button>
              <Button type="submit" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 bg-primary-600 hover:bg-primary-700 text-white" form="node-31cfa941-2f33-4038-b5fb-52b5141a187c" variant="primary" size="md" href="#" target="_self" isDisabled={isSubmitting} onClick={handleonClick_node_d371bf32_35dd_4454_8603_4f899f3762e1}><Save className="h-3.5 w-3.5" /> Save</Button>
            </div>
          </CreateEditModalShell>
        )}
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "(store.ui.visibility.node-eb7b6f3a-6c48-4db9-8940-9162d908f650 === true) && (store.ui.visibility.node-eb7b6f3a-6c48-4db9-8940-9162d908f650 !== false)") && (
          <ConfirmDialogShell title={"Delete election?"} size="sm" onClose={() => { patchDesignerStore("ui.visibility.node-eb7b6f3a-6c48-4db9-8940-9162d908f650", false); }} onBackdropClick={() => { patchDesignerStore("ui.visibility.node-eb7b6f3a-6c48-4db9-8940-9162d908f650", false); }} tone="danger" hideCancel hideConfirm icon={<Trash2 className="h-4 w-4" />} bodyClassName="!p-0" footerClassName="!mt-0">
            <p className="block p-[15px] !text-sm text-slate-700">Delete this election? This cannot be undone.</p>
            <div className="flex !w-full shrink-0 !items-center !justify-end gap-2">
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 border border-slate-200 text-slate-600 hover:bg-slate-100" variant="outline" size="md" onClick={handleonClick_node_f7a80788_dc54_4a2d_9662_f4eceb069b95}><X className="h-3.5 w-3.5" /> Cancel</Button>
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 bg-rose-600 hover:bg-rose-700 text-white" variant="primary" size="md" onClick={handleonClick_node_0593b734_753c_4f01_ba30_38d48ade18d3}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
            </div>
          </ConfirmDialogShell>
        )}
      </div>
    </>
  );
};
