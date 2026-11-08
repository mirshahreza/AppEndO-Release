import type { GridQueryState } from '../../../lib/appTableGridQuery';

export type DataSourcesListQuery = {
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  name?: string;
  type?: string;
  status?: string;
  connection?: string;
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
};

const SORT_FIELDS = new Set(['name', 'type', 'status', 'created_at', 'updated_at']);

export function parseDataSourcesListQuery(raw: Record<string, unknown>): DataSourcesListQuery {
  const sortBy = String(raw.sortBy ?? '').trim();
  const sortDirRaw = String(raw.sortDir ?? raw.sortDirection ?? '').trim().toLowerCase();
  const sortDir = sortDirRaw === 'asc' ? 'asc' : sortDirRaw === 'desc' ? 'desc' : undefined;

  return {
    sortBy: SORT_FIELDS.has(sortBy) ? sortBy : undefined,
    sortDir,
    name: String(raw.name ?? raw.nameFilter ?? '').trim() || undefined,
    type: String(raw.type ?? raw.typeFilter ?? '').trim() || undefined,
    status: String(raw.status ?? '').trim() || undefined,
    connection: String(raw.connection ?? '').trim() || undefined,
    createdFrom: String(raw.createdFrom ?? '').trim() || undefined,
    createdTo: String(raw.createdTo ?? '').trim() || undefined,
    updatedFrom: String(raw.updatedFrom ?? '').trim() || undefined,
    updatedTo: String(raw.updatedTo ?? '').trim() || undefined,
  };
}

export function mapGridQueryToDataSourcesListQuery(
  query: GridQueryState,
): DataSourcesListQuery {
  const params: DataSourcesListQuery = {};

  if (query.sort) {
    params.sortBy = query.sort.columnId;
    params.sortDir = query.sort.direction;
  }

  for (const [columnId, filter] of Object.entries(query.filters)) {
    if (filter.type === 'text') {
      if (columnId === 'name') params.name = filter.value;
      if (columnId === 'connection') params.connection = filter.value;
    }
    if (filter.type === 'select' && !Array.isArray(filter.value) && columnId === 'type') {
      params.type = filter.value;
    }
    if (filter.type === 'select' && !Array.isArray(filter.value) && columnId === 'status') {
      params.status = filter.value;
    }
    if (filter.type === 'dateRange' && columnId === 'created_at') {
      params.createdFrom = filter.from ?? undefined;
      params.createdTo = filter.to ?? undefined;
    }
    if (filter.type === 'dateRange' && columnId === 'updated_at') {
      params.updatedFrom = filter.from ?? undefined;
      params.updatedTo = filter.to ?? undefined;
    }
  }

  return params;
}
