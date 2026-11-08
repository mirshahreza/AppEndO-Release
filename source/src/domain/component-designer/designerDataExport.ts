/**
 * Shared export helpers. Browser downloads build csv/xlsx/pdf in-memory from the queried row set
 * (filters/sort applied), not a paged slice. The `/api/component-designer/export` route reuses the
 * same builders for server-side callers.
 */

import * as React from 'react';

export type DesignerExportFormat = 'csv' | 'xlsx' | 'pdf';
export type DesignerExportDataSource = 'gridListResource' | 'chartDataResource';

export type DesignerExportColumn = {
  key: string;
  label: string;
};

export type DesignerExportPayload = {
  rows: ReadonlyArray<Record<string, unknown>>;
  columns?: ReadonlyArray<DesignerExportColumn>;
  filename?: string;
};

export const DESIGNER_EXPORT_API_PATH = '/api/component-designer/export';

/** Runtime list/chart export — any authenticated session; not builder-studio only. */
export const PLATFORM_DATA_EXPORT_API_PATH = '/api/data-export';

export const DESIGNER_EXPORT_FORMATS: readonly DesignerExportFormat[] = ['csv', 'xlsx', 'pdf'] as const;

export const isDesignerExportFormat = (value: unknown): value is DesignerExportFormat =>
  value === 'csv' || value === 'xlsx' || value === 'pdf';

export const isDesignerExportDataSource = (value: unknown): value is DesignerExportDataSource =>
  value === 'gridListResource' || value === 'chartDataResource';

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// OWASP CSV/Excel formula injection: spreadsheet apps treat a leading =, +, -, @, tab, or CR
// as a live formula. Prefix a single quote so the cell stays literal text.
export const DESIGNER_EXPORT_FORMULA_TRIGGER = /^[=+\-@\t\r]/;

export const neutralizeDesignerExportFormulaText = (text: string): string => (
  DESIGNER_EXPORT_FORMULA_TRIGGER.test(text) ? `'${text}` : text
);

const escapeCsvCell = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  let text: string;
  if (typeof value === 'string') {
    text = value;
  } else if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    text = String(value);
  } else if (value instanceof Date) {
    text = value.toISOString();
  } else if (Array.isArray(value)) {
    text = value.map((entry) => (entry === null || entry === undefined ? '' : String(entry))).join(', ');
  } else {
    try {
      text = JSON.stringify(value);
    } catch {
      text = String(value);
    }
  }
  text = neutralizeDesignerExportFormulaText(text);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

/** Infer column keys/labels from the first non-empty row when the caller has no schema. */
export const resolveDesignerExportColumns = (
  rows: ReadonlyArray<Record<string, unknown>>,
  columns?: ReadonlyArray<DesignerExportColumn>,
): DesignerExportColumn[] => {
  if (columns && columns.length > 0) {
    return columns
      .map((column) => ({
        key: column.key.trim(),
        label: (column.label.trim() || column.key).trim(),
      }))
      .filter((column) => column.key.length > 0);
  }

  const keys = new Set<string>();
  for (const row of rows) {
    if (!isPlainRecord(row)) {
      continue;
    }
    for (const key of Object.keys(row)) {
      if (key.startsWith('__')) {
        continue;
      }
      keys.add(key);
    }
    if (keys.size > 0) {
      break;
    }
  }

  return Array.from(keys).map((key) => ({ key, label: key }));
};

export type DesignerCsvBuildOptions = {
  /** Default true. */
  includeHeader?: boolean;
};

/** Build a UTF-8 CSV string (with BOM) from the given queried rows. */
export const buildDesignerCsvContent = (
  rows: ReadonlyArray<Record<string, unknown>>,
  columns?: ReadonlyArray<DesignerExportColumn>,
  options: DesignerCsvBuildOptions = {},
): string => {
  const includeHeader = options.includeHeader !== false;
  const resolvedColumns = resolveDesignerExportColumns(rows, columns);
  const header = resolvedColumns.map((column) => escapeCsvCell(column.label)).join(',');
  const body = rows.map((row) => (
    resolvedColumns.map((column) => escapeCsvCell(row[column.key])).join(',')
  ));
  const lines = includeHeader ? [header, ...body] : body;
  // BOM helps Excel open UTF-8 CSV correctly.
  return `\uFEFF${lines.join('\r\n')}`;
};

export const buildDesignerExportFilename = (
  baseName: string | undefined,
  format: DesignerExportFormat,
): string => {
  const trimmed = (baseName ?? 'export').trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
  const withoutExt = trimmed.replace(/\.(csv|xlsx|pdf)$/i, '');
  const safe = withoutExt.length > 0 ? withoutExt : 'export';
  return `${safe}.${format}`;
};

