import type { SchemaFunctionKind, SchemaObjectType } from '../../../shared/api/queries/data-sources';
import type { SchemaObjectDependencyKind } from '../../../shared/api/contracts/data-sources/schemaObjectDependencies';
import type { DataStudioExplorerObjectKind } from '../types';

export const DATA_STUDIO_EXPLORER_OBJECT_KIND_OPTIONS: ReadonlyArray<{
  value: DataStudioExplorerObjectKind;
  label: string;
}> = [
  { value: 'TABLE', label: 'Tables' },
  { value: 'VIEW', label: 'Views' },
  { value: 'STORED_PROCEDURE', label: 'Stored procedures' },
  { value: 'SCALAR_FUNCTION', label: 'Scalar functions' },
  { value: 'TABLE_VALUED_FUNCTION', label: 'Table-valued functions' },
];

export const DATA_STUDIO_EXPLORER_OBJECT_KIND_SINGULAR_LABELS: Record<DataStudioExplorerObjectKind, string> = {
  TABLE: 'Table',
  VIEW: 'View',
  STORED_PROCEDURE: 'Stored procedure',
  SCALAR_FUNCTION: 'Scalar function',
  TABLE_VALUED_FUNCTION: 'Table-valued function',
};

export const DEFAULT_DATA_STUDIO_EXPLORER_OBJECT_KIND: DataStudioExplorerObjectKind = 'TABLE';

export const getDataStudioExplorerObjectKindLabel = (kind: DataStudioExplorerObjectKind): string => (
  DATA_STUDIO_EXPLORER_OBJECT_KIND_OPTIONS.find((option) => option.value === kind)?.label ?? kind
);

/** Tables delete from the modeler; other kinds delete from the explorer list. */
export const canDeleteExplorerObjectFromList = (row: {
  objectKind: DataStudioExplorerObjectKind;
  isControlPlaneLocked: boolean;
}): boolean => row.objectKind !== 'TABLE' && !row.isControlPlaneLocked;

export const resolveEdgeModelImportType = (
  objectKind: DataStudioExplorerObjectKind,
): 'TABLE' | 'VIEW' | null => {
  if (objectKind === 'TABLE') {
    return 'TABLE';
  }
  if (objectKind === 'VIEW') {
    return 'VIEW';
  }
  return null;
};

export const buildEdgeModelLookupKey = (
  dataSourceId: string,
  objectType: 'TABLE' | 'VIEW',
  objectName: string,
): string => `${dataSourceId}::${objectType}::${objectName}`;

export const resolveExplorerSchemaQuery = (
  objectKind: DataStudioExplorerObjectKind,
): { objectType: SchemaObjectType; functionKind?: SchemaFunctionKind } => {
  switch (objectKind) {
    case 'TABLE':
      return { objectType: 'TABLE' };
    case 'VIEW':
      return { objectType: 'VIEW' };
    case 'STORED_PROCEDURE':
      return { objectType: 'PROCEDURE' };
    case 'SCALAR_FUNCTION':
      return { objectType: 'FUNCTION', functionKind: 'SCALAR' };
    case 'TABLE_VALUED_FUNCTION':
      return { objectType: 'FUNCTION', functionKind: 'TABLE_VALUED' };
    default:
      return { objectType: 'TABLE' };
  }
};

export const resolveCreateSchemaObjectInput = (
  dataSourceId: string,
  objectKind: DataStudioExplorerObjectKind,
  objectName: string,
) => {
  const schemaQuery = resolveExplorerSchemaQuery(objectKind);
  return {
    dataSourceId,
    objectName,
    objectType: schemaQuery.objectType,
    ...(schemaQuery.functionKind ? { functionKind: schemaQuery.functionKind } : {}),
  };
};

export const resolveCreateSchemaObjectSqlInput = (
  dataSourceId: string,
  objectKind: DataStudioExplorerObjectKind,
  sql: string,
) => {
  const schemaQuery = resolveExplorerSchemaQuery(objectKind);
  return {
    dataSourceId,
    objectType: schemaQuery.objectType,
    sql,
    ...(schemaQuery.functionKind ? { functionKind: schemaQuery.functionKind } : {}),
  };
};

export const resolveUpdateSchemaObjectSqlInput = (
  dataSourceId: string,
  objectKind: DataStudioExplorerObjectKind,
  sql: string,
) => {
  const schemaQuery = resolveExplorerSchemaQuery(objectKind);
  if (schemaQuery.objectType === 'TABLE') {
    throw new Error('Table definitions cannot be edited from the SQL script editor.');
  }
  return {
    dataSourceId,
    objectType: schemaQuery.objectType,
    sql,
    ...(schemaQuery.functionKind ? { functionKind: schemaQuery.functionKind } : {}),
  };
};

export const resolveSchemaObjectDefinitionQuery = (
  dataSourceId: string,
  objectKind: DataStudioExplorerObjectKind,
  objectName: string,
) => {
  const schemaQuery = resolveExplorerSchemaQuery(objectKind);
  if (schemaQuery.objectType === 'TABLE') {
    throw new Error('Table definitions cannot be loaded from the SQL script editor.');
  }
  return {
    dataSourceId,
    objectName,
    objectType: schemaQuery.objectType,
    ...(schemaQuery.functionKind ? { functionKind: schemaQuery.functionKind } : {}),
  };
};

export const resolveDeleteSchemaObjectInput = resolveCreateSchemaObjectInput;

export const resolveDataStudioExplorerObjectKindFromDependencyKind = (
  objectKind: SchemaObjectDependencyKind,
): DataStudioExplorerObjectKind | null => {
  switch (objectKind) {
    case 'TABLE':
      return 'TABLE';
    case 'VIEW':
      return 'VIEW';
    case 'STORED_PROCEDURE':
      return 'STORED_PROCEDURE';
    case 'SCALAR_FUNCTION':
      return 'SCALAR_FUNCTION';
    case 'TABLE_VALUED_FUNCTION':
      return 'TABLE_VALUED_FUNCTION';
    default:
      return null;
  }
};
