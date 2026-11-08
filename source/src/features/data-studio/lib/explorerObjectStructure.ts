import type { EdgeModelDefinition } from '../../../shared/api/contracts/data-api';
import type { SchemaObjectListItem } from '../../../shared/api/contracts/data-sources/schemaObjects';
import type { SchemaFieldInfo } from '../../../shared/api/queries/data-sources';

export type ExplorerObjectStructure = {
  columnCount: number;
  primaryKey: string | string[] | null;
};

const resolvePrimaryKeyFromFieldNames = (names: string[]): string | string[] | null => {
  if (names.length === 0) {
    return null;
  }
  if (names.length === 1) {
    return names[0];
  }
  return names;
};

export const deriveStructureFromFields = (fields: SchemaFieldInfo[]): ExplorerObjectStructure => {
  const primaryKeys = fields.filter((field) => field.isPrimaryKey).map((field) => field.name);
  return {
    columnCount: fields.length,
    primaryKey: resolvePrimaryKeyFromFieldNames(primaryKeys),
  };
};

export const deriveStructureFromEdgeModel = (
  model: EdgeModelDefinition,
): ExplorerObjectStructure => {
  const primaryKeys = model.columns.filter((column) => column.isPrimaryKey).map((column) => column.name);
  return {
    columnCount: model.columns.length,
    primaryKey: resolvePrimaryKeyFromFieldNames(primaryKeys),
  };
};

export const hasExplorerObjectStructure = (
  structure: Pick<ExplorerObjectStructure, 'columnCount' | 'primaryKey'>,
): boolean => structure.columnCount > 0 || structure.primaryKey !== null;

export const needsExplorerStructureHydration = (
  items: SchemaObjectListItem[],
): boolean => (
  items.length > 0
  && items.every((item) => !hasExplorerObjectStructure(item))
);

export const resolveExplorerObjectStructure = (
  item: SchemaObjectListItem,
  edgeModel: EdgeModelDefinition | undefined,
  hydratedStructure?: ExplorerObjectStructure | null,
): ExplorerObjectStructure => {
  if (hydratedStructure && hasExplorerObjectStructure(hydratedStructure)) {
    return hydratedStructure;
  }

  if (hasExplorerObjectStructure(item)) {
    return {
      columnCount: item.columnCount,
      primaryKey: item.primaryKey,
    };
  }

  if (edgeModel) {
    return deriveStructureFromEdgeModel(edgeModel);
  }

  return {
    columnCount: item.columnCount,
    primaryKey: item.primaryKey,
  };
};
