import type {
  EdgeModelDefinition,
  EdgeModelStudioColumnMeta,
  EdgeModelStudioMeta,
  UpsertEdgeModelStudioMetaInput,
} from '../../../shared/api/contracts/data-api';
import {
  DEFAULT_COLUMN_FILTER_ROLE,
  DEFAULT_COLUMN_SEARCH_ROLE,
  QUERY_SURFACES_EXTENSION_KEY,
} from '../../../shared/api/contracts/data-api';
import {
  buildQuerySurfacesDocumentForObject,
} from './querySurfaceCatalogSeeds';
import {
  inferColumnFilterRole,
  inferColumnSearchRole,
} from './querySurfaceDefaultHeuristics';

const shouldPersistSearchRole = (
  role: ReturnType<typeof inferColumnSearchRole>,
): boolean => role !== DEFAULT_COLUMN_SEARCH_ROLE;

const shouldPersistFilterRole = (
  role: ReturnType<typeof inferColumnFilterRole>,
): boolean => role !== DEFAULT_COLUMN_FILTER_ROLE;

export const mergeQuerySurfaceColumnMeta = (
  model: EdgeModelDefinition,
  existing: readonly EdgeModelStudioColumnMeta[],
): EdgeModelStudioColumnMeta[] => {
  const byName = new Map(existing.map((row) => [row.columnName, { ...row }]));
  for (const column of model.columns) {
    const current = byName.get(column.name) ?? { columnName: column.name };
    const searchRole = inferColumnSearchRole(column, current.searchRole);
    const filterRole = inferColumnFilterRole(column, current.filterRole);
    const next: EdgeModelStudioColumnMeta = { ...current, columnName: column.name };
    if (shouldPersistSearchRole(searchRole)) {
      next.searchRole = searchRole;
    } else {
      delete next.searchRole;
    }
    if (shouldPersistFilterRole(filterRole)) {
      next.filterRole = filterRole;
    } else {
      delete next.filterRole;
    }
    byName.set(column.name, next);
  }
  return [...byName.values()];
};

export const mergeQuerySurfaceExtensions = (
  objectName: string,
  extensions: Record<string, unknown>,
): Record<string, unknown> => {
  const next = { ...extensions };
  const catalog = buildQuerySurfacesDocumentForObject(objectName);
  if (catalog) {
    next[QUERY_SURFACES_EXTENSION_KEY] = catalog;
  }
  return next;
};

export const buildQuerySurfaceStudioMetaUpsert = (
  model: EdgeModelDefinition,
  meta: EdgeModelStudioMeta,
): UpsertEdgeModelStudioMetaInput => ({
  columnMeta: mergeQuerySurfaceColumnMeta(model, meta.columnMeta),
  extensions: mergeQuerySurfaceExtensions(model.objectName, meta.extensions),
});
