// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  LIST_PREFERENCES_STORAGE_PREFIX,
  flushStoredColumnLayout,
  patchStoredListPreferences,
  persistStoredColumnLayout,
  readStoredListPreferences,
  resolveStoredColumnLayout,
  resolveStoredPageSize,
} from '../listPreferencesStorage';
import {
  usePersistedListFilters,
  usePersistedListPaging,
} from '../usePersistedListPreferences';
import { useGridQueryState } from '../useGridQueryState';
import type { AppTableGridColumnDef } from '../appTableGridQuery';

const LIST_KEY = 'test-list-prefs';

afterEach(() => {
  flushStoredColumnLayout(LIST_KEY);
  window.localStorage.removeItem(`${LIST_PREFERENCES_STORAGE_PREFIX}${LIST_KEY}`);
  vi.useRealTimers();
});

describe('listPreferencesStorage', () => {
  it('round-trips pageSize, listMode, and filters', () => {
    patchStoredListPreferences(LIST_KEY, {
      pageSize: 100,
      listMode: 'infinite',
      filters: { searchInput: 'admin' },
    });

    expect(readStoredListPreferences(LIST_KEY)).toEqual({
      v: 1,
      pageSize: 100,
      listMode: 'infinite',
      filters: { searchInput: 'admin' },
    });
    expect(resolveStoredPageSize(LIST_KEY, 50)).toBe(100);
  });

  it('ignores invalid page sizes', () => {
    patchStoredListPreferences(LIST_KEY, { pageSize: 7 });
    expect(resolveStoredPageSize(LIST_KEY, 50)).toBe(50);
  });

  it('round-trips column layout widths', () => {
    vi.useFakeTimers();
    persistStoredColumnLayout(LIST_KEY, {
      order: ['name', 'id'],
      hidden: [],
      widths: { name: 220 },
    });
    expect(resolveStoredColumnLayout(LIST_KEY)).toBeNull();

    vi.advanceTimersByTime(450);
    expect(resolveStoredColumnLayout(LIST_KEY)).toEqual({
      order: ['name', 'id'],
      hidden: [],
      widths: { name: 220 },
    });
    vi.useRealTimers();
  });

  it('flushes pending column layout writes immediately', () => {
    persistStoredColumnLayout(LIST_KEY, {
      order: ['name'],
      hidden: [],
      widths: { name: 160 },
    });
    flushStoredColumnLayout(LIST_KEY);
    expect(resolveStoredColumnLayout(LIST_KEY)?.widths).toEqual({ name: 160 });
  });
});

describe('usePersistedListPaging', () => {
  it('restores and saves paging preferences', () => {
    patchStoredListPreferences(LIST_KEY, { pageSize: 500, listMode: 'infinite' });

    const { result } = renderHook(() => usePersistedListPaging({ listKey: LIST_KEY }));
    expect(result.current.pageSize).toBe(500);
    expect(result.current.listMode).toBe('infinite');

    act(() => {
      result.current.setPageSize(1000);
      result.current.setListMode('paging');
    });

    expect(readStoredListPreferences(LIST_KEY)?.pageSize).toBe(1000);
    expect(readStoredListPreferences(LIST_KEY)?.listMode).toBe('paging');
  });
});

describe('usePersistedListFilters', () => {
  it('restores and saves filters', () => {
    patchStoredListPreferences(LIST_KEY, {
      filters: { searchInput: 'jobs', statusFilter: 'failed' },
    });

    const { result } = renderHook(() => usePersistedListFilters({
      listKey: LIST_KEY,
      defaultFilters: { searchInput: '', statusFilter: 'all' },
      sanitize: (raw) => {
        if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
        const record = raw as Record<string, unknown>;
        return {
          searchInput: typeof record.searchInput === 'string' ? record.searchInput : '',
          statusFilter: typeof record.statusFilter === 'string' ? record.statusFilter : 'all',
        };
      },
    }));

    expect(result.current[0]).toEqual({ searchInput: 'jobs', statusFilter: 'failed' });

    act(() => {
      result.current[1]({ searchInput: 'retry', statusFilter: 'queued' });
    });

    expect(readStoredListPreferences(LIST_KEY)?.filters).toEqual({
      searchInput: 'retry',
      statusFilter: 'queued',
    });
  });
});

describe('useGridQueryState persistListKey', () => {
  const columns: AppTableGridColumnDef<{ name: string }>[] = [
    {
      id: 'name',
      label: 'Name',
      renderCell: (row) => row.name,
      sort: { mode: 'server' },
      filter: { mode: 'server', type: 'text' },
    },
  ];

  it('restores and saves grid query', () => {
    patchStoredListPreferences(LIST_KEY, {
      gridQuery: {
        sort: { columnId: 'name', direction: 'desc' },
        filters: { name: { type: 'text', value: 'alice' } },
      },
    });

    const { result } = renderHook(() => useGridQueryState({
      columns,
      gridQueryMode: 'server',
      persistListKey: LIST_KEY,
    }));

    expect(result.current.query.sort).toEqual({ columnId: 'name', direction: 'desc' });
    expect(result.current.query.filters.name).toEqual({ type: 'text', value: 'alice' });

    act(() => {
      result.current.handleGridQueryChange(
        {
          sort: { columnId: 'name', direction: 'asc' },
          filters: {},
        },
        { source: 'sort', columnId: 'name' },
      );
    });

    expect(readStoredListPreferences(LIST_KEY)?.gridQuery).toEqual({
      sort: { columnId: 'name', direction: 'asc' },
      filters: {},
    });
  });
});
