import { DataSourceType, type DataSourceFormState } from '../../shared/api/contracts/data-sources/types';

export type DataSourceSortField = 'name' | 'type' | 'created_at' | 'updated_at' | 'status';

export const TEST_REQUEST_TIMEOUT_MS = 8000;

export { DEFAULT_GRID_PAGE_SIZE as DEFAULT_PAGE_SIZE, GRID_PAGE_SIZES as PAGE_SIZES } from '../../shared/lib/gridPagingConstants';

export const SORT_OPTIONS: ReadonlyArray<{ value: DataSourceSortField; label: string }> = [
  { value: 'name', label: 'Name' },
  { value: 'type', label: 'Type' },
  { value: 'status', label: 'Status' },
  { value: 'created_at', label: 'Created' },
  { value: 'updated_at', label: 'Updated' },
];

export const DATA_SOURCE_SORT_FIELDS = SORT_OPTIONS.map((option) => option.value);

export const DEFAULT_FORM: DataSourceFormState = {
  name: '',
  type: DataSourceType.SQL_SERVER,
  host: 'localhost',
  port: 1433,
  database: 'AppEnd',
  username: '',
  password: '',
  encrypt: true,
  trustServerCertificate: true,
  pooling: false,
  optionsJson: '',
};

export const ACTION_TOOL_COUNT = 4;
export const ACTION_SLOT_WIDTH = 20;
export const ACTION_SEPARATOR_SLOT_WIDTH = 7;
export const ACTION_CELL_HORIZONTAL_PADDING = 3;
export const ACTION_COLUMN_WIDTH =
  ACTION_CELL_HORIZONTAL_PADDING * 2 +
  (ACTION_SLOT_WIDTH * ACTION_TOOL_COUNT) +
  (ACTION_SEPARATOR_SLOT_WIDTH * (ACTION_TOOL_COUNT - 1));

export const ACTION_BUTTON_BASE_CLASS =
  'h-5 w-5 inline-flex items-center justify-center rounded-sm transition-colors cursor-pointer disabled:opacity-100 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:text-slate-400 disabled:hover:bg-transparent';
