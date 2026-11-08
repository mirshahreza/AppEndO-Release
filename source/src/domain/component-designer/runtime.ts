import type { DesignerBindingDefinition, DesignerDiagnostic } from './types';
import {
  evaluateDesignerFormulaValue,
  resolveFormulaExpressionText,
} from './bindingFormulaEngine';

export type DesignerRuntimeContext = {
  bindings?: Record<string, unknown>;
  nodeProps?: Record<string, unknown>;
  globals?: Record<string, unknown>;
};

export type DesignerPreviewLogEntry = {
  startedAt: string;
  finishedAt: string;
  endpoint: string;
  method: string;
  attempts: number;
  ok: boolean;
  status?: number;
  durationMs: number;
  errorCode?: 'binding-invalid' | 'binding-runtime' | 'preview-timeout';
  errorMessage?: string;
};

export type DesignerRuntimeResolveResult =
  | {
      ok: true;
      value: unknown;
      diagnostics: DesignerDiagnostic[];
      log: DesignerPreviewLogEntry;
    }
  | {
      ok: false;
      value: unknown;
      diagnostics: DesignerDiagnostic[];
      log: DesignerPreviewLogEntry;
    };

type RuntimeFetchResponse = {
  ok: boolean;
  status: number;
  headers?: {
    get(name: string): string | null;
  };
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

type RuntimeFetch = (input: string, init?: RequestInit) => Promise<RuntimeFetchResponse>;

type ResolveRuntimeBindingOptions = {
  fetchImpl?: RuntimeFetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  context?: DesignerRuntimeContext;
};

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_RETRY_STATUSES = [408, 425, 429, 500, 502, 503, 504];
const TEMPLATE_TOKEN_RE = /\{\{\s*([^}]+?)\s*\}\}/g;
const BINDING_TOKEN_PREFIX = 'bindings.';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const readPath = (input: unknown, path: string | undefined): unknown => {
  if (!path || !path.trim()) {
    return input;
  }

  return path
    .split('.')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .reduce<unknown>((current, segment) => {
      if (isRecord(current)) {
        return current[segment];
      }
      if (Array.isArray(current) && /^\d+$/.test(segment)) {
        return current[Number(segment)];
      }
      return undefined;
    }, input);
};

const collectTemplateBindingRefs = (value: string): string[] => {
  const refs = new Set<string>();
  TEMPLATE_TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null = TEMPLATE_TOKEN_RE.exec(value);
  while (match) {
    const token = String(match[1] ?? '').trim();
    if (token.startsWith(BINDING_TOKEN_PREFIX)) {
      const key = token.slice(BINDING_TOKEN_PREFIX.length).trim();
      if (key.length > 0) {
        refs.add(key);
      }
    }
    match = TEMPLATE_TOKEN_RE.exec(value);
  }
  return [...refs];
};

const walkBindingRefs = (value: unknown, refs: Set<string>): void => {
  if (typeof value === 'string') {
    collectTemplateBindingRefs(value).forEach((item) => refs.add(item));
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => walkBindingRefs(entry, refs));
    return;
  }
  if (isRecord(value)) {
    Object.values(value).forEach((entry) => walkBindingRefs(entry, refs));
  }
};

export const collectBindingDependencies = (definition: DesignerBindingDefinition): string[] => {
  const refs = new Set<string>();

  if (typeof definition.sourcePath === 'string') {
    const path = definition.sourcePath.trim();
    if (path.startsWith(BINDING_TOKEN_PREFIX)) {
      const key = path.slice(BINDING_TOKEN_PREFIX.length).trim();
      if (key.length > 0) {
        refs.add(key);
      }
    }
  }

  walkBindingRefs(definition.sourcePath, refs);
  walkBindingRefs(definition.endpointRef, refs);
  walkBindingRefs(definition.requestConfig?.headers, refs);
  walkBindingRefs(definition.requestConfig?.query, refs);
  walkBindingRefs(definition.requestConfig?.body, refs);

  return [...refs];
};

const interpolateString = (value: string, context: DesignerRuntimeContext): string =>
  value.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, rawPath) => {
    const resolved =
      readPath(context, rawPath) ??
      readPath(context.bindings, rawPath) ??
      readPath(context.nodeProps, rawPath) ??
      readPath(context.globals, rawPath);

    if (resolved === undefined || resolved === null) {
      return '';
    }

    return typeof resolved === 'string' ? resolved : JSON.stringify(resolved);
  });

