/**
 * CRUD Set wizard / skill suggestions. Canonical rules: docs/standards/crud-set.md
 * Do not invent endpoints. Only suggest APIs that already exist on the route list.
 */

import type { ApiFormField } from './apiFieldSchema';
import { deriveResourceBaseEndpoint } from './bindingResourceModel';
import {
  CRUD_SET_DEFAULT_ACTIONS,
  CRUD_SET_DEFAULT_DIALOGS,
  CRUD_SET_DEFAULT_GRID,
  CRUD_SET_DEFAULT_KANBAN,
  CRUD_SET_DEFAULT_PAGING,
  CRUD_SET_DEFAULT_SORTING,
  CRUD_SET_PAGE_SIZES,
  crudSetHumanizeField,
  type CrudSetActionsConfig,
  type CrudSetApiRef,
  type CrudSetCellKind,
  type CrudSetCreateApi,
  type CrudSetDialogsConfig,
  type CrudSetExportConfig,
  type CrudSetFilterBarConfig,
  type CrudSetFilterBarFilter,
  type CrudSetGridColumn,
  type CrudSetGridConfig,
  type CrudSetKanbanConfig,
  type CrudSetListBodyKind,
  type CrudSetPagingConfig,
  type CrudSetPatchApi,
  type CrudSetSortingConfig,
} from './crudSetSpec';

export type CrudSetRouteHint = {
  id: string;
  name: string;
  method: string;
  path: string;
};

export type SuggestedCrudSetPieces = {
  listBody: CrudSetListBodyKind;
  pagination: boolean;
  columns: CrudSetGridColumn[];
  filterBar: CrudSetFilterBarConfig;
  createApis: CrudSetCreateApi[];
  patches: CrudSetPatchApi[];
  deleteApi?: CrudSetApiRef;
  readOneApi?: CrudSetApiRef;
  export: CrudSetExportConfig;
  refresh: boolean;
  paging: CrudSetPagingConfig;
  sorting: CrudSetSortingConfig;
  grid: CrudSetGridConfig;
  kanban?: CrudSetKanbanConfig;
  actions: CrudSetActionsConfig;
  dialogs: CrudSetDialogsConfig;
};

const INTERNAL_FIELD_RE = /^(created_at|updated_at|deleted_at|created_by|updated_by|password|hash|token|secret|.*_hash|.*_token)$/i;
const IDENTITY_FIELD_RE = /^(id|name|title|email|code|slug|full_name|display_name|label)$/i;
const PARENT_FIELD_RE = /^(parent_id|parentid|parent)$/i;
const LOCK_ARCHIVE_RE = /(lock|archive)/i;
const FLAG_RE = /(active|enabled|hidden|published)/i;
const NOTE_FIELD_RE = /(^|_)note(s)?$/i;
const LINK_NAME_RE = /(url|href|link|website)/i;
const IMAGE_NAME_RE = /(photo|avatar|image|picture|thumb|logo)/i;
const LOCK_NAME_RE = /(^|_)(locked|lock_status|is_locked)($|_)/i;
const MAX_SUGGESTED_COLUMNS = 6;
const MAX_SUGGESTED_ACCEPTED_FIELDS = 6;
const MAX_SUGGESTED_FILTER_BAR_FILTERS = 2;

const normalizePath = (path: string): string => path.trim().replace(/\/+$/, '');

const pathSegmentsAfterBase = (path: string, base: string): string[] => {
  const rest = normalizePath(path).slice(normalizePath(base).length);
  return rest.split('/').map((segment) => segment.trim()).filter(Boolean);
};

const isParamSegment = (segment: string): boolean => (
  segment.startsWith(':')
  || (segment.startsWith('{') && segment.endsWith('}'))
);

export const isInternalCrudSetField = (fieldName: string): boolean => INTERNAL_FIELD_RE.test(fieldName);

export const suggestCrudSetListBody = (fields: readonly ApiFormField[]): CrudSetListBodyKind => (
  fields.some((field) => PARENT_FIELD_RE.test(field.name)) ? 'tree-grid' : 'grid'
);

