import { parseServerFunctionScriptDoc, parseResponseCollectionKeyFromScript, type ServerFunctionScriptDocHints } from './parseServerFunctionScriptDoc';
import { buildTestPayloadFromScript } from '../server-functions/buildFunctionDerivedMetadata';
import { extractBodyFieldsFromTestPayload } from '../../server-functions/testPayloadRequest';
import {
  buildDataApiOpenApiOperation,
  isDataApiMetadata,
} from './buildDataApiOpenApi';
import {
  canAccessManagedFunction,
  parseFunctionAccessControl,
  type FunctionAccessControl,
} from '../contracts/server-functions/accessControl';

export const OPENAPI_VERSION = '3.1.2';

export type ManagedFunctionApiDocHint = {
  summary?: string;
  description?: string;
  tags?: string[];
};

export type FunctionDocAccessControl = FunctionAccessControl;

export type FunctionDocAccessPrincipal = {
  isAdmin: boolean;
  userId?: number;
  email?: string;
  roles: string[];
  isAuthenticated?: boolean;
};

export type ManagedFunctionOpenApiInput = {
  id: string;
  name: string;
  folder: string;
  method: string;
  path: string;
  code?: string | null;
  metadata_json?: string | null;
  test_payload?: string | null;
  engine_type?: string | null;
  is_built_in?: boolean;
  allowed_roles?: string[];
  access_control?: Partial<FunctionDocAccessControl>;
  updated_at?: string | null;
};

export type OpenApiObject = Record<string, unknown>;

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

const SHARED_COMPONENTS: OpenApiObject = {
  securitySchemes: {
    bearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'JWT access token (Authorization: Bearer …) or auth cookie.',
    },
  },
  schemas: {
    ManagedFunctionSuccessResponse: {
      type: 'object',
      required: ['success', 'data'],
      properties: {
        success: { type: 'boolean', const: true },
        data: {},
        count: { type: 'integer' },
        source: { type: 'object', additionalProperties: true },
      },
    },
    ManagedFunctionErrorResponse: {
      type: 'object',
      required: ['success', 'error'],
      properties: {
        success: { type: 'boolean', const: false },
        error: { type: 'string' },
      },
    },
  },
  responses: {
    ManagedFunctionSuccess: {
      description: 'Successful managed server function response.',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ManagedFunctionSuccessResponse' },
        },
      },
    },
    ManagedFunctionError: {
      description: 'Managed server function error response.',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ManagedFunctionErrorResponse' },
        },
      },
    },
  },
};

