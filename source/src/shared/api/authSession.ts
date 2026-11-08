/**
 * Browser session restore contract (do not bypass or weaken).
 *
 * - Tokens: HttpOnly cookies only (`access_token`, `refresh_token`) — never localStorage.
 * - Boot: `restoreBrowserSession()` — me → optional refresh → me retry.
 * - Runtime: `apiFetch` reactive 401 refresh on non-exempt `/api` routes.
 * - `/api/auth/me` stays on `isAuthExemptEndpoint` so boot restore owns silent refresh.
 *
 * Locked by: `authSession.restore.test.ts` · `docs/standards/dev-auth.md` ·
 * `projectStandards.ts` (`auth.session.browser-restore`).
 */
const ACCESS_TOKEN_STORAGE_KEY = 'access_token';

export type AuthFailureListener = () => void;

export type AuthMePayload = {
  success?: boolean;
  canRestoreSession?: boolean;
  user?: {
    id: number | string;
    email: string;
    role?: string;
    roles?: unknown[];
  };
  clientContext?: Record<string, unknown>;
};

export type RestoreBrowserSessionResult =
  | { status: 'authenticated'; me: AuthMePayload }
  | { status: 'anonymous' };

const authFailureListeners = new Set<AuthFailureListener>();
const invokeFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
  globalThis.fetch(input, init);

let refreshPromise: Promise<boolean> | null = null;

const clearStoredAccessToken = (): void => {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
};

export const registerAuthFailureListener = (listener: AuthFailureListener): (() => void) => {
  authFailureListeners.add(listener);
  return () => {
    authFailureListeners.delete(listener);
  };
};

const notifyAuthFailure = (): void => {
  authFailureListeners.forEach((listener) => listener());
};

export const resolveRequestUrl = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
};

export const isApiRequestUrl = (url: string): boolean => url.startsWith('/api') || url.includes('/api/');

export const isAuthExemptEndpoint = (url: string): boolean => (
  /\/api\/auth\/(?:login|refresh|logout|register|forgot-password|reset-password|verify-email|config|resend-verification|me)/.test(url)
  || /\/api\/pwa\/config(?:\?|$)/.test(url)
  || /\/api\/platform\/runtime-config(?:\?|$)/.test(url)
  || /\/api\/platform\/cultures(?:\?|$)/.test(url)
  || /\/api\/platform\/culture-translations\/bundle\/[^/]+(?:\?|$)/.test(url)
  || /\/api\/boot(?:\?|$)/.test(url)
  || /\/api\/cms-site\//.test(url)
  || /\/api\/workbooks\/[^/?#]+\/open(?:\?|$)/.test(url)
);

export async function refreshAccessToken(): Promise<boolean> {
  const response = await invokeFetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
  });

  if (!response.ok) {
    return false;
  }

  const data = await response.json().catch(() => null) as { success?: boolean } | null;
  return Boolean(data?.success);
}

export async function refreshAccessTokenWithLock(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

const AUTH_ME_PATH = '/api/auth/me';

const fetchAuthMe = async (): Promise<{ response: Response; data: AuthMePayload }> => {
  const response = await invokeFetch(AUTH_ME_PATH, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });
  const data = await response.json().catch(() => ({})) as AuthMePayload;
  return { response, data };
};

const isAuthenticatedMePayload = (
  response: Response,
  data: AuthMePayload,
): data is AuthMePayload & { success: true; user: NonNullable<AuthMePayload['user']> } => (
  response.ok
  && data.success === true
  && data.user != null
  && typeof data.user.email === 'string'
);

const shouldAttemptSilentRefresh = (
  response: Response,
  data: AuthMePayload,
): boolean => (
  response.status === 401
  || data.canRestoreSession === true
);

/**
 * Restores an existing browser session on cold start without storing tokens in JS.
 * Attempts silent refresh only when `/api/auth/me` signals a restorable session.
 */
export async function restoreBrowserSession(): Promise<RestoreBrowserSessionResult> {
  const initial = await fetchAuthMe();
  if (isAuthenticatedMePayload(initial.response, initial.data)) {
    return { status: 'authenticated', me: initial.data };
  }

  if (!shouldAttemptSilentRefresh(initial.response, initial.data)) {
    return { status: 'anonymous' };
  }

  const refreshed = await refreshAccessTokenWithLock();
  if (!refreshed) {
    return { status: 'anonymous' };
  }

  const retry = await fetchAuthMe();
  if (isAuthenticatedMePayload(retry.response, retry.data)) {
    return { status: 'authenticated', me: retry.data };
  }

  return { status: 'anonymous' };
}

export class SessionExpiredError extends Error {
  readonly response: Response;

  constructor(response: Response) {
    super('Session expired.');
    this.name = 'SessionExpiredError';
    this.response = response;
  }
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = resolveRequestUrl(input);
  const isApi = isApiRequestUrl(url);
  const isAuthExempt = isAuthExemptEndpoint(url);
  const method = String(init.method ?? 'GET').toUpperCase();
  const mutating = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
  const headers = new Headers(init.headers ?? undefined);
  let profileStartedAtMs: number | null = null;
  if (isApi) {
    const { isPageLoadProfilingEnabled } = await import('../lib/pageLoadProfile/store');
    if (isPageLoadProfilingEnabled()) {
      profileStartedAtMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (!headers.has('X-AppEndO-Page-Profile')) {
        headers.set('X-AppEndO-Page-Profile', '1');
      }
    }
  }
  if (isApi && mutating && typeof window !== 'undefined' && !headers.has('X-AppEndO-Client')) {
    const { attachIdentityClientHeader } = await import('../lib/clientContext');
    attachIdentityClientHeader(headers);
  }

  const fetchOptions: RequestInit = {
    ...init,
    headers,
    credentials: init.credentials ?? 'include',
    cache: init.cache ?? (isApi ? 'no-store' : 'default'),
  };

  let response = await invokeFetch(input, fetchOptions);

  if (isApi && !isAuthExempt && method === 'GET' && response.status === 504) {
    for (const delayMs of [400, 1200]) {
      await new Promise((resolve) => {
        setTimeout(resolve, delayMs);
      });
      response = await invokeFetch(input, fetchOptions);
      if (response.status !== 504) {
        break;
      }
    }
  }

  const finishProfileCapture = async (finalResponse: Response): Promise<Response> => {
    if (profileStartedAtMs != null) {
      const { recordPageLoadProfileFromResponse } = await import('../lib/pageLoadProfile/recordFromResponse');
      const finishedAtMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
      recordPageLoadProfileFromResponse(url, finalResponse, profileStartedAtMs, finishedAtMs);
    }
    return finalResponse;
  };

  if (!isApi || isAuthExempt || response.status !== 401) {
    return finishProfileCapture(response);
  }

  const refreshed = await refreshAccessTokenWithLock();
  if (!refreshed) {
    clearStoredAccessToken();
    notifyAuthFailure();
    throw new SessionExpiredError(response);
  }

  const retried = await invokeFetch(input, {
    ...init,
    headers,
    credentials: init.credentials ?? 'include',
    cache: init.cache ?? (isApi ? 'no-store' : 'default'),
  });
  return finishProfileCapture(retried);
}