export const suggestAcceptedFields = (
  fields: readonly ApiFormField[],
  options: { excludePrimaryKey?: boolean; max?: number } = {},
): string[] => {
  const max = options.max ?? MAX_SUGGESTED_ACCEPTED_FIELDS;
  const picked: string[] = [];
  for (const field of fields) {
    if (picked.length >= max) {
      break;
    }
    if (isInternalCrudSetField(field.name)) {
      continue;
    }
    if (options.excludePrimaryKey !== false && field.name === 'id') {
      continue;
    }
    picked.push(field.name);
  }
  return picked;
};

const suggestColumnCellKind = (field: ApiFormField): CrudSetCellKind => {
  const name = field.name.trim();
  if (LOCK_NAME_RE.test(name)) {
    return 'lock-status';
  }
  if (field.type === 'boolean') {
    return 'boolean-icon';
  }
  if (field.format === 'date' || field.format === 'date-time') {
    return 'date';
  }
  if (IMAGE_NAME_RE.test(name)) {
    return 'image';
  }
  if (field.enum && field.enum.length > 0) {
    return 'badge';
  }
  if (field.type === 'array') {
    return 'chips';
  }
  if (LINK_NAME_RE.test(name) && !IMAGE_NAME_RE.test(name)) {
    return 'link';
  }
  return 'text';
};

const suggestColumnWidth = (field: ApiFormField, cellKind: CrudSetCellKind): number => {
  if (cellKind === 'lock-status' || cellKind === 'boolean-icon' || cellKind === 'image') {
    return 88;
  }
  if (IDENTITY_FIELD_RE.test(field.name)) {
    return 160;
  }
  return 140;
};

/** One column with display, sort, filter, and width filled from the list-API field. */
export const suggestCrudSetColumnFromField = (field: ApiFormField): CrudSetGridColumn => {
  const cellKind = suggestColumnCellKind(field);
  const sortable = field.type !== 'array' && !NOTE_FIELD_RE.test(field.name);
  const filterable = field.type !== 'array' && cellKind !== 'chips';
  return {
    field: field.name,
    label: crudSetHumanizeField(field.name),
    cellKind,
    sortable,
    filterable,
    width: suggestColumnWidth(field, cellKind),
    ...(cellKind === 'date' ? { transform: 'date' as const } : {}),
    ...(cellKind === 'link' ? { transform: 'link-domain' as const } : {}),
    ...(cellKind === 'image' ? { imageMask: 'circle' as const } : {}),
    formPlacement: cellKind === 'boolean-icon' || cellKind === 'lock-status' ? 'side' : 'main',
  };
};

const applySuggestedColumnCardRoles = (columns: CrudSetGridColumn[]): CrudSetGridColumn[] => (
  columns.map((column, index) => {
    if (column.cardRole) {
      return column;
    }
    if (index === 0) {
      return { ...column, cardRole: 'title', isRowHeader: column.isRowHeader ?? true };
    }
    if (index === 1 && IDENTITY_FIELD_RE.test(column.field)) {
      return { ...column, cardRole: 'subtitle' };
    }
    return { ...column, cardRole: 'field' };
  })
);

/** Identity plus a few meaningful fields — never dump every response field. */
export const suggestCrudSetColumns = (fields: readonly ApiFormField[]): CrudSetGridColumn[] => {
  const identity = fields.filter((field) => IDENTITY_FIELD_RE.test(field.name) && !isInternalCrudSetField(field.name));
  const others = fields.filter((field) => (
    !IDENTITY_FIELD_RE.test(field.name) && !isInternalCrudSetField(field.name)
  ));
  const remaining = Math.max(0, MAX_SUGGESTED_COLUMNS - identity.length);
  const picked = [...identity, ...others.slice(0, remaining)];
  if (picked.length === 0 && fields[0]) {
    picked.push(fields[0]);
  }
  return applySuggestedColumnCardRoles(picked.map(suggestCrudSetColumnFromField));
};

const slugifyId = (value: string): string => {
  const slug = value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return slug || `item_${Math.random().toString(36).slice(2, 8)}`;
};

const optionsFromEnum = (field: ApiFormField): CrudSetFilterBarFilter['options'] => (
  (field.enum ?? []).map((value) => ({
    value,
    label: crudSetHumanizeField(value),
  }))
);