const parseMetadataRecord = (raw: string | null | undefined): Record<string, unknown> | null => {
  if (!raw || !raw.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
};

const parseTestPayload = (raw: string | null | undefined): Record<string, unknown> | null => {
  if (!raw || !raw.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
};

const resolveTestPayloadForOpenApi = (
  raw: string | null | undefined,
  metadata: Record<string, unknown> | null,
  code: string | null | undefined,
  method: string,
  path: string,
): Record<string, unknown> | null => {
  const parsed = parseTestPayload(raw);
  if (parsed && Object.keys(parsed).length > 0) {
    return parsed;
  }

  const derived = metadata?.derived;
  if (
    derived
    && typeof derived === 'object'
    && !Array.isArray(derived)
    && 'requestExample' in derived
  ) {
    const requestExample = (derived as { requestExample?: Record<string, unknown> }).requestExample;
    if (requestExample && Object.keys(requestExample).length > 0) {
      return requestExample;
    }
  }

  if (code?.trim()) {
    const generated = buildTestPayloadFromScript(code, method, path);
    return Object.keys(generated).length > 0 ? generated : null;
  }

  return null;
};

const parseApiDocHint = (metadata: Record<string, unknown> | null): ManagedFunctionApiDocHint | null => {
  const apiDoc = metadata?.apiDoc;
  if (!apiDoc || typeof apiDoc !== 'object' || Array.isArray(apiDoc)) {
    return null;
  }

  const record = apiDoc as Record<string, unknown>;
  return {
    summary: typeof record.summary === 'string' ? record.summary : undefined,
    description: typeof record.description === 'string' ? record.description : undefined,
    tags: Array.isArray(record.tags)
      ? record.tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
      : undefined,
  };
};

export const toOpenApiPath = (routePath: string): string => (
  routePath.replace(/:([a-zA-Z0-9_]+)/g, '{$1}')
);

const extractPathParamNames = (routePath: string): string[] => {
  const matches = routePath.match(/:([a-zA-Z0-9_]+)/g) ?? [];
  return matches.map((token) => token.slice(1));
};

const validationSchemaToOpenApi = (schema: Record<string, unknown> | undefined): OpenApiObject | null => {
  if (!schema || schema.type !== 'object') {
    return null;
  }

  const propertiesRecord = schema.properties;
  if (!propertiesRecord || typeof propertiesRecord !== 'object' || Array.isArray(propertiesRecord)) {
    return null;
  }

  return {
    type: 'object',
    properties: propertiesRecord as Record<string, OpenApiObject>,
    ...(Array.isArray(schema.required) ? { required: schema.required } : {}),
  };
};

const buildOutputDataSchema = (
  outputFieldNames: string[],
  isList: boolean,
): OpenApiObject => {
  if (outputFieldNames.length === 0) {
    return isList
      ? { type: 'array', items: {} }
      : { type: 'object', additionalProperties: true };
  }

  const properties = Object.fromEntries(
    outputFieldNames.map((name) => [name, { type: 'string' }]),
  );

  const itemSchema: OpenApiObject = {
    type: 'object',
    properties,
  };

  return isList
    ? { type: 'array', items: itemSchema }
    : itemSchema;
};

const buildSuccessResponse = (
  dataSchema: OpenApiObject,
  collectionKey = 'data',
): OpenApiObject => ({
  description: 'Successful managed server function response.',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['success', collectionKey],
        properties: {
          success: { type: 'boolean', const: true },
          [collectionKey]: dataSchema,
          count: { type: 'integer' },
          source: { type: 'object', additionalProperties: true },
        },
      },
    },
  },
});

const buildErrorResponses = (): Record<string, OpenApiObject> => ({
  '401': { $ref: '#/components/responses/ManagedFunctionError' },
  '403': { $ref: '#/components/responses/ManagedFunctionError' },
  '404': { $ref: '#/components/responses/ManagedFunctionError' },
  '405': { $ref: '#/components/responses/ManagedFunctionError' },
  '500': { $ref: '#/components/responses/ManagedFunctionError' },
});

const buildBodySchemaFromScriptHints = (
  scriptHints: ServerFunctionScriptDocHints,
): OpenApiObject | null => {
  if (scriptHints.validationSchema) {
    return validationSchemaToOpenApi(scriptHints.validationSchema) ?? null;
  }

  if (scriptHints.requiredBodyFields.length === 0) {
    return null;
  }

  const properties = Object.fromEntries(
    scriptHints.requiredBodyFields.map((name) => [name, { type: 'string' }]),
  );

  return {
    type: 'object',
    properties,
    required: scriptHints.requiredBodyFields,
  };
};

/**
 * When no validation-schema-derived body schema exists but a test-payload body example does,
 * synthesize `properties` from the example's own keys instead of emitting a bare
 * `additionalProperties: true` schema — that bare form has no field names, so consumers like the
 * "Build form from API" designer wizard (which reads `schema.properties`, same as it already does
 * for detecting response fields) see zero fields and can't auto-populate a form from a route whose
 * field names only appear inside a service layer the OpenAPI generator can't statically see (e.g.
 * native/system routes that forward `req.body` wholesale). Mirrors the response-side field-name
 * derivation this generator already does for GET routes.
 */
