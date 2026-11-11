import React from 'react';
import { buildAppTableGridColumns } from '@/domain/component-designer/DesignerRuntimeAppTableGrid';
import { applyClientGridQuery, EMPTY_GRID_QUERY, type GridQueryState } from '@/shared/lib/appTableGridQuery';
import { resolveDataGridTotalCount, sliceDataGridRowsForDisplay, buildDataGridPageNumbers, applyGridAggregation } from '@/domain/component-designer/designerDataGridRuntime';
import { applyDesignerGridToolbarClientFilters } from '@/domain/component-designer/designerGridToolbarConfig';
import { createDefaultColumnLayout } from '@/shared/lib/appTableGridColumnLayout';
import { validateDesignerFieldNode } from '@/domain/component-designer/previewFieldValidation';
import { AppTableGrid, ConfirmDialogShell, CreateEditModalShell, GridPagingFooter, ListPageShell, ListPageToolbarFrame, PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS, PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS, ToolbarFilterSelect, UiCheckbox } from '@/shared/ui';
import { UiInput } from '@/shared/ui/HeroFieldControls';
import { Button, Switch, Toast, toast } from '@heroui/react';
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
  const { data: raw_regionData_hwymemberlistdefsList_node_8683b237_5d85_42e6_9c73_1521041ac1e1, isLoading: isLoading_regionData_hwymemberlistdefsList_node_8683b237_5d85_42e6_9c73_1521041ac1e1, error: error_regionData_hwymemberlistdefsList_node_8683b237_5d85_42e6_9c73_1521041ac1e1, refresh: refresh_regionData_hwymemberlistdefsList_node_8683b237_5d85_42e6_9c73_1521041ac1e1 } = useDataFetch<unknown>(resolveBindingUrl("/api/hwy/member-list-defs/:id", designerStore, { "id": "selection.id" }), {});
  const regionData_hwymemberlistdefsList_node_8683b237_5d85_42e6_9c73_1521041ac1e1 = React.useMemo(() => coerceApiRecordValue(applyResponseDataPath(raw_regionData_hwymemberlistdefsList_node_8683b237_5d85_42e6_9c73_1521041ac1e1, {"dataPath":"data","arrayPath":"data","totalPath":"count"})), [raw_regionData_hwymemberlistdefsList_node_8683b237_5d85_42e6_9c73_1521041ac1e1]);
  const handleGridRowAction_heroui_app_table_grid_1793645605494_h0y9c = React.useCallback((row: Record<string, unknown>, actionId: string) => {
    switch (actionId) {
      case "edit": {
        patchDesignerStore("selection.id", row["id"] ?? null);
        patchDesignerStore("ui.visibility.node-39f38a81-3d6d-48fc-b825-70740ee19c3e", true);
        return;
      }
      case "delete": {
        patchDesignerStore("selection.id", row["id"] ?? null);
        patchDesignerStore("ui.visibility.node-50f2b3b4-c8f2-4a56-acd3-ba0077bda913", true);
        return;
      }
      default:
        return;
    }
  }, [patchDesignerStore]);
  const { data: raw_gridData_heroui_app_table_grid_1793645605494_h0y9c, isLoading: isLoading_gridData_heroui_app_table_grid_1793645605494_h0y9c, error: error_gridData_heroui_app_table_grid_1793645605494_h0y9c, refresh: refresh_gridData_heroui_app_table_grid_1793645605494_h0y9c } = useDataFetch<unknown>(resolveBindingUrl("/api/hwy/member-list-defs", designerStore, { "search": "gridToolbar.search", "sortBy": "gridQuery.sortBy", "sortDir": "gridQuery.sortDir", "page": "gridQuery.page", "pageSize": "gridQuery.pageSize", "includeCount": "static:page1Only", "where": "gridToolbar.listWhere" }), {});
  const gridData_heroui_app_table_grid_1793645605494_h0y9c = React.useMemo(() => applyResponseDataPath(raw_gridData_heroui_app_table_grid_1793645605494_h0y9c, {"dataPath":"data","arrayPath":"data","totalPath":"count"}), [raw_gridData_heroui_app_table_grid_1793645605494_h0y9c]);
  const gridColumns_heroui_app_table_grid_1793645605494_h0y9c = React.useMemo(() => buildAppTableGridColumns([{"key":"code","label":"Code","sort":true,"cardRole":"title"},{"key":"titleAr","label":"Title","sort":true,"cardRole":"subtitle"},{"key":"listLogicCode","label":"Logic","sort":true,"cardRole":"meta"},{"key":"predicateRef","label":"Predicate ref","sort":true,"cardRole":"meta"},{"key":"isActive","label":"Active","sort":true,"cellKind":"boolean-icon","cardRole":"hidden"},{"key":"sortOrder","label":"Order","sort":true,"cardRole":"hidden"},{"key":"actions","label":"","kind":"action-group","actions":[{"actionId":"edit","icon":"Pencil","intent":"edit","tooltip":"Edit","behavior":{"kind":"open-modal","modalNodeId":"node-39f38a81-3d6d-48fc-b825-70740ee19c3e","primaryKeyField":"id","selectionStorePath":"selection.id"}},{"actionId":"delete","icon":"Trash2","intent":"delete","tooltip":"Delete","behavior":{"kind":"open-modal","modalNodeId":"node-50f2b3b4-c8f2-4a56-acd3-ba0077bda913","primaryKeyField":"id","selectionStorePath":"selection.id"}}],"maxVisibleActions":3,"cardRole":"actions","layoutHideable":false,"layoutResizable":false,"layoutReorderable":false,"layoutPinned":"right","width":"57px"}], "server", {
    mode: 'runtime',
    detailFlowRef: { current: null },
    rowActionHandlerRef: { current: handleGridRowAction_heroui_app_table_grid_1793645605494_h0y9c },
    cellClickHandlerRef: { current: undefined },
    designerStoreRef: { current: designerStore },
  }), [designerStore, handleGridRowAction_heroui_app_table_grid_1793645605494_h0y9c]);
  const [gridQuery_heroui_app_table_grid_1793645605494_h0y9c, setGridQuery_heroui_app_table_grid_1793645605494_h0y9c] = React.useState<GridQueryState>(() => ({ ...EMPTY_GRID_QUERY, sort: { columnId: "sortOrder", direction: "asc" } }));
  const [gridPage_heroui_app_table_grid_1793645605494_h0y9c, setGridPage_heroui_app_table_grid_1793645605494_h0y9c] = React.useState(1);
  const [gridPageSize_heroui_app_table_grid_1793645605494_h0y9c, setGridPageSize_heroui_app_table_grid_1793645605494_h0y9c] = React.useState(50);
  const [gridListMode_heroui_app_table_grid_1793645605494_h0y9c, setGridListMode_heroui_app_table_grid_1793645605494_h0y9c] = React.useState<'paging' | 'infinite'>("paging");
  const [gridColumnLayout_heroui_app_table_grid_1793645605494_h0y9c, setGridColumnLayout_heroui_app_table_grid_1793645605494_h0y9c] = React.useState(() => createDefaultColumnLayout(gridColumns_heroui_app_table_grid_1793645605494_h0y9c));
  const [gridSearchInput_heroui_app_table_grid_1793645605494_h0y9c, setGridSearchInput_heroui_app_table_grid_1793645605494_h0y9c] = React.useState('');
  const [gridDebouncedSearch_heroui_app_table_grid_1793645605494_h0y9c, setGridDebouncedSearch_heroui_app_table_grid_1793645605494_h0y9c] = React.useState('');
  const [gridCheckboxSelections_heroui_app_table_grid_1793645605494_h0y9c, setGridCheckboxSelections_heroui_app_table_grid_1793645605494_h0y9c] = React.useState<Record<string, Record<string, boolean>>>({});
  const [gridRadioSelections_heroui_app_table_grid_1793645605494_h0y9c, setGridRadioSelections_heroui_app_table_grid_1793645605494_h0y9c] = React.useState<Record<string, string>>({});
  const [gridMatchLogic_heroui_app_table_grid_1793645605494_h0y9c, setGridMatchLogic_heroui_app_table_grid_1793645605494_h0y9c] = React.useState<Record<string, 'and' | 'or'>>({});
  const gridRoleFilters_heroui_app_table_grid_1793645605494_h0y9c = {};
  const gridFilteredRows_heroui_app_table_grid_1793645605494_h0y9c = React.useMemo(() => applyClientGridQuery(((Array.isArray(gridData_heroui_app_table_grid_1793645605494_h0y9c) ? gridData_heroui_app_table_grid_1793645605494_h0y9c : []) ?? []), gridQuery_heroui_app_table_grid_1793645605494_h0y9c, gridColumns_heroui_app_table_grid_1793645605494_h0y9c, "server"), [gridQuery_heroui_app_table_grid_1793645605494_h0y9c, gridColumns_heroui_app_table_grid_1793645605494_h0y9c]);
  const gridAggregatedRows_heroui_app_table_grid_1793645605494_h0y9c = gridFilteredRows_heroui_app_table_grid_1793645605494_h0y9c;
  const gridApiTotal_heroui_app_table_grid_1793645605494_h0y9c = React.useMemo(() => {
    const raw = raw_gridData_heroui_app_table_grid_1793645605494_h0y9c;
    const value = readNestedContextValue((raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}), "count");
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
  }, [raw_gridData_heroui_app_table_grid_1793645605494_h0y9c]);
  const gridTotalCount_heroui_app_table_grid_1793645605494_h0y9c = resolveDataGridTotalCount({ page: gridPage_heroui_app_table_grid_1793645605494_h0y9c, pageSize: gridPageSize_heroui_app_table_grid_1793645605494_h0y9c, total: gridApiTotal_heroui_app_table_grid_1793645605494_h0y9c, gridQueryMode: "server" }, gridAggregatedRows_heroui_app_table_grid_1793645605494_h0y9c.length);
  const gridPaging_heroui_app_table_grid_1793645605494_h0y9c = sliceDataGridRowsForDisplay(gridAggregatedRows_heroui_app_table_grid_1793645605494_h0y9c, gridPage_heroui_app_table_grid_1793645605494_h0y9c, gridPageSize_heroui_app_table_grid_1793645605494_h0y9c, gridTotalCount_heroui_app_table_grid_1793645605494_h0y9c, "server");
  const handleGridQueryChange_heroui_app_table_grid_1793645605494_h0y9c = React.useCallback((nextQuery: GridQueryState) => {
    setGridQuery_heroui_app_table_grid_1793645605494_h0y9c(nextQuery);
    setGridPage_heroui_app_table_grid_1793645605494_h0y9c(1);
    patchDesignerStore("gridQuery.sortBy", nextQuery.sort?.columnId ?? '');
    patchDesignerStore("gridQuery.sortDir", nextQuery.sort?.direction ?? '');
  }, [patchDesignerStore]);
  const handleGridPageChange_heroui_app_table_grid_1793645605494_h0y9c = React.useCallback((nextPage: number) => {
    setGridPage_heroui_app_table_grid_1793645605494_h0y9c(nextPage);
    patchDesignerStore("gridQuery.page", nextPage);
  }, [patchDesignerStore]);
  const handleGridPageSizeChange_heroui_app_table_grid_1793645605494_h0y9c = React.useCallback((nextSize: number) => {
    setGridPageSize_heroui_app_table_grid_1793645605494_h0y9c(nextSize);
    setGridPage_heroui_app_table_grid_1793645605494_h0y9c(1);
    patchDesignerStore("gridQuery.pageSize", nextSize);
  }, [patchDesignerStore]);
  const handleGridSortByChange_heroui_app_table_grid_1793645605494_h0y9c = React.useCallback((nextSortBy: string) => {
    setGridQuery_heroui_app_table_grid_1793645605494_h0y9c((current: GridQueryState) => ({ ...current, sort: nextSortBy ? { columnId: nextSortBy, direction: current.sort?.direction ?? 'asc' } : null }));
  }, []);
  const handleGridToggleSortDirection_heroui_app_table_grid_1793645605494_h0y9c = React.useCallback(() => {
    setGridQuery_heroui_app_table_grid_1793645605494_h0y9c((current: GridQueryState) => (current.sort ? { ...current, sort: { ...current.sort, direction: current.sort.direction === 'asc' ? 'desc' : 'asc' } } : current));
  }, []);
  const searchDebounceTimer_heroui_app_table_grid_1793645605494_h0y9c = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleGridSearchChange_heroui_app_table_grid_1793645605494_h0y9c = React.useCallback((nextValue: string) => {
    setGridSearchInput_heroui_app_table_grid_1793645605494_h0y9c(nextValue);
    if (searchDebounceTimer_heroui_app_table_grid_1793645605494_h0y9c.current) {
      clearTimeout(searchDebounceTimer_heroui_app_table_grid_1793645605494_h0y9c.current);
    }
    searchDebounceTimer_heroui_app_table_grid_1793645605494_h0y9c.current = setTimeout(() => {
      setGridDebouncedSearch_heroui_app_table_grid_1793645605494_h0y9c(nextValue);
      setGridPage_heroui_app_table_grid_1793645605494_h0y9c(1);
      patchDesignerStore("gridToolbar.search", nextValue);
    }, 300);
  }, [patchDesignerStore]);

  const dataContext: Record<string, unknown> | null = null;
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const handleonClick_node_7104434e_d2fe_48b1_a972_9ef480cc33e4 = React.useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    let formData: FormData;
    const form = event.currentTarget instanceof HTMLFormElement ? event.currentTarget : event.currentTarget.closest('form');
    if (form) {
      formData = new FormData(form);
    } else {
      const regionRoot = document.querySelector("[data-designer-node-id=\"node-f33fd182-0116-454d-82a3-37e43c72a4bc\"]");
      if (!regionRoot) {
        return;
      }
      formData = collectRegionFormDataFromContainer(regionRoot, ["node-69356dfe-e50d-489b-b83e-bea81eb40824","node-663c6804-953d-4bc6-9f58-635393ad9b66","node-bb64f4bd-13bc-444e-9024-19add485a26c","node-c284084e-99be-43b2-aadc-2edb133985fa","node-39976218-7555-4ff1-b3c9-4e1def6629c7","node-bcd6009c-8105-4f39-8caf-181dbab8fa31","node-c7924e92-9a0e-4571-a0d4-de09b5271c20","node-d7279dcd-dfc4-4b6a-b6f2-d7f83dc686a7"]);
    }
    const fieldValidationEntries = [{"nodeId":"node-69356dfe-e50d-489b-b83e-bea81eb40824","formFieldName":"node-69356dfe-e50d-489b-b83e-bea81eb40824","props":{"_designerPaletteItemId":"heroui.input-text","isRequired":true}},{"nodeId":"node-663c6804-953d-4bc6-9f58-635393ad9b66","formFieldName":"node-663c6804-953d-4bc6-9f58-635393ad9b66","props":{"_designerPaletteItemId":"heroui.input-text","isRequired":true}},{"nodeId":"node-bb64f4bd-13bc-444e-9024-19add485a26c","formFieldName":"node-bb64f4bd-13bc-444e-9024-19add485a26c","props":{"_designerPaletteItemId":"heroui.input-text","isRequired":true}}] as Array<{ nodeId: string; formFieldName: string; props: Record<string, unknown> }>;
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
      payload["code"] = formData.get("node-69356dfe-e50d-489b-b83e-bea81eb40824") ?? '';
      payload["titleAr"] = formData.get("node-663c6804-953d-4bc6-9f58-635393ad9b66") ?? '';
      payload["listLogicCode"] = formData.get("node-bb64f4bd-13bc-444e-9024-19add485a26c") ?? '';
      payload["instituteId"] = applyPayloadFieldTransform(formData.get("node-c284084e-99be-43b2-aadc-2edb133985fa"), "number");
      payload["predicateRef"] = formData.get("node-39976218-7555-4ff1-b3c9-4e1def6629c7") ?? '';
      payload["sortOrder"] = applyPayloadFieldTransform(formData.get("node-bcd6009c-8105-4f39-8caf-181dbab8fa31"), "number");
      payload["isActive"] = applyPayloadFieldTransform(formData.get("node-c7924e92-9a0e-4571-a0d4-de09b5271c20"), "boolean");
      payload["note"] = formData.get("node-d7279dcd-dfc4-4b6a-b6f2-d7f83dc686a7") ?? '';
      const method = regionData_hwymemberlistdefsList_node_f33fd182_0116_454d_82a3_37e43c72a4bc?.id != null && String(regionData_hwymemberlistdefsList_node_f33fd182_0116_454d_82a3_37e43c72a4bc?.id).length > 0 ? "PUT" : 'POST';
      const url = (regionData_hwymemberlistdefsList_node_f33fd182_0116_454d_82a3_37e43c72a4bc?.id != null && String(regionData_hwymemberlistdefsList_node_f33fd182_0116_454d_82a3_37e43c72a4bc?.id).length > 0 ? (regionData_hwymemberlistdefsList_node_f33fd182_0116_454d_82a3_37e43c72a4bc?.id != null && String(regionData_hwymemberlistdefsList_node_f33fd182_0116_454d_82a3_37e43c72a4bc?.id).length > 0 ? ("/api/hwy/member-list-defs/" + encodeURIComponent(String(regionData_hwymemberlistdefsList_node_f33fd182_0116_454d_82a3_37e43c72a4bc?.id)) + "") : "/api/hwy/member-list-defs/:id") : "/api/hwy/member-list-defs");
      const response = await designerFetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response));
      }
      patchDesignerStore("ui.visibility.node-943fb219-9f97-40e0-8f04-ae722b08dfbf", false);
      toast("Saved successfully", { variant: "success", timeout: 4000 });
      await refresh_gridData_heroui_app_table_grid_1793645605494_h0y9c();
      (document.querySelector("[data-designer-node-id=\"node-f33fd182-0116-454d-82a3-37e43c72a4bc\"]") as HTMLFormElement | null)?.reset?.();
    } catch (mutationFailure) {
      toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' });
    }
    finally {
      setIsSubmitting(false);
    }
  }, [regionData_hwymemberlistdefsList_node_f33fd182_0116_454d_82a3_37e43c72a4bc]);
  const handleonClick_node_3cdb2b39_af8e_456e_ac2a_cf2dc088e7dd = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-943fb219-9f97-40e0-8f04-ae722b08dfbf", false);
  }, [patchDesignerStore]);
  const handleonClick_node_52e47f23_903e_4dda_b083_c7715b49d33b = React.useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    let formData: FormData;
    const form = event.currentTarget instanceof HTMLFormElement ? event.currentTarget : event.currentTarget.closest('form');
    if (form) {
      formData = new FormData(form);
    } else {
      const regionRoot = document.querySelector("[data-designer-node-id=\"node-8683b237-5d85-42e6-9c73-1521041ac1e1\"]");
      if (!regionRoot) {
        return;
      }
      formData = collectRegionFormDataFromContainer(regionRoot, ["node-d28684ec-1b8e-49dd-a596-6d309d8fc7a0","node-cf208246-5223-4453-9c64-6b7a67881d60","node-323b1aa8-ca2a-4189-885e-be04600c4fbb","node-4cbc4f99-e9be-41c9-9105-3629f67d93e2","node-7630a4b5-5373-4f71-9560-5151da63416d","node-a39d736e-ba64-49c7-85f0-1735d98fe259","node-c5d2c207-517e-4aaa-b546-a4a1c16cf1a8","node-295ae701-3b05-4f5d-8357-94b292f07caa"]);
    }
    const fieldValidationEntries = [{"nodeId":"node-d28684ec-1b8e-49dd-a596-6d309d8fc7a0","formFieldName":"node-d28684ec-1b8e-49dd-a596-6d309d8fc7a0","props":{"_designerPaletteItemId":"heroui.input-text","isRequired":true}},{"nodeId":"node-cf208246-5223-4453-9c64-6b7a67881d60","formFieldName":"node-cf208246-5223-4453-9c64-6b7a67881d60","props":{"_designerPaletteItemId":"heroui.input-text","isRequired":true}},{"nodeId":"node-323b1aa8-ca2a-4189-885e-be04600c4fbb","formFieldName":"node-323b1aa8-ca2a-4189-885e-be04600c4fbb","props":{"_designerPaletteItemId":"heroui.input-text","isRequired":true}}] as Array<{ nodeId: string; formFieldName: string; props: Record<string, unknown> }>;
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
      payload["code"] = formData.get("node-d28684ec-1b8e-49dd-a596-6d309d8fc7a0") ?? '';
      payload["titleAr"] = formData.get("node-cf208246-5223-4453-9c64-6b7a67881d60") ?? '';
      payload["listLogicCode"] = formData.get("node-323b1aa8-ca2a-4189-885e-be04600c4fbb") ?? '';
      payload["instituteId"] = applyPayloadFieldTransform(formData.get("node-4cbc4f99-e9be-41c9-9105-3629f67d93e2"), "number");
      payload["predicateRef"] = formData.get("node-7630a4b5-5373-4f71-9560-5151da63416d") ?? '';
      payload["sortOrder"] = applyPayloadFieldTransform(formData.get("node-a39d736e-ba64-49c7-85f0-1735d98fe259"), "number");
      payload["isActive"] = applyPayloadFieldTransform(formData.get("node-c5d2c207-517e-4aaa-b546-a4a1c16cf1a8"), "boolean");
      payload["note"] = formData.get("node-295ae701-3b05-4f5d-8357-94b292f07caa") ?? '';
      const method = regionData_hwymemberlistdefsList_node_8683b237_5d85_42e6_9c73_1521041ac1e1?.id != null && String(regionData_hwymemberlistdefsList_node_8683b237_5d85_42e6_9c73_1521041ac1e1?.id).length > 0 ? "PUT" : 'POST';
      const url = (regionData_hwymemberlistdefsList_node_8683b237_5d85_42e6_9c73_1521041ac1e1?.id != null && String(regionData_hwymemberlistdefsList_node_8683b237_5d85_42e6_9c73_1521041ac1e1?.id).length > 0 ? (regionData_hwymemberlistdefsList_node_8683b237_5d85_42e6_9c73_1521041ac1e1?.id != null && String(regionData_hwymemberlistdefsList_node_8683b237_5d85_42e6_9c73_1521041ac1e1?.id).length > 0 ? ("/api/hwy/member-list-defs/" + encodeURIComponent(String(regionData_hwymemberlistdefsList_node_8683b237_5d85_42e6_9c73_1521041ac1e1?.id)) + "") : "/api/hwy/member-list-defs/:id") : "/api/hwy/member-list-defs");
      const response = await designerFetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response));
      }
      patchDesignerStore("ui.visibility.node-39f38a81-3d6d-48fc-b825-70740ee19c3e", false);
      toast("Saved successfully", { variant: "success", timeout: 4000 });
      await refresh_gridData_heroui_app_table_grid_1793645605494_h0y9c();
    } catch (mutationFailure) {
      toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' });
    }
    finally {
      setIsSubmitting(false);
    }
  }, [regionData_hwymemberlistdefsList_node_8683b237_5d85_42e6_9c73_1521041ac1e1]);
  const handleonClick_node_9e3edfd9_c339_43cd_9e87_359fc4ccb0ed = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-39f38a81-3d6d-48fc-b825-70740ee19c3e", false);
  }, [patchDesignerStore]);
  const handleonClick_node_e222c67f_5918_4908_aef5_83526aa17429 = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-50f2b3b4-c8f2-4a56-acd3-ba0077bda913", false);
  }, [patchDesignerStore]);
  const handleonClick_node_ef68c3d5_6c48_4495_b16b_d1499115b1c8 = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    void (async () => {
      let mutationOk_da_mvzma6pk_vpmlu = true;
      try {
        const response = await designerFetch(("/api/hwy/member-list-defs/" + encodeURIComponent(String(designerStore?.selection?.id)) + ""), {
          method: "DELETE",
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) {
          toast(await parseApiErrorMessage(response), { variant: 'danger' });
          mutationOk_da_mvzma6pk_vpmlu = false;
        }
      } catch (mutationFailure) {
        toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' });
        mutationOk_da_mvzma6pk_vpmlu = false;
      }
      if (mutationOk_da_mvzma6pk_vpmlu) {
        await refresh_gridData_heroui_app_table_grid_1793645605494_h0y9c();
        toast("Deleted", { variant: "success", timeout: 4000 });
        patchDesignerStore("ui.visibility.node-50f2b3b4-c8f2-4a56-acd3-ba0077bda913", false);
      }
    })();
  }, [patchDesignerStore, refresh_gridData_heroui_app_table_grid_1793645605494_h0y9c]);
  return (
    <>
      <Toast.Provider />
      <div className="h-full min-h-0 w-full min-w-0 space-y-3">
        <ListPageShell className="flex min-h-0 w-full flex-1 flex-col"><ListPageToolbarFrame><div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}><input type="text" value={gridSearchInput_heroui_app_table_grid_1793645605494_h0y9c} onChange={(event) => handleGridSearchChange_heroui_app_table_grid_1793645605494_h0y9c(event.target.value)} placeholder={"Search member list definitions…"} className="h-8 rounded-md border border-slate-200 px-2 text-sm" /></div><div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}><button type="button" onClick={() => { patchDesignerStore("selection.id", null); patchDesignerStore("ui.visibility.node-943fb219-9f97-40e0-8f04-ae722b08dfbf", true); }} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700">Create</button><span className="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold tabular-nums text-slate-700" aria-live="polite">{gridTotalCount_heroui_app_table_grid_1793645605494_h0y9c.toLocaleString()}</span><button type="button" onClick={() => { void refresh_gridData_heroui_app_table_grid_1793645605494_h0y9c(); }} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">Refresh</button></div></ListPageToolbarFrame><AppTableGrid className="flex !h-full !min-h-0 !w-full flex-1 flex-col" showPagingFooter presentation="auto" cardBelow="tablet" size="sm" columns={gridColumns_heroui_app_table_grid_1793645605494_h0y9c} rows={gridPaging_heroui_app_table_grid_1793645605494_h0y9c.displayRows} getRowKey={(row) => String((row as Record<string, unknown>)["id"] ?? '')} enableColumnLayout={false} columnLayout={gridColumnLayout_heroui_app_table_grid_1793645605494_h0y9c} onColumnLayoutChange={setGridColumnLayout_heroui_app_table_grid_1793645605494_h0y9c} isLoading={isLoading_gridData_heroui_app_table_grid_1793645605494_h0y9c} loadingMessage={"Loading member list definitions…"} emptyMessage={"No member list definitions found."} isEmpty={gridAggregatedRows_heroui_app_table_grid_1793645605494_h0y9c.length === 0} errorContent={(error_gridData_heroui_app_table_grid_1793645605494_h0y9c ? "Could not load member list definitions." : undefined)} gridQueryMode={"server"} query={gridQuery_heroui_app_table_grid_1793645605494_h0y9c} onQueryChange={handleGridQueryChange_heroui_app_table_grid_1793645605494_h0y9c} onGridRowAction={handleGridRowAction_heroui_app_table_grid_1793645605494_h0y9c} footer={<GridPagingFooter totalCount={gridTotalCount_heroui_app_table_grid_1793645605494_h0y9c} safePage={gridPaging_heroui_app_table_grid_1793645605494_h0y9c.safePage} pageSize={gridPageSize_heroui_app_table_grid_1793645605494_h0y9c} onPageSizeChange={handleGridPageSizeChange_heroui_app_table_grid_1793645605494_h0y9c} sortBy={gridQuery_heroui_app_table_grid_1793645605494_h0y9c.sort?.columnId ?? ''} sortOptions={[{"value":"code","label":"Code"},{"value":"titleAr","label":"Title"},{"value":"listLogicCode","label":"Logic"},{"value":"predicateRef","label":"Predicate ref"},{"value":"isActive","label":"Active"},{"value":"sortOrder","label":"Order"}]} onSortByChange={handleGridSortByChange_heroui_app_table_grid_1793645605494_h0y9c} sortDirection={gridQuery_heroui_app_table_grid_1793645605494_h0y9c.sort?.direction ?? 'asc'} onToggleSortDirection={handleGridToggleSortDirection_heroui_app_table_grid_1793645605494_h0y9c} showSortControls={true} totalPages={gridPaging_heroui_app_table_grid_1793645605494_h0y9c.totalPages} pageNumbers={buildDataGridPageNumbers(gridPaging_heroui_app_table_grid_1793645605494_h0y9c.safePage, gridPaging_heroui_app_table_grid_1793645605494_h0y9c.totalPages)} onPageChange={handleGridPageChange_heroui_app_table_grid_1793645605494_h0y9c} visibleInfiniteCount={gridListMode_heroui_app_table_grid_1793645605494_h0y9c === 'infinite' ? gridPaging_heroui_app_table_grid_1793645605494_h0y9c.displayRows.length : undefined} />} /></ListPageShell>
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "(store.ui.visibility.node-943fb219-9f97-40e0-8f04-ae722b08dfbf === true) && (store.ui.visibility.node-943fb219-9f97-40e0-8f04-ae722b08dfbf !== false)") && (
          <CreateEditModalShell title={"Create Member List Definition"} size="lg" onClose={() => { patchDesignerStore("ui.visibility.node-943fb219-9f97-40e0-8f04-ae722b08dfbf", false); }} onBackdropClick={() => { patchDesignerStore("ui.visibility.node-943fb219-9f97-40e0-8f04-ae722b08dfbf", false); }} gradient={false} bodyOuterClassName="-mb-[15px]" bodyClassName="!p-0" footerClassName="!mt-0">
            <form className="flex !min-h-0 flex-col gap-0 bg-white" method="post" id="node-f33fd182-0116-454d-82a3-37e43c72a4bc" data-designer-node-id="node-f33fd182-0116-454d-82a3-37e43c72a4bc">
              <div className="flex !min-w-0 flex-col gap-2 bg-white p-[15px]">
                <UiInput isRequired type="text" placeholder="Code" label="Code" aria-label="Code" size="sm" data-page-guide="" data-page-guide-title="Code" data-page-guide-hint="Required. Enter code." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_hwymemberlistdefsList_node_f33fd182_0116_454d_82a3_37e43c72a4bc?.code} name="node-69356dfe-e50d-489b-b83e-bea81eb40824" />
                <UiInput isRequired type="text" placeholder="Title (Arabic)" label="Title (Arabic)" aria-label="Title (Arabic)" size="sm" data-page-guide="" data-page-guide-title="Title (Arabic)" data-page-guide-hint="Required. Enter title (Arabic)." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_hwymemberlistdefsList_node_f33fd182_0116_454d_82a3_37e43c72a4bc?.titleAr} name="node-663c6804-953d-4bc6-9f58-635393ad9b66" />
                <UiInput isRequired type="text" placeholder="List logic code" label="List logic code" aria-label="List logic code" size="sm" data-page-guide="" data-page-guide-title="List logic code" data-page-guide-hint="Required. Enter list logic code." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_hwymemberlistdefsList_node_f33fd182_0116_454d_82a3_37e43c72a4bc?.listLogicCode} name="node-bb64f4bd-13bc-444e-9024-19add485a26c" />
                <UiInput type="number" placeholder="Institute id" label="Institute id" aria-label="Institute id" size="sm" data-page-guide="" data-page-guide-title="Institute id" data-page-guide-hint="Enter institute id." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_hwymemberlistdefsList_node_f33fd182_0116_454d_82a3_37e43c72a4bc?.instituteId} name="node-c284084e-99be-43b2-aadc-2edb133985fa" />
                <UiInput type="text" placeholder="Predicate ref" label="Predicate ref" aria-label="Predicate ref" size="sm" data-page-guide="" data-page-guide-title="Predicate ref" data-page-guide-hint="Enter predicate ref." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_hwymemberlistdefsList_node_f33fd182_0116_454d_82a3_37e43c72a4bc?.predicateRef} name="node-39976218-7555-4ff1-b3c9-4e1def6629c7" />
                <UiInput type="number" placeholder="Sort order" label="Sort order" aria-label="Sort order" size="sm" data-page-guide="" data-page-guide-title="Sort order" data-page-guide-hint="Enter sort order." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_hwymemberlistdefsList_node_f33fd182_0116_454d_82a3_37e43c72a4bc?.sortOrder} name="node-bcd6009c-8105-4f39-8caf-181dbab8fa31" />
                <Switch aria-label="Active" size="md" data-page-guide="" data-page-guide-title="Active" data-page-guide-hint="Turn active on or off." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" isSelected={regionData_hwymemberlistdefsList_node_f33fd182_0116_454d_82a3_37e43c72a4bc?.isActive} name="node-c7924e92-9a0e-4571-a0d4-de09b5271c20"><Switch.Content className="flex items-center gap-2"><Switch.Control><Switch.Thumb /></Switch.Control><span className="text-xs font-semibold text-slate-700">Active</span></Switch.Content></Switch>
                <UiInput type="text" placeholder="Note" label="Note" aria-label="Note" size="sm" data-page-guide="" data-page-guide-title="Note" data-page-guide-hint="Enter note." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_hwymemberlistdefsList_node_f33fd182_0116_454d_82a3_37e43c72a4bc?.note} name="node-d7279dcd-dfc4-4b6a-b6f2-d7f83dc686a7" />
              </div>
            </form>
            <div className="flex !w-full shrink-0 !items-center !justify-end gap-2">
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 border border-slate-200 text-slate-600 hover:bg-slate-100" variant="outline" size="md" onClick={handleonClick_node_3cdb2b39_af8e_456e_ac2a_cf2dc088e7dd}><X className="h-3.5 w-3.5" /> Cancel</Button>
              <Button type="submit" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 bg-primary-600 hover:bg-primary-700 text-white" form="node-f33fd182-0116-454d-82a3-37e43c72a4bc" variant="primary" size="md" href="#" target="_self" isDisabled={isSubmitting} onClick={handleonClick_node_7104434e_d2fe_48b1_a972_9ef480cc33e4}><Plus className="h-3.5 w-3.5" /> Create Member List Definition</Button>
            </div>
          </CreateEditModalShell>
        )}
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "(store.ui.visibility.node-39f38a81-3d6d-48fc-b825-70740ee19c3e === true) && (store.ui.visibility.node-39f38a81-3d6d-48fc-b825-70740ee19c3e !== false)") && (
          <CreateEditModalShell title={"Edit Member List Definition"} size="lg" onClose={() => { patchDesignerStore("ui.visibility.node-39f38a81-3d6d-48fc-b825-70740ee19c3e", false); }} onBackdropClick={() => { patchDesignerStore("ui.visibility.node-39f38a81-3d6d-48fc-b825-70740ee19c3e", false); }} gradient={false} bodyOuterClassName="-mb-[15px]" bodyClassName="!p-0" footerClassName="!mt-0">
            <form className="flex !min-h-0 flex-col gap-0 bg-white" method="post" id="node-8683b237-5d85-42e6-9c73-1521041ac1e1" data-designer-node-id="node-8683b237-5d85-42e6-9c73-1521041ac1e1">
              <div className="flex !min-w-0 flex-col gap-2 bg-white p-[15px]">
                <UiInput isRequired type="text" placeholder="Code" label="Code" aria-label="Code" size="sm" data-page-guide="" data-page-guide-title="Code" data-page-guide-hint="Required. Enter code." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_hwymemberlistdefsList_node_8683b237_5d85_42e6_9c73_1521041ac1e1?.code} name="node-d28684ec-1b8e-49dd-a596-6d309d8fc7a0" />
                <UiInput isRequired type="text" placeholder="Title (Arabic)" label="Title (Arabic)" aria-label="Title (Arabic)" size="sm" data-page-guide="" data-page-guide-title="Title (Arabic)" data-page-guide-hint="Required. Enter title (Arabic)." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_hwymemberlistdefsList_node_8683b237_5d85_42e6_9c73_1521041ac1e1?.titleAr} name="node-cf208246-5223-4453-9c64-6b7a67881d60" />
                <UiInput isRequired type="text" placeholder="List logic code" label="List logic code" aria-label="List logic code" size="sm" data-page-guide="" data-page-guide-title="List logic code" data-page-guide-hint="Required. Enter list logic code." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_hwymemberlistdefsList_node_8683b237_5d85_42e6_9c73_1521041ac1e1?.listLogicCode} name="node-323b1aa8-ca2a-4189-885e-be04600c4fbb" />
                <UiInput type="number" placeholder="Institute id" label="Institute id" aria-label="Institute id" size="sm" data-page-guide="" data-page-guide-title="Institute id" data-page-guide-hint="Enter institute id." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_hwymemberlistdefsList_node_8683b237_5d85_42e6_9c73_1521041ac1e1?.instituteId} name="node-4cbc4f99-e9be-41c9-9105-3629f67d93e2" />
                <UiInput type="text" placeholder="Predicate ref" label="Predicate ref" aria-label="Predicate ref" size="sm" data-page-guide="" data-page-guide-title="Predicate ref" data-page-guide-hint="Enter predicate ref." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_hwymemberlistdefsList_node_8683b237_5d85_42e6_9c73_1521041ac1e1?.predicateRef} name="node-7630a4b5-5373-4f71-9560-5151da63416d" />
                <UiInput type="number" placeholder="Sort order" label="Sort order" aria-label="Sort order" size="sm" data-page-guide="" data-page-guide-title="Sort order" data-page-guide-hint="Enter sort order." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_hwymemberlistdefsList_node_8683b237_5d85_42e6_9c73_1521041ac1e1?.sortOrder} name="node-a39d736e-ba64-49c7-85f0-1735d98fe259" />
                <Switch aria-label="Active" size="md" data-page-guide="" data-page-guide-title="Active" data-page-guide-hint="Turn active on or off." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" isSelected={regionData_hwymemberlistdefsList_node_8683b237_5d85_42e6_9c73_1521041ac1e1?.isActive} name="node-c5d2c207-517e-4aaa-b546-a4a1c16cf1a8"><Switch.Content className="flex items-center gap-2"><Switch.Control><Switch.Thumb /></Switch.Control><span className="text-xs font-semibold text-slate-700">Active</span></Switch.Content></Switch>
                <UiInput type="text" placeholder="Note" label="Note" aria-label="Note" size="sm" data-page-guide="" data-page-guide-title="Note" data-page-guide-hint="Enter note." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_hwymemberlistdefsList_node_8683b237_5d85_42e6_9c73_1521041ac1e1?.note} name="node-295ae701-3b05-4f5d-8357-94b292f07caa" />
              </div>
            </form>
            <div className="flex !w-full shrink-0 !items-center !justify-end gap-2">
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 border border-slate-200 text-slate-600 hover:bg-slate-100" variant="outline" size="md" onClick={handleonClick_node_9e3edfd9_c339_43cd_9e87_359fc4ccb0ed}><X className="h-3.5 w-3.5" /> Cancel</Button>
              <Button type="submit" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 bg-primary-600 hover:bg-primary-700 text-white" form="node-8683b237-5d85-42e6-9c73-1521041ac1e1" variant="primary" size="md" href="#" target="_self" isDisabled={isSubmitting} onClick={handleonClick_node_52e47f23_903e_4dda_b083_c7715b49d33b}><Save className="h-3.5 w-3.5" /> Save</Button>
            </div>
          </CreateEditModalShell>
        )}
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "(store.ui.visibility.node-50f2b3b4-c8f2-4a56-acd3-ba0077bda913 === true) && (store.ui.visibility.node-50f2b3b4-c8f2-4a56-acd3-ba0077bda913 !== false)") && (
          <ConfirmDialogShell title={"Delete Member List Definition?"} size="sm" onClose={() => { patchDesignerStore("ui.visibility.node-50f2b3b4-c8f2-4a56-acd3-ba0077bda913", false); }} onBackdropClick={() => { patchDesignerStore("ui.visibility.node-50f2b3b4-c8f2-4a56-acd3-ba0077bda913", false); }} tone="danger" hideCancel hideConfirm icon={<Trash2 className="h-4 w-4" />} bodyClassName="!p-0" footerClassName="!mt-0">
            <p className="block p-[15px] !text-sm text-slate-700">Delete this member list definition? This cannot be undone.</p>
            <div className="flex !w-full shrink-0 !items-center !justify-end gap-2">
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 border border-slate-200 text-slate-600 hover:bg-slate-100" variant="outline" size="md" onClick={handleonClick_node_e222c67f_5918_4908_aef5_83526aa17429}><X className="h-3.5 w-3.5" /> Cancel</Button>
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 bg-rose-600 hover:bg-rose-700 text-white" variant="primary" size="md" onClick={handleonClick_node_ef68c3d5_6c48_4495_b16b_d1499115b1c8}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
            </div>
          </ConfirmDialogShell>
        )}
      </div>
    </>
  );
};
