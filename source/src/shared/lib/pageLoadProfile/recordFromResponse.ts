import { isHttpApiRequestPath } from './httpApiPath';
import { parseServerPerfHeader } from './parseServerPerfHeader';
import { isPageLoadProfilingEnabled, recordPageLoadProfileApiCall } from './store';

export const apiPathFromRequestUrl = (url: string): string => {
  if (url.startsWith('/')) {
    return url;
  }
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://local';
    const parsed = new URL(url, origin);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
};

export const recordPageLoadProfileFromResponse = (
  requestUrl: string,
  response: Response,
  startedAtMs: number,
  finishedAtMs: number,
): void => {
  if (!isPageLoadProfilingEnabled()) {
    return;
  }
  const path = apiPathFromRequestUrl(requestUrl);
  if (!isHttpApiRequestPath(path)) {
    return;
  }
  const durationMs = Math.max(0, Math.round(finishedAtMs - startedAtMs));
  const requestId = typeof response.headers?.get === 'function'
    ? response.headers.get('x-request-id')
    : null;
  recordPageLoadProfileApiCall({
    path,
    durationMs,
    requestId,
    server: parseServerPerfHeader(response),
    startedAtMs,
    finishedAtMs,
  });
};
