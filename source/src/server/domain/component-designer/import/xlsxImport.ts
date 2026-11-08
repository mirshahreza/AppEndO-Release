/**
 * Phase 51 — parse first sheet of an OOXML (.xlsx) workbook into row objects.
 * Complements client-side CSV parsing in `csvExcelImport.ts`.
 */

import AdmZipImport from 'adm-zip';

// Vitest/Vite ESM interop: CJS default export may arrive nested under `.default`.
const AdmZip = ((AdmZipImport as unknown as { default?: typeof AdmZipImport }).default
  ?? AdmZipImport) as typeof AdmZipImport;

type ZipEntryLike = { entryName: string; getData: () => Buffer };
type ZipLike = { getEntries: () => ZipEntryLike[] };


const decodeXmlEntities = (value: string): string =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

const extractTagTexts = (xml: string, tagName: string): string[] => {
  const results: string[] = [];
  const pattern = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)</${tagName}>`, 'gi');
  let match = pattern.exec(xml);
  while (match) {
    const inner = match[1] ?? '';
    const textParts = [...inner.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/gi)].map((entry) => decodeXmlEntities(entry[1] ?? ''));
    results.push(textParts.length > 0 ? textParts.join('') : decodeXmlEntities(inner.replace(/<[^>]+>/g, '')));
    match = pattern.exec(xml);
  }
  return results;
};

const columnIndexFromRef = (cellRef: string): number => {
  const letters = /^([A-Z]+)/i.exec(cellRef)?.[1]?.toUpperCase() ?? 'A';
  let index = 0;
  for (let i = 0; i < letters.length; i += 1) {
    index = index * 26 + (letters.charCodeAt(i) - 64);
  }
  return Math.max(0, index - 1);
};

type SheetCell = { col: number; value: string };

const parseSheetRows = (sheetXml: string, sharedStrings: string[]): string[][] => {
  const rows: string[][] = [];
  const rowPattern = /<row\b[^>]*>([\s\S]*?)<\/row>/gi;
  let rowMatch = rowPattern.exec(sheetXml);
  while (rowMatch) {
    const rowXml = rowMatch[1] ?? '';
    const cells: SheetCell[] = [];
    const cellPattern = /<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/gi;
    let cellMatch = cellPattern.exec(rowXml);
    while (cellMatch) {
      const attrs = cellMatch[1] ?? cellMatch[3] ?? '';
      const body = cellMatch[2] ?? '';
      const ref = /\br="([^"]+)"/i.exec(attrs)?.[1] ?? '';
      const type = /\bt="([^"]+)"/i.exec(attrs)?.[1] ?? '';
      let value = '';
      if (type === 'inlineStr') {
        const texts = [...body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/gi)].map((entry) => decodeXmlEntities(entry[1] ?? ''));
        value = texts.join('');
      } else if (type === 's') {
        const sharedIndex = Number(/<v>([\s\S]*?)<\/v>/i.exec(body)?.[1]?.trim() ?? '');
        value = Number.isFinite(sharedIndex) ? (sharedStrings[sharedIndex] ?? '') : '';
      } else {
        value = decodeXmlEntities(/<v>([\s\S]*?)<\/v>/i.exec(body)?.[1]?.trim() ?? '');
      }
      cells.push({ col: columnIndexFromRef(ref || 'A'), value });
      cellMatch = cellPattern.exec(rowXml);
    }

    if (cells.length > 0) {
      const width = Math.max(...cells.map((cell) => cell.col)) + 1;
      const row = Array.from({ length: width }, () => '');
      for (const cell of cells) {
        row[cell.col] = cell.value;
      }
      rows.push(row);
    }
    rowMatch = rowPattern.exec(sheetXml);
  }
  return rows;
};

const normalizeZipPath = (entryName: string): string => entryName.replace(/\\/g, '/');

const findZipEntry = (zip: ZipLike, candidates: string[]) => {
  const entries = zip.getEntries();
  for (const candidate of candidates) {
    const found = entries.find((entry) => normalizeZipPath(entry.entryName) === candidate);
    if (found) {
      return found;
    }
  }
  // Fallback: first worksheet under xl/worksheets/
  return entries.find((entry) => {
    const name = normalizeZipPath(entry.entryName);
    return name.startsWith('xl/worksheets/') && name.endsWith('.xml') && !name.includes('_rels');
  });
};

export const parseXlsxBufferToRows = (buffer: Buffer | Uint8Array): Record<string, string>[] => {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (bytes.byteLength < 22) {
    throw new Error('Excel file buffer is empty or too small to be a valid OOXML zip.');
  }

  const zip = new AdmZip(bytes);
  // Some AdmZip builds leave getEntries() empty until readZip is forced via getEntry /
  // reading the central directory — prefer iterating after ensuring load.
  let entries = zip.getEntries();
  if (entries.length === 0) {
    // Retry with a copied Node Buffer (vitest/vite sometimes passes Uint8Array views).
    const retry = new AdmZip(Buffer.from(bytes));
    entries = retry.getEntries();
    if (entries.length === 0) {
      throw new Error('Excel file has no zip entries (invalid or unsupported OOXML buffer).');
    }
    return parseRowsFromZip(retry);
  }

  return parseRowsFromZip(zip);
};

const parseRowsFromZip = (zip: ZipLike): Record<string, string>[] => {
  const sheetEntry = findZipEntry(zip, [
    'xl/worksheets/sheet1.xml',
    'xl/worksheets/Sheet1.xml',
  ]);
  if (!sheetEntry) {
    const names = zip.getEntries().map((entry) => entry.entryName).join(', ');
    throw new Error(`Excel file has no worksheet under xl/worksheets/. Entries: ${names || '(empty)'}`);
  }

  const sharedEntry = findZipEntry(zip, ['xl/sharedStrings.xml']);
  const sharedStrings = sharedEntry
    ? extractTagTexts(sharedEntry.getData().toString('utf8'), 'si')
    : [];

  const sheetXml = sheetEntry.getData().toString('utf8');
  const matrix = parseSheetRows(sheetXml, sharedStrings);
  if (matrix.length === 0) {
    return [];
  }

  const headers = matrix[0]!.map((header, index) => {
    const trimmed = header.trim();
    return trimmed.length > 0 ? trimmed : `column_${index + 1}`;
  });

  return matrix.slice(1).map((cells) => {
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? '';
    });
    return row;
  });
};
