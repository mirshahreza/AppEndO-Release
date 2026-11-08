export const DATASHEET_WINDOW_PAGE_SIZES = [50, 100, 200] as const;

export const DATASHEET_WINDOW_DEFAULT_PAGE_SIZE = 100;

export const DATASHEET_WINDOW_MAX_PAGE_SIZE = 200;

export type DatasheetWindowPageSize = (typeof DATASHEET_WINDOW_PAGE_SIZES)[number];

export function parsePositiveInt(raw: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.floor(parsed);
}

export function clampDatasheetPageSize(raw: unknown): DatasheetWindowPageSize {
  const parsed = parsePositiveInt(raw, DATASHEET_WINDOW_DEFAULT_PAGE_SIZE);
  if (parsed <= 50) {
    return 50;
  }
  if (parsed <= 100) {
    return 100;
  }
  return DATASHEET_WINDOW_MAX_PAGE_SIZE;
}

export function assertDatasheetPageSize(raw: unknown): DatasheetWindowPageSize {
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DATASHEET_WINDOW_DEFAULT_PAGE_SIZE;
  }
  if (parsed > DATASHEET_WINDOW_MAX_PAGE_SIZE) {
    throw new Error(`pageSize cannot exceed ${DATASHEET_WINDOW_MAX_PAGE_SIZE}.`);
  }
  return clampDatasheetPageSize(parsed);
}

/** Row window taken from TOP / LIMIT in the datasheet SQL sentence. Any integer 1–200. */
export function assertDatasheetLimit(raw: unknown): number {
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DATASHEET_WINDOW_DEFAULT_PAGE_SIZE;
  }
  if (parsed > DATASHEET_WINDOW_MAX_PAGE_SIZE) {
    throw new Error(`Cannot load more than ${DATASHEET_WINDOW_MAX_PAGE_SIZE} rows.`);
  }
  return Math.floor(parsed);
}

export function clampDatasheetPage(page: unknown, totalPages: number): number {
  const safeTotal = Math.max(1, totalPages);
  const parsed = parsePositiveInt(page, 1);
  return Math.min(parsed, safeTotal);
}

export type DatasheetWindowMeta = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  from: number;
  to: number;
};

export function datasheetWindowMeta(
  page: number,
  pageSize: number,
  totalCount: number,
): DatasheetWindowMeta {
  const safeSize = clampDatasheetPageSize(pageSize);
  const totalPages = Math.max(1, Math.ceil(Math.max(0, totalCount) / safeSize));
  const safePage = clampDatasheetPage(page, totalPages);
  const from = totalCount === 0 ? 0 : (safePage - 1) * safeSize + 1;
  const to = Math.min(totalCount, safePage * safeSize);
  return {
    page: safePage,
    pageSize: safeSize,
    totalCount,
    totalPages,
    from,
    to,
  };
}
