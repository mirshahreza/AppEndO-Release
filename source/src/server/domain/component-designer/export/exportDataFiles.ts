/**
 * Server-side CSV + Excel (ExcelJS) + PDF builders for `/api/component-designer/export`.
 * Callers post the queried row set (filters/sort applied), not a paged slice.
 */

import {
  buildDesignerCsvContent,
  buildDesignerExportFilename,
  isDesignerExportFormat,
  type DesignerExportColumn,
  type DesignerExportFormat,
} from '../../../../domain/component-designer/designerDataExport';
import {
  buildDesignerPdfBytes,
  buildDesignerXlsxArrayBuffer,
  type DesignerXlsxBuildOptions,
} from '../../../../domain/component-designer/designerExportFileBuilders';

export type { DesignerXlsxBuildOptions };

export type DesignerExportFileRequest = {
  format: DesignerExportFormat;
  rows: ReadonlyArray<Record<string, unknown>>;
  columns?: ReadonlyArray<DesignerExportColumn>;
  filename?: string;
  includeHeader?: boolean;
};

export type DesignerExportFileResult = {
  buffer: Buffer;
  filename: string;
  contentType: string;
};

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeRows = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => (isPlainRecord(entry) ? entry : {}));
};

const normalizeColumns = (value: unknown): DesignerExportColumn[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const columns = value
    .map((entry) => {
      if (!isPlainRecord(entry)) {
        return null;
      }
      const key = typeof entry.key === 'string' ? entry.key.trim() : '';
      const label = typeof entry.label === 'string' ? entry.label.trim() : key;
      if (!key) {
        return null;
      }
      return { key, label: label || key };
    })
    .filter((entry): entry is DesignerExportColumn => entry !== null);
  return columns.length > 0 ? columns : undefined;
};

export const parseDesignerExportRequestBody = (body: unknown): DesignerExportFileRequest => {
  if (!isPlainRecord(body)) {
    throw new Error('Export body must be a JSON object.');
  }
  if (!isDesignerExportFormat(body.format)) {
    throw new Error('Export format must be csv, xlsx, or pdf.');
  }
  return {
    format: body.format,
    rows: normalizeRows(body.rows),
    columns: normalizeColumns(body.columns),
    filename: typeof body.filename === 'string' ? body.filename : undefined,
    includeHeader: body.includeHeader !== false,
  };
};

const contentTypeForFormat = (format: DesignerExportFormat): string => {
  switch (format) {
    case 'csv':
      return 'text/csv; charset=utf-8';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'pdf':
      return 'application/pdf';
  }
};

/** Real OOXML workbook via ExcelJS (single sheet). */
export const buildDesignerXlsxBuffer = async (
  rows: ReadonlyArray<Record<string, unknown>>,
  columns?: ReadonlyArray<DesignerExportColumn>,
  options: DesignerXlsxBuildOptions = {},
): Promise<Buffer> => {
  const buffer = await buildDesignerXlsxArrayBuffer(rows, columns, options);
  return Buffer.from(buffer);
};

/** Minimal single-page (multi-page via stacking) PDF table. */
export const buildDesignerPdfBuffer = (
  rows: ReadonlyArray<Record<string, unknown>>,
  columns?: ReadonlyArray<DesignerExportColumn>,
): Buffer => Buffer.from(buildDesignerPdfBytes(rows, columns));

export const buildDesignerExportFile = async (
  request: DesignerExportFileRequest,
): Promise<DesignerExportFileResult> => {
  const filename = buildDesignerExportFilename(request.filename, request.format);
  const includeHeader = request.includeHeader !== false;
  if (request.format === 'csv') {
    const content = buildDesignerCsvContent(request.rows, request.columns, { includeHeader });
    return {
      buffer: Buffer.from(content, 'utf8'),
      filename,
      contentType: contentTypeForFormat('csv'),
    };
  }
  if (request.format === 'xlsx') {
    return {
      buffer: await buildDesignerXlsxBuffer(request.rows, request.columns, { includeHeader }),
      filename,
      contentType: contentTypeForFormat('xlsx'),
    };
  }
  return {
    buffer: buildDesignerPdfBuffer(request.rows, request.columns),
    filename,
    contentType: contentTypeForFormat('pdf'),
  };
};
