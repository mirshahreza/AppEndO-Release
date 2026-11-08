import { apiFetch, SessionExpiredError } from './authSession';
import { getActiveImpersonationGrantId, recordDevToolbarApiCall } from '../lib/devToolbarSignal';
import { isPageLoadProfilingEnabled } from '../lib/pageLoadProfile/store';

export type ApiRecord = Record<string, unknown>;

export type ApiListResponse<T = ApiRecord> = ApiRecord & {
  success: boolean;
  error?: string;
  items?: T[];
  totalCount?: number;
};

export type ApiMutationResponse = ApiRecord & {
  success: boolean;
  error?: string;
  message?: string;
};

export const resolveApiMutationErrorMessage = (data: unknown, fallback: string): string => {
  if (!data || typeof data !== 'object') {
    return fallback;
  }
  const record = data as Record<string, unknown>;
  const message = typeof record.message === 'string' ? record.message.trim() : '';
  if (message) {
    return message;
  }
  const error = typeof record.error === 'string' ? record.error.trim() : '';
  return error || fallback;
};

export type ApiRequestResult<T> = {
  data: T;
  response: Response;
};

export {
  apiFetch,
  registerAuthFailureListener,
  refreshAccessTokenWithLock,
  restoreBrowserSession,
  SessionExpiredError,
} from './authSession';

export type { AuthMePayload, RestoreBrowserSessionResult } from './authSession';

export const API_ERROR_EVENT = 'append:api-error' as const;

export type ApiErrorEventDetail = {
  message: string;
  error: ApiError;
};

const BODY_SNIPPET_MAX_LENGTH = 500;

const defaultJsonHeaders = (): HeadersInit => ({
  'Content-Type': 'application/json',
});

/** Let fetch set multipart boundaries and blob types — do not force JSON Content-Type. */
const shouldOmitDefaultJsonContentType = (body: BodyInit): boolean => {
  if (typeof FormData !== 'undefined' && body instanceof FormData) return true;
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return true;
  if (typeof Blob !== 'undefined' && body instanceof Blob) return true;
  return body instanceof ArrayBuffer;
};

