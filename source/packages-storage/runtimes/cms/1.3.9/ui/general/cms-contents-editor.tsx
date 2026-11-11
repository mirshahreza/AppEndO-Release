import React from 'react';
import { useNavigate } from 'react-router-dom';
import { buildAppTableGridColumns } from '@/domain/component-designer/DesignerRuntimeAppTableGrid';
import { applyClientGridQuery, EMPTY_GRID_QUERY, type GridQueryState } from '@/shared/lib/appTableGridQuery';
import { resolveDataGridTotalCount, sliceDataGridRowsForDisplay, buildDataGridPageNumbers, applyGridAggregation } from '@/domain/component-designer/designerDataGridRuntime';
import { applyDesignerGridToolbarClientFilters } from '@/domain/component-designer/designerGridToolbarConfig';
import { createDefaultColumnLayout } from '@/shared/lib/appTableGridColumnLayout';
import { validateDesignerFieldNode } from '@/domain/component-designer/previewFieldValidation';
import { DesignerCmsContentAssetsField } from '@/domain/component-designer/DesignerCmsContentAssetsField';
import { DesignerRelatedContentsListField } from '@/domain/component-designer/DesignerRelatedContentsListField';
import { DesignerRelationTagsListField } from '@/domain/component-designer/DesignerRelationTagsListField';
import { DesignerRuntimeContentStatusPicker } from '@/domain/component-designer/DesignerRuntimeContentStatusPicker';
import { AppTableGrid, ConfirmDialogShell, CreateEditModalShell, GridPagingFooter, ToolbarFilterSelect, UiCheckbox } from '@/shared/ui';
import { WorkspaceBackIcon } from '@/shared/ui';
import { DesignerHtmlEditorField, DesignerMarkdownEditorField } from '@/shared/ui/DesignerFormFields';
import { UiInput, UiSelect, UiTextarea } from '@/shared/ui/HeroFieldControls';
import { Button, Toast, toast } from '@heroui/react';
import { Check, CircleDot, Globe, MessageSquare, Pencil, Plus, RefreshCw, Save, SlidersHorizontal, Trash2, Upload, X } from 'lucide-react';

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
  const { data: dataContext, isLoading: isHydrating, error: fetchError, refresh: refreshDataContext } = useDataFetch<Record<string, unknown> | null>("/api/base-info/options?root=101.001&lang=en", {});
  const { data: fetchData_1, isLoading: isHydrating_1, error: fetchError_1, refresh: refreshFetch_1 } = useDataFetch<Record<string, unknown> | null>("/api/base-info/options?root=101.004&lang=en", {});
  const { data: raw_regionData_cmsContents_layout_flex_row_1789450111450_ovw0o, isLoading: isLoading_regionData_cmsContents_layout_flex_row_1789450111450_ovw0o, error: error_regionData_cmsContents_layout_flex_row_1789450111450_ovw0o, refresh: refresh_regionData_cmsContents_layout_flex_row_1789450111450_ovw0o } = useDataFetch<unknown>(resolveBindingUrl("/api/cms/contents/:id", designerStore, { "id": "routeParams.id" }), {});
  const regionData_cmsContents_layout_flex_row_1789450111450_ovw0o = React.useMemo(() => coerceApiRecordValue(applyResponseDataPath(raw_regionData_cmsContents_layout_flex_row_1789450111450_ovw0o, {"dataPath":"data","arrayPath":"data","totalPath":"count"})), [raw_regionData_cmsContents_layout_flex_row_1789450111450_ovw0o]);
  const { data: raw_regionData_cmsContents_html_form_1789450111494_qf1gy, isLoading: isLoading_regionData_cmsContents_html_form_1789450111494_qf1gy, error: error_regionData_cmsContents_html_form_1789450111494_qf1gy, refresh: refresh_regionData_cmsContents_html_form_1789450111494_qf1gy } = useDataFetch<unknown>(resolveBindingUrl("/api/cms/contents/:id", designerStore, { "id": "routeParams.id" }), {});
  const regionData_cmsContents_html_form_1789450111494_qf1gy = React.useMemo(() => coerceApiRecordValue(applyResponseDataPath(raw_regionData_cmsContents_html_form_1789450111494_qf1gy, {"dataPath":"data","arrayPath":"data","totalPath":"count"})), [raw_regionData_cmsContents_html_form_1789450111494_qf1gy]);
  const { data: raw_regionData_cmsContents_html_form_1789450111593_zd0bw, isLoading: isLoading_regionData_cmsContents_html_form_1789450111593_zd0bw, error: error_regionData_cmsContents_html_form_1789450111593_zd0bw, refresh: refresh_regionData_cmsContents_html_form_1789450111593_zd0bw } = useDataFetch<unknown>(resolveBindingUrl("/api/cms/contents/:id", designerStore, { "id": "routeParams.id" }), {});
  const regionData_cmsContents_html_form_1789450111593_zd0bw = React.useMemo(() => coerceApiRecordValue(applyResponseDataPath(raw_regionData_cmsContents_html_form_1789450111593_zd0bw, {"dataPath":"data","arrayPath":"data","totalPath":"count"})), [raw_regionData_cmsContents_html_form_1789450111593_zd0bw]);
  const { data: raw_regionData_cmsContents_html_form_1789450111661_toah3, isLoading: isLoading_regionData_cmsContents_html_form_1789450111661_toah3, error: error_regionData_cmsContents_html_form_1789450111661_toah3, refresh: refresh_regionData_cmsContents_html_form_1789450111661_toah3 } = useDataFetch<unknown>(resolveBindingUrl("/api/cms/contents/:id", designerStore, { "id": "routeParams.id" }), {});
  const regionData_cmsContents_html_form_1789450111661_toah3 = React.useMemo(() => coerceApiRecordValue(applyResponseDataPath(raw_regionData_cmsContents_html_form_1789450111661_toah3, {"dataPath":"data","arrayPath":"data","totalPath":"count"})), [raw_regionData_cmsContents_html_form_1789450111661_toah3]);
  const { data: raw_regionData_cmsContents_html_form_1789450111826_ou8ea, isLoading: isLoading_regionData_cmsContents_html_form_1789450111826_ou8ea, error: error_regionData_cmsContents_html_form_1789450111826_ou8ea, refresh: refresh_regionData_cmsContents_html_form_1789450111826_ou8ea } = useDataFetch<unknown>(resolveBindingUrl("/api/cms/contents/:id", designerStore, { "id": "routeParams.id" }), {});
  const regionData_cmsContents_html_form_1789450111826_ou8ea = React.useMemo(() => coerceApiRecordValue(applyResponseDataPath(raw_regionData_cmsContents_html_form_1789450111826_ou8ea, {"dataPath":"data","arrayPath":"data","totalPath":"count"})), [raw_regionData_cmsContents_html_form_1789450111826_ou8ea]);
  const { data: raw_regionData_cmsContents_html_form_1789450111873_k1gab, isLoading: isLoading_regionData_cmsContents_html_form_1789450111873_k1gab, error: error_regionData_cmsContents_html_form_1789450111873_k1gab, refresh: refresh_regionData_cmsContents_html_form_1789450111873_k1gab } = useDataFetch<unknown>(resolveBindingUrl("/api/cms/contents/:id", designerStore, { "id": "routeParams.id" }), {});
  const regionData_cmsContents_html_form_1789450111873_k1gab = React.useMemo(() => coerceApiRecordValue(applyResponseDataPath(raw_regionData_cmsContents_html_form_1789450111873_k1gab, {"dataPath":"data","arrayPath":"data","totalPath":"count"})), [raw_regionData_cmsContents_html_form_1789450111873_k1gab]);
  const { data: raw_regionData_cmsContents_node_5a32780c_ac4e_472a_a412_e47f560f21a8, isLoading: isLoading_regionData_cmsContents_node_5a32780c_ac4e_472a_a412_e47f560f21a8, error: error_regionData_cmsContents_node_5a32780c_ac4e_472a_a412_e47f560f21a8, refresh: refresh_regionData_cmsContents_node_5a32780c_ac4e_472a_a412_e47f560f21a8 } = useDataFetch<unknown>(resolveBindingUrl("/api/cms/contents/:id", designerStore, { "id": "routeParams.id" }), {});
  const regionData_cmsContents_node_5a32780c_ac4e_472a_a412_e47f560f21a8 = React.useMemo(() => coerceApiRecordValue(applyResponseDataPath(raw_regionData_cmsContents_node_5a32780c_ac4e_472a_a412_e47f560f21a8, {"dataPath":"data","arrayPath":"data","totalPath":"count"})), [raw_regionData_cmsContents_node_5a32780c_ac4e_472a_a412_e47f560f21a8]);
  const { data: raw_regionData_cmsContents_node_25bf5fda_f269_497e_ac69_9425762963d1, isLoading: isLoading_regionData_cmsContents_node_25bf5fda_f269_497e_ac69_9425762963d1, error: error_regionData_cmsContents_node_25bf5fda_f269_497e_ac69_9425762963d1, refresh: refresh_regionData_cmsContents_node_25bf5fda_f269_497e_ac69_9425762963d1 } = useDataFetch<unknown>(resolveBindingUrl("/api/cms/contents/:id", designerStore, { "id": "routeParams.id" }), {});
  const regionData_cmsContents_node_25bf5fda_f269_497e_ac69_9425762963d1 = React.useMemo(() => coerceApiRecordValue(applyResponseDataPath(raw_regionData_cmsContents_node_25bf5fda_f269_497e_ac69_9425762963d1, {"dataPath":"data","arrayPath":"data","totalPath":"count"})), [raw_regionData_cmsContents_node_25bf5fda_f269_497e_ac69_9425762963d1]);
  const { data: raw_regionData_cmsContents_node_7aa755e3_9d44_4f35_b5c5_0b90b63c80f9, isLoading: isLoading_regionData_cmsContents_node_7aa755e3_9d44_4f35_b5c5_0b90b63c80f9, error: error_regionData_cmsContents_node_7aa755e3_9d44_4f35_b5c5_0b90b63c80f9, refresh: refresh_regionData_cmsContents_node_7aa755e3_9d44_4f35_b5c5_0b90b63c80f9 } = useDataFetch<unknown>(resolveBindingUrl("/api/cms/contents/:id", designerStore, { "id": "routeParams.id" }), {});
  const regionData_cmsContents_node_7aa755e3_9d44_4f35_b5c5_0b90b63c80f9 = React.useMemo(() => coerceApiRecordValue(applyResponseDataPath(raw_regionData_cmsContents_node_7aa755e3_9d44_4f35_b5c5_0b90b63c80f9, {"dataPath":"data","arrayPath":"data","totalPath":"count"})), [raw_regionData_cmsContents_node_7aa755e3_9d44_4f35_b5c5_0b90b63c80f9]);
  const { data: raw_regionData_cmsContents_node_46bbe401_a0f2_4fab_affc_9c69baff1d13, isLoading: isLoading_regionData_cmsContents_node_46bbe401_a0f2_4fab_affc_9c69baff1d13, error: error_regionData_cmsContents_node_46bbe401_a0f2_4fab_affc_9c69baff1d13, refresh: refresh_regionData_cmsContents_node_46bbe401_a0f2_4fab_affc_9c69baff1d13 } = useDataFetch<unknown>(resolveBindingUrl("/api/cms/contents/:id", designerStore, { "id": "routeParams.id" }), {});
  const regionData_cmsContents_node_46bbe401_a0f2_4fab_affc_9c69baff1d13 = React.useMemo(() => coerceApiRecordValue(applyResponseDataPath(raw_regionData_cmsContents_node_46bbe401_a0f2_4fab_affc_9c69baff1d13, {"dataPath":"data","arrayPath":"data","totalPath":"count"})), [raw_regionData_cmsContents_node_46bbe401_a0f2_4fab_affc_9c69baff1d13]);
  const handleGridRowAction_heroui_app_table_grid_1789450111438_zfqcp = React.useCallback((row: Record<string, unknown>, actionId: string) => {
    switch (actionId) {
      case "approve": {
        patchDesignerStore("selection.id", row["id"] ?? null);
        patchDesignerStore("ui.visibility.node-61babeab-eb4b-4a71-8a43-463afb75b303", true);
        return;
      }
      case "reject": {
        patchDesignerStore("selection.id", row["id"] ?? null);
        patchDesignerStore("ui.visibility.node-4860d3e1-188b-4205-b757-34103645158e", true);
        return;
      }
      case "delete": {
        patchDesignerStore("selection.id", row["id"] ?? null);
        patchDesignerStore("ui.visibility.node-e0ce84fc-5f53-4b84-8212-9ad4621b8493", true);
        return;
      }
      default:
        return;
    }
  }, [patchDesignerStore]);
  const handleGridRowAction_heroui_app_table_grid_1789450111752_x73vl = React.useCallback((row: Record<string, unknown>, actionId: string) => {
    switch (actionId) {
      case "delete": {
        patchDesignerStore("selection.id", row["id"] ?? null);
        patchDesignerStore("ui.visibility.node-a2b0c03b-81d1-40fa-a5fb-18df18d78d74", true);
        return;
      }
      default:
        return;
    }
  }, [patchDesignerStore]);
  const handleGridCellClick_heroui_app_table_grid_1789450111438_zfqcp = React.useCallback(async (row: Record<string, unknown>, column: { key?: string; id?: string }) => {
    const columnKey = String(column.key ?? column.id ?? '');
    switch (columnKey) {
      case "statusCode": {
        patchDesignerStore("selection.id", row["id"] ?? null);
        patchDesignerStore("ui.visibility.node-4b8f1231-4d32-4264-8a16-1de2270f856c", true);
        return;
      }
      default:
        return;
    }
  }, [patchDesignerStore, handleGridRowAction_heroui_app_table_grid_1789450111438_zfqcp]);
  const { data: raw_gridData_heroui_app_table_grid_1789450111438_zfqcp, isLoading: isLoading_gridData_heroui_app_table_grid_1789450111438_zfqcp, error: error_gridData_heroui_app_table_grid_1789450111438_zfqcp, refresh: refresh_gridData_heroui_app_table_grid_1789450111438_zfqcp } = useDataFetch<unknown>(resolveBindingUrl("/api/cms/contents", designerStore, { "search": "gridToolbar.search", "sortBy": "gridQuery.sortBy", "sortDir": "gridQuery.sortDir", "page": "gridQuery.page", "pageSize": "gridQuery.pageSize", "where": "gridToolbar.listWhere", "filter[body][like]": "gridQuery.filters.body", "view": "static:summary", "filter[parentContentId][eq]": "routeParams.id", "filter[contentTypeCode][eq]": "static:101.001.005" }), {});
  const gridData_heroui_app_table_grid_1789450111438_zfqcp = React.useMemo(() => applyResponseDataPath(raw_gridData_heroui_app_table_grid_1789450111438_zfqcp, {"dataPath":"data","arrayPath":"data","totalPath":"count"}), [raw_gridData_heroui_app_table_grid_1789450111438_zfqcp]);
  const { data: raw_gridData_heroui_app_table_grid_1789450111752_x73vl, isLoading: isLoading_gridData_heroui_app_table_grid_1789450111752_x73vl, error: error_gridData_heroui_app_table_grid_1789450111752_x73vl, refresh: refresh_gridData_heroui_app_table_grid_1789450111752_x73vl } = useDataFetch<unknown>(resolveBindingUrl("/api/cms/relations", designerStore, { "sortBy": "gridQuery.sortBy", "sortDir": "gridQuery.sortDir", "page": "gridQuery.page", "pageSize": "gridQuery.pageSize", "filter[contentIdA][eq]": "routeParams.id" }), {});
  const gridData_heroui_app_table_grid_1789450111752_x73vl = React.useMemo(() => applyResponseDataPath(raw_gridData_heroui_app_table_grid_1789450111752_x73vl, {"dataPath":"data","arrayPath":"data","totalPath":"count"}), [raw_gridData_heroui_app_table_grid_1789450111752_x73vl]);
  const gridColumns_heroui_app_table_grid_1789450111438_zfqcp = React.useMemo(() => buildAppTableGridColumns([{"key":"body","label":"Comment","sort":true,"filter":true,"filterType":"text","cardRole":"title"},{"key":"authorDisplayName","label":"Author","sort":true,"cardRole":"field"},{"key":"statusCode","label":"Status","sort":true,"cellKind":"status-badge","cellFields":{"labelField":"statusCodeTitle","labelFallbackField":"statusCode","htmlField":"statusCodeUiHtml","colorField":"statusCodeUiColor"},"cellClickBehavior":{"kind":"open-modal","modalNodeId":"node-4b8f1231-4d32-4264-8a16-1de2270f856c","primaryKeyField":"id","selectionStorePath":"selection.id"},"cardRole":"meta"},{"key":"createdAt","label":"Created","sort":true,"cellKind":"date","cardRole":"meta"},{"key":"actions","label":"","kind":"action-group","actions":[{"actionId":"approve","icon":"BadgeCheck","intent":"utility","tooltip":"Approve","behavior":{"kind":"open-modal","modalNodeId":"node-61babeab-eb4b-4a71-8a43-463afb75b303","primaryKeyField":"id","selectionStorePath":"selection.id"},"disabledWhen":{"preset":"expression","expression":"row.statusCode === '101.002.003'"}},{"actionId":"reject","icon":"XCircle","intent":"delete","tooltip":"Reject","behavior":{"kind":"open-modal","modalNodeId":"node-4860d3e1-188b-4205-b757-34103645158e","primaryKeyField":"id","selectionStorePath":"selection.id"},"disabledWhen":{"preset":"expression","expression":"row.statusCode === '101.002.005'"}},{"actionId":"delete","icon":"Trash2","intent":"delete","tooltip":"Delete","behavior":{"kind":"open-modal","modalNodeId":"node-e0ce84fc-5f53-4b84-8212-9ad4621b8493","primaryKeyField":"id","selectionStorePath":"selection.id"}}],"maxVisibleActions":3,"cardRole":"actions","layoutHideable":false,"layoutResizable":false,"layoutReorderable":false,"width":"84px"}], "server", {
    mode: 'runtime',
    detailFlowRef: { current: null },
    rowActionHandlerRef: { current: handleGridRowAction_heroui_app_table_grid_1789450111438_zfqcp },
    cellClickHandlerRef: { current: handleGridCellClick_heroui_app_table_grid_1789450111438_zfqcp },
    designerStoreRef: { current: designerStore },
  }), [designerStore, handleGridRowAction_heroui_app_table_grid_1789450111438_zfqcp, handleGridCellClick_heroui_app_table_grid_1789450111438_zfqcp]);
  const [gridQuery_heroui_app_table_grid_1789450111438_zfqcp, setGridQuery_heroui_app_table_grid_1789450111438_zfqcp] = React.useState<GridQueryState>(() => ({ ...EMPTY_GRID_QUERY, sort: { columnId: "createdAt", direction: "asc" } }));
  const [gridPage_heroui_app_table_grid_1789450111438_zfqcp, setGridPage_heroui_app_table_grid_1789450111438_zfqcp] = React.useState(1);
  const [gridPageSize_heroui_app_table_grid_1789450111438_zfqcp, setGridPageSize_heroui_app_table_grid_1789450111438_zfqcp] = React.useState(50);
  const [gridListMode_heroui_app_table_grid_1789450111438_zfqcp, setGridListMode_heroui_app_table_grid_1789450111438_zfqcp] = React.useState<'paging' | 'infinite'>("paging");
  const [gridColumnLayout_heroui_app_table_grid_1789450111438_zfqcp, setGridColumnLayout_heroui_app_table_grid_1789450111438_zfqcp] = React.useState(() => createDefaultColumnLayout(gridColumns_heroui_app_table_grid_1789450111438_zfqcp));
  const [gridSearchInput_heroui_app_table_grid_1789450111438_zfqcp, setGridSearchInput_heroui_app_table_grid_1789450111438_zfqcp] = React.useState('');
  const [gridDebouncedSearch_heroui_app_table_grid_1789450111438_zfqcp, setGridDebouncedSearch_heroui_app_table_grid_1789450111438_zfqcp] = React.useState('');
  const [gridCheckboxSelections_heroui_app_table_grid_1789450111438_zfqcp, setGridCheckboxSelections_heroui_app_table_grid_1789450111438_zfqcp] = React.useState<Record<string, Record<string, boolean>>>({});
  const [gridRadioSelections_heroui_app_table_grid_1789450111438_zfqcp, setGridRadioSelections_heroui_app_table_grid_1789450111438_zfqcp] = React.useState<Record<string, string>>({});
  const [gridMatchLogic_heroui_app_table_grid_1789450111438_zfqcp, setGridMatchLogic_heroui_app_table_grid_1789450111438_zfqcp] = React.useState<Record<string, 'and' | 'or'>>({});
  const gridRoleFilters_heroui_app_table_grid_1789450111438_zfqcp = {};
  const gridFilteredRows_heroui_app_table_grid_1789450111438_zfqcp = React.useMemo(() => applyClientGridQuery(((Array.isArray(gridData_heroui_app_table_grid_1789450111438_zfqcp) ? gridData_heroui_app_table_grid_1789450111438_zfqcp : []) ?? []), gridQuery_heroui_app_table_grid_1789450111438_zfqcp, gridColumns_heroui_app_table_grid_1789450111438_zfqcp, "server"), [gridQuery_heroui_app_table_grid_1789450111438_zfqcp, gridColumns_heroui_app_table_grid_1789450111438_zfqcp]);
  const gridAggregatedRows_heroui_app_table_grid_1789450111438_zfqcp = gridFilteredRows_heroui_app_table_grid_1789450111438_zfqcp;
  const gridApiTotal_heroui_app_table_grid_1789450111438_zfqcp = React.useMemo(() => {
    const raw = raw_gridData_heroui_app_table_grid_1789450111438_zfqcp;
    const value = readNestedContextValue((raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}), "count");
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
  }, [raw_gridData_heroui_app_table_grid_1789450111438_zfqcp]);
  const gridTotalCount_heroui_app_table_grid_1789450111438_zfqcp = resolveDataGridTotalCount({ page: gridPage_heroui_app_table_grid_1789450111438_zfqcp, pageSize: gridPageSize_heroui_app_table_grid_1789450111438_zfqcp, total: gridApiTotal_heroui_app_table_grid_1789450111438_zfqcp, gridQueryMode: "server" }, gridAggregatedRows_heroui_app_table_grid_1789450111438_zfqcp.length);
  const gridPaging_heroui_app_table_grid_1789450111438_zfqcp = sliceDataGridRowsForDisplay(gridAggregatedRows_heroui_app_table_grid_1789450111438_zfqcp, gridPage_heroui_app_table_grid_1789450111438_zfqcp, gridPageSize_heroui_app_table_grid_1789450111438_zfqcp, gridTotalCount_heroui_app_table_grid_1789450111438_zfqcp, "server");
  const handleGridQueryChange_heroui_app_table_grid_1789450111438_zfqcp = React.useCallback((nextQuery: GridQueryState) => {
    setGridQuery_heroui_app_table_grid_1789450111438_zfqcp(nextQuery);
    setGridPage_heroui_app_table_grid_1789450111438_zfqcp(1);
    patchDesignerStore("gridQuery.sortBy", nextQuery.sort?.columnId ?? '');
    patchDesignerStore("gridQuery.sortDir", nextQuery.sort?.direction ?? '');
  }, [patchDesignerStore]);
  const handleGridPageChange_heroui_app_table_grid_1789450111438_zfqcp = React.useCallback((nextPage: number) => {
    setGridPage_heroui_app_table_grid_1789450111438_zfqcp(nextPage);
    patchDesignerStore("gridQuery.page", nextPage);
  }, [patchDesignerStore]);
  const handleGridPageSizeChange_heroui_app_table_grid_1789450111438_zfqcp = React.useCallback((nextSize: number) => {
    setGridPageSize_heroui_app_table_grid_1789450111438_zfqcp(nextSize);
    setGridPage_heroui_app_table_grid_1789450111438_zfqcp(1);
    patchDesignerStore("gridQuery.pageSize", nextSize);
  }, [patchDesignerStore]);
  const handleGridSortByChange_heroui_app_table_grid_1789450111438_zfqcp = React.useCallback((nextSortBy: string) => {
    setGridQuery_heroui_app_table_grid_1789450111438_zfqcp((current: GridQueryState) => ({ ...current, sort: nextSortBy ? { columnId: nextSortBy, direction: current.sort?.direction ?? 'asc' } : null }));
  }, []);
  const handleGridToggleSortDirection_heroui_app_table_grid_1789450111438_zfqcp = React.useCallback(() => {
    setGridQuery_heroui_app_table_grid_1789450111438_zfqcp((current: GridQueryState) => (current.sort ? { ...current, sort: { ...current.sort, direction: current.sort.direction === 'asc' ? 'desc' : 'asc' } } : current));
  }, []);
  const searchDebounceTimer_heroui_app_table_grid_1789450111438_zfqcp = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleGridSearchChange_heroui_app_table_grid_1789450111438_zfqcp = React.useCallback((nextValue: string) => {
    setGridSearchInput_heroui_app_table_grid_1789450111438_zfqcp(nextValue);
    if (searchDebounceTimer_heroui_app_table_grid_1789450111438_zfqcp.current) {
      clearTimeout(searchDebounceTimer_heroui_app_table_grid_1789450111438_zfqcp.current);
    }
    searchDebounceTimer_heroui_app_table_grid_1789450111438_zfqcp.current = setTimeout(() => {
      setGridDebouncedSearch_heroui_app_table_grid_1789450111438_zfqcp(nextValue);
      setGridPage_heroui_app_table_grid_1789450111438_zfqcp(1);
      patchDesignerStore("gridToolbar.search", nextValue);
    }, 300);
  }, [patchDesignerStore]);

  const gridColumns_heroui_app_table_grid_1789450111752_x73vl = React.useMemo(() => buildAppTableGridColumns([{"key":"contentIdBTitle","label":"Related content","cellKind":"link","cellFields":{"labelField":"contentIdBTitle","labelFallbackField":"contentIdB","hrefTemplate":"/studio/cms/contents/edit/{contentIdB}"},"cardRole":"title"},{"key":"actions","label":"","kind":"action-group","actions":[{"actionId":"delete","icon":"Trash2","intent":"delete","tooltip":"Delete","behavior":{"kind":"open-modal","modalNodeId":"node-a2b0c03b-81d1-40fa-a5fb-18df18d78d74","primaryKeyField":"id","selectionStorePath":"selection.id"}}],"maxVisibleActions":3,"cardRole":"actions","layoutHideable":false,"layoutResizable":false,"layoutReorderable":false,"width":"30px"}], "client", {
    mode: 'runtime',
    detailFlowRef: { current: null },
    rowActionHandlerRef: { current: handleGridRowAction_heroui_app_table_grid_1789450111752_x73vl },
    cellClickHandlerRef: { current: undefined },
    designerStoreRef: { current: designerStore },
  }), [designerStore, handleGridRowAction_heroui_app_table_grid_1789450111752_x73vl]);
  const [gridQuery_heroui_app_table_grid_1789450111752_x73vl, setGridQuery_heroui_app_table_grid_1789450111752_x73vl] = React.useState<GridQueryState>(() => ({ ...EMPTY_GRID_QUERY, sort: { columnId: "id", direction: "asc" } }));
  const [gridPage_heroui_app_table_grid_1789450111752_x73vl, setGridPage_heroui_app_table_grid_1789450111752_x73vl] = React.useState(1);
  const [gridPageSize_heroui_app_table_grid_1789450111752_x73vl, setGridPageSize_heroui_app_table_grid_1789450111752_x73vl] = React.useState(100);
  const [gridListMode_heroui_app_table_grid_1789450111752_x73vl, setGridListMode_heroui_app_table_grid_1789450111752_x73vl] = React.useState<'paging' | 'infinite'>("paging");
  const [gridColumnLayout_heroui_app_table_grid_1789450111752_x73vl, setGridColumnLayout_heroui_app_table_grid_1789450111752_x73vl] = React.useState(() => createDefaultColumnLayout(gridColumns_heroui_app_table_grid_1789450111752_x73vl));
  const gridFilteredRows_heroui_app_table_grid_1789450111752_x73vl = React.useMemo(() => applyClientGridQuery(((Array.isArray(gridData_heroui_app_table_grid_1789450111752_x73vl) ? gridData_heroui_app_table_grid_1789450111752_x73vl : []) ?? []), gridQuery_heroui_app_table_grid_1789450111752_x73vl, gridColumns_heroui_app_table_grid_1789450111752_x73vl, "client"), [gridQuery_heroui_app_table_grid_1789450111752_x73vl, gridColumns_heroui_app_table_grid_1789450111752_x73vl]);
  const gridAggregatedRows_heroui_app_table_grid_1789450111752_x73vl = gridFilteredRows_heroui_app_table_grid_1789450111752_x73vl;
  const gridApiTotal_heroui_app_table_grid_1789450111752_x73vl = React.useMemo(() => {
    const raw = raw_gridData_heroui_app_table_grid_1789450111752_x73vl;
    const value = readNestedContextValue((raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}), "count");
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
  }, [raw_gridData_heroui_app_table_grid_1789450111752_x73vl]);
  const gridTotalCount_heroui_app_table_grid_1789450111752_x73vl = resolveDataGridTotalCount({ page: gridPage_heroui_app_table_grid_1789450111752_x73vl, pageSize: gridPageSize_heroui_app_table_grid_1789450111752_x73vl, total: gridApiTotal_heroui_app_table_grid_1789450111752_x73vl, gridQueryMode: "client" }, gridAggregatedRows_heroui_app_table_grid_1789450111752_x73vl.length);
  const gridPaging_heroui_app_table_grid_1789450111752_x73vl = sliceDataGridRowsForDisplay(gridAggregatedRows_heroui_app_table_grid_1789450111752_x73vl, gridPage_heroui_app_table_grid_1789450111752_x73vl, gridPageSize_heroui_app_table_grid_1789450111752_x73vl, gridTotalCount_heroui_app_table_grid_1789450111752_x73vl, "client");
  const handleGridQueryChange_heroui_app_table_grid_1789450111752_x73vl = React.useCallback((nextQuery: GridQueryState) => {
    setGridQuery_heroui_app_table_grid_1789450111752_x73vl(nextQuery);
    setGridPage_heroui_app_table_grid_1789450111752_x73vl(1);
  }, [patchDesignerStore]);
  const handleGridPageChange_heroui_app_table_grid_1789450111752_x73vl = React.useCallback((nextPage: number) => {
    setGridPage_heroui_app_table_grid_1789450111752_x73vl(nextPage);
  }, [patchDesignerStore]);
  const handleGridPageSizeChange_heroui_app_table_grid_1789450111752_x73vl = React.useCallback((nextSize: number) => {
    setGridPageSize_heroui_app_table_grid_1789450111752_x73vl(nextSize);
    setGridPage_heroui_app_table_grid_1789450111752_x73vl(1);
  }, [patchDesignerStore]);
  const handleGridSortByChange_heroui_app_table_grid_1789450111752_x73vl = React.useCallback((nextSortBy: string) => {
    setGridQuery_heroui_app_table_grid_1789450111752_x73vl((current: GridQueryState) => ({ ...current, sort: nextSortBy ? { columnId: nextSortBy, direction: current.sort?.direction ?? 'asc' } : null }));
  }, []);
  const handleGridToggleSortDirection_heroui_app_table_grid_1789450111752_x73vl = React.useCallback(() => {
    setGridQuery_heroui_app_table_grid_1789450111752_x73vl((current: GridQueryState) => (current.sort ? { ...current, sort: { ...current.sort, direction: current.sort.direction === 'asc' ? 'desc' : 'asc' } } : current));
  }, []);

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const handleonClick_node_88ab46eb_8883_400f_8f56_af010eb08e1e = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-e0ce84fc-5f53-4b84-8212-9ad4621b8493", false);
  }, [patchDesignerStore]);
  const handleonClick_node_9c79f359_8990_4933_817f_c46ffd89c653 = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    void (async () => {
      let mutationOk_da_mu28e6s5_fje6c = true;
      try {
        const response = await designerFetch(("/api/cms/contents/" + encodeURIComponent(String(designerStore?.selection?.id)) + ""), {
          method: "DELETE",
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) {
          toast(await parseApiErrorMessage(response), { variant: 'danger' });
          mutationOk_da_mu28e6s5_fje6c = false;
        }
      } catch (mutationFailure) {
        toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' });
        mutationOk_da_mu28e6s5_fje6c = false;
      }
      if (mutationOk_da_mu28e6s5_fje6c) {
        await refresh_gridData_heroui_app_table_grid_1789450111438_zfqcp();
        toast("Deleted", { variant: "success", timeout: 4000 });
        patchDesignerStore("ui.visibility.node-e0ce84fc-5f53-4b84-8212-9ad4621b8493", false);
      }
    })();
  }, [patchDesignerStore, refresh_gridData_heroui_app_table_grid_1789450111438_zfqcp]);
  const handleonClick_node_f6f03980_0bf6_421c_9e1e_003fdfd67933 = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-61babeab-eb4b-4a71-8a43-463afb75b303", false);
  }, [patchDesignerStore]);
  const handleonClick_node_5b362eef_c51e_4eaf_b4c3_ecc03abef741 = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    void (async () => {
      let mutationOk_da_mu28e6s7_wm8jz = true;
      try {
        const response = await designerFetch(("/api/cms/contents/" + encodeURIComponent(String(designerStore?.selection?.id)) + ""), {
          method: "PUT",
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ "statusCode": "101.002.003" }),
        });
        if (!response.ok) {
          toast(await parseApiErrorMessage(response), { variant: 'danger' });
          mutationOk_da_mu28e6s7_wm8jz = false;
        }
      } catch (mutationFailure) {
        toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' });
        mutationOk_da_mu28e6s7_wm8jz = false;
      }
      if (mutationOk_da_mu28e6s7_wm8jz) {
        await refresh_gridData_heroui_app_table_grid_1789450111438_zfqcp();
        toast("Comment approved", { variant: "success", timeout: 4000 });
        patchDesignerStore("ui.visibility.node-61babeab-eb4b-4a71-8a43-463afb75b303", false);
      }
    })();
  }, [patchDesignerStore, refresh_gridData_heroui_app_table_grid_1789450111438_zfqcp]);
  const handleonClick_node_66b357e1_66ec_40e6_ba4a_762c9365bed8 = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-4860d3e1-188b-4205-b757-34103645158e", false);
  }, [patchDesignerStore]);
  const handleonClick_node_9ebe0e92_a111_44a7_a020_4dce0755ad5f = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    void (async () => {
      let mutationOk_da_mu28e6s7_kqxgz = true;
      try {
        const response = await designerFetch(("/api/cms/contents/" + encodeURIComponent(String(designerStore?.selection?.id)) + ""), {
          method: "PUT",
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ "statusCode": "101.002.005" }),
        });
        if (!response.ok) {
          toast(await parseApiErrorMessage(response), { variant: 'danger' });
          mutationOk_da_mu28e6s7_kqxgz = false;
        }
      } catch (mutationFailure) {
        toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' });
        mutationOk_da_mu28e6s7_kqxgz = false;
      }
      if (mutationOk_da_mu28e6s7_kqxgz) {
        await refresh_gridData_heroui_app_table_grid_1789450111438_zfqcp();
        toast("Comment rejected", { variant: "success", timeout: 4000 });
        patchDesignerStore("ui.visibility.node-4860d3e1-188b-4205-b757-34103645158e", false);
      }
    })();
  }, [patchDesignerStore, refresh_gridData_heroui_app_table_grid_1789450111438_zfqcp]);
  const handleonClick_heroui_button_outline_1789450111454_c527z = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    navigate("/studio/cms/contents", { replace: false });
  }, [navigate]);
  const handleonClick_heroui_button_outline_1789450111481_vgf83 = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    void (async () => {
      await refresh_gridData_heroui_app_table_grid_1789450111438_zfqcp();
      patchDesignerStore("ui.visibility.heroui-modal-1789450111435-x9317", true);
    })();
  }, [patchDesignerStore, refresh_gridData_heroui_app_table_grid_1789450111438_zfqcp]);
  const handleonClick_heroui_button_outline_1789450111487_q6ss8 = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-6e92a049-f429-49f9-9acb-81a2aa13460b", true);
  }, [patchDesignerStore]);
  const handleonSubmit_html_form_1789450111494_qf1gy = React.useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {};
      payload["title"] = formData.get("heroui-input-text-1789450111505-bpuls") ?? '';
      payload["summary"] = formData.get("heroui-textarea-1789450111508-c464e") ?? '';
      payload["summary"] = formData.get("form-markdown-editor-1789450111512-plaim") ?? '';
      payload["summary"] = formData.get("form-html-editor-1789450111517-k6i5u") ?? '';
      payload["body"] = formData.get("heroui-textarea-1789450111526-f0rqq") ?? '';
      payload["body"] = formData.get("form-markdown-editor-1789450111532-qb024") ?? '';
      payload["body"] = formData.get("form-html-editor-1789450111538-627pk") ?? '';
      const method = regionData_cmsContents_html_form_1789450111494_qf1gy?.id != null && String(regionData_cmsContents_html_form_1789450111494_qf1gy?.id).length > 0 ? "PUT" : 'POST';
      const url = (regionData_cmsContents_html_form_1789450111494_qf1gy?.id != null && String(regionData_cmsContents_html_form_1789450111494_qf1gy?.id).length > 0 ? (regionData_cmsContents_html_form_1789450111494_qf1gy?.id != null && String(regionData_cmsContents_html_form_1789450111494_qf1gy?.id).length > 0 ? ("/api/cms/contents/" + encodeURIComponent(String(regionData_cmsContents_html_form_1789450111494_qf1gy?.id)) + "") : "/api/cms/contents/:id") : "/api/cms/contents");
      const response = await designerFetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response));
      }
      toast("Content saved.", { variant: "success", timeout: 4000 });
      await refresh_regionData_cmsContents_layout_flex_row_1789450111450_ovw0o();
    } catch (mutationFailure) {
      toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' });
    }
    finally {
      setIsSubmitting(false);
    }
  }, [regionData_cmsContents_html_form_1789450111494_qf1gy]);
  const handleonClick_heroui_button_outline_1789450111582_z5yn9 = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-ed5f3873-c218-4af2-b9a4-5e17460092a4", true);
  }, [patchDesignerStore]);
  const handleonClick_heroui_button_outline_1789450111650_2plsz = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-3cc49ae6-541a-4550-bedf-4f1de8e15b3d", true);
  }, [patchDesignerStore]);
  const handleonClick_heroui_button_outline_1789450111742_c609u = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-e70a0faf-8a0e-48ab-be4b-714e250f62ab", true);
  }, [patchDesignerStore]);
  const handleonClick_node_8a4df565_c521_4639_89d4_6eaf03e912fb = React.useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    let formData: FormData;
    const form = event.currentTarget instanceof HTMLFormElement ? event.currentTarget : event.currentTarget.closest('form');
    if (form) {
      formData = new FormData(form);
    } else {
      const regionRoot = document.querySelector("[data-designer-node-id=\"node-8f1bd58a-1304-4a6e-a3dc-3aeebe09c9f3\"]");
      if (!regionRoot) {
        return;
      }
      formData = collectRegionFormDataFromContainer(regionRoot, []);
    }
    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {};
      const method = regionData_cmsContentRelations?.id != null && String(regionData_cmsContentRelations?.id).length > 0 ? "PUT" : 'POST';
      const url = (regionData_cmsContentRelations?.id != null && String(regionData_cmsContentRelations?.id).length > 0 ? (regionData_cmsContentRelations?.id != null && String(regionData_cmsContentRelations?.id).length > 0 ? ("/api/cms/relations/" + encodeURIComponent(String(regionData_cmsContentRelations?.id)) + "") : "/api/cms/relations/:id") : "/api/cms/relations");
      const response = await designerFetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response));
      }
      patchDesignerStore("ui.visibility.node-e70a0faf-8a0e-48ab-be4b-714e250f62ab", false);
      toast("Saved successfully", { variant: "success", timeout: 4000 });
      await refresh_gridData_heroui_app_table_grid_1789450111752_x73vl();
      (document.querySelector("[data-designer-node-id=\"node-8f1bd58a-1304-4a6e-a3dc-3aeebe09c9f3\"]") as HTMLFormElement | null)?.reset?.();
    } catch (mutationFailure) {
      toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' });
    }
    finally {
      setIsSubmitting(false);
    }
  }, [regionData_cmsContentRelations]);
  const handleonClick_node_11bfd775_950b_4483_b0d3_45ab36ea9a0b = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-e70a0faf-8a0e-48ab-be4b-714e250f62ab", false);
  }, [patchDesignerStore]);
  const handleonClick_node_9a534409_c686_4a2d_a8bf_cf516e793a8f = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-a2b0c03b-81d1-40fa-a5fb-18df18d78d74", false);
  }, [patchDesignerStore]);
  const handleonClick_node_5c02af3a_a4c9_46fc_80de_6dcef70ee5db = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    void (async () => {
      let mutationOk_da_mu28e71r_shs1h = true;
      try {
        const response = await designerFetch(("/api/cms/relations/" + encodeURIComponent(String(designerStore?.selection?.id)) + ""), {
          method: "DELETE",
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) {
          toast(await parseApiErrorMessage(response), { variant: 'danger' });
          mutationOk_da_mu28e71r_shs1h = false;
        }
      } catch (mutationFailure) {
        toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' });
        mutationOk_da_mu28e71r_shs1h = false;
      }
      if (mutationOk_da_mu28e71r_shs1h) {
        await refresh_gridData_heroui_app_table_grid_1789450111752_x73vl();
        toast("Deleted", { variant: "success", timeout: 4000 });
        patchDesignerStore("ui.visibility.node-a2b0c03b-81d1-40fa-a5fb-18df18d78d74", false);
      }
    })();
  }, [patchDesignerStore, refresh_gridData_heroui_app_table_grid_1789450111752_x73vl]);
  const handleonClick_heroui_button_outline_1789450111831_9uare = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-1edbd738-ff57-478e-b085-0586517e0c18", true);
  }, [patchDesignerStore]);
  const handleonClick_node_eb7f5bdc_963c_4172_8623_0b8242a85818 = React.useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    let formData: FormData;
    const form = event.currentTarget instanceof HTMLFormElement ? event.currentTarget : event.currentTarget.closest('form');
    if (form) {
      formData = new FormData(form);
    } else {
      const regionRoot = document.querySelector("[data-designer-node-id=\"node-5a32780c-ac4e-472a-a412-e47f560f21a8\"]");
      if (!regionRoot) {
        return;
      }
      formData = collectRegionFormDataFromContainer(regionRoot, ["node-7aa5deca-8eb1-4221-9bb4-869057291ff0","node-bc2b8df7-2edc-4312-917b-ec201177a4ef"]);
    }
    const fieldValidationEntries = [{"nodeId":"node-7aa5deca-8eb1-4221-9bb4-869057291ff0","formFieldName":"node-7aa5deca-8eb1-4221-9bb4-869057291ff0","props":{"_designerPaletteItemId":"heroui.select","isRequired":true}},{"nodeId":"node-bc2b8df7-2edc-4312-917b-ec201177a4ef","formFieldName":"node-bc2b8df7-2edc-4312-917b-ec201177a4ef","props":{"_designerPaletteItemId":"heroui.select","isRequired":true}}] as Array<{ nodeId: string; formFieldName: string; props: Record<string, unknown> }>;
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
      payload["contentTypeCode"] = formData.get("node-7aa5deca-8eb1-4221-9bb4-869057291ff0") ?? '';
      payload["languageCode"] = formData.get("node-bc2b8df7-2edc-4312-917b-ec201177a4ef") ?? '';
      const method = regionData_cmsContents_node_5a32780c_ac4e_472a_a412_e47f560f21a8?.id != null && String(regionData_cmsContents_node_5a32780c_ac4e_472a_a412_e47f560f21a8?.id).length > 0 ? "PUT" : 'POST';
      const url = (regionData_cmsContents_node_5a32780c_ac4e_472a_a412_e47f560f21a8?.id != null && String(regionData_cmsContents_node_5a32780c_ac4e_472a_a412_e47f560f21a8?.id).length > 0 ? (regionData_cmsContents_node_5a32780c_ac4e_472a_a412_e47f560f21a8?.id != null && String(regionData_cmsContents_node_5a32780c_ac4e_472a_a412_e47f560f21a8?.id).length > 0 ? ("/api/cms/contents/" + encodeURIComponent(String(regionData_cmsContents_node_5a32780c_ac4e_472a_a412_e47f560f21a8?.id)) + "") : "/api/cms/contents/:id") : "/api/cms/contents");
      const response = await designerFetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response));
      }
      patchDesignerStore("ui.visibility.node-ed5f3873-c218-4af2-b9a4-5e17460092a4", false);
      toast("Saved successfully", { variant: "success", timeout: 4000 });
      await refresh_regionData_cmsContents_layout_flex_row_1789450111450_ovw0o();
    } catch (mutationFailure) {
      toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' });
    }
    finally {
      setIsSubmitting(false);
    }
  }, [regionData_cmsContents_node_5a32780c_ac4e_472a_a412_e47f560f21a8]);
  const handleonClick_node_1e314726_f2d1_4bd3_98a8_68f60ffb47f7 = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-ed5f3873-c218-4af2-b9a4-5e17460092a4", false);
  }, [patchDesignerStore]);
  const handleonClick_node_d8e6964d_1039_4dae_8f50_13bc28517329 = React.useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    let formData: FormData;
    const form = event.currentTarget instanceof HTMLFormElement ? event.currentTarget : event.currentTarget.closest('form');
    if (form) {
      formData = new FormData(form);
    } else {
      const regionRoot = document.querySelector("[data-designer-node-id=\"node-25bf5fda-f269-497e-ac69-9425762963d1\"]");
      if (!regionRoot) {
        return;
      }
      formData = collectRegionFormDataFromContainer(regionRoot, ["node-e981680a-6445-4bcd-9ff8-073ca1d4d787","node-56a849f1-444d-48b0-8578-f7a23008ba44","node-681ffc11-d972-42e9-888c-4a77ae1a4892"]);
    }
    const fieldValidationEntries = [{"nodeId":"node-e981680a-6445-4bcd-9ff8-073ca1d4d787","formFieldName":"node-e981680a-6445-4bcd-9ff8-073ca1d4d787","props":{"_designerPaletteItemId":"heroui.input-text","isRequired":true}}] as Array<{ nodeId: string; formFieldName: string; props: Record<string, unknown> }>;
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
      payload["slug"] = formData.get("node-e981680a-6445-4bcd-9ff8-073ca1d4d787") ?? '';
      payload["seoTitle"] = formData.get("node-56a849f1-444d-48b0-8578-f7a23008ba44") ?? '';
      payload["seoNote"] = formData.get("node-681ffc11-d972-42e9-888c-4a77ae1a4892") ?? '';
      const method = regionData_cmsContents_node_25bf5fda_f269_497e_ac69_9425762963d1?.id != null && String(regionData_cmsContents_node_25bf5fda_f269_497e_ac69_9425762963d1?.id).length > 0 ? "PUT" : 'POST';
      const url = (regionData_cmsContents_node_25bf5fda_f269_497e_ac69_9425762963d1?.id != null && String(regionData_cmsContents_node_25bf5fda_f269_497e_ac69_9425762963d1?.id).length > 0 ? (regionData_cmsContents_node_25bf5fda_f269_497e_ac69_9425762963d1?.id != null && String(regionData_cmsContents_node_25bf5fda_f269_497e_ac69_9425762963d1?.id).length > 0 ? ("/api/cms/contents/" + encodeURIComponent(String(regionData_cmsContents_node_25bf5fda_f269_497e_ac69_9425762963d1?.id)) + "") : "/api/cms/contents/:id") : "/api/cms/contents");
      const response = await designerFetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response));
      }
      patchDesignerStore("ui.visibility.node-2e8a02de-78d1-4326-8006-64ba59b78a52", false);
      toast("Saved successfully", { variant: "success", timeout: 4000 });
      await refresh_regionData_cmsContents_layout_flex_row_1789450111450_ovw0o();
    } catch (mutationFailure) {
      toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' });
    }
    finally {
      setIsSubmitting(false);
    }
  }, [regionData_cmsContents_node_25bf5fda_f269_497e_ac69_9425762963d1]);
  const handleonClick_node_b7037fe7_491f_4304_9406_2947a8a44248 = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-2e8a02de-78d1-4326-8006-64ba59b78a52", false);
  }, [patchDesignerStore]);
  const handleonClick_node_99a05b1a_cdef_47be_ad8e_877d038e71d5 = React.useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    let formData: FormData;
    const form = event.currentTarget instanceof HTMLFormElement ? event.currentTarget : event.currentTarget.closest('form');
    if (form) {
      formData = new FormData(form);
    } else {
      const regionRoot = document.querySelector("[data-designer-node-id=\"node-7aa755e3-9d44-4f35-b5c5-0b90b63c80f9\"]");
      if (!regionRoot) {
        return;
      }
      formData = collectRegionFormDataFromContainer(regionRoot, ["node-31fee7d1-0a35-43c4-ab63-ad8d31fd711e"]);
    }
    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {};
      payload["operatorNote"] = formData.get("node-31fee7d1-0a35-43c4-ab63-ad8d31fd711e") ?? '';
      const method = regionData_cmsContents_node_7aa755e3_9d44_4f35_b5c5_0b90b63c80f9?.id != null && String(regionData_cmsContents_node_7aa755e3_9d44_4f35_b5c5_0b90b63c80f9?.id).length > 0 ? "PUT" : 'POST';
      const url = (regionData_cmsContents_node_7aa755e3_9d44_4f35_b5c5_0b90b63c80f9?.id != null && String(regionData_cmsContents_node_7aa755e3_9d44_4f35_b5c5_0b90b63c80f9?.id).length > 0 ? (regionData_cmsContents_node_7aa755e3_9d44_4f35_b5c5_0b90b63c80f9?.id != null && String(regionData_cmsContents_node_7aa755e3_9d44_4f35_b5c5_0b90b63c80f9?.id).length > 0 ? ("/api/cms/contents/" + encodeURIComponent(String(regionData_cmsContents_node_7aa755e3_9d44_4f35_b5c5_0b90b63c80f9?.id)) + "") : "/api/cms/contents/:id") : "/api/cms/contents");
      const response = await designerFetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response));
      }
      patchDesignerStore("ui.visibility.node-1edbd738-ff57-478e-b085-0586517e0c18", false);
      toast("Saved successfully", { variant: "success", timeout: 4000 });
      await refresh_regionData_cmsContents_layout_flex_row_1789450111450_ovw0o();
    } catch (mutationFailure) {
      toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' });
    }
    finally {
      setIsSubmitting(false);
    }
  }, [regionData_cmsContents_node_7aa755e3_9d44_4f35_b5c5_0b90b63c80f9]);
  const handleonClick_node_29b284d0_457b_4333_b0bf_6df55069f2fe = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-1edbd738-ff57-478e-b085-0586517e0c18", false);
  }, [patchDesignerStore]);
  const handleonClick_node_98f2e118_df75_487d_bb2c_fa8ffedf9751 = React.useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    let formData: FormData;
    const form = event.currentTarget instanceof HTMLFormElement ? event.currentTarget : event.currentTarget.closest('form');
    if (form) {
      formData = new FormData(form);
    } else {
      const regionRoot = document.querySelector("[data-designer-node-id=\"node-46bbe401-a0f2-4fab-affc-9c69baff1d13\"]");
      if (!regionRoot) {
        return;
      }
      formData = collectRegionFormDataFromContainer(regionRoot, ["node-5c0841ff-6c01-4533-9f49-b9655e618a45","node-25862094-6c90-4e8b-bdf6-e4f558bc06c1","node-d7ad453b-ebb3-4bf2-86a3-d733007f5cf3"]);
    }
    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {};
      payload["commentsEnabled"] = applyPayloadFieldTransform(formData.get("node-5c0841ff-6c01-4533-9f49-b9655e618a45"), "nullableBoolean");
      payload["commentsPolicyCode"] = applyPayloadFieldTransform(formData.get("node-25862094-6c90-4e8b-bdf6-e4f558bc06c1"), "nullableString");
      payload["commentsBodyFormatCode"] = applyPayloadFieldTransform(formData.get("node-d7ad453b-ebb3-4bf2-86a3-d733007f5cf3"), "nullableString");
      const method = regionData_cmsContents_node_46bbe401_a0f2_4fab_affc_9c69baff1d13?.id != null && String(regionData_cmsContents_node_46bbe401_a0f2_4fab_affc_9c69baff1d13?.id).length > 0 ? "PUT" : 'POST';
      const url = (regionData_cmsContents_node_46bbe401_a0f2_4fab_affc_9c69baff1d13?.id != null && String(regionData_cmsContents_node_46bbe401_a0f2_4fab_affc_9c69baff1d13?.id).length > 0 ? (regionData_cmsContents_node_46bbe401_a0f2_4fab_affc_9c69baff1d13?.id != null && String(regionData_cmsContents_node_46bbe401_a0f2_4fab_affc_9c69baff1d13?.id).length > 0 ? ("/api/cms/contents/" + encodeURIComponent(String(regionData_cmsContents_node_46bbe401_a0f2_4fab_affc_9c69baff1d13?.id)) + "") : "/api/cms/contents/:id") : "/api/cms/contents");
      const response = await designerFetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response));
      }
      patchDesignerStore("ui.visibility.node-6e92a049-f429-49f9-9acb-81a2aa13460b", false);
      toast("Saved successfully", { variant: "success", timeout: 4000 });
      await refresh_regionData_cmsContents_layout_flex_row_1789450111450_ovw0o();
    } catch (mutationFailure) {
      toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' });
    }
    finally {
      setIsSubmitting(false);
    }
  }, [regionData_cmsContents_node_46bbe401_a0f2_4fab_affc_9c69baff1d13]);
  const handleonClick_node_854b692f_510e_488c_bd5e_0f6da3fd5d49 = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-6e92a049-f429-49f9-9acb-81a2aa13460b", false);
  }, [patchDesignerStore]);
  const handleonClick_heroui_button_outline_1789450112019_yq0si = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {
    patchDesignerStore("ui.visibility.node-2e8a02de-78d1-4326-8006-64ba59b78a52", true);
  }, [patchDesignerStore]);
  return (
    <>
      <Toast.Provider />
      <div className="h-full min-h-0 w-full min-w-0 space-y-3">
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "(store.ui.visibility.heroui-modal-1789450111435-x9317 === true) && (store.ui.visibility.heroui-modal-1789450111435-x9317 !== false)") && (
          <CreateEditModalShell title={"Comments"} size="maximized" onClose={() => { patchDesignerStore("ui.visibility.heroui-modal-1789450111435-x9317", false); }} onBackdropClick={() => { patchDesignerStore("ui.visibility.heroui-modal-1789450111435-x9317", false); }} gradient={false} bodyOuterClassName="-mb-[15px] flex min-h-0 flex-1 flex-col !overflow-hidden" bodyClassName="flex h-full min-h-0 flex-1 flex-col overflow-hidden !p-0" footerClassName="!mt-0">
            <div className="flex !h-full !min-h-0 !min-w-0 flex-1 flex-col overflow-hidden bg-white">
              <div className="flex w-full flex-col gap-2"><div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-2 py-1.5"><div className="flex items-center gap-2"><input type="text" value={gridSearchInput_heroui_app_table_grid_1789450111438_zfqcp} onChange={(event) => handleGridSearchChange_heroui_app_table_grid_1789450111438_zfqcp(event.target.value)} placeholder={"Search comments…"} className="h-8 rounded-md border border-slate-200 px-2 text-sm" /></div><div className="flex items-center gap-2"><button type="button" onClick={() => { void refresh_gridData_heroui_app_table_grid_1789450111438_zfqcp(); }} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">Refresh</button></div></div><AppTableGrid className="flex !h-full !min-h-0 !w-full flex-1 flex-col" showPagingFooter defaultSortDirection="asc" presentation="cards" cardBelow="tablet" columns={gridColumns_heroui_app_table_grid_1789450111438_zfqcp} rows={gridPaging_heroui_app_table_grid_1789450111438_zfqcp.displayRows} getRowKey={(row) => String((row as Record<string, unknown>)["id"] ?? '')} enableColumnLayout={false} columnLayout={gridColumnLayout_heroui_app_table_grid_1789450111438_zfqcp} onColumnLayoutChange={setGridColumnLayout_heroui_app_table_grid_1789450111438_zfqcp} isLoading={false} loadingMessage={"Loading comments…"} emptyMessage={"No comments found."} isEmpty={gridAggregatedRows_heroui_app_table_grid_1789450111438_zfqcp.length === 0} errorContent={gridAggregatedRows_heroui_app_table_grid_1789450111438_zfqcp.length === 0 ? undefined : "Could not load comments."} gridQueryMode={"server"} query={gridQuery_heroui_app_table_grid_1789450111438_zfqcp} onQueryChange={handleGridQueryChange_heroui_app_table_grid_1789450111438_zfqcp} onGridRowAction={handleGridRowAction_heroui_app_table_grid_1789450111438_zfqcp} footer={<GridPagingFooter totalCount={gridTotalCount_heroui_app_table_grid_1789450111438_zfqcp} safePage={gridPaging_heroui_app_table_grid_1789450111438_zfqcp.safePage} pageSize={gridPageSize_heroui_app_table_grid_1789450111438_zfqcp} onPageSizeChange={handleGridPageSizeChange_heroui_app_table_grid_1789450111438_zfqcp} sortBy={gridQuery_heroui_app_table_grid_1789450111438_zfqcp.sort?.columnId ?? ''} sortOptions={[{"value":"body","label":"Comment"},{"value":"authorDisplayName","label":"Author"},{"value":"statusCode","label":"Status"},{"value":"createdAt","label":"Created"}]} onSortByChange={handleGridSortByChange_heroui_app_table_grid_1789450111438_zfqcp} sortDirection={gridQuery_heroui_app_table_grid_1789450111438_zfqcp.sort?.direction ?? 'asc'} onToggleSortDirection={handleGridToggleSortDirection_heroui_app_table_grid_1789450111438_zfqcp} showSortControls={true} totalPages={gridPaging_heroui_app_table_grid_1789450111438_zfqcp.totalPages} pageNumbers={buildDataGridPageNumbers(gridPaging_heroui_app_table_grid_1789450111438_zfqcp.safePage, gridPaging_heroui_app_table_grid_1789450111438_zfqcp.totalPages)} onPageChange={handleGridPageChange_heroui_app_table_grid_1789450111438_zfqcp} visibleInfiniteCount={gridListMode_heroui_app_table_grid_1789450111438_zfqcp === 'infinite' ? gridPaging_heroui_app_table_grid_1789450111438_zfqcp.displayRows.length : undefined} />} /></div>
            </div>
          </CreateEditModalShell>
        )}
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "(store.ui.visibility.node-e0ce84fc-5f53-4b84-8212-9ad4621b8493 === true) && (store.ui.visibility.node-e0ce84fc-5f53-4b84-8212-9ad4621b8493 !== false)") && (
          <ConfirmDialogShell title={"Delete comment?"} size="sm" onClose={() => { patchDesignerStore("ui.visibility.node-e0ce84fc-5f53-4b84-8212-9ad4621b8493", false); }} onBackdropClick={() => { patchDesignerStore("ui.visibility.node-e0ce84fc-5f53-4b84-8212-9ad4621b8493", false); }} tone="danger" hideCancel hideConfirm icon={<Trash2 className="h-4 w-4" />} bodyClassName="!p-0" footerClassName="!mt-0">
            <p className="block p-[15px] !text-sm text-slate-700">Delete this comment? This cannot be undone.</p>
            <div className="flex !w-full shrink-0 !items-center !justify-end gap-2">
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 border border-slate-200 text-slate-600 hover:bg-slate-100" variant="outline" size="md" onClick={handleonClick_node_88ab46eb_8883_400f_8f56_af010eb08e1e}><X className="h-3.5 w-3.5" /> Cancel</Button>
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 bg-rose-600 hover:bg-rose-700 text-white" variant="primary" size="md" onClick={handleonClick_node_9c79f359_8990_4933_817f_c46ffd89c653}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
            </div>
          </ConfirmDialogShell>
        )}
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "(store.ui.visibility.node-61babeab-eb4b-4a71-8a43-463afb75b303 === true) && (store.ui.visibility.node-61babeab-eb4b-4a71-8a43-463afb75b303 !== false)") && (
          <ConfirmDialogShell title={"Approve comment?"} size="sm" onClose={() => { patchDesignerStore("ui.visibility.node-61babeab-eb4b-4a71-8a43-463afb75b303", false); }} onBackdropClick={() => { patchDesignerStore("ui.visibility.node-61babeab-eb4b-4a71-8a43-463afb75b303", false); }} tone="default" hideCancel hideConfirm bodyClassName="!p-0" footerClassName="!mt-0">
            <p className="block p-[15px] !text-sm leading-relaxed text-slate-700">Approve this comment and make it available to public delivery?</p>
            <div className="flex !w-full shrink-0 !items-center !justify-end gap-2">
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 border border-slate-200 text-slate-600 hover:bg-slate-100" variant="outline" size="md" onClick={handleonClick_node_f6f03980_0bf6_421c_9e1e_003fdfd67933}><X className="h-3.5 w-3.5" /> Cancel</Button>
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 bg-primary-600 hover:bg-primary-700 text-white" variant="primary" size="md" onClick={handleonClick_node_5b362eef_c51e_4eaf_b4c3_ecc03abef741}><Check className="h-3.5 w-3.5" /> Approve</Button>
            </div>
          </ConfirmDialogShell>
        )}
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "(store.ui.visibility.node-4860d3e1-188b-4205-b757-34103645158e === true) && (store.ui.visibility.node-4860d3e1-188b-4205-b757-34103645158e !== false)") && (
          <ConfirmDialogShell title={"Reject comment?"} size="sm" onClose={() => { patchDesignerStore("ui.visibility.node-4860d3e1-188b-4205-b757-34103645158e", false); }} onBackdropClick={() => { patchDesignerStore("ui.visibility.node-4860d3e1-188b-4205-b757-34103645158e", false); }} tone="default" hideCancel hideConfirm bodyClassName="!p-0" footerClassName="!mt-0">
            <p className="block p-[15px] !text-sm leading-relaxed text-slate-700">Reject this comment? It will remain hidden from public delivery.</p>
            <div className="flex !w-full shrink-0 !items-center !justify-end gap-2">
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 border border-slate-200 text-slate-600 hover:bg-slate-100" variant="outline" size="md" onClick={handleonClick_node_66b357e1_66ec_40e6_ba4a_762c9365bed8}><X className="h-3.5 w-3.5" /> Cancel</Button>
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 bg-primary-600 hover:bg-primary-700 text-white" variant="primary" size="md" onClick={handleonClick_node_9ebe0e92_a111_44a7_a020_4dce0755ad5f}><Check className="h-3.5 w-3.5" /> Reject</Button>
            </div>
          </ConfirmDialogShell>
        )}
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "store.ui.visibility.node-4b8f1231-4d32-4264-8a16-1de2270f856c === true") && (
          <CreateEditModalShell title={"Change status"} size="lg" onClose={() => { patchDesignerStore("ui.visibility.node-4b8f1231-4d32-4264-8a16-1de2270f856c", false); }} onBackdropClick={() => { patchDesignerStore("ui.visibility.node-4b8f1231-4d32-4264-8a16-1de2270f856c", false); }} gradient={false} bodyOuterClassName="-mb-[15px]" bodyClassName="!p-0" footerClassName="!mt-0">
            <DesignerRuntimeContentStatusPicker node={{"id":"node-23b9015c-0b02-48e1-9034-0f6c876cf95a","type":"container","props":{"className":"flex flex-col gap-2 bg-white p-[15px]","contentStatusPicker":true,"contentStatusPickerLovRef":"cmsStatuses","contentStatusPickerDataSourceRef":"cmsContentComments","contentStatusPickerRecordIdPath":"selection.id","contentStatusPickerModalNodeId":"node-4b8f1231-4d32-4264-8a16-1de2270f856c","contentStatusPickerSuccessToast":"Status updated","_designerPaletteItemId":"layout.flex-column","_isBuiltInTemplateRoot":true,"twDisplay":"flex","twPosition":"","twOverflow":"","twPadding":"","twMargin":"","twWidth":"","twHeight":"","twFlexDirection":"flex-col","twItems":"","twJustify":"","twGap":"gap-2","twGridCols":"","twTextSize":"","twFontWeight":"","twTextAlign":"","twRounded":"","twShadow":"","twOpacity":""},"parentId":"node-4b8f1231-4d32-4264-8a16-1de2270f856c","order":0,"layout":{},"binding":{},"children":[]} as any} options={{ mode: 'runtime', bindingDefinitions: {"definitions":{"defaultVisibility":{"sourceType":"static","sourcePath":"true","fallbackValue":true}},"storeSegments":{"selection":{"id":"selection","initialValue":{"id":null},"persist":"none"}},"dataSources":{"cmsContents":{"id":"cmsContents","name":"CMS Contents","endpoint":"/api/cms/contents","fields":["id","title","slug","summary","body","contentTypeCode","languageCode","statusCode","statusCodeUpdatedAt","statusCodeUpdatedBy","statusCodeUpdatedByUsername","bodyFormatCode","commentCount","revisionCount","tagSummary","contentTypeCodeTitle","languageCodeTitle","statusCodeTitle","statusCodeUiHtml","statusCodeUiColor","bodyFormatCodeTitle","bodyFormatCodeShortName","commentsPolicyCodeTitle","seoTitle","seoNote","publishedAt","operatorNote","commentsEnabled","commentsPolicyCode","commentsBodyFormatCode","createdBy","createdByUsername","createdAt","updatedBy","updatedByUsername","updatedAt"],"primaryKey":"id","kind":"collection","operations":{"list":{"method":"GET","endpoint":"/api/cms/contents"},"detail":{"method":"GET","endpoint":"/api/cms/contents/:id"},"create":{"method":"POST","endpoint":"/api/cms/contents"},"update":{"method":"PUT","endpoint":"/api/cms/contents/:id"},"delete":{"method":"DELETE","endpoint":"/api/cms/contents/:id"}},"responseMapping":{"dataPath":"data","arrayPath":"data","totalPath":"count"}},"cmsContentAssets":{"id":"cmsContentAssets","name":"CMS Content Assets","endpoint":"/api/cms/assets","fields":["id","contentId","fileName","fileMime","fileSize","file","fileXs","sha256","sortOrder","createdAt","updatedAt"],"primaryKey":"id","kind":"collection","operations":{"list":{"method":"GET","endpoint":"/api/cms/assets"},"create":{"method":"POST","endpoint":"/api/cms/assets"},"update":{"method":"PUT","endpoint":"/api/cms/assets/:id"},"delete":{"method":"DELETE","endpoint":"/api/cms/assets/:pk"}},"responseMapping":{"dataPath":"data","arrayPath":"data","totalPath":"count"}},"cmsContentRelations":{"id":"cmsContentRelations","name":"CMS Content Relations","endpoint":"/api/cms/relations","fields":["id","contentIdA","contentIdATitle","contentIdASlug","contentIdB","contentIdBTitle","contentIdBSlug","note"],"primaryKey":"id","kind":"collection","operations":{"list":{"method":"GET","endpoint":"/api/cms/relations"},"create":{"method":"POST","endpoint":"/api/cms/relations"},"update":{"method":"PUT","endpoint":"/api/cms/relations/:id"},"delete":{"method":"DELETE","endpoint":"/api/cms/relations/:id"}},"responseMapping":{"dataPath":"data","arrayPath":"data","totalPath":"count"}},"cmsContentTags":{"id":"cmsContentTags","name":"CMS Content Tags","endpoint":"/api/cms/tags","fields":["id","contentId","tagCode","tagCodeTitle"],"primaryKey":"id","kind":"collection","operations":{"list":{"method":"GET","endpoint":"/api/cms/tags"},"create":{"method":"POST","endpoint":"/api/cms/tags"},"update":{"method":"PUT","endpoint":"/api/cms/tags/:id"},"delete":{"method":"DELETE","endpoint":"/api/cms/tags/:id"}},"responseMapping":{"dataPath":"data","arrayPath":"data","totalPath":"count"}},"cmsContentComments":{"id":"cmsContentComments","name":"content comment","endpoint":"/api/cms/contents","fields":["id","parentContentId","body","authorDisplayName","statusCode","statusCodeTitle","statusCodeUiHtml","statusCodeUiColor","createdAt"],"primaryKey":"id","kind":"collection","operations":{"list":{"method":"GET","endpoint":"/api/cms/contents"},"update":{"method":"PUT","endpoint":"/api/cms/contents/:id"},"delete":{"method":"DELETE","endpoint":"/api/cms/contents/:id"}},"responseMapping":{"dataPath":"data","arrayPath":"data","totalPath":"count"},"pollingIntervalMs":3000}},"lovs":{"cmsStatuses":{"id":"cmsStatuses","name":"Statuses","endpoint":"/api/base-info/options?root=101.002&lang=en","displayValue":"label","returnValue":"id"},"cmsContentTypes":{"id":"cmsContentTypes","name":"Content Types","endpoint":"/api/base-info/options?root=101.001&lang=en","displayValue":"label","returnValue":"id"},"cmsLanguages":{"id":"cmsLanguages","name":"Languages","endpoint":"/api/base-info/options?root=101.004&lang=en","displayValue":"label","returnValue":"id"},"cmsBodyFormats":{"id":"cmsBodyFormats","name":"Body Formats","endpoint":"/api/base-info/options?root=101.003&lang=en","displayValue":"label","returnValue":"id"},"cmsCommentPolicies":{"id":"cmsCommentPolicies","name":"Comment Policies","endpoint":"/api/base-info/options?root=101.006&lang=en","displayValue":"label","returnValue":"id"}}}, designerStore: designerStore, previewEvents: { patchStore: patchDesignerStore, getDesignerStore: () => designerStore, refreshDataSource: async () => { await refresh_gridData_heroui_app_table_grid_1789450111438_zfqcp(); } } }} />
          </CreateEditModalShell>
        )}
        <div className="flex !h-full !min-h-0 !w-full flex-1 flex-col overflow-hidden bg-white">
          <div className="flex shrink-0 !items-center gap-3 border-b border-slate-200 bg-white !px-3 !py-2.5 sm:!px-5" data-designer-node-id="layout-flex-row-1789450111450-ovw0o">
            <WorkspaceBackIcon aria-label="Back to Contents" title="Back to list" onClick={handleonClick_heroui_button_outline_1789450111454_c527z} />
            <div className="flex !min-w-0 flex-1 !items-center gap-2 overflow-hidden">
              <p className="m-0 !min-w-0 truncate !text-sm !font-semibold leading-none text-slate-800" name="html-text-1789450111460-nrm8f">{regionData_cmsContents_layout_flex_row_1789450111450_ovw0o?.title ?? "Text"}</p>
              <p className="shrink-0 text-slate-300">·</p>
              <p className="shrink-0 font-mono !text-xs !font-medium leading-none text-slate-500">#</p>
              <p className="m-0 shrink-0 font-mono !text-xs !font-medium leading-none text-slate-500" name="html-text-1789450111467-gorth">{regionData_cmsContents_layout_flex_row_1789450111450_ovw0o?.id ?? "Text"}</p>
            </div>
            <Button className="ml-auto inline-flex !h-8 !items-center !justify-center gap-1.5 !rounded-md border border-cyan-200 bg-white !px-2.5 !text-xs !font-semibold text-cyan-700 hover:bg-cyan-50" type="button" aria-label="Edit SEO details" title="Edit SEO details" variant="outline" size="md" onClick={handleonClick_heroui_button_outline_1789450112019_yq0si}><Globe className="h-3.5 w-3.5" /> SEO</Button>
            <Button className="inline-flex !h-8 shrink-0 !items-center !justify-center gap-1.5 !rounded-md bg-indigo-600 !px-3 !text-xs !font-semibold text-white hover:bg-indigo-700" type="button" variant="primary" size="md" href="#" target="_self"><Upload className="h-3.5 w-3.5" /> Upload</Button>
            <Button className="inline-flex !h-8 shrink-0 !items-center !justify-center gap-1.5 !rounded-md bg-indigo-600 !px-3 !text-xs !font-semibold text-white hover:bg-indigo-700" type="submit" form="cms-content-editor-form" variant="primary" size="md" href="#" target="_self"><Save className="h-3.5 w-3.5" /> Save</Button>
          </div>
          <div className="!min-h-0 flex-1 gap-0 overflow-hidden bg-white !w-full grid" style={{ gridTemplateColumns: '1fr 320px' }}>
            <div className="!min-h-0 !min-w-0 overflow-hidden">
              <div className="flex !min-w-0 flex-1 flex-col overflow-hidden bg-white">
                <form className="flex !h-full !min-h-0 !min-w-0 flex-col overflow-hidden" id="cms-content-editor-form" onSubmit={handleonSubmit_html_form_1789450111494_qf1gy} data-designer-node-id="html-form-1789450111494-qf1gy">
                  <div className="flex !min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-white px-[19px] !py-5 sm:px-[27px]">
                    <div className="flex flex-col gap-2">
                      <UiInput className="!rounded-md border border-slate-300 bg-white !px-2.5 !py-px !text-xs text-slate-700" type="text" placeholder="Text input" label="Title" size="sm" value={regionData_cmsContents_html_form_1789450111494_qf1gy?.title} name="heroui-input-text-1789450111505-bpuls" />
                                    {evaluateDesignerCondition(designerStore, dataContext, ({}), "!data.bodyFormatCode || data.bodyFormatCode === '101.003.003' || data.bodyFormatCodeTitle === 'Plain' || data.bodyFormatCodeShortName === 'plain' || (data.bodyFormatCode !== '101.003.002' && data.bodyFormatCode !== '101.003.001' && data.bodyFormatCodeTitle !== 'Markdown' && data.bodyFormatCodeTitle !== 'HTML' && data.bodyFormatCodeShortName !== 'markdown' && data.bodyFormatCodeShortName !== 'html')") && (
                                      <UiTextarea className="!min-h-24 !rounded-md border border-slate-300 bg-white !px-2.5 !py-2 !text-xs text-slate-700" rows={2} placeholder="Text area" label="Summary" size="sm" value={regionData_cmsContents_html_form_1789450111494_qf1gy?.summary} name="heroui-textarea-1789450111508-c464e" />
                                    )}
                                    {evaluateDesignerCondition(designerStore, dataContext, ({}), "(data.bodyFormatCode === '101.003.002' || data.bodyFormatCodeTitle === 'Markdown' || data.bodyFormatCodeShortName === 'markdown')") && (
                                      <DesignerMarkdownEditorField className="!w-full" value={regionData_cmsContents_html_form_1789450111494_qf1gy?.summary} name="form-markdown-editor-1789450111512-plaim" label="Summary (markdown)" placeholder="Write in Markdown…" editorHeight={220} fontSize={14} showToolbar={true} enableBold={true} enableItalic={true} enableUnderline={true} enableStrike={true} enableInlineCode={true} enableSubscript={true} enableSuperscript={true} enableTextColor={true} enableHighlight={true} enableHeading={true} enableBulletList={true} enableOrderedList={true} enableTaskList={true} enableBlockquote={true} enableCodeBlock={true} enableHorizontalRule={true} enableTextAlign={true} enableTextDirection={true} enableIndent={true} enableLink={true} enableImage={false} enableTable={false} enableClearFormatting={true} enableUndoRedo={true} readOnly={false} />
                                    )}
                                    {evaluateDesignerCondition(designerStore, dataContext, ({}), "(data.bodyFormatCode === '101.003.001' || data.bodyFormatCodeTitle === 'HTML' || data.bodyFormatCodeShortName === 'html')") && (
                                      <DesignerHtmlEditorField className="!w-full" value={regionData_cmsContents_html_form_1789450111494_qf1gy?.summary} name="form-html-editor-1789450111517-k6i5u" label="Summary (html)" placeholder="Start writing…" editorHeight={220} fontSize={14} showToolbar={true} enableBold={true} enableItalic={true} enableUnderline={true} enableStrike={true} enableInlineCode={true} enableSubscript={true} enableSuperscript={true} enableTextColor={true} enableHighlight={true} enableHeading={true} enableBulletList={true} enableOrderedList={true} enableTaskList={true} enableBlockquote={true} enableCodeBlock={true} enableHorizontalRule={true} enableTextAlign={true} enableTextDirection={true} enableIndent={true} enableLink={true} enableImage={true} enableTable={true} enableClearFormatting={true} enableUndoRedo={true} readOnly={false} />
                                    )}
                                    {evaluateDesignerCondition(designerStore, dataContext, ({}), "!data.bodyFormatCode || data.bodyFormatCode === '101.003.003' || data.bodyFormatCodeTitle === 'Plain' || data.bodyFormatCodeShortName === 'plain' || (data.bodyFormatCode !== '101.003.002' && data.bodyFormatCode !== '101.003.001' && data.bodyFormatCodeTitle !== 'Markdown' && data.bodyFormatCodeTitle !== 'HTML' && data.bodyFormatCodeShortName !== 'markdown' && data.bodyFormatCodeShortName !== 'html')") && (
                                      <UiTextarea className="h-[7.5rem] min-h-[7.5rem] max-h-[7.5rem]" rows={5} placeholder="Text area" label="Body (plain)" size="sm" style={{ height: '7.5rem' }} value={regionData_cmsContents_html_form_1789450111494_qf1gy?.body} name="heroui-textarea-1789450111526-f0rqq" />
                                    )}
                                    {evaluateDesignerCondition(designerStore, dataContext, ({}), "(data.bodyFormatCode === '101.003.002' || data.bodyFormatCodeTitle === 'Markdown' || data.bodyFormatCodeShortName === 'markdown')") && (
                                      <DesignerMarkdownEditorField className="!w-full" value={regionData_cmsContents_html_form_1789450111494_qf1gy?.body} name="form-markdown-editor-1789450111532-qb024" label="Body (markdown)" placeholder="Write in Markdown…" editorHeight={220} fontSize={14} showToolbar={true} enableBold={true} enableItalic={true} enableUnderline={true} enableStrike={true} enableInlineCode={true} enableSubscript={true} enableSuperscript={true} enableTextColor={true} enableHighlight={true} enableHeading={true} enableBulletList={true} enableOrderedList={true} enableTaskList={true} enableBlockquote={true} enableCodeBlock={true} enableHorizontalRule={true} enableTextAlign={true} enableTextDirection={true} enableIndent={true} enableLink={true} enableImage={false} enableTable={false} enableClearFormatting={true} enableUndoRedo={true} readOnly={false} />
                                    )}
                                    {evaluateDesignerCondition(designerStore, dataContext, ({}), "(data.bodyFormatCode === '101.003.001' || data.bodyFormatCodeTitle === 'HTML' || data.bodyFormatCodeShortName === 'html')") && (
                                      <DesignerHtmlEditorField className="!w-full" value={regionData_cmsContents_html_form_1789450111494_qf1gy?.body} name="form-html-editor-1789450111538-627pk" label="Body (html)" placeholder="Start writing…" editorHeight={220} fontSize={14} showToolbar={true} enableBold={true} enableItalic={true} enableUnderline={true} enableStrike={true} enableInlineCode={true} enableSubscript={true} enableSuperscript={true} enableTextColor={true} enableHighlight={true} enableHeading={true} enableBulletList={true} enableOrderedList={true} enableTaskList={true} enableBlockquote={true} enableCodeBlock={true} enableHorizontalRule={true} enableTextAlign={true} enableTextDirection={true} enableIndent={true} enableLink={true} enableImage={true} enableTable={true} enableClearFormatting={true} enableUndoRedo={true} readOnly={false} />
                                    )}
                    </div>
                    <DesignerCmsContentAssetsField className="!w-full !min-w-0 !pt-3" />
                  </div>
                </form>
              </div>
            </div>
            <div className="!min-h-0 !min-w-0 overflow-hidden">
              <div className="flex !h-full !min-h-0 !min-w-0 flex-col gap-3 overflow-y-auto border-s border-slate-200 bg-slate-50 !px-3 !pb-4 pt-[10px]">
                <div className="flex !w-full shrink-0 !items-center gap-1.5">
                  <Button className="inline-flex !h-8 !min-w-0 flex-1 !items-center !justify-start gap-1.5 !rounded-md border border-violet-200 bg-violet-50 !px-2.5 !text-xs !font-semibold text-violet-700 outline-none transition-colors hover:bg-violet-100" type="button" aria-label="Open comments" title="Open comments" variant="outline" size="md" onClick={handleonClick_heroui_button_outline_1789450111481_vgf83}><MessageSquare className="h-3.5 w-3.5" /> Comments</Button>
                  <Button className="inline-flex !h-8 !w-8 shrink-0 !items-center !justify-center !rounded-md border border-violet-200 bg-violet-50 text-violet-700 outline-none transition-colors hover:bg-violet-100" type="button" aria-label="Comments policy" title="Comments policy" variant="outline" size="md" isIconOnly onClick={handleonClick_heroui_button_outline_1789450111487_q6ss8}><SlidersHorizontal className="h-3.5 w-3.5" /></Button>
                </div>
                <div className="flex flex-col space-y-2 !pt-3">
                  <div className="flex !min-h-4 !items-center gap-0.5 ps-[4px]">
                    <p className="border-s-2 !ps-1.5 text-[11px] !font-bold uppercase tracking-wider leading-none text-violet-700 border-violet-400">Tags</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <DesignerRelationTagsListField className="!w-full !min-w-0" />
                  </div>
                </div>
                <div className="flex flex-col space-y-2">
                  <div className="flex !min-h-4 !items-center !justify-between gap-1 ps-[4px]">
                    <p className="border-s-2 !ps-1.5 text-[11px] !font-bold uppercase tracking-wider leading-none text-slate-700 border-slate-400">Identity</p>
                    <Button className="inline-flex !h-6 shrink-0 !items-center !justify-center gap-1 !rounded border border-slate-200 bg-white !px-1.5 text-[12px] !font-semibold leading-none text-slate-700 outline-none hover:bg-slate-50 [&>svg]:block [&>svg]:h-3 [&>svg]:w-3 [&>svg]:shrink-0" type="button" aria-label="Edit identity" title="Edit identity" variant="outline" size="md" onClick={handleonClick_heroui_button_outline_1789450111582_z5yn9}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                  </div>
                  <div className="flex flex-col gap-2">
                    <form className="flex !min-w-0 flex-col gap-2" data-designer-node-id="html-form-1789450111593-zd0bw">
                      <div className="flex !min-w-0 !items-center !justify-between gap-3 overflow-hidden ps-[4px]">
                        <p className="text-[11px] !font-normal normal-case tracking-normal text-slate-500">Content ID</p>
                        <p className="!min-w-0 overflow-hidden break-words text-[11px] !font-bold text-slate-800 !text-end" name="html-text-1789450111604-bbios">{regionData_cmsContents_html_form_1789450111593_zd0bw?.id ?? "Text"}</p>
                      </div>
                      <div className="flex !min-w-0 !items-center !justify-between gap-3 overflow-hidden ps-[4px]">
                        <p className="text-[11px] !font-normal normal-case tracking-normal text-slate-500">Content type</p>
                        <p className="!min-w-0 overflow-hidden break-words text-[11px] !font-bold text-slate-800 !text-end" name="html-text-1789450111618-9my92">{regionData_cmsContents_html_form_1789450111593_zd0bw?.contentTypeCodeTitle ?? "Text"}</p>
                      </div>
                      <div className="flex !min-w-0 !items-center !justify-between gap-3 overflow-hidden ps-[4px]">
                        <p className="text-[11px] !font-normal normal-case tracking-normal text-slate-500">Language</p>
                        <p className="!min-w-0 overflow-hidden break-words text-[11px] !font-bold text-slate-800 !text-end" name="html-text-1789450111629-myoeq">{regionData_cmsContents_html_form_1789450111593_zd0bw?.languageCodeTitle ?? "Text"}</p>
                      </div>
                    </form>
                  </div>
                </div>
                <div className="flex flex-col space-y-2 !pt-3">
                  <div className="flex !min-h-4 !items-center !justify-between gap-1 ps-[4px]">
                    <p className="border-s-2 !ps-1.5 text-[11px] !font-bold uppercase tracking-wider leading-none text-emerald-800 border-emerald-600">Last State</p>
                    <Button className="inline-flex !h-6 shrink-0 !items-center !justify-center gap-1 !rounded border border-slate-200 bg-white !px-1.5 text-[12px] !font-semibold leading-none text-slate-700 outline-none hover:bg-slate-50 [&>svg]:block [&>svg]:h-3 [&>svg]:w-3 [&>svg]:shrink-0" type="button" aria-label="Change status" title="Change status" variant="outline" size="md" onClick={handleonClick_heroui_button_outline_1789450111650_2plsz}><RefreshCw className="h-3.5 w-3.5" /> Change</Button>
                  </div>
                  <div className="flex flex-col gap-2">
                    <form className="flex !min-w-0 flex-col gap-2" data-designer-node-id="html-form-1789450111661-toah3">
                      <div className="flex !min-w-0 !items-center !justify-between gap-3 overflow-hidden ps-[4px]">
                        <p className="text-[11px] !font-normal normal-case tracking-normal text-slate-500">Status</p>
                        <Button className="pointer-events-none inline-flex shrink-0 !items-center !justify-end gap-1 border-0 bg-transparent !p-0 text-[11px] !font-semibold leading-none !shadow-none" contentStatusTrigger contentStatusDisplay type="button" tabIndex={-1} aria-label="Current status" variant="outline" size="md" text={regionData_cmsContents_html_form_1789450111661_toah3?.statusCodeTitle} name="heroui-button-outline-1789450111674-ny6b3"><CircleDot className="h-3.5 w-3.5" /> Status</Button>
                      </div>
                      <div className="flex !min-w-0 !items-center !justify-between gap-3 overflow-hidden ps-[4px]">
                        <p className="text-[11px] !font-normal normal-case tracking-normal text-slate-500">Updated at</p>
                        <p className="!min-w-0 overflow-hidden break-words text-[11px] !font-bold text-slate-800 !text-end" name="html-text-1789450111701-785v1">{regionData_cmsContents_html_form_1789450111661_toah3?.statusCodeUpdatedAt ?? "Text"}</p>
                      </div>
                      <div className="flex !min-w-0 !items-center !justify-between gap-3 overflow-hidden ps-[4px]">
                        <p className="text-[11px] !font-normal normal-case tracking-normal text-slate-500">Updated by</p>
                        <p className="!min-w-0 overflow-hidden break-words text-[11px] !font-bold text-slate-800 !text-end" name="html-text-1789450111717-q66il">{regionData_cmsContents_html_form_1789450111661_toah3?.statusCodeUpdatedByUsername ?? "Text"}</p>
                      </div>
                    </form>
                  </div>
                </div>
                <div className="flex flex-col space-y-2 !pt-3">
                  <div className="flex !min-h-4 !items-center !justify-between gap-1 ps-[4px]">
                    <p className="border-s-2 !ps-1.5 text-[11px] !font-bold uppercase tracking-wider leading-none text-emerald-800 border-emerald-600">Related contents</p>
                    <Button className="inline-flex !h-6 shrink-0 !items-center !justify-center gap-1 !rounded border border-slate-200 bg-white !px-1.5 text-[12px] !font-semibold leading-none text-slate-700 outline-none hover:bg-slate-50 [&>svg]:block [&>svg]:h-3 [&>svg]:w-3 [&>svg]:shrink-0" type="button" variant="outline" size="md" onClick={handleonClick_heroui_button_outline_1789450111742_c609u}><Plus className="h-3.5 w-3.5" /> Add</Button>
                  </div>
                  <div className="flex !min-w-0 flex-col gap-0">
                    <AppTableGrid className="hidden" showPagingFooter={false} defaultSortDirection="asc" presentation="cards" cardBelow="tablet" columns={gridColumns_heroui_app_table_grid_1789450111752_x73vl} rows={gridPaging_heroui_app_table_grid_1789450111752_x73vl.displayRows} getRowKey={(row) => String((row as Record<string, unknown>)["id"] ?? '')} enableColumnLayout={false} columnLayout={gridColumnLayout_heroui_app_table_grid_1789450111752_x73vl} onColumnLayoutChange={setGridColumnLayout_heroui_app_table_grid_1789450111752_x73vl} isLoading={false} loadingMessage={"Loading records…"} emptyMessage={"No records found"} isEmpty={gridAggregatedRows_heroui_app_table_grid_1789450111752_x73vl.length === 0} errorContent={gridAggregatedRows_heroui_app_table_grid_1789450111752_x73vl.length === 0 ? undefined : "Could not load records"} gridQueryMode={"client"} query={gridQuery_heroui_app_table_grid_1789450111752_x73vl} onQueryChange={handleGridQueryChange_heroui_app_table_grid_1789450111752_x73vl} onGridRowAction={handleGridRowAction_heroui_app_table_grid_1789450111752_x73vl} footer={<GridPagingFooter totalCount={gridTotalCount_heroui_app_table_grid_1789450111752_x73vl} safePage={gridPaging_heroui_app_table_grid_1789450111752_x73vl.safePage} pageSize={gridPageSize_heroui_app_table_grid_1789450111752_x73vl} onPageSizeChange={handleGridPageSizeChange_heroui_app_table_grid_1789450111752_x73vl} sortBy={gridQuery_heroui_app_table_grid_1789450111752_x73vl.sort?.columnId ?? ''} sortOptions={[{"value":"created_at","label":"Created"},{"value":"name","label":"Name"},{"value":"status","label":"Status"}]} onSortByChange={handleGridSortByChange_heroui_app_table_grid_1789450111752_x73vl} sortDirection={gridQuery_heroui_app_table_grid_1789450111752_x73vl.sort?.direction ?? 'asc'} onToggleSortDirection={handleGridToggleSortDirection_heroui_app_table_grid_1789450111752_x73vl} showSortControls={false} totalPages={gridPaging_heroui_app_table_grid_1789450111752_x73vl.totalPages} pageNumbers={buildDataGridPageNumbers(gridPaging_heroui_app_table_grid_1789450111752_x73vl.safePage, gridPaging_heroui_app_table_grid_1789450111752_x73vl.totalPages)} onPageChange={handleGridPageChange_heroui_app_table_grid_1789450111752_x73vl} visibleInfiniteCount={gridListMode_heroui_app_table_grid_1789450111752_x73vl === 'infinite' ? gridPaging_heroui_app_table_grid_1789450111752_x73vl.displayRows.length : undefined} />} />
                    <DesignerRelatedContentsListField className="!w-full !min-w-0" />
                  </div>
                </div>
                <div className="flex flex-col space-y-2 !pt-3">
                  <div className="flex !min-h-4 !items-center gap-0.5 ps-[4px]">
                    <p className="border-s-2 !ps-1.5 text-[11px] !font-bold uppercase tracking-wider leading-none text-slate-700 border-slate-400">Operator note</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <form className="!min-w-0" data-designer-node-id="html-form-1789450111826-ou8ea">
                      <Button className="flex !min-h-11 !h-auto !w-full cursor-pointer !items-start !justify-start whitespace-pre-wrap !rounded-md border border-dashed border-slate-200 bg-white !px-3 !py-2 !text-start !text-xs !font-normal leading-relaxed text-slate-700 outline-none transition-colors hover:border-slate-300 hover:bg-slate-50" type="button" directionalText variant="outline" size="md" text={regionData_cmsContents_html_form_1789450111826_ou8ea?.operatorNote} onClick={handleonClick_heroui_button_outline_1789450111831_9uare} name="heroui-button-outline-1789450111831-9uare">No operator note yet. Click to add one.</Button>
                    </form>
                  </div>
                </div>
                <div className="flex flex-col space-y-2 !pt-3">
                  <div className="flex !min-h-4 !items-center gap-0.5 ps-[4px]">
                    <p className="border-s-2 !ps-1.5 text-[11px] !font-bold uppercase tracking-wider leading-none text-amber-700 border-amber-400">Audit trail</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <form className="flex !min-w-0 flex-col gap-2" data-designer-node-id="html-form-1789450111873-k1gab">
                      <div className="flex !min-w-0 !items-center !justify-between gap-3 overflow-hidden ps-[4px]">
                        <p className="text-[11px] !font-normal normal-case tracking-normal text-slate-500">Created at</p>
                        <p className="!min-w-0 overflow-hidden break-words text-[11px] !font-bold text-slate-800 !text-end" name="html-text-1789450111892-k43um">{regionData_cmsContents_html_form_1789450111873_k1gab?.createdAt ?? "Text"}</p>
                      </div>
                      <div className="flex !min-w-0 !items-center !justify-between gap-3 overflow-hidden ps-[4px]">
                        <p className="text-[11px] !font-normal normal-case tracking-normal text-slate-500">Created by</p>
                        <p className="!min-w-0 overflow-hidden break-words text-[11px] !font-bold text-slate-800 !text-end" name="html-text-1789450111914-7tng1">{regionData_cmsContents_html_form_1789450111873_k1gab?.createdByUsername ?? "Text"}</p>
                      </div>
                      <div className="flex !min-w-0 !items-center !justify-between gap-3 overflow-hidden ps-[4px]">
                        <p className="text-[11px] !font-normal normal-case tracking-normal text-slate-500">Updated at</p>
                        <p className="!min-w-0 overflow-hidden break-words text-[11px] !font-bold text-slate-800 !text-end" name="html-text-1789450111939-kpc9d">{regionData_cmsContents_html_form_1789450111873_k1gab?.updatedAt ?? "Text"}</p>
                      </div>
                      <div className="flex !min-w-0 !items-center !justify-between gap-3 overflow-hidden ps-[4px]">
                        <p className="text-[11px] !font-normal normal-case tracking-normal text-slate-500">Updated by</p>
                        <p className="!min-w-0 overflow-hidden break-words text-[11px] !font-bold text-slate-800 !text-end" name="html-text-1789450111962-27mp5">{regionData_cmsContents_html_form_1789450111873_k1gab?.updatedByUsername ?? "Text"}</p>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "(store.ui.visibility.node-e70a0faf-8a0e-48ab-be4b-714e250f62ab === true) && (store.ui.visibility.node-e70a0faf-8a0e-48ab-be4b-714e250f62ab !== false)") && (
          <CreateEditModalShell size="maximized" isOpen={false} backdrop="blur" scrollBehavior="inside" relatedContentPickerHost>
          <form className="flex !min-h-0 flex-col gap-0 bg-white" method="post" id="node-8f1bd58a-1304-4a6e-a3dc-3aeebe09c9f3" data-designer-node-id="node-8f1bd58a-1304-4a6e-a3dc-3aeebe09c9f3">
            <div className="flex !min-w-0 flex-col gap-2 bg-white p-[15px]">
              <div />
            </div>
          </form>
          <div className="flex !w-full shrink-0 !items-center !justify-end gap-2">
            <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 border border-slate-200 text-slate-600 hover:bg-slate-100" variant="outline" size="md" onClick={handleonClick_node_11bfd775_950b_4483_b0d3_45ab36ea9a0b}><X className="h-3.5 w-3.5" /> Cancel</Button>
            <Button type="submit" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 bg-primary-600 hover:bg-primary-700 text-white" form="node-8f1bd58a-1304-4a6e-a3dc-3aeebe09c9f3" variant="primary" size="md" href="#" target="_self" isDisabled={isSubmitting} onClick={handleonClick_node_8a4df565_c521_4639_89d4_6eaf03e912fb}><Plus className="h-3.5 w-3.5" /> Create relation</Button>
          </div>
        </CreateEditModalShell>
        )}
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "(store.ui.visibility.node-a2b0c03b-81d1-40fa-a5fb-18df18d78d74 === true) && (store.ui.visibility.node-a2b0c03b-81d1-40fa-a5fb-18df18d78d74 !== false)") && (
          <ConfirmDialogShell title={"Delete relation?"} size="sm" onClose={() => { patchDesignerStore("ui.visibility.node-a2b0c03b-81d1-40fa-a5fb-18df18d78d74", false); }} onBackdropClick={() => { patchDesignerStore("ui.visibility.node-a2b0c03b-81d1-40fa-a5fb-18df18d78d74", false); }} tone="danger" hideCancel hideConfirm icon={<Trash2 className="h-4 w-4" />} bodyClassName="!p-0" footerClassName="!mt-0">
            <p className="block p-[15px] !text-sm text-slate-700">Delete this relation? This cannot be undone.</p>
            <div className="flex !w-full shrink-0 !items-center !justify-end gap-2">
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 border border-slate-200 text-slate-600 hover:bg-slate-100" variant="outline" size="md" onClick={handleonClick_node_9a534409_c686_4a2d_a8bf_cf516e793a8f}><X className="h-3.5 w-3.5" /> Cancel</Button>
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 bg-rose-600 hover:bg-rose-700 text-white" variant="primary" size="md" onClick={handleonClick_node_5c02af3a_a4c9_46fc_80de_6dcef70ee5db}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
            </div>
          </ConfirmDialogShell>
        )}
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "(store.ui.visibility.node-ed5f3873-c218-4af2-b9a4-5e17460092a4 === true) && (store.ui.visibility.node-ed5f3873-c218-4af2-b9a4-5e17460092a4 !== false)") && (
          <CreateEditModalShell title={"Edit content identity"} size="lg" onClose={() => { patchDesignerStore("ui.visibility.node-ed5f3873-c218-4af2-b9a4-5e17460092a4", false); }} onBackdropClick={() => { patchDesignerStore("ui.visibility.node-ed5f3873-c218-4af2-b9a4-5e17460092a4", false); }} gradient={false} bodyOuterClassName="-mb-[15px]" bodyClassName="!p-0" footerClassName="!mt-0">
            <form className="flex !min-h-0 flex-col gap-0 bg-white" method="post" id="node-5a32780c-ac4e-472a-a412-e47f560f21a8" data-designer-node-id="node-5a32780c-ac4e-472a-a412-e47f560f21a8">
              <div className="flex !min-w-0 flex-col gap-2 bg-white p-[15px]">
                <UiSelect isRequired className="!w-full" placeholder="Select content type…" label="Content Type" size="sm" data-page-guide="" data-page-guide-title="Content Type" data-page-guide-hint="Required. Enter content Type." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" selectedKeys={regionData_cmsContents_node_5a32780c_ac4e_472a_a412_e47f560f21a8?.contentTypeCode} name="node-7aa5deca-8eb1-4221-9bb4-869057291ff0">{mapDesignerLovItems(dataContext?.items, "id", "label").map((item) => (<option key={item.id} value={item.id}>{item.textValue}</option>))}</UiSelect>
                <UiSelect isRequired className="!w-full" placeholder="Select language…" label="Language" size="sm" data-page-guide="" data-page-guide-title="Language" data-page-guide-hint="Required. Enter language." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" selectedKeys={regionData_cmsContents_node_5a32780c_ac4e_472a_a412_e47f560f21a8?.languageCode} name="node-bc2b8df7-2edc-4312-917b-ec201177a4ef">{mapDesignerLovItems(fetchData_1?.items, "id", "label").map((item) => (<option key={item.id} value={item.id}>{item.textValue}</option>))}</UiSelect>
              </div>
            </form>
            <div className="flex !w-full shrink-0 !items-center !justify-end gap-2">
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 border border-slate-200 text-slate-600 hover:bg-slate-100" variant="outline" size="md" onClick={handleonClick_node_1e314726_f2d1_4bd3_98a8_68f60ffb47f7}><X className="h-3.5 w-3.5" /> Cancel</Button>
              <Button type="submit" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 bg-primary-600 hover:bg-primary-700 text-white" form="node-5a32780c-ac4e-472a-a412-e47f560f21a8" variant="primary" size="md" href="#" target="_self" isDisabled={isSubmitting} onClick={handleonClick_node_eb7f5bdc_963c_4172_8623_0b8242a85818}><Save className="h-3.5 w-3.5" /> Save identity</Button>
            </div>
          </CreateEditModalShell>
        )}
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "(store.ui.visibility.node-2e8a02de-78d1-4326-8006-64ba59b78a52 === true) && (store.ui.visibility.node-2e8a02de-78d1-4326-8006-64ba59b78a52 !== false)") && (
          <CreateEditModalShell title={"Edit SEO details"} size="lg" onClose={() => { patchDesignerStore("ui.visibility.node-2e8a02de-78d1-4326-8006-64ba59b78a52", false); }} onBackdropClick={() => { patchDesignerStore("ui.visibility.node-2e8a02de-78d1-4326-8006-64ba59b78a52", false); }} gradient={false} bodyOuterClassName="-mb-[15px]" bodyClassName="!p-0" footerClassName="!mt-0">
            <form className="flex !min-h-0 flex-col gap-0 bg-white" method="post" id="node-25bf5fda-f269-497e-ac69-9425762963d1" data-designer-node-id="node-25bf5fda-f269-497e-ac69-9425762963d1">
              <div className="flex !min-w-0 flex-col gap-2 bg-white p-[15px]">
                <UiInput isRequired autoDir={false} type="text" placeholder="Slug" label="Slug" size="sm" data-page-guide="" data-page-guide-title="Slug" data-page-guide-hint="Required. Enter slug." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_cmsContents_node_25bf5fda_f269_497e_ac69_9425762963d1?.slug} name="node-e981680a-6445-4bcd-9ff8-073ca1d4d787" />
                <UiInput type="text" placeholder="SEO title" label="SEO title" size="sm" data-page-guide="" data-page-guide-title="SEO title" data-page-guide-hint="Enter sEO title." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_cmsContents_node_25bf5fda_f269_497e_ac69_9425762963d1?.seoTitle} name="node-56a849f1-444d-48b0-8578-f7a23008ba44" />
                <UiTextarea placeholder="SEO description" label="SEO description" rows={3} size="sm" data-page-guide="" data-page-guide-title="SEO description" data-page-guide-hint="Enter sEO description." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" value={regionData_cmsContents_node_25bf5fda_f269_497e_ac69_9425762963d1?.seoNote} name="node-681ffc11-d972-42e9-888c-4a77ae1a4892" />
              </div>
            </form>
            <div className="flex !w-full shrink-0 !items-center !justify-end gap-2">
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 border border-slate-200 text-slate-600 hover:bg-slate-100" variant="outline" size="md" onClick={handleonClick_node_b7037fe7_491f_4304_9406_2947a8a44248}><X className="h-3.5 w-3.5" /> Cancel</Button>
              <Button type="submit" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 bg-primary-600 hover:bg-primary-700 text-white" form="node-25bf5fda-f269-497e-ac69-9425762963d1" variant="primary" size="md" href="#" target="_self" isDisabled={isSubmitting} onClick={handleonClick_node_d8e6964d_1039_4dae_8f50_13bc28517329}><Save className="h-3.5 w-3.5" /> Save SEO</Button>
            </div>
          </CreateEditModalShell>
        )}
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "(store.ui.visibility.node-1edbd738-ff57-478e-b085-0586517e0c18 === true) && (store.ui.visibility.node-1edbd738-ff57-478e-b085-0586517e0c18 !== false)") && (
          <CreateEditModalShell title={"Edit operator note"} size="xl" onClose={() => { patchDesignerStore("ui.visibility.node-1edbd738-ff57-478e-b085-0586517e0c18", false); }} onBackdropClick={() => { patchDesignerStore("ui.visibility.node-1edbd738-ff57-478e-b085-0586517e0c18", false); }} gradient={false} bodyOuterClassName="-mb-[15px]" bodyClassName="!p-0" footerClassName="!mt-0">
            <form className="flex !min-h-0 flex-col gap-0 bg-white" method="post" id="node-7aa755e3-9d44-4f35-b5c5-0b90b63c80f9" data-designer-node-id="node-7aa755e3-9d44-4f35-b5c5-0b90b63c80f9">
              <div className="flex !min-w-0 flex-col gap-2 bg-white p-[15px]">
                <UiTextarea className="!min-h-40 !w-full" placeholder="Operator note" rows={7} size="sm" value={regionData_cmsContents_node_7aa755e3_9d44_4f35_b5c5_0b90b63c80f9?.operatorNote} name="node-31fee7d1-0a35-43c4-ab63-ad8d31fd711e" />
              </div>
            </form>
            <div className="flex !w-full shrink-0 !items-center !justify-end gap-2">
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 border border-slate-200 text-slate-600 hover:bg-slate-100" variant="outline" size="md" onClick={handleonClick_node_29b284d0_457b_4333_b0bf_6df55069f2fe}><X className="h-3.5 w-3.5" /> Cancel</Button>
              <Button type="submit" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 bg-primary-600 hover:bg-primary-700 text-white" form="node-7aa755e3-9d44-4f35-b5c5-0b90b63c80f9" variant="primary" size="md" href="#" target="_self" isDisabled={isSubmitting} onClick={handleonClick_node_99a05b1a_cdef_47be_ad8e_877d038e71d5}><Save className="h-3.5 w-3.5" /> Save note</Button>
            </div>
          </CreateEditModalShell>
        )}
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "(store.ui.visibility.node-6e92a049-f429-49f9-9acb-81a2aa13460b === true) && (store.ui.visibility.node-6e92a049-f429-49f9-9acb-81a2aa13460b !== false)") && (
          <CreateEditModalShell title={"Content preferences"} size="lg" onClose={() => { patchDesignerStore("ui.visibility.node-6e92a049-f429-49f9-9acb-81a2aa13460b", false); }} onBackdropClick={() => { patchDesignerStore("ui.visibility.node-6e92a049-f429-49f9-9acb-81a2aa13460b", false); }} gradient={false} bodyOuterClassName="-mb-[15px]" bodyClassName="!p-0" footerClassName="!mt-0">
            <form className="flex !min-h-0 flex-col gap-0 bg-white" method="post" id="node-46bbe401-a0f2-4fab-affc-9c69baff1d13" data-designer-node-id="node-46bbe401-a0f2-4fab-affc-9c69baff1d13">
              <div className="flex !min-w-0 flex-col gap-2 bg-white p-[15px]">
                <UiSelect className="!w-full" placeholder="Use site default" label="Comments" size="sm" data-page-guide="" data-page-guide-title="Comments" data-page-guide-hint="Enter comments." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" selectedKeys={regionData_cmsContents_node_46bbe401_a0f2_4fab_affc_9c69baff1d13?.commentsEnabled} name="node-5c0841ff-6c01-4533-9f49-b9655e618a45"><option value="true">Enabled</option><option value="false">Disabled</option></UiSelect>
                <UiSelect className="!w-full" placeholder="Use site default" label="Publishing policy" size="sm" data-page-guide="" data-page-guide-title="Publishing policy" data-page-guide-hint="Enter publishing policy." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" selectedKeys={regionData_cmsContents_node_46bbe401_a0f2_4fab_affc_9c69baff1d13?.commentsPolicyCode} name="node-25862094-6c90-4e8b-bdf6-e4f558bc06c1"><option value="101.006.001">Automatic</option><option value="101.006.002">Approve</option></UiSelect>
                <UiSelect className="!w-full" placeholder="Use site default" label="Comment body format" size="sm" data-page-guide="" data-page-guide-title="Comment body format" data-page-guide-hint="Enter comment body format." data-page-guide-priority="50" data-page-guide-scope="local" data-page-guide-topic="page" data-page-guide-surface="" selectedKeys={regionData_cmsContents_node_46bbe401_a0f2_4fab_affc_9c69baff1d13?.commentsBodyFormatCode} name="node-d7ad453b-ebb3-4bf2-86a3-d733007f5cf3"><option value="101.003.001">HTML</option><option value="101.003.003">Plain</option></UiSelect>
              </div>
            </form>
            <div className="flex !w-full shrink-0 !items-center !justify-end gap-2">
              <Button type="button" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 border border-slate-200 text-slate-600 hover:bg-slate-100" variant="outline" size="md" onClick={handleonClick_node_854b692f_510e_488c_bd5e_0f6da3fd5d49}><X className="h-3.5 w-3.5" /> Cancel</Button>
              <Button type="submit" className="inline-flex !items-center !justify-center gap-1.5 !h-8 !px-3 !rounded-md !text-xs !font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:!opacity-50 [@media(pointer:coarse)]:min-h-11 bg-primary-600 hover:bg-primary-700 text-white" form="node-46bbe401-a0f2-4fab-affc-9c69baff1d13" variant="primary" size="md" href="#" target="_self" isDisabled={isSubmitting} onClick={handleonClick_node_98f2e118_df75_487d_bb2c_fa8ffedf9751}><Save className="h-3.5 w-3.5" /> Save preferences</Button>
            </div>
          </CreateEditModalShell>
        )}
        {evaluateDesignerCondition(designerStore, dataContext, ({}), "(store.ui.visibility.node-3cc49ae6-541a-4550-bedf-4f1de8e15b3d === true) && (store.ui.visibility.node-3cc49ae6-541a-4550-bedf-4f1de8e15b3d !== false)") && (
          <CreateEditModalShell title={"Change status"} size="lg" onClose={() => { patchDesignerStore("ui.visibility.node-3cc49ae6-541a-4550-bedf-4f1de8e15b3d", false); }} onBackdropClick={() => { patchDesignerStore("ui.visibility.node-3cc49ae6-541a-4550-bedf-4f1de8e15b3d", false); }} gradient={false} bodyOuterClassName="-mb-[15px]" bodyClassName="!p-0" footerClassName="!mt-0">
            <DesignerRuntimeContentStatusPicker node={{"id":"node-64c1b244-ad8d-4118-b742-0241aead9480","type":"container","props":{"className":"flex flex-col gap-2 bg-white p-[15px]","contentStatusPicker":true,"contentStatusPickerLovRef":"cmsStatuses","contentStatusPickerDataSourceRef":"cmsContents","contentStatusPickerRecordIdPath":"routeParams.id","contentStatusPickerModalNodeId":"node-3cc49ae6-541a-4550-bedf-4f1de8e15b3d","contentStatusPickerSuccessToast":"Status updated","_designerPaletteItemId":"layout.flex-column","_isBuiltInTemplateRoot":true,"twDisplay":"flex","twPosition":"","twOverflow":"","twPadding":"","twMargin":"","twWidth":"","twHeight":"","twFlexDirection":"flex-col","twItems":"","twJustify":"","twGap":"gap-2","twGridCols":"","twTextSize":"","twFontWeight":"","twTextAlign":"","twRounded":"","twShadow":"","twOpacity":""},"parentId":"node-3cc49ae6-541a-4550-bedf-4f1de8e15b3d","order":0,"layout":{},"binding":{},"children":[]} as any} options={{ mode: 'runtime', bindingDefinitions: {"definitions":{"defaultVisibility":{"sourceType":"static","sourcePath":"true","fallbackValue":true}},"storeSegments":{"selection":{"id":"selection","initialValue":{"id":null},"persist":"none"}},"dataSources":{"cmsContents":{"id":"cmsContents","name":"CMS Contents","endpoint":"/api/cms/contents","fields":["id","title","slug","summary","body","contentTypeCode","languageCode","statusCode","statusCodeUpdatedAt","statusCodeUpdatedBy","statusCodeUpdatedByUsername","bodyFormatCode","commentCount","revisionCount","tagSummary","contentTypeCodeTitle","languageCodeTitle","statusCodeTitle","statusCodeUiHtml","statusCodeUiColor","bodyFormatCodeTitle","bodyFormatCodeShortName","commentsPolicyCodeTitle","seoTitle","seoNote","publishedAt","operatorNote","commentsEnabled","commentsPolicyCode","commentsBodyFormatCode","createdBy","createdByUsername","createdAt","updatedBy","updatedByUsername","updatedAt"],"primaryKey":"id","kind":"collection","operations":{"list":{"method":"GET","endpoint":"/api/cms/contents"},"detail":{"method":"GET","endpoint":"/api/cms/contents/:id"},"create":{"method":"POST","endpoint":"/api/cms/contents"},"update":{"method":"PUT","endpoint":"/api/cms/contents/:id"},"delete":{"method":"DELETE","endpoint":"/api/cms/contents/:id"}},"responseMapping":{"dataPath":"data","arrayPath":"data","totalPath":"count"}},"cmsContentAssets":{"id":"cmsContentAssets","name":"CMS Content Assets","endpoint":"/api/cms/assets","fields":["id","contentId","fileName","fileMime","fileSize","file","fileXs","sha256","sortOrder","createdAt","updatedAt"],"primaryKey":"id","kind":"collection","operations":{"list":{"method":"GET","endpoint":"/api/cms/assets"},"create":{"method":"POST","endpoint":"/api/cms/assets"},"update":{"method":"PUT","endpoint":"/api/cms/assets/:id"},"delete":{"method":"DELETE","endpoint":"/api/cms/assets/:pk"}},"responseMapping":{"dataPath":"data","arrayPath":"data","totalPath":"count"}},"cmsContentRelations":{"id":"cmsContentRelations","name":"CMS Content Relations","endpoint":"/api/cms/relations","fields":["id","contentIdA","contentIdATitle","contentIdASlug","contentIdB","contentIdBTitle","contentIdBSlug","note"],"primaryKey":"id","kind":"collection","operations":{"list":{"method":"GET","endpoint":"/api/cms/relations"},"create":{"method":"POST","endpoint":"/api/cms/relations"},"update":{"method":"PUT","endpoint":"/api/cms/relations/:id"},"delete":{"method":"DELETE","endpoint":"/api/cms/relations/:id"}},"responseMapping":{"dataPath":"data","arrayPath":"data","totalPath":"count"}},"cmsContentTags":{"id":"cmsContentTags","name":"CMS Content Tags","endpoint":"/api/cms/tags","fields":["id","contentId","tagCode","tagCodeTitle"],"primaryKey":"id","kind":"collection","operations":{"list":{"method":"GET","endpoint":"/api/cms/tags"},"create":{"method":"POST","endpoint":"/api/cms/tags"},"update":{"method":"PUT","endpoint":"/api/cms/tags/:id"},"delete":{"method":"DELETE","endpoint":"/api/cms/tags/:id"}},"responseMapping":{"dataPath":"data","arrayPath":"data","totalPath":"count"}},"cmsContentComments":{"id":"cmsContentComments","name":"content comment","endpoint":"/api/cms/contents","fields":["id","parentContentId","body","authorDisplayName","statusCode","statusCodeTitle","statusCodeUiHtml","statusCodeUiColor","createdAt"],"primaryKey":"id","kind":"collection","operations":{"list":{"method":"GET","endpoint":"/api/cms/contents"},"update":{"method":"PUT","endpoint":"/api/cms/contents/:id"},"delete":{"method":"DELETE","endpoint":"/api/cms/contents/:id"}},"responseMapping":{"dataPath":"data","arrayPath":"data","totalPath":"count"},"pollingIntervalMs":3000}},"lovs":{"cmsStatuses":{"id":"cmsStatuses","name":"Statuses","endpoint":"/api/base-info/options?root=101.002&lang=en","displayValue":"label","returnValue":"id"},"cmsContentTypes":{"id":"cmsContentTypes","name":"Content Types","endpoint":"/api/base-info/options?root=101.001&lang=en","displayValue":"label","returnValue":"id"},"cmsLanguages":{"id":"cmsLanguages","name":"Languages","endpoint":"/api/base-info/options?root=101.004&lang=en","displayValue":"label","returnValue":"id"},"cmsBodyFormats":{"id":"cmsBodyFormats","name":"Body Formats","endpoint":"/api/base-info/options?root=101.003&lang=en","displayValue":"label","returnValue":"id"},"cmsCommentPolicies":{"id":"cmsCommentPolicies","name":"Comment Policies","endpoint":"/api/base-info/options?root=101.006&lang=en","displayValue":"label","returnValue":"id"}}}, designerStore: designerStore, previewEvents: { patchStore: patchDesignerStore, getDesignerStore: () => designerStore, refreshDataSource: async () => {  } } }} />
          </CreateEditModalShell>
        )}
      </div>
    </>
  );
};
export default GeneratedComponent;
