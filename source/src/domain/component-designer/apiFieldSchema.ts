/**
 * Parses an endpoint's OpenAPI spec into a flat, typed list of request fields that the
 * auto-form wizard can turn into form controls. Kept pure (no React / network) so it is
 * easy to unit test independently of the wizard UI.
 */

export type ApiFormFieldScalarType = 'string' | 'number' | 'integer' | 'boolean';
export type ApiFormFieldType = ApiFormFieldScalarType | 'array';
export type ApiFormFieldLocation = 'body' | 'query' | 'path';

export type ApiFormField = {
  name: string;
  type: ApiFormFieldType;
  location: ApiFormFieldLocation;
  required: boolean;
  /** Allowed values (enum) → select control. */
  enum?: string[];
  /** JSON-schema string `format` (date, date-time, email, binary, …). */
  format?: string;
  /** For `array` fields, the scalar type of each item. */
  itemType?: ApiFormFieldScalarType;
  /** OpenAPI / JSON-schema string pattern (regex). */
  pattern?: string;
  /** OpenAPI / JSON-schema string minLength. */
  minLength?: number;
  /** OpenAPI / JSON-schema string maxLength. */
  maxLength?: number;
  /** OpenAPI / JSON-schema numeric minimum. */
  minimum?: number;
  /** OpenAPI / JSON-schema numeric maximum. */
  maximum?: number;
};

/** Form intent inferred from the endpoint's HTTP method + path shape. */
export type ApiEndpointScenario = 'create' | 'edit' | 'detail' | 'search';

export type ParsedApiEndpoint = {
  method: string;
  path: string;
  scenario: ApiEndpointScenario;
  fields: ApiFormField[];
  /** True when the spec actually described request fields (body/query/path). */
  hasSchema: boolean;
};

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const normalizeScalarType = (raw: unknown): ApiFormFieldScalarType => {
  const value = String(raw ?? 'string');
  return value === 'number' || value === 'integer' || value === 'boolean'
    ? value
    : 'string';
};

const extractEnum = (property: Record<string, unknown>): string[] | undefined => {
  if (!Array.isArray(property.enum)) {
    return undefined;
  }
  const values = property.enum
    .filter((entry): entry is string | number => typeof entry === 'string' || typeof entry === 'number')
    .map((entry) => String(entry));
  return values.length > 0 ? values : undefined;
};

const extractFormat = (property: Record<string, unknown>): string | undefined => (
  typeof property.format === 'string' && property.format.trim()
    ? property.format.trim()
    : undefined
);

const extractFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const extractPattern = (property: Record<string, unknown>): string | undefined => (
  typeof property.pattern === 'string' && property.pattern.trim()
    ? property.pattern.trim()
    : undefined
);

/** OpenAPI validation keys shared by string/number (and array-item) schemas. */
type ApiFormFieldValidationParts = Pick<
  ApiFormField,
  'pattern' | 'minLength' | 'maxLength' | 'minimum' | 'maximum'
>;

const extractValidationParts = (property: Record<string, unknown>): ApiFormFieldValidationParts => {
  const pattern = extractPattern(property);
  const minLength = extractFiniteNumber(property.minLength);
  const maxLength = extractFiniteNumber(property.maxLength);
  const minimum = extractFiniteNumber(property.minimum);
  const maximum = extractFiniteNumber(property.maximum);
  return {
    ...(pattern ? { pattern } : {}),
    ...(minLength !== undefined ? { minLength } : {}),
    ...(maxLength !== undefined ? { maxLength } : {}),
    ...(minimum !== undefined ? { minimum } : {}),
    ...(maximum !== undefined ? { maximum } : {}),
  };
};

/** Converts a JSON-schema property into the typed field parts (handles array items + enum/format/validation). */
const schemaPropertyToFieldParts = (
  property: Record<string, unknown>,
): Pick<ApiFormField, 'type' | 'enum' | 'format' | 'itemType'> & ApiFormFieldValidationParts => {
  if (String(property.type) === 'array') {
    const items = asRecord(property.items) ?? {};
    const itemType = normalizeScalarType(items.type);
    const enumValues = extractEnum(items);
    const format = extractFormat(items);
    // Prefer item-level validation (array of constrained scalars); fall back to array-level keys.
    const validation = {
      ...extractValidationParts(property),
      ...extractValidationParts(items),
    };
    return {
      type: 'array',
      itemType,
      ...(enumValues ? { enum: enumValues } : {}),
      ...(format ? { format } : {}),
      ...validation,
    };
  }

  const enumValues = extractEnum(property);
  const format = extractFormat(property);
  return {
    type: normalizeScalarType(property.type),
    ...(enumValues ? { enum: enumValues } : {}),
    ...(format ? { format } : {}),
    ...extractValidationParts(property),
  };
};

