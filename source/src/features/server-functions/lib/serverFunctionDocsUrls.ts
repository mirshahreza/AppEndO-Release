export type ServerFunctionDocsScope = 'all' | 'function';

export const buildServerFunctionSwaggerUrl = (
  scope: ServerFunctionDocsScope,
  functionId?: string | null,
): string => {
  if (scope === 'function' && functionId) {
    return `/api/docs/routes/${encodeURIComponent(functionId)}`;
  }
  return '/api/docs';
};

export const buildServerFunctionOpenApiUrl = (
  scope: ServerFunctionDocsScope,
  functionId?: string | null,
): string => {
  if (scope === 'function' && functionId) {
    return `/api/docs/routes/${encodeURIComponent(functionId)}/openapi.json`;
  }
  return '/api/docs/openapi.json';
};

export const buildServerFunctionDocsRefreshUrl = (
  scope: ServerFunctionDocsScope,
  functionId?: string | null,
): string => {
  if (scope === 'function' && functionId) {
    return `/api/docs/refresh?functionId=${encodeURIComponent(functionId)}`;
  }
  return '/api/docs/refresh';
};

export const resolveServerFunctionDocAbsoluteUrl = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalizedPath, window.location.href).href;
};

/** Opens docs in a new tab only — never navigates the current admin shell. */
export const openServerFunctionDocUrl = (path: string): void => {
  const url = resolveServerFunctionDocAbsoluteUrl(path);
  window.open(url, '_blank', 'noopener,noreferrer');
};
