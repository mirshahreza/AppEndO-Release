const SENSITIVE_HEADER_KEYS = new Set(['authorization', 'cookie', 'x-api-key']);

export const HTTP_REQUEST_TOOL_NAME = 'http_request';

const parseHeaders = (raw: unknown): Record<string, string> => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }

  const headers: Record<string, string> = {};
  Object.entries(raw as Record<string, unknown>).forEach(([key, value]) => {
    const trimmedKey = key.trim();
    if (!trimmedKey || value === undefined || value === null) return;
    headers[trimmedKey] = String(value);
  });
  return headers;
};

/** Redact sensitive HTTP request headers before streaming tool args to the UI trace. */
export const redactHttpRequestArgsForTrace = (args: Record<string, unknown>): Record<string, unknown> => {
  const headers = parseHeaders(args.headers);
  if (Object.keys(headers).length === 0) {
    return args;
  }

  const redactedHeaders: Record<string, string> = {};
  Object.entries(headers).forEach(([key, value]) => {
    redactedHeaders[key] = SENSITIVE_HEADER_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : value;
  });

  return {
    ...args,
    headers: redactedHeaders,
  };
};
