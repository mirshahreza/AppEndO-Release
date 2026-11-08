import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DATA_STUDIO_LIST_FILTERS,
  sanitizeDataStudioListFilters,
} from '../dataStudioListFilters';

describe('sanitizeDataStudioListFilters', () => {
  it('restores data source, object kind, and search', () => {
    expect(sanitizeDataStudioListFilters({
      selectedDataSourceId: 'ds-warehouse',
      objectKind: 'VIEW',
      searchInput: 'order',
    })).toEqual({
      selectedDataSourceId: 'ds-warehouse',
      objectKind: 'VIEW',
      searchInput: 'order',
    });
  });

  it('falls back to defaults for invalid object kinds', () => {
    expect(sanitizeDataStudioListFilters({
      selectedDataSourceId: 'ds-1',
      objectKind: 'SEQUENCE',
      searchInput: 12,
    })).toEqual({
      selectedDataSourceId: 'ds-1',
      objectKind: DEFAULT_DATA_STUDIO_LIST_FILTERS.objectKind,
      searchInput: '',
    });
  });

  it('rejects non-objects', () => {
    expect(sanitizeDataStudioListFilters(null)).toBeNull();
    expect(sanitizeDataStudioListFilters('VIEW')).toBeNull();
  });
});
