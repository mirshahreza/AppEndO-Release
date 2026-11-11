import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useOptionalPlatformMount } from '@/app/platform/PlatformMountContext';
import { resolvePublishedDesignerNavigateTarget } from '@/domain/component-designer/resolvePublishedDesignerNavigateTarget';
import { buildAppTableGridColumns } from '@/domain/component-designer/DesignerRuntimeAppTableGrid';
import { applyClientGridQuery, EMPTY_GRID_QUERY, type GridQueryState } from '@/shared/lib/appTableGridQuery';
import { resolveDataGridTotalCount, sliceDataGridRowsForDisplay, buildDataGridPageNumbers, applyGridAggregation } from '@/domain/component-designer/designerDataGridRuntime';
import { applyDesignerGridToolbarClientFilters } from '@/domain/component-designer/designerGridToolbarConfig';
import { createDefaultColumnLayout } from '@/shared/lib/appTableGridColumnLayout';
import { validateDesignerFieldNode } from '@/domain/component-designer/previewFieldValidation';
import { AppTableGrid, ConfirmDialogShell, CreateEditModalShell, GridPagingFooter, ListPageShell, ListPageToolbarFrame, PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS, PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS, ToolbarFilterSelect, UiCheckbox } from '@/shared/ui';
import { WorkspaceBackIcon } from '@/shared/ui';
import { DesignerDatePickerField } from '@/shared/ui/DesignerFormFields';
import { UiInput, UiSelect, UiTextarea } from '@/shared/ui/HeroFieldControls';
import { Button, Radio, RadioGroup, Switch, Toast, toast } from '@heroui/react';
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
  const routerNavigate = useNavigate();
  const location = useLocation();
  const mountPathPrefix = useOptionalPlatformMount()?.pathPrefix ?? null;
  const navigate = React.useCallback((to: string, options?: { replace?: boolean }) => {
    routerNavigate(resolvePublishedDesignerNavigateTarget(to, location.pathname, mountPathPrefix), { replace: options?.replace === true });
  }, [location.pathname, mountPathPrefix, routerNavigate]);
  const { store: designerStore, patch: patchDesignerStore } = useDesignerStore<Record<string, unknown>>({"voteEditor":{"activeBallotKeys":[]},"selection":{"id":null,"ballotId":null,"choiceId":null}});
  const { data: raw_regionData_voteVotingDetail_layout_flex_row_1794316123908_5nxwc, isLoading: isLoading_regionData_voteVotingDetail_layout_flex_row_1794316123908_5nxwc, error: error_regionData_voteVotingDetail_layout_flex_row_1794316123908_5nxwc, refresh: refresh_regionData_voteVotingDetail_layout_flex_row_1794316123908_5nxwc } = useDataFetch<unknown>(resolveBindingUrl("/api/voting/votings/:id", designerStore, { "id": "routeParams.id" }), {});
  const regionData_voteVotingDetail_layout_flex_row_1794316123908_5nxwc = React.useMemo(() => coerceApiRecordValue(applyResponseDataPath(raw_regionData_voteVotingDetail_layout_flex_row_1794316123908_5nxwc, {"dataPath":"data","arrayPath":"data","totalPath":"count"})), [raw_regionData_voteVotingDetail_layout_flex_row_1794316123908_5nxwc]);
  const { data: raw_regionData_voteVotingDetail_html_form_1794316123919_wss0b, isLoading: isLoading_regionData_voteVotingDetail_html_form_1794316123919_wss0b, error: error_regionData_voteVotingDetail_html_form_1794316123919_wss0b, refresh: refresh_regionData_voteVotingDetail_html_form_1794316123919_wss0b } = useDataFetch<unknown>(resolveBindingUrl("/api/voting/votings/:id", designerStore, { "id": "routeParams.id" }), {});
  const regionData_voteVotingDetail_html_form_1794316123919_wss0b = React.useMemo(() => coerceApiRecordValue(applyResponseDataPath(raw_regionData_voteVotingDetail_html_form_1794316123919_wss0b, {"dataPath":"data","arrayPath":"data","totalPath":"count"})), [raw_regionData_voteVotingDetail_html_form_1794316123919_wss0b]);
  const { data: raw_regionData_voteBallotsList_node_b8715c07_6472_4c65_974c_89648e07443d, isLoading: isLoading_regionData_voteBallotsList_node_b8715c07_6472_4c65_974c_89648e07443d, error: error_regionData_voteBallotsList_node_b8715c07_6472_4c65_974c_89648e07443d, refresh: refresh_regionData_voteBallotsList_node_b8715c07_6472_4c65_974c_89648e07443d } = useDataFetch<unknown>(resolveBindingUrl("/api/voting/ballots", designerStore, { "id": "selection.id" }), {});
  const regionData_voteBallotsList_node_b8715c07_6472_4c65_974c_89648e07443d = React.useMemo(() => coerceApiRecordValue(applyResponseDataPath(raw_regionData_voteBallotsList_node_b8715c07_6472_4c65_974c_89648e07443d, {"dataPath":"data","arrayPath":"data","totalPath":"count"})), [raw_regionData_voteBallotsList_node_b8715c07_6472_4c65_974c_89648e07443d]);
  const { data: raw_regionData_voteCandidatesList_node_e1eaed1e_9bc8_43b8_8201_ff0dc11132ec, isLoading: isLoading_regionData_voteCandidatesList_node_e1eaed1e_9bc8_43b8_8201_ff0dc11132ec, error: error_regionData_voteCandidatesList_node_e1eaed1e_9bc8_43b8_8201_ff0dc11132ec, refresh: refresh_regionData_voteCandidatesList_node_e1eaed1e_9bc8_43b8_8201_ff0dc11132ec } = useDataFetch<unknown>(resolveBindingUrl("/api/voting/candidates", designerStore, { "id": "selection.id" }), {});
  const regionData_voteCandidatesList_node_e1eaed1e_9bc8_43b8_8201_ff0dc11132ec = React.useMemo(() => coerceApiRecordValue(applyResponseDataPath(raw_regionData_voteCandidatesList_node_e1eaed1e_9bc8_43b8_8201_ff0dc11132ec, {"dataPath":"data","arrayPath":"data","totalPath":"count"})), [raw_regionData_voteCandidatesList_node_e1eaed1e_9bc8_43b8_8201_ff0dc11132ec]);
  const { data: raw_regionData_votePollingStationsList_node_b1271bc9_70e7_40b2_9701_74d62bd4067d, isLoading: isLoading_regionData_votePollingStationsList_node_b1271bc9_70e7_40b2_9701_74d62bd4067d, error: error_regionData_votePollingStationsList_node_b1271bc9_70e7_40b2_9701_74d62bd4067d, refresh: refresh_regionData_votePollingStationsList_node_b1271bc9_70e7_40b2_9701_74d62bd4067d } = useDataFetch<unknown>(resolveBindingUrl("/api/voting/polling-stations", designerStore, { "id": "selection.id" }), {});
  const regionData_votePollingStationsList_node_b1271bc9_70e7_40b2_9701_74d62bd4067d = React.useMemo(() => coerceApiRecordValue(applyResponseDataPath(raw_regionData_votePollingStationsList_node_b1271bc9_70e7_40b2_9701_74d62bd4067d, {"dataPath":"data","arrayPath":"data","totalPath":"count"})), [raw_regionData_votePollingStationsList_node_b1271bc9_70e7_40b2_9701_74d62bd4067d]);
  const handleGridRowAction_heroui_app_table_grid_1794316123953_xbb11 = React.useCallback((row: Record<string, unknown>, actionId: string) => {
    switch (actionId) {
      case "edit": {
        patchDesignerStore("selection.ballotId", row["id"] ?? null);
        patchDesignerStore("ui.visibility.node-2505cd81-4f24-4e95-9a86-45d29d772103", true);
        return;
      }
      case "delete": {
        patchDesignerStore("selection.ballotId", row["id"] ?? null);
        patchDesignerStore("ui.visibility.node-13e6bd03-8adb-4d58-adc9-3605690caaef", true);
        return;
      }
      default:
        return;
    }
  }, [patchDesignerStore]);
  const handleGridRowAction_heroui_app_table_grid_1794316124005_jmpdp = React.useCallback((row: Record<string, unknown>, actionId: string) => {
    switch (actionId) {
      case "edit": {
        patchDesignerStore("selection.choiceId", row["id"] ?? null);
        patchDesignerStore("ui.visibility.node-d496d557-9e25-41ca-a0c7-c5861acb91a3", true);
        return;
      }
      case "delete": {
        patchDesignerStore("selection.choiceId", row["id"] ?? null);
        patchDesignerStore("ui.visibility.node-67b3fbbb-ca30-44c2-8f34-b804d832d599", true);
        return;
      }
      default:
        return;
    }
  }, [patchDesignerStore]);
  const handleGridRowAction_heroui_app_table_grid_1794316124060_wa771 = React.useCallback((row: Record<string, unknown>, actionId: string) => {
    switch (actionId) {
      case "edit": {
        patchDesignerStore("selection.id", row["id"] ?? null);
        patchDesignerStore("ui.visibility.node-f5a37c74-b666-4402-8aee-55a655d248d2", true);
        return;
      }
      case "delete": {
        patchDesignerStore("selection.id", row["id"] ?? null);
        patchDesignerStore("ui.visibility.node-218c9cd5-dee9-4d02-b0be-bdc06654b6c2", true);
        return;
      }
      default:
        return;
    }
  }, [patchDesignerStore]);
  const { data: raw_gridData_heroui_app_table_grid_1794316123953_xbb11, isLoading: isLoading_gridData_heroui_app_table_grid_1794316123953_xbb11, error: error_gridData_heroui_app_table_grid_1794316123953_xbb11, refresh: refresh_gridData_heroui_app_table_grid_1794316123953_xbb11 } = useDataFetch<unknown>(resolveBindingUrl("/api/voting/ballots", designerStore, { "search": "gridToolbar.search", "sortBy": "gridQuery.sortBy", "sortDir": "gridQuery.sortDir", "page": "gridQuery.page", "pageSize": "gridQuery.pageSize", "includeCount": "static:page1Only", "where": "gridToolbar.listWhere", "filter[title][like]": "gridQuery.filters.title", "filter[votingId][eq]": "routeParams.id" }), {});
  const gridData_heroui_app_table_grid_1794316123953_xbb11 = React.useMemo(() => applyResponseDataPath(raw_gridData_heroui_app_table_grid_1794316123953_xbb11, {"dataPath":"data","arrayPath":"data","totalPath":"count"}), [raw_gridData_heroui_app_table_grid_1794316123953_xbb11]);
  const { data: raw_gridData_heroui_app_table_grid_1794316124005_jmpdp, isLoading: isLoading_gridData_heroui_app_table_grid_1794316124005_jmpdp, error: error_gridData_heroui_app_table_grid_1794316124005_jmpdp, refresh: refresh_gridData_heroui_app_table_grid_1794316124005_jmpdp } = useDataFetch<unknown>(resolveBindingUrl("/api/voting/candidates", designerStore, { "search": "gridToolbar.search", "sortBy": "gridQuery.sortBy", "sortDir": "gridQuery.sortDir", "page": "gridQuery.page", "pageSize": "gridQuery.pageSize", "includeCount": "static:page1Only", "where": "gridToolbar.listWhere", "filter[displayName][like]": "gridQuery.filters.displayName", "filter[votingId][eq]": "routeParams.id", "filter[ballotId][eq]": "voteEditor.activeBallotKeys.0" }), {});
  const gridData_heroui_app_table_grid_1794316124005_jmpdp = React.useMemo(() => applyResponseDataPath(raw_gridData_heroui_app_table_grid_1794316124005_jmpdp, {"dataPath":"data","arrayPath":"data","totalPath":"count"}), [raw_gridData_heroui_app_table_grid_1794316124005_jmpdp]);
  const { data: raw_gridData_heroui_app_table_grid_1794316124060_wa771, isLoading: isLoading_gridData_heroui_app_table_grid_1794316124060_wa771, error: error_gridData_heroui_app_table_grid_1794316124060_wa771, refresh: refresh_gridData_heroui_app_table_grid_1794316124060_wa771 } = useDataFetch<unknown>(resolveBindingUrl("/api/voting/polling-stations", designerStore, { "search": "gridToolbar.search", "sortBy": "gridQuery.sortBy", "sortDir": "gridQuery.sortDir", "page": "gridQuery.page", "pageSize": "gridQuery.pageSize", "includeCount": "static:page1Only", "where": "gridToolbar.listWhere", "filter[title][like]": "gridQuery.filters.title", "filter[votingId][eq]": "routeParams.id" }), {});
  const gridData_heroui_app_table_grid_1794316124060_wa771 = React.useMemo(() => applyResponseDataPath(raw_gridData_heroui_app_table_grid_1794316124060_wa771, {"dataPath":"data","arrayPath":"data","totalPath":"count"}), [raw_gridData_heroui_app_table_grid_1794316124060_wa771]);
  const gridColumns_heroui_app_table_grid_1794316123953_xbb11 = React.useMemo(() => buildAppTableGridColumns([{"key":"title","label":"Question","sort":true,"filter":true,"filterType":"text","cardRole":"title"},{"key":"selectionMode","label":"Pick rule","sort":true,"cellKind":"lookup","cellFields":{"labelField":"selectionMode","lookupEntries":[{"value":"single","label":"One answer"},{"value":"multiple","label":"Several answers"}]},"cardRole":"meta","width":"9.5rem"},{"key":"maxSelections","label":"Max picks","sort":true,"cardRole":"meta"},{"key":"sortOrder","label":"Order","sort":true,"cardRole":"meta"},{"key":"actions","label":"","kind":"action-group","actions":[{"actionId":"edit","icon":"Pencil","intent":"edit","tooltip":"Edit","behavior":{"kind":"open-modal","modalNodeId":"node-2505cd81-4f24-4e95-9a86-45d29d772103","primaryKeyField":"id","selectionStorePath":"selection.ballotId"}},{"actionId":"delete","icon":"Trash2","intent":"delete","tooltip":"Delete","behavior":{"kind":"open-modal","modalNodeId":"node-13e6bd03-8adb-4d58-adc9-3605690caaef","primaryKeyField":"id","selectionStorePath":"selection.ballotId"}}],"maxVisibleActions":3,"cardRole":"actions","layoutHideable":false,"layoutResizable":false,"layoutReorderable":false,"layoutPinned":"right","width":"57px"}], "server", {
    mode: 'runtime',
    detailFlowRef: { current: null },
    rowActionHandlerRef: { current: handleGridRowAction_heroui_app_table_grid_1794316123953_xbb11 },
    cellClickHandlerRef: { current: undefined },
    designerStoreRef: { current: designerStore },
  }), [designerStore, handleGridRowAction_heroui_app_table_grid_1794316123953_xbb11]);
  const [gridQuery_heroui_app_table_grid_1794316123953_xbb11, setGridQuery_heroui_app_table_grid_1794316123953_xbb11] = React.useState<GridQueryState>(() => ({ ...EMPTY_GRID_QUERY, sort: { columnId: "sortOrder", direction: "asc" } }));
  const [gridPage_heroui_app_table_grid_1794316123953_xbb11, setGridPage_heroui_app_table_grid_1794316123953_xbb11] = React.useState(1);
  const [gridPageSize_heroui_app_table_grid_1794316123953_xbb11, setGridPageSize_heroui_app_table_grid_1794316123953_xbb11] = React.useState(25);
  const [gridListMode_heroui_app_table_grid_1794316123953_xbb11, setGridListMode_heroui_app_table_grid_1794316123953_xbb11] = React.useState<'paging' | 'infinite'>("paging");
  const [gridColumnLayout_heroui_app_table_grid_1794316123953_xbb11, setGridColumnLayout_heroui_app_table_grid_1794316123953_xbb11] = React.useState(() => createDefaultColumnLayout(gridColumns_heroui_app_table_grid_1794316123953_xbb11));
  const [gridSearchInput_heroui_app_table_grid_1794316123953_xbb11, setGridSearchInput_heroui_app_table_grid_1794316123953_xbb11] = React.useState('');
  const [gridDebouncedSearch_heroui_app_table_grid_1794316123953_xbb11, setGridDebouncedSearch_heroui_app_table_grid_1794316123953_xbb11] = React.useState('');
  const [gridCheckboxSelections_heroui_app_table_grid_1794316123953_xbb11, setGridCheckboxSelections_heroui_app_table_grid_1794316123953_xbb11] = React.useState<Record<string, Record<string, boolean>>>({});
  const [gridRadioSelections_heroui_app_table_grid_1794316123953_xbb11, setGridRadioSelections_heroui_app_table_grid_1794316123953_xbb11] = React.useState<Record<string, string>>({});
  const [gridMatchLogic_heroui_app_table_grid_1794316123953_xbb11, setGridMatchLogic_heroui_app_table_grid_1794316123953_xbb11] = React.useState<Record<string, 'and' | 'or'>>({});
  const gridRoleFilters_heroui_app_table_grid_1794316123953_xbb11 = {};
  const gridFilteredRows_heroui_app_table_grid_1794316123953_xbb11 = React.useMemo(() => applyClientGridQuery(((Array.isArray(gridData_heroui_app_table_grid_1794316123953_xbb11) ? gridData_heroui_app_table_grid_1794316123953_xbb11 : []) ?? []), gridQuery_heroui_app_table_grid_1794316123953_xbb11, gridColumns_heroui_app_table_grid_1794316123953_xbb11, "server"), [gridQuery_heroui_app_table_grid_1794316123953_xbb11, gridColumns_heroui_app_table_grid_1794316123953_xbb11]);
  const gridAggregatedRows_heroui_app_table_grid_1794316123953_xbb11 = gridFilteredRows_heroui_app_table_grid_1794316123953_xbb11;
  const gridApiTotal_heroui_app_table_grid_1794316123953_xbb11 = React.useMemo(() => {
    const raw = raw_gridData_heroui_app_table_grid_1794316123953_xbb11;
    const value = readNestedContextValue((raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}), "count");
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
  }, [raw_gridData_heroui_app_table_grid_1794316123953_xbb11]);
  const gridTotalCount_heroui_app_table_grid_1794316123953_xbb11 = resolveDataGridTotalCount({ page: gridPage_heroui_app_table_grid_1794316123953_xbb11, pageSize: gridPageSize_heroui_app_table_grid_1794316123953_xbb11, total: gridApiTotal_heroui_app_table_grid_1794316123953_xbb11, gridQueryMode: "server" }, gridAggregatedRows_heroui_app_table_grid_1794316123953_xbb11.length);
  const gridPaging_heroui_app_table_grid_1794316123953_xbb11 = sliceDataGridRowsForDisplay(gridAggregatedRows_heroui_app_table_grid_1794316123953_xbb11, gridPage_heroui_app_table_grid_1794316123953_xbb11, gridPageSize_heroui_app_table_grid_1794316123953_xbb11, gridTotalCount_heroui_app_table_grid_1794316123953_xbb11, "server");
  const handleGridQueryChange_heroui_app_table_grid_1794316123953_xbb11 = React.useCallback((nextQuery: GridQueryState) => {
    setGridQuery_heroui_app_table_grid_1794316123953_xbb11(nextQuery);
    setGridPage_heroui_app_table_grid_1794316123953_xbb11(1);
    patchDesignerStore("gridQuery.sortBy", nextQuery.sort?.columnId ?? '');
    patchDesignerStore("gridQuery.sortDir", nextQuery.sort?.direction ?? '');
  }, [patchDesignerStore]);
  const handleGridPageChange_heroui_app_table_grid_1794316123953_xbb11 = React.useCallback((nextPage: number) => {
    setGridPage_heroui_app_table_grid_1794316123953_xbb11(nextPage);
    patchDesignerStore("gridQuery.page", nextPage);
  }, [patchDesignerStore]);
  const handleGridPageSizeChange_heroui_app_table_grid_1794316123953_xbb11 = React.useCallback((nextSize: number) => {
    setGridPageSize_heroui_app_table_grid_1794316123953_xbb11(nextSize);
    setGridPage_heroui_app_table_grid_1794316123953_xbb11(1);
    patchDesignerStore("gridQuery.pageSize", nextSize);
  }, [patchDesignerStore]);
  const handleGridSortByChange_heroui_app_table_grid_1794316123953_xbb11 = React.useCallback((nextSortBy: string) => {
    setGridQuery_heroui_app_table_grid_1794316123953_xbb11((current: GridQueryState) => ({ ...current, sort: nextSortBy ? { columnId: nextSortBy, direction: current.sort?.direction ?? 'asc' } : null }));
  }, []);
  const handleGridToggleSortDirection_heroui_app_table_grid_1794316123953_xbb11 = React.useCallback(() => {
    setGridQuery_heroui_app_table_grid_1794316123953_xbb11((current: GridQueryState) => (current.sort ? { ...current, sort: { ...current.sort, direction: current.sort.direction === 'asc' ? 'desc' : 'asc' } } : current));
  }, []);
  const searchDebounceTimer_heroui_app_table_grid_1794316123953_xbb11 = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleGridSearchChange_heroui_app_table_grid_1794316123953_xbb11 = React.useCallback((nextValue: string) => {
    setGridSearchInput_heroui_app_table_grid_1794316123953_xbb11(nextValue);
    if (searchDebounceTimer_heroui_app_table_grid_1794316123953_xbb11.current) {
      clearTimeout(searchDebounceTimer_heroui_app_table_grid_1794316123953_xbb11.current);
    }
    searchDebounceTimer_heroui_app_table_grid_1794316123953_xbb11.current = setTimeout(() => {
      setGridDebouncedSearch_heroui_app_table_grid_1794316123953_xbb11(nextValue);
      setGridPage_heroui_app_table_grid_1794316123953_xbb11(1);
      patchDesignerStore("gridToolbar.search", nextValue);
    }, 300);
  }, [patchDesignerStore]);

  const gridColumns_heroui_app_table_grid_1794316124005_jmpdp = React.useMemo(() => buildAppTableGridColumns([{"key":"displayName","label":"Choice","sort":true,"filter":true,"filterType":"text","cardRole":"title"},{"key":"sortOrder","label":"Order","sort":true,"cardRole":"meta"},{"key":"actions","label":"","kind":"action-group","actions":[{"actionId":"edit","icon":"Pencil","intent":"edit","tooltip":"Edit","behavior":{"kind":"open-modal","modalNodeId":"node-d496d557-9e25-41ca-a0c7-c5861acb91a3","primaryKeyField":"id","selectionStorePath":"selection.choiceId"}},{"actionId":"delete","icon":"Trash2","intent":"delete","tooltip":"Delete","behavior":{"kind":"open-modal","modalNodeId":"node-67b3fbbb-ca30-44c2-8f34-b804d832d599","primaryKeyField":"id","selectionStorePath":"selection.choiceId"}}],"maxVisibleActions":3,"cardRole":"actions","layoutHideable":false,"layoutResizable":false,"layoutReorderable":false,"layoutPinned":"right","width":"57px"}], "server", {
    mode: 'runtime',
    detailFlowRef: { current: null },
    rowActionHandlerRef: { current: handleGridRowAction_heroui_app_table_grid_1794316124005_jmpdp },
    cellClickHandlerRef: { current: undefined },
    designerStoreRef: { current: designerStore },
  }), [designerStore, handleGridRowAction_heroui_app_table_grid_1794316124005_jmpdp]);
  const [gridQuery_heroui_app_table_grid_1794316124005_jmpdp, setGridQuery_heroui_app_table_grid_1794316124005_jmpdp] = React.useState<GridQueryState>(() => ({ ...EMPTY_GRID_QUERY, sort: { columnId: "sortOrder", direction: "asc" } }));
  const [gridPage_heroui_app_table_grid_1794316124005_jmpdp, setGridPage_heroui_app_table_grid_1794316124005_jmpdp] = React.useState(1);
  const [gridPageSize_heroui_app_table_grid_1794316124005_jmpdp, setGridPageSize_heroui_app_table_grid_1794316124005_jmpdp] = React.useState(50);
  const [gridListMode_heroui_app_table_grid_1794316124005_jmpdp, setGridListMode_heroui_app_table_grid_1794316124005_jmpdp] = React.useState<'paging' | 'infinite'>("paging");
  const [gridColumnLayout_heroui_app_table_grid_1794316124005_jmpdp, setGridColumnLayout_heroui_app_table_grid_1794316124005_jmpdp] = React.useState(() => createDefaultColumnLayout(gridColumns_heroui_app_table_grid_1794316124005_jmpdp));
  const [gridSearchInput_heroui_app_table_grid_1794316124005_jmpdp, setGridSearchInput_heroui_app_table_grid_1794316124005_jmpdp] = React.useState('');
  const [gridDebouncedSearch_heroui_app_table_grid_1794316124005_jmpdp, setGridDebouncedSearch_heroui_app_table_grid_1794316124005_jmpdp] = React.useState('');
  const [gridCheckboxSelections_heroui_app_table_grid_1794316124005_jmpdp, setGridCheckboxSelections_heroui_app_table_grid_1794316124005_jmpdp] = React.useState<Record<string, Record<string, boolean>>>({});
  const [gridRadioSelections_heroui_app_table_grid_1794316124005_jmpdp, setGridRadioSelections_heroui_app_table_grid_1794316124005_jmpdp] = React.useState<Record<string, string>>({});
  const [gridMatchLogic_heroui_app_table_grid_1794316124005_jmpdp, setGridMatchLogic_heroui_app_table_grid_1794316124005_jmpdp] = React.useState<Record<string, 'and' | 'or'>>({});
  const gridRoleFilters_heroui_app_table_grid_1794316124005_jmpdp = {};
  const gridFilteredRows_heroui_app_table_grid_1794316124005_jmpdp = React.useMemo(() => applyClientGridQuery(((Array.isArray(gridData_heroui_app_table_grid_1794316124005_jmpdp) ? gridData_heroui_app_table_grid_1794316124005_jmpdp : []) ?? []), gridQuery_heroui_app_table_grid_1794316124005_jmpdp, gridColumns_heroui_app_table_grid_1794316124005_jmpdp, "server"), [gridQuery_heroui_app_table_grid_1794316124005_jmpdp, gridColumns_heroui_app_table_grid_1794316124005_jmpdp]);
  const gridAggregatedRows_heroui_app_table_grid_1794316124005_jmpdp = gridFilteredRows_heroui_app_table_grid_1794316124005_jmpdp;
  const gridApiTotal_heroui_app_table_grid_1794316124005_jmpdp = React.useMemo(() => {
    const raw = raw_gridData_heroui_app_table_grid_1794316124005_jmpdp;
    const value = readNestedContextValue((raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}), "count");
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
  }, [raw_gridData_heroui_app_table_grid_1794316124005_jmpdp]);
  const gridTotalCount_heroui_app_table_grid_1794316124005_jmpdp = resolveDataGridTotalCount({ page: gridPage_heroui_app_table_grid_1794316124005_jmpdp, pageSize: gridPageSize_heroui_app_table_grid_1794316124005_jmpdp, total: gridApiTotal_heroui_app_table_grid_1794316124005_jmpdp, gridQueryMode: "server" }, gridAggregatedRows_heroui_app_table_grid_1794316124005_jmpdp.length);
  const gridPaging_heroui_app_table_grid_1794316124005_jmpdp = sliceDataGridRowsForDisplay(gridAggregatedRows_heroui_app_table_grid_1794316124005_jmpdp, gridPage_heroui_app_table_grid_1794316124005_jmpdp, gridPageSize_heroui_app_table_grid_1794316124005_jmpdp, gridTotalCount_heroui_app_table_grid_1794316124005_jmpdp, "server");
  const handleGridQueryChange_heroui_app_table_grid_1794316124005_jmpdp = React.useCallback((nextQuery: GridQueryState) => {
    setGridQuery_heroui_app_table_grid_1794316124005_jmpdp(nextQuery);
    setGridPage_heroui_app_table_grid_1794316124005_jmpdp(1);
    patchDesignerStore("gridQuery.sortBy", nextQuery.sort?.columnId ?? '');
    patchDesignerStore("gridQuery.sortDir", nextQuery.sort?.direction ?? '');
  }, [patchDesignerStore]);
  const handleGridPageChange_heroui_app_table_grid_1794316124005_jmpdp = React.useCallback((nextPage: number) => {
    setGridPage_heroui_app_table_grid_1794316124005_jmpdp(nextPage);
    patchDesignerStore("gridQuery.page", nextPage);
  }, [patchDesignerStore]);
  const handleGridPageSizeChange_heroui_app_table_grid_1794316124005_jmpdp = React.useCallback((nextSize: number) => {
    setGridPageSize_heroui_app_table_grid_1794316124005_jmpdp(nextSize);
    setGridPage_heroui_app_table_grid_1794316124005_jmpdp(1);
    patchDesignerStore("gridQuery.pageSize", nextSize);
  }, [patchDesignerStore]);
  const handleGridSortByChange_heroui_app_table_grid_1794316124005_jmpdp = React.useCallback((nextSortBy: string) => {
    setGridQuery_heroui_app_table_grid_1794316124005_jmpdp((current: GridQueryState) => ({ ...current, sort: nextSortBy ? { columnId: nextSortBy, direction: current.sort?.direction ?? 'asc' } : null }));
  }, []);
  const handleGridToggleSortDirection_heroui_app_table_grid_1794316124005_jmpdp = React.useCallback(() => {
    setGridQuery_heroui_app_table_grid_1794316124005_jmpdp((current: GridQueryState) => (current.sort ? { ...current, sort: { ...current.sort, direction: current.sort.direction === 'asc' ? 'desc' : 'asc' } } : current));
  }, []);
  const searchDebounceTimer_heroui_app_table_grid_1794316124005_jmpdp = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleGridSearchChange_heroui_app_table_grid_1794316124005_jmpdp = React.useCallback((nextValue: string) => {
    setGridSearchInput_heroui_app_table_grid_1794316124005_jmpdp(nextValue);
    if (searchDebounceTimer_heroui_app_table_grid_1794316124005_jmpdp.current) {
      clearTimeout(searchDebounceTimer_heroui_app_table_grid_1794316124005_jmpdp.current);
    }
    searchDebounceTimer_heroui_app_table_grid_1794316124005_jmpdp.current = setTimeout(() => {
      setGridDebouncedSearch_heroui_app_table_grid_1794316124005_jmpdp(nextValue);
      setGridPage_heroui_app_table_grid_1794316124005_jmpdp(1);
      patchDesignerStore("gridToolbar.search", nextValue);
    }, 300);
  }, [patchDesignerStore]);

  const gridColumns_heroui_app_table_grid_1794316124060_wa771 = React.useMemo(() => buildAppTableGridColumns([{"key":"title","label":"Station","sort":true,"filter":true,"filterType":"text","cardRole":"title"},{"key":"isActive","label":"Active","sort":true,"cellKind":"boolean-icon","cardRole":"meta","width":"6rem"},{"key":"operatorNote","label":"Note","cardRole":"meta"},{"key":"actions","label":"","kind":"action-group","actions":[{"actionId":"edit","icon":"Pencil","intent":"edit","tooltip":"Edit","behavior":{"kind":"open-modal","modalNodeId":"node-f5a37c74-b666-4402-8aee-55a655d248d2","primaryKeyField":"id","selectionStorePath":"selection.id"}},{"actionId":"delete","icon":"Trash2","intent":"delete","tooltip":"Delete","behavior":{"kind":"open-modal","modalNodeId":"node-218c9cd5-dee9-4d02-b0be-bdc06654b6c2","primaryKeyField":"id","selectionStorePath":"selection.id"}}],"maxVisibleActions":3,"cardRole":"actions","layoutHideable":false,"layoutResizable":false,"layoutReorderable":false,"layoutPinned":"right","width":"57px"}], "server", {
    mode: 'runtime',
    detailFlowRef: { current: null },
    rowActionHandlerRef: { current: handleGridRowAction_heroui_app_table_grid_1794316124060_wa771 },
    cellClickHandlerRef: { current: undefined },
    designerStoreRef: { current: designerStore },
  }), [designerStore, handleGridRowAction_heroui_app_table_grid_1794316124060_wa771]);
  const [gridQuery_heroui_app_table_grid_1794316124060_wa771, setGridQuery_heroui_app_table_grid_1794316124060_wa771] = React.useState<GridQueryState>(() => ({ ...EMPTY_GRID_QUERY, sort: { columnId: "title", direction: "asc" } }));
  const [gridPage_heroui_app_table_grid_1794316124060_wa771, setGridPage_heroui_app_table_grid_1794316124060_wa771] = React.useState(1);
  const [gridPageSize_heroui_app_table_grid_1794316124060_wa771, setGridPageSize_heroui_app_table_grid_1794316124060_wa771] = React.useState(15);
  const [gridListMode_heroui_app_table_grid_1794316124060_wa771, setGridListMode_heroui_app_table_grid_1794316124060_wa771] = React.useState<'paging' | 'infinite'>("paging");
  const [gridColumnLayout_heroui_app_table_grid_1794316124060_wa771, setGridColumnLayout_heroui_app_table_grid_1794316124060_wa771] = React.useState(() => createDefaultColumnLayout(gridColumns_heroui_app_table_grid_1794316124060_wa771));
  const [gridSearchInput_heroui_app_table_grid_1794316124060_wa771, setGridSearchInput_heroui_app_table_grid_1794316124060_wa771] = React.useState('');
  const [gridDebouncedSearch_heroui_app_table_grid_1794316124060_wa771, setGridDebouncedSearch_heroui_app_table_grid_1794316124060_wa771] = React.useState('');
  const [gridCheckboxSelections_heroui_app_table_grid_1794316124060_wa771, setGridCheckboxSelections_heroui_app_table_grid_1794316124060_wa771] = React.useState<Record<string, Record<string, boolean>>>({});
  const [gridRadioSelections_heroui_app_table_grid_1794316124060_wa771, setGridRadioSelections_heroui_app_table_grid_1794316124060_wa771] = React.useState<Record<string, string>>({});
  const [gridMatchLogic_heroui_app_table_grid_1794316124060_wa771, setGridMatchLogic_heroui_app_table_grid_1794316124060_wa771] = React.useState<Record<string, 'and' | 'or'>>({});
  const gridRoleFilters_heroui_app_table_grid_1794316124060_wa771 = {};
  const gridFilteredRows_heroui_app_table_grid_1794316124060_wa771 = React.useMemo(() => applyClientGridQuery(((Array.isArray(gridData_heroui_app_table_grid_1794316124060_wa771) ? gridData_heroui_app_table_grid_1794316124060_wa771 : []) ?? []), gridQuery_heroui_app_table_grid_1794316124060_wa771, gridColumns_heroui_app_table_grid_1794316124060_wa771, "server"), [gridQuery_heroui_app_table_grid_1794316124060_wa771, gridColumns_heroui_app_table_grid_1794316124060_wa771]);
  const gridAggregatedRows_heroui_app_table_grid_1794316124060_wa771 = gridFilteredRows_heroui_app_table_grid_1794316124060_wa771;
  const gridApiTotal_heroui_app_table_grid_1794316124060_wa771 = React.useMemo(() => {
    const raw = raw_gridData_heroui_app_table_grid_1794316124060_wa771;
    const value = readNestedContextValue((raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}), "count");
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
  }, [raw_gridData_heroui_app_table_grid_1794316124060_wa771]);
  const gridTotalCount_heroui_app_table_grid_1794316124060_wa771 = resolveDataGridTotalCount({ page: gridPage_heroui_app_table_grid_1794316124060_wa771, pageSize: gridPageSize_heroui_app_table_grid_1794316124060_wa771, total: gridApiTotal_heroui_app_table_grid_1794316124060_wa771, gridQueryMode: "server" }, gridAggregatedRows_heroui_app_table_grid_1794316124060_wa771.length);
  const gridPaging_heroui_app_table_grid_1794316124060_wa771 = sliceDataGridRowsForDisplay(gridAggregatedRows_heroui_app_table_grid_1794316124060_wa771, gridPage_heroui_app_table_grid_1794316124060_wa771, gridPageSize_heroui_app_table_grid_1794316124060_wa771, gridTotalCount_heroui_app_table_grid_1794316124060_wa771, "server");
  const handleGridQueryChange_heroui_app_table_grid_1794316124060_wa771 = React.useCallback((nextQuery: GridQueryState) => {
    setGridQuery_heroui_app_table_grid_1794316124060_wa771(nextQuery);
    setGridPage_heroui_app_table_grid_1794316124060_wa771(1);
    patchDesignerStore("gridQuery.sortBy", nextQuery.sort?.columnId ?? '');
    patchDesignerStore("gridQuery.sortDir", nextQuery.sort?.direction ?? '');
  }, [patchDesignerStore]);
  const handleGridPageChange_heroui_app_table_grid_1794316124060_wa771 = React.useCallback((nextPage: number) => {
    setGridPage_heroui_app_table_grid_1794316124060_wa771(nextPage);
    patchDesignerStore("gridQuery.page", nextPage);
  }, [patchDesignerStore]);
  const handleGridPageSizeChange_heroui_app_table_grid_1794316124060_wa771 = React.useCallback((nextSize: number) => {
    setGridPageSize_heroui_app_table_grid_1794316124060_wa771(nextSize);
    setGridPage_heroui_app_table_grid_1794316124060_wa771(1);
    patchDesignerStore("gridQuery.pageSize", nextSize);
  }, [patchDesignerStore]);
  const handleGridSortByChange_heroui_app_table_grid_1794316124060_wa771 = React.useCallback((nextSortBy: string) => {
    setGridQuery_heroui_app_table_grid_1794316124060_wa771((current: GridQueryState) => ({ ...current, sort: nextSortBy ? { columnId: nextSortBy, direction: current.sort?.direction ?? 'asc' } : null }));
  }, []);
  const handleGridToggleSortDirection_heroui_app_table_grid_1794316124060_wa771 = React.useCallback(() => {
    setGridQuery_heroui_app_table_grid_1794316124060_wa771((current: GridQueryState) => (current.sort ? { ...current, sort: { ...current.sort, direction: current.sort.direction === 'asc' ? 'desc' : 'asc' } } : current));
  }, []);
  const searchDebounceTimer_heroui_app_table_grid_1794316124060_wa771 = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleGridSearchChange_heroui_app_table_grid_1794316124060_wa771 = React.useCallback((nextValue: string) => {
    setGridSearchInput_heroui_app_table_grid_1794316124060_wa771(nextValue);
    if (searchDebounceTimer_heroui_app_table_grid_1794316124060_wa771.current) {
      clearTimeout(searchDebounceTimer_heroui_app_table_grid_1794316124060_wa771.current);
    }
    searchDebounceTimer_heroui_app_table_grid_1794316124060_wa771.current = setTimeout(() => {
      setGridDebouncedSearch_heroui_app_table_grid_1794316124060_wa771(nextValue);
      setGridPage_heroui_app_table_grid_1794316124060_wa771(1);
      patchDesignerStore("gridToolbar.search", nextValue);
    }, 300);
  }, [patchDesignerStore]);

  const dataContext: Record<string, unknown> | null = null;
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const handleonClick_heroui_button_outline_1794316123909_65x6d = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    navigate("/studio/voting/votings", { replace: false });
  }, [navigate]);
  const handleonSubmit_html_form_1794316123919_wss0b = React.useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {};
      payload["id"] = formData.get("html-text-1794316123925-kj6hd") ?? '';
      payload["statusCode"] = formData.get("html-text-1794316123929-2oo2w") ?? '';
      payload["title"] = formData.get("heroui-input-text-1794316123931-8grsz") ?? '';
      payload["statusCode"] = applyPayloadFieldTransform(formData.get("heroui-select-1794316123933-rnd5x"), "nullableString");
      payload["startsAt"] = formData.get("heroui-date-picker-1794316123935-1gajf") ?? '';
      payload["endsAt"] = formData.get("heroui-date-picker-1794316123937-o107h") ?? '';
      payload["operatorNote"] = formData.get("heroui-textarea-1794316123939-jbw41") ?? '';
      const method = regionData_voteVotingDetail_html_form_1794316123919_wss0b?.id != null && String(regionData_voteVotingDetail_html_form_1794316123919_wss0b?.id).length > 0 ? "PUT" : 'POST';
      const url = (regionData_voteVotingDetail_html_form_1794316123919_wss0b?.id != null && String(regionData_voteVotingDetail_html_form_1794316123919_wss0b?.id).length > 0 ? (regionData_voteVotingDetail_html_form_1794316123919_wss0b?.id != null && String(regionData_voteVotingDetail_html_form_1794316123919_wss0b?.id).length > 0 ? ("/api/voting/votings/" + encodeURIComponent(String(regionData_voteVotingDetail_html_form_1794316123919_wss0b?.id)) + "") : "/api/voting/votings/:id") : "/api/voting/votings/:id");
      const response = await designerFetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response));
      }
      toast("Voting scope saved.", { variant: "success", timeout: 4000 });
    } catch (mutationFailure) {
      toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' });
    }
    finally {
      setIsSubmitting(false);
    }
  }, [regionData_voteVotingDetail_html_form_1794316123919_wss0b]);
  const handleonClick_node_e63159e0_a8da_4805_969d_800e259d1dd3 = React.useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    let formData: FormData;
    const form = event.currentTarget instanceof HTMLFormElement ? event.currentTarget : event.currentTarget.closest('form');
    if (form) {
      formData = new FormData(form);
    } else {
      const regionRoot = document.querySelector("[data-designer-node-id=\"node-53d4ccde-414a-45cc-8029-0a8d9aa2c36e\"]");
      if (!regionRoot) {
        return;
      }
      formData = collectRegionFormDataFromContainer(regionRoot, ["node-903e35fa-ee0b-4976-8fed-9e0624b6a9e8","node-4f65a6b2-c0b3-4e6e-b66c-92dcfa68174e","node-395d03bc-dd57-4f45-8b57-2dd20dd86fcd","node-466be8cc-37a6-41c5-9a42-55f14a63e475","node-4f321202-a622-482f-b78a-12bda70103a1"]);
    }
    const fieldValidationEntries = [{"nodeId":"node-903e35fa-ee0b-4976-8fed-9e0624b6a9e8","formFieldName":"node-903e35fa-ee0b-4976-8fed-9e0624b6a9e8","props":{"_designerPaletteItemId":"heroui.input-text","isRequired":true}},{"nodeId":"node-4f65a6b2-c0b3-4e6e-b66c-92dcfa68174e","formFieldName":"node-4f65a6b2-c0b3-4e6e-b66c-92dcfa68174e","props":{"_designerPaletteItemId":"heroui.input-text","isRequired":true}},{"nodeId":"node-395d03bc-dd57-4f45-8b57-2dd20dd86fcd","formFieldName":"node-395d03bc-dd57-4f45-8b57-2dd20dd86fcd","props":{"_designerPaletteItemId":"heroui.radio-group","isRequired":true}},{"nodeId":"node-4f321202-a622-482f-b78a-12bda70103a1","formFieldName":"node-4f321202-a622-482f-b78a-12bda70103a1","props":{"_designerPaletteItemId":"heroui.input-text","isRequired":true}}] as Array<{ nodeId: string; formFieldName: string; props: Record<string, unknown> }>;
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
      payload["votingId"] = formData.get("node-903e35fa-ee0b-4976-8fed-9e0624b6a9e8") ?? '';
      payload["title"] = formData.get("node-4f65a6b2-c0b3-4e6e-b66c-92dcfa68174e") ?? '';
      payload["selectionMode"] = formData.get("node-395d03bc-dd57-4f45-8b57-2dd20dd86fcd") ?? '';
      payload["maxSelections"] = formData.get("node-466be8cc-37a6-41c5-9a42-55f14a63e475") ?? '';
      payload["sortOrder"] = formData.get("node-4f321202-a622-482f-b78a-12bda70103a1") ?? '';
      const method = regionData_voteBallotsList_node_53d4ccde_414a_45cc_8029_0a8d9aa2c36e?.id != null && String(regionData_voteBallotsList_node_53d4ccde_414a_45cc_8029_0a8d9aa2c36e?.id).length > 0 ? "PUT" : 'POST';
      const url = (regionData_voteBallotsList_node_53d4ccde_414a_45cc_8029_0a8d9aa2c36e?.id != null && String(regionData_voteBallotsList_node_53d4ccde_414a_45cc_8029_0a8d9aa2c36e?.id).length > 0 ? (regionData_voteBallotsList_node_53d4ccde_414a_45cc_8029_0a8d9aa2c36e?.id != null && String(regionData_voteBallotsList_node_53d4ccde_414a_45cc_8029_0a8d9aa2c36e?.id).length > 0 ? ("/api/voting/ballots/" + encodeURIComponent(String(regionData_voteBallotsList_node_53d4ccde_414a_45cc_8029_0a8d9aa2c36e?.id)) + "") : "/api/voting/ballots/:id") : "/api/voting/ballots");
      const response = await designerFetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response));
      }
      patchDesignerStore("ui.visibility.node-f53f9efe-8db5-42ea-9b94-898695065bab", false);
      toast("Saved successfully", { variant: "success", timeout: 4000 });
      await refresh_gridData_heroui_app_table_grid_1794316123953_xbb11();
      (document.querySelector("[data-designer-node-id=\"node-53d4ccde-414a-45cc-8029-0a8d9aa2c36e\"]") as HTMLFormElement | null)?.reset?.();
    } catch (mutationFailure) {
      toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' });
    }
    finally {
      setIsSubmitting(false);
    }
  }, [regionData_voteBallotsList_node_53d4ccde_414a_45cc_8029_0a8d9aa2c36e]);
  const handleonClick_node_45eb8a5b_bfb5_4318_a834_b3c680d2c751 = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-f53f9efe-8db5-42ea-9b94-898695065bab", false);
  }, [patchDesignerStore]);
  const handleonClick_node_3fe28dc2_55b3_4bb3_8b6f_fce7294bade9 = React.useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    let formData: FormData;
    const form = event.currentTarget instanceof HTMLFormElement ? event.currentTarget : event.currentTarget.closest('form');
    if (form) {
      formData = new FormData(form);
    } else {
      const regionRoot = document.querySelector("[data-designer-node-id=\"node-b8715c07-6472-4c65-974c-89648e07443d\"]");
      if (!regionRoot) {
        return;
      }
      formData = collectRegionFormDataFromContainer(regionRoot, ["node-e1a56579-ee40-4eee-a9cf-06172982a476","node-7781f91c-0826-43e2-8013-d089c59b0da9","node-901e35ea-6591-467b-bd6d-44721d672aea","node-350ec2c6-0860-4cc9-91f9-f99342db075b","node-35c39e5a-6ef0-4b16-b3c8-773bb51da218"]);
    }
    const fieldValidationEntries = [{"nodeId":"node-e1a56579-ee40-4eee-a9cf-06172982a476","formFieldName":"node-e1a56579-ee40-4eee-a9cf-06172982a476","props":{"_designerPaletteItemId":"heroui.input-text","isRequired":true}},{"nodeId":"node-7781f91c-0826-43e2-8013-d089c59b0da9","formFieldName":"node-7781f91c-0826-43e2-8013-d089c59b0da9","props":{"_designerPaletteItemId":"heroui.input-text","isRequired":true}},{"nodeId":"node-901e35ea-6591-467b-bd6d-44721d672aea","formFieldName":"node-901e35ea-6591-467b-bd6d-44721d672aea","props":{"_designerPaletteItemId":"heroui.radio-group","isRequired":true}},{"nodeId":"node-35c39e5a-6ef0-4b16-b3c8-773bb51da218","formFieldName":"node-35c39e5a-6ef0-4b16-b3c8-773bb51da218","props":{"_designerPaletteItemId":"heroui.input-text","isRequired":true}}] as Array<{ nodeId: string; formFieldName: string; props: Record<string, unknown> }>;
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
      payload["votingId"] = formData.get("node-e1a56579-ee40-4eee-a9cf-06172982a476") ?? '';
      payload["title"] = formData.get("node-7781f91c-0826-43e2-8013-d089c59b0da9") ?? '';
      payload["selectionMode"] = formData.get("node-901e35ea-6591-467b-bd6d-44721d672aea") ?? '';
      payload["maxSelections"] = formData.get("node-350ec2c6-0860-4cc9-91f9-f99342db075b") ?? '';
      payload["sortOrder"] = formData.get("node-35c39e5a-6ef0-4b16-b3c8-773bb51da218") ?? '';
      const method = regionData_voteBallotsList_node_b8715c07_6472_4c65_974c_89648e07443d?.id != null && String(regionData_voteBallotsList_node_b8715c07_6472_4c65_974c_89648e07443d?.id).length > 0 ? "PUT" : 'POST';
      const url = (regionData_voteBallotsList_node_b8715c07_6472_4c65_974c_89648e07443d?.id != null && String(regionData_voteBallotsList_node_b8715c07_6472_4c65_974c_89648e07443d?.id).length > 0 ? (regionData_voteBallotsList_node_b8715c07_6472_4c65_974c_89648e07443d?.id != null && String(regionData_voteBallotsList_node_b8715c07_6472_4c65_974c_89648e07443d?.id).length > 0 ? ("/api/voting/ballots/" + encodeURIComponent(String(regionData_voteBallotsList_node_b8715c07_6472_4c65_974c_89648e07443d?.id)) + "") : "/api/voting/ballots/:id") : "/api/voting/ballots");
      const response = await designerFetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response));
      }
      patchDesignerStore("ui.visibility.node-2505cd81-4f24-4e95-9a86-45d29d772103", false);
      toast("Saved successfully", { variant: "success", timeout: 4000 });
      await refresh_gridData_heroui_app_table_grid_1794316123953_xbb11();
    } catch (mutationFailure) {
      toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' });
    }
    finally {
      setIsSubmitting(false);
    }
  }, [regionData_voteBallotsList_node_b8715c07_6472_4c65_974c_89648e07443d]);
  const handleonClick_node_43124754_a680_4bfe_89fe_65fba16a52bc = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-2505cd81-4f24-4e95-9a86-45d29d772103", false);
  }, [patchDesignerStore]);
  const handleonClick_node_35895677_50ca_48e7_845f_f31858c94b26 = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-13e6bd03-8adb-4d58-adc9-3605690caaef", false);
  }, [patchDesignerStore]);
  const handleonClick_node_03c21b6a_6d57_4a41_af42_e5dbe682410a = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    void (async () => {
      let mutationOk_da_mwaphq2r_hxytt = true;
      try {
        const response = await designerFetch(("/api/voting/ballots/" + encodeURIComponent(String(designerStore?.selection?.id)) + ""), {
          method: "DELETE",
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) {
          toast(await parseApiErrorMessage(response), { variant: 'danger' });
          mutationOk_da_mwaphq2r_hxytt = false;
        }
      } catch (mutationFailure) {
        toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' });
        mutationOk_da_mwaphq2r_hxytt = false;
      }
      if (mutationOk_da_mwaphq2r_hxytt) {
        await refresh_gridData_heroui_app_table_grid_1794316123953_xbb11();
        toast("Deleted", { variant: "success", timeout: 4000 });
        patchDesignerStore("ui.visibility.node-13e6bd03-8adb-4d58-adc9-3605690caaef", false);
      }
    })();
  }, [patchDesignerStore, refresh_gridData_heroui_app_table_grid_1794316123953_xbb11]);
  const handleonClick_node_a6ed3016_c97e_4d59_827a_04062ebd3e1e = React.useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    let formData: FormData;
    const form = event.currentTarget instanceof HTMLFormElement ? event.currentTarget : event.currentTarget.closest('form');
    if (form) {
      formData = new FormData(form);
    } else {
      const regionRoot = document.querySelector("[data-designer-node-id=\"node-d9d81289-915a-49b7-8536-c4a7e8839857\"]");
      if (!regionRoot) {
        return;
      }
      formData = collectRegionFormDataFromContainer(regionRoot, ["node-880128c4-d9a5-48b8-8a22-a5224f6567c2","node-38722b55-6593-400d-8530-e3f504a4822c","node-b79002b8-5172-474a-b1fb-4ee5c4593277","node-6578a8db-65d5-40e8-95b7-c6b03210da5e"]);
    }
    const fieldValidationEntries = [{"nodeId":"node-880128c4-d9a5-48b8-8a22-a5224f6567c2","formFieldName":"node-880128c4-d9a5-48b8-8a22-a5224f6567c2","props":{"_designerPaletteItemId":"heroui.input-text","isRequired":true}},{"nodeId":"node-38722b55-6593-400d-8530-e3f504a4822c","formFieldName":"node-38722b55-6593-400d-8530-e3f504a4822c","props":{"_designerPaletteItemId":"heroui.input-text","isRequired":true}},{"nodeId":"node-b79002b8-5172-474a-b1fb-4ee5c4593277","formFieldName":"node-b79002b8-5172-474a-b1fb-4ee5c4593277","props":{"_designerPaletteItemId":"heroui.input-text","isRequired":true}},{"nodeId":"node-6578a8db-65d5-40e8-95b7-c6b03210da5e","formFieldName":"node-6578a8db-65d5-40e8-95b7-c6b03210da5e","props":{"_designerPaletteItemId":"heroui.input-text","isRequired":true}}] as Array<{ nodeId: string; formFieldName: string; props: Record<string, unknown> }>;
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
      payload["votingId"] = formData.get("node-880128c4-d9a5-48b8-8a22-a5224f6567c2") ?? '';
      payload["ballotId"] = formData.get("node-38722b55-6593-400d-8530-e3f504a4822c") ?? '';
      payload["displayName"] = formData.get("node-b79002b8-5172-474a-b1fb-4ee5c4593277") ?? '';
      payload["sortOrder"] = formData.get("node-6578a8db-65d5-40e8-95b7-c6b03210da5e") ?? '';
      const method = regionData_voteCandidatesList_node_d9d81289_915a_49b7_8536_c4a7e8839857?.id != null && String(regionData_voteCandidatesList_node_d9d81289_915a_49b7_8536_c4a7e8839857?.id).length > 0 ? "PUT" : 'POST';
      const url = (regionData_voteCandidatesList_node_d9d81289_915a_49b7_8536_c4a7e8839857?.id != null && String(regionData_voteCandidatesList_node_d9d81289_915a_49b7_8536_c4a7e8839857?.id).length > 0 ? (regionData_voteCandidatesList_node_d9d81289_915a_49b7_8536_c4a7e8839857?.id != null && String(regionData_voteCandidatesList_node_d9d81289_915a_49b7_8536_c4a7e8839857?.id).length > 0 ? ("/api/voting/candidates/" + encodeURIComponent(String(regionData_voteCandidatesList_node_d9d81289_915a_49b7_8536_c4a7e8839857?.id)) + "") : "/api/voting/candidates/:id") : "/api/voting/candidates");
      const response = await designerFetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response));
      }
      patchDesignerStore("ui.visibility.node-993a713a-4a3a-44bd-97c1-c79f025463aa", false);
      toast("Saved successfully", { variant: "success", timeout: 4000 });
      await refresh_gridData_heroui_app_table_grid_1794316124005_jmpdp();
      (document.querySelector("[data-designer-node-id=\"node-d9d81289-915a-49b7-8536-c4a7e8839857\"]") as HTMLFormElement | null)?.reset?.();
    } catch (mutationFailure) {
      toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' });
    }
    finally {
      setIsSubmitting(false);
    }
  }, [regionData_voteCandidatesList_node_d9d81289_915a_49b7_8536_c4a7e8839857]);
  const handleonClick_node_ad6d75d4_bbc8_402e_8ea6_f85c90500b3f = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-993a713a-4a3a-44bd-97c1-c79f025463aa", false);
  }, [patchDesignerStore]);
  const handleonClick_node_9b6688b9_3b25_4238_adc1_19303ec55de4 = React.useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    let formData: FormData;
    const form = event.currentTarget instanceof HTMLFormElement ? event.currentTarget : event.currentTarget.closest('form');
    if (form) {
      formData = new FormData(form);
    } else {
      const regionRoot = document.querySelector("[data-designer-node-id=\"node-e1eaed1e-9bc8-43b8-8201-ff0dc11132ec\"]");
      if (!regionRoot) {
        return;
      }
      formData = collectRegionFormDataFromContainer(regionRoot, ["node-f9341a42-a3f3-4164-a534-3808ca048434","node-361ebb66-295d-413a-9ff9-a1f521510c4b","node-ee32f5b5-300b-4490-b884-0b357dba1dd7","node-705c8465-4e99-4cc5-b8e3-f5c4e8301af1"]);
    }
    const fieldValidationEntries = [{"nodeId":"node-f9341a42-a3f3-4164-a534-3808ca048434","formFieldName":"node-f9341a42-a3f3-4164-a534-3808ca048434","props":{"_designerPaletteItemId":"heroui.input-text","isRequired":true}},{"nodeId":"node-361ebb66-295d-413a-9ff9-a1f521510c4b","formFieldName":"node-361ebb66-295d-413a-9ff9-a1f521510c4b","props":{"_designerPaletteItemId":"heroui.input-text","isRequired":true}},{"nodeId":"node-ee32f5b5-300b-4490-b884-0b357dba1dd7","formFieldName":"node-ee32f5b5-300b-4490-b884-0b357dba1dd7","props":{"_designerPaletteItemId":"heroui.input-text","isRequired":true}},{"nodeId":"node-705c8465-4e99-4cc5-b8e3-f5c4e8301af1","formFieldName":"node-705c8465-4e99-4cc5-b8e3-f5c4e8301af1","props":{"_designerPaletteItemId":"heroui.input-text","isRequired":true}}] as Array<{ nodeId: string; formFieldName: string; props: Record<string, unknown> }>;
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
      payload["votingId"] = formData.get("node-f9341a42-a3f3-4164-a534-3808ca048434") ?? '';
      payload["ballotId"] = formData.get("node-361ebb66-295d-413a-9ff9-a1f521510c4b") ?? '';
      payload["displayName"] = formData.get("node-ee32f5b5-300b-4490-b884-0b357dba1dd7") ?? '';
      payload["sortOrder"] = formData.get("node-705c8465-4e99-4cc5-b8e3-f5c4e8301af1") ?? '';
      const method = regionData_voteCandidatesList_node_e1eaed1e_9bc8_43b8_8201_ff0dc11132ec?.id != null && String(regionData_voteCandidatesList_node_e1eaed1e_9bc8_43b8_8201_ff0dc11132ec?.id).length > 0 ? "PUT" : 'POST';
      const url = (regionData_voteCandidatesList_node_e1eaed1e_9bc8_43b8_8201_ff0dc11132ec?.id != null && String(regionData_voteCandidatesList_node_e1eaed1e_9bc8_43b8_8201_ff0dc11132ec?.id).length > 0 ? (regionData_voteCandidatesList_node_e1eaed1e_9bc8_43b8_8201_ff0dc11132ec?.id != null && String(regionData_voteCandidatesList_node_e1eaed1e_9bc8_43b8_8201_ff0dc11132ec?.id).length > 0 ? ("/api/voting/candidates/" + encodeURIComponent(String(regionData_voteCandidatesList_node_e1eaed1e_9bc8_43b8_8201_ff0dc11132ec?.id)) + "") : "/api/voting/candidates/:id") : "/api/voting/candidates");
      const response = await designerFetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response));
      }
      patchDesignerStore("ui.visibility.node-d496d557-9e25-41ca-a0c7-c5861acb91a3", false);
      toast("Saved successfully", { variant: "success", timeout: 4000 });
      await refresh_gridData_heroui_app_table_grid_1794316124005_jmpdp();
    } catch (mutationFailure) {
      toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' });
    }
    finally {
      setIsSubmitting(false);
    }
  }, [regionData_voteCandidatesList_node_e1eaed1e_9bc8_43b8_8201_ff0dc11132ec]);
  const handleonClick_node_536cf237_419e_485a_9ba6_9604387d2905 = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-d496d557-9e25-41ca-a0c7-c5861acb91a3", false);
  }, [patchDesignerStore]);
  const handleonClick_node_1f0c98d3_43f1_4fc7_8d23_03ec954ed71c = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-67b3fbbb-ca30-44c2-8f34-b804d832d599", false);
  }, [patchDesignerStore]);
  const handleonClick_node_5902248c_e659_49c6_9374_6afe22122b6b = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    void (async () => {
      let mutationOk_da_mwaphq4c_9ug4a = true;
      try {
        const response = await designerFetch(("/api/voting/candidates/" + encodeURIComponent(String(designerStore?.selection?.id)) + ""), {
          method: "DELETE",
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) {
          toast(await parseApiErrorMessage(response), { variant: 'danger' });
          mutationOk_da_mwaphq4c_9ug4a = false;
        }
      } catch (mutationFailure) {
        toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' });
        mutationOk_da_mwaphq4c_9ug4a = false;
      }
      if (mutationOk_da_mwaphq4c_9ug4a) {
        await refresh_gridData_heroui_app_table_grid_1794316124005_jmpdp();
        toast("Deleted", { variant: "success", timeout: 4000 });
        patchDesignerStore("ui.visibility.node-67b3fbbb-ca30-44c2-8f34-b804d832d599", false);
      }
    })();
  }, [patchDesignerStore, refresh_gridData_heroui_app_table_grid_1794316124005_jmpdp]);
  const handleonClick_node_4212700e_21fb_4b41_bf68_a14aee631bec = React.useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    let formData: FormData;
    const form = event.currentTarget instanceof HTMLFormElement ? event.currentTarget : event.currentTarget.closest('form');
    if (form) {
      formData = new FormData(form);
    } else {
      const regionRoot = document.querySelector("[data-designer-node-id=\"node-44ae1fe2-5d21-4dc4-a4db-2071b90868ab\"]");
      if (!regionRoot) {
        return;
      }
      formData = collectRegionFormDataFromContainer(regionRoot, ["node-21bd7fd7-f593-4ffb-8d50-3fc3863d208b","node-2250f71f-d1a3-492c-a98b-d91a9fad621d","node-342a157f-e49a-496b-b31e-ba1af601dfe5","node-6c2ac0df-6419-4129-8580-9320d3163b28"]);
    }
    const fieldValidationEntries = [{"nodeId":"node-21bd7fd7-f593-4ffb-8d50-3fc3863d208b","formFieldName":"node-21bd7fd7-f593-4ffb-8d50-3fc3863d208b","props":{"_designerPaletteItemId":"heroui.input-text","isRequired":true}},{"nodeId":"node-2250f71f-d1a3-492c-a98b-d91a9fad621d","formFieldName":"node-2250f71f-d1a3-492c-a98b-d91a9fad621d","props":{"_designerPaletteItemId":"heroui.input-text","isRequired":true}}] as Array<{ nodeId: string; formFieldName: string; props: Record<string, unknown> }>;
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
      payload["votingId"] = formData.get("node-21bd7fd7-f593-4ffb-8d50-3fc3863d208b") ?? '';
      payload["title"] = formData.get("node-2250f71f-d1a3-492c-a98b-d91a9fad621d") ?? '';
      payload["isActive"] = applyPayloadFieldTransform(formData.get("node-342a157f-e49a-496b-b31e-ba1af601dfe5"), "boolean");
      payload["operatorNote"] = formData.get("node-6c2ac0df-6419-4129-8580-9320d3163b28") ?? '';
      const method = regionData_votePollingStationsList_node_44ae1fe2_5d21_4dc4_a4db_2071b90868ab?.id != null && String(regionData_votePollingStationsList_node_44ae1fe2_5d21_4dc4_a4db_2071b90868ab?.id).length > 0 ? "PUT" : 'POST';
      const url = (regionData_votePollingStationsList_node_44ae1fe2_5d21_4dc4_a4db_2071b90868ab?.id != null && String(regionData_votePollingStationsList_node_44ae1fe2_5d21_4dc4_a4db_2071b90868ab?.id).length > 0 ? (regionData_votePollingStationsList_node_44ae1fe2_5d21_4dc4_a4db_2071b90868ab?.id != null && String(regionData_votePollingStationsList_node_44ae1fe2_5d21_4dc4_a4db_2071b90868ab?.id).length > 0 ? ("/api/voting/polling-stations/" + encodeURIComponent(String(regionData_votePollingStationsList_node_44ae1fe2_5d21_4dc4_a4db_2071b90868ab?.id)) + "") : "/api/voting/polling-stations/:id") : "/api/voting/polling-stations");
      const response = await designerFetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response));
      }
      patchDesignerStore("ui.visibility.node-b9b759f9-116a-4e6e-a30e-fd341231057d", false);
      toast("Saved successfully", { variant: "success", timeout: 4000 });
      await refresh_gridData_heroui_app_table_grid_1794316124060_wa771();
      (document.querySelector("[data-designer-node-id=\"node-44ae1fe2-5d21-4dc4-a4db-2071b90868ab\"]") as HTMLFormElement | null)?.reset?.();
    } catch (mutationFailure) {
      toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' });
    }
    finally {
      setIsSubmitting(false);
    }
  }, [regionData_votePollingStationsList_node_44ae1fe2_5d21_4dc4_a4db_2071b90868ab]);
  const handleonClick_node_c8e4869e_2d96_4a79_9c21_6faa84c583c7 = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-b9b759f9-116a-4e6e-a30e-fd341231057d", false);
  }, [patchDesignerStore]);
  const handleonClick_node_36aaa2ff_a4a1_4cec_a872_96fdaa316f97 = React.useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    let formData: FormData;
    const form = event.currentTarget instanceof HTMLFormElement ? event.currentTarget : event.currentTarget.closest('form');
    if (form) {
      formData = new FormData(form);
    } else {
      const regionRoot = document.querySelector("[data-designer-node-id=\"node-b1271bc9-70e7-40b2-9701-74d62bd4067d\"]");
      if (!regionRoot) {
        return;
      }
      formData = collectRegionFormDataFromContainer(regionRoot, ["node-8eefcfde-5c5b-4e5d-b52a-6bd4338ca112","node-64262d18-0b37-4306-b864-7d085441ed88","node-e4b847d0-cb4b-4214-80cc-da08a65629f6","node-95b678dc-d248-4cc6-8053-7033249398a9"]);
    }
    const fieldValidationEntries = [{"nodeId":"node-8eefcfde-5c5b-4e5d-b52a-6bd4338ca112","formFieldName":"node-8eefcfde-5c5b-4e5d-b52a-6bd4338ca112","props":{"_designerPaletteItemId":"heroui.input-text","isRequired":true}},{"nodeId":"node-64262d18-0b37-4306-b864-7d085441ed88","formFieldName":"node-64262d18-0b37-4306-b864-7d085441ed88","props":{"_designerPaletteItemId":"heroui.input-text","isRequired":true}}] as Array<{ nodeId: string; formFieldName: string; props: Record<string, unknown> }>;
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
      payload["votingId"] = formData.get("node-8eefcfde-5c5b-4e5d-b52a-6bd4338ca112") ?? '';
      payload["title"] = formData.get("node-64262d18-0b37-4306-b864-7d085441ed88") ?? '';
      payload["isActive"] = applyPayloadFieldTransform(formData.get("node-e4b847d0-cb4b-4214-80cc-da08a65629f6"), "boolean");
      payload["operatorNote"] = formData.get("node-95b678dc-d248-4cc6-8053-7033249398a9") ?? '';
      const method = regionData_votePollingStationsList_node_b1271bc9_70e7_40b2_9701_74d62bd4067d?.id != null && String(regionData_votePollingStationsList_node_b1271bc9_70e7_40b2_9701_74d62bd4067d?.id).length > 0 ? "PUT" : 'POST';
      const url = (regionData_votePollingStationsList_node_b1271bc9_70e7_40b2_9701_74d62bd4067d?.id != null && String(regionData_votePollingStationsList_node_b1271bc9_70e7_40b2_9701_74d62bd4067d?.id).length > 0 ? (regionData_votePollingStationsList_node_b1271bc9_70e7_40b2_9701_74d62bd4067d?.id != null && String(regionData_votePollingStationsList_node_b1271bc9_70e7_40b2_9701_74d62bd4067d?.id).length > 0 ? ("/api/voting/polling-stations/" + encodeURIComponent(String(regionData_votePollingStationsList_node_b1271bc9_70e7_40b2_9701_74d62bd4067d?.id)) + "") : "/api/voting/polling-stations/:id") : "/api/voting/polling-stations");
      const response = await designerFetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response));
      }
      patchDesignerStore("ui.visibility.node-f5a37c74-b666-4402-8aee-55a655d248d2", false);
      toast("Saved successfully", { variant: "success", timeout: 4000 });
      await refresh_gridData_heroui_app_table_grid_1794316124060_wa771();
    } catch (mutationFailure) {
      toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' });
    }
    finally {
      setIsSubmitting(false);
    }
  }, [regionData_votePollingStationsList_node_b1271bc9_70e7_40b2_9701_74d62bd4067d]);
  const handleonClick_node_f1e1d736_1ee3_4cb0_afe2_27fbd5962cac = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-f5a37c74-b666-4402-8aee-55a655d248d2", false);
  }, [patchDesignerStore]);
  const handleonClick_node_372239f4_6a69_4f5c_b448_e8687f1d0b7e = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-218c9cd5-dee9-4d02-b0be-bdc06654b6c2", false);
  }, [patchDesignerStore]);
  const handleonClick_node_46ef38af_0273_4cb1_95a4_49f6e8c684e1 = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    void (async () => {
      let mutationOk_da_mwaphq61_8301d = true;
      try {
        const response = await designerFetch(("/api/voting/polling-stations/" + encodeURIComponent(String(designerStore?.selection?.id)) + ""), {
          method: "DELETE",
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) {
          toast(await parseApiErrorMessage(response), { variant: 'danger' });
          mutationOk_da_mwaphq61_8301d = false;
        }
      } catch (mutationFailure) {
        toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' });
        mutationOk_da_mwaphq61_8301d = false;
      }
      if (mutationOk_da_mwaphq61_8301d) {
        await refresh_gridData_heroui_app_table_grid_1794316124060_wa771();
        toast("Deleted", { variant: "success", timeout: 4000 });
        patchDesignerStore("ui.visibility.node-218c9cd5-dee9-4d02-b0be-bdc06654b6c2", false);
      }
    })();
  }, [patchDesignerStore, refresh_gridData_heroui_app_table_grid_1794316124060_wa771]);
  return (
    <>
      <Toast.Provider />
      <div className="h-full min-h-0 w-full min-w-0 space-y-3">
        <div className="flex !h-full !min-h-0 !w-full flex-1 flex-col overflow-hidden bg-white">
          <div className="flex shrink-0 !items-center gap-3 border-b border-slate-200 bg-white !px-3 !py-2.5 sm:!px-5" data-designer-node-id="layout-flex-row-1794316123908-5nxwc">
            <WorkspaceBackIcon aria-label="Back to voting scopes" title="Back to list" onClick={handleonClick_heroui_button_outline_1794316123909_65x6d} />
            <div className="flex !min-w-0 flex-1 !items-center gap-2 overflow-hidden">
              <p className="m-0 !min-w-0 truncate !text-sm !font-semibold leading-none text-slate-800" name="html-text-1794316123911-t5fx6">{regionData_voteVotingDetail_layout_flex_row_1794316123908_5nxwc?.title ?? "Text"}</p>
              <p className="shrink-0 text-slate-300">·</p>
              <p className="m-0 shrink-0 font-mono !text-xs !font-medium leading-none text-slate-500" name="html-text-1794316123913-4gjro">{regionData_voteVotingDetail_layout_flex_row_1794316123908_5nxwc?.id ?? "Text"}</p>
            </div>
            <Button className="bg-violet-600 text-white hover:bg-violet-700" type="submit" form="voting-scope-editor-form" variant="primary" size="md" href="#" target="_self"><Save className="h-3.5 w-3.5" /> Save scope</Button>
          </div>
          <div className="!min-h-0 flex-1 gap-0 overflow-hidden bg-white !w-full grid" style={{ gridTemplateColumns: '1fr 320px' }}>
            <div className="!min-h-0 !min-w-0 overflow-hidden">
              <div className="flex !min-h-0 !min-w-0 flex-1 flex-col gap-5 overflow-y-auto !p-4 sm:!p-5">
                <div className="flex !min-h-0 !min-w-0 flex-1 flex-col gap-2 overflow-hidden">
                  <div className="flex flex-col space-y-2 !pt-3">
                    <div className="flex !min-h-4 !items-center gap-0.5 ps-[4px]">
                      <p className="border-s-2 !ps-1.5 text-[11px] !font-bold uppercase tracking-wider leading-none text-indigo-700 border-indigo-400">Questions for participants</p>
                    </div>
                    <div className="flex !min-h-0 !min-w-0 flex-1 flex-col gap-2">
                      <p className="!text-xs leading-relaxed text-indigo-900/80 ps-[4px] !pb-1">Click a question row to load its choices below. Pick rule: single = one answer; multiple = voter may pick several.</p>
                      <ListPageShell className="flex min-h-0 w-full flex-1 flex-col"><ListPageToolbarFrame><div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}><input type="text" value={gridSearchInput_heroui_app_table_grid_1794316123953_xbb11} onChange={(event) => handleGridSearchChange_heroui_app_table_grid_1794316123953_xbb11(event.target.value)} placeholder={"Search questions…"} className="h-8 rounded-md border border-slate-200 px-2 text-sm" /></div><div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}><button type="button" onClick={() => { patchDesignerStore("selection.ballotId", null); patchDesignerStore("ui.visibility.node-f53f9efe-8db5-42ea-9b94-898695065bab", true); }} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700">Add question</button><span className="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold tabular-nums text-slate-700" aria-live="polite">{gridTotalCount_heroui_app_table_grid_1794316123953_xbb11.toLocaleString()}</span><button type="button" onClick={() => { void refresh_gridData_heroui_app_table_grid_1794316123953_xbb11(); }} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">Refresh</button></div></ListPageToolbarFrame><AppTableGrid className="flex min-h-[200px] !min-w-0 flex-[3] flex-col" showPagingFooter selectionMode="single" selectionStorePath="voteEditor.activeBallotKeys" presentation="table" cardBelow="tablet" size="sm" columns={gridColumns_heroui_app_table_grid_1794316123953_xbb11} rows={gridPaging_heroui_app_table_grid_1794316123953_xbb11.displayRows} getRowKey={(row) => String((row as Record<string, unknown>)["id"] ?? '')} enableColumnLayout={false} columnLayout={gridColumnLayout_heroui_app_table_grid_1794316123953_xbb11} onColumnLayoutChange={setGridColumnLayout_heroui_app_table_grid_1794316123953_xbb11} isLoading={isLoading_gridData_heroui_app_table_grid_1794316123953_xbb11} loadingMessage={"Loading questions…"} emptyMessage={"No questions yet. Use Add question to define what voters will answer."} isEmpty={gridAggregatedRows_heroui_app_table_grid_1794316123953_xbb11.length === 0} errorContent={(error_gridData_heroui_app_table_grid_1794316123953_xbb11 ? "Could not load questions." : undefined)} gridQueryMode={"server"} query={gridQuery_heroui_app_table_grid_1794316123953_xbb11} onQueryChange={handleGridQueryChange_heroui_app_table_grid_1794316123953_xbb11} onGridRowAction={handleGridRowAction_heroui_app_table_grid_1794316123953_xbb11} footer={<GridPagingFooter totalCount={gridTotalCount_heroui_app_table_grid_1794316123953_xbb11} safePage={gridPaging_heroui_app_table_grid_1794316123953_xbb11.safePage} pageSize={gridPageSize_heroui_app_table_grid_1794316123953_xbb11} onPageSizeChange={handleGridPageSizeChange_heroui_app_table_grid_1794316123953_xbb11} sortBy={gridQuery_heroui_app_table_grid_1794316123953_xbb11.sort?.columnId ?? ''} sortOptions={[{"value":"title","label":"Question"},{"value":"selectionMode","label":"Pick rule"},{"value":"maxSelections","label":"Max picks"},{"value":"sortOrder","label":"Order"}]} onSortByChange={handleGridSortByChange_heroui_app_table_grid_1794316123953_xbb11} sortDirection={gridQuery_heroui_app_table_grid_1794316123953_xbb11.sort?.direction ?? 'asc'} onToggleSortDirection={handleGridToggleSortDirection_heroui_app_table_grid_1794316123953_xbb11} showSortControls={true} totalPages={gridPaging_heroui_app_table_grid_1794316123953_xbb11.totalPages} pageNumbers={buildDataGridPageNumbers(gridPaging_heroui_app_table_grid_1794316123953_xbb11.safePage, gridPaging_heroui_app_table_grid_1794316123953_xbb11.totalPages)} onPageChange={handleGridPageChange_heroui_app_table_grid_1794316123953_xbb11} visibleInfiniteCount={gridListMode_heroui_app_table_grid_1794316123953_xbb11 === 'infinite' ? gridPaging_heroui_app_table_grid_1794316123953_xbb11.displayRows.length : undefined} />} /></ListPageShell>
                    </div>
                  </div>
                </div>
                <div className="flex !min-h-0 !min-w-0 flex-1 flex-col gap-2 overflow-hidden">
                  <div className="flex flex-col space-y-2 !pt-3">
                    <div className="flex !min-h-4 !items-center gap-0.5 ps-[4px]">
                      <p className="border-s-2 !ps-1.5 text-[11px] !font-bold uppercase tracking-wider leading-none text-emerald-800 border-emerald-600">Participant choices</p>
                    </div>
                    <div className="flex flex-col gap-2">
                                    {evaluateDesignerCondition(designerStore, dataContext, ({}), "store.voteEditor.activeBallotKeys.0") && (
                                      <p className="!text-xs leading-relaxed text-emerald-900/80 ps-[4px]">Choices for the selected question appear below.</p>
                                    )}
                                    {evaluateDesignerCondition(designerStore, dataContext, ({}), "!store.voteEditor.activeBallotKeys.0") && (
                                      <p className="!rounded-md border border-dashed border-emerald-200 bg-emerald-50/60 !px-3 !py-4 !text-center !text-xs !font-medium text-emerald-800">No question selected — pick a row in Questions for participants.</p>
                                    )}
                      <div className="flex !min-h-0 !min-w-0 flex-1 flex-col gap-2">
                                        {evaluateDesignerCondition(designerStore, dataContext, ({}), "store.voteEditor.activeBallotKeys.0") && (
                                          <ListPageShell className="flex min-h-0 w-full flex-1 flex-col"><ListPageToolbarFrame><div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}><input type="text" value={gridSearchInput_heroui_app_table_grid_1794316124005_jmpdp} onChange={(event) => handleGridSearchChange_heroui_app_table_grid_1794316124005_jmpdp(event.target.value)} placeholder={"Search choices…"} className="h-8 rounded-md border border-slate-200 px-2 text-sm" /></div><div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}><button type="button" onClick={() => { patchDesignerStore("selection.choiceId", null); patchDesignerStore("ui.visibility.node-993a713a-4a3a-44bd-97c1-c79f025463aa", true); }} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700">Add choice</button><span className="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold tabular-nums text-slate-700" aria-live="polite">{gridTotalCount_heroui_app_table_grid_1794316124005_jmpdp.toLocaleString()}</span><button type="button" onClick={() => { void refresh_gridData_heroui_app_table_grid_1794316124005_jmpdp(); }} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">Refresh</button></div></ListPageToolbarFrame><AppTableGrid className="flex min-h-[200px] !min-w-0 flex-[2] flex-col" showPagingFooter presentation="cards" cardBelow="tablet" size="sm" columns={gridColumns_heroui_app_table_grid_1794316124005_jmpdp} rows={gridPaging_heroui_app_table_grid_1794316124005_jmpdp.displayRows} getRowKey={(row) => String((row as Record<string, unknown>)["id"] ?? '')} enableColumnLayout={false} columnLayout={gridColumnLayout_heroui_app_table_grid_1794316124005_jmpdp} onColumnLayoutChange={setGridColumnLayout_heroui_app_table_grid_1794316124005_jmpdp} isLoading={isLoading_gridData_heroui_app_table_grid_1794316124005_jmpdp} loadingMessage={"Loading choices…"} emptyMessage={"No choices for this question yet. Use Add choice to create voter options."} isEmpty={gridAggregatedRows_heroui_app_table_grid_1794316124005_jmpdp.length === 0} errorContent={(error_gridData_heroui_app_table_grid_1794316124005_jmpdp ? "Could not load choices." : undefined)} gridQueryMode={"server"} query={gridQuery_heroui_app_table_grid_1794316124005_jmpdp} onQueryChange={handleGridQueryChange_heroui_app_table_grid_1794316124005_jmpdp} onGridRowAction={handleGridRowAction_heroui_app_table_grid_1794316124005_jmpdp} footer={<GridPagingFooter totalCount={gridTotalCount_heroui_app_table_grid_1794316124005_jmpdp} safePage={gridPaging_heroui_app_table_grid_1794316124005_jmpdp.safePage} pageSize={gridPageSize_heroui_app_table_grid_1794316124005_jmpdp} onPageSizeChange={handleGridPageSizeChange_heroui_app_table_grid_1794316124005_jmpdp} sortBy={gridQuery_heroui_app_table_grid_1794316124005_jmpdp.sort?.columnId ?? ''} sortOptions={[{"value":"displayName","label":"Choice"},{"value":"sortOrder","label":"Order"}]} onSortByChange={handleGridSortByChange_heroui_app_table_grid_1794316124005_jmpdp} sortDirection={gridQuery_heroui_app_table_grid_1794316124005_jmpdp.sort?.direction ?? 'asc'} onToggleSortDirection={handleGridToggleSortDirection_heroui_app_table_grid_1794316124005_jmpdp} showSortControls={true} totalPages={gridPaging_heroui_app_table_grid_1794316124005_jmpdp.totalPages} pageNumbers={buildDataGridPageNumbers(gridPaging_heroui_app_table_grid_1794316124005_jmpdp.safePage, gridPaging_heroui_app_table_grid_1794316124005_jmpdp.totalPages)} onPageChange={handleGridPageChange_heroui_app_table_grid_1794316124005_jmpdp} visibleInfiniteCount={gridListMode_heroui_app_table_grid_1794316124005_jmpdp === 'infinite' ? gridPaging_heroui_app_table_grid_1794316124005_jmpdp.displayRows.length : undefined} />} /></ListPageShell>
                                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex !min-h-0 !min-w-0 shrink-0 flex-col gap-2 overflow-hidden">
                  <div className="flex flex-col space-y-2 !pt-3">
                    <div className="flex !min-h-4 !items-center gap-0.5 ps-[4px]">
                      <p className="border-s-2 !ps-1.5 text-[11px] !font-bold uppercase tracking-wider leading-none text-amber-700 border-amber-400">Polling stations (Cars)</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <p className="!text-xs leading-relaxed text-amber-900/80 ps-[4px] !pb-1">Physical or logical polling locations for this voting scope (legacy Elections_Cars parity).</p>
                      <ListPageShell className="flex min-h-0 w-full flex-1 flex-col"><ListPageToolbarFrame><div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}><input type="text" value={gridSearchInput_heroui_app_table_grid_1794316124060_wa771} onChange={(event) => handleGridSearchChange_heroui_app_table_grid_1794316124060_wa771(event.target.value)} placeholder={"Search stations…"} className="h-8 rounded-md border border-slate-200 px-2 text-sm" /></div><div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}><button type="button" onClick={() => { patchDesignerStore("selection.id", null); patchDesignerStore("ui.visibility.node-b9b759f9-116a-4e6e-a30e-fd341231057d", true); }} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700">Add station</button><span className="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold tabular-nums text-slate-700" aria-live="polite">{gridTotalCount_heroui_app_table_grid_1794316124060_wa771.toLocaleString()}</span><button type="button" onClick={() => { void refresh_gridData_heroui_app_table_grid_1794316124060_wa771(); }} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">Refresh</button></div></ListPageToolbarFrame><AppTableGrid className="flex min-h-[160px] !min-w-0 flex-col" showPagingFooter presentation="table" cardBelow="tablet" size="sm" columns={gridColumns_heroui_app_table_grid_1794316124060_wa771} rows={gridPaging_heroui_app_table_grid_1794316124060_wa771.displayRows} getRowKey={(row) => String((row as Record<string, unknown>)["id"] ?? '')} enableColumnLayout={false} columnLayout={gridColumnLayout_heroui_app_table_grid_1794316124060_wa771} onColumnLayoutChange={setGridColumnLayout_heroui_app_table_grid_1794316124060_wa771} isLoading={isLoading_gridData_heroui_app_table_grid_1794316124060_wa771} loadingMessage={"Loading stations…"} emptyMessage={"No polling stations yet. Use Add station when you are ready for on-site voting."} isEmpty={gridAggregatedRows_heroui_app_table_grid_1794316124060_wa771.length === 0} errorContent={(error_gridData_heroui_app_table_grid_1794316124060_wa771 ? "Could not load stations." : undefined)} gridQueryMode={"server"} query={gridQuery_heroui_app_table_grid_1794316124060_wa771} onQueryChange={handleGridQueryChange_heroui_app_table_grid_1794316124060_wa771} onGridRowAction={handleGridRowAction_heroui_app_table_grid_1794316124060_wa771} footer={<GridPagingFooter totalCount={gridTotalCount_heroui_app_table_grid_1794316124060_wa771} safePage={gridPaging_heroui_app_table_grid_1794316124060_wa771.safePage} pageSize={gridPageSize_heroui_app_table_grid_1794316124060_wa771} onPageSizeChange={handleGridPageSizeChange_heroui_app_table_grid_1794316124060_wa771} sortBy={gridQuery_heroui_app_table_grid_1794316124060_wa771.sort?.columnId ?? ''} sortOptions={[{"value":"title","label":"Station"},{"value":"isActive","label":"Active"}]} onSortByChange={handleGridSortByChange_heroui_app_table_grid_1794316124060_wa771} sortDirection={gridQuery_heroui_app_table_grid_1794316124060_wa771.sort?.direction ?? 'asc'} onToggleSortDirection={handleGridToggleSortDirection_heroui_app_table_grid_1794316124060_wa771} showSortControls={true} totalPages={gridPaging_heroui_app_table_grid_1794316124060_wa771.totalPages} pageNumbers={buildDataGridPageNumbers(gridPaging_heroui_app_table_grid_1794316124060_wa771.safePage, gridPaging_heroui_app_table_grid_1794316124060_wa771.totalPages)} onPageChange={handleGridPageChange_heroui_app_table_grid_1794316124060_wa771} visibleInfiniteCount={gridListMode_heroui_app_table_grid_1794316124060_wa771 === 'infinite' ? gridPaging_heroui_app_table_grid_1794316124060_wa771.displayRows.length : undefined} />} /></ListPageShell>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="!min-h-0 !min-w-0 overflow-hidden">
              <div className="flex !h-full !min-h-0 flex-col gap-3 overflow-y-auto border-s border-slate-200 bg-slate-50 !px-3 !pb-4 pt-[10px]">
                <form className="space-y-3 !rounded-lg border border-default-200 bg-content1 !p-4" id="voting-scope-editor-form" onSubmit={handleonSubmit_html_form_1794316123919_wss0b} data-designer-node-id="html-form-1794316123919-wss0b">
                  <div className="flex flex-col space-y-2">
                    <div className="flex !min-h-4 !items-center gap-0.5 ps-[4px]">
                      <p className="border-s-2 !ps-1.5 text-[11px] !font-bold uppercase tracking-wider leading-none text-violet-700 border-violet-400">Scope settings</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex !min-w-0 !items-center !justify-between gap-3 overflow-hidden ps-[4px]">
                        <p className="text-[11px] !font-normal normal-case tracking-normal text-slate-500">Record id</p>
                        <p className="!min-w-0 overflow-hidden break-words text-[11px] !font-bold !rounded-md border border-violet-200 bg-violet-50/70 !px-2 !py-1.5 text-violet-900 !text-end font-mono" name="html-text-1794316123925-kj6hd">{regionData_voteVotingDetail_html_form_1794316123919_wss0b?.id ?? "Text"}</p>
                      </div>
                      <div className="flex !min-w-0 flex-col gap-[2px] overflow-hidden ps-[4px]">
                        <p className="text-[11px] !font-normal normal-case tracking-normal text-slate-500">Current status (code)</p>
                        <p className="!min-w-0 overflow-hidden break-words text-[11px] !font-bold !rounded-md border border-sky-200 bg-sky-50/70 !px-2 !py-1.5 text-sky-900" name="html-text-1794316123929-2oo2w">{regionData_voteVotingDetail_html_form_1794316123919_wss0b?.statusCode ?? "Text"}</p>
                      </div>
                      <UiInput className="!rounded-md border border-slate-300 bg-white !px-2.5 !py-px !text-xs text-slate-700" type="text" placeholder="Text input" label="Title" aria-label="Title" size="sm" value={regionData_voteVotingDetail_html_form_1794316123919_wss0b?.title} name="heroui-input-text-1794316123931-8grsz" />
                      <UiSelect className="!w-full" placeholder="Select…" label="Status" size="sm" selectedKeys={regionData_voteVotingDetail_html_form_1794316123919_wss0b?.statusCode} name="heroui-select-1794316123933-rnd5x"><option value="102.001.001">Draft</option><option value="102.001.002">Open</option><option value="102.001.003">Closed</option><option value="102.001.004">Archived</option></UiSelect>
                      <DesignerDatePickerField className="!w-full !min-w-0" value={regionData_voteVotingDetail_html_form_1794316123919_wss0b?.startsAt} name="heroui-date-picker-1794316123935-1gajf" label="Starts" placeholder="Select date" calendarSystem="gregorian" granularity="minute" hourCycle="auto" hideTimeZone={false} shouldForceLeadingZeros={true} visibleMonths={1} pageBehavior="visible" isReadOnly={false} autoFocus={false} />
                      <DesignerDatePickerField className="!w-full !min-w-0" value={regionData_voteVotingDetail_html_form_1794316123919_wss0b?.endsAt} name="heroui-date-picker-1794316123937-o107h" label="Ends" placeholder="Select date" calendarSystem="gregorian" granularity="minute" hourCycle="auto" hideTimeZone={false} shouldForceLeadingZeros={true} visibleMonths={1} pageBehavior="visible" isReadOnly={false} autoFocus={false} />
                      <UiTextarea className="!min-h-24 !rounded-md border border-slate-300 bg-white !px-2.5 !py-2 !text-xs text-slate-700" rows={4} placeholder="Text area" label="Operator note" aria-label="Operator note" size="sm" value={regionData_voteVotingDetail_html_form_1794316123919_wss0b?.operatorNote} name="heroui-textarea-1794316123939-jbw41" />
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "(store.ui.visibility.node-f53f9efe-8db5-42ea-9b94-898695065bab === true) && (store.ui.visibility.node-f53f9efe-8db5-42ea-9b94-898695065bab !== false)") && (
          <CreateEditModalShell title={"Create question"} size="lg" onClose={() => { patchDesignerStore("ui.visibility.node-f53f9efe-8db5-42ea-9b94-898695065bab", false); }} onBackdropClick={() => { patchDesignerStore("ui.visibility.node-f53f9efe-8db5-42ea-9b94-898695065bab", false); }} gradient={false} bodyOuterClassName="-mb-[15px]" bodyClassName="!p-0" footerClassName="!mt-0">
            <form className="flex !min-h-0 flex-col gap-0 bg-white" method="post" id="node-53d4ccde-414a-45cc-8029-0a8d9aa2c36e" data-designer-node-id="node-53d4ccde-414a-45cc-8029-0a8d9aa2c36e">
              <div className="flex !min-w-0 flex-col gap-2 bg-white p-[15px]">
                <UiInput isRequired className="hidden" readOnly type="text" placeholder="Voting scope" label="Voting scope" aria-label="Voting scope" size="sm" data-page-guide="" data-page-guide-title="Voting scope" data-page-guide-hint="Required. Enter voting scope." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_voteBallotsList_node_53d4ccde_414a_45cc_8029_0a8d9aa2c36e?.votingId} value={regionData_voteBallotsList_node_53d4ccde_414a_45cc_8029_0a8d9aa2c36e?.votingId} name="node-903e35fa-ee0b-4976-8fed-9e0624b6a9e8" />
                <UiInput isRequired type="text" placeholder="e.g. Choose the committee chair" label="Question / ballot title" aria-label="Question / ballot title" size="sm" data-page-guide="" data-page-guide-title="Question / ballot title" data-page-guide-hint="Required. Enter question / ballot title." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_voteBallotsList_node_53d4ccde_414a_45cc_8029_0a8d9aa2c36e?.title} name="node-4f65a6b2-c0b3-4e6e-b66c-92dcfa68174e" />
                <section className="flex flex-col gap-[2px] space-y-0">
                  <div className="space-y-1">
                    <div className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <div className="flex min-w-0 items-center gap-2 ps-[4px]">
                        <div className="flex min-w-0 items-center gap-0.5">
                          <span className="h-3.5 w-0.5 shrink-0 rounded-full bg-indigo-400" aria-hidden />
                          <h3 className="text-[11px] font-bold uppercase tracking-wider leading-none text-indigo-800">How many choices can each voter pick?</h3>
                        </div>
                      </div>
                    </div>
                  </div>
                  <RadioGroup isRequired defaultValue="single" aria-label="How many choices can each voter pick?" data-page-guide="" data-page-guide-title="How many choices can each voter pick?" data-page-guide-hint="Required. Enter how many choices can each voter pick?." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" isSelected={regionData_voteBallotsList_node_53d4ccde_414a_45cc_8029_0a8d9aa2c36e?.selectionMode} name="node-395d03bc-dd57-4f45-8b57-2dd20dd86fcd">
                    <Radio value="option-1"><Radio.Control><Radio.Indicator /></Radio.Control><Radio.Content>Option 1</Radio.Content></Radio>
                    <Radio value="option-2"><Radio.Control><Radio.Indicator /></Radio.Control><Radio.Content>Option 2</Radio.Content></Radio>
                    <Radio value="option-3"><Radio.Control><Radio.Indicator /></Radio.Control><Radio.Content>Option 3</Radio.Content></Radio>
                  </RadioGroup>
                </section>
                <UiInput type="text" placeholder="Leave empty for no limit" label="Max selections (multiple only)" aria-label="Max selections (multiple only)" size="sm" data-page-guide="" data-page-guide-title="Max selections (multiple only)" data-page-guide-hint="Enter max selections (multiple only)." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_voteBallotsList_node_53d4ccde_414a_45cc_8029_0a8d9aa2c36e?.maxSelections} name="node-466be8cc-37a6-41c5-9a42-55f14a63e475" />
                <UiInput isRequired type="text" placeholder="0" label="Display order" aria-label="Display order" size="sm" data-page-guide="" data-page-guide-title="Display order" data-page-guide-hint="Required. Enter display order." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_voteBallotsList_node_53d4ccde_414a_45cc_8029_0a8d9aa2c36e?.sortOrder} name="node-4f321202-a622-482f-b78a-12bda70103a1" />
              </div>
            </form>
            <div className="flex !w-full shrink-0 !items-center !justify-end gap-2">
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 border border-slate-200 text-slate-600 hover:bg-slate-100" variant="outline" size="md" onClick={handleonClick_node_45eb8a5b_bfb5_4318_a834_b3c680d2c751}><X className="h-3.5 w-3.5" /> Cancel</Button>
              <Button type="submit" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 bg-primary-600 hover:bg-primary-700 text-white" form="node-53d4ccde-414a-45cc-8029-0a8d9aa2c36e" variant="primary" size="md" href="#" target="_self" isDisabled={isSubmitting} onClick={handleonClick_node_e63159e0_a8da_4805_969d_800e259d1dd3}><Plus className="h-3.5 w-3.5" /> Create question</Button>
            </div>
          </CreateEditModalShell>
        )}
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "(store.ui.visibility.node-2505cd81-4f24-4e95-9a86-45d29d772103 === true) && (store.ui.visibility.node-2505cd81-4f24-4e95-9a86-45d29d772103 !== false)") && (
          <CreateEditModalShell title={"Edit question"} size="lg" onClose={() => { patchDesignerStore("ui.visibility.node-2505cd81-4f24-4e95-9a86-45d29d772103", false); }} onBackdropClick={() => { patchDesignerStore("ui.visibility.node-2505cd81-4f24-4e95-9a86-45d29d772103", false); }} gradient={false} bodyOuterClassName="-mb-[15px]" bodyClassName="!p-0" footerClassName="!mt-0">
            <form className="flex !min-h-0 flex-col gap-0 bg-white" method="post" id="node-b8715c07-6472-4c65-974c-89648e07443d" data-designer-node-id="node-b8715c07-6472-4c65-974c-89648e07443d">
              <div className="flex !min-w-0 flex-col gap-2 bg-white p-[15px]">
                <UiInput isRequired className="hidden" readOnly type="text" placeholder="Voting scope" label="Voting scope" aria-label="Voting scope" size="sm" data-page-guide="" data-page-guide-title="Voting scope" data-page-guide-hint="Required. Enter voting scope." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_voteBallotsList_node_b8715c07_6472_4c65_974c_89648e07443d?.votingId} value={regionData_voteBallotsList_node_b8715c07_6472_4c65_974c_89648e07443d?.votingId} name="node-e1a56579-ee40-4eee-a9cf-06172982a476" />
                <UiInput isRequired type="text" placeholder="e.g. Choose the committee chair" label="Question / ballot title" aria-label="Question / ballot title" size="sm" data-page-guide="" data-page-guide-title="Question / ballot title" data-page-guide-hint="Required. Enter question / ballot title." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_voteBallotsList_node_b8715c07_6472_4c65_974c_89648e07443d?.title} name="node-7781f91c-0826-43e2-8013-d089c59b0da9" />
                <section className="flex flex-col gap-[2px] space-y-0">
                  <div className="space-y-1">
                    <div className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <div className="flex min-w-0 items-center gap-2 ps-[4px]">
                        <div className="flex min-w-0 items-center gap-0.5">
                          <span className="h-3.5 w-0.5 shrink-0 rounded-full bg-indigo-400" aria-hidden />
                          <h3 className="text-[11px] font-bold uppercase tracking-wider leading-none text-indigo-800">How many choices can each voter pick?</h3>
                        </div>
                      </div>
                    </div>
                  </div>
                  <RadioGroup isRequired defaultValue="single" aria-label="How many choices can each voter pick?" data-page-guide="" data-page-guide-title="How many choices can each voter pick?" data-page-guide-hint="Required. Enter how many choices can each voter pick?." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" isSelected={regionData_voteBallotsList_node_b8715c07_6472_4c65_974c_89648e07443d?.selectionMode} name="node-901e35ea-6591-467b-bd6d-44721d672aea">
                    <Radio value="option-1"><Radio.Control><Radio.Indicator /></Radio.Control><Radio.Content>Option 1</Radio.Content></Radio>
                    <Radio value="option-2"><Radio.Control><Radio.Indicator /></Radio.Control><Radio.Content>Option 2</Radio.Content></Radio>
                    <Radio value="option-3"><Radio.Control><Radio.Indicator /></Radio.Control><Radio.Content>Option 3</Radio.Content></Radio>
                  </RadioGroup>
                </section>
                <UiInput type="text" placeholder="Leave empty for no limit" label="Max selections (multiple only)" aria-label="Max selections (multiple only)" size="sm" data-page-guide="" data-page-guide-title="Max selections (multiple only)" data-page-guide-hint="Enter max selections (multiple only)." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_voteBallotsList_node_b8715c07_6472_4c65_974c_89648e07443d?.maxSelections} name="node-350ec2c6-0860-4cc9-91f9-f99342db075b" />
                <UiInput isRequired type="text" placeholder="0" label="Display order" aria-label="Display order" size="sm" data-page-guide="" data-page-guide-title="Display order" data-page-guide-hint="Required. Enter display order." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_voteBallotsList_node_b8715c07_6472_4c65_974c_89648e07443d?.sortOrder} name="node-35c39e5a-6ef0-4b16-b3c8-773bb51da218" />
              </div>
            </form>
            <div className="flex !w-full shrink-0 !items-center !justify-end gap-2">
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 border border-slate-200 text-slate-600 hover:bg-slate-100" variant="outline" size="md" onClick={handleonClick_node_43124754_a680_4bfe_89fe_65fba16a52bc}><X className="h-3.5 w-3.5" /> Cancel</Button>
              <Button type="submit" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 bg-primary-600 hover:bg-primary-700 text-white" form="node-b8715c07-6472-4c65-974c-89648e07443d" variant="primary" size="md" href="#" target="_self" isDisabled={isSubmitting} onClick={handleonClick_node_3fe28dc2_55b3_4bb3_8b6f_fce7294bade9}><Save className="h-3.5 w-3.5" /> Save</Button>
            </div>
          </CreateEditModalShell>
        )}
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "(store.ui.visibility.node-13e6bd03-8adb-4d58-adc9-3605690caaef === true) && (store.ui.visibility.node-13e6bd03-8adb-4d58-adc9-3605690caaef !== false)") && (
          <ConfirmDialogShell title={"Delete question?"} size="sm" onClose={() => { patchDesignerStore("ui.visibility.node-13e6bd03-8adb-4d58-adc9-3605690caaef", false); }} onBackdropClick={() => { patchDesignerStore("ui.visibility.node-13e6bd03-8adb-4d58-adc9-3605690caaef", false); }} tone="danger" hideCancel hideConfirm icon={<Trash2 className="h-4 w-4" />} bodyClassName="!p-0" footerClassName="!mt-0">
            <p className="block p-[15px] !text-sm text-slate-700">Delete this question? This cannot be undone.</p>
            <div className="flex !w-full shrink-0 !items-center !justify-end gap-2">
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 border border-slate-200 text-slate-600 hover:bg-slate-100" variant="outline" size="md" onClick={handleonClick_node_35895677_50ca_48e7_845f_f31858c94b26}><X className="h-3.5 w-3.5" /> Cancel</Button>
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 bg-rose-600 hover:bg-rose-700 text-white" variant="primary" size="md" onClick={handleonClick_node_03c21b6a_6d57_4a41_af42_e5dbe682410a}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
            </div>
          </ConfirmDialogShell>
        )}
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "(store.voteEditor.activeBallotKeys.0) && (store.ui.visibility.node-993a713a-4a3a-44bd-97c1-c79f025463aa !== false)") && (
          <CreateEditModalShell title={"Create choice"} size="lg" onClose={() => { patchDesignerStore("ui.visibility.node-993a713a-4a3a-44bd-97c1-c79f025463aa", false); }} onBackdropClick={() => { patchDesignerStore("ui.visibility.node-993a713a-4a3a-44bd-97c1-c79f025463aa", false); }} gradient={false} bodyOuterClassName="-mb-[15px]" bodyClassName="!p-0" footerClassName="!mt-0">
            <form className="flex !min-h-0 flex-col gap-0 bg-white" method="post" id="node-d9d81289-915a-49b7-8536-c4a7e8839857" data-designer-node-id="node-d9d81289-915a-49b7-8536-c4a7e8839857">
              <div className="flex !min-w-0 flex-col gap-2 bg-white p-[15px]">
                <UiInput isRequired className="hidden" readOnly type="text" placeholder="Voting scope" label="Voting scope" aria-label="Voting scope" size="sm" data-page-guide="" data-page-guide-title="Voting scope" data-page-guide-hint="Required. Enter voting scope." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_voteCandidatesList_node_d9d81289_915a_49b7_8536_c4a7e8839857?.votingId} value={regionData_voteCandidatesList_node_d9d81289_915a_49b7_8536_c4a7e8839857?.votingId} name="node-880128c4-d9a5-48b8-8a22-a5224f6567c2" />
                <UiInput isRequired className="hidden" readOnly type="text" placeholder="Question" label="Question" aria-label="Question" size="sm" data-page-guide="" data-page-guide-title="Question" data-page-guide-hint="Required. Enter question." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_voteCandidatesList_node_d9d81289_915a_49b7_8536_c4a7e8839857?.ballotId} value={regionData_voteCandidatesList_node_d9d81289_915a_49b7_8536_c4a7e8839857?.ballotId} name="node-38722b55-6593-400d-8530-e3f504a4822c" />
                <UiInput isRequired type="text" placeholder="e.g. Option A — Dr. Sara Ahmadi" label="Choice label (what voters see)" aria-label="Choice label (what voters see)" size="sm" data-page-guide="" data-page-guide-title="Choice label (what voters see)" data-page-guide-hint="Required. Enter choice label (what voters see)." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_voteCandidatesList_node_d9d81289_915a_49b7_8536_c4a7e8839857?.displayName} name="node-b79002b8-5172-474a-b1fb-4ee5c4593277" />
                <UiInput isRequired type="text" placeholder="0" label="Display order" aria-label="Display order" size="sm" data-page-guide="" data-page-guide-title="Display order" data-page-guide-hint="Required. Enter display order." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_voteCandidatesList_node_d9d81289_915a_49b7_8536_c4a7e8839857?.sortOrder} name="node-6578a8db-65d5-40e8-95b7-c6b03210da5e" />
              </div>
            </form>
            <div className="flex !w-full shrink-0 !items-center !justify-end gap-2">
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 border border-slate-200 text-slate-600 hover:bg-slate-100" variant="outline" size="md" onClick={handleonClick_node_ad6d75d4_bbc8_402e_8ea6_f85c90500b3f}><X className="h-3.5 w-3.5" /> Cancel</Button>
              <Button type="submit" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 bg-primary-600 hover:bg-primary-700 text-white" form="node-d9d81289-915a-49b7-8536-c4a7e8839857" variant="primary" size="md" href="#" target="_self" isDisabled={isSubmitting} onClick={handleonClick_node_a6ed3016_c97e_4d59_827a_04062ebd3e1e}><Plus className="h-3.5 w-3.5" /> Create choice</Button>
            </div>
          </CreateEditModalShell>
        )}
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "(store.ui.visibility.node-d496d557-9e25-41ca-a0c7-c5861acb91a3 === true) && (store.ui.visibility.node-d496d557-9e25-41ca-a0c7-c5861acb91a3 !== false)") && (
          <CreateEditModalShell title={"Edit choice"} size="lg" onClose={() => { patchDesignerStore("ui.visibility.node-d496d557-9e25-41ca-a0c7-c5861acb91a3", false); }} onBackdropClick={() => { patchDesignerStore("ui.visibility.node-d496d557-9e25-41ca-a0c7-c5861acb91a3", false); }} gradient={false} bodyOuterClassName="-mb-[15px]" bodyClassName="!p-0" footerClassName="!mt-0">
            <form className="flex !min-h-0 flex-col gap-0 bg-white" method="post" id="node-e1eaed1e-9bc8-43b8-8201-ff0dc11132ec" data-designer-node-id="node-e1eaed1e-9bc8-43b8-8201-ff0dc11132ec">
              <div className="flex !min-w-0 flex-col gap-2 bg-white p-[15px]">
                <UiInput isRequired className="hidden" readOnly type="text" placeholder="Voting scope" label="Voting scope" aria-label="Voting scope" size="sm" data-page-guide="" data-page-guide-title="Voting scope" data-page-guide-hint="Required. Enter voting scope." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_voteCandidatesList_node_e1eaed1e_9bc8_43b8_8201_ff0dc11132ec?.votingId} value={regionData_voteCandidatesList_node_e1eaed1e_9bc8_43b8_8201_ff0dc11132ec?.votingId} name="node-f9341a42-a3f3-4164-a534-3808ca048434" />
                <UiInput isRequired className="hidden" readOnly type="text" placeholder="Question" label="Question" aria-label="Question" size="sm" data-page-guide="" data-page-guide-title="Question" data-page-guide-hint="Required. Enter question." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_voteCandidatesList_node_e1eaed1e_9bc8_43b8_8201_ff0dc11132ec?.ballotId} name="node-361ebb66-295d-413a-9ff9-a1f521510c4b" />
                <UiInput isRequired type="text" placeholder="e.g. Option A — Dr. Sara Ahmadi" label="Choice label (what voters see)" aria-label="Choice label (what voters see)" size="sm" data-page-guide="" data-page-guide-title="Choice label (what voters see)" data-page-guide-hint="Required. Enter choice label (what voters see)." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_voteCandidatesList_node_e1eaed1e_9bc8_43b8_8201_ff0dc11132ec?.displayName} name="node-ee32f5b5-300b-4490-b884-0b357dba1dd7" />
                <UiInput isRequired type="text" placeholder="0" label="Display order" aria-label="Display order" size="sm" data-page-guide="" data-page-guide-title="Display order" data-page-guide-hint="Required. Enter display order." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_voteCandidatesList_node_e1eaed1e_9bc8_43b8_8201_ff0dc11132ec?.sortOrder} name="node-705c8465-4e99-4cc5-b8e3-f5c4e8301af1" />
              </div>
            </form>
            <div className="flex !w-full shrink-0 !items-center !justify-end gap-2">
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 border border-slate-200 text-slate-600 hover:bg-slate-100" variant="outline" size="md" onClick={handleonClick_node_536cf237_419e_485a_9ba6_9604387d2905}><X className="h-3.5 w-3.5" /> Cancel</Button>
              <Button type="submit" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 bg-primary-600 hover:bg-primary-700 text-white" form="node-e1eaed1e-9bc8-43b8-8201-ff0dc11132ec" variant="primary" size="md" href="#" target="_self" isDisabled={isSubmitting} onClick={handleonClick_node_9b6688b9_3b25_4238_adc1_19303ec55de4}><Save className="h-3.5 w-3.5" /> Save</Button>
            </div>
          </CreateEditModalShell>
        )}
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "(store.ui.visibility.node-67b3fbbb-ca30-44c2-8f34-b804d832d599 === true) && (store.ui.visibility.node-67b3fbbb-ca30-44c2-8f34-b804d832d599 !== false)") && (
          <ConfirmDialogShell title={"Delete choice?"} size="sm" onClose={() => { patchDesignerStore("ui.visibility.node-67b3fbbb-ca30-44c2-8f34-b804d832d599", false); }} onBackdropClick={() => { patchDesignerStore("ui.visibility.node-67b3fbbb-ca30-44c2-8f34-b804d832d599", false); }} tone="danger" hideCancel hideConfirm icon={<Trash2 className="h-4 w-4" />} bodyClassName="!p-0" footerClassName="!mt-0">
            <p className="block p-[15px] !text-sm text-slate-700">Delete this choice? This cannot be undone.</p>
            <div className="flex !w-full shrink-0 !items-center !justify-end gap-2">
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 border border-slate-200 text-slate-600 hover:bg-slate-100" variant="outline" size="md" onClick={handleonClick_node_1f0c98d3_43f1_4fc7_8d23_03ec954ed71c}><X className="h-3.5 w-3.5" /> Cancel</Button>
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 bg-rose-600 hover:bg-rose-700 text-white" variant="primary" size="md" onClick={handleonClick_node_5902248c_e659_49c6_9374_6afe22122b6b}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
            </div>
          </ConfirmDialogShell>
        )}
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "(store.ui.visibility.node-b9b759f9-116a-4e6e-a30e-fd341231057d === true) && (store.ui.visibility.node-b9b759f9-116a-4e6e-a30e-fd341231057d !== false)") && (
          <CreateEditModalShell title={"Create station"} size="lg" onClose={() => { patchDesignerStore("ui.visibility.node-b9b759f9-116a-4e6e-a30e-fd341231057d", false); }} onBackdropClick={() => { patchDesignerStore("ui.visibility.node-b9b759f9-116a-4e6e-a30e-fd341231057d", false); }} gradient={false} bodyOuterClassName="-mb-[15px]" bodyClassName="!p-0" footerClassName="!mt-0">
            <form className="flex !min-h-0 flex-col gap-0 bg-white" method="post" id="node-44ae1fe2-5d21-4dc4-a4db-2071b90868ab" data-designer-node-id="node-44ae1fe2-5d21-4dc4-a4db-2071b90868ab">
              <div className="flex !min-w-0 flex-col gap-2 bg-white p-[15px]">
                <UiInput isRequired className="hidden" readOnly type="text" placeholder="Voting scope" label="Voting scope" aria-label="Voting scope" size="sm" data-page-guide="" data-page-guide-title="Voting scope" data-page-guide-hint="Required. Enter voting scope." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_votePollingStationsList_node_44ae1fe2_5d21_4dc4_a4db_2071b90868ab?.votingId} value={regionData_votePollingStationsList_node_44ae1fe2_5d21_4dc4_a4db_2071b90868ab?.votingId} name="node-21bd7fd7-f593-4ffb-8d50-3fc3863d208b" />
                <UiInput isRequired type="text" placeholder="e.g. Central hall — district 3" label="Station title" aria-label="Station title" size="sm" data-page-guide="" data-page-guide-title="Station title" data-page-guide-hint="Required. Enter station title." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_votePollingStationsList_node_44ae1fe2_5d21_4dc4_a4db_2071b90868ab?.title} name="node-2250f71f-d1a3-492c-a98b-d91a9fad621d" />
                <Switch aria-label="Active" size="md" data-page-guide="" data-page-guide-title="Active" data-page-guide-hint="Turn active on or off." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" isSelected={regionData_votePollingStationsList_node_44ae1fe2_5d21_4dc4_a4db_2071b90868ab?.isActive} name="node-342a157f-e49a-496b-b31e-ba1af601dfe5"><Switch.Content className="flex items-center gap-2"><Switch.Control><Switch.Thumb /></Switch.Control><span className="text-xs font-semibold text-slate-700">Active</span></Switch.Content></Switch>
                <UiTextarea rows={3} placeholder="Operator note" label="Operator note" aria-label="Operator note" size="sm" data-page-guide="" data-page-guide-title="Operator note" data-page-guide-hint="Enter operator note." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_votePollingStationsList_node_44ae1fe2_5d21_4dc4_a4db_2071b90868ab?.operatorNote} name="node-6c2ac0df-6419-4129-8580-9320d3163b28" />
              </div>
            </form>
            <div className="flex !w-full shrink-0 !items-center !justify-end gap-2">
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 border border-slate-200 text-slate-600 hover:bg-slate-100" variant="outline" size="md" onClick={handleonClick_node_c8e4869e_2d96_4a79_9c21_6faa84c583c7}><X className="h-3.5 w-3.5" /> Cancel</Button>
              <Button type="submit" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 bg-primary-600 hover:bg-primary-700 text-white" form="node-44ae1fe2-5d21-4dc4-a4db-2071b90868ab" variant="primary" size="md" href="#" target="_self" isDisabled={isSubmitting} onClick={handleonClick_node_4212700e_21fb_4b41_bf68_a14aee631bec}><Plus className="h-3.5 w-3.5" /> Create station</Button>
            </div>
          </CreateEditModalShell>
        )}
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "(store.ui.visibility.node-f5a37c74-b666-4402-8aee-55a655d248d2 === true) && (store.ui.visibility.node-f5a37c74-b666-4402-8aee-55a655d248d2 !== false)") && (
          <CreateEditModalShell title={"Edit station"} size="lg" onClose={() => { patchDesignerStore("ui.visibility.node-f5a37c74-b666-4402-8aee-55a655d248d2", false); }} onBackdropClick={() => { patchDesignerStore("ui.visibility.node-f5a37c74-b666-4402-8aee-55a655d248d2", false); }} gradient={false} bodyOuterClassName="-mb-[15px]" bodyClassName="!p-0" footerClassName="!mt-0">
            <form className="flex !min-h-0 flex-col gap-0 bg-white" method="post" id="node-b1271bc9-70e7-40b2-9701-74d62bd4067d" data-designer-node-id="node-b1271bc9-70e7-40b2-9701-74d62bd4067d">
              <div className="flex !min-w-0 flex-col gap-2 bg-white p-[15px]">
                <UiInput isRequired className="hidden" readOnly type="text" placeholder="Voting scope" label="Voting scope" aria-label="Voting scope" size="sm" data-page-guide="" data-page-guide-title="Voting scope" data-page-guide-hint="Required. Enter voting scope." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_votePollingStationsList_node_b1271bc9_70e7_40b2_9701_74d62bd4067d?.votingId} value={regionData_votePollingStationsList_node_b1271bc9_70e7_40b2_9701_74d62bd4067d?.votingId} name="node-8eefcfde-5c5b-4e5d-b52a-6bd4338ca112" />
                <UiInput isRequired type="text" placeholder="e.g. Central hall — district 3" label="Station title" aria-label="Station title" size="sm" data-page-guide="" data-page-guide-title="Station title" data-page-guide-hint="Required. Enter station title." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_votePollingStationsList_node_b1271bc9_70e7_40b2_9701_74d62bd4067d?.title} name="node-64262d18-0b37-4306-b864-7d085441ed88" />
                <Switch aria-label="Active" size="md" data-page-guide="" data-page-guide-title="Active" data-page-guide-hint="Turn active on or off." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" isSelected={regionData_votePollingStationsList_node_b1271bc9_70e7_40b2_9701_74d62bd4067d?.isActive} name="node-e4b847d0-cb4b-4214-80cc-da08a65629f6"><Switch.Content className="flex items-center gap-2"><Switch.Control><Switch.Thumb /></Switch.Control><span className="text-xs font-semibold text-slate-700">Active</span></Switch.Content></Switch>
                <UiTextarea rows={3} placeholder="Operator note" label="Operator note" aria-label="Operator note" size="sm" data-page-guide="" data-page-guide-title="Operator note" data-page-guide-hint="Enter operator note." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_votePollingStationsList_node_b1271bc9_70e7_40b2_9701_74d62bd4067d?.operatorNote} name="node-95b678dc-d248-4cc6-8053-7033249398a9" />
              </div>
            </form>
            <div className="flex !w-full shrink-0 !items-center !justify-end gap-2">
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 border border-slate-200 text-slate-600 hover:bg-slate-100" variant="outline" size="md" onClick={handleonClick_node_f1e1d736_1ee3_4cb0_afe2_27fbd5962cac}><X className="h-3.5 w-3.5" /> Cancel</Button>
              <Button type="submit" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 bg-primary-600 hover:bg-primary-700 text-white" form="node-b1271bc9-70e7-40b2-9701-74d62bd4067d" variant="primary" size="md" href="#" target="_self" isDisabled={isSubmitting} onClick={handleonClick_node_36aaa2ff_a4a1_4cec_a872_96fdaa316f97}><Save className="h-3.5 w-3.5" /> Save</Button>
            </div>
          </CreateEditModalShell>
        )}
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "(store.ui.visibility.node-218c9cd5-dee9-4d02-b0be-bdc06654b6c2 === true) && (store.ui.visibility.node-218c9cd5-dee9-4d02-b0be-bdc06654b6c2 !== false)") && (
          <ConfirmDialogShell title={"Delete station?"} size="sm" onClose={() => { patchDesignerStore("ui.visibility.node-218c9cd5-dee9-4d02-b0be-bdc06654b6c2", false); }} onBackdropClick={() => { patchDesignerStore("ui.visibility.node-218c9cd5-dee9-4d02-b0be-bdc06654b6c2", false); }} tone="danger" hideCancel hideConfirm icon={<Trash2 className="h-4 w-4" />} bodyClassName="!p-0" footerClassName="!mt-0">
            <p className="block p-[15px] !text-sm text-slate-700">Delete this station? This cannot be undone.</p>
            <div className="flex !w-full shrink-0 !items-center !justify-end gap-2">
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 border border-slate-200 text-slate-600 hover:bg-slate-100" variant="outline" size="md" onClick={handleonClick_node_372239f4_6a69_4f5c_b448_e8687f1d0b7e}><X className="h-3.5 w-3.5" /> Cancel</Button>
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 bg-rose-600 hover:bg-rose-700 text-white" variant="primary" size="md" onClick={handleonClick_node_46ef38af_0273_4cb1_95a4_49f6e8c684e1}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
            </div>
          </ConfirmDialogShell>
        )}
      </div>
    </>
  );
};
