import { describe, expect, it } from 'vitest';
import type { LibraryGridRow } from '../../types';
import { BUILTIN_FILTER_ALL, BUILTIN_FILTER_NO, BUILTIN_FILTER_YES } from '../../../../shared/lib/builtInFilter';
import { filterLibraries, libraryIsBuiltIn } from '../libraryListFilters';

const builtinRow: LibraryGridRow = {
  name: 'react',
  version: '19.0.0',
  core: true,
  requestedBy: [],
  installed: true,
};

const customRow: LibraryGridRow = {
  name: 'xlsx',
  version: '0.18.5',
  core: false,
  requestedBy: ['cms'],
  installed: true,
};

describe('libraryListFilters', () => {
  it('treats core libraries as built-in and developer libraries as not built-in', () => {
    expect(libraryIsBuiltIn(builtinRow)).toBe(true);
    expect(libraryIsBuiltIn(customRow)).toBe(false);
  });

  it('shows both origins when BuiltIn filter is All', () => {
    expect(filterLibraries([builtinRow, customRow], {
      builtInFilter: BUILTIN_FILTER_ALL,
      query: '',
    }).map((row) => row.name)).toEqual(['react', 'xlsx']);
  });

  it('hides built-in libraries when Not BuiltIn is selected', () => {
    expect(filterLibraries([builtinRow, customRow], {
      builtInFilter: BUILTIN_FILTER_NO,
      query: '',
    }).map((row) => row.name)).toEqual(['xlsx']);
  });

  it('hides custom libraries when BuiltIn is selected', () => {
    expect(filterLibraries([builtinRow, customRow], {
      builtInFilter: BUILTIN_FILTER_YES,
      query: '',
    }).map((row) => row.name)).toEqual(['react']);
  });

  it('matches library name in search', () => {
    expect(filterLibraries([builtinRow, customRow], {
      builtInFilter: BUILTIN_FILTER_ALL,
      query: 'XLS',
    }).map((row) => row.name)).toEqual(['xlsx']);
  });
});
