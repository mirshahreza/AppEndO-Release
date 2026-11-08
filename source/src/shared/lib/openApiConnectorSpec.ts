/**
 * Minimal OpenAPI 3.x reader for PDK-8's HTTP Connections engine — deliberately shallow (no $ref
 * resolution, no schema validation). It exists only to answer "what operations does this API
 * expose" for a picker + "what's its default base URL", not to fully model the spec.
 */

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
type HttpMethod = typeof HTTP_METHODS[number];

export type OpenApiConnectorOperation = {
  operationId: string;
  method: Uppercase<HttpMethod>;
  path: string;
  summary?: string;
};

export type ParsedOpenApiConnectorSpec = {
  title?: string;
  baseUrl?: string;
  operations: OpenApiConnectorOperation[];
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

export function parseOpenApiConnectorSpec(raw: string): ParsedOpenApiConnectorSpec {
  let spec: unknown;
  try {
    spec = JSON.parse(raw);
  } catch {
    throw new Error('OpenAPI spec must be valid JSON.');
  }

  if (!isPlainObject(spec)) {
    throw new Error('OpenAPI spec must be a JSON object.');
  }

  const info = isPlainObject(spec.info) ? spec.info : {};
  const title = typeof info.title === 'string' ? info.title : undefined;

  const servers = Array.isArray(spec.servers) ? spec.servers : [];
  const firstServer = servers.find((server): server is Record<string, unknown> => isPlainObject(server) && typeof server.url === 'string');
  const baseUrl = firstServer ? String(firstServer.url) : undefined;

  const paths = isPlainObject(spec.paths) ? spec.paths : {};
  const operations: OpenApiConnectorOperation[] = [];

  for (const [pathKey, pathItemRaw] of Object.entries(paths)) {
    if (!isPlainObject(pathItemRaw)) {
      continue;
    }
    for (const method of HTTP_METHODS) {
      const operationRaw = pathItemRaw[method];
      if (!isPlainObject(operationRaw)) {
        continue;
      }
      const rawOperationId = typeof operationRaw.operationId === 'string' && operationRaw.operationId.trim()
        ? operationRaw.operationId.trim()
        : `${method}_${pathKey}`;
      const summary = typeof operationRaw.summary === 'string' ? operationRaw.summary : undefined;
      operations.push({
        operationId: rawOperationId,
        method: method.toUpperCase() as Uppercase<HttpMethod>,
        path: pathKey,
        summary,
      });
    }
  }

  if (operations.length === 0) {
    throw new Error('OpenAPI spec has no operations under "paths".');
  }

  return { title, baseUrl, operations };
}

/** Substitutes `{param}` placeholders in an operation's path template with provided values. Unresolved placeholders are left as-is so the caller sees a clear 404 rather than a silent wrong URL. */
export function fillOpenApiPathParams(pathTemplate: string, pathParams: Record<string, string> | undefined): string {
  if (!pathParams) {
    return pathTemplate;
  }
  return pathTemplate.replace(/\{([^}]+)\}/g, (match, key: string) => (
    Object.prototype.hasOwnProperty.call(pathParams, key) ? encodeURIComponent(pathParams[key]) : match
  ));
}

// ---------------------------------------------------------------------------
// Richer read for the HTTP Workshop import flow (p-97 HW-5) — still no $ref
// resolution or schema validation, but captures enough to prefill a Request:
// query/path/header parameters, a first requestBody example, and a suggested
// auth kind from securitySchemes. Kept separate from the shallow parser above
// so the legacy HTTP Connections test-call flow's shape/behavior is untouched.
// ---------------------------------------------------------------------------

export type OpenApiConnectorParameterLocation = 'query' | 'path' | 'header';
export type OpenApiConnectorParameter = { name: string; location: OpenApiConnectorParameterLocation; required: boolean };
export type OpenApiConnectorSuggestedAuthKind = 'apiKey' | 'bearer' | 'basic';

export type OpenApiConnectorOperationRich = OpenApiConnectorOperation & {
  parameters: OpenApiConnectorParameter[];
  requestBodyExample?: string;
};

export type ParsedOpenApiConnectorSpecRich = {
  title?: string;
  baseUrl?: string;
  operations: OpenApiConnectorOperationRich[];
  suggestedAuthKind?: OpenApiConnectorSuggestedAuthKind;
  suggestedApiKeyHeaderName?: string;
};