const interpolateUnknown = (value: unknown, context: DesignerRuntimeContext): unknown => {
  if (typeof value === 'string') {
    return interpolateString(value, context);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => interpolateUnknown(entry, context));
  }
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, interpolateUnknown(entry, context)]));
  }
  return value;
};

const createDiagnostic = (
  code: DesignerDiagnostic['code'],
  message: string,
  field?: string,
): DesignerDiagnostic => ({
  id: `${code}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
  code,
  level: 'error',
  message,
  field,
});

const validateRequestConfig = (definition: DesignerBindingDefinition): DesignerDiagnostic[] => {
  const diagnostics: DesignerDiagnostic[] = [];
  const config = definition.requestConfig;

  if (!config) {
    return diagnostics;
  }

  if (config.headers !== undefined && !isRecord(config.headers)) {
    diagnostics.push(createDiagnostic('binding-invalid', 'requestConfig.headers must be a JSON object.', 'requestConfig.headers'));
  }

  if (config.query !== undefined && !isRecord(config.query)) {
    diagnostics.push(createDiagnostic('binding-invalid', 'requestConfig.query must be a JSON object.', 'requestConfig.query'));
  }

  return diagnostics;
};

const normalizeMethod = (definition: DesignerBindingDefinition): NonNullable<NonNullable<DesignerBindingDefinition['requestConfig']>['method']> =>
  definition.requestConfig?.method ?? 'GET';

const shouldRetryStatus = (status: number, definition: DesignerBindingDefinition): boolean => {
  const statuses = definition.retryPolicy?.retryOnStatuses?.filter((item) => Number.isInteger(item)) ?? DEFAULT_RETRY_STATUSES;
  return statuses.includes(status);
};

const getMaxAttempts = (definition: DesignerBindingDefinition): number => {
  const configured = definition.retryPolicy?.maxAttempts;
  if (typeof configured !== 'number' || !Number.isFinite(configured)) {
    return 1;
  }
  return Math.max(1, Math.min(5, Math.trunc(configured)));
};

const getRetryDelayMs = (definition: DesignerBindingDefinition): number => {
  const configured = definition.retryPolicy?.retryDelayMs;
  if (typeof configured !== 'number' || !Number.isFinite(configured)) {
    return 0;
  }
  return Math.max(0, Math.min(30000, Math.trunc(configured)));
};

const resolveEndpoint = (definition: DesignerBindingDefinition, context: DesignerRuntimeContext): string | null => {
  const endpoint = definition.endpointRef ?? definition.sourcePath;
  if (!endpoint || !endpoint.trim()) {
    return null;
  }
  return interpolateString(endpoint.trim(), context);
};

const buildUrl = (endpoint: string, definition: DesignerBindingDefinition, context: DesignerRuntimeContext): string => {
  const url = new URL(endpoint, 'http://localhost');
  const query = definition.requestConfig?.query ?? {};

  Object.entries(query).forEach(([key, rawValue]) => {
    url.searchParams.set(key, String(interpolateUnknown(rawValue, context) ?? ''));
  });

  if (/^https?:\/\//i.test(endpoint)) {
    return url.toString();
  }

  return `${url.pathname}${url.search}`;
};

const parseResponsePayload = async (response: RuntimeFetchResponse): Promise<unknown> => {
  const contentType = response.headers?.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const withTimeout = async <T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> => {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort('timeout'), timeoutMs);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timeoutHandle);
  }
};

export const resolveRuntimeBinding = async (
  definition: DesignerBindingDefinition,
  options: ResolveRuntimeBindingOptions = {},
): Promise<DesignerRuntimeResolveResult> => {
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as RuntimeFetch | undefined);
  const now = options.now ?? (() => Date.now());
  const sleep = options.sleep ?? ((ms: number) => Promise.resolve(ms));
  const context = options.context ?? {};
  const startedAtMs = now();
  const startedAt = new Date(startedAtMs).toISOString();
  const dependencyKeys = collectBindingDependencies(definition);

  if (dependencyKeys.length > 0) {
    const unresolved = dependencyKeys.filter((item) => readPath(context.bindings, item) === undefined);
    if (unresolved.length > 0) {
      const finishedAtMs = now();
      const diagnostics = [createDiagnostic('binding-dependency', `Binding dependencies are unresolved: ${unresolved.join(', ')}.`, 'bindings')];
      return {
        ok: false,
        value: definition.fallbackValue ?? null,
        diagnostics,
        log: {
          startedAt,
          finishedAt: new Date(finishedAtMs).toISOString(),
          endpoint: definition.endpointRef ?? definition.sourcePath ?? 'unknown',
          method: normalizeMethod(definition),
          attempts: 0,
          ok: false,
          durationMs: Math.max(0, finishedAtMs - startedAtMs),
          errorCode: 'binding-invalid',
          errorMessage: diagnostics[0].message,
        },
      };
    }
  }

  if (definition.sourceType === 'static') {
    const finishedAtMs = now();
    return {
      ok: true,
      value: definition.fallbackValue ?? definition.sourcePath ?? null,
      diagnostics: [],
      log: {
        startedAt,
        finishedAt: new Date(finishedAtMs).toISOString(),
        endpoint: 'static',
        method: 'STATIC',
        attempts: 0,
        ok: true,
        durationMs: Math.max(0, finishedAtMs - startedAtMs),
      },
    };
  }

  if (definition.sourceType === 'expression') {
    const expressionValue = readPath(context, definition.sourcePath) ?? readPath(context.bindings, definition.sourcePath);
    const value = expressionValue ?? definition.fallbackValue ?? null;
    const finishedAtMs = now();
    return {
      ok: true,
      value,
      diagnostics: [],
      log: {
        startedAt,
        finishedAt: new Date(finishedAtMs).toISOString(),
        endpoint: definition.sourcePath ?? 'expression',
        method: 'EXPR',
        attempts: 0,
        ok: true,
        durationMs: Math.max(0, finishedAtMs - startedAtMs),
      },
    };
  }

  if (definition.sourceType === 'formula') {
    const formula = resolveFormulaExpressionText(definition) ?? '';
    const designerStore = isRecord(context.globals) ? context.globals : {};
    const dataContext = isRecord(context.bindings)
      ? context.bindings
      : null;
    const formulaValue = evaluateDesignerFormulaValue(formula, designerStore, dataContext);
    const value = formulaValue ?? definition.fallbackValue ?? null;
    const finishedAtMs = now();
    return {
      ok: true,
      value,
      diagnostics: [],
      log: {
        startedAt,
        finishedAt: new Date(finishedAtMs).toISOString(),
        endpoint: formula || 'formula',
        method: 'FORMULA',
        attempts: 0,
        ok: true,
        durationMs: Math.max(0, finishedAtMs - startedAtMs),
      },
    };
  }

  if (!fetchImpl) {
    const finishedAtMs = now();
    const diagnostics = [createDiagnostic('binding-runtime', 'Fetch API is not available for runtime preview.')];
    return {
      ok: false,
      value: definition.fallbackValue ?? null,
      diagnostics,
      log: {
        startedAt,
        finishedAt: new Date(finishedAtMs).toISOString(),
        endpoint: definition.endpointRef ?? definition.sourcePath ?? 'unknown',
        method: normalizeMethod(definition),
        attempts: 0,
        ok: false,
        durationMs: Math.max(0, finishedAtMs - startedAtMs),
        errorCode: 'binding-runtime',
        errorMessage: diagnostics[0].message,
      },
    };
  }

  const requestConfigDiagnostics = validateRequestConfig(definition);
  if (requestConfigDiagnostics.length > 0) {
    const finishedAtMs = now();
    return {
      ok: false,
      value: definition.fallbackValue ?? null,
      diagnostics: requestConfigDiagnostics,
      log: {
        startedAt,
        finishedAt: new Date(finishedAtMs).toISOString(),
        endpoint: definition.endpointRef ?? definition.sourcePath ?? 'unknown',
        method: normalizeMethod(definition),
        attempts: 0,
        ok: false,
        durationMs: Math.max(0, finishedAtMs - startedAtMs),
        errorCode: 'binding-invalid',
        errorMessage: requestConfigDiagnostics[0].message,
      },
    };
  }

  const endpoint = resolveEndpoint(definition, context);
  if (!endpoint) {
    const finishedAtMs = now();
    const diagnostics = [createDiagnostic('binding-invalid', 'API binding requires endpointRef or sourcePath.', 'endpointRef')];
    return {
      ok: false,
      value: definition.fallbackValue ?? null,
      diagnostics,
      log: {
        startedAt,
        finishedAt: new Date(finishedAtMs).toISOString(),
        endpoint: 'unknown',
        method: normalizeMethod(definition),
        attempts: 0,
        ok: false,
        durationMs: Math.max(0, finishedAtMs - startedAtMs),
        errorCode: 'binding-invalid',
        errorMessage: diagnostics[0].message,
      },
    };
  }

  const method = normalizeMethod(definition);
  const maxAttempts = getMaxAttempts(definition);
  const retryDelayMs = getRetryDelayMs(definition);
  const timeoutMs = typeof definition.timeoutMs === 'number' && Number.isFinite(definition.timeoutMs)
    ? Math.max(250, Math.min(120000, Math.trunc(definition.timeoutMs)))
    : DEFAULT_TIMEOUT_MS;

  let attempts = 0;
  let lastStatus: number | undefined;
  let lastErrorMessage = 'Runtime preview failed.';
  let lastErrorCode: 'binding-runtime' | 'preview-timeout' = 'binding-runtime';

  while (attempts < maxAttempts) {
    attempts += 1;

    try {
      let requestUrl = '';
      try {
        requestUrl = buildUrl(endpoint, definition, context);
      } catch {
        throw new Error(`Invalid endpoint URL: ${endpoint}`);
      }

      const response = await withTimeout(
        (signal) =>
          fetchImpl(requestUrl, {
            method,
            headers: Object.fromEntries(
              Object.entries(definition.requestConfig?.headers ?? {}).map(([key, value]) => [key, String(interpolateUnknown(value, context) ?? '')]),
            ),
            body: method === 'GET' || method === 'DELETE'
              ? undefined
              : JSON.stringify(interpolateUnknown(definition.requestConfig?.body, context) ?? null),
            signal,
          }),
        timeoutMs,
      );

      lastStatus = response.status;
      const payload = await parseResponsePayload(response);

      if (response.ok) {
        const finishedAtMs = now();
        const mappedValue = readPath(payload, definition.responseMapping) ?? payload ?? definition.fallbackValue ?? null;
        return {
          ok: true,
          value: mappedValue,
          diagnostics: [],
          log: {
            startedAt,
            finishedAt: new Date(finishedAtMs).toISOString(),
            endpoint,
            method,
            attempts,
            ok: true,
            status: response.status,
            durationMs: Math.max(0, finishedAtMs - startedAtMs),
          },
        };
      }

      lastErrorMessage = String(readPath(payload, definition.errorMapping) ?? `Runtime preview request failed with status ${response.status}.`);
      lastErrorCode = 'binding-runtime';

      if (attempts < maxAttempts && shouldRetryStatus(response.status, definition)) {
        if (retryDelayMs > 0) {
          await sleep(retryDelayMs);
        }
        continue;
      }
    } catch (error) {
      const message = (error as Error).message || 'Runtime preview failed.';
      const lowerMessage = message.toLowerCase();
      lastErrorCode = lowerMessage.includes('aborted') || lowerMessage.includes('timeout') ? 'preview-timeout' : 'binding-runtime';
      lastErrorMessage = lastErrorCode === 'preview-timeout'
        ? `Runtime preview timed out after ${timeoutMs}ms.`
        : message;

      if (attempts < maxAttempts) {
        if (retryDelayMs > 0) {
          await sleep(retryDelayMs);
        }
        continue;
      }
    }

    break;
  }

  const finishedAtMs = now();
  const diagnostics = [createDiagnostic(lastErrorCode, lastErrorMessage)];
  return {
    ok: false,
    value: definition.fallbackValue ?? null,
    diagnostics,
    log: {
      startedAt,
      finishedAt: new Date(finishedAtMs).toISOString(),
      endpoint,
      method,
      attempts,
      ok: false,
      status: lastStatus,
      durationMs: Math.max(0, finishedAtMs - startedAtMs),
      errorCode: lastErrorCode,
      errorMessage: lastErrorMessage,
    },
  };
};