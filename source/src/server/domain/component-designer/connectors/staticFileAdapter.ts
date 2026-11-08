import fs from 'fs';
import type { DesignerConnectorQueryResult } from '../../../../domain/component-designer/dataConnectorTypes';
import {
  mapConnectorPayloadToQueryResult,
  selectConnectorDetailRecord,
} from '../../../../domain/component-designer/dataConnectorMapping';
import type { DesignerResponseMapping } from '../../../../domain/component-designer/types';
import type { WorkspaceDataConnector } from '../../../../domain/component-designer/dataConnectorTypes';
import { HttpError } from '../../../errors/HttpError';
import { resolveSafeConnectorFilePath } from './connectorsStore';

export type StaticFileAdapterInput = {
  connector: WorkspaceDataConnector;
  /** Relative path under the connector files dir (overrides connector.staticFilePath). */
  filePath?: string;
  format?: 'json' | 'csv';
  responseMapping?: DesignerResponseMapping;
  op?: 'list' | 'detail';
  primaryKey?: string;
  id?: string;
};

const parseCsv = (text: string): Record<string, string>[] => {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return [];
  }

  const splitRow = (line: string): string[] => {
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

  const headers = splitRow(lines[0]).map((header) => header.trim() || 'column');
  return lines.slice(1).map((line) => {
    const cells = splitRow(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? '';
    });
    return row;
  });
};

const parseJsonPayload = (text: string): unknown => {
  const parsed = JSON.parse(text) as unknown;
  return parsed;
};

export const runStaticFileAdapter = (
  input: StaticFileAdapterInput,
): DesignerConnectorQueryResult => {
  const relativePath = (
    input.filePath?.trim()
    || input.connector.staticFilePath?.trim()
    || ''
  );
  if (!relativePath) {
    throw new HttpError(400, 'static-file connector requires a file path.');
  }

  const absolutePath = resolveSafeConnectorFilePath(input.connector.id, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new HttpError(404, `Static file "${relativePath}" was not found.`);
  }

  const text = fs.readFileSync(absolutePath, 'utf8');
  const format = input.format
    || input.connector.staticFileFormat
    || (relativePath.toLowerCase().endsWith('.csv') ? 'csv' : 'json');

  let payload: unknown;
  try {
    payload = format === 'csv' ? parseCsv(text) : parseJsonPayload(text);
  } catch (error) {
    throw new HttpError(
      400,
      error instanceof Error ? `Failed to parse static file: ${error.message}` : 'Failed to parse static file.',
    );
  }

  const mapping = input.responseMapping ?? input.connector.responseMapping;
  // CSV / bare JSON arrays are already list-shaped; default mapping unwraps `{ data: [...] }` envelopes.
  const effectiveMapping = mapping ?? (Array.isArray(payload) ? undefined : { arrayPath: 'data' });
  const mapped = mapConnectorPayloadToQueryResult(payload, effectiveMapping);

  if (input.op === 'detail') {
    return selectConnectorDetailRecord(mapped, {
      primaryKey: input.primaryKey,
      id: input.id,
    });
  }

  return mapped;
};
