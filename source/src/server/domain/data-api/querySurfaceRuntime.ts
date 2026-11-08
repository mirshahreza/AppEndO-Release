import type { WhereOptions } from 'sequelize';
import type {
  EdgeModelDefinition,
  EdgeModelColumn,
  EdgeModelStudioColumnMeta,
  EdgeModelStudioMeta,
  QueryPresetDefinition,
  QuerySurfaceBindingDocument,
} from '../../../shared/api/contracts/data-api';
import {
  parseQuerySurfacesDocument,
  type QuerySurfacesDocument,
} from '../../../shared/api/contracts/data-api';
import type { ListWhereColumnMap } from '../../../shared/ui/list-filter/listWhereQuery';
import {
  listWhereTreeToIr,
  parseListWhereTreeParam,
  sanitizeListWhereTree,
} from '../../../shared/ui/list-filter/listWhereFilter';
import { listWhereIrToSequelize } from '../../../shared/ui/list-filter/listWhereQuery';
import { DEFAULT_WHERE_OPERATORS } from '../../../shared/ui/where-builder/whereBuilderModel';
import type { WhereField, WhereGroupNode } from '../../../shared/ui/where-builder/whereBuilderModel';
import {
  columnParticipatesInListWhere,
  columnParticipatesInQuickSearch,
  resolveEffectiveFilterRole,
  resolveEffectiveSearchRole,
} from './querySurfaceDefaultHeuristics';
import { edgeModelListWhereColumnsFromRoles } from '../../services/data-api/edgeModelListWhere';
import { grantAllowsPrincipal, type QuerySurfacePrincipal } from './querySurfaceGrants';

export type { QuerySurfacePrincipal };

const DATE_TYPE_PATTERN = /DATE|TIME|TIMESTAMP/i;

export const resolveSearchableFieldNames = (
  model: EdgeModelDefinition,
  columnMeta: readonly EdgeModelStudioColumnMeta[],
  allowedFields: Set<string>,
): string[] => (
  model.columns
    .filter((column) => {
      const field = column.field;
      if (!allowedFields.has(field) && !allowedFields.has(column.name)) {
        return false;
      }
      const role = resolveEffectiveSearchRole(column, columnMeta);
      return columnParticipatesInQuickSearch(role);
    })
    .map((column) => column.field)
);

export const resolveListWhereFieldIds = (
  model: EdgeModelDefinition,
  columnMeta: readonly EdgeModelStudioColumnMeta[],
  binding: QuerySurfaceBindingDocument,
  principal: QuerySurfacePrincipal,
  allowedFields: Set<string>,
): Set<string> => {
  const ids = new Set<string>();
  for (const column of model.columns) {
    const field = column.field;
    if (!allowedFields.has(field) && !allowedFields.has(column.name)) {
      continue;
    }
    const role = resolveEffectiveFilterRole(column, columnMeta);
    if (!columnParticipatesInListWhere(role)) {
      continue;
    }
    if (role === 'restricted') {
      const grant = binding.columnWhereGrants[field] ?? binding.columnWhereGrants[column.name];
      if (!grantAllowsPrincipal(grant, principal)) {
        continue;
      }
    }
    ids.add(field);
  }
  return ids;
};

export const buildListWhereFields = (
  model: EdgeModelDefinition,
  columnMeta: readonly EdgeModelStudioColumnMeta[],
  binding: QuerySurfaceBindingDocument,
  principal: QuerySurfacePrincipal,
  allowedFields: Set<string>,
): WhereField[] => {
  const columnMap = edgeModelListWhereColumnsFromRoles(
    model,
    columnMeta,
    binding,
    principal,
    allowedFields,
  );
  const metaByColumnName = new Map(
    columnMeta.map((entry) => [entry.columnName.trim(), entry] as const),
  );
  const resolveFieldLabel = (fieldId: string): string => {
    const modelColumn = model.columns.find((column) => column.field === fieldId);
    const meta = modelColumn
      ? (metaByColumnName.get(modelColumn.name) ?? metaByColumnName.get(modelColumn.field))
      : metaByColumnName.get(fieldId);
    const displayLabel = meta?.displayLabel?.trim();
    return displayLabel || fieldId;
  };

  return Object.entries(columnMap).map(([id, column]) => ({
    id,
    label: resolveFieldLabel(id),
    type: column.type === 'number'
      ? 'number'
      : column.type === 'boolean'
        ? 'boolean'
        : column.type === 'date'
          ? 'date'
          : 'text',
  }));
};

