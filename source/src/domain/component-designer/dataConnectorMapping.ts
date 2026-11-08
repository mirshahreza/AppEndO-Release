import { applyResponseDataPath, readNestedContextValue } from './bindingResourceModel';
import { readResponseTotalCount } from './designerDataGridRuntime';
import type { DesignerConnectorQueryResult } from './dataConnectorTypes';
import type { DesignerResponseMapping } from './types';

/**
 * Apply Designer `responseMapping` to a raw remote/file payload and produce the
 * normalized `{ data, total }` contract used by every connector adapter.
 */
export const mapConnectorPayloadToQueryResult = (
  payload: unknown,
  responseMapping?: DesignerResponseMapping,
): DesignerConnectorQueryResult => {
  const mapped = applyResponseDataPath(payload, responseMapping);
  const totalFromPath = readResponseTotalCount(payload, responseMapping?.totalPath);

  if (Array.isArray(mapped)) {
    return {
      data: mapped,
      total: totalFromPath ?? mapped.length,
    };
  }

  if (mapped !== undefined && mapped !== null) {
    return {
      data: mapped,
      total: totalFromPath,
    };
  }

  if (Array.isArray(payload)) {
    return {
      data: payload,
      total: totalFromPath ?? payload.length,
    };
  }

  return {
    data: mapped ?? payload ?? null,
    total: totalFromPath,
  };
};

/**
 * Detail lookup against an already-mapped list/record payload.
 * When `data` is an array, finds the row whose `primaryKey` equals `id`.
 */
export const selectConnectorDetailRecord = (
  result: DesignerConnectorQueryResult,
  options: { primaryKey?: string; id?: string } = {},
): DesignerConnectorQueryResult => {
  const id = options.id?.trim();
  if (!id) {
    return result;
  }

  const primaryKey = options.primaryKey?.trim() || 'id';
  const rows = Array.isArray(result.data) ? result.data : [result.data];
  const match = rows.find((row) => {
    if (!row || typeof row !== 'object') {
      return false;
    }
    const value = (row as Record<string, unknown>)[primaryKey];
    return value !== undefined && value !== null && String(value) === id;
  });

  return {
    data: match ?? null,
    total: match ? 1 : 0,
  };
};

/** Read a nested field for diagnostics / tests without importing the grid runtime. */
export const readConnectorMappedField = (
  payload: unknown,
  path: string | undefined,
): unknown => {
  if (!path?.trim() || !payload || typeof payload !== 'object') {
    return undefined;
  }
  return readNestedContextValue(payload as Record<string, unknown>, path.trim());
};
