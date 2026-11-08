/**
 * Phase 51 — Import CSV/Excel → Data Source (static-file connector).
 * Client-safe CSV parse + column type inference; Excel OOXML is handled server-side.
 */

import {
  buildDataSourceFromConnector,
  type BuildDataSourceFromConnectorOptions,
} from './dataConnectorBinding';
import type { WorkspaceDataConnectorSummary } from './dataConnectorTypes';
import type { DataSourceDefinition } from './types';

export type InferredColumnType = 'string' | 'number' | 'boolean' | 'date';

export type GuessedColumnSchema = {
  name: string;
  inferredType: InferredColumnType;
  sampleValues: string[];
};

export type TabularImportPreview = {
  format: 'csv' | 'xlsx' | 'json';
  rows: Record<string, unknown>[];
  columns: GuessedColumnSchema[];
  /** Suggested Data Source / connector display name (from filename). */
  suggestedName: string;
};

const BOOLEAN_TRUE = new Set(['true', 'yes', 'y', '1']);
const BOOLEAN_FALSE = new Set(['false', 'no', 'n', '0']);

export const splitCsvLine = (line: string): string[] => {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
};

/** RFC4180-ish CSV → row objects keyed by header names. */
export const parseCsvText = (text: string): Record<string, string>[] => {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return [];
  }

  const headers = splitCsvLine(lines[0]!).map((header, index) => {
    const trimmed = header.trim();
    return trimmed.length > 0 ? trimmed : `column_${index + 1}`;
  });

  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? '';
    });
    return row;
  });
};

const looksLikeIsoDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}([T\s]\d{2}:\d{2}(:\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(value)) {
    return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
};

export const inferColumnType = (samples: readonly string[]): InferredColumnType => {
  const nonEmpty = samples.map((value) => value.trim()).filter((value) => value.length > 0);
  if (nonEmpty.length === 0) {
    return 'string';
  }

  if (nonEmpty.every((value) => BOOLEAN_TRUE.has(value.toLowerCase()) || BOOLEAN_FALSE.has(value.toLowerCase()))) {
    return 'boolean';
  }

  if (nonEmpty.every((value) => /^-?\d+(\.\d+)?$/.test(value))) {
    return 'number';
  }

  if (nonEmpty.every((value) => looksLikeIsoDate(value))) {
    return 'date';
  }

  return 'string';
};

export const guessTabularColumnSchema = (
  rows: ReadonlyArray<Record<string, unknown>>,
  sampleLimit = 25,
): GuessedColumnSchema[] => {
  if (rows.length === 0) {
    return [];
  }

  const columnNames: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        columnNames.push(key);
      }
    }
  }

  return columnNames.map((name) => {
    const sampleValues = rows
      .slice(0, sampleLimit)
      .map((row) => {
        const value = row[name];
        if (value === undefined || value === null) {
          return '';
        }
        return String(value);
      });
    return {
      name,
      inferredType: inferColumnType(sampleValues),
      sampleValues: sampleValues.filter((value) => value.length > 0).slice(0, 3),
    };
  });
};

export const suggestedNameFromFileName = (fileName: string): string => {
  const base = fileName.replace(/\.[^.]+$/, '').trim();
  return base.length > 0 ? base : 'Imported data';
};

export const buildTabularImportPreviewFromCsv = (
  text: string,
  fileName = 'import.csv',
): TabularImportPreview => {
  const rows = parseCsvText(text);
  return {
    format: 'csv',
    rows,
    columns: guessTabularColumnSchema(rows),
    suggestedName: suggestedNameFromFileName(fileName),
  };
};

export const buildDataSourceFromTabularImport = (
  connector: Pick<WorkspaceDataConnectorSummary, 'id' | 'name' | 'connectorType'>,
  preview: Pick<TabularImportPreview, 'columns' | 'suggestedName'>,
  options: BuildDataSourceFromConnectorOptions & {
    staticFilePath: string;
    staticFileFormat?: 'json' | 'csv';
  },
): DataSourceDefinition => {
  const fields = preview.columns.map((column) => column.name);
  const primaryKey = fields.includes('id')
    ? 'id'
    : fields[0];

  return buildDataSourceFromConnector(connector, {
    ...options,
    name: options.name?.trim() || preview.suggestedName,
    fields,
    primaryKey,
    staticFilePath: options.staticFilePath,
    staticFileFormat: options.staticFileFormat ?? 'csv',
  });
};

export const slugifyImportId = (value: string): string => {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return slug.length > 0 ? slug : 'import';
};