const sanitizeBodySnippet = (raw: string): string => {
  const normalized = raw.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }
  if (normalized.length <= BODY_SNIPPET_MAX_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, BODY_SNIPPET_MAX_LENGTH)}…`;
};

export class ApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly bodySnippet: string;
  readonly path: string;
  readonly isParseError: boolean;

  constructor(
    message: string,
    detail: {
      status: number;
      statusText: string;
      bodySnippet: string;
      path: string;
      isParseError?: boolean;
    },
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'ApiError';
    this.status = detail.status;
    this.statusText = detail.statusText;
    this.bodySnippet = detail.bodySnippet;
    this.path = detail.path;
    this.isParseError = detail.isParseError ?? false;
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

export const isAbortError = (error: unknown): boolean => (
  error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError')
  || (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError'))
);

const toAbortError = (cause: unknown, signal?: AbortSignal | null): DOMException => {
  if (cause instanceof DOMException && cause.name === 'AbortError') {
    return cause;
  }
  const reason = signal?.reason;
  if (reason instanceof DOMException && reason.name === 'AbortError') {
    return reason;
  }
  return new DOMException('The operation was aborted.', 'AbortError');
};

export const formatQueryError = (error: unknown, fallback: string): string => {
  if (isApiError(error)) {
    return formatApiErrorMessage(error);
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

export const formatApiErrorMessage = (error: unknown): string => {
  if (!isApiError(error)) {
    return error instanceof Error ? error.message : String(error);
  }

  const statusLabel = error.status > 0
    ? `HTTP ${error.status} ${error.statusText}`.trim()
    : error.statusText || 'Network error';

  if (error.isParseError) {
    const preview = error.bodySnippet ? ` Response preview: ${error.bodySnippet}` : '';
    const looksLikeViteIndex = /<!doctype html/i.test(error.bodySnippet)
      || error.bodySnippet.includes('/@vite/client')
      || error.bodySnippet.includes('/@react-refresh');
    const devPortHint = looksLikeViteIndex && import.meta.env.DEV
      ? ' In development, use the main AppEndO URL from settings (runtime.appUrl, usually http://localhost:3000), not the internal Vite port.'
      : '';
    return `Server returned a non-JSON response (${statusLabel}).${devPortHint}${preview}`;
  }

  const preview = error.bodySnippet ? ` ${error.bodySnippet}` : '';
  return `${error.message} (${statusLabel}).${preview}`.trim();
};

let lastReportedMessage = '';
let lastReportedAt = 0;

export const reportApiError = (error: unknown): void => {
  if (!isApiError(error) || typeof window === 'undefined') {
    return;
  }

  const message = formatApiErrorMessage(error);
  const now = Date.now();
  if (message === lastReportedMessage && now - lastReportedAt < 2000) {
    return;
  }

  lastReportedMessage = message;
  lastReportedAt = now;
  window.dispatchEvent(new CustomEvent<ApiErrorEventDetail>(API_ERROR_EVENT, {
    detail: { message, error },
  }));
};

const parseResponseJson = <T>(raw: string, response: Response, path: string): T => {
  if (!raw) {
    return {} as T;
  }

  try {
    return JSON.parse(raw) as T;
  } catch (cause) {
    throw new ApiError(
      'Server returned a non-JSON response.',
      {
        status: response.status,
        statusText: response.statusText,
        bodySnippet: sanitizeBodySnippet(raw),
        path,
        isParseError: true,
      },
      { cause },
    );
  }
};

export async function apiRequest<T = ApiMutationResponse>(
  path: string,
  init: RequestInit = {},
): Promise<ApiRequestResult<T>> {
  const headers = new Headers(init.headers ?? undefined);
  if (
    init.body != null
    && !headers.has('Content-Type')
    && !shouldOmitDefaultJsonContentType(init.body)
  ) {
    headers.set('Content-Type', 'application/json');
  }
  const activeImpersonationGrantId = getActiveImpersonationGrantId();
  if (activeImpersonationGrantId && !headers.has('x-impersonate-grant')) {
    headers.set('x-impersonate-grant', activeImpersonationGrantId);
  }
  if (isPageLoadProfilingEnabled() && !headers.has('X-AppEndO-Page-Profile')) {
    headers.set('X-AppEndO-Page-Profile', '1');
  }

  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  let response: Response;
  try {
    response = await apiFetch(path, {
      ...init,
      headers,
    });
  } catch (cause) {
    const requestSignal = init.signal;
    if (isAbortError(cause) || (requestSignal instanceof AbortSignal && requestSignal.aborted)) {
      throw toAbortError(cause, requestSignal instanceof AbortSignal ? requestSignal : undefined);
    }

    if (cause instanceof SessionExpiredError) {
      throw new ApiError(
        'Session expired.',
        {
          status: cause.response.status,
          statusText: cause.response.statusText,
          bodySnippet: '',
          path,
        },
        { cause },
      );
    }

    const networkError = new ApiError(
      'Network request failed.',
      {
        status: 0,
        statusText: 'Network Error',
        bodySnippet: cause instanceof Error ? cause.message : String(cause),
        path,
      },
      { cause },
    );
    throw networkError;
  }

  const raw = await response.text();
  const data = parseResponseJson<T>(raw, response, path);

  const durationMs = Math.round(
    (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt,
  );
  const requestId = typeof response.headers?.get === 'function'
    ? response.headers.get('x-request-id')
    : null;

  recordDevToolbarApiCall({
    requestId,
    durationMs,
    path,
  });

  return { data, response };
}

const inflightGetRequests = new Map<string, Promise<ApiRequestResult<unknown>>>();

const wrapWithAbortSignal = <T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> => {
  if (!signal) {
    return promise;
  }

  if (signal.aborted) {
    return Promise.reject(
      signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'),
    );
  }

  return new Promise((resolve, reject) => {
    const onAbort = () => reject(
      signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'),
    );
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
};

export function apiGet<T = ApiListResponse>(
  path: string,
  init?: RequestInit,
): Promise<ApiRequestResult<T>> {
  const { signal, ...restInit } = init ?? {};

  // Refetches pass an AbortSignal — skip in-flight dedup so mutations get a fresh list.
  if (signal) {
    return wrapWithAbortSignal(apiRequest<T>(path, { ...restInit, signal }), signal);
  }

  const inflight = inflightGetRequests.get(path);
  if (inflight) {
    return wrapWithAbortSignal(inflight as Promise<ApiRequestResult<T>>, undefined);
  }

  const sharedPromise = apiRequest<T>(path, restInit).finally(() => {
    if (inflightGetRequests.get(path) === sharedPromise) {
      inflightGetRequests.delete(path);
    }
  }) as Promise<ApiRequestResult<T>>;

  inflightGetRequests.set(path, sharedPromise as Promise<ApiRequestResult<unknown>>);
  return wrapWithAbortSignal(sharedPromise, signal);
}

export function apiPost<T = ApiMutationResponse>(
  path: string,
  body?: unknown,
): Promise<ApiRequestResult<T>> {
  return apiRequest<T>(path, {
    method: 'POST',
    headers: defaultJsonHeaders(),
    body: body == null ? undefined : JSON.stringify(body),
  });
}

export function apiPut<T = ApiMutationResponse>(
  path: string,
  body?: unknown,
): Promise<ApiRequestResult<T>> {
  return apiRequest<T>(path, {
    method: 'PUT',
    headers: defaultJsonHeaders(),
    body: body == null ? undefined : JSON.stringify(body),
  });
}

export function apiPatch<T = ApiMutationResponse>(
  path: string,
  body?: unknown,
): Promise<ApiRequestResult<T>> {
  return apiRequest<T>(path, {
    method: 'PATCH',
    headers: body == null ? undefined : defaultJsonHeaders(),
    body: body == null ? undefined : JSON.stringify(body),
  });
}

export function apiDelete<T = ApiMutationResponse>(
  path: string,
  body?: unknown,
): Promise<ApiRequestResult<T>> {
  return apiRequest<T>(path, {
    method: 'DELETE',
    headers: body == null ? undefined : defaultJsonHeaders(),
    body: body == null ? undefined : JSON.stringify(body),
  });
}
