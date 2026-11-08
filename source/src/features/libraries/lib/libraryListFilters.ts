import type { LibraryGridRow } from '../types';
import { matchesBuiltInFilter } from '../../../shared/lib/builtInFilter';

export function libraryIsBuiltIn(row: Pick<LibraryGridRow, 'core'>): boolean {
  return Boolean(row.core);
}

export function libraryMatchesSearch(
  row: Pick<LibraryGridRow, 'name'>,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }

  return row.name.toLowerCase().includes(needle);
}

export function filterLibraries(
  rows: readonly LibraryGridRow[],
  input: { builtInFilter: string; query: string },
): LibraryGridRow[] {
  return rows.filter((row) => (
    matchesBuiltInFilter(libraryIsBuiltIn(row), input.builtInFilter)
    && libraryMatchesSearch(row, input.query)
  ));
}
