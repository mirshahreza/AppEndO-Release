/** Normalize `base_info.ui_color` / `uiColor` values for grid cards and swatches. */
export const normalizeHexColor = (raw: unknown): string | null => {
  if (raw == null || raw === '') {
    return null;
  }
  const trimmed = String(raw).trim();
  if (!trimmed) {
    return null;
  }
  const hex = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(hex) ? hex : null;
};

export const readRowUiColor = (row: Record<string, unknown>): string | null => (
  normalizeHexColor(row.ui_color ?? row.uiColor)
);

export const hexToRgba = (hex: string, alpha: number): string | null => {
  const normalized = normalizeHexColor(hex);
  if (!normalized) {
    return null;
  }
  const raw = normalized.slice(1);
  if (raw.length !== 6) {
    return null;
  }
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) {
    return null;
  }
  const clampedAlpha = Math.min(1, Math.max(0, alpha));
  return `rgba(${r}, ${g}, ${b}, ${clampedAlpha})`;
};

export const isUiColorColumnKey = (key: string): boolean => (
  key === 'ui_color' || key === 'uiColor'
);

const camelToSnakeField = (field: string): string => (
  field.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`)
);

export const readGridColumnRawValue = (
  row: Record<string, unknown>,
  columnKey: string,
): unknown => {
  if (isUiColorColumnKey(columnKey)) {
    return readRowUiColor(row) ?? row[columnKey] ?? row.uiColor;
  }
  if (columnKey in row && row[columnKey] !== undefined) {
    return row[columnKey];
  }
  const snakeKey = camelToSnakeField(columnKey);
  if (snakeKey in row) {
    return row[snakeKey];
  }
  return row[columnKey];
};