export const downloadDesignerBlob = (blob: Blob, filename: string): void => {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    return;
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

export const downloadDesignerCsv = (
  rows: ReadonlyArray<Record<string, unknown>>,
  options: {
    filename?: string;
    columns?: ReadonlyArray<DesignerExportColumn>;
    includeHeader?: boolean;
  } = {},
): void => {
  const content = buildDesignerCsvContent(rows, options.columns, {
    includeHeader: options.includeHeader,
  });
  const filename = buildDesignerExportFilename(options.filename, 'csv');
  downloadDesignerBlob(new Blob([content], { type: 'text/csv;charset=utf-8' }), filename);
};

export type DesignerServerExportRequest = {
  format: DesignerExportFormat;
  rows: ReadonlyArray<Record<string, unknown>>;
  columns?: ReadonlyArray<DesignerExportColumn>;
  filename?: string;
  includeHeader?: boolean;
  apiPath?: string;
};

/**
 * POST rows to a server export endpoint and trigger a browser download from the response.
 * CSV and xlsx are built on the server (xlsx via ExcelJS); PDF uses the existing builder.
 */
export const requestDesignerServerExport = async (
  request: DesignerServerExportRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<void> => {
  const filename = buildDesignerExportFilename(request.filename, request.format);
  const apiPath = request.apiPath?.trim() || DESIGNER_EXPORT_API_PATH;
  const response = await fetchImpl(apiPath, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: '*/*' },
    credentials: 'same-origin',
    body: JSON.stringify({
      format: request.format,
      rows: request.rows,
      columns: request.columns,
      filename,
      includeHeader: request.includeHeader !== false,
    }),
  });

  if (!response.ok) {
    let message = `Export failed (${response.status})`;
    try {
      const payload = await response.json() as { error?: string };
      if (typeof payload.error === 'string' && payload.error.trim()) {
        message = payload.error.trim();
      }
    } catch {
      // keep status message
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const matched = /filename\*?=(?:UTF-8''|")?([^\";]+)"?/i.exec(disposition);
  const resolvedName = matched?.[1]
    ? decodeURIComponent(matched[1].replace(/["']/g, '').trim())
    : filename;
  downloadDesignerBlob(blob, resolvedName || filename);
};

/**
 * Unified entry used by Dynamic Actions + toolbar Export + CRUD Set.
 * Builds the file in the browser from the queried row set (no auth round-trip).
 */
export const exportDesignerData = async (
  options: {
    format: DesignerExportFormat;
    rows: ReadonlyArray<Record<string, unknown>>;
    columns?: ReadonlyArray<DesignerExportColumn>;
    filename?: string;
    includeHeader?: boolean;
    fetchImpl?: typeof fetch;
  },
): Promise<void> => {
  const rows = options.rows.map((row) => (isPlainRecord(row) ? row : {}));
  const filename = buildDesignerExportFilename(options.filename, options.format);
  const includeHeader = options.includeHeader !== false;
  const { columns } = options;

  if (options.format === 'csv') {
    downloadDesignerCsv(rows, { columns, filename: options.filename, includeHeader });
    return;
  }

  const { buildDesignerPdfBlob, buildDesignerXlsxBlob } = await import('./designerExportFileBuilders');

  if (options.format === 'xlsx') {
    const blob = await buildDesignerXlsxBlob(rows, columns, { includeHeader });
    downloadDesignerBlob(blob, filename);
    return;
  }

  downloadDesignerBlob(buildDesignerPdfBlob(rows, columns), filename);
};

/** Serialize row cell values for Excel/PDF builders (shared with the server module). */
export const stringifyDesignerExportCell = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((entry) => (entry === null || entry === undefined ? '' : String(entry))).join(', ');
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

/**
 * Lightweight in-memory registry so Dynamic Action `exportData` can resolve the live
 * filtered/sorted payload from the active grid/chart without re-fetching raw data.
 */
type ExportSourceRegistration = {
  nodeId: string;
  getPayload: () => DesignerExportPayload | null;
};

const exportSourceRegistry = new Map<DesignerExportDataSource, ExportSourceRegistration>();

export const registerDesignerExportSource = (
  source: DesignerExportDataSource,
  nodeId: string,
  getPayload: () => DesignerExportPayload | null,
): (() => void) => {
  exportSourceRegistry.set(source, { nodeId, getPayload });
  return () => {
    const current = exportSourceRegistry.get(source);
    if (current?.nodeId === nodeId) {
      exportSourceRegistry.delete(source);
    }
  };
};

export const resolveRegisteredDesignerExportPayload = (
  source: DesignerExportDataSource,
): DesignerExportPayload | null => {
  const registration = exportSourceRegistry.get(source);
  if (!registration) {
    return null;
  }
  try {
    return registration.getPayload();
  } catch {
    return null;
  }
};

/** React helper — registers chart/grid rows for Dynamic Action `exportData` while mounted. */
export const DesignerExportSourceRegistrar: React.FC<{
  source: DesignerExportDataSource;
  nodeId: string;
  rows: ReadonlyArray<Record<string, unknown>>;
  columns?: ReadonlyArray<DesignerExportColumn>;
  filename?: string;
}> = ({ source, nodeId, rows, columns, filename }) => {
  React.useEffect(() => registerDesignerExportSource(source, nodeId, () => ({
    rows,
    columns,
    filename,
  })), [source, nodeId, rows, columns, filename]);
  return null;
};
