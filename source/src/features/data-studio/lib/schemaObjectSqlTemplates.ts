import { buildCreateSchemaObjectStatement } from '../../../shared/lib/schemaObjectCreation';
import { resolveExplorerSchemaQuery } from './explorerObjectKinds';
import type { DataStudioExplorerObjectKind } from '../types';

const TEMPLATE_OBJECT_NAMES: Record<DataStudioExplorerObjectKind, string> = {
  TABLE: 'new_table',
  VIEW: 'new_view',
  STORED_PROCEDURE: 'new_procedure',
  SCALAR_FUNCTION: 'new_function',
  TABLE_VALUED_FUNCTION: 'new_tvf',
};

export const usesSqlEditorForCreate = (objectKind: DataStudioExplorerObjectKind): boolean => (
  objectKind !== 'TABLE'
);

export const usesSqlEditorForEdit = usesSqlEditorForCreate;

export const canCreateSchemaObjectKind = (
  dataSourceType: string,
  objectKind: DataStudioExplorerObjectKind,
): boolean => {
  if (!usesSqlEditorForCreate(objectKind)) {
    return true;
  }

  const schemaQuery = resolveExplorerSchemaQuery(objectKind);
  try {
    buildCreateSchemaObjectStatement(dataSourceType, {
      objectName: TEMPLATE_OBJECT_NAMES[objectKind],
      objectType: schemaQuery.objectType,
      functionKind: schemaQuery.functionKind,
    });
    return true;
  } catch {
    return false;
  }
};

export const buildSchemaObjectSqlTemplate = (
  dataSourceType: string,
  objectKind: DataStudioExplorerObjectKind,
  objectName = TEMPLATE_OBJECT_NAMES[objectKind],
): string => {
  const schemaQuery = resolveExplorerSchemaQuery(objectKind);
  return buildCreateSchemaObjectStatement(dataSourceType, {
    objectName,
    objectType: schemaQuery.objectType,
    functionKind: schemaQuery.functionKind,
  });
};
