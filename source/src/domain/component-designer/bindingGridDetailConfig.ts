import { GRID_DETAIL_ACTION_ID } from './designerDataGridColumns';
import type { GridDetailFlowConfig } from './types';

const DEFAULT_SELECTION_STORE_PATH = 'selection.id';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const sanitizeGridDetailFlowConfig = (value: unknown): GridDetailFlowConfig | null => {
  if (!isRecord(value)) {
    return null;
  }

  const detailDataSourceRef = String(value.detailDataSourceRef ?? '').trim();
  const detailModalNodeId = String(value.detailModalNodeId ?? '').trim();
  const detailRegionNodeId = String(value.detailRegionNodeId ?? '').trim();
  if (!detailDataSourceRef || !detailModalNodeId || !detailRegionNodeId) {
    return null;
  }

  return {
    primaryKeyField: String(value.primaryKeyField ?? 'id').trim() || 'id',
    selectionStorePath: String(value.selectionStorePath ?? DEFAULT_SELECTION_STORE_PATH).trim() || DEFAULT_SELECTION_STORE_PATH,
    detailDataSourceRef,
    detailModalNodeId,
    detailRegionNodeId,
    rowActionId: String(value.rowActionId ?? GRID_DETAIL_ACTION_ID).trim() || GRID_DETAIL_ACTION_ID,
    rowActionLabel: String(value.rowActionLabel ?? 'Details').trim() || 'Details',
  };
};