const pathHasParam = (path: string): boolean => (
  /\{[^}]+\}/.test(path) || /:[a-zA-Z_][a-zA-Z0-9_]*/.test(path)
);

export const inferScenarioFromMethod = (method: string, path: string): ApiEndpointScenario => {
  const normalized = method.trim().toUpperCase();
  if (normalized === 'POST') {
    return 'create';
  }
  if (normalized === 'PUT' || normalized === 'PATCH') {
    return 'edit';
  }
  // GET (or anything else): a path param → single record detail, otherwise a list/search.
  return pathHasParam(path) ? 'detail' : 'search';
};

const collectBodyFields = (operation: Record<string, unknown>): ApiFormField[] => {
  const requestBody = asRecord(operation.requestBody);
  const content = asRecord(requestBody?.content);
  const json = asRecord(content?.['application/json']);
  const schema = asRecord(json?.schema);
  const properties = asRecord(schema?.properties);

  if (!properties) {
    // Some routes (notably native/system Express routes whose handler forwards the body to a
    // service layer the OpenAPI generator can't statically see) end up with a bare
    // `additionalProperties: true` schema and no `properties`. Fall back to the request example's
    // own keys, mirroring how response field names are already derived from response examples
    // elsewhere in this file — defense in depth alongside the generator-side fix that now
    // synthesizes `properties` from the example directly.
    const example = asRecord(json?.example);
    if (!example) {
      return [];
    }

    return Object.entries(example).map(([name, value]) => ({
      name,
      location: 'body' as const,
      required: false,
      ...schemaPropertyToFieldParts({
        type: typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string',
      }),
    }));
  }

  const required = new Set(
    Array.isArray(schema?.required)
      ? schema!.required.filter((entry): entry is string => typeof entry === 'string')
      : [],
  );

  return Object.entries(properties).map(([name, rawProperty]) => ({
    name,
    location: 'body' as const,
    required: required.has(name),
    ...schemaPropertyToFieldParts(asRecord(rawProperty) ?? {}),
  }));
};

const collectParameterFields = (operation: Record<string, unknown>): ApiFormField[] => {
  const parameters = Array.isArray(operation.parameters) ? operation.parameters : [];
  const fields: ApiFormField[] = [];

  for (const rawParam of parameters) {
    const param = asRecord(rawParam);
    if (!param || typeof param.name !== 'string' || !param.name.trim()) {
      continue;
    }
    const location = param.in === 'path' ? 'path' : param.in === 'query' ? 'query' : null;
    if (!location) {
      continue;
    }
    const schema = asRecord(param.schema) ?? {};
    fields.push({
      name: param.name,
      location,
      required: location === 'path' ? true : param.required === true,
      ...schemaPropertyToFieldParts(schema),
    });
  }

  return fields;
};

const findOperation = (
  spec: Record<string, unknown>,
  preferredMethod?: string,
): { method: string; path: string; operation: Record<string, unknown> } | null => {
  const paths = asRecord(spec.paths);
  if (!paths) {
    return null;
  }

  const preferred = preferredMethod?.trim().toLowerCase();
  let fallback: { method: string; path: string; operation: Record<string, unknown> } | null = null;

  for (const [path, rawPathItem] of Object.entries(paths)) {
    const pathItem = asRecord(rawPathItem);
    if (!pathItem) {
      continue;
    }
    for (const httpMethod of HTTP_METHODS) {
      const operation = asRecord(pathItem[httpMethod]);
      if (!operation) {
        continue;
      }
      const candidate = { method: httpMethod.toUpperCase(), path, operation };
      if (preferred && httpMethod === preferred) {
        return candidate;
      }
      fallback = fallback ?? candidate;
    }
  }

  return fallback;
};

/**
 * Parses a single endpoint operation out of an OpenAPI spec.
 * `preferredMethod` selects the operation when a path exposes multiple methods.
 */
