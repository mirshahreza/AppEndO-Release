export const GRID_PAGE_SIZES = [50, 100, 500, 1000, 10000] as const;

export const DEFAULT_GRID_PAGE_SIZE = GRID_PAGE_SIZES[0];

export type GridPageSize = (typeof GRID_PAGE_SIZES)[number];

export type GridListMode = 'paging' | 'infinite';

export const GRID_LIST_MODE_OPTIONS: ReadonlyArray<{ value: GridListMode; label: string }> = [
  { value: 'paging', label: 'Paging' },
  { value: 'infinite', label: 'Infinite' },
];

export const DEFAULT_GRID_LIST_MODE: GridListMode = 'paging';
