/**
 * Shared CSV companion builders (xlsx via ExcelJS, minimal PDF table).
 * Used by browser downloads and the `/api/component-designer/export` route.
 */

import type { CellValue } from 'exceljs';
import ExcelJS from 'exceljs';
import {
  neutralizeDesignerExportFormulaText,
  resolveDesignerExportColumns,
  stringifyDesignerExportCell,
  type DesignerExportColumn,
} from './designerDataExport';

const utf8ByteLength = (text: string): number => new TextEncoder().encode(text).length;

const toExcelCellValue = (value: unknown): CellValue => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : String(value);
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'bigint') {
    const asNumber = Number(value);
    return Number.isSafeInteger(asNumber) ? asNumber : String(value);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  return neutralizeDesignerExportFormulaText(stringifyDesignerExportCell(value));
};

const COLUMN_WIDTH_SAMPLE = 50;

export type DesignerXlsxBuildOptions = {
  includeHeader?: boolean;
};

/** Real OOXML workbook via ExcelJS (single sheet). */
export const buildDesignerXlsxArrayBuffer = async (
  rows: ReadonlyArray<Record<string, unknown>>,
  columns?: ReadonlyArray<DesignerExportColumn>,
  options: DesignerXlsxBuildOptions = {},
): Promise<ArrayBuffer> => {
  const includeHeader = options.includeHeader !== false;
  const resolved = resolveDesignerExportColumns(rows, columns);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AppEndO';
  const sheet = workbook.addWorksheet('Export', {
    views: includeHeader ? [{ state: 'frozen', ySplit: 1 }] : undefined,
  });

  if (includeHeader) {
    const header = sheet.addRow(resolved.map((column) => column.label));
    header.font = { bold: true };
  }
  for (const row of rows) {
    sheet.addRow(resolved.map((column) => toExcelCellValue(row[column.key])));
  }

  const sample = rows.slice(0, COLUMN_WIDTH_SAMPLE);
  resolved.forEach((column, index) => {
    const headerLen = includeHeader ? column.label.length : 0;
    const maxLen = sample.reduce((max, row) => (
      Math.max(max, stringifyDesignerExportCell(row[column.key]).length)
    ), headerLen);
    sheet.getColumn(index + 1).width = Math.min(40, Math.max(10, maxLen + 2));
  });

  const buffer = await workbook.xlsx.writeBuffer();
  if (buffer instanceof ArrayBuffer) {
    return buffer;
  }
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
};

export const buildDesignerXlsxBlob = async (
  rows: ReadonlyArray<Record<string, unknown>>,
  columns?: ReadonlyArray<DesignerExportColumn>,
  options: DesignerXlsxBuildOptions = {},
): Promise<Blob> => {
  const buffer = await buildDesignerXlsxArrayBuffer(rows, columns, options);
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
};

const pdfEscape = (value: string): string => value
  .replace(/\\/g, '\\\\')
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)');

/**
 * Minimal single-page (multi-page via stacking) PDF table — Helvetica, no external PDF deps.
 */
export const buildDesignerPdfBytes = (
  rows: ReadonlyArray<Record<string, unknown>>,
  columns?: ReadonlyArray<DesignerExportColumn>,
): Uint8Array => {
  const resolved = resolveDesignerExportColumns(rows, columns);
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 36;
  const fontSize = 9;
  const lineHeight = 12;
  const usableWidth = pageWidth - margin * 2;
  const colWidth = resolved.length > 0 ? usableWidth / resolved.length : usableWidth;

  type PageContent = string[];
  const pages: PageContent[] = [];
  let current: string[] = [];
  let y = pageHeight - margin;

  const flushPage = () => {
    pages.push(current);
    current = [];
    y = pageHeight - margin;
  };

  const drawRow = (cells: string[], bold = false) => {
    if (y < margin + lineHeight) {
      flushPage();
    }
    cells.forEach((cell, index) => {
      const x = margin + index * colWidth;
      const truncated = cell.length > 48 ? `${cell.slice(0, 45)}...` : cell;
      current.push('BT');
      current.push(`/${bold ? 'F2' : 'F1'} ${fontSize} Tf`);
      current.push(`${x.toFixed(2)} ${y.toFixed(2)} Td`);
      current.push(`(${pdfEscape(truncated)}) Tj`);
      current.push('ET');
    });
    y -= lineHeight;
  };

  drawRow(resolved.map((column) => column.label), true);
  for (const row of rows) {
    drawRow(resolved.map((column) => stringifyDesignerExportCell(row[column.key])));
  }
  if (current.length > 0 || pages.length === 0) {
    flushPage();
  }

  const objects: string[] = [];
  objects.push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n');

  const pageObjectStart = 3;
  const fontRegularId = pageObjectStart + pages.length * 2;
  const fontBoldId = fontRegularId + 1;
  const kids = pages.map((_, index) => `${pageObjectStart + index * 2} 0 R`).join(' ');
  objects.push(`2 0 obj<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>endobj\n`);

  pages.forEach((ops, index) => {
    const pageId = pageObjectStart + index * 2;
    const contentId = pageId + 1;
    const stream = ops.join('\n');
    objects.push(
      `${pageId} 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] `
      + `/Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> `
      + `/Contents ${contentId} 0 R >>endobj\n`,
    );
    objects.push(
      `${contentId} 0 obj<< /Length ${utf8ByteLength(stream)} >>stream\n${stream}\nendstream\nendobj\n`,
    );
  });

  objects.push(`${fontRegularId} 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n`);
  objects.push(`${fontBoldId} 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>endobj\n`);

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const object of objects) {
    offsets.push(utf8ByteLength(pdf));
    pdf += object;
  }
  const xrefOffset = utf8ByteLength(pdf);
  pdf += `xref\n0 ${offsets.length}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
};

export const buildDesignerPdfBlob = (
  rows: ReadonlyArray<Record<string, unknown>>,
  columns?: ReadonlyArray<DesignerExportColumn>,
): Blob => new Blob([buildDesignerPdfBytes(rows, columns)], { type: 'application/pdf' });