export const parseApiEndpointFromOpenApi = (
  spec: unknown,
  options: { method?: string } = {},
): ParsedApiEndpoint | null => {
  const specRecord = asRecord(spec);
  if (!specRecord) {
    return null;
  }

  const found = findOperation(specRecord, options.method);
  if (!found) {
    return null;
  }

  const bodyFields = collectBodyFields(found.operation);
  const parameterFields = collectParameterFields(found.operation);
  const fields = [...bodyFields, ...parameterFields];

  return {
    method: found.method,
    path: found.path,
    scenario: inferScenarioFromMethod(found.method, found.path),
    fields,
    hasSchema: fields.length > 0,
  };
};

const collectRecordPropertyNames = (schema: Record<string, unknown> | null): string[] => {
  const properties = asRecord(schema?.properties);
  if (!properties) {
    return [];
  }

  return Object.keys(properties).filter((name) => name.trim().length > 0);
};

/** Typed row properties from a JSON-schema object (OpenAPI response item schema). */
const collectRecordPropertyFields = (schema: Record<string, unknown> | null): ApiFormField[] => {
  const properties = asRecord(schema?.properties);
  if (!properties) {
    return [];
  }

  const required = new Set(
    Array.isArray(schema?.required)
      ? schema!.required.filter((entry): entry is string => typeof entry === 'string')
      : [],
  );

  return Object.entries(properties)
    .filter(([name]) => name.trim().length > 0)
    .map(([name, rawProperty]) => ({
      name,
      location: 'body' as const,
      required: required.has(name),
      ...schemaPropertyToFieldParts(asRecord(rawProperty) ?? {}),
    }));
};

const RESPONSE_COLLECTION_KEYS = ['data', 'items', 'rows', 'results', 'records'] as const;
const RESPONSE_SINGLE_RECORD_KEYS = ['data', 'user', 'record', 'item', 'result'] as const;

const resolveSchemaRef = (
  spec: Record<string, unknown>,
  ref: string,
  visited: Set<string>,
): Record<string, unknown> | null => {
  if (!ref.startsWith('#/')) {
    return null;
  }

  if (visited.has(ref)) {
    return null;
  }

  visited.add(ref);

  let node: unknown = spec;
  for (const segment of ref.slice(2).split('/')) {
    node = asRecord(node)?.[segment];
  }

  const record = asRecord(node);
  if (!record) {
    return null;
  }

  if (typeof record.$ref === 'string') {
    return resolveSchemaRef(spec, record.$ref, visited);
  }

  return record;
};

const resolveSchemaNode = (
  spec: Record<string, unknown>,
  node: unknown,
  visited: Set<string> = new Set(),
): Record<string, unknown> | null => {
  const record = asRecord(node);
  if (!record) {
    return null;
  }

  if (typeof record.$ref === 'string') {
    return resolveSchemaRef(spec, record.$ref, visited);
  }

  if (Array.isArray(record.allOf)) {
    const mergedProperties: Record<string, unknown> = {};
    for (const entry of record.allOf) {
      const resolved = resolveSchemaNode(spec, entry, visited);
      const properties = asRecord(resolved?.properties);
      if (properties) {
        Object.assign(mergedProperties, properties);
      }
    }

    return {
      ...record,
      properties: mergedProperties,
    };
  }

  return record;
};

const resolveOperationSuccessContent = (
  operation: Record<string, unknown>,
): Record<string, unknown> | null => {
  const responses = asRecord(operation.responses);
  const success = asRecord(responses?.['200'])
    ?? asRecord(responses?.['201'])
    ?? asRecord(responses?.['204']);
  const content = asRecord(success?.content);
  return asRecord(content?.['application/json']);
};

const resolveOperationSuccessSchema = (
  spec: Record<string, unknown>,
  operation: Record<string, unknown>,
): Record<string, unknown> | null => {
  const jsonContent = resolveOperationSuccessContent(operation);
  return resolveSchemaNode(spec, jsonContent?.schema);
};

const resolveRowObjectSchema = (
  spec: Record<string, unknown>,
  schema: Record<string, unknown> | null,
): Record<string, unknown> | null => {
  if (!schema) {
    return null;
  }

  if (schema.type === 'array') {
    return resolveSchemaNode(spec, schema.items);
  }

  if (schema.type === 'object' || schema.properties) {
    return schema;
  }

  return null;
};

