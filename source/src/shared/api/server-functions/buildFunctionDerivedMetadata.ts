import { parseServerFunctionScriptDoc, type ServerFunctionScriptDocHints } from '../openapi/parseServerFunctionScriptDoc';

export type FunctionRequestExample = {
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
  body?: Record<string, unknown>;
};

export type FunctionDerivedDocHints = {
  summary?: string;
  routeNote?: string;
  validationFields: string[];
  outputFields: string[];
  queryFields: string[];
  paramFields: string[];
};

export type FunctionDerivedMetadata = {
  codeFingerprint: string;
  generatedAt: string;
  requestExample: FunctionRequestExample;
  docHints: FunctionDerivedDocHints;
};

export type FunctionApiDocOverride = {
  summary?: string;
  description?: string;
  tags?: string[];
};

export type ServerFunctionMetadataRecord = {
  derived?: FunctionDerivedMetadata;
  apiDoc?: FunctionApiDocOverride;
  testPayloadSource?: 'generated' | 'manual';
  [key: string]: unknown;
};

export type EnsureFunctionDerivedMetadataInput = {
  code: string;
  method: string;
  path: string;
  metadataJson?: string | ServerFunctionMetadataRecord | null;
  testPayload?: string;
  isBuiltIn?: boolean;
  now?: () => string;
};

export type EnsureFunctionDerivedMetadataResult = {
  metadataJson: string | null;
  testPayload: string;
  changed: boolean;
};

const EMPTY_PAYLOAD_MARKERS = new Set(['', '{}', '{\n}', '{\n  \n}']);

