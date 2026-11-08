import { Op, type Includeable, type Order, type WhereOptions } from 'sequelize';
import { literal } from 'sequelize';
import type {
  EdgeApiComputedField,
  EdgeApiIncludeConfig,
  EdgeApiOperation,
  EdgeModelDefinition,
  EdgeModelStudioColumnMeta,
} from '../../../shared/api/contracts/data-api';
import {
  columnParticipatesInQuickSearch,
  resolveEffectiveSearchRole,
} from '../../domain/data-api/querySurfaceDefaultHeuristics';
import { resolveDefaultDataApiReadFields } from '../../../shared/lib/edgeApiOperations';
import { compileComputedSqlForDialect } from './computedSqlDialect';
import { compileJsonExtractionSql } from '../../domain/data-api/jsonFieldExtraction';

export type ParsedFilter = Record<string, Record<string, string>>;

export const parsePositiveInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
};

export const parseFilterQuery = (query: Record<string, unknown>): ParsedFilter => {
  const filter: ParsedFilter = {};

  // Flat keys: filter[field][op]=value (raw / unparsed querystring style).
  for (const [key, value] of Object.entries(query)) {
    const match = /^filter\[([^\]]+)\]\[([^\]]+)\]$/.exec(key);
    if (!match || typeof value !== 'string') {
      continue;
    }
    const [, field, operator] = match;
    filter[field] = filter[field] ?? {};
    filter[field][operator] = value;
  }

  // Nested keys: Express/qs default parsing of filter[field][op] → { filter: { field: { op: value } } }.
  // Without this branch, CMS Contents Status/Language toolbar filters (and any Data API
  // filter[field][op] client) silently no-op because query.filter is an object, not a flat key.
  const nested = query.filter;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    for (const [field, operators] of Object.entries(nested as Record<string, unknown>)) {
      if (!operators || typeof operators !== 'object' || Array.isArray(operators)) {
        continue;
      }
      for (const [operator, value] of Object.entries(operators as Record<string, unknown>)) {
        if (typeof value !== 'string') {
          continue;
        }
        filter[field] = filter[field] ?? {};
        filter[field][operator] = value;
      }
    }
  }

  return filter;
};

export const buildWhereFromFilter = (
  filter: ParsedFilter,
  allowedFields: Set<string>,
  columns: EdgeModelDefinition['columns'],
): WhereOptions => {
  const where: WhereOptions = {};
  const columnByField = new Map(columns.map((column) => [column.field, column]));
  const columnByName = new Map(columns.map((column) => [column.name, column]));

  for (const [field, operators] of Object.entries(filter)) {
    const column = columnByField.get(field) ?? columnByName.get(field);
    if (!column || (!allowedFields.has(column.field) && !allowedFields.has(column.name))) {
      continue;
    }

    const attribute = column.field;
    for (const [operator, rawValue] of Object.entries(operators)) {
      switch (operator) {
        case 'eq':
          (where as Record<string, unknown>)[attribute] = rawValue;
          break;
        case 'like':
        case 'contains':
          (where as Record<string, unknown>)[attribute] = { [Op.like]: `%${rawValue}%` };
          break;
        case 'startsWith':
          (where as Record<string, unknown>)[attribute] = { [Op.like]: `${rawValue}%` };
          break;
        case 'ne':
        case 'neq':
          (where as Record<string, unknown>)[attribute] = { [Op.ne]: rawValue };
          break;
        case 'in':
          (where as Record<string, unknown>)[attribute] = {
            [Op.in]: rawValue.split(',').map((item) => item.trim()).filter(Boolean),
          };
          break;
        case 'gte':
          (where as Record<string, unknown>)[attribute] = { [Op.gte]: rawValue };
          break;
        case 'lte':
          (where as Record<string, unknown>)[attribute] = { [Op.lte]: rawValue };
          break;
        case 'gt':
          (where as Record<string, unknown>)[attribute] = { [Op.gt]: rawValue };
          break;
        case 'lt':
          (where as Record<string, unknown>)[attribute] = { [Op.lt]: rawValue };
          break;
        default:
          break;
      }
    }
  }

  return where;
};

const TEXT_COLUMN_TYPE_PATTERN = /STRING|TEXT|CHAR/i;

export const parseSearchQuery = (query: Record<string, unknown>): string => (
  typeof query.search === 'string' ? query.search.trim() : ''
);

export const resolveSearchableFields = (
  allowedFields: Set<string>,
  columns: EdgeModelDefinition['columns'],
  columnMeta: readonly EdgeModelStudioColumnMeta[] = [],
): string[] => columns
  .filter((column) => {
    if (!allowedFields.has(column.field) && !allowedFields.has(column.name)) {
      return false;
    }
    const role = resolveEffectiveSearchRole(column, columnMeta);
    return columnParticipatesInQuickSearch(role);
  })
  .map((column) => column.field);

