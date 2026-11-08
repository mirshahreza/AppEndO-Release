import { describe, expect, it } from 'vitest';
import {
  applyClientGridQuery,
  createEmptyFilterValue,
  footerSortToGridQuery,
  gridQueryToFooterSort,
  sanitizeGridQuery,
  toggleColumnSort,
  type AppTableGridColumnDef,
  type GridQueryState,
} from '../appTableGridQuery';

type Row = {
  id: number;
  name: string;
  active: boolean;
  type: string;
  created_at: string;
};

const columns: AppTableGridColumnDef<Row>[] = [
  {
    id: 'name',
    label: 'Name',
    renderCell: (row) => row.name,
    getSortValue: (row) => row.name,
    getFilterValue: (row) => row.name,
    sort: { mode: 'client' },
    filter: { mode: 'client', type: 'text' },
  },
  {
    id: 'active',
    label: 'Active',
    renderCell: (row) => String(row.active),
    getFilterValue: (row) => row.active,
    filter: { mode: 'client', type: 'boolean' },
  },
  {
    id: 'type',
    label: 'Type',
    renderCell: (row) => row.type,
    getFilterValue: (row) => row.type,
    filter: {
      mode: 'client',
      type: 'select',
      multiple: true,
      options: [
        { value: 'A', label: 'A' },
        { value: 'B', label: 'B' },
      ],
    },
  },
  {
    id: 'created_at',
    label: 'Created',
    renderCell: (row) => row.created_at,
    getSortValue: (row) => row.created_at,
    getFilterValue: (row) => row.created_at,
    sort: { mode: 'server' },
    filter: { mode: 'server', type: 'dateRange' },
  },
  {
    id: 'actions',
    label: '',
    renderCell: () => null,
    sort: false,
    filter: false,
  },
];

const rows: Row[] = [
  { id: 1, name: 'Alpha', active: true, type: 'A', created_at: '2024-01-10' },
  { id: 2, name: 'Beta', active: false, type: 'B', created_at: '2024-02-15' },
  { id: 3, name: 'Gamma', active: true, type: 'A', created_at: '2024-03-20' },
];

describe('sanitizeGridQuery', () => {
  it('strips sort on non-sortable columns', () => {
    const query: GridQueryState = {
      sort: { columnId: 'actions', direction: 'asc' },
      filters: {},
    };

    expect(sanitizeGridQuery(query, columns).sort).toBeNull();
  });

  it('keeps footer-only sort fields when additionalSortColumnIds is set', () => {
    const query: GridQueryState = {
      sort: { columnId: 'updatedAt', direction: 'desc' },
      filters: {},
    };

    expect(sanitizeGridQuery(query, columns).sort).toBeNull();
    expect(sanitizeGridQuery(query, columns, 'server', ['updatedAt', 'createdAt'])).toEqual({
      sort: { columnId: 'updatedAt', direction: 'desc' },
      filters: {},
    });
  });

  it('strips filters with incompatible types or empty values', () => {
    const query: GridQueryState = {
      sort: null,
      filters: {
        name: { type: 'text', value: '' },
        active: { type: 'boolean', value: 'all' },
        type: { type: 'select', value: [] },
        actions: { type: 'text', value: 'ignored' },
        created_at: { type: 'dateRange', from: null, to: null },
      },
    };

    expect(sanitizeGridQuery(query, columns).filters).toEqual({});
  });

  it('keeps valid sort and filters only for configured columns', () => {
    const query: GridQueryState = {
      sort: { columnId: 'name', direction: 'desc' },
      filters: {
        name: { type: 'text', value: 'a' },
        active: { type: 'boolean', value: 'true' },
      },
    };

    expect(sanitizeGridQuery(query, columns)).toEqual({
      sort: { columnId: 'name', direction: 'desc' },
      filters: {
        name: { type: 'text', value: 'a' },
        active: { type: 'boolean', value: 'true' },
      },
    });
  });
});