export const buildCodeFingerprint = (code: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < code.length; index += 1) {
    hash ^= code.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16)}`;
};

const extractPathParamNames = (routePath: string): string[] => {
  const matches = routePath.match(/:([a-zA-Z0-9_]+)/g) ?? [];
  return matches.map((token) => token.slice(1));
};

const exampleValueForSchemaType = (type: unknown): unknown => {
  const normalized = String(type || 'string');
  if (normalized === 'number') {
    return 0;
  }
  if (normalized === 'integer') {
    return 1;
  }
  if (normalized === 'boolean') {
    return false;
  }
  return '';
};

const buildBodyExampleFromHints = (hints: ServerFunctionScriptDocHints | null): Record<string, unknown> => {
  if (!hints) {
    return {};
  }

  if (hints.validationSchema) {
    const properties = hints.validationSchema.properties;
    if (properties && typeof properties === 'object' && !Array.isArray(properties)) {
      const body: Record<string, unknown> = {};
      for (const [name, definition] of Object.entries(properties)) {
        const fieldType = definition && typeof definition === 'object' && !Array.isArray(definition)
          ? (definition as Record<string, unknown>).type
          : 'string';
        body[name] = exampleValueForSchemaType(fieldType);
      }
      if (Object.keys(body).length > 0) {
        return body;
      }
    }
  }

  return Object.fromEntries(hints.requiredBodyFields.map((name) => [name, '']));
};

const paramExampleValue = (name: string): string | number => (
  name.toLowerCase().includes('id') ? 1 : 'sample'
);

export const buildTestPayloadFromScript = (
  code: string,
  method: string,
  routePath: string,
): Record<string, unknown> => {
  const normalizedMethod = method.toUpperCase();
  const hints = parseServerFunctionScriptDoc(code, normalizedMethod, routePath);
  const pathParams = extractPathParamNames(routePath);
  const payload: Record<string, unknown> = {};

  if (pathParams.length > 0) {
    payload.params = Object.fromEntries(pathParams.map((name) => [name, paramExampleValue(name)]));
  } else if (hints?.referencedParamFields.length) {
    payload.params = Object.fromEntries(
      hints.referencedParamFields.map((name) => [name, paramExampleValue(name)]),
    );
  }

  const queryFieldNames = new Set(hints?.referencedQueryFields ?? []);
  const isListStyleGet = normalizedMethod === 'GET'
    && pathParams.length === 0
    && hints
    && (
      hints.outputFieldNames.length > 0
      || hints.referencedQueryFields.some((field) => field === 'limit' || field === 'page')
      || /\bList\b/i.test(code)
      || /SELECT\s+/i.test(code)
    );

  if (isListStyleGet) {
    queryFieldNames.add('limit');
    queryFieldNames.add('page');
  }

  if (queryFieldNames.size > 0) {
    const query: Record<string, unknown> = {};
    for (const name of queryFieldNames) {
      if (name === 'limit') {
        query.limit = 10;
      } else if (name === 'page') {
        query.page = 1;
      } else {
        query[name] = '';
      }
    }
    payload.query = query;
  }

  const bodyExample = buildBodyExampleFromHints(hints);
  const hasBodyFields = Object.keys(bodyExample).length > 0;

  if (hasBodyFields) {
    if (normalizedMethod === 'GET') {
      payload.query = {
        ...(payload.query as Record<string, unknown> | undefined),
        ...bodyExample,
      };
    } else {
      Object.assign(payload, bodyExample);
    }
  }

  return payload;
};

export const buildDerivedMetadataFromScript = (
  code: string,
  method: string,
  routePath: string,
  now: () => string = () => new Date().toISOString(),
): FunctionDerivedMetadata => {
  const hints = parseServerFunctionScriptDoc(code, method.toUpperCase(), routePath);
  const requestExample = buildTestPayloadFromScript(code, method, routePath) as FunctionRequestExample;
  const validationFields = hints?.validationSchema && typeof hints.validationSchema.properties === 'object'
    ? Object.keys(hints.validationSchema.properties as Record<string, unknown>)
    : (hints?.requiredBodyFields ?? []);

  return {
    codeFingerprint: buildCodeFingerprint(code),
    generatedAt: now(),
    requestExample,
    docHints: {
      summary: hints?.summary,
      routeNote: hints?.routeNote,
      validationFields,
      outputFields: hints?.outputFieldNames ?? [],
      queryFields: hints?.referencedQueryFields ?? [],
      paramFields: hints?.referencedParamFields ?? [],
    },
  };
};

export const parseMetadataRecord = (
  value: string | ServerFunctionMetadataRecord | null | undefined,
): ServerFunctionMetadataRecord | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }

  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as ServerFunctionMetadataRecord
      : null;
  } catch {
    return null;
  }
};

const serializeMetadataRecord = (record: ServerFunctionMetadataRecord | null): string | null => {
  if (!record || Object.keys(record).length === 0) {
    return null;
  }
  return JSON.stringify(record);
};

const isEmptyTestPayload = (testPayload: string | undefined): boolean => {
  const trimmed = (testPayload ?? '').trim();
  return EMPTY_PAYLOAD_MARKERS.has(trimmed);
};

export const serializeRequestExample = (requestExample: FunctionRequestExample): string => (
  JSON.stringify(requestExample, null, 2)
);

export const resolveEffectiveTestPayloadJson = (input: {
  code: string;
  method: string;
  path: string;
  testPayload?: string;
  metadataJson?: string | ServerFunctionMetadataRecord | null;
}): string => {
  const metadata = parseMetadataRecord(input.metadataJson);
  const fingerprint = buildCodeFingerprint(input.code);
  const trimmedPayload = (input.testPayload ?? '').trim();

  if (metadata?.testPayloadSource === 'manual' && trimmedPayload) {
    return trimmedPayload;
  }

  if (
    metadata?.derived?.codeFingerprint === fingerprint
    && trimmedPayload
    && !isEmptyTestPayload(trimmedPayload)
  ) {
    return trimmedPayload;
  }

  return serializeRequestExample(buildTestPayloadFromScript(input.code, input.method, input.path));
};

export const markTestPayloadManual = (
  metadataJson: string | ServerFunctionMetadataRecord | null | undefined,
): ServerFunctionMetadataRecord => {
  const record = parseMetadataRecord(metadataJson) ?? {};
  return {
    ...record,
    testPayloadSource: 'manual',
  };
};

export const ensureFunctionDerivedMetadata = (
  input: EnsureFunctionDerivedMetadataInput,
): EnsureFunctionDerivedMetadataResult => {
  const now = input.now ?? (() => new Date().toISOString());
  const code = input.code ?? '';
  const metadata = parseMetadataRecord(input.metadataJson) ?? {};
  const fingerprint = buildCodeFingerprint(code);
  const currentTestPayload = input.testPayload ?? '{}';
  const isManual = metadata.testPayloadSource === 'manual';

  if (input.isBuiltIn) {
    return {
      metadataJson: serializeMetadataRecord(Object.keys(metadata).length > 0 ? metadata : null),
      testPayload: currentTestPayload,
      changed: false,
    };
  }

  const derivedUnchanged = metadata.derived?.codeFingerprint === fingerprint;
  const testPayloadPopulated = !isEmptyTestPayload(currentTestPayload);

  if (derivedUnchanged && (isManual || testPayloadPopulated)) {
    return {
      metadataJson: serializeMetadataRecord(Object.keys(metadata).length > 0 ? metadata : null),
      testPayload: currentTestPayload,
      changed: false,
    };
  }

  const derived = buildDerivedMetadataFromScript(code, input.method, input.path, now);
  const nextMetadata: ServerFunctionMetadataRecord = {
    ...metadata,
    derived,
    ...(isManual ? { testPayloadSource: 'manual' as const } : { testPayloadSource: 'generated' as const }),
  };

  const nextTestPayload = isManual
    ? currentTestPayload
    : serializeRequestExample(derived.requestExample);

  return {
    metadataJson: serializeMetadataRecord(nextMetadata),
    testPayload: nextTestPayload,
    changed: true,
  };
};