export const buildSearchWhere = (
  search: string,
  searchableFields: string[],
): WhereOptions => {
  if (!search || searchableFields.length === 0) {
    return {};
  }
  return {
    [Op.or]: searchableFields.map((field) => ({ [field]: { [Op.like]: `%${search}%` } })),
  } as WhereOptions;
};

export const parseSortQuery = (
  query: Record<string, unknown>,
  allowedFields: Set<string>,
  columns: EdgeModelDefinition['columns'],
): Order | undefined => {
  const rawSort = typeof query.sort === 'string' ? query.sort.trim() : '';
  const sortBy = typeof query.sortBy === 'string' ? query.sortBy.trim() : '';
  const sortDir = typeof query.sortDir === 'string' ? query.sortDir.trim().toLowerCase() : '';
  const sort = rawSort || (sortBy ? `${sortDir === 'desc' ? '-' : ''}${sortBy}` : '');
  if (!sort) {
    return undefined;
  }

  const columnByField = new Map(columns.map((column) => [column.field, column]));
  const columnByName = new Map(columns.map((column) => [column.name, column]));
  const order: Order = [];

  for (const segment of sort.split(',')) {
    const trimmed = segment.trim();
    if (!trimmed) {
      continue;
    }
    const descending = trimmed.startsWith('-');
    const field = descending ? trimmed.slice(1) : trimmed;
    const column = columnByField.get(field) ?? columnByName.get(field);
    if (!column || (!allowedFields.has(column.field) && !allowedFields.has(column.name))) {
      continue;
    }
    order.push([column.field, descending ? 'DESC' : 'ASC']);
  }

  return order.length > 0 ? order : undefined;
};

export const resolveReadableAttributes = (
  operation: EdgeApiOperation,
  model: EdgeModelDefinition,
  viewName?: string,
): string[] | undefined => {
  if (viewName && operation.query?.views?.[viewName]) {
    return operation.query.views[viewName];
  }

  const configured = operation.fields?.read;
  if (!configured || configured.length === 0) {
    return resolveDefaultDataApiReadFields(model);
  }
  const modelFields = new Set(model.columns.map((column) => column.field));
  return configured.filter((field) => modelFields.has(field));
};

export const parseIncludeAliases = (
  query: Record<string, unknown>,
  operation: EdgeApiOperation,
): string[] => {
  const raw = typeof query.include === 'string' ? query.include.trim() : '';
  const allowed = new Set(operation.query?.includes ?? []);

  if (raw) {
    return raw
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item && (allowed.size === 0 || allowed.has(item)));
  }

  const configured = (operation.includeConfigs ?? []).filter((item) => item.enabled);
  if (configured.length > 0) {
    return configured
      .map((item) => item.as)
      .filter((alias) => allowed.size === 0 || allowed.has(alias));
  }

  return [];
};

const parseIncludeOrder = (order: string | undefined): Order | undefined => {
  if (!order?.trim()) {
    return undefined;
  }

  const segments = order.split(',').map((segment) => segment.trim()).filter(Boolean);
  if (segments.length === 0) {
    return undefined;
  }

  return segments.map((segment) => {
    const descending = segment.startsWith('-');
    const field = descending ? segment.slice(1) : segment;
    return [field, descending ? 'DESC' : 'ASC'] as const;
  });
};

const buildNestedIncludeOptions = (
  aliases: string[],
  model: EdgeModelDefinition,
  allModels: EdgeModelDefinition[],
): Includeable[] => aliases
  .map((alias) => {
    for (const def of allModels) {
      const association = def.associations.find((item) => item.as === alias);
      if (association) {
        return { association: alias };
      }
    }

    const association = model.associations.find((item) => item.as === alias);
    if (!association) {
      return null;
    }
    return { association: alias };
  })
  .filter((item): item is Includeable => Boolean(item));

const applyIncludeConfig = (
  base: Includeable,
  config: EdgeApiIncludeConfig | undefined,
  model: EdgeModelDefinition,
  allModels: EdgeModelDefinition[],
): Includeable => {
  if (!config) {
    return base;
  }

  const association = model.associations.find((item) => item.as === config.as);
  const next: Record<string, unknown> = {
    ...(typeof base === 'object' && base !== null ? base : {}),
    association: config.as,
  };

  if (config.fields && config.fields.length > 0) {
    next.attributes = config.fields;
  }

  if (config.limit) {
    next.limit = config.limit;
  }

  const isCollectionAssociation = association?.kind === 'hasMany'
    || association?.kind === 'belongsToMany';
  if (config.separate === true || (isCollectionAssociation && config.limit)) {
    next.separate = true;
  }

  const order = parseIncludeOrder(config.order);
  if (order) {
    next.order = order;
  }

  if (config.nestedIncludes && config.nestedIncludes.length > 0) {
    next.include = buildNestedIncludeOptions(config.nestedIncludes, model, allModels);
  }

  return next as Includeable;
};

