import React from 'react';
import { useNavigate } from 'react-router-dom';
import { buildAppTableGridColumns } from '@/domain/component-designer/DesignerRuntimeAppTableGrid';
import { applyClientGridQuery, EMPTY_GRID_QUERY, type GridQueryState } from '@/shared/lib/appTableGridQuery';
import { resolveDataGridTotalCount, sliceDataGridRowsForDisplay, buildDataGridPageNumbers, applyGridAggregation } from '@/domain/component-designer/designerDataGridRuntime';
import { applyDesignerGridToolbarClientFilters } from '@/domain/component-designer/designerGridToolbarConfig';
import { createDefaultColumnLayout } from '@/shared/lib/appTableGridColumnLayout';
import { DesignerBaseInfoRecordFormField } from '@/domain/component-designer/DesignerBaseInfoRecordFormField';
import { AppTableGrid, ConfirmDialogShell, CreateEditModalShell, GridPagingFooter, ToolbarFilterSelect, UiCheckbox } from '@/shared/ui';
import { Button, Toast, toast } from '@heroui/react';
import { BadgeCheck, BookUser, Briefcase, Building2, FileImage, GraduationCap, Hammer, Landmark, Plus, Route, Save, School, Shield, StickyNote, Trash2, Users, X } from 'lucide-react';

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
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : raw;
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
  const navigate = useNavigate();
  const { store: designerStore, patch: patchDesignerStore } = useDesignerStore<Record<string, unknown>>({"selection":{"id":null}});
  const { data: raw_regionData_vocabItems_node_efc1fa98_5cee_43ea_ba9b_5103dec5684a, isLoading: isLoading_regionData_vocabItems_node_efc1fa98_5cee_43ea_ba9b_5103dec5684a, error: error_regionData_vocabItems_node_efc1fa98_5cee_43ea_ba9b_5103dec5684a, refresh: refresh_regionData_vocabItems_node_efc1fa98_5cee_43ea_ba9b_5103dec5684a } = useDataFetch<unknown>(resolveBindingUrl("/api/base-info/:id", designerStore, { "id": "selection.id" }), {});
  const regionData_vocabItems_node_efc1fa98_5cee_43ea_ba9b_5103dec5684a = React.useMemo(() => coerceApiRecordValue(applyResponseDataPath(raw_regionData_vocabItems_node_efc1fa98_5cee_43ea_ba9b_5103dec5684a, {"dataPath":"items","arrayPath":"items","totalPath":"count"})), [raw_regionData_vocabItems_node_efc1fa98_5cee_43ea_ba9b_5103dec5684a]);
  const handleGridRowAction_heroui_app_table_grid_1789615844597_v6jyv = React.useCallback((row: Record<string, unknown>, actionId: string) => {
    switch (actionId) {
      case "edit": {
        patchDesignerStore("selection.id", row["id"] ?? null);
        patchDesignerStore("ui.visibility.node-02a9fcf4-89c4-4a92-9fb6-b4e4b03ac1f6", true);
        return;
      }
      case "delete": {
        patchDesignerStore("selection.id", row["id"] ?? null);
        patchDesignerStore("ui.visibility.node-83970786-d0e0-4209-bfa1-14874de16c9d", true);
        return;
      }
      default:
        return;
    }
  }, [patchDesignerStore]);
  const { data: raw_gridData_heroui_app_table_grid_1789615844597_v6jyv, isLoading: isLoading_gridData_heroui_app_table_grid_1789615844597_v6jyv, error: error_gridData_heroui_app_table_grid_1789615844597_v6jyv, refresh: refresh_gridData_heroui_app_table_grid_1789615844597_v6jyv } = useDataFetch<unknown>(resolveBindingUrl("/api/base-info/children?parentId=220.013&includeInactive=true", designerStore, { "search": "gridToolbar.search", "sortBy": "gridQuery.sortBy", "sortDir": "gridQuery.sortDir", "page": "gridQuery.page", "pageSize": "gridQuery.pageSize" }), {});
  const gridData_heroui_app_table_grid_1789615844597_v6jyv = React.useMemo(() => applyResponseDataPath(raw_gridData_heroui_app_table_grid_1789615844597_v6jyv, {"dataPath":"items","arrayPath":"items","totalPath":"count"}), [raw_gridData_heroui_app_table_grid_1789615844597_v6jyv]);
  const gridColumns_heroui_app_table_grid_1789615844597_v6jyv = React.useMemo(() => buildAppTableGridColumns([{"key":"ui_color","label":"","cellKind":"color-swatch","cardRole":"meta","cardPriority":-1},{"key":"title","label":"Title","sort":true,"cardRole":"title"},{"key":"short_name","label":"Short name","sort":true,"cardRole":"hidden"},{"key":"view_order","label":"Order","sort":true,"cardRole":"hidden"},{"key":"is_active","label":"Active","sort":true,"cellKind":"boolean-icon","cardRole":"hidden"},{"key":"actions","label":"","kind":"action-group","actions":[{"actionId":"edit","icon":"Pencil","intent":"edit","tooltip":"Edit","behavior":{"kind":"open-modal","modalNodeId":"node-02a9fcf4-89c4-4a92-9fb6-b4e4b03ac1f6","primaryKeyField":"id","selectionStorePath":"selection.id"}},{"actionId":"delete","icon":"Trash2","intent":"delete","tooltip":"Delete","behavior":{"kind":"open-modal","modalNodeId":"node-83970786-d0e0-4209-bfa1-14874de16c9d","primaryKeyField":"id","selectionStorePath":"selection.id"}}],"maxVisibleActions":3,"cardRole":"actions","layoutHideable":false,"layoutResizable":false,"layoutReorderable":false,"width":"57px"}], "server", {
    mode: 'runtime',
    detailFlowRef: { current: null },
    rowActionHandlerRef: { current: handleGridRowAction_heroui_app_table_grid_1789615844597_v6jyv },
    cellClickHandlerRef: { current: undefined },
    designerStoreRef: { current: designerStore },
  }), [designerStore, handleGridRowAction_heroui_app_table_grid_1789615844597_v6jyv]);
  const [gridQuery_heroui_app_table_grid_1789615844597_v6jyv, setGridQuery_heroui_app_table_grid_1789615844597_v6jyv] = React.useState<GridQueryState>(() => ({ ...EMPTY_GRID_QUERY, sort: { columnId: "view_order", direction: "asc" } }));
  const [gridPage_heroui_app_table_grid_1789615844597_v6jyv, setGridPage_heroui_app_table_grid_1789615844597_v6jyv] = React.useState(1);
  const [gridPageSize_heroui_app_table_grid_1789615844597_v6jyv, setGridPageSize_heroui_app_table_grid_1789615844597_v6jyv] = React.useState(1000);
  const [gridListMode_heroui_app_table_grid_1789615844597_v6jyv, setGridListMode_heroui_app_table_grid_1789615844597_v6jyv] = React.useState<'paging' | 'infinite'>("paging");
  const [gridColumnLayout_heroui_app_table_grid_1789615844597_v6jyv, setGridColumnLayout_heroui_app_table_grid_1789615844597_v6jyv] = React.useState(() => createDefaultColumnLayout(gridColumns_heroui_app_table_grid_1789615844597_v6jyv));
  const [gridSearchInput_heroui_app_table_grid_1789615844597_v6jyv, setGridSearchInput_heroui_app_table_grid_1789615844597_v6jyv] = React.useState('');
  const [gridDebouncedSearch_heroui_app_table_grid_1789615844597_v6jyv, setGridDebouncedSearch_heroui_app_table_grid_1789615844597_v6jyv] = React.useState('');
  const [gridCheckboxSelections_heroui_app_table_grid_1789615844597_v6jyv, setGridCheckboxSelections_heroui_app_table_grid_1789615844597_v6jyv] = React.useState<Record<string, Record<string, boolean>>>({});
  const [gridRadioSelections_heroui_app_table_grid_1789615844597_v6jyv, setGridRadioSelections_heroui_app_table_grid_1789615844597_v6jyv] = React.useState<Record<string, string>>({});
  const [gridMatchLogic_heroui_app_table_grid_1789615844597_v6jyv, setGridMatchLogic_heroui_app_table_grid_1789615844597_v6jyv] = React.useState<Record<string, 'and' | 'or'>>({});
  const gridRoleFilters_heroui_app_table_grid_1789615844597_v6jyv = {};
  const gridFilteredRows_heroui_app_table_grid_1789615844597_v6jyv = React.useMemo(() => applyClientGridQuery(((Array.isArray(gridData_heroui_app_table_grid_1789615844597_v6jyv) ? gridData_heroui_app_table_grid_1789615844597_v6jyv : []) ?? []), gridQuery_heroui_app_table_grid_1789615844597_v6jyv, gridColumns_heroui_app_table_grid_1789615844597_v6jyv, "server"), [gridQuery_heroui_app_table_grid_1789615844597_v6jyv, gridColumns_heroui_app_table_grid_1789615844597_v6jyv]);
  const gridAggregatedRows_heroui_app_table_grid_1789615844597_v6jyv = gridFilteredRows_heroui_app_table_grid_1789615844597_v6jyv;
  const gridApiTotal_heroui_app_table_grid_1789615844597_v6jyv = React.useMemo(() => {
    const raw = raw_gridData_heroui_app_table_grid_1789615844597_v6jyv;
    const value = readNestedContextValue((raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}), "count");
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
  }, [raw_gridData_heroui_app_table_grid_1789615844597_v6jyv]);
  const gridTotalCount_heroui_app_table_grid_1789615844597_v6jyv = resolveDataGridTotalCount({ page: gridPage_heroui_app_table_grid_1789615844597_v6jyv, pageSize: gridPageSize_heroui_app_table_grid_1789615844597_v6jyv, total: gridApiTotal_heroui_app_table_grid_1789615844597_v6jyv, gridQueryMode: "server" }, gridAggregatedRows_heroui_app_table_grid_1789615844597_v6jyv.length);
  const gridPaging_heroui_app_table_grid_1789615844597_v6jyv = sliceDataGridRowsForDisplay(gridAggregatedRows_heroui_app_table_grid_1789615844597_v6jyv, gridPage_heroui_app_table_grid_1789615844597_v6jyv, gridPageSize_heroui_app_table_grid_1789615844597_v6jyv, gridTotalCount_heroui_app_table_grid_1789615844597_v6jyv, "server");
  const handleGridQueryChange_heroui_app_table_grid_1789615844597_v6jyv = React.useCallback((nextQuery: GridQueryState) => {
    setGridQuery_heroui_app_table_grid_1789615844597_v6jyv(nextQuery);
    setGridPage_heroui_app_table_grid_1789615844597_v6jyv(1);
    patchDesignerStore("gridQuery.sortBy", nextQuery.sort?.columnId ?? '');
    patchDesignerStore("gridQuery.sortDir", nextQuery.sort?.direction ?? '');
  }, [patchDesignerStore]);
  const handleGridPageChange_heroui_app_table_grid_1789615844597_v6jyv = React.useCallback((nextPage: number) => {
    setGridPage_heroui_app_table_grid_1789615844597_v6jyv(nextPage);
    patchDesignerStore("gridQuery.page", nextPage);
  }, [patchDesignerStore]);
  const handleGridPageSizeChange_heroui_app_table_grid_1789615844597_v6jyv = React.useCallback((nextSize: number) => {
    setGridPageSize_heroui_app_table_grid_1789615844597_v6jyv(nextSize);
    setGridPage_heroui_app_table_grid_1789615844597_v6jyv(1);
    patchDesignerStore("gridQuery.pageSize", nextSize);
  }, [patchDesignerStore]);
  const handleGridSortByChange_heroui_app_table_grid_1789615844597_v6jyv = React.useCallback((nextSortBy: string) => {
    setGridQuery_heroui_app_table_grid_1789615844597_v6jyv((current: GridQueryState) => ({ ...current, sort: nextSortBy ? { columnId: nextSortBy, direction: current.sort?.direction ?? 'asc' } : null }));
  }, []);
  const handleGridToggleSortDirection_heroui_app_table_grid_1789615844597_v6jyv = React.useCallback(() => {
    setGridQuery_heroui_app_table_grid_1789615844597_v6jyv((current: GridQueryState) => (current.sort ? { ...current, sort: { ...current.sort, direction: current.sort.direction === 'asc' ? 'desc' : 'asc' } } : current));
  }, []);
  const searchDebounceTimer_heroui_app_table_grid_1789615844597_v6jyv = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleGridSearchChange_heroui_app_table_grid_1789615844597_v6jyv = React.useCallback((nextValue: string) => {
    setGridSearchInput_heroui_app_table_grid_1789615844597_v6jyv(nextValue);
    if (searchDebounceTimer_heroui_app_table_grid_1789615844597_v6jyv.current) {
      clearTimeout(searchDebounceTimer_heroui_app_table_grid_1789615844597_v6jyv.current);
    }
    searchDebounceTimer_heroui_app_table_grid_1789615844597_v6jyv.current = setTimeout(() => {
      setGridDebouncedSearch_heroui_app_table_grid_1789615844597_v6jyv(nextValue);
      setGridPage_heroui_app_table_grid_1789615844597_v6jyv(1);
      patchDesignerStore("gridToolbar.search", nextValue);
    }, 300);
  }, [patchDesignerStore]);

  const dataContext: Record<string, unknown> | null = null;
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const handleonClick_heroui_button_outline_1789615844578_simnn = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    navigate("/studio/hwy/settings/membership-status", { replace: false });
  }, [navigate]);
  const handleonClick_heroui_button_outline_1789615844578_oiahm = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    navigate("/studio/hwy/settings/file-kinds", { replace: false });
  }, [navigate]);
  const handleonClick_heroui_button_outline_1789615844579_snw2a = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    navigate("/studio/hwy/settings/institute-membership", { replace: false });
  }, [navigate]);
  const handleonClick_heroui_button_outline_1789615844580_fm4p3 = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    navigate("/studio/hwy/settings/join-path", { replace: false });
  }, [navigate]);
  const handleonClick_heroui_button_outline_1789615844581_t137i = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    navigate("/studio/hwy/settings/nakhebin-link", { replace: false });
  }, [navigate]);
  const handleonClick_heroui_button_outline_1789615844582_12vlp = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    navigate("/studio/hwy/settings/note-subjects", { replace: false });
  }, [navigate]);
  const handleonClick_heroui_button_outline_1789615844583_4nv8o = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    navigate("/studio/hwy/settings/security-clearance", { replace: false });
  }, [navigate]);
  const handleonClick_heroui_button_outline_1789615844585_mvv7j = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    navigate("/studio/hwy/settings/institute-character", { replace: false });
  }, [navigate]);
  const handleonClick_heroui_button_outline_1789615844587_86rye = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    navigate("/studio/hwy/settings/institute-affairs", { replace: false });
  }, [navigate]);
  const handleonClick_heroui_button_outline_1789615844589_bpr3p = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    navigate("/studio/hwy/settings/education-level", { replace: false });
  }, [navigate]);
  const handleonClick_heroui_button_outline_1789615844591_2llll = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    navigate("/studio/hwy/settings/education-stage", { replace: false });
  }, [navigate]);
  const handleonClick_heroui_button_outline_1789615844593_926h7 = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    navigate("/studio/hwy/settings/education-university", { replace: false });
  }, [navigate]);
  const handleonClick_heroui_button_outline_1789615844594_ivq8z = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    navigate("/studio/hwy/settings/job-type", { replace: false });
  }, [navigate]);
  const handleonClick_node_d18feef6_6f0f_4992_bd6e_f838897559ee = React.useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    let formData: FormData;
    const form = event.currentTarget instanceof HTMLFormElement ? event.currentTarget : event.currentTarget.closest('form');
    if (form) {
      formData = new FormData(form);
    } else {
      const regionRoot = document.querySelector("[data-designer-node-id=\"node-8f1fff52-1f87-42fc-a438-9555c69ac78a\"]");
      if (!regionRoot) {
        return;
      }
      formData = collectRegionFormDataFromContainer(regionRoot, ["form-base-info-record-1789615844602-uwaif__isActive","form-base-info-record-1789615844602-uwaif__parentId","form-base-info-record-1789615844602-uwaif__childDigits","form-base-info-record-1789615844602-uwaif__title","form-base-info-record-1789615844602-uwaif__titleEn","form-base-info-record-1789615844602-uwaif__titleFa","form-base-info-record-1789615844602-uwaif__titleAr","form-base-info-record-1789615844602-uwaif__shortName","form-base-info-record-1789615844602-uwaif__note","form-base-info-record-1789615844602-uwaif__noteEn","form-base-info-record-1789615844602-uwaif__noteFa","form-base-info-record-1789615844602-uwaif__noteAr","form-base-info-record-1789615844602-uwaif__viewOrder","form-base-info-record-1789615844602-uwaif__value","form-base-info-record-1789615844602-uwaif__metadata","form-base-info-record-1789615844602-uwaif__uiColor","form-base-info-record-1789615844602-uwaif__uiHtml"]);
    }
    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {};
      payload["isActive"] = applyPayloadFieldTransform(formData.get("form-base-info-record-1789615844602-uwaif__isActive"), "boolean");
      payload["parentId"] = formData.get("form-base-info-record-1789615844602-uwaif__parentId") ?? '';
      payload["childDigits"] = formData.get("form-base-info-record-1789615844602-uwaif__childDigits") ?? '';
      payload["title"] = formData.get("form-base-info-record-1789615844602-uwaif__title") ?? '';
      payload["titleEn"] = formData.get("form-base-info-record-1789615844602-uwaif__titleEn") ?? '';
      payload["titleFa"] = formData.get("form-base-info-record-1789615844602-uwaif__titleFa") ?? '';
      payload["titleAr"] = formData.get("form-base-info-record-1789615844602-uwaif__titleAr") ?? '';
      payload["shortName"] = formData.get("form-base-info-record-1789615844602-uwaif__shortName") ?? '';
      payload["note"] = formData.get("form-base-info-record-1789615844602-uwaif__note") ?? '';
      payload["noteEn"] = formData.get("form-base-info-record-1789615844602-uwaif__noteEn") ?? '';
      payload["noteFa"] = formData.get("form-base-info-record-1789615844602-uwaif__noteFa") ?? '';
      payload["noteAr"] = formData.get("form-base-info-record-1789615844602-uwaif__noteAr") ?? '';
      payload["viewOrder"] = formData.get("form-base-info-record-1789615844602-uwaif__viewOrder") ?? '';
      payload["value"] = formData.get("form-base-info-record-1789615844602-uwaif__value") ?? '';
      payload["metadata"] = formData.get("form-base-info-record-1789615844602-uwaif__metadata") ?? '';
      payload["uiColor"] = applyPayloadFieldTransform(formData.get("form-base-info-record-1789615844602-uwaif__uiColor"), "nullableString");
      payload["uiHtml"] = applyPayloadFieldTransform(formData.get("form-base-info-record-1789615844602-uwaif__uiHtml"), "nullableString");
      const method = regionData_vocabItems_node_8f1fff52_1f87_42fc_a438_9555c69ac78a?.id != null && String(regionData_vocabItems_node_8f1fff52_1f87_42fc_a438_9555c69ac78a?.id).length > 0 ? "PUT" : 'POST';
      const url = (regionData_vocabItems_node_8f1fff52_1f87_42fc_a438_9555c69ac78a?.id != null && String(regionData_vocabItems_node_8f1fff52_1f87_42fc_a438_9555c69ac78a?.id).length > 0 ? (regionData_vocabItems_node_8f1fff52_1f87_42fc_a438_9555c69ac78a?.id != null && String(regionData_vocabItems_node_8f1fff52_1f87_42fc_a438_9555c69ac78a?.id).length > 0 ? ("/api/base-info/" + encodeURIComponent(String(regionData_vocabItems_node_8f1fff52_1f87_42fc_a438_9555c69ac78a?.id)) + "") : "/api/base-info/:id") : "/api/base-info");
      const response = await designerFetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response));
      }
      patchDesignerStore("ui.visibility.node-cfc01940-8b1e-4e8d-b8ec-b7bc27a4718f", false);
      toast("Saved successfully", { variant: "success", timeout: 4000 });
      await refresh_gridData_heroui_app_table_grid_1789615844597_v6jyv();
      (document.querySelector("[data-designer-node-id=\"node-8f1fff52-1f87-42fc-a438-9555c69ac78a\"]") as HTMLFormElement | null)?.reset?.();
    } catch (mutationFailure) {
      toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' });
    }
    finally {
      setIsSubmitting(false);
    }
  }, [regionData_vocabItems_node_8f1fff52_1f87_42fc_a438_9555c69ac78a]);
  const handleonClick_node_42fb8cbe_eb41_42dd_9df5_d64036d98cfb = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-cfc01940-8b1e-4e8d-b8ec-b7bc27a4718f", false);
  }, [patchDesignerStore]);
  const handleonClick_node_83f77fb7_0115_4724_8794_64f81064ccb8 = React.useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    let formData: FormData;
    const form = event.currentTarget instanceof HTMLFormElement ? event.currentTarget : event.currentTarget.closest('form');
    if (form) {
      formData = new FormData(form);
    } else {
      const regionRoot = document.querySelector("[data-designer-node-id=\"node-efc1fa98-5cee-43ea-ba9b-5103dec5684a\"]");
      if (!regionRoot) {
        return;
      }
      formData = collectRegionFormDataFromContainer(regionRoot, ["form-base-info-record-1789615844604-qd5ev__isActive","form-base-info-record-1789615844604-qd5ev__parentId","form-base-info-record-1789615844604-qd5ev__childDigits","form-base-info-record-1789615844604-qd5ev__title","form-base-info-record-1789615844604-qd5ev__titleEn","form-base-info-record-1789615844604-qd5ev__titleFa","form-base-info-record-1789615844604-qd5ev__titleAr","form-base-info-record-1789615844604-qd5ev__shortName","form-base-info-record-1789615844604-qd5ev__note","form-base-info-record-1789615844604-qd5ev__noteEn","form-base-info-record-1789615844604-qd5ev__noteFa","form-base-info-record-1789615844604-qd5ev__noteAr","form-base-info-record-1789615844604-qd5ev__viewOrder","form-base-info-record-1789615844604-qd5ev__value","form-base-info-record-1789615844604-qd5ev__metadata","form-base-info-record-1789615844604-qd5ev__uiColor","form-base-info-record-1789615844604-qd5ev__uiHtml"]);
    }
    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {};
      payload["isActive"] = applyPayloadFieldTransform(formData.get("form-base-info-record-1789615844604-qd5ev__isActive"), "boolean");
      payload["parentId"] = formData.get("form-base-info-record-1789615844604-qd5ev__parentId") ?? '';
      payload["childDigits"] = formData.get("form-base-info-record-1789615844604-qd5ev__childDigits") ?? '';
      payload["title"] = formData.get("form-base-info-record-1789615844604-qd5ev__title") ?? '';
      payload["titleEn"] = formData.get("form-base-info-record-1789615844604-qd5ev__titleEn") ?? '';
      payload["titleFa"] = formData.get("form-base-info-record-1789615844604-qd5ev__titleFa") ?? '';
      payload["titleAr"] = formData.get("form-base-info-record-1789615844604-qd5ev__titleAr") ?? '';
      payload["shortName"] = formData.get("form-base-info-record-1789615844604-qd5ev__shortName") ?? '';
      payload["note"] = formData.get("form-base-info-record-1789615844604-qd5ev__note") ?? '';
      payload["noteEn"] = formData.get("form-base-info-record-1789615844604-qd5ev__noteEn") ?? '';
      payload["noteFa"] = formData.get("form-base-info-record-1789615844604-qd5ev__noteFa") ?? '';
      payload["noteAr"] = formData.get("form-base-info-record-1789615844604-qd5ev__noteAr") ?? '';
      payload["viewOrder"] = formData.get("form-base-info-record-1789615844604-qd5ev__viewOrder") ?? '';
      payload["value"] = formData.get("form-base-info-record-1789615844604-qd5ev__value") ?? '';
      payload["metadata"] = formData.get("form-base-info-record-1789615844604-qd5ev__metadata") ?? '';
      payload["uiColor"] = applyPayloadFieldTransform(formData.get("form-base-info-record-1789615844604-qd5ev__uiColor"), "nullableString");
      payload["uiHtml"] = applyPayloadFieldTransform(formData.get("form-base-info-record-1789615844604-qd5ev__uiHtml"), "nullableString");
      const method = regionData_vocabItems_node_efc1fa98_5cee_43ea_ba9b_5103dec5684a?.id != null && String(regionData_vocabItems_node_efc1fa98_5cee_43ea_ba9b_5103dec5684a?.id).length > 0 ? "PUT" : 'POST';
      const url = (regionData_vocabItems_node_efc1fa98_5cee_43ea_ba9b_5103dec5684a?.id != null && String(regionData_vocabItems_node_efc1fa98_5cee_43ea_ba9b_5103dec5684a?.id).length > 0 ? (regionData_vocabItems_node_efc1fa98_5cee_43ea_ba9b_5103dec5684a?.id != null && String(regionData_vocabItems_node_efc1fa98_5cee_43ea_ba9b_5103dec5684a?.id).length > 0 ? ("/api/base-info/" + encodeURIComponent(String(regionData_vocabItems_node_efc1fa98_5cee_43ea_ba9b_5103dec5684a?.id)) + "") : "/api/base-info/:id") : "/api/base-info");
      const response = await designerFetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response));
      }
      patchDesignerStore("ui.visibility.node-02a9fcf4-89c4-4a92-9fb6-b4e4b03ac1f6", false);
      toast("Saved successfully", { variant: "success", timeout: 4000 });
      await refresh_gridData_heroui_app_table_grid_1789615844597_v6jyv();
    } catch (mutationFailure) {
      toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' });
    }
    finally {
      setIsSubmitting(false);
    }
  }, [regionData_vocabItems_node_efc1fa98_5cee_43ea_ba9b_5103dec5684a]);
  const handleonClick_node_68f963e1_4854_468d_83b4_5a7ff867d67e = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-02a9fcf4-89c4-4a92-9fb6-b4e4b03ac1f6", false);
  }, [patchDesignerStore]);
  const handleonClick_node_bc3b8703_ae84_4a4d_9e43_ed6623d8665e = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-83970786-d0e0-4209-bfa1-14874de16c9d", false);
  }, [patchDesignerStore]);
  const handleonClick_node_ea4ff05d_bbdb_4539_8509_91e509aec1a7 = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    void (async () => {
      let mutationOk_da_mu4z2fay_k0zis = true;
      try {
        const response = await designerFetch(("/api/base-info/" + encodeURIComponent(String(designerStore?.selection?.id)) + ""), {
          method: "DELETE",
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) {
          toast(await parseApiErrorMessage(response), { variant: 'danger' });
          mutationOk_da_mu4z2fay_k0zis = false;
        }
      } catch (mutationFailure) {
        toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' });
        mutationOk_da_mu4z2fay_k0zis = false;
      }
      if (mutationOk_da_mu4z2fay_k0zis) {
        await refresh_gridData_heroui_app_table_grid_1789615844597_v6jyv();
        toast("Deleted", { variant: "success", timeout: 4000 });
        patchDesignerStore("ui.visibility.node-83970786-d0e0-4209-bfa1-14874de16c9d", false);
      }
    })();
  }, [patchDesignerStore, refresh_gridData_heroui_app_table_grid_1789615844597_v6jyv]);
  return (
    <>
      <Toast.Provider />
      <div className="h-full min-h-0 w-full min-w-0 space-y-3">
        <div className="flex !h-full !min-h-0 !w-full flex-row bg-white">
          <div className="flex !w-56 shrink-0 flex-col border-r border-slate-200 bg-slate-50/40 !p-3">
            <div className="flex flex-col space-y-0.5">
              <Button className="flex !w-full !items-center gap-2 !rounded-md border !px-2.5 !py-2 !text-left !text-sm !font-medium transition-colors border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 [&_svg]:text-indigo-600" type="button" variant="outline" size="sm" href="#" target="_self" onClick={handleonClick_heroui_button_outline_1789615844578_simnn}><BadgeCheck className="h-3.5 w-3.5" /> Membership Status</Button>
              <div className="my-0.5 border-t border-slate-200/90">
                <div />
              </div>
              <Button className="flex !w-full !items-center gap-2 !rounded-md border !px-2.5 !py-2 !text-left !text-sm !font-medium transition-colors border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 [&_svg]:text-violet-600" type="button" variant="outline" size="sm" href="#" target="_self" onClick={handleonClick_heroui_button_outline_1789615844578_oiahm}><FileImage className="h-3.5 w-3.5" /> Member File Kinds</Button>
              <Button className="flex !w-full !items-center gap-2 !rounded-md border !px-2.5 !py-2 !text-left !text-sm !font-medium transition-colors border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 [&_svg]:text-sky-600" type="button" variant="outline" size="sm" href="#" target="_self" onClick={handleonClick_heroui_button_outline_1789615844579_snw2a}><Building2 className="h-3.5 w-3.5" /> Institute Membership</Button>
              <Button className="flex !w-full !items-center gap-2 !rounded-md border !px-2.5 !py-2 !text-left !text-sm !font-medium transition-colors border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 [&_svg]:text-emerald-600" type="button" variant="outline" size="sm" href="#" target="_self" onClick={handleonClick_heroui_button_outline_1789615844580_fm4p3}><Route className="h-3.5 w-3.5" /> Join Path</Button>
              <div className="my-0.5 border-t border-slate-200/90">
                <div />
              </div>
              <Button className="flex !w-full !items-center gap-2 !rounded-md border !px-2.5 !py-2 !text-left !text-sm !font-medium transition-colors border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 [&_svg]:text-amber-600" type="button" variant="outline" size="sm" href="#" target="_self" onClick={handleonClick_heroui_button_outline_1789615844581_t137i}><BookUser className="h-3.5 w-3.5" /> Nakhebin Link Types</Button>
              <Button className="flex !w-full !items-center gap-2 !rounded-md border !px-2.5 !py-2 !text-left !text-sm !font-medium transition-colors border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 [&_svg]:text-rose-600" type="button" variant="outline" size="sm" href="#" target="_self" onClick={handleonClick_heroui_button_outline_1789615844582_12vlp}><StickyNote className="h-3.5 w-3.5" /> Note Subjects</Button>
              <Button className="flex !w-full !items-center gap-2 !rounded-md border !px-2.5 !py-2 !text-left !text-sm !font-medium transition-colors border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 [&_svg]:text-slate-600" type="button" variant="outline" size="sm" href="#" target="_self" onClick={handleonClick_heroui_button_outline_1789615844583_4nv8o}><Shield className="h-3.5 w-3.5" /> Security Clearance</Button>
              <div className="my-0.5 border-t border-slate-200/90">
                <div />
              </div>
              <Button className="flex !w-full !items-center gap-2 !rounded-md border !px-2.5 !py-2 !text-left !text-sm !font-medium transition-colors border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 [&_svg]:text-cyan-600" type="button" variant="outline" size="sm" href="#" target="_self" onClick={handleonClick_heroui_button_outline_1789615844585_mvv7j}><Users className="h-3.5 w-3.5" /> Institute Character</Button>
              <Button className="flex !w-full !items-center gap-2 !rounded-md border !px-2.5 !py-2 !text-left !text-sm !font-medium transition-colors border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 [&_svg]:text-amber-600" type="button" variant="outline" size="sm" href="#" target="_self" onClick={handleonClick_heroui_button_outline_1789615844587_86rye}><Briefcase className="h-3.5 w-3.5" /> Institute Affairs</Button>
              <div className="my-0.5 border-t border-slate-200/90">
                <div />
              </div>
              <Button className="flex !w-full !items-center gap-2 !rounded-md border !px-2.5 !py-2 !text-left !text-sm !font-medium transition-colors border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 [&_svg]:text-indigo-600" type="button" variant="outline" size="sm" href="#" target="_self" onClick={handleonClick_heroui_button_outline_1789615844589_bpr3p}><GraduationCap className="h-3.5 w-3.5" /> Education Level</Button>
              <Button className="flex !w-full !items-center gap-2 !rounded-md border !px-2.5 !py-2 !text-left !text-sm !font-medium transition-colors border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 [&_svg]:text-sky-600" type="button" variant="outline" size="sm" href="#" target="_self" onClick={handleonClick_heroui_button_outline_1789615844591_2llll}><School className="h-3.5 w-3.5" /> Education Stage</Button>
              <Button className="flex !w-full !items-center gap-2 !rounded-md border !px-2.5 !py-2 !text-left !text-sm !font-medium transition-colors workspace-section-nav-item-active bg-violet-50/80 text-violet-950 border-violet-200 !shadow-sm [&_svg]:text-violet-600" type="button" variant="outline" size="sm" href="#" target="_self" onClick={handleonClick_heroui_button_outline_1789615844593_926h7}><Landmark className="h-3.5 w-3.5" /> Universities</Button>
              <Button className="flex !w-full !items-center gap-2 !rounded-md border !px-2.5 !py-2 !text-left !text-sm !font-medium transition-colors border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 [&_svg]:text-emerald-600" type="button" variant="outline" size="sm" href="#" target="_self" onClick={handleonClick_heroui_button_outline_1789615844594_ivq8z}><Hammer className="h-3.5 w-3.5" /> Job Types</Button>
            </div>
          </div>
          <div className="flex !min-h-0 !min-w-0 flex-1 flex-col overflow-hidden bg-white">
            <div className="flex w-full flex-col gap-2"><div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-2 py-1.5"><div className="flex items-center gap-2"><input type="text" value={gridSearchInput_heroui_app_table_grid_1789615844597_v6jyv} onChange={(event) => handleGridSearchChange_heroui_app_table_grid_1789615844597_v6jyv(event.target.value)} placeholder={"Search education university…"} className="h-8 rounded-md border border-slate-200 px-2 text-sm" /></div><div className="flex items-center gap-2"><button type="button" onClick={() => { patchDesignerStore("selection.id", null); patchDesignerStore("ui.visibility.node-cfc01940-8b1e-4e8d-b8ec-b7bc27a4718f", true); }} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700">Create</button><button type="button" onClick={() => { void refresh_gridData_heroui_app_table_grid_1789615844597_v6jyv(); }} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">Refresh</button></div></div><AppTableGrid className="flex !h-full !min-h-0 !w-full flex-1 flex-col" showPagingFooter={false} presentation="cards" cardBelow="tablet" columns={gridColumns_heroui_app_table_grid_1789615844597_v6jyv} rows={gridPaging_heroui_app_table_grid_1789615844597_v6jyv.displayRows} getRowKey={(row) => String((row as Record<string, unknown>)["id"] ?? '')} enableColumnLayout={false} columnLayout={gridColumnLayout_heroui_app_table_grid_1789615844597_v6jyv} onColumnLayoutChange={setGridColumnLayout_heroui_app_table_grid_1789615844597_v6jyv} isLoading={false} loadingMessage={"Loading education university…"} emptyMessage={"No education university found."} isEmpty={gridAggregatedRows_heroui_app_table_grid_1789615844597_v6jyv.length === 0} errorContent={gridAggregatedRows_heroui_app_table_grid_1789615844597_v6jyv.length === 0 ? undefined : "Could not load education university."} gridQueryMode={"server"} query={gridQuery_heroui_app_table_grid_1789615844597_v6jyv} onQueryChange={handleGridQueryChange_heroui_app_table_grid_1789615844597_v6jyv} onGridRowAction={handleGridRowAction_heroui_app_table_grid_1789615844597_v6jyv} footer={<GridPagingFooter totalCount={gridTotalCount_heroui_app_table_grid_1789615844597_v6jyv} safePage={gridPaging_heroui_app_table_grid_1789615844597_v6jyv.safePage} pageSize={gridPageSize_heroui_app_table_grid_1789615844597_v6jyv} onPageSizeChange={handleGridPageSizeChange_heroui_app_table_grid_1789615844597_v6jyv} sortBy={gridQuery_heroui_app_table_grid_1789615844597_v6jyv.sort?.columnId ?? ''} sortOptions={[{"value":"title","label":"Title"},{"value":"short_name","label":"Short name"},{"value":"view_order","label":"Order"},{"value":"is_active","label":"Active"}]} onSortByChange={handleGridSortByChange_heroui_app_table_grid_1789615844597_v6jyv} sortDirection={gridQuery_heroui_app_table_grid_1789615844597_v6jyv.sort?.direction ?? 'asc'} onToggleSortDirection={handleGridToggleSortDirection_heroui_app_table_grid_1789615844597_v6jyv} showSortControls={false} totalPages={gridPaging_heroui_app_table_grid_1789615844597_v6jyv.totalPages} pageNumbers={buildDataGridPageNumbers(gridPaging_heroui_app_table_grid_1789615844597_v6jyv.safePage, gridPaging_heroui_app_table_grid_1789615844597_v6jyv.totalPages)} onPageChange={handleGridPageChange_heroui_app_table_grid_1789615844597_v6jyv} visibleInfiniteCount={gridListMode_heroui_app_table_grid_1789615844597_v6jyv === 'infinite' ? gridPaging_heroui_app_table_grid_1789615844597_v6jyv.displayRows.length : undefined} />} /></div>
          </div>
        </div>
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "(store.ui.visibility.node-cfc01940-8b1e-4e8d-b8ec-b7bc27a4718f === true) && (store.ui.visibility.node-cfc01940-8b1e-4e8d-b8ec-b7bc27a4718f !== false)") && (
          <CreateEditModalShell title={"Create Education University"} size="lg" onClose={() => { patchDesignerStore("ui.visibility.node-cfc01940-8b1e-4e8d-b8ec-b7bc27a4718f", false); }} onBackdropClick={() => { patchDesignerStore("ui.visibility.node-cfc01940-8b1e-4e8d-b8ec-b7bc27a4718f", false); }} gradient={false} bodyOuterClassName="-mb-[15px]" bodyClassName="!p-0" footerClassName="!mt-0">
            <form className="flex !min-h-0 flex-col gap-0 bg-white" method="post" id="node-8f1fff52-1f87-42fc-a438-9555c69ac78a" data-designer-node-id="node-8f1fff52-1f87-42fc-a438-9555c69ac78a">
              <div className="flex !min-w-0 flex-col gap-2 bg-white p-[15px]">
                <DesignerBaseInfoRecordFormField className="!w-full !min-w-0" />
              </div>
            </form>
            <div className="flex !w-full shrink-0 !items-center !justify-end gap-2">
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 border border-slate-200 text-slate-600 hover:bg-slate-100" variant="outline" size="md" onClick={handleonClick_node_42fb8cbe_eb41_42dd_9df5_d64036d98cfb}><X className="h-3.5 w-3.5" /> Cancel</Button>
              <Button type="submit" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 bg-primary-600 hover:bg-primary-700 text-white" form="node-8f1fff52-1f87-42fc-a438-9555c69ac78a" variant="primary" size="md" href="#" target="_self" isDisabled={isSubmitting} onClick={handleonClick_node_d18feef6_6f0f_4992_bd6e_f838897559ee}><Plus className="h-3.5 w-3.5" /> Create Education University</Button>
            </div>
          </CreateEditModalShell>
        )}
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "(store.ui.visibility.node-02a9fcf4-89c4-4a92-9fb6-b4e4b03ac1f6 === true) && (store.ui.visibility.node-02a9fcf4-89c4-4a92-9fb6-b4e4b03ac1f6 !== false)") && (
          <CreateEditModalShell title={"Edit Education University"} size="lg" onClose={() => { patchDesignerStore("ui.visibility.node-02a9fcf4-89c4-4a92-9fb6-b4e4b03ac1f6", false); }} onBackdropClick={() => { patchDesignerStore("ui.visibility.node-02a9fcf4-89c4-4a92-9fb6-b4e4b03ac1f6", false); }} gradient={false} bodyOuterClassName="-mb-[15px]" bodyClassName="!p-0" footerClassName="!mt-0">
            <form className="flex !min-h-0 flex-col gap-0 bg-white" method="post" id="node-efc1fa98-5cee-43ea-ba9b-5103dec5684a" data-designer-node-id="node-efc1fa98-5cee-43ea-ba9b-5103dec5684a">
              <div className="flex !min-w-0 flex-col gap-2 bg-white p-[15px]">
                <DesignerBaseInfoRecordFormField className="!w-full !min-w-0" />
              </div>
            </form>
            <div className="flex !w-full shrink-0 !items-center !justify-end gap-2">
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 border border-slate-200 text-slate-600 hover:bg-slate-100" variant="outline" size="md" onClick={handleonClick_node_68f963e1_4854_468d_83b4_5a7ff867d67e}><X className="h-3.5 w-3.5" /> Cancel</Button>
              <Button type="submit" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 bg-primary-600 hover:bg-primary-700 text-white" form="node-efc1fa98-5cee-43ea-ba9b-5103dec5684a" variant="primary" size="md" href="#" target="_self" isDisabled={isSubmitting} onClick={handleonClick_node_83f77fb7_0115_4724_8794_64f81064ccb8}><Save className="h-3.5 w-3.5" /> Save</Button>
            </div>
          </CreateEditModalShell>
        )}
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "(store.ui.visibility.node-83970786-d0e0-4209-bfa1-14874de16c9d === true) && (store.ui.visibility.node-83970786-d0e0-4209-bfa1-14874de16c9d !== false)") && (
          <ConfirmDialogShell title={"Delete Education University?"} size="sm" onClose={() => { patchDesignerStore("ui.visibility.node-83970786-d0e0-4209-bfa1-14874de16c9d", false); }} onBackdropClick={() => { patchDesignerStore("ui.visibility.node-83970786-d0e0-4209-bfa1-14874de16c9d", false); }} tone="danger" hideCancel hideConfirm icon={<Trash2 className="h-4 w-4" />} bodyClassName="!p-0" footerClassName="!mt-0">
            <p className="block p-[15px] !text-sm text-slate-700">Delete this education university? This cannot be undone.</p>
            <div className="flex !w-full shrink-0 !items-center !justify-end gap-2">
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 border border-slate-200 text-slate-600 hover:bg-slate-100" variant="outline" size="md" onClick={handleonClick_node_bc3b8703_ae84_4a4d_9e43_ed6623d8665e}><X className="h-3.5 w-3.5" /> Cancel</Button>
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 bg-rose-600 hover:bg-rose-700 text-white" variant="primary" size="md" onClick={handleonClick_node_ea4ff05d_bbdb_4539_8509_91e509aec1a7}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
            </div>
          </ConfirmDialogShell>
        )}
      </div>
    </>
  );
};