const buildSchemaFromBodyExample = (bodyExample: Record<string, unknown>): OpenApiObject => ({
  type: 'object',
  properties: Object.fromEntries(
    Object.entries(bodyExample).map(([name, value]) => [
      name,
      { type: typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string' },
    ]),
  ),
  additionalProperties: true,
});

const buildScriptBasedOperation = (
  input: ManagedFunctionOpenApiInput,
  scriptHints: ServerFunctionScriptDocHints,
  metadataRecord: Record<string, unknown> | null,
): OpenApiObject => {
  const method = input.method.toUpperCase();
  const apiDoc = parseApiDocHint(metadataRecord);
  const testPayload = resolveTestPayloadForOpenApi(
    input.test_payload,
    metadataRecord,
    input.code,
    method,
    input.path,
  );
  const pathParams = extractPathParamNames(input.path);
  const requestBodySchema = buildBodySchemaFromScriptHints(scriptHints);

  const parameters: OpenApiObject[] = pathParams.map((name) => ({
    name,
    in: 'path',
    required: true,
    schema: { type: 'string' },
    example: (testPayload?.params as Record<string, unknown> | undefined)?.[name] ?? '1',
  }));

  const queryFieldNames = new Set<string>([
    ...scriptHints.referencedQueryFields,
    ...(method === 'GET' ? ['limit', 'page'] : []),
  ]);
  const queryPayload = testPayload?.query;
  if (queryPayload && typeof queryPayload === 'object' && !Array.isArray(queryPayload)) {
    for (const [name, value] of Object.entries(queryPayload)) {
      queryFieldNames.add(name);
      parameters.push({
        name,
        in: 'query',
        required: false,
        schema: { type: typeof value === 'number' ? 'number' : 'string' },
        example: value,
      });
    }
  } else {
    for (const name of Array.from(queryFieldNames)) {
      if (parameters.some((parameter) => parameter.name === name)) {
        continue;
      }
      parameters.push({
        name,
        in: 'query',
        required: false,
        schema: { type: name === 'limit' || name === 'page' ? 'integer' : 'string' },
        example: name === 'limit' ? 10 : name === 'page' ? 1 : 'sample',
      });
    }
  }

  const isList = method === 'GET'
    && !pathParams.some((param) => input.path.includes(`:${param}`))
    && scriptHints.outputFieldNames.length > 0;
  const dataSchema = buildOutputDataSchema(scriptHints.outputFieldNames, isList);
  const responseCollectionKey = input.code?.trim()
    ? parseResponseCollectionKeyFromScript(input.code)
    : 'data';

  const descriptionParts = [
    scriptHints.routeNote,
    apiDoc?.description,
    input.is_built_in ? 'Built-in system route documented from handler script.' : 'Documented from server function script source.',
  ];

  const bodyExample = (() => {
    if (!testPayload) return undefined;
    const fields = extractBodyFieldsFromTestPayload(testPayload);
    return Object.keys(fields).length > 0 ? fields : undefined;
  })();
  const operation: OpenApiObject = {
    operationId: `${input.id}_${method.toLowerCase()}`,
    summary: apiDoc?.summary ?? scriptHints.summary ?? `${method} ${input.path}`,
    description: descriptionParts.filter(Boolean).join('\n\n'),
    tags: apiDoc?.tags?.length ? apiDoc.tags : [input.folder || 'general'],
    security: [{ bearerAuth: [] }],
    parameters,
    responses: scriptHints.outputFieldNames.length > 0
      ? {
        '200': buildSuccessResponse(dataSchema, responseCollectionKey),
        ...buildErrorResponses(),
      }
      : {
        '200': { $ref: '#/components/responses/ManagedFunctionSuccess' },
        ...buildErrorResponses(),
      },
  };

  const resolvedBodySchema = requestBodySchema
    ?? (bodyExample !== undefined
      ? buildSchemaFromBodyExample(bodyExample)
      : null);

  if (resolvedBodySchema && method !== 'GET' && method !== 'DELETE') {
    operation.requestBody = {
      required: requestBodySchema !== null,
      content: {
        'application/json': {
          schema: resolvedBodySchema,
          ...(bodyExample !== undefined ? { example: bodyExample } : {}),
        },
      },
    };
  }

  return operation;
};

const buildSandboxOperation = (
  input: ManagedFunctionOpenApiInput,
  metadataRecord: Record<string, unknown> | null,
): OpenApiObject => {
  const method = input.method.toUpperCase();
  const apiDoc = parseApiDocHint(metadataRecord);
  const testPayload = resolveTestPayloadForOpenApi(
    input.test_payload,
    metadataRecord,
    input.code,
    method,
    input.path,
  );
  const pathParams = extractPathParamNames(input.path);

  const parameters: OpenApiObject[] = pathParams.map((name) => ({
    name,
    in: 'path',
    required: true,
    schema: { type: 'string' },
    example: (testPayload?.params as Record<string, unknown> | undefined)?.[name] ?? '1',
  }));

  const queryPayload = testPayload?.query;
  if (queryPayload && typeof queryPayload === 'object' && !Array.isArray(queryPayload)) {
    for (const [name, value] of Object.entries(queryPayload)) {
      parameters.push({
        name,
        in: 'query',
        required: false,
        schema: { type: typeof value === 'number' ? 'number' : 'string' },
        example: value,
      });
    }
  }

  const bodyExample = (() => {
    if (!testPayload) return undefined;
    const fields = extractBodyFieldsFromTestPayload(testPayload);
    return Object.keys(fields).length > 0 ? fields : undefined;
  })();
  const operation: OpenApiObject = {
    operationId: `${input.id}_${method.toLowerCase()}`,
    summary: apiDoc?.summary ?? `${method} ${input.path}`,
    description: apiDoc?.description ?? `Managed sandbox route \`${input.name}\` in folder \`${input.folder}\`.`,
    tags: apiDoc?.tags?.length ? apiDoc.tags : [input.folder || 'general'],
    security: [{ bearerAuth: [] }],
    parameters,
    responses: {
      '200': { $ref: '#/components/responses/ManagedFunctionSuccess' },
      ...buildErrorResponses(),
    },
  };

  if (bodyExample !== undefined && method !== 'GET' && method !== 'DELETE') {
    operation.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: buildSchemaFromBodyExample(bodyExample),
          example: bodyExample,
        },
      },
    };
  }

  return operation;
};