export const buildListWhereColumnMap = (
  model: EdgeModelDefinition,
  columnMeta: readonly EdgeModelStudioColumnMeta[],
  binding: QuerySurfaceBindingDocument,
  principal: QuerySurfacePrincipal,
  allowedFields: Set<string>,
): ListWhereColumnMap => (
  edgeModelListWhereColumnsFromRoles(model, columnMeta, binding, principal, allowedFields)
);

export const sanitizeListWhereForModel = (
  tree: WhereGroupNode,
  fields: readonly WhereField[],
): WhereGroupNode => (
  sanitizeListWhereTree(tree, fields, DEFAULT_WHERE_OPERATORS)
);

export const parsePresetsQuery = (query: Record<string, unknown>): string[] => {
  const raw = typeof query.presets === 'string' ? query.presets.trim() : '';
  if (!raw) {
    return [];
  }
  return raw.split(',').map((part) => part.trim()).filter(Boolean);
};

export const visibleQueryPresets = (
  document: QuerySurfacesDocument | null,
  binding: QuerySurfaceBindingDocument,
  principal: QuerySurfacePrincipal,
): QueryPresetDefinition[] => {
  if (!document) {
    return [];
  }
  return [...document.presets]
    .filter((preset) => {
      if (preset.visibility === 'public') {
        return true;
      }
      const grant = binding.presetGrants[preset.id];
      return grantAllowsPrincipal(grant, principal);
    })
    .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));
};

export const expandColumnMapForPresetCompile = (
  columnMap: ListWhereColumnMap,
  columns: readonly EdgeModelColumn[],
): ListWhereColumnMap => {
  const expanded: ListWhereColumnMap = { ...columnMap };
  for (const column of columns) {
    const fieldEntry = columnMap[column.field];
    if (!fieldEntry) {
      continue;
    }
    if (column.name && column.name !== column.field && !expanded[column.name]) {
      expanded[column.name] = fieldEntry;
    }
  }
  return expanded;
};

const buildPresetWhereFields = (columnMap: ListWhereColumnMap): WhereField[] => (
  Object.keys(columnMap).map((fieldId) => ({
    id: fieldId,
    label: fieldId,
    type: DATE_TYPE_PATTERN.test(columnMap[fieldId]?.type ?? '')
      ? 'date'
      : columnMap[fieldId]?.type === 'number'
        ? 'number'
        : columnMap[fieldId]?.type === 'boolean'
          ? 'boolean'
          : 'text',
  }))
);

export const resolveSelectedPresetIds = (
  presets: readonly QueryPresetDefinition[],
  requestedIds: readonly string[],
  operationForcedPresetIds: readonly string[] = [],
): string[] => {
  const presetById = new Map(presets.map((preset) => [preset.id, preset]));
  const selected = new Set<string>();
  for (const preset of presets) {
    if (preset.application === 'mandatory') {
      selected.add(preset.id);
    }
  }
  for (const id of operationForcedPresetIds) {
    if (presetById.has(id)) {
      selected.add(id);
    }
  }
  for (const id of requestedIds) {
    if (presetById.has(id)) {
      selected.add(id);
    }
  }
  if (selected.size === 0) {
    for (const preset of presets) {
      if (
        (preset.application === 'optional' || preset.application === 'default-on')
        && preset.defaultSelected
      ) {
        selected.add(preset.id);
      }
    }
  }
  return [...selected];
};