describe('applyClientGridQuery', () => {
  it('applies only client-mode filters and sort', () => {
    const query: GridQueryState = {
      sort: { columnId: 'name', direction: 'asc' },
      filters: {
        name: { type: 'text', value: 'a' },
        active: { type: 'boolean', value: 'true' },
        type: { type: 'select', value: ['A'] },
        created_at: { type: 'dateRange', from: '2024-03-01', to: '2024-03-31' },
      },
    };

    const result = applyClientGridQuery(rows, query, columns, 'client');
    expect(result.map((row) => row.id)).toEqual([1, 3]);
    expect(result.every((row) => row.name.toLowerCase().includes('a'))).toBe(true);
    expect(result.every((row) => row.active)).toBe(true);
    expect(result.every((row) => row.type === 'A')).toBe(true);
    expect(result.some((row) => row.created_at === '2024-01-10')).toBe(true);
  });

  it('ignores client sort when accessor is missing', () => {
    const columnsWithoutAccessor: AppTableGridColumnDef<Row>[] = [
      {
        id: 'active',
        label: 'Active',
        renderCell: (row) => String(row.active),
        sort: { mode: 'client' },
      },
    ];

    const result = applyClientGridQuery(rows, {
      sort: { columnId: 'active', direction: 'asc' },
      filters: {},
    }, columnsWithoutAccessor, 'client');

    expect(result.map((row) => row.id)).toEqual([1, 2, 3]);
  });

  it('does not mutate rows for server-mode sort/filter', () => {
    const query: GridQueryState = {
      sort: { columnId: 'created_at', direction: 'desc' },
      filters: {
        created_at: { type: 'dateRange', from: '2024-03-01', to: '2024-03-31' },
      },
    };

    const result = applyClientGridQuery(rows, query, columns, 'client');
    expect(result.map((row) => row.id)).toEqual([1, 2, 3]);
  });
});

describe('toggleColumnSort', () => {
  it('cycles asc, desc, and clear for sortable columns', () => {
    const nameColumn = columns[0];
    const empty: GridQueryState = { sort: null, filters: {} };

    const asc = toggleColumnSort(empty, 'name', nameColumn);
    expect(asc?.sort).toEqual({ columnId: 'name', direction: 'asc' });

    const desc = toggleColumnSort(asc!, 'name', nameColumn);
    expect(desc?.sort).toEqual({ columnId: 'name', direction: 'desc' });

    const cleared = toggleColumnSort(desc!, 'name', nameColumn);
    expect(cleared?.sort).toBeNull();
  });

  it('returns null for non-sortable columns', () => {
    const actionsColumn = columns[4];
    expect(toggleColumnSort({ sort: null, filters: {} }, 'actions', actionsColumn)).toBeNull();
  });
});

describe('footer sort mappers', () => {
  it('maps grid query sort to footer sort fields', () => {
    const query: GridQueryState = {
      sort: { columnId: 'name', direction: 'desc' },
      filters: {},
    };

    expect(gridQueryToFooterSort(query, ['name', 'created_at'])).toEqual({
      sortBy: 'name',
      sortDirection: 'desc',
    });
    expect(gridQueryToFooterSort(query, ['created_at']).sortBy).toBeNull();
  });

  it('maps footer sort back to grid query', () => {
    const current: GridQueryState = {
      sort: null,
      filters: { name: { type: 'text', value: 'x' } },
    };

    expect(footerSortToGridQuery('created_at', 'asc', current)).toEqual({
      sort: { columnId: 'created_at', direction: 'asc' },
      filters: { name: { type: 'text', value: 'x' } },
    });
  });
});

describe('createEmptyFilterValue', () => {
  it('creates defaults per filter type', () => {
    expect(createEmptyFilterValue('text')).toEqual({ type: 'text', value: '' });
    expect(createEmptyFilterValue('boolean')).toEqual({ type: 'boolean', value: 'all' });
    expect(createEmptyFilterValue('select', true)).toEqual({ type: 'select', value: [] });
    expect(createEmptyFilterValue('dateRange')).toEqual({ type: 'dateRange', from: null, to: null });
  });
});
