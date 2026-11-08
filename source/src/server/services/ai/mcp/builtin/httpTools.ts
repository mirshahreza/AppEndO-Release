import type { NativeToolDefinition } from '../../../../../core/ai/tools/ToolRegistry';
import { HTTP_REQUEST_TOOL_NAME } from '../../../../../core/ai/tools/httpRequestTool';
import type { AiHttpSettings } from '../../../../../shared/api/contracts/ai/types';
import { createSsrfGuardedFetch, validateMcpRemoteUrl } from '../mcpUrlGuard';

export { HTTP_REQUEST_TOOL_NAME };

export const HTTP_REQUEST_TIMEOUT_MS = 30_000;
export const HTTP_REQUEST_MAX_BYTES = 256_000;

const ALLOWED_HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

const SENSITIVE_HEADER_KEYS = new Set(['authorization', 'cookie', 'set-cookie', 'x-api-key']);

export type HttpToolsDeps = {
  getHttpSettings: () => AiHttpSettings;
  fetchImpl?: typeof fetch;
  validateUrl?: typeof validateMcpRemoteUrl;
};

export const normalizeHostname = (hostname: string): string => (
  hostname.toLowerCase().replace(/^\[|\]$/g, '')
);

export const isHostnameAllowlisted = (
  hostname: string,
  allowedHostnames: readonly string[],
): boolean => {
  const normalized = normalizeHostname(hostname);
  return allowedHostnames.some((entry) => normalizeHostname(entry) === normalized);
};

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

const redactResponseHeaders = (headers: Headers): Record<string, string> => {
  const output: Record<string, string> = {};
  headers.forEach((value, key) => {
    output[key] = SENSITIVE_HEADER_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : value;
  });
  return output;
};

const truncateBody = (body: string): { text: string; truncated: boolean } => {
  if (Buffer.byteLength(body, 'utf8') <= HTTP_REQUEST_MAX_BYTES) {
    return { text: body, truncated: false };
  }

  let truncated = body;
  while (truncated.length > 0 && Buffer.byteLength(truncated, 'utf8') > HTTP_REQUEST_MAX_BYTES) {
    truncated = truncated.slice(0, Math.floor(truncated.length * 0.9));
  }

  return { text: `${truncated}\n… [content truncated]`, truncated: true };
};

export const executeHttpRequest = async (
  args: Record<string, unknown>,
  deps: HttpToolsDeps,
): Promise<
  | { ok: true; summary: string; data: Record<string, unknown> }
  | { ok: false; summary: string; error: string }
> => {
  const methodInput = typeof args.method === 'string' ? args.method.trim().toUpperCase() : 'GET';
  if (!ALLOWED_HTTP_METHODS.has(methodInput)) {
    return {
      ok: false,
      summary: `HTTP method "${methodInput || '(empty)'}" is not supported.`,
      error: 'invalid_method',
    };
  }

  const urlInput = typeof args.url === 'string' ? args.url.trim() : '';
  if (!urlInput) {
    return { ok: false, summary: 'URL is required.', error: 'missing_url' };
  }

  const settings = deps.getHttpSettings();
  if (settings.allowedHostnames.length === 0) {
    return {
      ok: false,
      summary: 'No HTTP hostnames are allowlisted. Configure allowed hostnames in Settings → MCP Servers.',
      error: 'http_allowlist_empty',
    };
  }

  const validateUrl = deps.validateUrl ?? validateMcpRemoteUrl;
  let validatedUrl: URL;
  try {
    validatedUrl = await validateUrl(urlInput);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, summary: message, error: 'url_blocked' };
  }

  if (!isHostnameAllowlisted(validatedUrl.hostname, settings.allowedHostnames)) {
    return {
      ok: false,
      summary: `Hostname "${validatedUrl.hostname}" is not in the HTTP allowlist.`,
      error: 'hostname_not_allowlisted',
    };
  }

  const headers = parseHeaders(args.headers);
  const body = typeof args.body === 'string' ? args.body : undefined;
  const fetchImpl = deps.fetchImpl ?? createSsrfGuardedFetch();

  try {
    const response = await fetchImpl(validatedUrl.toString(), {
      method: methodInput,
      headers: {
        Accept: 'application/json, text/plain, */*',
        ...headers,
      },
      body: methodInput === 'GET' || methodInput === 'HEAD' ? undefined : body,
      signal: AbortSignal.timeout(HTTP_REQUEST_TIMEOUT_MS),
    });

    const contentType = response.headers.get('content-type') ?? 'unknown';
    const rawBody = methodInput === 'HEAD' ? '' : await response.text();
    const { text, truncated } = truncateBody(rawBody);

    return {
      ok: true,
      summary: truncated
        ? `HTTP ${methodInput} ${validatedUrl.hostname} → ${response.status} (truncated).`
        : `HTTP ${methodInput} ${validatedUrl.hostname} → ${response.status}.`,
      data: {
        url: validatedUrl.toString(),
        method: methodInput,
        status: response.status,
        contentType,
        truncated,
        headers: redactResponseHeaders(response.headers),
        body: text,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      summary: `HTTP request failed: ${message}`,
      error: 'request_failed',
    };
  }
};

export const createHttpTools = (deps: HttpToolsDeps): NativeToolDefinition[] => [
  {
    name: HTTP_REQUEST_TOOL_NAME,
    description: 'Send an HTTP request to an allowlisted hostname. SSRF-protected — loopback and private addresses are blocked.',
    group: 'search',
    parameters: {
      type: 'object',
      properties: {
        method: {
          type: 'string',
          description: 'HTTP method (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS). Defaults to GET.',
        },
        url: {
          type: 'string',
          description: 'Absolute http or https URL. Hostname must be in the configured allowlist.',
        },
        headers: {
          type: 'object',
          description: 'Optional request headers as key/value pairs.',
        },
        body: {
          type: 'string',
          description: 'Optional request body for POST, PUT, and PATCH.',
        },
      },
      required: ['url'],
    },
    execute: async (args) => executeHttpRequest(args, deps),
  },
];