export const compileQueryPresetWhere = (
  document: QuerySurfacesDocument | null,
  selectedIds: readonly string[],
  columnMap: ListWhereColumnMap,
  sequelizeOp: Record<string, symbol>,
  modelColumns?: readonly EdgeModelColumn[],
): WhereOptions => {
  if (!document || selectedIds.length === 0) {
    return {};
  }
  const effectiveColumnMap = modelColumns?.length
    ? expandColumnMapForPresetCompile(columnMap, modelColumns)
    : columnMap;
  const presetById = new Map(document.presets.map((preset) => [preset.id, preset]));
  const parts: WhereOptions[] = [];
  for (const id of selectedIds) {
    const preset = presetById.get(id);
    if (!preset) {
      continue;
    }
    const fields = buildPresetWhereFields(effectiveColumnMap);
    const tree = parseListWhereTreeParam(
      JSON.stringify(preset.where),
      fields,
      DEFAULT_WHERE_OPERATORS,
    );
    if (!tree) {
      continue;
    }
    const compiled = listWhereIrToSequelize(
      listWhereTreeToIr(tree, DEFAULT_WHERE_OPERATORS),
      effectiveColumnMap,
      sequelizeOp,
    );
    if (compiled) {
      parts.push(compiled as WhereOptions);
    }
  }
  if (parts.length === 0) {
    return {};
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return { [sequelizeOp.and as unknown as string]: parts } as WhereOptions;
};

export const readQuerySurfacesDocument = (
  meta: Pick<EdgeModelStudioMeta, 'extensions'>,
): QuerySurfacesDocument | null => (
  parseQuerySurfacesDocument(meta.extensions)
);

export type ClientQuerySurfaceManifest = {
  listWhereFields: WhereField[];
  presets: Array<Pick<QueryPresetDefinition, 'id' | 'label' | 'description' | 'application' | 'defaultSelected' | 'icon' | 'visibility'>>;
  defaultPresetIds: string[];
};

export const filterPresetsForListOperation = (
  presets: readonly QueryPresetDefinition[],
  options: {
    forcedPresetIds?: readonly string[];
    clientPresetIds?: readonly string[];
  } = {},
): QueryPresetDefinition[] => {
  const forced = new Set(options.forcedPresetIds ?? []);
  const clientAllowlist = options.clientPresetIds?.length
    ? new Set(options.clientPresetIds)
    : null;

  return presets.filter((preset) => {
    if (preset.application === 'mandatory' || forced.has(preset.id)) {
      return true;
    }
    if (clientAllowlist) {
      return clientAllowlist.has(preset.id);
    }
    return preset.application === 'optional' || preset.application === 'default-on';
  });
};

export const buildClientQuerySurfaceManifest = (
  model: EdgeModelDefinition,
  meta: EdgeModelStudioMeta,
  binding: QuerySurfaceBindingDocument,
  principal: QuerySurfacePrincipal,
  allowedFields: Set<string>,
  operationQuery?: {
    forcedPresetIds?: string[];
    clientPresetIds?: string[];
  },
): ClientQuerySurfaceManifest => {
  const document = readQuerySurfacesDocument(meta);
  const visible = visibleQueryPresets(document, binding, principal);
  const forOperation = filterPresetsForListOperation(visible, {
    forcedPresetIds: operationQuery?.forcedPresetIds,
    clientPresetIds: operationQuery?.clientPresetIds,
  });
  const listWhereFields = buildListWhereFields(model, meta.columnMeta, binding, principal, allowedFields);
  const defaultPresetIds = resolveSelectedPresetIds(
    forOperation,
    [],
    operationQuery?.forcedPresetIds ?? [],
  );
  return {
    listWhereFields,
    presets: forOperation.map((preset) => ({
      id: preset.id,
      label: preset.label,
      labelKey: preset.labelKey,
      description: preset.description,
      descriptionKey: preset.descriptionKey,
      application: preset.application,
      defaultSelected: preset.defaultSelected,
      icon: preset.icon,
      visibility: preset.visibility,
    })),
    defaultPresetIds,
  };
};