const findRowSchemaInResponseProperties = (
  spec: Record<string, unknown>,
  responseSchema: Record<string, unknown>,
): Record<string, unknown> | null => {
  const properties = asRecord(responseSchema.properties);
  if (!properties) {
    return resolveRowObjectSchema(spec, responseSchema);
  }

  for (const key of RESPONSE_COLLECTION_KEYS) {
    const node = resolveSchemaNode(spec, properties[key]);
    if (!node) {
      continue;
    }

    if (node.type === 'array') {
      const rowSchema = resolveRowObjectSchema(spec, node);
      if (rowSchema) {
        return rowSchema;
      }
    }

    const objectSchema = resolveRowObjectSchema(spec, node);
    if (objectSchema?.properties) {
      return objectSchema;
    }
  }

  for (const key of RESPONSE_SINGLE_RECORD_KEYS) {
    const node = resolveSchemaNode(spec, properties[key]);
    const objectSchema = resolveRowObjectSchema(spec, node);
    if (objectSchema?.properties) {
      return objectSchema;
    }
  }

  return null;
};

const collectFieldNamesFromExampleValue = (value: unknown): string[] => {
  if (!value || typeof value !== 'object') {
    return [];
  }

  if (Array.isArray(value)) {
    const firstRow = value.find((entry) => entry && typeof entry === 'object' && !Array.isArray(entry));
    return firstRow && typeof firstRow === 'object'
      ? Object.keys(firstRow as Record<string, unknown>).filter((name) => name.trim().length > 0)
      : [];
  }

  return Object.keys(value as Record<string, unknown>).filter((name) => name.trim().length > 0);
};

const collectFieldNamesFromResponseExample = (
  operation: Record<string, unknown>,
): string[] => {
  const jsonContent = resolveOperationSuccessContent(operation);
  const example = jsonContent?.example ?? jsonContent?.examples;
  if (!example) {
    return [];
  }

  if (example && typeof example === 'object' && !Array.isArray(example) && 'value' in example) {
    return collectFieldNamesFromExamplePayload((example as { value?: unknown }).value);
  }

  return collectFieldNamesFromExamplePayload(example);
};

const collectFieldNamesFromExamplePayload = (payload: unknown): string[] => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return [];
  }

  const record = payload as Record<string, unknown>;
  for (const key of RESPONSE_COLLECTION_KEYS) {
    const fields = collectFieldNamesFromExampleValue(record[key]);
    if (fields.length > 0) {
      return fields;
    }
  }

  for (const key of RESPONSE_SINGLE_RECORD_KEYS) {
    const fields = collectFieldNamesFromExampleValue(record[key]);
    if (fields.length > 0) {
      return fields;
    }
  }

  return [];
};

/** Extract row field names from a live API JSON payload (`items`, `data`, etc.). */
export const resolveRowFieldNamesFromApiPayload = (payload: unknown): string[] =>
  collectFieldNamesFromExamplePayload(payload);

export const mergeEndpointFieldNames = (
  primary: readonly string[],
  secondary: readonly string[],
): string[] => {
  const seen = new Set<string>();
  const merged: string[] = [];
  const preferSecondary = secondary.length > primary.length;

  const append = (names: readonly string[]) => {
    for (const raw of names) {
      const name = raw.trim();
      if (!name || seen.has(name) || isGenericWizardRequestFieldName(name)) {
        continue;
      }
      seen.add(name);
      merged.push(name);
    }
  };

  append(preferSecondary ? secondary : primary);
  append(preferSecondary ? primary : secondary);
  return merged;
};

export const resolveEndpointPathFromOpenApi = (
  spec: unknown,
  method: string,
): string | undefined => {
  const specRecord = asRecord(spec);
  if (!specRecord) {
    return undefined;
  }

  const found = findOperation(specRecord, method);
  return found?.path;
};

const resolveEndpointRowFieldNamesFromOpenApi = (
  spec: unknown,
  method: string,
): string[] => {
  const specRecord = asRecord(spec);
  if (!specRecord) {
    return [];
  }

  const found = findOperation(specRecord, method);
  if (!found) {
    return [];
  }

  const responseSchema = resolveOperationSuccessSchema(specRecord, found.operation);
  if (!responseSchema) {
    return collectFieldNamesFromResponseExample(found.operation);
  }

  const rowSchema = findRowSchemaInResponseProperties(specRecord, responseSchema);
  const schemaFields = collectRecordPropertyNames(rowSchema);
  if (schemaFields.length > 0) {
    return schemaFields;
  }

  return collectFieldNamesFromResponseExample(found.operation);
};

