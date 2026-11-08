import {
  APPENDO_CLIENT_HEADER,
  CHANGE_REASON_CODE_HEADER,
  CHANGE_REASON_TEXT_HEADER,
} from '../contracts/client-context';
import type { ManagedFunctionOpenApiInput } from './buildManagedFunctionOpenApi';

type OpenApiObject = Record<string, unknown>;

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

const toOpenApiPath = (routePath: string): string => routePath.replace(/:([A-Za-z0-9_]+)/g, '{$1}');

const extractPathParamNames = (routePath: string): string[] => {
  const matches = routePath.match(/:([a-zA-Z0-9_]+)/g) ?? [];
  return matches.map((token) => token.slice(1));
};

const buildErrorResponses = (): OpenApiObject => ({
  '400': { $ref: '#/components/responses/ManagedFunctionError' },
  '401': { $ref: '#/components/responses/ManagedFunctionError' },
  '403': { $ref: '#/components/responses/ManagedFunctionError' },
  '500': { $ref: '#/components/responses/ManagedFunctionError' },
});

const parseMetadataRecord = (metadataJson?: string | null): Record<string, unknown> | null => {
  if (!metadataJson?.trim()) {
    return null;
  }
  try {
    const parsed = JSON.parse(metadataJson) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
};

export const isDataApiMetadata = (
  metadata: Record<string, unknown> | null,
  engineType?: string | null,
): boolean => (
  engineType === 'DATA_API' || metadata?.origin === 'data-api' || metadata?.routeKind === 'data-api'
);

const readStringArray = (value: unknown): string[] => (
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
);

const buildObjectSchema = (fields: string[], requiredFields: string[] = []): OpenApiObject => {
  const required = new Set(requiredFields);
  const properties = Object.fromEntries(
    fields.map((field) => [field, { type: 'string' }]),
  );

  return {
    type: 'object',
    properties,
    ...(required.size > 0 ? { required: fields.filter((field) => required.has(field)) } : {}),
    additionalProperties: false,
  };
};

const buildListParameters = (operationRecord: Record<string, unknown>): OpenApiObject[] => {
  const query = operationRecord.query && typeof operationRecord.query === 'object'
    ? operationRecord.query as Record<string, unknown>
    : {};
  const parameters: OpenApiObject[] = [
    { name: 'page', in: 'query', required: false, schema: { type: 'integer', minimum: 1 } },
    { name: 'pageSize', in: 'query', required: false, schema: { type: 'integer', minimum: 1 } },
    { name: 'view', in: 'query', required: false, schema: { type: 'string' } },
    { name: 'include', in: 'query', required: false, schema: { type: 'string' } },
  ];

  if (query.allowSort !== false) {
    parameters.push({
      name: 'sort',
      in: 'query',
      required: false,
      schema: { type: 'string' },
      description: 'Comma-separated fields. Prefix with - for descending.',
    });
  }

  if (query.allowFilter !== false) {
    parameters.push({
      name: 'filter[field][eq]',
      in: 'query',
      required: false,
      schema: { type: 'string' },
    });
  }

  return parameters;
};

const resolveOperationFields = (
  metadataRecord: Record<string, unknown>,
): { read: string[]; write: string[]; required: string[] } => {
  const operationRecord = metadataRecord.operation && typeof metadataRecord.operation === 'object'
    ? metadataRecord.operation as Record<string, unknown>
    : {};
  const fieldsRecord = operationRecord.fields && typeof operationRecord.fields === 'object'
    ? operationRecord.fields as Record<string, unknown>
    : {};

  const modelRecord = metadataRecord.model && typeof metadataRecord.model === 'object'
    ? metadataRecord.model as Record<string, unknown>
    : {};
  const columns = Array.isArray(modelRecord.columns)
    ? modelRecord.columns.filter((column): column is Record<string, unknown> => (
      Boolean(column) && typeof column === 'object' && !Array.isArray(column)
    ))
    : [];

  const columnFields = columns
    .map((column) => (typeof column.field === 'string' ? column.field : ''))
    .filter(Boolean);

  return {
    read: readStringArray(fieldsRecord.read).length > 0
      ? readStringArray(fieldsRecord.read)
      : columnFields,
    write: readStringArray(fieldsRecord.write),
    required: readStringArray(fieldsRecord.required),
  };
};

const buildSuccessResponse = (
  fields: string[],
  isList: boolean,
): OpenApiObject => {
  const itemSchema = buildObjectSchema(fields);
  const dataSchema = isList
    ? { type: 'array', items: itemSchema }
    : itemSchema;

  return {
    description: 'Successful Data API response.',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['success', 'data'],
          properties: {
            success: { type: 'boolean', const: true },
            data: dataSchema,
            count: { type: 'integer' },
            source: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
  };
};

export const buildDataApiOpenApiOperation = (
  input: ManagedFunctionOpenApiInput,
  metadataRecord: Record<string, unknown>,
): OpenApiObject => {
  const method = input.method.toUpperCase();
  const operationRecord = metadataRecord.operation && typeof metadataRecord.operation === 'object'
    ? metadataRecord.operation as Record<string, unknown>
    : {};
  const modelRecord = metadataRecord.model && typeof metadataRecord.model === 'object'
    ? metadataRecord.model as Record<string, unknown>
    : {};
  const openapiRecord = metadataRecord.openapi && typeof metadataRecord.openapi === 'object'
    ? metadataRecord.openapi as Record<string, unknown>
    : {};
  const derivedRecord = metadataRecord.derived && typeof metadataRecord.derived === 'object'
    ? metadataRecord.derived as Record<string, unknown>
    : null;
  const docHints = derivedRecord?.docHints && typeof derivedRecord.docHints === 'object'
    ? derivedRecord.docHints as Record<string, unknown>
    : null;

  const kind = String(operationRecord.kind || 'list');
  const tags = Array.isArray(openapiRecord.tags)
    ? openapiRecord.tags.filter((tag): tag is string => typeof tag === 'string')
    : ['Data API'];
  const fields = resolveOperationFields(metadataRecord);
  const pathParams = extractPathParamNames(input.path);

  const parameters: OpenApiObject[] = pathParams.map((name) => ({
    name,
    in: 'path',
    required: true,
    schema: { type: 'string' },
    example: name.toLowerCase().includes('id') ? 1 : 'sample',
  }));

  if (kind === 'list' || kind === 'lookup') {
    parameters.push(...buildListParameters(operationRecord));
  }

  if (method !== 'GET') {
    parameters.push(
      {
        name: APPENDO_CLIENT_HEADER,
        in: 'header',
        required: false,
        schema: { type: 'string' },
        description: 'JSON client context envelope (max 4KB). Header wins over body __client.',
      },
      {
        name: CHANGE_REASON_CODE_HEADER,
        in: 'header',
        required: false,
        schema: { type: 'string' },
        description: 'Change-reason vocab code. Header wins over body __changeReasonCode.',
      },
      {
        name: CHANGE_REASON_TEXT_HEADER,
        in: 'header',
        required: false,
        schema: { type: 'string' },
        description: 'Free-text change reason. Header wins over body __changeReasonText.',
      },
    );
  }

  const isList = kind === 'list' || kind === 'lookup';
  const isPivot = kind === 'pivot';
  const outputFields = readStringArray(docHints?.outputFields).length > 0
    ? readStringArray(docHints?.outputFields)
    : fields.read;

  const operation: OpenApiObject = {
    operationId: `${input.id}_${method.toLowerCase()}`,
    summary: typeof openapiRecord.summary === 'string'
      ? openapiRecord.summary
      : (typeof docHints?.summary === 'string' ? docHints.summary : `${method} ${input.path}`),
    description: typeof openapiRecord.description === 'string'
      ? openapiRecord.description
      : (typeof docHints?.routeNote === 'string'
        ? docHints.routeNote
        : `Data API ${kind} on ${String(modelRecord.objectName || 'model')}.`),
    tags,
    security: [{ bearerAuth: [] }],
    parameters,
    responses: {
      '200': isPivot
        ? {
          description: 'Successful PivotResult envelope.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['success', 'data'],
                properties: {
                  success: { type: 'boolean', const: true },
                  data: {
                    type: 'object',
                    required: ['rowAxis', 'colAxis', 'measures', 'cells'],
                    properties: {
                      rowAxis: { type: 'object' },
                      colAxis: { type: 'object' },
                      measures: { type: 'array' },
                      cells: { type: 'array' },
                    },
                  },
                  meta: { type: 'object' },
                  source: { type: 'object', additionalProperties: true },
                },
              },
            },
          },
        }
        : outputFields.length > 0
          ? buildSuccessResponse(outputFields, isList)
          : { $ref: '#/components/responses/ManagedFunctionSuccess' },
      ...buildErrorResponses(),
    },
  };

  const writeFields = readStringArray(docHints?.validationFields).length > 0
    ? readStringArray(docHints?.validationFields)
    : fields.write;

  if (isPivot) {
    operation.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['measures'],
            properties: {
              rows: { type: 'array', items: { type: 'object', properties: { field: { type: 'string' } } } },
              columns: { type: 'array', items: { type: 'object', properties: { field: { type: 'string' } } } },
              measures: { type: 'array', items: { type: 'object' } },
              filters: { type: 'object' },
              totals: { type: 'object' },
              source: { type: 'object' },
              noCache: { type: 'boolean' },
            },
          },
        },
      },
    };
  } else if (method !== 'GET' && method !== 'DELETE' && writeFields.length > 0) {
    operation.requestBody = {
      required: operation.kind === 'create' || fields.required.length > 0,
      content: {
        'application/json': {
          schema: buildObjectSchema(writeFields, fields.required),
        },
      },
    };
  }

  return operation;
};

export const buildDataApiOpenApiPaths = (
  input: ManagedFunctionOpenApiInput,
): Record<string, OpenApiObject> => {
  const method = input.method.toUpperCase();
  if (!HTTP_METHODS.has(method)) {
    return {};
  }

  const metadataRecord = parseMetadataRecord(input.metadata_json);
  if (!metadataRecord || !isDataApiMetadata(metadataRecord, input.engine_type)) {
    return {};
  }

  const openApiPath = toOpenApiPath(input.path);
  return {
    [openApiPath]: {
      [method.toLowerCase()]: buildDataApiOpenApiOperation(input, metadataRecord),
    },
  };
};
