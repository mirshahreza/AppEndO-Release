import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useOptionalPlatformMount } from '@/app/platform/PlatformMountContext';
import { resolvePublishedDesignerNavigateTarget } from '@/domain/component-designer/resolvePublishedDesignerNavigateTarget';
import { buildAppTableGridColumns } from '@/domain/component-designer/DesignerRuntimeAppTableGrid';
import { applyClientGridQuery, EMPTY_GRID_QUERY, type GridQueryState } from '@/shared/lib/appTableGridQuery';
import { resolveDataGridTotalCount, sliceDataGridRowsForDisplay, buildDataGridPageNumbers, applyGridAggregation } from '@/domain/component-designer/designerDataGridRuntime';
import { applyDesignerGridToolbarClientFilters } from '@/domain/component-designer/designerGridToolbarConfig';
import { createDefaultColumnLayout } from '@/shared/lib/appTableGridColumnLayout';
import { DesignerBaseInfoRecordFormField } from '@/domain/component-designer/DesignerBaseInfoRecordFormField';
import { AppTableGrid, ConfirmDialogShell, CreateEditModalShell, GridPagingFooter, ListPageShell, ListPageToolbarFrame, PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS, PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS, ToolbarFilterSelect, UiCheckbox } from '@/shared/ui';
import { Button, Toast, toast } from '@heroui/react';
import { Eye, Layers, Plus, Radio, Save, Trash2, UserCheck, Vote, X } from 'lucide-react';

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
  const routerNavigate = useNavigate();
  const location = useLocation();
  const mountPathPrefix = useOptionalPlatformMount()?.pathPrefix ?? null;
  const navigate = React.useCallback((to: string, options?: { replace?: boolean }) => {
    routerNavigate(resolvePublishedDesignerNavigateTarget(to, location.pathname, mountPathPrefix), { replace: options?.replace === true });
  }, [location.pathname, mountPathPrefix, routerNavigate]);
  const { store: designerStore, patch: patchDesignerStore } = useDesignerStore<Record<string, unknown>>({"selection":{"id":null}});
  const { data: raw_regionData_vocabItems_node_9b0ce52a_9c2f_4a7a_9f24_7988ed876951, isLoading: isLoading_regionData_vocabItems_node_9b0ce52a_9c2f_4a7a_9f24_7988ed876951, error: error_regionData_vocabItems_node_9b0ce52a_9c2f_4a7a_9f24_7988ed876951, refresh: refresh_regionData_vocabItems_node_9b0ce52a_9c2f_4a7a_9f24_7988ed876951 } = useDataFetch<unknown>(resolveBindingUrl("/api/base-info/:id", designerStore, { "id": "selection.id" }), {});
  const regionData_vocabItems_node_9b0ce52a_9c2f_4a7a_9f24_7988ed876951 = React.useMemo(() => coerceApiRecordValue(applyResponseDataPath(raw_regionData_vocabItems_node_9b0ce52a_9c2f_4a7a_9f24_7988ed876951, {"dataPath":"items","arrayPath":"items","totalPath":"count"})), [raw_regionData_vocabItems_node_9b0ce52a_9c2f_4a7a_9f24_7988ed876951]);
  const handleGridRowAction_heroui_app_table_grid_1794246578678_b3wxb = React.useCallback((row: Record<string, unknown>, actionId: string) => {
    switch (actionId) {
      case "edit": {
        patchDesignerStore("selection.id", row["id"] ?? null);
        patchDesignerStore("ui.visibility.node-a7b4729a-3609-4363-b922-e9a9d2823607", true);
        return;
      }
      case "delete": {
        patchDesignerStore("selection.id", row["id"] ?? null);
        patchDesignerStore("ui.visibility.node-f497252a-02af-4ef8-85b1-7c531d51ae40", true);
        return;
      }
      default:
        return;
    }
  }, [patchDesignerStore]);
  const { data: raw_gridData_heroui_app_table_grid_1794246578678_b3wxb, isLoading: isLoading_gridData_heroui_app_table_grid_1794246578678_b3wxb, error: error_gridData_heroui_app_table_grid_1794246578678_b3wxb, refresh: refresh_gridData_heroui_app_table_grid_1794246578678_b3wxb } = useDataFetch<unknown>(resolveBindingUrl("/api/base-info/children?parentId=102.001&includeInactive=true", designerStore, { "search": "gridToolbar.search", "sortBy": "gridQuery.sortBy", "sortDir": "gridQuery.sortDir", "page": "gridQuery.page", "pageSize": "gridQuery.pageSize", "includeCount": "static:page1Only", "where": "gridToolbar.listWhere", "filter[title][like]": "gridQuery.filters.title", "filter[short_name][like]": "gridQuery.filters.short_name", "filter[is_active][eq]": "gridQuery.filters.is_active" }), {});
  const gridData_heroui_app_table_grid_1794246578678_b3wxb = React.useMemo(() => applyResponseDataPath(raw_gridData_heroui_app_table_grid_1794246578678_b3wxb, {"dataPath":"items","arrayPath":"items","totalPath":"count"}), [raw_gridData_heroui_app_table_grid_1794246578678_b3wxb]);
  const gridColumns_heroui_app_table_grid_1794246578678_b3wxb = React.useMemo(() => buildAppTableGridColumns([{"key":"ui_color","label":"","cellKind":"color-swatch","cardRole":"meta","cardPriority":-1},{"key":"title","label":"Title","sort":true,"filter":true,"filterType":"text","cardRole":"title"},{"key":"short_name","label":"Short name","sort":true,"filter":true,"filterType":"text","cardRole":"hidden"},{"key":"view_order","label":"Order","sort":true,"cardRole":"hidden"},{"key":"is_active","label":"Active","sort":true,"filter":true,"filterType":"boolean","cellKind":"boolean-icon","cardRole":"hidden"},{"key":"actions","label":"","kind":"action-group","actions":[{"actionId":"edit","icon":"Pencil","intent":"edit","tooltip":"Edit","behavior":{"kind":"open-modal","modalNodeId":"node-a7b4729a-3609-4363-b922-e9a9d2823607","primaryKeyField":"id","selectionStorePath":"selection.id"}},{"actionId":"delete","icon":"Trash2","intent":"delete","tooltip":"Delete","behavior":{"kind":"open-modal","modalNodeId":"node-f497252a-02af-4ef8-85b1-7c531d51ae40","primaryKeyField":"id","selectionStorePath":"selection.id"}}],"maxVisibleActions":3,"cardRole":"actions","layoutHideable":false,"layoutResizable":false,"layoutReorderable":false,"layoutPinned":"right","width":"57px"}], "server", {
    mode: 'runtime',
    detailFlowRef: { current: null },
    rowActionHandlerRef: { current: handleGridRowAction_heroui_app_table_grid_1794246578678_b3wxb },
    cellClickHandlerRef: { current: undefined },
    designerStoreRef: { current: designerStore },
  }), [designerStore, handleGridRowAction_heroui_app_table_grid_1794246578678_b3wxb]);
  const [gridQuery_heroui_app_table_grid_1794246578678_b3wxb, setGridQuery_heroui_app_table_grid_1794246578678_b3wxb] = React.useState<GridQueryState>(() => ({ ...EMPTY_GRID_QUERY, sort: { columnId: "view_order", direction: "asc" } }));
  const [gridPage_heroui_app_table_grid_1794246578678_b3wxb, setGridPage_heroui_app_table_grid_1794246578678_b3wxb] = React.useState(1);
  const [gridPageSize_heroui_app_table_grid_1794246578678_b3wxb, setGridPageSize_heroui_app_table_grid_1794246578678_b3wxb] = React.useState(1000);
  const [gridListMode_heroui_app_table_grid_1794246578678_b3wxb, setGridListMode_heroui_app_table_grid_1794246578678_b3wxb] = React.useState<'paging' | 'infinite'>("paging");
  const [gridColumnLayout_heroui_app_table_grid_1794246578678_b3wxb, setGridColumnLayout_heroui_app_table_grid_1794246578678_b3wxb] = React.useState(() => createDefaultColumnLayout(gridColumns_heroui_app_table_grid_1794246578678_b3wxb));
  const [gridSearchInput_heroui_app_table_grid_1794246578678_b3wxb, setGridSearchInput_heroui_app_table_grid_1794246578678_b3wxb] = React.useState('');
  const [gridDebouncedSearch_heroui_app_table_grid_1794246578678_b3wxb, setGridDebouncedSearch_heroui_app_table_grid_1794246578678_b3wxb] = React.useState('');
  const [gridCheckboxSelections_heroui_app_table_grid_1794246578678_b3wxb, setGridCheckboxSelections_heroui_app_table_grid_1794246578678_b3wxb] = React.useState<Record<string, Record<string, boolean>>>({});
  const [gridRadioSelections_heroui_app_table_grid_1794246578678_b3wxb, setGridRadioSelections_heroui_app_table_grid_1794246578678_b3wxb] = React.useState<Record<string, string>>({});
  const [gridMatchLogic_heroui_app_table_grid_1794246578678_b3wxb, setGridMatchLogic_heroui_app_table_grid_1794246578678_b3wxb] = React.useState<Record<string, 'and' | 'or'>>({});
  const gridRoleFilters_heroui_app_table_grid_1794246578678_b3wxb = {};
  const gridFilteredRows_heroui_app_table_grid_1794246578678_b3wxb = React.useMemo(() => applyClientGridQuery(((Array.isArray(gridData_heroui_app_table_grid_1794246578678_b3wxb) ? gridData_heroui_app_table_grid_1794246578678_b3wxb : []) ?? []), gridQuery_heroui_app_table_grid_1794246578678_b3wxb, gridColumns_heroui_app_table_grid_1794246578678_b3wxb, "server"), [gridQuery_heroui_app_table_grid_1794246578678_b3wxb, gridColumns_heroui_app_table_grid_1794246578678_b3wxb]);
  const gridAggregatedRows_heroui_app_table_grid_1794246578678_b3wxb = gridFilteredRows_heroui_app_table_grid_1794246578678_b3wxb;
  const gridApiTotal_heroui_app_table_grid_1794246578678_b3wxb = React.useMemo(() => {
    const raw = raw_gridData_heroui_app_table_grid_1794246578678_b3wxb;
    const value = readNestedContextValue((raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}), "count");
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
  }, [raw_gridData_heroui_app_table_grid_1794246578678_b3wxb]);
  const gridTotalCount_heroui_app_table_grid_1794246578678_b3wxb = resolveDataGridTotalCount({ page: gridPage_heroui_app_table_grid_1794246578678_b3wxb, pageSize: gridPageSize_heroui_app_table_grid_1794246578678_b3wxb, total: gridApiTotal_heroui_app_table_grid_1794246578678_b3wxb, gridQueryMode: "server" }, gridAggregatedRows_heroui_app_table_grid_1794246578678_b3wxb.length);
  const gridPaging_heroui_app_table_grid_1794246578678_b3wxb = sliceDataGridRowsForDisplay(gridAggregatedRows_heroui_app_table_grid_1794246578678_b3wxb, gridPage_heroui_app_table_grid_1794246578678_b3wxb, gridPageSize_heroui_app_table_grid_1794246578678_b3wxb, gridTotalCount_heroui_app_table_grid_1794246578678_b3wxb, "server");
  const handleGridQueryChange_heroui_app_table_grid_1794246578678_b3wxb = React.useCallback((nextQuery: GridQueryState) => {
    setGridQuery_heroui_app_table_grid_1794246578678_b3wxb(nextQuery);
    setGridPage_heroui_app_table_grid_1794246578678_b3wxb(1);
    patchDesignerStore("gridQuery.sortBy", nextQuery.sort?.columnId ?? '');
    patchDesignerStore("gridQuery.sortDir", nextQuery.sort?.direction ?? '');
  }, [patchDesignerStore]);
  const handleGridPageChange_heroui_app_table_grid_1794246578678_b3wxb = React.useCallback((nextPage: number) => {
    setGridPage_heroui_app_table_grid_1794246578678_b3wxb(nextPage);
    patchDesignerStore("gridQuery.page", nextPage);
  }, [patchDesignerStore]);
  const handleGridPageSizeChange_heroui_app_table_grid_1794246578678_b3wxb = React.useCallback((nextSize: number) => {
    setGridPageSize_heroui_app_table_grid_1794246578678_b3wxb(nextSize);
    setGridPage_heroui_app_table_grid_1794246578678_b3wxb(1);
    patchDesignerStore("gridQuery.pageSize", nextSize);
  }, [patchDesignerStore]);
  const handleGridSortByChange_heroui_app_table_grid_1794246578678_b3wxb = React.useCallback((nextSortBy: string) => {
    setGridQuery_heroui_app_table_grid_1794246578678_b3wxb((current: GridQueryState) => ({ ...current, sort: nextSortBy ? { columnId: nextSortBy, direction: current.sort?.direction ?? 'asc' } : null }));
  }, []);
  const handleGridToggleSortDirection_heroui_app_table_grid_1794246578678_b3wxb = React.useCallback(() => {
    setGridQuery_heroui_app_table_grid_1794246578678_b3wxb((current: GridQueryState) => (current.sort ? { ...current, sort: { ...current.sort, direction: current.sort.direction === 'asc' ? 'desc' : 'asc' } } : current));
  }, []);
  const searchDebounceTimer_heroui_app_table_grid_1794246578678_b3wxb = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleGridSearchChange_heroui_app_table_grid_1794246578678_b3wxb = React.useCallback((nextValue: string) => {
    setGridSearchInput_heroui_app_table_grid_1794246578678_b3wxb(nextValue);
    if (searchDebounceTimer_heroui_app_table_grid_1794246578678_b3wxb.current) {
      clearTimeout(searchDebounceTimer_heroui_app_table_grid_1794246578678_b3wxb.current);
    }
    searchDebounceTimer_heroui_app_table_grid_1794246578678_b3wxb.current = setTimeout(() => {
      setGridDebouncedSearch_heroui_app_table_grid_1794246578678_b3wxb(nextValue);
      setGridPage_heroui_app_table_grid_1794246578678_b3wxb(1);
      patchDesignerStore("gridToolbar.search", nextValue);
    }, 300);
  }, [patchDesignerStore]);

  const dataContext: Record<string, unknown> | null = null;
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const handleonClick_heroui_button_outline_1794246578658_i90ia = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    navigate("/studio/voting/settings/voting-statuses", { replace: false });
  }, [navigate]);
  const handleonClick_heroui_button_outline_1794246578662_40sgv = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    navigate("/studio/voting/settings/ballot-types", { replace: false });
  }, [navigate]);
  const handleonClick_heroui_button_outline_1794246578665_ibu2y = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    navigate("/studio/voting/settings/registration-statuses", { replace: false });
  }, [navigate]);
  const handleonClick_heroui_button_outline_1794246578668_zwfmz = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    navigate("/studio/voting/settings/observer-roles", { replace: false });
  }, [navigate]);
  const handleonClick_heroui_button_outline_1794246578672_5l7vm = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    navigate("/studio/voting/settings/cast-channels", { replace: false });
  }, [navigate]);
  const handleonClick_node_2869b29a_a653_4bbd_9a71_8486f2c2a0cd = React.useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    let formData: FormData;
    const form = event.currentTarget instanceof HTMLFormElement ? event.currentTarget : event.currentTarget.closest('form');
    if (form) {
      formData = new FormData(form);
    } else {
      const regionRoot = document.querySelector("[data-designer-node-id=\"node-3eff70f6-02ee-4177-8f49-39e0b6c25ee2\"]");
      if (!regionRoot) {
        return;
      }
      formData = collectRegionFormDataFromContainer(regionRoot, ["form-base-info-record-1794246578702-u3rul__isActive","form-base-info-record-1794246578702-u3rul__parentId","form-base-info-record-1794246578702-u3rul__childDigits","form-base-info-record-1794246578702-u3rul__title","form-base-info-record-1794246578702-u3rul__titleEn","form-base-info-record-1794246578702-u3rul__titleFa","form-base-info-record-1794246578702-u3rul__titleAr","form-base-info-record-1794246578702-u3rul__shortName","form-base-info-record-1794246578702-u3rul__note","form-base-info-record-1794246578702-u3rul__noteEn","form-base-info-record-1794246578702-u3rul__noteFa","form-base-info-record-1794246578702-u3rul__noteAr","form-base-info-record-1794246578702-u3rul__viewOrder","form-base-info-record-1794246578702-u3rul__value","form-base-info-record-1794246578702-u3rul__metadata","form-base-info-record-1794246578702-u3rul__uiColor","form-base-info-record-1794246578702-u3rul__uiHtml"]);
    }
    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {};
      payload["isActive"] = applyPayloadFieldTransform(formData.get("form-base-info-record-1794246578702-u3rul__isActive"), "boolean");
      payload["parentId"] = formData.get("form-base-info-record-1794246578702-u3rul__parentId") ?? '';
      payload["childDigits"] = formData.get("form-base-info-record-1794246578702-u3rul__childDigits") ?? '';
      payload["title"] = formData.get("form-base-info-record-1794246578702-u3rul__title") ?? '';
      payload["titleEn"] = formData.get("form-base-info-record-1794246578702-u3rul__titleEn") ?? '';
      payload["titleFa"] = formData.get("form-base-info-record-1794246578702-u3rul__titleFa") ?? '';
      payload["titleAr"] = formData.get("form-base-info-record-1794246578702-u3rul__titleAr") ?? '';
      payload["shortName"] = formData.get("form-base-info-record-1794246578702-u3rul__shortName") ?? '';
      payload["note"] = formData.get("form-base-info-record-1794246578702-u3rul__note") ?? '';
      payload["noteEn"] = formData.get("form-base-info-record-1794246578702-u3rul__noteEn") ?? '';
      payload["noteFa"] = formData.get("form-base-info-record-1794246578702-u3rul__noteFa") ?? '';
      payload["noteAr"] = formData.get("form-base-info-record-1794246578702-u3rul__noteAr") ?? '';
      payload["viewOrder"] = formData.get("form-base-info-record-1794246578702-u3rul__viewOrder") ?? '';
      payload["value"] = formData.get("form-base-info-record-1794246578702-u3rul__value") ?? '';
      payload["metadata"] = formData.get("form-base-info-record-1794246578702-u3rul__metadata") ?? '';
      payload["uiColor"] = applyPayloadFieldTransform(formData.get("form-base-info-record-1794246578702-u3rul__uiColor"), "nullableString");
      payload["uiHtml"] = applyPayloadFieldTransform(formData.get("form-base-info-record-1794246578702-u3rul__uiHtml"), "nullableString");
      const method = regionData_vocabItems_node_3eff70f6_02ee_4177_8f49_39e0b6c25ee2?.id != null && String(regionData_vocabItems_node_3eff70f6_02ee_4177_8f49_39e0b6c25ee2?.id).length > 0 ? "PUT" : 'POST';
      const url = (regionData_vocabItems_node_3eff70f6_02ee_4177_8f49_39e0b6c25ee2?.id != null && String(regionData_vocabItems_node_3eff70f6_02ee_4177_8f49_39e0b6c25ee2?.id).length > 0 ? (regionData_vocabItems_node_3eff70f6_02ee_4177_8f49_39e0b6c25ee2?.id != null && String(regionData_vocabItems_node_3eff70f6_02ee_4177_8f49_39e0b6c25ee2?.id).length > 0 ? ("/api/base-info/" + encodeURIComponent(String(regionData_vocabItems_node_3eff70f6_02ee_4177_8f49_39e0b6c25ee2?.id)) + "") : "/api/base-info/:id") : "/api/base-info");
      const response = await designerFetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response));
      }
      patchDesignerStore("ui.visibility.node-fb55ca6e-1c5f-4f8b-96c6-8b455302d2f1", false);
      toast("Saved successfully", { variant: "success", timeout: 4000 });
      await refresh_gridData_heroui_app_table_grid_1794246578678_b3wxb();
      (document.querySelector("[data-designer-node-id=\"node-3eff70f6-02ee-4177-8f49-39e0b6c25ee2\"]") as HTMLFormElement | null)?.reset?.();
    } catch (mutationFailure) {
      toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' });
    }
    finally {
      setIsSubmitting(false);
    }
  }, [regionData_vocabItems_node_3eff70f6_02ee_4177_8f49_39e0b6c25ee2]);
  const handleonClick_node_c7a0b773_252e_4290_be9b_2d780605b7c3 = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-fb55ca6e-1c5f-4f8b-96c6-8b455302d2f1", false);
  }, [patchDesignerStore]);
  const handleonClick_node_3722ba3c_aae1_4c32_b584_2aee771f7e3e = React.useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    let formData: FormData;
    const form = event.currentTarget instanceof HTMLFormElement ? event.currentTarget : event.currentTarget.closest('form');
    if (form) {
      formData = new FormData(form);
    } else {
      const regionRoot = document.querySelector("[data-designer-node-id=\"node-9b0ce52a-9c2f-4a7a-9f24-7988ed876951\"]");
      if (!regionRoot) {
        return;
      }
      formData = collectRegionFormDataFromContainer(regionRoot, ["form-base-info-record-1794246578710-2mxwv__isActive","form-base-info-record-1794246578710-2mxwv__parentId","form-base-info-record-1794246578710-2mxwv__childDigits","form-base-info-record-1794246578710-2mxwv__title","form-base-info-record-1794246578710-2mxwv__titleEn","form-base-info-record-1794246578710-2mxwv__titleFa","form-base-info-record-1794246578710-2mxwv__titleAr","form-base-info-record-1794246578710-2mxwv__shortName","form-base-info-record-1794246578710-2mxwv__note","form-base-info-record-1794246578710-2mxwv__noteEn","form-base-info-record-1794246578710-2mxwv__noteFa","form-base-info-record-1794246578710-2mxwv__noteAr","form-base-info-record-1794246578710-2mxwv__viewOrder","form-base-info-record-1794246578710-2mxwv__value","form-base-info-record-1794246578710-2mxwv__metadata","form-base-info-record-1794246578710-2mxwv__uiColor","form-base-info-record-1794246578710-2mxwv__uiHtml"]);
    }
    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {};
      payload["isActive"] = applyPayloadFieldTransform(formData.get("form-base-info-record-1794246578710-2mxwv__isActive"), "boolean");
      payload["parentId"] = formData.get("form-base-info-record-1794246578710-2mxwv__parentId") ?? '';
      payload["childDigits"] = formData.get("form-base-info-record-1794246578710-2mxwv__childDigits") ?? '';
      payload["title"] = formData.get("form-base-info-record-1794246578710-2mxwv__title") ?? '';
      payload["titleEn"] = formData.get("form-base-info-record-1794246578710-2mxwv__titleEn") ?? '';
      payload["titleFa"] = formData.get("form-base-info-record-1794246578710-2mxwv__titleFa") ?? '';
      payload["titleAr"] = formData.get("form-base-info-record-1794246578710-2mxwv__titleAr") ?? '';
      payload["shortName"] = formData.get("form-base-info-record-1794246578710-2mxwv__shortName") ?? '';
      payload["note"] = formData.get("form-base-info-record-1794246578710-2mxwv__note") ?? '';
      payload["noteEn"] = formData.get("form-base-info-record-1794246578710-2mxwv__noteEn") ?? '';
      payload["noteFa"] = formData.get("form-base-info-record-1794246578710-2mxwv__noteFa") ?? '';
      payload["noteAr"] = formData.get("form-base-info-record-1794246578710-2mxwv__noteAr") ?? '';
      payload["viewOrder"] = formData.get("form-base-info-record-1794246578710-2mxwv__viewOrder") ?? '';
      payload["value"] = formData.get("form-base-info-record-1794246578710-2mxwv__value") ?? '';
      payload["metadata"] = formData.get("form-base-info-record-1794246578710-2mxwv__metadata") ?? '';
      payload["uiColor"] = applyPayloadFieldTransform(formData.get("form-base-info-record-1794246578710-2mxwv__uiColor"), "nullableString");
      payload["uiHtml"] = applyPayloadFieldTransform(formData.get("form-base-info-record-1794246578710-2mxwv__uiHtml"), "nullableString");
      const method = regionData_vocabItems_node_9b0ce52a_9c2f_4a7a_9f24_7988ed876951?.id != null && String(regionData_vocabItems_node_9b0ce52a_9c2f_4a7a_9f24_7988ed876951?.id).length > 0 ? "PUT" : 'POST';
      const url = (regionData_vocabItems_node_9b0ce52a_9c2f_4a7a_9f24_7988ed876951?.id != null && String(regionData_vocabItems_node_9b0ce52a_9c2f_4a7a_9f24_7988ed876951?.id).length > 0 ? (regionData_vocabItems_node_9b0ce52a_9c2f_4a7a_9f24_7988ed876951?.id != null && String(regionData_vocabItems_node_9b0ce52a_9c2f_4a7a_9f24_7988ed876951?.id).length > 0 ? ("/api/base-info/" + encodeURIComponent(String(regionData_vocabItems_node_9b0ce52a_9c2f_4a7a_9f24_7988ed876951?.id)) + "") : "/api/base-info/:id") : "/api/base-info");
      const response = await designerFetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response));
      }
      patchDesignerStore("ui.visibility.node-a7b4729a-3609-4363-b922-e9a9d2823607", false);
      toast("Saved successfully", { variant: "success", timeout: 4000 });
      await refresh_gridData_heroui_app_table_grid_1794246578678_b3wxb();
    } catch (mutationFailure) {
      toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' });
    }
    finally {
      setIsSubmitting(false);
    }
  }, [regionData_vocabItems_node_9b0ce52a_9c2f_4a7a_9f24_7988ed876951]);
  const handleonClick_node_b0f1c429_4f00_45c5_aa49_54a28a9c8202 = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-a7b4729a-3609-4363-b922-e9a9d2823607", false);
  }, [patchDesignerStore]);
  const handleonClick_node_000a11f0_9e67_41e0_9c28_7c433cc3b208 = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-f497252a-02af-4ef8-85b1-7c531d51ae40", false);
  }, [patchDesignerStore]);
  const handleonClick_node_19183fff_45e6_4bcb_ae86_f70ff1e9b694 = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    void (async () => {
      let mutationOk_da_mw9k34ln_sk3w8 = true;
      try {
        const response = await designerFetch(("/api/base-info/" + encodeURIComponent(String(designerStore?.selection?.id)) + ""), {
          method: "DELETE",
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) {
          toast(await parseApiErrorMessage(response), { variant: 'danger' });
          mutationOk_da_mw9k34ln_sk3w8 = false;
        }
      } catch (mutationFailure) {
        toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' });
        mutationOk_da_mw9k34ln_sk3w8 = false;
      }
      if (mutationOk_da_mw9k34ln_sk3w8) {
        await refresh_gridData_heroui_app_table_grid_1794246578678_b3wxb();
        toast("Deleted", { variant: "success", timeout: 4000 });
        patchDesignerStore("ui.visibility.node-f497252a-02af-4ef8-85b1-7c531d51ae40", false);
      }
    })();
  }, [patchDesignerStore, refresh_gridData_heroui_app_table_grid_1794246578678_b3wxb]);
  return (
    <>
      <Toast.Provider />
      <div className="h-full min-h-0 w-full min-w-0 space-y-3">
        <div className="flex !min-h-0 flex-1 !items-stretch overflow-hidden">
          <div className="flex !h-full !min-h-0 w-[238px] shrink-0 self-stretch flex-col overflow-y-auto border-e border-slate-200 bg-slate-50 !p-4" style={{ width: '238px' }}>
            <div className="flex flex-col space-y-0.5">
              <Button className="workspace-section-nav-item relative inline-flex !w-full !items-center !justify-start gap-3 !rounded-lg border !px-3 !py-1.5 !text-start !text-sm !font-medium no-underline outline-none transition-colors [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 workspace-section-nav-item-active bg-violet-50/80 text-violet-950 border-violet-200 !shadow-sm [&_svg]:text-violet-600" type="button" aria-label="Voting statuses" variant="outline" size="sm" href="#" target="_self" onClick={handleonClick_heroui_button_outline_1794246578658_i90ia}><Vote className="h-3.5 w-3.5" /> Voting statuses</Button>
              <div className="my-0.5 border-t border-slate-200/90">
                <div />
              </div>
              <Button className="workspace-section-nav-item relative inline-flex !w-full !items-center !justify-start gap-3 !rounded-lg border !px-3 !py-1.5 !text-start !text-sm !font-medium no-underline outline-none transition-colors [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 [&_svg]:text-indigo-600" type="button" aria-label="Ballot types" variant="outline" size="sm" href="#" target="_self" onClick={handleonClick_heroui_button_outline_1794246578662_40sgv}><Layers className="h-3.5 w-3.5" /> Ballot types</Button>
              <Button className="workspace-section-nav-item relative inline-flex !w-full !items-center !justify-start gap-3 !rounded-lg border !px-3 !py-1.5 !text-start !text-sm !font-medium no-underline outline-none transition-colors [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 [&_svg]:text-sky-600" type="button" aria-label="Registration statuses" variant="outline" size="sm" href="#" target="_self" onClick={handleonClick_heroui_button_outline_1794246578665_ibu2y}><UserCheck className="h-3.5 w-3.5" /> Registration statuses</Button>
              <div className="my-0.5 border-t border-slate-200/90">
                <div />
              </div>
              <Button className="workspace-section-nav-item relative inline-flex !w-full !items-center !justify-start gap-3 !rounded-lg border !px-3 !py-1.5 !text-start !text-sm !font-medium no-underline outline-none transition-colors [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 [&_svg]:text-emerald-600" type="button" aria-label="Observer roles" variant="outline" size="sm" href="#" target="_self" onClick={handleonClick_heroui_button_outline_1794246578668_zwfmz}><Eye className="h-3.5 w-3.5" /> Observer roles</Button>
              <Button className="workspace-section-nav-item relative inline-flex !w-full !items-center !justify-start gap-3 !rounded-lg border !px-3 !py-1.5 !text-start !text-sm !font-medium no-underline outline-none transition-colors [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 [&_svg]:text-amber-600" type="button" aria-label="Cast channels" variant="outline" size="sm" href="#" target="_self" onClick={handleonClick_heroui_button_outline_1794246578672_5l7vm}><Radio className="h-3.5 w-3.5" /> Cast channels</Button>
            </div>
          </div>
          <div className="flex !min-h-0 !min-w-0 flex-1 flex-col overflow-hidden bg-white">
            <ListPageShell className="flex min-h-0 w-full flex-1 flex-col"><ListPageToolbarFrame><div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}><input type="text" value={gridSearchInput_heroui_app_table_grid_1794246578678_b3wxb} onChange={(event) => handleGridSearchChange_heroui_app_table_grid_1794246578678_b3wxb(event.target.value)} placeholder={"Search voting statuses…"} className="h-8 rounded-md border border-slate-200 px-2 text-sm" /></div><div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}><button type="button" onClick={() => { patchDesignerStore("selection.id", null); patchDesignerStore("ui.visibility.node-fb55ca6e-1c5f-4f8b-96c6-8b455302d2f1", true); }} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700">Create voting statuse</button><span className="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold tabular-nums text-slate-700" aria-live="polite">{gridTotalCount_heroui_app_table_grid_1794246578678_b3wxb.toLocaleString()}</span><button type="button" onClick={() => { void refresh_gridData_heroui_app_table_grid_1794246578678_b3wxb(); }} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">Refresh</button></div></ListPageToolbarFrame><AppTableGrid className="flex !h-full !min-h-0 !w-full flex-1 flex-col" showPagingFooter={false} presentation="cards" cardBelow="tablet" size="sm" columns={gridColumns_heroui_app_table_grid_1794246578678_b3wxb} rows={gridPaging_heroui_app_table_grid_1794246578678_b3wxb.displayRows} getRowKey={(row) => String((row as Record<string, unknown>)["id"] ?? '')} enableColumnLayout={false} columnLayout={gridColumnLayout_heroui_app_table_grid_1794246578678_b3wxb} onColumnLayoutChange={setGridColumnLayout_heroui_app_table_grid_1794246578678_b3wxb} isLoading={isLoading_gridData_heroui_app_table_grid_1794246578678_b3wxb} loadingMessage={"Loading voting statuses…"} emptyMessage={"No voting statuses found."} isEmpty={gridAggregatedRows_heroui_app_table_grid_1794246578678_b3wxb.length === 0} errorContent={(error_gridData_heroui_app_table_grid_1794246578678_b3wxb ? "Could not load voting statuses." : undefined)} gridQueryMode={"server"} query={gridQuery_heroui_app_table_grid_1794246578678_b3wxb} onQueryChange={handleGridQueryChange_heroui_app_table_grid_1794246578678_b3wxb} onGridRowAction={handleGridRowAction_heroui_app_table_grid_1794246578678_b3wxb} footer={<GridPagingFooter totalCount={gridTotalCount_heroui_app_table_grid_1794246578678_b3wxb} safePage={gridPaging_heroui_app_table_grid_1794246578678_b3wxb.safePage} pageSize={gridPageSize_heroui_app_table_grid_1794246578678_b3wxb} onPageSizeChange={handleGridPageSizeChange_heroui_app_table_grid_1794246578678_b3wxb} sortBy={gridQuery_heroui_app_table_grid_1794246578678_b3wxb.sort?.columnId ?? ''} sortOptions={[{"value":"title","label":"Title"},{"value":"short_name","label":"Short name"},{"value":"view_order","label":"Order"},{"value":"is_active","label":"Active"}]} onSortByChange={handleGridSortByChange_heroui_app_table_grid_1794246578678_b3wxb} sortDirection={gridQuery_heroui_app_table_grid_1794246578678_b3wxb.sort?.direction ?? 'asc'} onToggleSortDirection={handleGridToggleSortDirection_heroui_app_table_grid_1794246578678_b3wxb} showSortControls={false} totalPages={gridPaging_heroui_app_table_grid_1794246578678_b3wxb.totalPages} pageNumbers={buildDataGridPageNumbers(gridPaging_heroui_app_table_grid_1794246578678_b3wxb.safePage, gridPaging_heroui_app_table_grid_1794246578678_b3wxb.totalPages)} onPageChange={handleGridPageChange_heroui_app_table_grid_1794246578678_b3wxb} visibleInfiniteCount={gridListMode_heroui_app_table_grid_1794246578678_b3wxb === 'infinite' ? gridPaging_heroui_app_table_grid_1794246578678_b3wxb.displayRows.length : undefined} />} /></ListPageShell>
          </div>
        </div>
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "(store.ui.visibility.node-fb55ca6e-1c5f-4f8b-96c6-8b455302d2f1 === true) && (store.ui.visibility.node-fb55ca6e-1c5f-4f8b-96c6-8b455302d2f1 !== false)") && (
          <CreateEditModalShell title={"Create Voting statuse"} size="5xl" onClose={() => { patchDesignerStore("ui.visibility.node-fb55ca6e-1c5f-4f8b-96c6-8b455302d2f1", false); }} onBackdropClick={() => { patchDesignerStore("ui.visibility.node-fb55ca6e-1c5f-4f8b-96c6-8b455302d2f1", false); }} gradient={false} bodyOuterClassName="-mb-[15px]" bodyClassName="!p-0" footerClassName="!mt-0">
            <form className="flex !min-h-0 flex-col gap-0 bg-white" method="post" id="node-3eff70f6-02ee-4177-8f49-39e0b6c25ee2" data-designer-node-id="node-3eff70f6-02ee-4177-8f49-39e0b6c25ee2">
              <div className="flex !min-w-0 flex-col gap-2 bg-white p-[15px]">
                <DesignerBaseInfoRecordFormField className="!w-full !min-w-0" />
              </div>
            </form>
            <div className="flex !w-full shrink-0 !items-center !justify-end gap-2">
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 border border-slate-200 text-slate-600 hover:bg-slate-100" variant="outline" size="md" onClick={handleonClick_node_c7a0b773_252e_4290_be9b_2d780605b7c3}><X className="h-3.5 w-3.5" /> Cancel</Button>
              <Button type="submit" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 bg-primary-600 hover:bg-primary-700 text-white" form="node-3eff70f6-02ee-4177-8f49-39e0b6c25ee2" variant="primary" size="md" href="#" target="_self" isDisabled={isSubmitting} onClick={handleonClick_node_2869b29a_a653_4bbd_9a71_8486f2c2a0cd}><Plus className="h-3.5 w-3.5" /> Create Voting statuse</Button>
            </div>
          </CreateEditModalShell>
        )}
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "(store.ui.visibility.node-a7b4729a-3609-4363-b922-e9a9d2823607 === true) && (store.ui.visibility.node-a7b4729a-3609-4363-b922-e9a9d2823607 !== false)") && (
          <CreateEditModalShell title={"Edit Voting statuse"} size="5xl" onClose={() => { patchDesignerStore("ui.visibility.node-a7b4729a-3609-4363-b922-e9a9d2823607", false); }} onBackdropClick={() => { patchDesignerStore("ui.visibility.node-a7b4729a-3609-4363-b922-e9a9d2823607", false); }} gradient={false} bodyOuterClassName="-mb-[15px]" bodyClassName="!p-0" footerClassName="!mt-0">
            <form className="flex !min-h-0 flex-col gap-0 bg-white" method="post" id="node-9b0ce52a-9c2f-4a7a-9f24-7988ed876951" data-designer-node-id="node-9b0ce52a-9c2f-4a7a-9f24-7988ed876951">
              <div className="flex !min-w-0 flex-col gap-2 bg-white p-[15px]">
                <DesignerBaseInfoRecordFormField className="!w-full !min-w-0" />
              </div>
            </form>
            <div className="flex !w-full shrink-0 !items-center !justify-end gap-2">
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 border border-slate-200 text-slate-600 hover:bg-slate-100" variant="outline" size="md" onClick={handleonClick_node_b0f1c429_4f00_45c5_aa49_54a28a9c8202}><X className="h-3.5 w-3.5" /> Cancel</Button>
              <Button type="submit" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 bg-primary-600 hover:bg-primary-700 text-white" form="node-9b0ce52a-9c2f-4a7a-9f24-7988ed876951" variant="primary" size="md" href="#" target="_self" isDisabled={isSubmitting} onClick={handleonClick_node_3722ba3c_aae1_4c32_b584_2aee771f7e3e}><Save className="h-3.5 w-3.5" /> Save</Button>
            </div>
          </CreateEditModalShell>
        )}
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "(store.ui.visibility.node-f497252a-02af-4ef8-85b1-7c531d51ae40 === true) && (store.ui.visibility.node-f497252a-02af-4ef8-85b1-7c531d51ae40 !== false)") && (
          <ConfirmDialogShell title={"Delete Voting statuse?"} size="sm" onClose={() => { patchDesignerStore("ui.visibility.node-f497252a-02af-4ef8-85b1-7c531d51ae40", false); }} onBackdropClick={() => { patchDesignerStore("ui.visibility.node-f497252a-02af-4ef8-85b1-7c531d51ae40", false); }} tone="danger" hideCancel hideConfirm icon={<Trash2 className="h-4 w-4" />} bodyClassName="!p-0" footerClassName="!mt-0">
            <p className="block p-[15px] !text-sm text-slate-700">Delete this voting statuse? This cannot be undone.</p>
            <div className="flex !w-full shrink-0 !items-center !justify-end gap-2">
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 border border-slate-200 text-slate-600 hover:bg-slate-100" variant="outline" size="md" onClick={handleonClick_node_000a11f0_9e67_41e0_9c28_7c433cc3b208}><X className="h-3.5 w-3.5" /> Cancel</Button>
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 bg-rose-600 hover:bg-rose-700 text-white" variant="primary" size="md" onClick={handleonClick_node_19183fff_45e6_4bcb_ae86_f70ff1e9b694}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
            </div>
          </ConfirmDialogShell>
        )}
      </div>
    </>
  );
};
