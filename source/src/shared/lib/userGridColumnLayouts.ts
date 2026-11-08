import type { GridColumnLayoutState } from './appTableGridColumnLayout';
import { EMPTY_COLUMN_LAYOUT } from './appTableGridColumnLayout';

export type UserGridColumnLayoutsMap = Record<string, GridColumnLayoutState>;

const MAX_GRID_ID_LENGTH = 64;

export const isValidGridId = (gridId: unknown): gridId is string => {
  if (typeof gridId !== 'string') {
    return false;
  }
  const trimmed = gridId.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_GRID_ID_LENGTH;
};

export const parseRawGridColumnLayout = (value: unknown): GridColumnLayoutState | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const order = Array.isArray(raw.order)
    ? raw.order.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
    : [];
  const hidden = Array.isArray(raw.hidden)
    ? raw.hidden.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
    : [];

  const widths: Record<string, number> = {};
  if (raw.widths && typeof raw.widths === 'object' && !Array.isArray(raw.widths)) {
    for (const [columnId, widthValue] of Object.entries(raw.widths)) {
      if (typeof columnId !== 'string' || !columnId) {
        continue;
      }
      const parsedWidth = typeof widthValue === 'number' ? widthValue : Number(widthValue);
      if (Number.isFinite(parsedWidth) && parsedWidth > 0) {
        widths[columnId] = Math.round(parsedWidth);
      }
    }
  }

  return { order, hidden, widths };
};

export const parseUserGridColumnLayouts = (value: unknown): UserGridColumnLayoutsMap => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const result: UserGridColumnLayoutsMap = {};
  for (const [gridId, layoutValue] of Object.entries(value as Record<string, unknown>)) {
    if (!isValidGridId(gridId)) {
      continue;
    }
    const layout = parseRawGridColumnLayout(layoutValue);
    if (layout) {
      result[gridId.trim()] = layout;
    }
  }

  return result;
};

export const mergeGridColumnLayout = (
  layouts: UserGridColumnLayoutsMap,
  gridId: string,
  layout: GridColumnLayoutState,
): UserGridColumnLayoutsMap => ({
  ...layouts,
  [gridId]: layout,
});

export const resolveStoredGridColumnLayout = (
  layouts: UserGridColumnLayoutsMap,
  gridId: string | undefined,
): GridColumnLayoutState | null => {
  if (!isValidGridId(gridId)) {
    return null;
  }
  return layouts[gridId.trim()] ?? null;
};

export const normalizeGridColumnLayoutPayload = (
  gridId: unknown,
  layout: unknown,
): { gridId: string; layout: GridColumnLayoutState } | null => {
  if (!isValidGridId(gridId)) {
    return null;
  }
  const parsedLayout = parseRawGridColumnLayout(layout);
  if (!parsedLayout) {
    return null;
  }
  return {
    gridId: gridId.trim(),
    layout: parsedLayout,
  };
};

export const EMPTY_USER_GRID_COLUMN_LAYOUTS: UserGridColumnLayoutsMap = {};

export const fallbackGridColumnLayout = (
  stored: GridColumnLayoutState | null | undefined,
): GridColumnLayoutState => stored ?? EMPTY_COLUMN_LAYOUT;
