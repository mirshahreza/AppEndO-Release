import React from 'react';
import { useNavigate } from 'react-router-dom';
import { buildAppTableGridColumns } from '@/domain/component-designer/DesignerRuntimeAppTableGrid';
import { applyClientGridQuery, EMPTY_GRID_QUERY, type GridQueryState } from '@/shared/lib/appTableGridQuery';
import { resolveDataGridTotalCount, sliceDataGridRowsForDisplay, buildDataGridPageNumbers, applyGridAggregation } from '@/domain/component-designer/designerDataGridRuntime';
import { applyDesignerGridToolbarClientFilters } from '@/domain/component-designer/designerGridToolbarConfig';
import { createDefaultColumnLayout } from '@/shared/lib/appTableGridColumnLayout';
import { validateDesignerFieldNode } from '@/domain/component-designer/previewFieldValidation';
import { DesignerRuntimeContentStatusPicker } from '@/domain/component-designer/DesignerRuntimeContentStatusPicker';
import { AppTableGrid, ConfirmDialogShell, CreateEditModalShell, GridPagingFooter, ToolbarFilterSelect, UiCheckbox } from '@/shared/ui';
import { UiInput } from '@/shared/ui/HeroFieldControls';
import { Button, Radio, RadioGroup, Toast, toast } from '@heroui/react';
import { Plus, Trash2, X } from 'lucide-react';

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
  const { store: designerStore, patch: patchDesignerStore } = useDesignerStore<Record<string, unknown>>({"gridToolbar":{"search":"","filters":{"contentTypeCode":"","statusCode":""}},"gridQuery":{"sortBy":"updatedAt","sortDir":"desc","page":1,"pageSize":50,"filters":{}},"selection":{"id":null}});
  const { data: dataContext, isLoading: isHydrating, error: fetchError, refresh: refreshDataContext } = useDataFetch<Record<string, unknown> | null>("/api/base-info/options?root=101.001&lang=en", {});
  const { data: fetchData_1, isLoading: isHydrating_1, error: fetchError_1, refresh: refreshFetch_1 } = useDataFetch<Record<string, unknown> | null>("/api/base-info/options?root=101.004&lang=en", {});
  const { data: fetchData_2, isLoading: isHydrating_2, error: fetchError_2, refresh: refreshFetch_2 } = useDataFetch<Record<string, unknown> | null>("/api/base-info/options?root=101.003&lang=en", {});
  const { data: fetchData_3, isLoading: isHydrating_3, error: fetchError_3, refresh: refreshFetch_3 } = useDataFetch<Record<string, unknown> | null>("/api/base-info/options?root=101.002&lang=en", {});
  const handleGridRowAction_heroui_app_table_grid_1789662947662_27ld6 = React.useCallback((row: Record<string, unknown>, actionId: string) => {
    switch (actionId) {
      case "revisions": {
        patchDesignerStore("selection.id", row["id"] ?? null);
        patchDesignerStore("ui.visibility.heroui-modal-1789662947654-ehnrz", true);
        return;
      }
      case "delete": {
        patchDesignerStore("selection.id", row["id"] ?? null);
        patchDesignerStore("ui.visibility.node-eee24fcf-4d2a-4e4b-ab7e-acfb41c5b46f", true);
        return;
      }
      default:
        return;
    }
  }, [patchDesignerStore]);
  const handleGridCellClick_heroui_app_table_grid_1789662947662_27ld6 = React.useCallback(async (row: Record<string, unknown>, column: { key?: string; id?: string }) => {
    const columnKey = String(column.key ?? column.id ?? '');
    switch (columnKey) {
      case "statusCode": {
        patchDesignerStore("selection.id", row["id"] ?? null);
        patchDesignerStore("ui.visibility.node-50089edb-5b32-4d97-acc1-dea0da037d45", true);
        return;
      }
      default:
        return;
    }
  }, [patchDesignerStore, handleGridRowAction_heroui_app_table_grid_1789662947662_27ld6]);
  const { data: raw_gridData_heroui_app_table_grid_1789662947658_c8la2, isLoading: isLoading_gridData_heroui_app_table_grid_1789662947658_c8la2, error: error_gridData_heroui_app_table_grid_1789662947658_c8la2, refresh: refresh_gridData_heroui_app_table_grid_1789662947658_c8la2 } = useDataFetch<unknown>(resolveBindingUrl("/api/cms/revisions", designerStore, { "sortBy": "revisionHistoryGridQuery.sortBy", "sortDir": "revisionHistoryGridQuery.sortDir", "page": "revisionHistoryGridQuery.page", "pageSize": "revisionHistoryGridQuery.pageSize", "filter[contentId][eq]": "selection.id" }), {});
  const gridData_heroui_app_table_grid_1789662947658_c8la2 = React.useMemo(() => applyResponseDataPath(raw_gridData_heroui_app_table_grid_1789662947658_c8la2, {"dataPath":"data","arrayPath":"data","totalPath":"count"}), [raw_gridData_heroui_app_table_grid_1789662947658_c8la2]);
  const { data: raw_gridData_heroui_app_table_grid_1789662947662_27ld6, isLoading: isLoading_gridData_heroui_app_table_grid_1789662947662_27ld6, error: error_gridData_heroui_app_table_grid_1789662947662_27ld6, refresh: refresh_gridData_heroui_app_table_grid_1789662947662_27ld6 } = useDataFetch<unknown>(resolveBindingUrl("/api/cms/contents", designerStore, { "search": "gridToolbar.search", "filter[contentTypeCode][in]": "gridToolbar.filters.contentTypeCode", "filter[statusCode][in]": "gridToolbar.filters.statusCode", "sortBy": "gridQuery.sortBy", "sortDir": "gridQuery.sortDir", "page": "gridQuery.page", "pageSize": "gridQuery.pageSize", "where": "gridToolbar.listWhere", "filter[title][like]": "gridQuery.filters.title", "filter[updatedAt][gte]": "gridQuery.filters.updatedAt.from", "filter[updatedAt][lte]": "gridQuery.filters.updatedAt.to", "view": "static:summary" }), {});
  const gridData_heroui_app_table_grid_1789662947662_27ld6 = React.useMemo(() => applyResponseDataPath(raw_gridData_heroui_app_table_grid_1789662947662_27ld6, {"dataPath":"data","arrayPath":"data","totalPath":"count"}), [raw_gridData_heroui_app_table_grid_1789662947662_27ld6]);
  const gridColumns_heroui_app_table_grid_1789662947658_c8la2 = React.useMemo(() => buildAppTableGridColumns([{"key":"revisionNo","label":"#","sort":true},{"key":"title","label":"Title"},{"key":"summary","label":"Summary"},{"key":"body","label":"Body"}], "client", {
    mode: 'runtime',
    detailFlowRef: { current: null },
    rowActionHandlerRef: { current: undefined },
    cellClickHandlerRef: { current: undefined },
    designerStoreRef: { current: designerStore },
  }), [designerStore]);
  const [gridQuery_heroui_app_table_grid_1789662947658_c8la2, setGridQuery_heroui_app_table_grid_1789662947658_c8la2] = React.useState<GridQueryState>(() => ({ ...EMPTY_GRID_QUERY, sort: { columnId: "revisionNo", direction: "asc" } }));
  const [gridPage_heroui_app_table_grid_1789662947658_c8la2, setGridPage_heroui_app_table_grid_1789662947658_c8la2] = React.useState(1);
  const [gridPageSize_heroui_app_table_grid_1789662947658_c8la2, setGridPageSize_heroui_app_table_grid_1789662947658_c8la2] = React.useState(20);
  const [gridListMode_heroui_app_table_grid_1789662947658_c8la2, setGridListMode_heroui_app_table_grid_1789662947658_c8la2] = React.useState<'paging' | 'infinite'>("paging");
  const [gridColumnLayout_heroui_app_table_grid_1789662947658_c8la2, setGridColumnLayout_heroui_app_table_grid_1789662947658_c8la2] = React.useState(() => createDefaultColumnLayout(gridColumns_heroui_app_table_grid_1789662947658_c8la2));
  const gridFilteredRows_heroui_app_table_grid_1789662947658_c8la2 = React.useMemo(() => applyClientGridQuery(((Array.isArray(gridData_heroui_app_table_grid_1789662947658_c8la2) ? gridData_heroui_app_table_grid_1789662947658_c8la2 : []) ?? []), gridQuery_heroui_app_table_grid_1789662947658_c8la2, gridColumns_heroui_app_table_grid_1789662947658_c8la2, "client"), [gridQuery_heroui_app_table_grid_1789662947658_c8la2, gridColumns_heroui_app_table_grid_1789662947658_c8la2]);
  const gridAggregatedRows_heroui_app_table_grid_1789662947658_c8la2 = gridFilteredRows_heroui_app_table_grid_1789662947658_c8la2;
  const gridApiTotal_heroui_app_table_grid_1789662947658_c8la2 = React.useMemo(() => {
    const raw = raw_gridData_heroui_app_table_grid_1789662947658_c8la2;
    const value = readNestedContextValue((raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}), "count");
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
  }, [raw_gridData_heroui_app_table_grid_1789662947658_c8la2]);
  const gridTotalCount_heroui_app_table_grid_1789662947658_c8la2 = resolveDataGridTotalCount({ page: gridPage_heroui_app_table_grid_1789662947658_c8la2, pageSize: gridPageSize_heroui_app_table_grid_1789662947658_c8la2, total: gridApiTotal_heroui_app_table_grid_1789662947658_c8la2, gridQueryMode: "client" }, gridAggregatedRows_heroui_app_table_grid_1789662947658_c8la2.length);
  const gridPaging_heroui_app_table_grid_1789662947658_c8la2 = sliceDataGridRowsForDisplay(gridAggregatedRows_heroui_app_table_grid_1789662947658_c8la2, gridPage_heroui_app_table_grid_1789662947658_c8la2, gridPageSize_heroui_app_table_grid_1789662947658_c8la2, gridTotalCount_heroui_app_table_grid_1789662947658_c8la2, "client");
  const handleGridQueryChange_heroui_app_table_grid_1789662947658_c8la2 = React.useCallback((nextQuery: GridQueryState) => {
    setGridQuery_heroui_app_table_grid_1789662947658_c8la2(nextQuery);
    setGridPage_heroui_app_table_grid_1789662947658_c8la2(1);
  }, [patchDesignerStore]);
  const handleGridPageChange_heroui_app_table_grid_1789662947658_c8la2 = React.useCallback((nextPage: number) => {
    setGridPage_heroui_app_table_grid_1789662947658_c8la2(nextPage);
  }, [patchDesignerStore]);
  const handleGridPageSizeChange_heroui_app_table_grid_1789662947658_c8la2 = React.useCallback((nextSize: number) => {
    setGridPageSize_heroui_app_table_grid_1789662947658_c8la2(nextSize);
    setGridPage_heroui_app_table_grid_1789662947658_c8la2(1);
  }, [patchDesignerStore]);
  const handleGridSortByChange_heroui_app_table_grid_1789662947658_c8la2 = React.useCallback((nextSortBy: string) => {
    setGridQuery_heroui_app_table_grid_1789662947658_c8la2((current: GridQueryState) => ({ ...current, sort: nextSortBy ? { columnId: nextSortBy, direction: current.sort?.direction ?? 'asc' } : null }));
  }, []);
  const handleGridToggleSortDirection_heroui_app_table_grid_1789662947658_c8la2 = React.useCallback(() => {
    setGridQuery_heroui_app_table_grid_1789662947658_c8la2((current: GridQueryState) => (current.sort ? { ...current, sort: { ...current.sort, direction: current.sort.direction === 'asc' ? 'desc' : 'asc' } } : current));
  }, []);

  const gridColumns_heroui_app_table_grid_1789662947662_27ld6 = React.useMemo(() => buildAppTableGridColumns([{"key":"title","label":"Title","sort":true,"filter":true,"filterType":"text","cellKind":"link","cellFields":{"labelField":"title","hrefTemplate":"/studio/cms/contents/edit/{id}"},"cardRole":"title"},{"key":"contentTypeCode","label":"Type","sort":true,"cellKind":"lookup","cellFields":{"labelField":"contentTypeCodeTitle","labelFallbackField":"contentTypeCode"},"cardRole":"field","width":"120px"},{"key":"languageCode","label":"Language","sort":true,"cellKind":"lookup","cellFields":{"labelField":"languageCodeTitle","labelFallbackField":"languageCode"},"cardRole":"field","width":"120px"},{"key":"statusCode","label":"Status","sort":true,"cellKind":"status-badge","cellFields":{"labelField":"statusCodeTitle","labelFallbackField":"statusCode","dateField":"statusCodeUpdatedAt","htmlField":"statusCodeUiHtml","colorField":"statusCodeUiColor"},"cellClickBehavior":{"kind":"open-modal","modalNodeId":"node-50089edb-5b32-4d97-acc1-dea0da037d45","primaryKeyField":"id","selectionStorePath":"selection.id"},"cardRole":"meta","width":"120px"},{"key":"updatedAt","label":"Timeline","sort":true,"filter":true,"filterType":"dateRange","cellKind":"audit","cellFields":{"dateField":"createdAt","secondaryDateField":"updatedAt"},"cardRole":"meta","hideBelow":"lg","width":"120px"},{"key":"actions","label":"","kind":"action-group","actions":[{"actionId":"revisions","icon":"History","intent":"view","tooltip":"Revision history","behavior":{"kind":"open-modal","modalNodeId":"heroui-modal-1789662947654-ehnrz","primaryKeyField":"id","selectionStorePath":"selection.id"}},{"actionId":"delete","icon":"Trash2","intent":"delete","tooltip":"Delete","behavior":{"kind":"open-modal","modalNodeId":"node-eee24fcf-4d2a-4e4b-ab7e-acfb41c5b46f","primaryKeyField":"id","selectionStorePath":"selection.id"}}],"maxVisibleActions":3,"cardRole":"actions","layoutHideable":false,"layoutResizable":false,"layoutReorderable":false,"width":"75px"}], "server", {
    mode: 'runtime',
    detailFlowRef: { current: null },
    rowActionHandlerRef: { current: handleGridRowAction_heroui_app_table_grid_1789662947662_27ld6 },
    cellClickHandlerRef: { current: handleGridCellClick_heroui_app_table_grid_1789662947662_27ld6 },
    designerStoreRef: { current: designerStore },
  }), [designerStore, handleGridRowAction_heroui_app_table_grid_1789662947662_27ld6, handleGridCellClick_heroui_app_table_grid_1789662947662_27ld6]);
  const { data: gridToolbarLovData_statusCode_heroui_app_table_grid_1789662947662_27ld6 } = useDataFetch<unknown>("/api/base-info/options?root=101.002&lang=en", {});
  const [gridQuery_heroui_app_table_grid_1789662947662_27ld6, setGridQuery_heroui_app_table_grid_1789662947662_27ld6] = React.useState<GridQueryState>(() => ({ ...EMPTY_GRID_QUERY, sort: { columnId: "updatedAt", direction: "desc" } }));
  const [gridPage_heroui_app_table_grid_1789662947662_27ld6, setGridPage_heroui_app_table_grid_1789662947662_27ld6] = React.useState(1);
  const [gridPageSize_heroui_app_table_grid_1789662947662_27ld6, setGridPageSize_heroui_app_table_grid_1789662947662_27ld6] = React.useState(50);
  const [gridListMode_heroui_app_table_grid_1789662947662_27ld6, setGridListMode_heroui_app_table_grid_1789662947662_27ld6] = React.useState<'paging' | 'infinite'>("paging");
  const [gridColumnLayout_heroui_app_table_grid_1789662947662_27ld6, setGridColumnLayout_heroui_app_table_grid_1789662947662_27ld6] = React.useState(() => createDefaultColumnLayout(gridColumns_heroui_app_table_grid_1789662947662_27ld6));
  const [gridSearchInput_heroui_app_table_grid_1789662947662_27ld6, setGridSearchInput_heroui_app_table_grid_1789662947662_27ld6] = React.useState('');
  const [gridDebouncedSearch_heroui_app_table_grid_1789662947662_27ld6, setGridDebouncedSearch_heroui_app_table_grid_1789662947662_27ld6] = React.useState('');
  const [gridCheckboxSelections_heroui_app_table_grid_1789662947662_27ld6, setGridCheckboxSelections_heroui_app_table_grid_1789662947662_27ld6] = React.useState<Record<string, Record<string, boolean>>>({});
  const [gridRadioSelections_heroui_app_table_grid_1789662947662_27ld6, setGridRadioSelections_heroui_app_table_grid_1789662947662_27ld6] = React.useState<Record<string, string>>({"contentTypeCode":"","statusCode":""});
  const [gridMatchLogic_heroui_app_table_grid_1789662947662_27ld6, setGridMatchLogic_heroui_app_table_grid_1789662947662_27ld6] = React.useState<Record<string, 'and' | 'or'>>({});
  const gridRoleFilters_heroui_app_table_grid_1789662947662_27ld6 = {};
  const gridFilteredRows_heroui_app_table_grid_1789662947662_27ld6 = React.useMemo(() => applyClientGridQuery(((Array.isArray(gridData_heroui_app_table_grid_1789662947662_27ld6) ? gridData_heroui_app_table_grid_1789662947662_27ld6 : []) ?? []), gridQuery_heroui_app_table_grid_1789662947662_27ld6, gridColumns_heroui_app_table_grid_1789662947662_27ld6, "server"), [gridQuery_heroui_app_table_grid_1789662947662_27ld6, gridColumns_heroui_app_table_grid_1789662947662_27ld6]);
  const gridAggregatedRows_heroui_app_table_grid_1789662947662_27ld6 = gridFilteredRows_heroui_app_table_grid_1789662947662_27ld6;
  const gridApiTotal_heroui_app_table_grid_1789662947662_27ld6 = React.useMemo(() => {
    const raw = raw_gridData_heroui_app_table_grid_1789662947662_27ld6;
    const value = readNestedContextValue((raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}), "count");
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
  }, [raw_gridData_heroui_app_table_grid_1789662947662_27ld6]);
  const gridTotalCount_heroui_app_table_grid_1789662947662_27ld6 = resolveDataGridTotalCount({ page: gridPage_heroui_app_table_grid_1789662947662_27ld6, pageSize: gridPageSize_heroui_app_table_grid_1789662947662_27ld6, total: gridApiTotal_heroui_app_table_grid_1789662947662_27ld6, gridQueryMode: "server" }, gridAggregatedRows_heroui_app_table_grid_1789662947662_27ld6.length);
  const gridPaging_heroui_app_table_grid_1789662947662_27ld6 = sliceDataGridRowsForDisplay(gridAggregatedRows_heroui_app_table_grid_1789662947662_27ld6, gridPage_heroui_app_table_grid_1789662947662_27ld6, gridPageSize_heroui_app_table_grid_1789662947662_27ld6, gridTotalCount_heroui_app_table_grid_1789662947662_27ld6, "server");
  const handleGridQueryChange_heroui_app_table_grid_1789662947662_27ld6 = React.useCallback((nextQuery: GridQueryState) => {
    setGridQuery_heroui_app_table_grid_1789662947662_27ld6(nextQuery);
    setGridPage_heroui_app_table_grid_1789662947662_27ld6(1);
    patchDesignerStore("gridQuery.sortBy", nextQuery.sort?.columnId ?? '');
    patchDesignerStore("gridQuery.sortDir", nextQuery.sort?.direction ?? '');
  }, [patchDesignerStore]);
  const handleGridPageChange_heroui_app_table_grid_1789662947662_27ld6 = React.useCallback((nextPage: number) => {
    setGridPage_heroui_app_table_grid_1789662947662_27ld6(nextPage);
    patchDesignerStore("gridQuery.page", nextPage);
  }, [patchDesignerStore]);
  const handleGridPageSizeChange_heroui_app_table_grid_1789662947662_27ld6 = React.useCallback((nextSize: number) => {
    setGridPageSize_heroui_app_table_grid_1789662947662_27ld6(nextSize);
    setGridPage_heroui_app_table_grid_1789662947662_27ld6(1);
    patchDesignerStore("gridQuery.pageSize", nextSize);
  }, [patchDesignerStore]);
  const handleGridSortByChange_heroui_app_table_grid_1789662947662_27ld6 = React.useCallback((nextSortBy: string) => {
    setGridQuery_heroui_app_table_grid_1789662947662_27ld6((current: GridQueryState) => ({ ...current, sort: nextSortBy ? { columnId: nextSortBy, direction: current.sort?.direction ?? 'asc' } : null }));
  }, []);
  const handleGridToggleSortDirection_heroui_app_table_grid_1789662947662_27ld6 = React.useCallback(() => {
    setGridQuery_heroui_app_table_grid_1789662947662_27ld6((current: GridQueryState) => (current.sort ? { ...current, sort: { ...current.sort, direction: current.sort.direction === 'asc' ? 'desc' : 'asc' } } : current));
  }, []);
  const searchDebounceTimer_heroui_app_table_grid_1789662947662_27ld6 = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleGridSearchChange_heroui_app_table_grid_1789662947662_27ld6 = React.useCallback((nextValue: string) => {
    setGridSearchInput_heroui_app_table_grid_1789662947662_27ld6(nextValue);
    if (searchDebounceTimer_heroui_app_table_grid_1789662947662_27ld6.current) {
      clearTimeout(searchDebounceTimer_heroui_app_table_grid_1789662947662_27ld6.current);
    }
    searchDebounceTimer_heroui_app_table_grid_1789662947662_27ld6.current = setTimeout(() => {
      setGridDebouncedSearch_heroui_app_table_grid_1789662947662_27ld6(nextValue);
      setGridPage_heroui_app_table_grid_1789662947662_27ld6(1);
      patchDesignerStore("gridToolbar.search", nextValue);
    }, 300);
  }, [patchDesignerStore]);
  const handleGridRadioFilterChange_heroui_app_table_grid_1789662947662_27ld6 = React.useCallback((filterId: string, value: string) => {
    setGridRadioSelections_heroui_app_table_grid_1789662947662_27ld6((current: Record<string, string>) => {
      const next = { ...current, [filterId]: value };
      setGridPage_heroui_app_table_grid_1789662947662_27ld6(1);
      if (filterId === "contentTypeCode") {
        patchDesignerStore("gridToolbar.filters.contentTypeCode", value);
      }
      if (filterId === "statusCode") {
        patchDesignerStore("gridToolbar.filters.statusCode", value);
      }
      return next;
    });
  }, [patchDesignerStore]);

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const handleonClick_node_be72eeae_27d6_4199_9b00_fdc4d70ad262 = React.useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    let formData: FormData;
    const form = event.currentTarget instanceof HTMLFormElement ? event.currentTarget : event.currentTarget.closest('form');
    if (form) {
      formData = new FormData(form);
    } else {
      const regionRoot = document.querySelector("[data-designer-node-id=\"node-ae735db2-9655-4f0d-b8c2-6354953d959b\"]");
      if (!regionRoot) {
        return;
      }
      formData = collectRegionFormDataFromContainer(regionRoot, ["node-2d86b189-3256-40bb-90b8-e6b3ebe6fff8","node-e94a7008-578d-4454-b26d-d941ceac8d59","node-b9f38c26-df56-4365-96c9-5a39d70a9cd6","node-0ddb43e2-d345-4a1d-b70d-63863cdb7920","node-c75a4265-d839-4d81-8f71-8dd0ead057e6"]);
    }
    const fieldValidationEntries = [{"nodeId":"node-2d86b189-3256-40bb-90b8-e6b3ebe6fff8","formFieldName":"node-2d86b189-3256-40bb-90b8-e6b3ebe6fff8","props":{"_designerPaletteItemId":"heroui.input-text","isRequired":true}},{"nodeId":"node-e94a7008-578d-4454-b26d-d941ceac8d59","formFieldName":"node-e94a7008-578d-4454-b26d-d941ceac8d59","props":{"_designerPaletteItemId":"heroui.radio-group","isRequired":true}},{"nodeId":"node-b9f38c26-df56-4365-96c9-5a39d70a9cd6","formFieldName":"node-b9f38c26-df56-4365-96c9-5a39d70a9cd6","props":{"_designerPaletteItemId":"heroui.radio-group","isRequired":true}},{"nodeId":"node-0ddb43e2-d345-4a1d-b70d-63863cdb7920","formFieldName":"node-0ddb43e2-d345-4a1d-b70d-63863cdb7920","props":{"_designerPaletteItemId":"heroui.radio-group","isRequired":true}},{"nodeId":"node-c75a4265-d839-4d81-8f71-8dd0ead057e6","formFieldName":"node-c75a4265-d839-4d81-8f71-8dd0ead057e6","props":{"_designerPaletteItemId":"heroui.radio-group","isRequired":true}}] as Array<{ nodeId: string; formFieldName: string; props: Record<string, unknown> }>;
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
      payload["title"] = formData.get("node-2d86b189-3256-40bb-90b8-e6b3ebe6fff8") ?? '';
      payload["contentTypeCode"] = formData.get("node-e94a7008-578d-4454-b26d-d941ceac8d59") ?? '';
      payload["languageCode"] = formData.get("node-b9f38c26-df56-4365-96c9-5a39d70a9cd6") ?? '';
      payload["bodyFormatCode"] = formData.get("node-0ddb43e2-d345-4a1d-b70d-63863cdb7920") ?? '';
      payload["statusCode"] = formData.get("node-c75a4265-d839-4d81-8f71-8dd0ead057e6") ?? '';
      const method = 'POST';
      const url = "/api/cms/contents";
      const response = await designerFetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response));
      }
      const mutationResponse = await response.clone().json().catch(() => null);
      patchDesignerStore("response", mutationResponse);
      toast("Saved successfully", { variant: "success", timeout: 4000 });
      navigate(("/studio/cms/contents/edit/" + encodeURIComponent(String(mutationResponse?.data?.id ?? ''))), { replace: false });
    } catch (mutationFailure) {
      toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' });
    }
    finally {
      setIsSubmitting(false);
    }
  }, []);
  const handleonClick_node_fa37c9b8_30d2_49b1_9e49_7c9d56dad1ab = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-7e584d57-7d50-4f05-a646-7940b3dabb85", false);
  }, [patchDesignerStore]);
  const handleonClick_node_3e87543b_1b19_455b_abae_06425d8329d2 = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-eee24fcf-4d2a-4e4b-ab7e-acfb41c5b46f", false);
  }, [patchDesignerStore]);
  const handleonClick_node_fa6ab9b3_10c2_4a73_b954_d8a6e7adb8dc = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    void (async () => {
      let mutationOk_da_mu5r409e_wpezz = true;
      try {
        const response = await designerFetch(("/api/cms/contents/" + encodeURIComponent(String(designerStore?.selection?.id)) + ""), {
          method: "DELETE",
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) {
          toast(await parseApiErrorMessage(response), { variant: 'danger' });
          mutationOk_da_mu5r409e_wpezz = false;
        }
      } catch (mutationFailure) {
        toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' });
        mutationOk_da_mu5r409e_wpezz = false;
      }
      if (mutationOk_da_mu5r409e_wpezz) {
        await refresh_gridData_heroui_app_table_grid_1789662947662_27ld6();
        toast("Deleted", { variant: "success", timeout: 4000 });
        patchDesignerStore("ui.visibility.node-eee24fcf-4d2a-4e4b-ab7e-acfb41c5b46f", false);
      }
    })();
  }, [patchDesignerStore, refresh_gridData_heroui_app_table_grid_1789662947662_27ld6]);
  return (
    <>
      <Toast.Provider />
      <div className="h-full min-h-0 w-full min-w-0 space-y-3">
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "store.ui.visibility.heroui-modal-1789662947654-ehnrz === true") && (
          <CreateEditModalShell title={"Revision history"} size="maximized" onClose={() => { patchDesignerStore("ui.visibility.heroui-modal-1789662947654-ehnrz", false); }} onBackdropClick={() => { patchDesignerStore("ui.visibility.heroui-modal-1789662947654-ehnrz", false); }} gradient={false} bodyOuterClassName="-mb-[15px] flex min-h-0 flex-1 flex-col !overflow-hidden" bodyClassName="flex h-full min-h-0 flex-1 flex-col overflow-hidden !p-0" footerClassName="!mt-0">
            <div className="flex !h-full !min-h-0 !min-w-0 flex-1 flex-col overflow-hidden bg-white">
              <AppTableGrid className="flex !h-full !min-h-0 !w-full flex-1 flex-col" showPagingFooter defaultSortDirection="asc" presentation="auto" cardBelow="tablet" size="sm" columns={gridColumns_heroui_app_table_grid_1789662947658_c8la2} rows={gridPaging_heroui_app_table_grid_1789662947658_c8la2.displayRows} getRowKey={(row) => String((row as Record<string, unknown>)["id"] ?? '')} enableColumnLayout={false} columnLayout={gridColumnLayout_heroui_app_table_grid_1789662947658_c8la2} onColumnLayoutChange={setGridColumnLayout_heroui_app_table_grid_1789662947658_c8la2} isLoading={false} loadingMessage={"Loading revisions…"} emptyMessage={"No revisions found."} isEmpty={gridAggregatedRows_heroui_app_table_grid_1789662947658_c8la2.length === 0} errorContent={gridAggregatedRows_heroui_app_table_grid_1789662947658_c8la2.length === 0 ? undefined : "Could not load revisions."} gridQueryMode={"client"} query={gridQuery_heroui_app_table_grid_1789662947658_c8la2} onQueryChange={handleGridQueryChange_heroui_app_table_grid_1789662947658_c8la2} footer={<GridPagingFooter totalCount={gridTotalCount_heroui_app_table_grid_1789662947658_c8la2} safePage={gridPaging_heroui_app_table_grid_1789662947658_c8la2.safePage} pageSize={gridPageSize_heroui_app_table_grid_1789662947658_c8la2} onPageSizeChange={handleGridPageSizeChange_heroui_app_table_grid_1789662947658_c8la2} sortBy={gridQuery_heroui_app_table_grid_1789662947658_c8la2.sort?.columnId ?? ''} sortOptions={[{"value":"revisionNo","label":"#"}]} onSortByChange={handleGridSortByChange_heroui_app_table_grid_1789662947658_c8la2} sortDirection={gridQuery_heroui_app_table_grid_1789662947658_c8la2.sort?.direction ?? 'asc'} onToggleSortDirection={handleGridToggleSortDirection_heroui_app_table_grid_1789662947658_c8la2} showSortControls={true} totalPages={gridPaging_heroui_app_table_grid_1789662947658_c8la2.totalPages} pageNumbers={buildDataGridPageNumbers(gridPaging_heroui_app_table_grid_1789662947658_c8la2.safePage, gridPaging_heroui_app_table_grid_1789662947658_c8la2.totalPages)} onPageChange={handleGridPageChange_heroui_app_table_grid_1789662947658_c8la2} visibleInfiniteCount={gridListMode_heroui_app_table_grid_1789662947658_c8la2 === 'infinite' ? gridPaging_heroui_app_table_grid_1789662947658_c8la2.displayRows.length : undefined} />} />
            </div>
          </CreateEditModalShell>
        )}
        <div className="flex w-full flex-col gap-2"><div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-2 py-1.5"><div className="flex items-center gap-2"><input type="text" value={gridSearchInput_heroui_app_table_grid_1789662947662_27ld6} onChange={(event) => handleGridSearchChange_heroui_app_table_grid_1789662947662_27ld6(event.target.value)} placeholder={"Search contents…"} className="h-8 rounded-md border border-slate-200 px-2 text-sm" /><ToolbarFilterSelect value={gridRadioSelections_heroui_app_table_grid_1789662947662_27ld6["contentTypeCode"] ?? ''} options={[{"value":"101.001.001","label":"Article"},{"value":"101.001.002","label":"News"},{"value":"101.001.003","label":"Announcement"},{"value":"101.001.004","label":"Gallery"},{"value":"101.001.005","label":"Comment"},{"value":"101.001.006","label":"Page"},{"value":"101.001.007","label":"Fragment"},{"value":"101.001.008","label":"How to"}]} onChange={(value) => handleGridRadioFilterChange_heroui_app_table_grid_1789662947662_27ld6("contentTypeCode", value)} ariaLabel={"Content type"} allLabel={culture.t("grid.filter.all")} multiple /><ToolbarFilterSelect value={gridRadioSelections_heroui_app_table_grid_1789662947662_27ld6["statusCode"] ?? ''} options={mapDesignerLovItems(fetchData_3?.items, "id", "label").map((item) => ({ value: item.id, label: item.textValue }))} onChange={(value) => handleGridRadioFilterChange_heroui_app_table_grid_1789662947662_27ld6("statusCode", value)} ariaLabel={"Status"} allLabel={culture.t("grid.filter.all")} multiple /></div><div className="flex items-center gap-2"><button type="button" onClick={() => { patchDesignerStore("selection.id", null); patchDesignerStore("ui.visibility.node-7e584d57-7d50-4f05-a646-7940b3dabb85", true); }} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700">Create content</button><button type="button" onClick={() => { void refresh_gridData_heroui_app_table_grid_1789662947662_27ld6(); }} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">Refresh</button></div></div><AppTableGrid className="flex !h-full !min-h-0 !w-full flex-1 flex-col" showPagingFooter defaultSortDirection="desc" presentation="auto" cardBelow="tablet" size="sm" columns={gridColumns_heroui_app_table_grid_1789662947662_27ld6} rows={gridPaging_heroui_app_table_grid_1789662947662_27ld6.displayRows} getRowKey={(row) => String((row as Record<string, unknown>)["id"] ?? '')} enableColumnLayout={false} columnLayout={gridColumnLayout_heroui_app_table_grid_1789662947662_27ld6} onColumnLayoutChange={setGridColumnLayout_heroui_app_table_grid_1789662947662_27ld6} isLoading={false} loadingMessage={"Loading records…"} emptyMessage={"No records found."} isEmpty={gridAggregatedRows_heroui_app_table_grid_1789662947662_27ld6.length === 0} errorContent={gridAggregatedRows_heroui_app_table_grid_1789662947662_27ld6.length === 0 ? undefined : "Could not load records."} gridQueryMode={"server"} query={gridQuery_heroui_app_table_grid_1789662947662_27ld6} onQueryChange={handleGridQueryChange_heroui_app_table_grid_1789662947662_27ld6} onGridRowAction={handleGridRowAction_heroui_app_table_grid_1789662947662_27ld6} footer={<GridPagingFooter totalCount={gridTotalCount_heroui_app_table_grid_1789662947662_27ld6} safePage={gridPaging_heroui_app_table_grid_1789662947662_27ld6.safePage} pageSize={gridPageSize_heroui_app_table_grid_1789662947662_27ld6} onPageSizeChange={handleGridPageSizeChange_heroui_app_table_grid_1789662947662_27ld6} sortBy={gridQuery_heroui_app_table_grid_1789662947662_27ld6.sort?.columnId ?? ''} sortOptions={[{"value":"title","label":"Title"},{"value":"contentTypeCode","label":"Type"},{"value":"languageCode","label":"Language"},{"value":"statusCode","label":"Status"},{"value":"updatedAt","label":"Timeline"}]} onSortByChange={handleGridSortByChange_heroui_app_table_grid_1789662947662_27ld6} sortDirection={gridQuery_heroui_app_table_grid_1789662947662_27ld6.sort?.direction ?? 'asc'} onToggleSortDirection={handleGridToggleSortDirection_heroui_app_table_grid_1789662947662_27ld6} showSortControls={true} totalPages={gridPaging_heroui_app_table_grid_1789662947662_27ld6.totalPages} pageNumbers={buildDataGridPageNumbers(gridPaging_heroui_app_table_grid_1789662947662_27ld6.safePage, gridPaging_heroui_app_table_grid_1789662947662_27ld6.totalPages)} onPageChange={handleGridPageChange_heroui_app_table_grid_1789662947662_27ld6} visibleInfiniteCount={gridListMode_heroui_app_table_grid_1789662947662_27ld6 === 'infinite' ? gridPaging_heroui_app_table_grid_1789662947662_27ld6.displayRows.length : undefined} />} /></div>
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "(store.ui.visibility.node-7e584d57-7d50-4f05-a646-7940b3dabb85 === true) && (store.ui.visibility.node-7e584d57-7d50-4f05-a646-7940b3dabb85 !== false)") && (
          <CreateEditModalShell title={"Create content"} size="lg" onClose={() => { patchDesignerStore("ui.visibility.node-7e584d57-7d50-4f05-a646-7940b3dabb85", false); }} onBackdropClick={() => { patchDesignerStore("ui.visibility.node-7e584d57-7d50-4f05-a646-7940b3dabb85", false); }} gradient={false} bodyOuterClassName="-mb-[15px]" bodyClassName="!p-0" footerClassName="!mt-0">
            <form className="flex !min-h-0 flex-col gap-0 bg-white" method="post" id="node-ae735db2-9655-4f0d-b8c2-6354953d959b" data-designer-node-id="node-ae735db2-9655-4f0d-b8c2-6354953d959b">
              <div className="flex !min-w-0 flex-col gap-2 bg-white p-[15px]">
                <UiInput isRequired type="text" placeholder="Enter content title…" label="Title" size="sm" data-page-guide="" data-page-guide-title="Title" data-page-guide-hint="Required. Enter title." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_cmsContentsCreate?.title} name="node-2d86b189-3256-40bb-90b8-e6b3ebe6fff8" />
                <section className="flex flex-col gap-[2px] space-y-0 pt-3">
                  <div className="space-y-1">
                    <div className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <div className="flex min-w-0 items-center gap-2 ps-[4px]">
                        <div className="flex min-w-0 items-center gap-0.5">
                          <span className="h-3.5 w-0.5 shrink-0 rounded-full bg-indigo-400" aria-hidden />
                          <h3 className="text-[11px] font-bold uppercase tracking-wider leading-none text-indigo-800">Content type</h3>
                        </div>
                      </div>
                    </div>
                  </div>
                  <RadioGroup isRequired className="designer-choice-button-group flex !w-full flex-row flex-wrap !items-center gap-2" defaultValue={(() => { const raw = regionData_cmsContentsCreate?.contentTypeCode; if (Array.isArray(raw)) { return String(raw[0] ?? ''); } return String(raw ?? ''); })()} aria-label="Content type" orientation="horizontal" data-page-guide="" data-page-guide-title="Content type" data-page-guide-hint="Required. Enter content type." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" items={dataContext?.items} isSelected={regionData_cmsContentsCreate?.contentTypeCode} name="node-e94a7008-578d-4454-b26d-d941ceac8d59">
                  {mapDesignerLovItems(dataContext?.items, "id", "label") ?? [].map((item) => (
                    <Radio value={item.id}><Radio.Control><Radio.Indicator /></Radio.Control><Radio.Content>{item.textValue}</Radio.Content></Radio>
                  ))}
                  </RadioGroup>
                </section>
                <section className="flex flex-col gap-[2px] space-y-0 pt-3">
                  <div className="space-y-1">
                    <div className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <div className="flex min-w-0 items-center gap-2 ps-[4px]">
                        <div className="flex min-w-0 items-center gap-0.5">
                          <span className="h-3.5 w-0.5 shrink-0 rounded-full bg-violet-400" aria-hidden />
                          <h3 className="text-[11px] font-bold uppercase tracking-wider leading-none text-violet-800">Language</h3>
                        </div>
                      </div>
                    </div>
                  </div>
                  <RadioGroup isRequired className="designer-choice-button-group flex !w-full flex-row flex-wrap !items-center gap-2" selectedKeyByLanguage={"{\"en\":\"101.004.001\",\"fa\":\"101.004.002\",\"ar\":\"101.004.003\"}"} defaultValue={(() => { const raw = regionData_cmsContentsCreate?.languageCode; if (Array.isArray(raw)) { return String(raw[0] ?? ''); } return String(raw ?? ''); })()} aria-label="Language" orientation="horizontal" data-page-guide="" data-page-guide-title="Language" data-page-guide-hint="Required. Enter language." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" items={fetchData_1?.items} isSelected={regionData_cmsContentsCreate?.languageCode} name="node-b9f38c26-df56-4365-96c9-5a39d70a9cd6">
                  {mapDesignerLovItems(fetchData_1?.items, "id", "label") ?? [].map((item) => (
                    <Radio value={item.id}><Radio.Control><Radio.Indicator /></Radio.Control><Radio.Content>{item.textValue}</Radio.Content></Radio>
                  ))}
                  </RadioGroup>
                </section>
                <section className="flex flex-col gap-[2px] space-y-0 pt-3">
                  <div className="space-y-1">
                    <div className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <div className="flex min-w-0 items-center gap-2 ps-[4px]">
                        <div className="flex min-w-0 items-center gap-0.5">
                          <span className="h-3.5 w-0.5 shrink-0 rounded-full bg-cyan-500" aria-hidden />
                          <h3 className="text-[11px] font-bold uppercase tracking-wider leading-none text-cyan-800">Content Format</h3>
                        </div>
                      </div>
                    </div>
                  </div>
                  <RadioGroup isRequired className="designer-choice-button-group flex !w-full flex-row flex-wrap !items-center gap-2" defaultValue={(() => { const raw = regionData_cmsContentsCreate?.bodyFormatCode; if (Array.isArray(raw)) { return String(raw[0] ?? ''); } return String(raw ?? ''); })()} aria-label="Content Format" orientation="horizontal" data-page-guide="" data-page-guide-title="Content Format" data-page-guide-hint="Required. Enter content Format." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" items={fetchData_2?.items} isSelected={regionData_cmsContentsCreate?.bodyFormatCode} name="node-0ddb43e2-d345-4a1d-b70d-63863cdb7920">
                  {mapDesignerLovItems(fetchData_2?.items, "id", "label") ?? [].map((item) => (
                    <Radio value={item.id}><Radio.Control><Radio.Indicator /></Radio.Control><Radio.Content>{item.textValue}</Radio.Content></Radio>
                  ))}
                  </RadioGroup>
                </section>
                <RadioGroup isRequired className="hidden" defaultValue={(() => { const raw = regionData_cmsContentsCreate?.statusCode; if (Array.isArray(raw)) { return String(raw[0] ?? ''); } return String(raw ?? ''); })()} aria-label="Status" items={fetchData_3?.items} isSelected={regionData_cmsContentsCreate?.statusCode} name="node-c75a4265-d839-4d81-8f71-8dd0ead057e6">
                {mapDesignerLovItems(fetchData_3?.items, "id", "label") ?? [].map((item) => (
                  <Radio value={item.id}><Radio.Control><Radio.Indicator /></Radio.Control><Radio.Content>{item.textValue}</Radio.Content></Radio>
                ))}
                </RadioGroup>
              </div>
            </form>
            <div className="flex !w-full shrink-0 !items-center !justify-end gap-2">
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 border border-slate-200 text-slate-600 hover:bg-slate-100" variant="outline" size="md" onClick={handleonClick_node_fa37c9b8_30d2_49b1_9e49_7c9d56dad1ab}><X className="h-3.5 w-3.5" /> Cancel</Button>
              <Button type="submit" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 bg-primary-600 hover:bg-primary-700 text-white" form="node-ae735db2-9655-4f0d-b8c2-6354953d959b" variant="primary" size="md" href="#" target="_self" isDisabled={isSubmitting} onClick={handleonClick_node_be72eeae_27d6_4199_9b00_fdc4d70ad262}><Plus className="h-3.5 w-3.5" /> Create content</Button>
            </div>
          </CreateEditModalShell>
        )}
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "(store.ui.visibility.node-eee24fcf-4d2a-4e4b-ab7e-acfb41c5b46f === true) && (store.ui.visibility.node-eee24fcf-4d2a-4e4b-ab7e-acfb41c5b46f !== false)") && (
          <ConfirmDialogShell title={"Delete content?"} size="sm" onClose={() => { patchDesignerStore("ui.visibility.node-eee24fcf-4d2a-4e4b-ab7e-acfb41c5b46f", false); }} onBackdropClick={() => { patchDesignerStore("ui.visibility.node-eee24fcf-4d2a-4e4b-ab7e-acfb41c5b46f", false); }} tone="danger" hideCancel hideConfirm icon={<Trash2 className="h-4 w-4" />} bodyClassName="!p-0" footerClassName="!mt-0">
            <p className="block p-[15px] !text-sm text-slate-700">Delete this content? This cannot be undone.</p>
            <div className="flex !w-full shrink-0 !items-center !justify-end gap-2">
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 border border-slate-200 text-slate-600 hover:bg-slate-100" variant="outline" size="md" onClick={handleonClick_node_3e87543b_1b19_455b_abae_06425d8329d2}><X className="h-3.5 w-3.5" /> Cancel</Button>
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 bg-rose-600 hover:bg-rose-700 text-white" variant="primary" size="md" onClick={handleonClick_node_fa6ab9b3_10c2_4a73_b954_d8a6e7adb8dc}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
            </div>
          </ConfirmDialogShell>
        )}
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "store.ui.visibility.node-50089edb-5b32-4d97-acc1-dea0da037d45 === true") && (
          <CreateEditModalShell title={"Change status"} size="lg" onClose={() => { patchDesignerStore("ui.visibility.node-50089edb-5b32-4d97-acc1-dea0da037d45", false); }} onBackdropClick={() => { patchDesignerStore("ui.visibility.node-50089edb-5b32-4d97-acc1-dea0da037d45", false); }} gradient={false} bodyOuterClassName="-mb-[15px]" bodyClassName="!p-0" footerClassName="!mt-0">
            <DesignerRuntimeContentStatusPicker node={{"id":"node-e6aababf-8a52-4ef3-98ee-7f6705acd1e9","type":"container","props":{"className":"flex flex-col gap-2 bg-white p-[15px]","contentStatusPicker":true,"contentStatusPickerLovRef":"cmsStatuses","contentStatusPickerDataSourceRef":"cmsContents","contentStatusPickerRecordIdPath":"selection.id","contentStatusPickerModalNodeId":"node-50089edb-5b32-4d97-acc1-dea0da037d45","contentStatusPickerSuccessToast":"Status updated","_designerPaletteItemId":"layout.flex-column","_isBuiltInTemplateRoot":true,"twDisplay":"flex","twPosition":"","twOverflow":"","twPadding":"","twMargin":"","twWidth":"","twHeight":"","twFlexDirection":"flex-col","twItems":"","twJustify":"","twGap":"gap-2","twGridCols":"","twTextSize":"","twFontWeight":"","twTextAlign":"","twRounded":"","twShadow":"","twOpacity":""},"parentId":"node-50089edb-5b32-4d97-acc1-dea0da037d45","order":0,"layout":{},"binding":{},"children":[]} as any} options={{ mode: 'runtime', bindingDefinitions: {"definitions":{"defaultVisibility":{"sourceType":"static","sourcePath":"true","fallbackValue":true}},"storeSegments":{"gridToolbar":{"id":"gridToolbar","initialValue":{"search":"","filters":{"contentTypeCode":"","statusCode":""}},"persist":"local"},"gridQuery":{"id":"gridQuery","initialValue":{"sortBy":"updatedAt","sortDir":"desc","page":1,"pageSize":50,"filters":{}},"persist":"none"},"selection":{"id":"selection","initialValue":{"id":null},"persist":"none"}},"dataSources":{"cmsContents":{"id":"cmsContents","name":"content","endpoint":"/api/cms/contents","fields":["id","title","slug","contentTypeCode","languageCode","bodyFormatCode","statusCode","statusCodeTitle","statusCodeUiHtml","statusCodeUiColor","statusCodeUpdatedAt","commentCount","createdAt","updatedAt"],"primaryKey":"id","kind":"collection","operations":{"list":{"method":"GET","endpoint":"/api/cms/contents"},"detail":{"method":"GET","endpoint":"/api/cms/contents/:id"},"create":{"method":"POST","endpoint":"/api/cms/contents"},"update":{"method":"PUT","endpoint":"/api/cms/contents/:id"},"delete":{"method":"DELETE","endpoint":"/api/cms/contents/:id"}},"responseMapping":{"dataPath":"data","arrayPath":"data","totalPath":"count"}},"cmsContentsCreate":{"id":"cmsContentsCreate","name":"new content","endpoint":"/api/cms/contents","fields":["title","contentTypeCode","languageCode","bodyFormatCode","statusCode"],"kind":"record","operations":{"create":{"method":"POST","endpoint":"/api/cms/contents"}}},"cmsRevisions":{"id":"cmsRevisions","name":"CMS Content Revisions","endpoint":"/api/cms/revisions","fields":["id","contentId","revisionNo","title","summary","body"],"primaryKey":"id","kind":"collection","operations":{"list":{"method":"GET","endpoint":"/api/cms/revisions"}},"responseMapping":{"dataPath":"data","arrayPath":"data","totalPath":"count"}}},"lovs":{"cmsStatuses":{"id":"cmsStatuses","name":"Statuses","endpoint":"/api/base-info/options?root=101.002&lang=en","displayValue":"label","returnValue":"id"},"cmsContentTypes":{"id":"cmsContentTypes","name":"Content Types","endpoint":"/api/base-info/options?root=101.001&lang=en","displayValue":"label","returnValue":"id"},"cmsLanguages":{"id":"cmsLanguages","name":"Languages","endpoint":"/api/base-info/options?root=101.004&lang=en","displayValue":"label","returnValue":"id"},"cmsBodyFormats":{"id":"cmsBodyFormats","name":"Body Formats","endpoint":"/api/base-info/options?root=101.003&lang=en","displayValue":"label","returnValue":"id"},"cmsCommentPolicies":{"id":"cmsCommentPolicies","name":"Comment Policies","endpoint":"/api/base-info/options?root=101.006&lang=en","displayValue":"label","returnValue":"id"}}}, designerStore: designerStore, previewEvents: { patchStore: patchDesignerStore, getDesignerStore: () => designerStore, refreshDataSource: async () => { await refresh_gridData_heroui_app_table_grid_1789662947662_27ld6(); } } }} />
          </CreateEditModalShell>
        )}
      </div>
    </>
  );
};