/**
 * Reads row field names from a managed-function list/detail response schema (`data` payload).
 */
export const resolveEndpointResponseFieldsFromOpenApi = (
  spec: unknown,
  method: string,
): string[] => resolveEndpointRowFieldNamesFromOpenApi(spec, method);

/**
 * Typed response row fields for Auto Table / Grid builders.
 * Prefer full property schemas (type/enum/format); fall back to name-only string fields
 * from examples. Unlike form builders, server-managed columns (`id`, `created_at`, …)
 * are kept — grids usually display them.
 */
export const resolveEndpointResponseFormFieldsFromOpenApi = (
  spec: unknown,
  method: string,
): ApiFormField[] => {
  const specRecord = asRecord(spec);
  if (!specRecord) {
    return [];
  }

  const found = findOperation(specRecord, method);
  if (!found) {
    return [];
  }

  const responseSchema = resolveOperationSuccessSchema(specRecord, found.operation);
  if (responseSchema) {
    const rowSchema = findRowSchemaInResponseProperties(specRecord, responseSchema);
    const typed = collectRecordPropertyFields(rowSchema).filter(
      (field) => !isGenericWizardRequestFieldName(field.name),
    );
    if (typed.length > 0) {
      return typed;
    }
  }

  return responseFieldNamesToFormFields(
    resolveEndpointRowFieldNamesFromOpenApi(spec, method),
    { excludeServerManaged: false },
  );
};

const GENERIC_WIZARD_REQUEST_FIELD_NAMES = new Set([
  'limit',
  'page',
  'offset',
  'params',
  'body',
  'query',
]);

const SERVER_MANAGED_FORM_FIELD_NAMES = new Set([
  'id',
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
  'created_by_username',
]);

const isGenericWizardRequestFieldName = (name: string): boolean =>
  GENERIC_WIZARD_REQUEST_FIELD_NAMES.has(name.trim().toLowerCase());

const filterGenericWizardRequestFields = (fields: ApiFormField[]): ApiFormField[] =>
  fields.filter((field) => !isGenericWizardRequestFieldName(field.name));

export const responseFieldNamesToFormFields = (
  names: readonly string[],
  options: { excludeServerManaged?: boolean } = {},
): ApiFormField[] => {
  const excludeServerManaged = options.excludeServerManaged !== false;

  return names
    .filter((name) => {
      const trimmed = name.trim();
      if (!trimmed.length) {
        return false;
      }
      if (isGenericWizardRequestFieldName(trimmed)) {
        return false;
      }
      if (excludeServerManaged && SERVER_MANAGED_FORM_FIELD_NAMES.has(trimmed)) {
        return false;
      }
      return true;
    })
    .map((name) => ({
      name,
      type: 'string' as const,
      location: 'body' as const,
      required: false,
    }));
};

/**
 * Request fields for form wizards. Falls back to response `data` row properties when
 * the OpenAPI operation only exposes generic proxy params (limit/page/params/body).
 */
export const resolveEndpointFormFieldsFromOpenApi = (
  spec: unknown,
  method: string,
): ApiFormField[] => {
  const parsed = parseApiEndpointFromOpenApi(spec, { method });
  if (!parsed) {
    return [];
  }

  let requestFields: ApiFormField[] = [];
  if (parsed.scenario === 'search') {
    requestFields = parsed.fields.filter((field) => field.location === 'query' || field.location === 'body');
  } else if (parsed.scenario === 'create' || parsed.scenario === 'edit' || parsed.scenario === 'detail') {
    requestFields = parsed.fields.filter((field) => field.location === 'body');
  } else {
    requestFields = parsed.fields;
  }

  requestFields = filterGenericWizardRequestFields(requestFields);
  if (requestFields.length > 0) {
    return requestFields;
  }

  return responseFieldNamesToFormFields(
    resolveEndpointRowFieldNamesFromOpenApi(spec, method),
    { excludeServerManaged: parsed.scenario !== 'detail' },
  );
};
