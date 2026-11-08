import type { EdgeApiOperation, EdgeModelDefinition } from '../api/contracts/data-api';

const createOperationSuffix = (): string => Math.random().toString(36).slice(2, 8);

/** Column names that must not appear in default Data API field lists. */
const SECRET_COLUMN_PATTERN = /(password|secret|token|hash|salt|api_?key)/i;

export const isSecretEdgeColumnName = (name: string): boolean => (
  SECRET_COLUMN_PATTERN.test(name)
);

export const resolveDefaultDataApiReadFields = (
  model: EdgeModelDefinition,
): string[] => (
  model.columns
    .filter((column) => !isSecretEdgeColumnName(column.name))
    .map((column) => column.field)
);

export const resolveDefaultDataApiWriteFields = (
  model: EdgeModelDefinition,
): string[] => (
  model.columns
    .filter((column) => !column.isPrimaryKey && !isSecretEdgeColumnName(column.name))
    .map((column) => column.field)
);

export const resolveDefaultDataApiRequiredFields = (
  model: EdgeModelDefinition,
): string[] => (
  model.columns
    .filter((column) => (
      !column.isPrimaryKey
      && !column.allowNull
      && !isSecretEdgeColumnName(column.name)
    ))
    .map((column) => column.field)
);

export const operationSupportsWriteFields = (
  kind: EdgeApiOperation['kind'],
): boolean => kind === 'create' || kind === 'update' || kind === 'patch';

export const deriveDataApiBasePath = (objectName: string): string => `/api/${objectName.trim()}`;

export const deriveDataApiKey = (objectName: string): string => objectName.trim().toLowerCase();

export const deriveDataApiLabel = (objectName: string): string => (
  objectName
    .trim()
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
);

export const enrichEdgeApiOperationsFromModel = (
  operations: EdgeApiOperation[],
  model: EdgeModelDefinition,
): EdgeApiOperation[] => {
  const readFields = resolveDefaultDataApiReadFields(model);
  const writeFields = resolveDefaultDataApiWriteFields(model);
  const requiredFields = resolveDefaultDataApiRequiredFields(model);

  return operations.map((operation) => {
    const fields: NonNullable<EdgeApiOperation['fields']> = {
      read: operation.fields?.read?.length ? operation.fields.read : readFields,
    };

    if (operationSupportsWriteFields(operation.kind)) {
      fields.write = operation.fields?.write?.length ? operation.fields.write : writeFields;
      fields.required = operation.fields?.required?.length ? operation.fields.required : requiredFields;
    }

    return {
      ...operation,
      fields,
    };
  });
};
export const buildDefaultCollectionOperations = (basePath: string): EdgeApiOperation[] => {
  const suffix = createOperationSuffix();
  return [
    {
      id: `op_list_${suffix}`,
      method: 'GET',
      kind: 'list',
      pathPattern: basePath,
      enabled: true,
      query: {
        allowFilter: true,
        allowSort: true,
        maxPageSize: 100,
        defaultPageSize: 20,
      },
    },
    {
      id: `op_get_${suffix}`,
      method: 'GET',
      kind: 'getOne',
      pathPattern: `${basePath}/:pk`,
      enabled: true,
      query: {
        allowFilter: false,
        allowSort: false,
        maxPageSize: 1,
        defaultPageSize: 1,
      },
    },
    {
      id: `op_create_${suffix}`,
      method: 'POST',
      kind: 'create',
      pathPattern: basePath,
      enabled: true,
    },
    {
      id: `op_update_${suffix}`,
      method: 'PUT',
      kind: 'update',
      pathPattern: `${basePath}/:pk`,
      enabled: true,
    },
    {
      id: `op_delete_${suffix}`,
      method: 'DELETE',
      kind: 'delete',
      pathPattern: `${basePath}/:pk`,
      enabled: true,
    },
  ];
};
