import type {
  EdgeApiDefinition,
  EdgeApiOperation,
  EdgeModelDefinition,
} from '../contracts/data-api';
import {
  resolveDefaultDataApiReadFields,
  resolveDefaultDataApiRequiredFields,
  resolveDefaultDataApiWriteFields,
} from '../../lib/edgeApiOperations';
import {
  buildCodeFingerprint,
  serializeRequestExample,
  type FunctionDerivedMetadata,
  type FunctionRequestExample,
} from '../server-functions/buildFunctionDerivedMetadata';

const resolvePrimaryKeyField = (model: EdgeModelDefinition): string => {
  if (Array.isArray(model.primaryKey)) {
    return model.primaryKey[0] ?? 'id';
  }
  return model.primaryKey || 'id';
};

const extractPathParamNames = (routePath: string): string[] => {
  const matches = routePath.match(/:([a-zA-Z0-9_]+)/g) ?? [];
  return matches.map((token) => token.slice(1));
};

const resolveReadFields = (
  operation: EdgeApiOperation,
  model: EdgeModelDefinition,
): string[] => (
  operation.fields?.read?.length
    ? operation.fields.read
    : resolveDefaultDataApiReadFields(model)
);

const resolveWriteFields = (
  operation: EdgeApiOperation,
  model: EdgeModelDefinition,
): string[] => (
  operation.fields?.write?.length
    ? operation.fields.write
    : resolveDefaultDataApiWriteFields(model)
);

const resolveRequiredFields = (
  operation: EdgeApiOperation,
  model: EdgeModelDefinition,
): string[] => (
  operation.fields?.required?.length
    ? operation.fields.required
    : resolveDefaultDataApiRequiredFields(model)
);

const exampleValueForField = (field: string): string | number => (
  field.toLowerCase().includes('id') ? 1 : 'sample'
);

export const buildDataApiRequestExample = (
  operation: EdgeApiOperation,
  model: EdgeModelDefinition,
  pathPattern: string,
): FunctionRequestExample => {
  const pathParams = extractPathParamNames(pathPattern);
  const requestExample: FunctionRequestExample = {};

  if (pathParams.length > 0) {
    requestExample.params = Object.fromEntries(
      pathParams.map((name) => [name, exampleValueForField(name)]),
    );
  }

  if (operation.kind === 'list' || operation.kind === 'lookup') {
    requestExample.query = {
      page: 1,
      pageSize: operation.query?.defaultPageSize ?? 20,
      ...(operation.query?.countMode !== 'none' && operation.query?.countMode !== 'exact'
        ? { includeCount: operation.query?.defaultIncludeCount ?? true }
        : {}),
      ...(operation.query?.allowSort !== false ? { sort: '' } : {}),
      ...(operation.query?.allowFilter !== false ? { 'filter[field][eq]': '' } : {}),
    };
  }

  const writeFields = resolveWriteFields(operation, model);
  const requiredFields = new Set(resolveRequiredFields(operation, model));
  if (writeFields.length > 0 && operation.kind !== 'list' && operation.kind !== 'getOne' && operation.kind !== 'delete') {
    requestExample.body = Object.fromEntries(
      writeFields.map((field) => [
        field,
        requiredFields.has(field) ? exampleValueForField(field) : '',
      ]),
    );
  }

  return requestExample;
};

export const buildDataApiDerivedMetadata = (
  code: string,
  operation: EdgeApiOperation,
  model: EdgeModelDefinition,
  pathPattern: string,
  now: () => string = () => new Date().toISOString(),
): FunctionDerivedMetadata => {
  const readFields = resolveReadFields(operation, model);
  const writeFields = resolveWriteFields(operation, model);
  const pathParams = extractPathParamNames(pathPattern);
  const queryFields = operation.kind === 'list' || operation.kind === 'lookup'
    ? [
      'page',
      'pageSize',
      ...(operation.query?.countMode !== 'none' && operation.query?.countMode !== 'exact'
        ? ['includeCount']
        : []),
      ...(operation.query?.allowSort !== false ? ['sort'] : []),
      ...(operation.query?.allowFilter !== false ? ['filter[field][eq]'] : []),
    ]
    : [];

  return {
    codeFingerprint: buildCodeFingerprint(code),
    generatedAt: now(),
    requestExample: buildDataApiRequestExample(operation, model, pathPattern),
    docHints: {
      summary: `${operation.method} ${pathPattern}`,
      routeNote: `Data API ${operation.kind} on ${model.objectName}.`,
      validationFields: writeFields,
      outputFields: readFields,
      queryFields,
      paramFields: pathParams.length > 0 ? pathParams : [resolvePrimaryKeyField(model)],
    },
  };
};

export const buildDataApiOpenApiHints = (
  definition: EdgeApiDefinition,
  operation: EdgeApiOperation,
  model: EdgeModelDefinition,
) => {
  const objectLabel = model.labels?.title?.trim() || model.objectName;
  const configuredTags = definition.openapi.tags.filter((tag) => tag.trim().length > 0);
  const tags = configuredTags.length > 0
    ? configuredTags
    : ['Data API', objectLabel];

  return {
    summary: definition.openapi.summary?.trim() || `${definition.label} · ${operation.kind}`,
    description: `${definition.label} (${operation.method} ${operation.pathPattern}) on ${model.objectName}.`,
    tags,
  };
};

export const buildDataApiManagedFunctionMetadata = (
  definition: EdgeApiDefinition,
  operation: EdgeApiOperation,
  model: EdgeModelDefinition,
  code: string,
): string => JSON.stringify({
  origin: 'data-api',
  routeKind: 'data-api',
  edgeApiDefinitionId: definition.id,
  edgeApiOperationId: operation.id,
  edgeModelId: definition.edgeModelId,
  operation: {
    kind: operation.kind,
    method: operation.method,
    pathPattern: operation.pathPattern,
    query: operation.query,
    fields: operation.fields,
  },
  model: {
    objectName: model.objectName,
    primaryKey: model.primaryKey,
    columns: model.columns.map((column) => ({ field: column.field, name: column.name })),
  },
  openapi: buildDataApiOpenApiHints(definition, operation, model),
  derived: buildDataApiDerivedMetadata(code, operation, model, operation.pathPattern),
  testPayloadSource: 'generated',
});

export const buildDataApiManagedFunctionTestPayload = (
  operation: EdgeApiOperation,
  model: EdgeModelDefinition,
): string => (
  serializeRequestExample(buildDataApiRequestExample(operation, model, operation.pathPattern))
);
