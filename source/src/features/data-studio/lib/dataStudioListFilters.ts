import type { DataStudioExplorerObjectKind } from '../types';
import {
  DATA_STUDIO_EXPLORER_OBJECT_KIND_OPTIONS,
  DEFAULT_DATA_STUDIO_EXPLORER_OBJECT_KIND,
} from './explorerObjectKinds';

export type DataStudioListFilters = {
  selectedDataSourceId: string;
  objectKind: DataStudioExplorerObjectKind;
  searchInput: string;
};

export const DEFAULT_DATA_STUDIO_LIST_FILTERS: DataStudioListFilters = {
  selectedDataSourceId: '',
  objectKind: DEFAULT_DATA_STUDIO_EXPLORER_OBJECT_KIND,
  searchInput: '',
};

const OBJECT_KINDS: ReadonlySet<string> = new Set(
  DATA_STUDIO_EXPLORER_OBJECT_KIND_OPTIONS.map((option) => option.value),
);

export function sanitizeDataStudioListFilters(raw: unknown): DataStudioListFilters | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const objectKind = typeof record.objectKind === 'string' && OBJECT_KINDS.has(record.objectKind)
    ? record.objectKind as DataStudioExplorerObjectKind
    : DEFAULT_DATA_STUDIO_EXPLORER_OBJECT_KIND;

  return {
    selectedDataSourceId: typeof record.selectedDataSourceId === 'string'
      ? record.selectedDataSourceId
      : '',
    objectKind,
    searchInput: typeof record.searchInput === 'string' ? record.searchInput : '',
  };
}