export const buildIncludeOptionsFromOperation = (
  aliases: string[],
  operation: EdgeApiOperation,
  model: EdgeModelDefinition,
  allModels: EdgeModelDefinition[] = [model],
): Includeable[] => {
  const configByAlias = new Map(
    (operation.includeConfigs ?? []).map((item) => [item.as, item]),
  );

  return aliases
    .map((alias) => {
      const association = model.associations.find((item) => item.as === alias);
      if (!association) {
        return null;
      }

      const base: Includeable = { association: alias };
      return applyIncludeConfig(base, configByAlias.get(alias), model, allModels);
    })
    .filter((item): item is Includeable => Boolean(item));
};

export const buildIncludeOptions = (
  aliases: string[],
  model: EdgeModelDefinition,
) => aliases
  .map((alias) => {
    const association = model.associations.find((item) => item.as === alias);
    if (!association) {
      return null;
    }
    return { association: alias };
  })
  .filter((item): item is Includeable => Boolean(item));

const resolvePrimaryKeyColumnName = (model: EdgeModelDefinition): string => {
  if (typeof model.primaryKey === 'string') {
    const column = model.columns.find((item) => (
      item.field === model.primaryKey || item.name === model.primaryKey
    ));
    return column?.name ?? model.primaryKey;
  }

  const first = model.primaryKey[0];
  const column = model.columns.find((item) => item.field === first || item.name === first);
  return column?.name ?? first;
};

export const interpolateComputedExpression = (
  expression: string,
  model: EdgeModelDefinition,
  dialect?: string | null,
): string => {
  const tableName = model.sequelize.tableName;
  const schemaPrefix = model.schema ? `${model.schema}.` : '';
  const pkColumn = resolvePrimaryKeyColumnName(model);
  const compiled = compileComputedSqlForDialect(expression, dialect);

  return compiled
    .replace(/\{\{table\}\}/g, tableName)
    .replace(/\{\{schema\}\}/g, model.schema ?? '')
    .replace(/\{\{qualifiedTable\}\}/g, `${schemaPrefix}${tableName}`)
    .replace(/\{\{pk\}\}/g, pkColumn)
    .replace(/\{\{parent\}\}/g, model.sequelize.modelName);
};

export const buildComputedAttributeIncludes = (
  computedFields: EdgeApiComputedField[] | undefined,
  model: EdgeModelDefinition,
  dialect?: string | null,
): Array<[ReturnType<typeof literal>, string]> => {
  if (!computedFields || computedFields.length === 0) {
    return [];
  }

  return computedFields.map((field) => {
    if (field.kind === 'json_path' && field.sourceField) {
      return [
        literal(compileJsonExtractionSql({
          outputField: field.outputField,
          sourceColumn: field.sourceField,
          jsonPath: field.expression,
        }, dialect)),
        field.outputField,
      ];
    }
    return [
      literal(interpolateComputedExpression(field.expression, model, dialect)),
      field.outputField,
    ];
  });
};

export const buildQueryAttributes = (
  readableAttributes: string[] | undefined,
  computedFields: EdgeApiComputedField[] | undefined,
  model: EdgeModelDefinition,
  dialect?: string | null,
): string[] | { include: Array<[ReturnType<typeof literal>, string]>; exclude?: string[] } | undefined => {
  const computedIncludes = buildComputedAttributeIncludes(computedFields, model, dialect);
  if (computedIncludes.length === 0) {
    return readableAttributes;
  }

  if (!readableAttributes) {
    return {
      include: computedIncludes,
    };
  }

  return {
    include: computedIncludes,
    exclude: [],
  };
};

export const resolveLookupWhere = (
  operation: EdgeApiOperation,
  query: Record<string, unknown>,
  params: Record<string, string> | undefined,
  columns: EdgeModelDefinition['columns'],
): WhereOptions => {
  const columnByField = new Map(columns.map((column) => [column.field, column]));
  const columnByName = new Map(columns.map((column) => [column.name, column]));

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (key === 'pk') {
        continue;
      }
      const column = columnByField.get(key) ?? columnByName.get(key);
      if (column) {
        return { [column.field]: value };
      }
    }
  }

  for (const [key, value] of Object.entries(query)) {
    if (key === 'page' || key === 'pageSize' || key === 'sort' || key === 'include' || key === 'view' || key === 'lang') {
      continue;
    }
    if (key.startsWith('filter[')) {
      continue;
    }
    const column = columnByField.get(key) ?? columnByName.get(key);
    if (column && value != null && String(value).trim()) {
      return { [column.field]: value };
    }
  }

  throw new Error('Lookup requires an alternate key query parameter or path param.');
};
