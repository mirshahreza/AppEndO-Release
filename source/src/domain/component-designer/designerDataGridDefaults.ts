/**
 * Leaf defaults for designer data-grid / App Table Grid palette props.
 * Keep this file free of other designer-domain imports so `catalog.ts` can
 * read the JSON at module init without hitting a circular TDZ.
 */

export const DEFAULT_DESIGNER_DATA_GRID_COLUMNS = [
  { key: 'id', label: 'ID', sort: true, width: '80px' },
  { key: 'name', label: 'Name', sort: true },
  { key: 'status', label: 'Status', sort: false, width: '120px' },
];

export const DEFAULT_DESIGNER_DATA_GRID_COLUMNS_JSON = JSON.stringify(DEFAULT_DESIGNER_DATA_GRID_COLUMNS);

export const DEFAULT_DESIGNER_APP_TABLE_GRID_COLUMNS = [
  { key: 'id', label: 'ID', sort: true, width: '80px', layoutHideable: true, cardRole: 'hidden' },
  { key: 'name', label: 'Name', sort: true, filter: true, filterType: 'text', cardRole: 'title' },
  {
    key: 'status',
    label: 'Status',
    filter: true,
    filterType: 'text',
    cellKind: 'badge',
    width: '120px',
    cardRole: 'meta',
  },
  { key: 'active', label: 'Active', filter: true, filterType: 'boolean', cellKind: 'boolean-icon', cardRole: 'field' },
  {
    key: 'created_at',
    label: 'Created',
    sort: true,
    filter: true,
    filterType: 'dateRange',
    cellKind: 'date',
    hideBelow: 'lg',
    cardRole: 'field',
  },
];

export const DEFAULT_DESIGNER_APP_TABLE_GRID_COLUMNS_JSON = JSON.stringify(DEFAULT_DESIGNER_APP_TABLE_GRID_COLUMNS);

export const DEFAULT_DESIGNER_APP_TABLE_GRID_SORT_OPTIONS = [
  { value: 'created_at', label: 'Created' },
  { value: 'name', label: 'Name' },
  { value: 'status', label: 'Status' },
];

export const DEFAULT_DESIGNER_APP_TABLE_GRID_SORT_OPTIONS_JSON = JSON.stringify(
  DEFAULT_DESIGNER_APP_TABLE_GRID_SORT_OPTIONS,
);