/**
 * Search on; at most two enum/array toolbar filters. Never dump every column
 * into the filter bar. Skip a filter that has no options yet.
 */
export const suggestCrudSetFilterBar = (fields: readonly ApiFormField[]): CrudSetFilterBarConfig => {
  const filters: CrudSetFilterBarFilter[] = [];
  for (const field of fields) {
    if (filters.length >= MAX_SUGGESTED_FILTER_BAR_FILTERS) {
      break;
    }
    if (isInternalCrudSetField(field.name)) {
      continue;
    }
    const enumOptions = optionsFromEnum(field);
    if (enumOptions.length > 0) {
      filters.push({
        id: slugifyId(field.name),
        field: field.name,
        label: crudSetHumanizeField(field.name),
        controlType: enumOptions.length <= 4 ? 'radio-group' : 'select',
        options: enumOptions,
      });
      continue;
    }
    if (field.type === 'boolean') {
      filters.push({
        id: slugifyId(field.name),
        field: field.name,
        label: crudSetHumanizeField(field.name),
        controlType: 'radio-group',
        options: [
          { value: 'true', label: 'Yes' },
          { value: 'false', label: 'No' },
        ],
      });
    }
  }
  return {
    enabled: true,
    search: true,
    searchClear: true,
    filters,
  };
};

export const suggestCrudSetFilterFromField = (field: ApiFormField): CrudSetFilterBarFilter => {
  const enumOptions = optionsFromEnum(field);
  if (enumOptions.length > 0) {
    return {
      id: slugifyId(field.name),
      field: field.name,
      label: crudSetHumanizeField(field.name),
      controlType: enumOptions.length <= 4 ? 'radio-group' : 'select',
      options: enumOptions,
    };
  }
  if (field.type === 'boolean') {
    return {
      id: slugifyId(field.name),
      field: field.name,
      label: crudSetHumanizeField(field.name),
      controlType: 'radio-group',
      options: [
        { value: 'true', label: 'Yes' },
        { value: 'false', label: 'No' },
      ],
    };
  }
  if (field.type === 'array') {
    return {
      id: slugifyId(field.name),
      field: field.name,
      label: crudSetHumanizeField(field.name),
      controlType: 'checkbox-group',
      matchLogic: 'or',
      options: [],
    };
  }
  return {
    id: slugifyId(field.name),
    field: field.name,
    label: crudSetHumanizeField(field.name),
    controlType: 'select',
    options: [],
  };
};

const matchingResourceRoutes = (
  listPath: string,
  routes: readonly CrudSetRouteHint[],
): CrudSetRouteHint[] => {
  const listBase = normalizePath(deriveResourceBaseEndpoint(listPath)).toLowerCase();
  if (!listBase) {
    return [];
  }
  return routes.filter((route) => {
    const normalized = normalizePath(route.path).toLowerCase();
    return normalized === listBase || normalized.startsWith(`${listBase}/`);
  });
};

const extraSegmentsAfterId = (path: string, listPath: string): string[] => {
  const base = deriveResourceBaseEndpoint(listPath);
  const segments = pathSegmentsAfterBase(path, base);
  if (segments.length === 0) {
    return [];
  }
  if (!isParamSegment(segments[0] ?? '')) {
    return segments;
  }
  return segments.slice(1);
};

const booleanFieldMatching = (
  fields: readonly ApiFormField[],
  extra: string[],
): string | undefined => {
  const haystack = extra.join(' ').toLowerCase();
  const booleans = fields.filter((field) => field.type === 'boolean');
  const named = booleans.find((field) => haystack.includes(field.name.toLowerCase()));
  if (named) {
    return named.name;
  }
  if (LOCK_ARCHIVE_RE.test(haystack)) {
    return booleans.find((field) => LOCK_ARCHIVE_RE.test(field.name))?.name;
  }
  if (FLAG_RE.test(haystack)) {
    return booleans.find((field) => FLAG_RE.test(field.name))?.name;
  }
  return undefined;
};

/**
 * Suggest remaining CRUD Set pieces from the list API, its OpenAPI fields,
 * and already-published sibling routes. Never invent an endpoint.
 */
