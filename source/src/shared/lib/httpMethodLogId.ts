export const toHttpMethodLogId = (method: string, path: string): string => (
  `HTTP ${String(method || 'GET').toUpperCase()} ${path}`
);

export const isLogsApiRoutePath = (path: string): boolean => {
  const normalized = path.split('?')[0] || '';
  return normalized === '/api/logs' || normalized.startsWith('/api/logs/');
};

export const resolveDefaultRouteLoggingEnabled = (path: string): boolean => (
  !isLogsApiRoutePath(path)
);
