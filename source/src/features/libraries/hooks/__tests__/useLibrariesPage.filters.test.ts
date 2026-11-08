// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { APP_LIST_PREFERENCE_KEYS } from '../../../../shared/lib/listPreferenceKeys';
import {
  LIST_PREFERENCES_STORAGE_PREFIX,
  patchStoredListPreferences,
  readStoredListPreferences,
} from '../../../../shared/lib/listPreferencesStorage';
import { BUILTIN_FILTER_NO, BUILTIN_FILTER_YES } from '../../../../shared/lib/builtInFilter';

vi.mock('../../../../shared/api/queries/libraries', () => ({
  useLibrariesListQuery: () => ({
    data: [],
    isLoading: false,
    isError: false,
    error: null,
    isFetching: false,
    refetch: vi.fn(),
  }),
  useInstallLibraryMutation: () => ({
    isPending: false,
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    variables: undefined,
  }),
  useUpgradeLibraryMutation: () => ({
    isPending: false,
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    variables: undefined,
  }),
  useUninstallLibraryMutation: () => ({
    isPending: false,
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    variables: undefined,
  }),
}));

import { useLibrariesPage } from '../useLibrariesPage';

const STORAGE_KEY = `${LIST_PREFERENCES_STORAGE_PREFIX}${APP_LIST_PREFERENCE_KEYS.libraries}`;

afterEach(() => {
  window.localStorage.removeItem(STORAGE_KEY);
});

describe('useLibrariesPage filters', () => {
  it('migrates leftover Kind CSVs into the BuiltIn filter and remembers it', () => {
    patchStoredListPreferences(APP_LIST_PREFERENCE_KEYS.libraries, {
      filters: { searchInput: '', kindFilter: 'custom' },
    });

    const { result } = renderHook(() => useLibrariesPage());
    expect(result.current.builtInFilter).toBe(BUILTIN_FILTER_NO);

    act(() => {
      result.current.setBuiltInFilter(BUILTIN_FILTER_YES);
    });

    expect(readStoredListPreferences(APP_LIST_PREFERENCE_KEYS.libraries)?.filters).toEqual({
      searchInput: '',
      builtInFilter: BUILTIN_FILTER_YES,
    });
  });
});