export const suggestCrudSetPieces = (options: {
  listPath: string;
  listFields: readonly ApiFormField[];
  routes: readonly CrudSetRouteHint[];
}): SuggestedCrudSetPieces => {
  const listBody = suggestCrudSetListBody(options.listFields);
  const columns = applySuggestedColumnCardRoles(suggestCrudSetColumns(options.listFields));
  const filterBar = suggestCrudSetFilterBar(options.listFields);
  const siblings = matchingResourceRoutes(options.listPath, options.routes);
  const accepted = suggestAcceptedFields(options.listFields);

  const createApis: CrudSetCreateApi[] = [];
  const patches: CrudSetPatchApi[] = [];
  let deleteApi: CrudSetApiRef | undefined;
  let readOneApi: CrudSetApiRef | undefined;
  let contentPatchAssigned = false;

  for (const route of siblings) {
    const method = route.method.trim().toUpperCase();
    const extra = extraSegmentsAfterId(route.path, options.listPath);
    const afterBase = pathSegmentsAfterBase(route.path, deriveResourceBaseEndpoint(options.listPath));
    const isCollection = afterBase.length === 0;
    const isIdResource = afterBase.length === 1 && isParamSegment(afterBase[0] ?? '');
    const isPurposePath = afterBase.length > 1 && isParamSegment(afterBase[0] ?? '');

    if (method === 'POST' && isCollection) {
      createApis.push({
        id: slugifyId(route.name || route.path),
        label: route.name.trim() || `Add ${crudSetHumanizeField(deriveResourceBaseEndpoint(route.path).split('/').pop() ?? 'record')}`,
        endpointId: route.path,
        purpose: route.name.trim() || undefined,
        acceptedFields: accepted,
      });
      continue;
    }

    if (method === 'GET' && isIdResource && !readOneApi) {
      readOneApi = { endpointId: route.path };
      continue;
    }

    if (method === 'DELETE' && isIdResource && !deleteApi) {
      deleteApi = { endpointId: route.path };
      continue;
    }

    if ((method === 'PATCH' || method === 'PUT') && isIdResource && !contentPatchAssigned) {
      contentPatchAssigned = true;
      patches.push({
        id: slugifyId(route.name || 'edit'),
        label: route.name.trim() || 'Edit record',
        endpointId: route.path,
        kind: 'content',
        acceptedFields: accepted,
        interaction: 'form',
      });
      continue;
    }

    if (method === 'PATCH' && isPurposePath) {
      const booleanField = booleanFieldMatching(options.listFields, extra);
      const label = route.name.trim() || crudSetHumanizeField(extra[extra.length - 1] ?? 'Update');
      const lockLike = LOCK_ARCHIVE_RE.test(label) || extra.some((segment) => LOCK_ARCHIVE_RE.test(segment));
      patches.push({
        id: slugifyId(route.name || extra.join('-') || 'purpose'),
        label,
        endpointId: route.path,
        kind: 'purpose',
        acceptedFields: booleanField ? [booleanField] : accepted.slice(0, 1),
        interaction: booleanField ? 'boolean-toggle' : 'form',
        toggleConfirm: Boolean(booleanField && lockLike),
      });
    }
  }

  return {
    listBody,
    pagination: listBody === 'grid' || listBody === 'kanban',
    columns,
    filterBar,
    createApis,
    patches,
    deleteApi,
    readOneApi,
    export: {
      enabled: true,
      formats: ['xlsx', 'csv'],
      defaultFormat: 'xlsx',
      defaultIncludeHeader: true,
    },
    refresh: true,
    paging: { ...CRUD_SET_DEFAULT_PAGING, pageSizes: [...CRUD_SET_PAGE_SIZES] },
    sorting: {
      ...CRUD_SET_DEFAULT_SORTING,
      defaultField: columns.find((column) => column.sortable !== false)?.field ?? columns[0]?.field,
    },
    grid: { ...CRUD_SET_DEFAULT_GRID },
    ...(listBody === 'kanban' ? { kanban: { ...CRUD_SET_DEFAULT_KANBAN } } : {}),
    actions: { ...CRUD_SET_DEFAULT_ACTIONS },
    dialogs: { ...CRUD_SET_DEFAULT_DIALOGS },
  };
};
