import React from 'react';
import { useCulture } from '@/core/culture/CultureContext';
import { buildAppTableGridColumns } from '@/domain/component-designer/DesignerRuntimeAppTableGrid';
import { applyClientGridQuery, EMPTY_GRID_QUERY, type GridQueryState } from '@/shared/lib/appTableGridQuery';
import { resolveDataGridTotalCount, sliceDataGridRowsForDisplay, buildDataGridPageNumbers, applyGridAggregation } from '@/domain/component-designer/designerDataGridRuntime';
import { applyDesignerGridToolbarClientFilters } from '@/domain/component-designer/designerGridToolbarConfig';
import { createDefaultColumnLayout } from '@/shared/lib/appTableGridColumnLayout';
import { validateDesignerFieldNode } from '@/domain/component-designer/previewFieldValidation';
import { HwyInstituteLogoUploadField } from '@/domain/hwy/HwyInstituteLogoUploadField';
import { AppTableGrid, CreateEditModalShell, GridPagingFooter, ListPageShell, ListPageToolbarFrame, PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS, PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS, ToolbarFilterSelect, UiCheckbox } from '@/shared/ui';
import { UiInput, UiTextarea } from '@/shared/ui/HeroFieldControls';
import { Button, Card, Switch, Toast, toast } from '@heroui/react';
import { Plus, Save, X } from 'lucide-react';

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
  const culture = useCulture();
  const { store: designerStore, patch: patchDesignerStore } = useDesignerStore<Record<string, unknown>>({"selection":{"id":null}});
  const { data: raw_regionData_hwyinstitutesList_node_ac594618_a48b_482f_8955_89b913d7e39a, isLoading: isLoading_regionData_hwyinstitutesList_node_ac594618_a48b_482f_8955_89b913d7e39a, error: error_regionData_hwyinstitutesList_node_ac594618_a48b_482f_8955_89b913d7e39a, refresh: refresh_regionData_hwyinstitutesList_node_ac594618_a48b_482f_8955_89b913d7e39a } = useDataFetch<unknown>(resolveBindingUrl("/api/hwy/institutes/:id", designerStore, { "id": "selection.id" }), {});
  const regionData_hwyinstitutesList_node_ac594618_a48b_482f_8955_89b913d7e39a = React.useMemo(() => coerceApiRecordValue(applyResponseDataPath(raw_regionData_hwyinstitutesList_node_ac594618_a48b_482f_8955_89b913d7e39a, {"dataPath":"data","arrayPath":"data","totalPath":"count"})), [raw_regionData_hwyinstitutesList_node_ac594618_a48b_482f_8955_89b913d7e39a]);
  const handleGridRowAction_heroui_app_table_grid_1793645604280_hpw4a = React.useCallback((row: Record<string, unknown>, actionId: string) => {
    switch (actionId) {
      case "edit": {
        patchDesignerStore("selection.id", row["id"] ?? null);
        patchDesignerStore("ui.visibility.node-36e60d73-bdf2-46a0-bbe8-2a5dd5a3b3db", true);
        return;
      }
      default:
        return;
    }
  }, [patchDesignerStore]);
  const handleGridCellClick_heroui_app_table_grid_1793645604280_hpw4a = React.useCallback(async (row: Record<string, unknown>, column: { key?: string; id?: string }) => {
    const columnKey = String(column.key ?? column.id ?? '');
    switch (columnKey) {
      case "logoUrl": {
        patchDesignerStore("selection.id", row["id"] ?? null);
        patchDesignerStore("ui.visibility.node-36e60d73-bdf2-46a0-bbe8-2a5dd5a3b3db", true);
        return;
      }
      default:
        return;
    }
  }, [patchDesignerStore, handleGridRowAction_heroui_app_table_grid_1793645604280_hpw4a]);
  const { data: raw_gridData_heroui_app_table_grid_1793645604280_hpw4a, isLoading: isLoading_gridData_heroui_app_table_grid_1793645604280_hpw4a, error: error_gridData_heroui_app_table_grid_1793645604280_hpw4a, refresh: refresh_gridData_heroui_app_table_grid_1793645604280_hpw4a } = useDataFetch<unknown>(resolveBindingUrl("/api/hwy/institutes", designerStore, { "search": "gridToolbar.search", "sortBy": "gridQuery.sortBy", "sortDir": "gridQuery.sortDir", "page": "gridQuery.page", "pageSize": "gridQuery.pageSize", "includeCount": "static:page1Only" }), {});
  const gridData_heroui_app_table_grid_1793645604280_hpw4a = React.useMemo(() => applyResponseDataPath(raw_gridData_heroui_app_table_grid_1793645604280_hpw4a, {"dataPath":"data","arrayPath":"data","totalPath":"count"}), [raw_gridData_heroui_app_table_grid_1793645604280_hpw4a]);
  const gridColumns_heroui_app_table_grid_1793645604280_hpw4a = React.useMemo(() => buildAppTableGridColumns([{"key":"logoUrl","label":"Logo","labelTranslationKey":"hwy.institutes.column.logo","cellKind":"avatar","cellFields":{"imageUrlField":"logoUrl","fallbackTextField":"code","avatarSizePx":36},"cellClickBehavior":{"kind":"open-modal","modalNodeId":"node-36e60d73-bdf2-46a0-bbe8-2a5dd5a3b3db","primaryKeyField":"id","selectionStorePath":"selection.id"},"layoutResizable":false,"width":"64px","headerClassName":"text-center [&>div]:justify-center","cellClassName":"text-center"},{"key":"code","label":"Latin name","labelTranslationKey":"hwy.institutes.column.code","sort":true,"cardRole":"meta","layoutResizable":false,"width":"140px"},{"key":"titleAr","label":"Title","labelTranslationKey":"hwy.institutes.column.title","sort":true,"cardRole":"title","layoutResizable":true},{"key":"isActive","label":"On","labelTranslationKey":"hwy.institutes.column.isActive","sort":true,"cellKind":"boolean-icon","cardRole":"meta","layoutResizable":false,"width":"56px","headerClassName":"text-center [&>div]:justify-center [&>div>span]:flex-none whitespace-nowrap text-[10px] leading-tight px-0.5 max-w-[4rem]","cellClassName":"text-center nakhebin-voted-grid-cell px-0.5"},{"key":"allowsSelfRegistration","label":"Self","labelTranslationKey":"hwy.institutes.column.allowsSelfRegistration","sort":true,"cellKind":"boolean-icon","cardRole":"hidden","layoutResizable":false,"width":"56px","headerClassName":"text-center [&>div]:justify-center [&>div>span]:flex-none whitespace-nowrap text-[10px] leading-tight px-0.5 max-w-[4rem]","cellClassName":"text-center nakhebin-voted-grid-cell px-0.5"},{"key":"allowsInvite","label":"Invite","labelTranslationKey":"hwy.institutes.column.allowsInvite","sort":true,"cellKind":"boolean-icon","cardRole":"hidden","layoutResizable":false,"width":"56px","headerClassName":"text-center [&>div]:justify-center [&>div>span]:flex-none whitespace-nowrap text-[10px] leading-tight px-0.5 max-w-[4rem]","cellClassName":"text-center nakhebin-voted-grid-cell px-0.5"},{"key":"hideMemberPhones","label":"Hide tel","labelTranslationKey":"hwy.institutes.column.hideMemberPhones","sort":true,"cellKind":"boolean-icon","cardRole":"hidden","layoutResizable":false,"width":"56px","headerClassName":"text-center [&>div]:justify-center [&>div>span]:flex-none whitespace-nowrap text-[10px] leading-tight px-0.5 max-w-[4rem]","cellClassName":"text-center nakhebin-voted-grid-cell px-0.5"},{"key":"hasDedicatedList","label":"List","labelTranslationKey":"hwy.institutes.column.hasDedicatedList","sort":true,"cellKind":"boolean-icon","cardRole":"hidden","layoutResizable":false,"width":"56px","headerClassName":"text-center [&>div]:justify-center [&>div>span]:flex-none whitespace-nowrap text-[10px] leading-tight px-0.5 max-w-[4rem]","cellClassName":"text-center nakhebin-voted-grid-cell px-0.5"},{"key":"allowsListScopedEdit","label":"L-edit","labelTranslationKey":"hwy.institutes.column.allowsListScopedEdit","sort":true,"cellKind":"boolean-icon","cardRole":"hidden","layoutResizable":false,"width":"56px","headerClassName":"text-center [&>div]:justify-center [&>div>span]:flex-none whitespace-nowrap text-[10px] leading-tight px-0.5 max-w-[4rem]","cellClassName":"text-center nakhebin-voted-grid-cell px-0.5"},{"key":"showInstituteCharacterInDossier","label":"Dossier","labelTranslationKey":"hwy.institutes.column.showInstituteCharacterInDossier","sort":true,"cellKind":"boolean-icon","cardRole":"hidden","layoutResizable":false,"width":"56px","headerClassName":"text-center [&>div]:justify-center [&>div>span]:flex-none whitespace-nowrap text-[10px] leading-tight px-0.5 max-w-[4rem]","cellClassName":"text-center nakhebin-voted-grid-cell px-0.5"},{"key":"actions","label":"","kind":"action-group","actions":[{"actionId":"edit","icon":"Pencil","intent":"edit","tooltip":"Edit","behavior":{"kind":"open-modal","modalNodeId":"node-36e60d73-bdf2-46a0-bbe8-2a5dd5a3b3db","primaryKeyField":"id","selectionStorePath":"selection.id"}}],"maxVisibleActions":3,"cardRole":"actions","layoutHideable":false,"layoutResizable":false,"layoutReorderable":false,"width":"30px"}], "server", {
    mode: 'runtime',
    detailFlowRef: { current: null },
    rowActionHandlerRef: { current: handleGridRowAction_heroui_app_table_grid_1793645604280_hpw4a },
    cellClickHandlerRef: { current: handleGridCellClick_heroui_app_table_grid_1793645604280_hpw4a },
    designerStoreRef: { current: designerStore },
    translate: (key) => culture.t(key),
  }), [designerStore, handleGridRowAction_heroui_app_table_grid_1793645604280_hpw4a, handleGridCellClick_heroui_app_table_grid_1793645604280_hpw4a, culture]);
  const gridSortOptions_heroui_app_table_grid_1793645604280_hpw4a = React.useMemo(() => [{"value":"code","label":"Latin name","labelTranslationKey":"hwy.institutes.column.code"},{"value":"titleAr","label":"Title","labelTranslationKey":"hwy.institutes.column.title"},{"value":"isActive","label":"On","labelTranslationKey":"hwy.institutes.column.isActive"},{"value":"allowsSelfRegistration","label":"Self","labelTranslationKey":"hwy.institutes.column.allowsSelfRegistration"},{"value":"allowsInvite","label":"Invite","labelTranslationKey":"hwy.institutes.column.allowsInvite"},{"value":"hideMemberPhones","label":"Hide tel","labelTranslationKey":"hwy.institutes.column.hideMemberPhones"},{"value":"hasDedicatedList","label":"List","labelTranslationKey":"hwy.institutes.column.hasDedicatedList"},{"value":"allowsListScopedEdit","label":"L-edit","labelTranslationKey":"hwy.institutes.column.allowsListScopedEdit"},{"value":"showInstituteCharacterInDossier","label":"Dossier","labelTranslationKey":"hwy.institutes.column.showInstituteCharacterInDossier"}].map((option) => ({ value: option.value, label: option.labelTranslationKey ? culture.t(option.labelTranslationKey) : option.label })), [culture]);
  const [gridQuery_heroui_app_table_grid_1793645604280_hpw4a, setGridQuery_heroui_app_table_grid_1793645604280_hpw4a] = React.useState<GridQueryState>(() => ({ ...EMPTY_GRID_QUERY, sort: { columnId: "code", direction: "asc" } }));
  const [gridPage_heroui_app_table_grid_1793645604280_hpw4a, setGridPage_heroui_app_table_grid_1793645604280_hpw4a] = React.useState(1);
  const [gridPageSize_heroui_app_table_grid_1793645604280_hpw4a, setGridPageSize_heroui_app_table_grid_1793645604280_hpw4a] = React.useState(1000);
  const [gridListMode_heroui_app_table_grid_1793645604280_hpw4a, setGridListMode_heroui_app_table_grid_1793645604280_hpw4a] = React.useState<'paging' | 'infinite'>("paging");
  const [gridColumnLayout_heroui_app_table_grid_1793645604280_hpw4a, setGridColumnLayout_heroui_app_table_grid_1793645604280_hpw4a] = React.useState(() => createDefaultColumnLayout(gridColumns_heroui_app_table_grid_1793645604280_hpw4a));
  const [gridSearchInput_heroui_app_table_grid_1793645604280_hpw4a, setGridSearchInput_heroui_app_table_grid_1793645604280_hpw4a] = React.useState('');
  const [gridDebouncedSearch_heroui_app_table_grid_1793645604280_hpw4a, setGridDebouncedSearch_heroui_app_table_grid_1793645604280_hpw4a] = React.useState('');
  const [gridCheckboxSelections_heroui_app_table_grid_1793645604280_hpw4a, setGridCheckboxSelections_heroui_app_table_grid_1793645604280_hpw4a] = React.useState<Record<string, Record<string, boolean>>>({});
  const [gridRadioSelections_heroui_app_table_grid_1793645604280_hpw4a, setGridRadioSelections_heroui_app_table_grid_1793645604280_hpw4a] = React.useState<Record<string, string>>({});
  const [gridMatchLogic_heroui_app_table_grid_1793645604280_hpw4a, setGridMatchLogic_heroui_app_table_grid_1793645604280_hpw4a] = React.useState<Record<string, 'and' | 'or'>>({});
  const gridRoleFilters_heroui_app_table_grid_1793645604280_hpw4a = {};
  const gridFilteredRows_heroui_app_table_grid_1793645604280_hpw4a = React.useMemo(() => applyClientGridQuery(((Array.isArray(gridData_heroui_app_table_grid_1793645604280_hpw4a) ? gridData_heroui_app_table_grid_1793645604280_hpw4a : []) ?? []), gridQuery_heroui_app_table_grid_1793645604280_hpw4a, gridColumns_heroui_app_table_grid_1793645604280_hpw4a, "server"), [gridQuery_heroui_app_table_grid_1793645604280_hpw4a, gridColumns_heroui_app_table_grid_1793645604280_hpw4a]);
  const gridAggregatedRows_heroui_app_table_grid_1793645604280_hpw4a = gridFilteredRows_heroui_app_table_grid_1793645604280_hpw4a;
  const gridApiTotal_heroui_app_table_grid_1793645604280_hpw4a = React.useMemo(() => {
    const raw = raw_gridData_heroui_app_table_grid_1793645604280_hpw4a;
    const value = readNestedContextValue((raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}), "count");
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
  }, [raw_gridData_heroui_app_table_grid_1793645604280_hpw4a]);
  const gridTotalCount_heroui_app_table_grid_1793645604280_hpw4a = resolveDataGridTotalCount({ page: gridPage_heroui_app_table_grid_1793645604280_hpw4a, pageSize: gridPageSize_heroui_app_table_grid_1793645604280_hpw4a, total: gridApiTotal_heroui_app_table_grid_1793645604280_hpw4a, gridQueryMode: "server" }, gridAggregatedRows_heroui_app_table_grid_1793645604280_hpw4a.length);
  const gridPaging_heroui_app_table_grid_1793645604280_hpw4a = sliceDataGridRowsForDisplay(gridAggregatedRows_heroui_app_table_grid_1793645604280_hpw4a, gridPage_heroui_app_table_grid_1793645604280_hpw4a, gridPageSize_heroui_app_table_grid_1793645604280_hpw4a, gridTotalCount_heroui_app_table_grid_1793645604280_hpw4a, "server");
  const handleGridQueryChange_heroui_app_table_grid_1793645604280_hpw4a = React.useCallback((nextQuery: GridQueryState) => {
    setGridQuery_heroui_app_table_grid_1793645604280_hpw4a(nextQuery);
    setGridPage_heroui_app_table_grid_1793645604280_hpw4a(1);
    patchDesignerStore("gridQuery.sortBy", nextQuery.sort?.columnId ?? '');
    patchDesignerStore("gridQuery.sortDir", nextQuery.sort?.direction ?? '');
  }, [patchDesignerStore]);
  const handleGridPageChange_heroui_app_table_grid_1793645604280_hpw4a = React.useCallback((nextPage: number) => {
    setGridPage_heroui_app_table_grid_1793645604280_hpw4a(nextPage);
    patchDesignerStore("gridQuery.page", nextPage);
  }, [patchDesignerStore]);
  const handleGridPageSizeChange_heroui_app_table_grid_1793645604280_hpw4a = React.useCallback((nextSize: number) => {
    setGridPageSize_heroui_app_table_grid_1793645604280_hpw4a(nextSize);
    setGridPage_heroui_app_table_grid_1793645604280_hpw4a(1);
    patchDesignerStore("gridQuery.pageSize", nextSize);
  }, [patchDesignerStore]);
  const handleGridSortByChange_heroui_app_table_grid_1793645604280_hpw4a = React.useCallback((nextSortBy: string) => {
    setGridQuery_heroui_app_table_grid_1793645604280_hpw4a((current: GridQueryState) => ({ ...current, sort: nextSortBy ? { columnId: nextSortBy, direction: current.sort?.direction ?? 'asc' } : null }));
  }, []);
  const handleGridToggleSortDirection_heroui_app_table_grid_1793645604280_hpw4a = React.useCallback(() => {
    setGridQuery_heroui_app_table_grid_1793645604280_hpw4a((current: GridQueryState) => (current.sort ? { ...current, sort: { ...current.sort, direction: current.sort.direction === 'asc' ? 'desc' : 'asc' } } : current));
  }, []);
  const searchDebounceTimer_heroui_app_table_grid_1793645604280_hpw4a = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleGridSearchChange_heroui_app_table_grid_1793645604280_hpw4a = React.useCallback((nextValue: string) => {
    setGridSearchInput_heroui_app_table_grid_1793645604280_hpw4a(nextValue);
    if (searchDebounceTimer_heroui_app_table_grid_1793645604280_hpw4a.current) {
      clearTimeout(searchDebounceTimer_heroui_app_table_grid_1793645604280_hpw4a.current);
    }
    searchDebounceTimer_heroui_app_table_grid_1793645604280_hpw4a.current = setTimeout(() => {
      setGridDebouncedSearch_heroui_app_table_grid_1793645604280_hpw4a(nextValue);
      setGridPage_heroui_app_table_grid_1793645604280_hpw4a(1);
      patchDesignerStore("gridToolbar.search", nextValue);
    }, 300);
  }, [patchDesignerStore]);

  const dataContext: Record<string, unknown> | null = null;
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const handleonClick_node_cd4deb6a_0594_494a_9d82_7adc1493b8dc = React.useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    let formData: FormData;
    const form = event.currentTarget instanceof HTMLFormElement ? event.currentTarget : event.currentTarget.closest('form');
    if (form) {
      formData = new FormData(form);
    } else {
      const regionRoot = document.querySelector("[data-designer-node-id=\"node-6fde13e5-cf40-4358-b837-4ff1177f7bbf\"]");
      if (!regionRoot) {
        return;
      }
      formData = collectRegionFormDataFromContainer(regionRoot, ["node-5fe071bd-0db5-4509-94dc-151bdd69eef5","node-ffa61b38-568f-488a-b626-a87be704fa95","node-b333ed58-378d-46e7-98f2-0a403a609f01","node-f2e3c037-3ea5-4dca-8a9b-50f3d549adfb","node-c0be51bd-bfea-4f6c-8dc8-cd4485267571","node-c3ea6d19-0783-443c-9da0-7664dff95aaf","node-c0f92000-d94d-4896-b062-0d7c48b72a3b","node-a81b2e64-9fde-458f-a15c-c8748a725373","node-ff1f79b6-73cb-49b7-b3e1-3a3f187c8750","node-83075f62-80d8-4cd1-8958-6871edd5a0aa","node-9ef01de2-746c-46e7-9687-8a08fe1d09c8"]);
    }
    const fieldValidationEntries = [{"nodeId":"node-ffa61b38-568f-488a-b626-a87be704fa95","formFieldName":"node-ffa61b38-568f-488a-b626-a87be704fa95","props":{"_designerPaletteItemId":"heroui.input-text","isRequired":true}}] as Array<{ nodeId: string; formFieldName: string; props: Record<string, unknown> }>;
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
      payload["logoContentBase64"] = formData.get("node-5fe071bd-0db5-4509-94dc-151bdd69eef5") ?? '';
      payload["titleAr"] = formData.get("node-ffa61b38-568f-488a-b626-a87be704fa95") ?? '';
      payload["isActive"] = applyPayloadFieldTransform(formData.get("node-b333ed58-378d-46e7-98f2-0a403a609f01"), "boolean");
      payload["allowsSelfRegistration"] = applyPayloadFieldTransform(formData.get("node-f2e3c037-3ea5-4dca-8a9b-50f3d549adfb"), "boolean");
      payload["allowsInvite"] = applyPayloadFieldTransform(formData.get("node-c0be51bd-bfea-4f6c-8dc8-cd4485267571"), "boolean");
      payload["inviteExpiresAfterDays"] = applyPayloadFieldTransform(formData.get("node-c3ea6d19-0783-443c-9da0-7664dff95aaf"), "number");
      payload["hideMemberPhones"] = applyPayloadFieldTransform(formData.get("node-c0f92000-d94d-4896-b062-0d7c48b72a3b"), "boolean");
      payload["hasDedicatedList"] = applyPayloadFieldTransform(formData.get("node-a81b2e64-9fde-458f-a15c-c8748a725373"), "boolean");
      payload["allowsListScopedEdit"] = applyPayloadFieldTransform(formData.get("node-ff1f79b6-73cb-49b7-b3e1-3a3f187c8750"), "boolean");
      payload["showInstituteCharacterInDossier"] = applyPayloadFieldTransform(formData.get("node-83075f62-80d8-4cd1-8958-6871edd5a0aa"), "boolean");
      payload["note"] = formData.get("node-9ef01de2-746c-46e7-9687-8a08fe1d09c8") ?? '';
      const method = regionData_hwyinstitutesList_node_6fde13e5_cf40_4358_b837_4ff1177f7bbf?.id != null && String(regionData_hwyinstitutesList_node_6fde13e5_cf40_4358_b837_4ff1177f7bbf?.id).length > 0 ? "PUT" : 'POST';
      const url = (regionData_hwyinstitutesList_node_6fde13e5_cf40_4358_b837_4ff1177f7bbf?.id != null && String(regionData_hwyinstitutesList_node_6fde13e5_cf40_4358_b837_4ff1177f7bbf?.id).length > 0 ? (regionData_hwyinstitutesList_node_6fde13e5_cf40_4358_b837_4ff1177f7bbf?.id != null && String(regionData_hwyinstitutesList_node_6fde13e5_cf40_4358_b837_4ff1177f7bbf?.id).length > 0 ? ("/api/hwy/institutes/" + encodeURIComponent(String(regionData_hwyinstitutesList_node_6fde13e5_cf40_4358_b837_4ff1177f7bbf?.id)) + "") : "/api/hwy/institutes/:id") : "/api/hwy/institutes");
      const response = await designerFetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response));
      }
      patchDesignerStore("ui.visibility.node-dcf70428-9758-4dee-ac10-0b7294b77b03", false);
      toast("Saved successfully", { variant: "success", timeout: 4000 });
      await refresh_gridData_heroui_app_table_grid_1793645604280_hpw4a();
      (document.querySelector("[data-designer-node-id=\"node-6fde13e5-cf40-4358-b837-4ff1177f7bbf\"]") as HTMLFormElement | null)?.reset?.();
    } catch (mutationFailure) {
      toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' });
    }
    finally {
      setIsSubmitting(false);
    }
  }, [regionData_hwyinstitutesList_node_6fde13e5_cf40_4358_b837_4ff1177f7bbf]);
  const handleonClick_node_92fdcfa0_8bb5_4537_ad01_352f3ca2a06c = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-dcf70428-9758-4dee-ac10-0b7294b77b03", false);
  }, [patchDesignerStore]);
  const handleonClick_node_5b8c25d8_73c7_4fe0_89fb_fe2080e3005d = React.useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    let formData: FormData;
    const form = event.currentTarget instanceof HTMLFormElement ? event.currentTarget : event.currentTarget.closest('form');
    if (form) {
      formData = new FormData(form);
    } else {
      const regionRoot = document.querySelector("[data-designer-node-id=\"node-ac594618-a48b-482f-8955-89b913d7e39a\"]");
      if (!regionRoot) {
        return;
      }
      formData = collectRegionFormDataFromContainer(regionRoot, ["node-b6306efa-ba8e-45d6-9a8d-dfb15f623a02","node-13efe8cb-095d-4ba4-90f6-e47cfafaaac5","node-862a57d1-6e94-48a0-8ab7-6c02afab0722","node-8674e3ba-01f7-41db-830f-094ddebe4ed0","node-1db465b9-beaf-403f-8b36-e0de6cf80027","node-b75d0ff1-b7e4-4cfb-a4f7-5ee3bd6116ec","node-33f6b773-d561-4966-b0ca-dd7786cea31a","node-715e102e-3468-4058-9dd3-5c6e1440aeb9","node-0f000a75-7804-4fec-ab72-491c98035bd9","node-f9ecffd0-20f3-429f-bf06-67768a26dc88","node-1663604d-cbd8-4297-ba26-878b91c946c3"]);
    }
    const fieldValidationEntries = [{"nodeId":"node-13efe8cb-095d-4ba4-90f6-e47cfafaaac5","formFieldName":"node-13efe8cb-095d-4ba4-90f6-e47cfafaaac5","props":{"_designerPaletteItemId":"heroui.input-text","isRequired":true}}] as Array<{ nodeId: string; formFieldName: string; props: Record<string, unknown> }>;
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
      payload["logoContentBase64"] = formData.get("node-b6306efa-ba8e-45d6-9a8d-dfb15f623a02") ?? '';
      payload["titleAr"] = formData.get("node-13efe8cb-095d-4ba4-90f6-e47cfafaaac5") ?? '';
      payload["isActive"] = applyPayloadFieldTransform(formData.get("node-862a57d1-6e94-48a0-8ab7-6c02afab0722"), "boolean");
      payload["allowsSelfRegistration"] = applyPayloadFieldTransform(formData.get("node-8674e3ba-01f7-41db-830f-094ddebe4ed0"), "boolean");
      payload["allowsInvite"] = applyPayloadFieldTransform(formData.get("node-1db465b9-beaf-403f-8b36-e0de6cf80027"), "boolean");
      payload["inviteExpiresAfterDays"] = applyPayloadFieldTransform(formData.get("node-b75d0ff1-b7e4-4cfb-a4f7-5ee3bd6116ec"), "number");
      payload["hideMemberPhones"] = applyPayloadFieldTransform(formData.get("node-33f6b773-d561-4966-b0ca-dd7786cea31a"), "boolean");
      payload["hasDedicatedList"] = applyPayloadFieldTransform(formData.get("node-715e102e-3468-4058-9dd3-5c6e1440aeb9"), "boolean");
      payload["allowsListScopedEdit"] = applyPayloadFieldTransform(formData.get("node-0f000a75-7804-4fec-ab72-491c98035bd9"), "boolean");
      payload["showInstituteCharacterInDossier"] = applyPayloadFieldTransform(formData.get("node-f9ecffd0-20f3-429f-bf06-67768a26dc88"), "boolean");
      payload["note"] = formData.get("node-1663604d-cbd8-4297-ba26-878b91c946c3") ?? '';
      const method = regionData_hwyinstitutesList_node_ac594618_a48b_482f_8955_89b913d7e39a?.id != null && String(regionData_hwyinstitutesList_node_ac594618_a48b_482f_8955_89b913d7e39a?.id).length > 0 ? "PUT" : 'POST';
      const url = (regionData_hwyinstitutesList_node_ac594618_a48b_482f_8955_89b913d7e39a?.id != null && String(regionData_hwyinstitutesList_node_ac594618_a48b_482f_8955_89b913d7e39a?.id).length > 0 ? (regionData_hwyinstitutesList_node_ac594618_a48b_482f_8955_89b913d7e39a?.id != null && String(regionData_hwyinstitutesList_node_ac594618_a48b_482f_8955_89b913d7e39a?.id).length > 0 ? ("/api/hwy/institutes/" + encodeURIComponent(String(regionData_hwyinstitutesList_node_ac594618_a48b_482f_8955_89b913d7e39a?.id)) + "") : "/api/hwy/institutes/:id") : "/api/hwy/institutes");
      const response = await designerFetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response));
      }
      patchDesignerStore("ui.visibility.node-36e60d73-bdf2-46a0-bbe8-2a5dd5a3b3db", false);
      toast("Saved successfully", { variant: "success", timeout: 4000 });
      await refresh_gridData_heroui_app_table_grid_1793645604280_hpw4a();
    } catch (mutationFailure) {
      toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' });
    }
    finally {
      setIsSubmitting(false);
    }
  }, [regionData_hwyinstitutesList_node_ac594618_a48b_482f_8955_89b913d7e39a]);
  const handleonClick_node_c23a5712_e7d7_4554_a12b_3bb357f4bbf7 = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-36e60d73-bdf2-46a0-bbe8-2a5dd5a3b3db", false);
  }, [patchDesignerStore]);
  return (
    <>
      <Toast.Provider />
      <div className="h-full min-h-0 w-full min-w-0 space-y-3">
        <ListPageShell className="flex min-h-0 w-full flex-1 flex-col"><ListPageToolbarFrame><div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}><input type="text" value={gridSearchInput_heroui_app_table_grid_1793645604280_hpw4a} onChange={(event) => handleGridSearchChange_heroui_app_table_grid_1793645604280_hpw4a(event.target.value)} placeholder={culture.t("hwy.institutes.search.placeholder")} className="h-8 rounded-md border border-slate-200 px-2 text-sm" /></div><div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}><button type="button" onClick={() => { patchDesignerStore("selection.id", null); patchDesignerStore("ui.visibility.node-dcf70428-9758-4dee-ac10-0b7294b77b03", true); }} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700">Create</button><span className="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold tabular-nums text-slate-700" aria-live="polite">{gridTotalCount_heroui_app_table_grid_1793645604280_hpw4a.toLocaleString()}</span><button type="button" onClick={() => { void refresh_gridData_heroui_app_table_grid_1793645604280_hpw4a(); }} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">{culture.t("hwy.institutes.toolbar.refresh")}</button></div></ListPageToolbarFrame><AppTableGrid className="flex !h-full !min-h-0 !w-full flex-1 flex-col" showPagingFooter={false} presentation="auto" cardBelow="tablet" size="sm" columns={gridColumns_heroui_app_table_grid_1793645604280_hpw4a} rows={gridPaging_heroui_app_table_grid_1793645604280_hpw4a.displayRows} getRowKey={(row) => String((row as Record<string, unknown>)["id"] ?? '')} enableColumnLayout={false} columnLayout={gridColumnLayout_heroui_app_table_grid_1793645604280_hpw4a} onColumnLayoutChange={setGridColumnLayout_heroui_app_table_grid_1793645604280_hpw4a} isLoading={isLoading_gridData_heroui_app_table_grid_1793645604280_hpw4a} loadingMessage={culture.t("hwy.institutes.loading")} emptyMessage={culture.t("hwy.institutes.empty")} isEmpty={gridAggregatedRows_heroui_app_table_grid_1793645604280_hpw4a.length === 0} errorContent={(error_gridData_heroui_app_table_grid_1793645604280_hpw4a ? culture.t("hwy.institutes.error") : undefined)} gridQueryMode={"server"} query={gridQuery_heroui_app_table_grid_1793645604280_hpw4a} onQueryChange={handleGridQueryChange_heroui_app_table_grid_1793645604280_hpw4a} onGridRowAction={handleGridRowAction_heroui_app_table_grid_1793645604280_hpw4a} footer={<GridPagingFooter totalCount={gridTotalCount_heroui_app_table_grid_1793645604280_hpw4a} safePage={gridPaging_heroui_app_table_grid_1793645604280_hpw4a.safePage} pageSize={gridPageSize_heroui_app_table_grid_1793645604280_hpw4a} onPageSizeChange={handleGridPageSizeChange_heroui_app_table_grid_1793645604280_hpw4a} sortBy={gridQuery_heroui_app_table_grid_1793645604280_hpw4a.sort?.columnId ?? ''} sortOptions={gridSortOptions_heroui_app_table_grid_1793645604280_hpw4a} onSortByChange={handleGridSortByChange_heroui_app_table_grid_1793645604280_hpw4a} sortDirection={gridQuery_heroui_app_table_grid_1793645604280_hpw4a.sort?.direction ?? 'asc'} onToggleSortDirection={handleGridToggleSortDirection_heroui_app_table_grid_1793645604280_hpw4a} showSortControls={false} totalPages={gridPaging_heroui_app_table_grid_1793645604280_hpw4a.totalPages} pageNumbers={buildDataGridPageNumbers(gridPaging_heroui_app_table_grid_1793645604280_hpw4a.safePage, gridPaging_heroui_app_table_grid_1793645604280_hpw4a.totalPages)} onPageChange={handleGridPageChange_heroui_app_table_grid_1793645604280_hpw4a} visibleInfiniteCount={gridListMode_heroui_app_table_grid_1793645604280_hpw4a === 'infinite' ? gridPaging_heroui_app_table_grid_1793645604280_hpw4a.displayRows.length : undefined} />} /></ListPageShell>
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "(store.ui.visibility.node-dcf70428-9758-4dee-ac10-0b7294b77b03 === true) && (store.ui.visibility.node-dcf70428-9758-4dee-ac10-0b7294b77b03 !== false)") && (
          <CreateEditModalShell title={"Create Institute"} size="lg" onClose={() => { patchDesignerStore("ui.visibility.node-dcf70428-9758-4dee-ac10-0b7294b77b03", false); }} onBackdropClick={() => { patchDesignerStore("ui.visibility.node-dcf70428-9758-4dee-ac10-0b7294b77b03", false); }} gradient={false} bodyOuterClassName="-mb-[15px]" bodyClassName="!p-0" footerClassName="!mt-0">
            <form className="flex !min-h-0 flex-col gap-0 bg-white" method="post" id="node-6fde13e5-cf40-4358-b837-4ff1177f7bbf" data-designer-node-id="node-6fde13e5-cf40-4358-b837-4ff1177f7bbf">
              <div className="flex !min-w-0 flex-col gap-4 bg-white p-[15px]">
                <div className="flex !w-full flex-col !items-center pb-1"><HwyInstituteLogoUploadField instituteId={regionData_hwyinstitutesList_node_6fde13e5_cf40_4358_b837_4ff1177f7bbf?.id} value={regionData_hwyinstitutesList_node_6fde13e5_cf40_4358_b837_4ff1177f7bbf?.logoContentBase64} formFieldName="node-5fe071bd-0db5-4509-94dc-151bdd69eef5" ariaLabel="Logo" /></div>
                <Card className="flex !w-full !min-w-0 flex-col gap-3 !rounded-xl border border-default-200 bg-content1 !p-4 !shadow-sm"><Card.Content>
                  <div className="flex !w-full !min-w-0 flex-row !items-center gap-3">
                    <p className="shrink-0 min-w-[9.5rem] max-w-[11rem] !text-end !text-xs !font-medium leading-snug text-slate-600">{culture.t("hwy.institutes.field.titleAr")}</p>
                    <UiInput isRequired className="!min-w-0 flex-1 !w-full" type="text" placeholder={culture.t("hwy.institutes.field.titleAr.placeholder")} aria-label={culture.t("hwy.institutes.field.titleAr.placeholder")} size="sm" value={regionData_hwyinstitutesList_node_6fde13e5_cf40_4358_b837_4ff1177f7bbf?.titleAr} name="node-ffa61b38-568f-488a-b626-a87be704fa95" />
                  </div>
                  <div className="flex !w-full !min-w-0 flex-row !items-center gap-3">
                    <p className="shrink-0 min-w-[9.5rem] max-w-[11rem] !text-end !text-xs !font-medium leading-snug text-slate-600">{culture.t("hwy.institutes.field.inviteExpiresAfterDays")}</p>
                    <UiInput className="!min-w-0 flex-1 !w-full" type="number" placeholder={culture.t("hwy.institutes.field.inviteExpiresAfterDays.placeholder")} aria-label={culture.t("hwy.institutes.field.inviteExpiresAfterDays.placeholder")} size="sm" value={regionData_hwyinstitutesList_node_6fde13e5_cf40_4358_b837_4ff1177f7bbf?.inviteExpiresAfterDays} name="node-c3ea6d19-0783-443c-9da0-7664dff95aaf" />
                  </div>
                  <UiTextarea className="!w-full" placeholder={culture.t("hwy.institutes.field.note.placeholder")} label={culture.t("hwy.institutes.field.note")} aria-label={culture.t("hwy.institutes.field.note.placeholder")} rows={3} size="sm" data-page-guide="" data-page-guide-title="Note" data-page-guide-hint="Enter note." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_hwyinstitutesList_node_6fde13e5_cf40_4358_b837_4ff1177f7bbf?.note} name="node-9ef01de2-746c-46e7-9687-8a08fe1d09c8" />
                </Card.Content></Card>
                <Card className="flex !w-full !min-w-0 flex-col gap-3 !rounded-xl border border-default-200 bg-content1 !p-4 !shadow-sm !gap-2"><Card.Content>
                  <Switch className="!w-full !justify-between" aria-label="Active" size="md" data-page-guide="" data-page-guide-title="Active" data-page-guide-hint="Turn active on or off." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" isSelected={regionData_hwyinstitutesList_node_6fde13e5_cf40_4358_b837_4ff1177f7bbf?.isActive} name="node-b333ed58-378d-46e7-98f2-0a403a609f01"><Switch.Content className="flex items-center gap-2"><Switch.Control><Switch.Thumb /></Switch.Control><span className="text-xs font-semibold text-slate-700">Active</span></Switch.Content></Switch>
                  <Switch className="!w-full !justify-between" aria-label="Self registration" size="md" data-page-guide="" data-page-guide-title="Self registration" data-page-guide-hint="Turn self registration on or off." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" isSelected={regionData_hwyinstitutesList_node_6fde13e5_cf40_4358_b837_4ff1177f7bbf?.allowsSelfRegistration} name="node-f2e3c037-3ea5-4dca-8a9b-50f3d549adfb"><Switch.Content className="flex items-center gap-2"><Switch.Control><Switch.Thumb /></Switch.Control><span className="text-xs font-semibold text-slate-700">Self registration</span></Switch.Content></Switch>
                  <Switch className="!w-full !justify-between" aria-label="Allows invite" size="md" data-page-guide="" data-page-guide-title="Allows invite" data-page-guide-hint="Turn allows invite on or off." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" isSelected={regionData_hwyinstitutesList_node_6fde13e5_cf40_4358_b837_4ff1177f7bbf?.allowsInvite} name="node-c0be51bd-bfea-4f6c-8dc8-cd4485267571"><Switch.Content className="flex items-center gap-2"><Switch.Control><Switch.Thumb /></Switch.Control><span className="text-xs font-semibold text-slate-700">Allows invite</span></Switch.Content></Switch>
                  <Switch className="!w-full !justify-between" aria-label="Hide member phones" size="md" data-page-guide="" data-page-guide-title="Hide member phones" data-page-guide-hint="Turn hide member phones on or off." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" isSelected={regionData_hwyinstitutesList_node_6fde13e5_cf40_4358_b837_4ff1177f7bbf?.hideMemberPhones} name="node-c0f92000-d94d-4896-b062-0d7c48b72a3b"><Switch.Content className="flex items-center gap-2"><Switch.Control><Switch.Thumb /></Switch.Control><span className="text-xs font-semibold text-slate-700">Hide member phones</span></Switch.Content></Switch>
                  <Switch className="!w-full !justify-between" aria-label="Dedicated list" size="md" data-page-guide="" data-page-guide-title="Dedicated list" data-page-guide-hint="Turn dedicated list on or off." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" isSelected={regionData_hwyinstitutesList_node_6fde13e5_cf40_4358_b837_4ff1177f7bbf?.hasDedicatedList} name="node-a81b2e64-9fde-458f-a15c-c8748a725373"><Switch.Content className="flex items-center gap-2"><Switch.Control><Switch.Thumb /></Switch.Control><span className="text-xs font-semibold text-slate-700">Dedicated list</span></Switch.Content></Switch>
                  <Switch className="!w-full !justify-between" aria-label="List scoped edit" size="md" data-page-guide="" data-page-guide-title="List scoped edit" data-page-guide-hint="Turn list scoped edit on or off." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" isSelected={regionData_hwyinstitutesList_node_6fde13e5_cf40_4358_b837_4ff1177f7bbf?.allowsListScopedEdit} name="node-ff1f79b6-73cb-49b7-b3e1-3a3f187c8750"><Switch.Content className="flex items-center gap-2"><Switch.Control><Switch.Thumb /></Switch.Control><span className="text-xs font-semibold text-slate-700">List scoped edit</span></Switch.Content></Switch>
                  <Switch className="!w-full !justify-between" aria-label="Show institute block in dossier" size="md" data-page-guide="" data-page-guide-title="Show institute block in dossier" data-page-guide-hint="Turn show institute block in dossier on or off." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" isSelected={regionData_hwyinstitutesList_node_6fde13e5_cf40_4358_b837_4ff1177f7bbf?.showInstituteCharacterInDossier} name="node-83075f62-80d8-4cd1-8958-6871edd5a0aa"><Switch.Content className="flex items-center gap-2"><Switch.Control><Switch.Thumb /></Switch.Control><span className="text-xs font-semibold text-slate-700">Show institute block in dossier</span></Switch.Content></Switch>
                </Card.Content></Card>
              </div>
            </form>
            <div className="flex !w-full shrink-0 !items-center !justify-end gap-2">
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 border border-slate-200 text-slate-600 hover:bg-slate-100" variant="outline" size="md" onClick={handleonClick_node_92fdcfa0_8bb5_4537_ad01_352f3ca2a06c}><X className="h-3.5 w-3.5" /> Cancel</Button>
              <Button type="submit" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 bg-primary-600 hover:bg-primary-700 text-white" form="node-6fde13e5-cf40-4358-b837-4ff1177f7bbf" variant="primary" size="md" href="#" target="_self" isDisabled={isSubmitting} onClick={handleonClick_node_cd4deb6a_0594_494a_9d82_7adc1493b8dc}><Plus className="h-3.5 w-3.5" /> Create Institute</Button>
            </div>
          </CreateEditModalShell>
        )}
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "(store.ui.visibility.node-36e60d73-bdf2-46a0-bbe8-2a5dd5a3b3db === true) && (store.ui.visibility.node-36e60d73-bdf2-46a0-bbe8-2a5dd5a3b3db !== false)") && (
          <CreateEditModalShell title={"Edit Institute"} size="lg" onClose={() => { patchDesignerStore("ui.visibility.node-36e60d73-bdf2-46a0-bbe8-2a5dd5a3b3db", false); }} onBackdropClick={() => { patchDesignerStore("ui.visibility.node-36e60d73-bdf2-46a0-bbe8-2a5dd5a3b3db", false); }} gradient={false} bodyOuterClassName="-mb-[15px]" bodyClassName="!p-0" footerClassName="!mt-0">
            <form className="flex !min-h-0 flex-col gap-0 bg-white" method="post" id="node-ac594618-a48b-482f-8955-89b913d7e39a" data-designer-node-id="node-ac594618-a48b-482f-8955-89b913d7e39a">
              <div className="flex !min-w-0 flex-col gap-4 bg-white p-[15px]">
                <div className="flex !w-full flex-col !items-center pb-1"><HwyInstituteLogoUploadField instituteId={regionData_hwyinstitutesList_node_ac594618_a48b_482f_8955_89b913d7e39a?.id} value={regionData_hwyinstitutesList_node_ac594618_a48b_482f_8955_89b913d7e39a?.logoContentBase64} formFieldName="node-b6306efa-ba8e-45d6-9a8d-dfb15f623a02" ariaLabel="Logo" /></div>
                <Card className="flex !w-full !min-w-0 flex-col gap-3 !rounded-xl border border-default-200 bg-content1 !p-4 !shadow-sm"><Card.Content>
                  <div className="flex !w-full !min-w-0 flex-row !items-center gap-3">
                    <p className="shrink-0 min-w-[9.5rem] max-w-[11rem] !text-end !text-xs !font-medium leading-snug text-slate-600">{culture.t("hwy.institutes.field.titleAr")}</p>
                    <UiInput isRequired className="!min-w-0 flex-1 !w-full" type="text" placeholder={culture.t("hwy.institutes.field.titleAr.placeholder")} aria-label={culture.t("hwy.institutes.field.titleAr.placeholder")} size="sm" value={regionData_hwyinstitutesList_node_ac594618_a48b_482f_8955_89b913d7e39a?.titleAr} name="node-13efe8cb-095d-4ba4-90f6-e47cfafaaac5" />
                  </div>
                  <div className="flex !w-full !min-w-0 flex-row !items-center gap-3">
                    <p className="shrink-0 min-w-[9.5rem] max-w-[11rem] !text-end !text-xs !font-medium leading-snug text-slate-600">{culture.t("hwy.institutes.field.inviteExpiresAfterDays")}</p>
                    <UiInput className="!min-w-0 flex-1 !w-full" type="number" placeholder={culture.t("hwy.institutes.field.inviteExpiresAfterDays.placeholder")} aria-label={culture.t("hwy.institutes.field.inviteExpiresAfterDays.placeholder")} size="sm" value={regionData_hwyinstitutesList_node_ac594618_a48b_482f_8955_89b913d7e39a?.inviteExpiresAfterDays} name="node-b75d0ff1-b7e4-4cfb-a4f7-5ee3bd6116ec" />
                  </div>
                  <UiTextarea className="!w-full" placeholder={culture.t("hwy.institutes.field.note.placeholder")} label={culture.t("hwy.institutes.field.note")} aria-label={culture.t("hwy.institutes.field.note.placeholder")} rows={3} size="sm" data-page-guide="" data-page-guide-title="Note" data-page-guide-hint="Enter note." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_hwyinstitutesList_node_ac594618_a48b_482f_8955_89b913d7e39a?.note} name="node-1663604d-cbd8-4297-ba26-878b91c946c3" />
                </Card.Content></Card>
                <Card className="flex !w-full !min-w-0 flex-col gap-3 !rounded-xl border border-default-200 bg-content1 !p-4 !shadow-sm !gap-2"><Card.Content>
                  <Switch className="!w-full !justify-between" aria-label="Active" size="md" data-page-guide="" data-page-guide-title="Active" data-page-guide-hint="Turn active on or off." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" isSelected={regionData_hwyinstitutesList_node_ac594618_a48b_482f_8955_89b913d7e39a?.isActive} name="node-862a57d1-6e94-48a0-8ab7-6c02afab0722"><Switch.Content className="flex items-center gap-2"><Switch.Control><Switch.Thumb /></Switch.Control><span className="text-xs font-semibold text-slate-700">Active</span></Switch.Content></Switch>
                  <Switch className="!w-full !justify-between" aria-label="Self registration" size="md" data-page-guide="" data-page-guide-title="Self registration" data-page-guide-hint="Turn self registration on or off." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" isSelected={regionData_hwyinstitutesList_node_ac594618_a48b_482f_8955_89b913d7e39a?.allowsSelfRegistration} name="node-8674e3ba-01f7-41db-830f-094ddebe4ed0"><Switch.Content className="flex items-center gap-2"><Switch.Control><Switch.Thumb /></Switch.Control><span className="text-xs font-semibold text-slate-700">Self registration</span></Switch.Content></Switch>
                  <Switch className="!w-full !justify-between" aria-label="Allows invite" size="md" data-page-guide="" data-page-guide-title="Allows invite" data-page-guide-hint="Turn allows invite on or off." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" isSelected={regionData_hwyinstitutesList_node_ac594618_a48b_482f_8955_89b913d7e39a?.allowsInvite} name="node-1db465b9-beaf-403f-8b36-e0de6cf80027"><Switch.Content className="flex items-center gap-2"><Switch.Control><Switch.Thumb /></Switch.Control><span className="text-xs font-semibold text-slate-700">Allows invite</span></Switch.Content></Switch>
                  <Switch className="!w-full !justify-between" aria-label="Hide member phones" size="md" data-page-guide="" data-page-guide-title="Hide member phones" data-page-guide-hint="Turn hide member phones on or off." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" isSelected={regionData_hwyinstitutesList_node_ac594618_a48b_482f_8955_89b913d7e39a?.hideMemberPhones} name="node-33f6b773-d561-4966-b0ca-dd7786cea31a"><Switch.Content className="flex items-center gap-2"><Switch.Control><Switch.Thumb /></Switch.Control><span className="text-xs font-semibold text-slate-700">Hide member phones</span></Switch.Content></Switch>
                  <Switch className="!w-full !justify-between" aria-label="Dedicated list" size="md" data-page-guide="" data-page-guide-title="Dedicated list" data-page-guide-hint="Turn dedicated list on or off." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" isSelected={regionData_hwyinstitutesList_node_ac594618_a48b_482f_8955_89b913d7e39a?.hasDedicatedList} name="node-715e102e-3468-4058-9dd3-5c6e1440aeb9"><Switch.Content className="flex items-center gap-2"><Switch.Control><Switch.Thumb /></Switch.Control><span className="text-xs font-semibold text-slate-700">Dedicated list</span></Switch.Content></Switch>
                  <Switch className="!w-full !justify-between" aria-label="List scoped edit" size="md" data-page-guide="" data-page-guide-title="List scoped edit" data-page-guide-hint="Turn list scoped edit on or off." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" isSelected={regionData_hwyinstitutesList_node_ac594618_a48b_482f_8955_89b913d7e39a?.allowsListScopedEdit} name="node-0f000a75-7804-4fec-ab72-491c98035bd9"><Switch.Content className="flex items-center gap-2"><Switch.Control><Switch.Thumb /></Switch.Control><span className="text-xs font-semibold text-slate-700">List scoped edit</span></Switch.Content></Switch>
                  <Switch className="!w-full !justify-between" aria-label="Show institute block in dossier" size="md" data-page-guide="" data-page-guide-title="Show institute block in dossier" data-page-guide-hint="Turn show institute block in dossier on or off." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" isSelected={regionData_hwyinstitutesList_node_ac594618_a48b_482f_8955_89b913d7e39a?.showInstituteCharacterInDossier} name="node-f9ecffd0-20f3-429f-bf06-67768a26dc88"><Switch.Content className="flex items-center gap-2"><Switch.Control><Switch.Thumb /></Switch.Control><span className="text-xs font-semibold text-slate-700">Show institute block in dossier</span></Switch.Content></Switch>
                </Card.Content></Card>
              </div>
            </form>
            <div className="flex !w-full shrink-0 !items-center !justify-end gap-2">
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 border border-slate-200 text-slate-600 hover:bg-slate-100" variant="outline" size="md" onClick={handleonClick_node_c23a5712_e7d7_4554_a12b_3bb357f4bbf7}><X className="h-3.5 w-3.5" /> Cancel</Button>
              <Button type="submit" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 bg-primary-600 hover:bg-primary-700 text-white" form="node-ac594618-a48b-482f-8955-89b913d7e39a" variant="primary" size="md" href="#" target="_self" isDisabled={isSubmitting} onClick={handleonClick_node_5b8c25d8_73c7_4fe0_89fb_fe2080e3005d}><Save className="h-3.5 w-3.5" /> Save</Button>
            </div>
          </CreateEditModalShell>
        )}
      </div>
    </>
  );
};