function readParameters(operationRaw: Record<string, unknown>, pathItemRaw: Record<string, unknown>): OpenApiConnectorParameter[] {
  const raw = [
    ...(Array.isArray(pathItemRaw.parameters) ? pathItemRaw.parameters : []),
    ...(Array.isArray(operationRaw.parameters) ? operationRaw.parameters : []),
  ];
  const parameters: OpenApiConnectorParameter[] = [];
  for (const entry of raw) {
    if (!isPlainObject(entry) || typeof entry.name !== 'string') continue;
    const location = entry.in === 'path' || entry.in === 'header' || entry.in === 'query' ? entry.in : undefined;
    if (!location) continue;
    parameters.push({ name: entry.name, location, required: Boolean(entry.required) || location === 'path' });
  }
  return parameters;
}

function readRequestBodyExample(operationRaw: Record<string, unknown>): string | undefined {
  const requestBody = isPlainObject(operationRaw.requestBody) ? operationRaw.requestBody : undefined;
  const content = requestBody && isPlainObject(requestBody.content) ? requestBody.content : undefined;
  const jsonContent = content && isPlainObject(content['application/json']) ? content['application/json'] : undefined;
  if (!jsonContent) return undefined;
  if (jsonContent.example !== undefined) {
    return JSON.stringify(jsonContent.example, null, 2);
  }
  const examples = isPlainObject(jsonContent.examples) ? jsonContent.examples : undefined;
  const firstExample = examples ? Object.values(examples).find((entry) => isPlainObject(entry) && 'value' in entry) : undefined;
  if (isPlainObject(firstExample) && firstExample.value !== undefined) {
    return JSON.stringify(firstExample.value, null, 2);
  }
  return undefined;
}

function readSuggestedAuth(spec: Record<string, unknown>): { kind?: OpenApiConnectorSuggestedAuthKind; apiKeyHeaderName?: string } {
  const components = isPlainObject(spec.components) ? spec.components : {};
  const schemes = isPlainObject(components.securitySchemes) ? components.securitySchemes : {};
  for (const scheme of Object.values(schemes)) {
    if (!isPlainObject(scheme)) continue;
    if (scheme.type === 'apiKey' && scheme.in === 'header' && typeof scheme.name === 'string') {
      return { kind: 'apiKey', apiKeyHeaderName: scheme.name };
    }
    if (scheme.type === 'http' && scheme.scheme === 'bearer') {
      return { kind: 'bearer' };
    }
    if (scheme.type === 'http' && scheme.scheme === 'basic') {
      return { kind: 'basic' };
    }
  }
  return {};
}

export function parseOpenApiConnectorSpecRich(raw: string): ParsedOpenApiConnectorSpecRich {
  let spec: unknown;
  try {
    spec = JSON.parse(raw);
  } catch {
    throw new Error('OpenAPI spec must be valid JSON.');
  }
  if (!isPlainObject(spec)) {
    throw new Error('OpenAPI spec must be a JSON object.');
  }

  const info = isPlainObject(spec.info) ? spec.info : {};
  const title = typeof info.title === 'string' ? info.title : undefined;
  const servers = Array.isArray(spec.servers) ? spec.servers : [];
  const firstServer = servers.find((server): server is Record<string, unknown> => isPlainObject(server) && typeof server.url === 'string');
  const baseUrl = firstServer ? String(firstServer.url) : undefined;
  const paths = isPlainObject(spec.paths) ? spec.paths : {};

  const operations: OpenApiConnectorOperationRich[] = [];
  for (const [pathKey, pathItemRaw] of Object.entries(paths)) {
    if (!isPlainObject(pathItemRaw)) continue;
    for (const method of HTTP_METHODS) {
      const operationRaw = pathItemRaw[method];
      if (!isPlainObject(operationRaw)) continue;
      const rawOperationId = typeof operationRaw.operationId === 'string' && operationRaw.operationId.trim()
        ? operationRaw.operationId.trim()
        : `${method}_${pathKey}`;
      const summary = typeof operationRaw.summary === 'string' ? operationRaw.summary : undefined;
      operations.push({
        operationId: rawOperationId,
        method: method.toUpperCase() as Uppercase<HttpMethod>,
        path: pathKey,
        summary,
        parameters: readParameters(operationRaw, pathItemRaw),
        requestBodyExample: readRequestBodyExample(operationRaw),
      });
    }
  }

  if (operations.length === 0) {
    throw new Error('OpenAPI spec has no operations under "paths".');
  }

  const suggestedAuth = readSuggestedAuth(spec);
  return { title, baseUrl, operations, suggestedAuthKind: suggestedAuth.kind, suggestedApiKeyHeaderName: suggestedAuth.apiKeyHeaderName };
}