const mergePathOperation = (
  paths: Record<string, OpenApiObject>,
  routePath: string,
  method: string,
  operation: OpenApiObject,
): void => {
  const openApiPath = toOpenApiPath(routePath);
  const normalizedMethod = method.toLowerCase();
  if (!paths[openApiPath]) {
    paths[openApiPath] = {};
  }
  paths[openApiPath][normalizedMethod] = operation;
};

export const buildManagedFunctionOpenApiPaths = (
  input: ManagedFunctionOpenApiInput,
): Record<string, OpenApiObject> => {
  const paths: Record<string, OpenApiObject> = {};
  const metadataRecord = parseMetadataRecord(input.metadata_json);
  const method = input.method.toUpperCase();

  if (!HTTP_METHODS.has(method)) {
    return paths;
  }

  const scriptHints = input.code?.trim()
    ? parseServerFunctionScriptDoc(input.code, method, input.path)
    : null;

  if (scriptHints) {
    mergePathOperation(
      paths,
      input.path,
      method,
      buildScriptBasedOperation(input, scriptHints, metadataRecord),
    );
    return paths;
  }

  if (isDataApiMetadata(metadataRecord, input.engine_type) && metadataRecord) {
    mergePathOperation(
      paths,
      input.path,
      method,
      buildDataApiOpenApiOperation(input, metadataRecord),
    );
    return paths;
  }

  mergePathOperation(
    paths,
    input.path,
    method,
    buildSandboxOperation(input, metadataRecord),
  );

  return paths;
};

export const buildManagedFunctionOpenApiDocument = (
  input: ManagedFunctionOpenApiInput,
): OpenApiObject => {
  const paths = buildManagedFunctionOpenApiPaths(input);

  return {
    openapi: OPENAPI_VERSION,
    info: {
      title: `${input.name} — ${input.method} ${input.path}`,
      version: '1.0.0',
      description: `OpenAPI documentation for managed server function \`${input.id}\`.`,
    },
    servers: [{ url: '/' }],
    tags: [{
      name: input.folder || 'general',
      description: `Routes in folder \`${input.folder}\`.`,
    }],
    paths,
    components: SHARED_COMPONENTS,
  };
};

export const buildAggregatedManagedFunctionsOpenApiDocument = (
  functions: ManagedFunctionOpenApiInput[],
): OpenApiObject => {
  const paths: Record<string, OpenApiObject> = {};
  const tagNames = new Set<string>();

  for (const fn of functions) {
    const fnPaths = buildManagedFunctionOpenApiPaths(fn);
    for (const [routePath, pathItem] of Object.entries(fnPaths)) {
      if (!paths[routePath]) {
        paths[routePath] = {};
      }
      Object.assign(paths[routePath], pathItem);
    }
    tagNames.add(fn.folder || 'general');
  }

  return {
    openapi: OPENAPI_VERSION,
    info: {
      title: 'AppEndO Server Functions API',
      version: '1.0.0',
      description: 'Aggregated OpenAPI documentation for managed and built-in server function routes.',
    },
    servers: [{ url: '/' }],
    tags: [...tagNames].sort().map((name) => ({
      name,
      description: `Routes in folder \`${name}\`.`,
    })),
    paths,
    components: SHARED_COMPONENTS,
  };
};

export const resolveManagedFunctionDocRoles = (
  input: ManagedFunctionOpenApiInput,
): string[] => {
  if (input.allowed_roles && input.allowed_roles.length > 0) {
    return [...new Set(input.allowed_roles.map((role) => role.toUpperCase()))];
  }

  const metadataRecord = parseMetadataRecord(input.metadata_json);
  if (!metadataRecord) {
    return [];
  }

  const methodsRecord = metadataRecord.methods;
  if (!methodsRecord || typeof methodsRecord !== 'object' || Array.isArray(methodsRecord)) {
    return [];
  }

  const roles = new Set<string>();
  for (const methodConfig of Object.values(methodsRecord)) {
    if (!methodConfig || typeof methodConfig !== 'object' || Array.isArray(methodConfig)) {
      continue;
    }
    const config = methodConfig as Record<string, unknown>;
    if (config.enabled !== true) {
      continue;
    }
    if (Array.isArray(config.allowedRoles)) {
      for (const role of config.allowedRoles) {
        if (typeof role === 'string' && role.trim()) {
          roles.add(role.toUpperCase());
        }
      }
    }
  }

  return [...roles];
};

const normalizeAccessControl = (
  value: Partial<FunctionDocAccessControl> | undefined,
): FunctionDocAccessControl => parseFunctionAccessControl(value);

export const resolveFunctionDocAccessControl = (
  input: ManagedFunctionOpenApiInput,
): FunctionDocAccessControl => {
  if (input.access_control) {
    return normalizeAccessControl(input.access_control);
  }

  return normalizeAccessControl({
    allowRoles: resolveManagedFunctionDocRoles(input),
  });
};

export const canAccessFunctionDoc = (
  principal: FunctionDocAccessPrincipal,
  input: ManagedFunctionOpenApiInput,
): boolean => {
  const acl = resolveFunctionDocAccessControl(input);
  return canAccessManagedFunction({
    isAdmin: principal.isAdmin,
    isAuthenticated: principal.isAuthenticated ?? true,
    userId: principal.userId,
    email: principal.email,
    roles: principal.roles,
  }, acl);
};

export const filterFunctionsForDocAccess = (
  functions: ManagedFunctionOpenApiInput[],
  principal: FunctionDocAccessPrincipal,
): ManagedFunctionOpenApiInput[] => (
  functions.filter((fn) => canAccessFunctionDoc(principal, fn))
);
