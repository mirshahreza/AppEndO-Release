import { validateMcpRemoteUrl, createSsrfGuardedFetch } from '../../../../services/ai/mcp/mcpUrlGuard';
import type { ActionDefinition, ActionExecutor } from '../types';

/**
 * Integration Action pack (doc 04 section 4) — governed outbound HTTP. Reuses the repo's one
 * real SSRF-protection primitive (`validateMcpRemoteUrl` blocks private/loopback-resolving
 * hostnames, `createSsrfGuardedFetch` rejects redirects) rather than the MCP-feature-specific
 * hostname-allowlist settings layered on top of it in `httpTools.ts` — that allowlist is scoped
 * to the MCP servers feature's own settings, not a generic "governed outbound HTTP" primitive, so
 * reusing only the SSRF core avoids incorrectly coupling Workflow to an unrelated feature's
 * config while still satisfying "MUST reuse canonical AppEndO primitives" for the actual trust
 * boundary (doc 04 section 4).
 */

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
export const DEFAULT_HTTP_MAX_RESPONSE_BYTES = 1_000_000;
export const HARD_CAP_HTTP_MAX_RESPONSE_BYTES = 10_000_000;

/** Author may raise the default 1 MB cap (CSV feeds) up to 10 MB via config.maxResponseBytes. */
export function resolveHttpMaxResponseBytes(config: unknown): number {
  const raw = (config as { maxResponseBytes?: unknown } | null)?.maxResponseBytes;
  const numeric = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_HTTP_MAX_RESPONSE_BYTES;
  return Math.min(HARD_CAP_HTTP_MAX_RESPONSE_BYTES, Math.floor(numeric));
}

export const integrationHttpRequestDefinition: ActionDefinition = {
  key: 'integration.http-request',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: {
    type: 'INLINE',
    schema: {
      type: 'object',
      properties: {
        headers: { type: 'object', title: 'Headers', description: 'HTTP headers as key/value pairs (e.g. Authorization). Values may reference stored secrets.' },
        maxResponseBytes: {
          type: 'number',
          title: 'Max response bytes',
          default: DEFAULT_HTTP_MAX_RESPONSE_BYTES,
          description: `Response size cap in bytes (default ${DEFAULT_HTTP_MAX_RESPONSE_BYTES}, hard cap ${HARD_CAP_HTTP_MAX_RESPONSE_BYTES}). Raise this for larger CSV downloads.`,
        },
      },
    },
  },
  inputSchema: {
    type: 'INLINE',
    schema: {
      type: 'object',
      properties: {
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], default: 'GET' },
        url: { type: 'string', format: 'uri' },
        body: { description: 'Request body (sent as JSON for non-GET methods).' },
      },
      required: ['url'],
    },
  },
  outputSchema: {
    type: 'INLINE',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'number', title: 'HTTP status code' },
        ok: { type: 'boolean', description: 'True when status is 200-299.' },
        body: { description: 'Parsed JSON body, or raw text when the response is not JSON.' },
      },
    },
  },
  executionTimeoutMs: 30000,
  idempotency: { guarantee: 'NONE' },
  cancellationSupport: 'SUPPORTED',
  sideEffectClass: 'WRITE_EXTERNAL',
  riskClass: 'HIGH',
  requiredCapabilities: ['integration.http'],
  requiredPermissions: [],
  secretReferenceFields: ['config.headers'],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['integration', 'http'],
};

const guardedFetch = createSsrfGuardedFetch();

export const integrationHttpRequestExecutor: ActionExecutor = {
  async execute(context, config, input) {
    const method = typeof (input as { method?: unknown })?.method === 'string' ? String((input as { method: string }).method).toUpperCase() : 'GET';
    if (!ALLOWED_METHODS.has(method)) {
      return { status: 'FAILED', errorCode: 'HTTP_METHOD_NOT_ALLOWED', errorClass: 'VALIDATION', safeMessage: `HTTP method "${method}" is not supported.` };
    }
    const urlInput = (input as { url?: unknown })?.url;
    if (typeof urlInput !== 'string' || urlInput.length === 0) {
      return { status: 'FAILED', errorCode: 'HTTP_URL_REQUIRED', errorClass: 'VALIDATION', safeMessage: 'input.url is required.' };
    }

    let validatedUrl: URL;
    try {
      validatedUrl = await validateMcpRemoteUrl(urlInput);
    } catch (error) {
      const safeMessage = error instanceof Error ? error.message : 'URL failed SSRF validation.';
      return { status: 'FAILED', errorCode: 'HTTP_URL_BLOCKED', errorClass: 'SSRF_BLOCKED', safeMessage };
    }

    const headers = (config as { headers?: unknown })?.headers;
    const body = (input as { body?: unknown })?.body;
    const maxResponseBytes = resolveHttpMaxResponseBytes(config);

    try {
      const response = await guardedFetch(validatedUrl, {
        method,
        headers: typeof headers === 'object' && headers !== null ? (headers as Record<string, string>) : undefined,
        body: body !== undefined && method !== 'GET' ? JSON.stringify(body) : undefined,
        signal: context.cancellationSignal,
      });

      const contentLength = response.headers.get('content-length');
      if (contentLength && Number(contentLength) > maxResponseBytes) {
        return { status: 'FAILED', errorCode: 'HTTP_RESPONSE_TOO_LARGE', errorClass: 'VALIDATION', safeMessage: `Response exceeds ${maxResponseBytes} byte limit.` };
      }
      const text = await response.text();
      if (text.length > maxResponseBytes) {
        return { status: 'FAILED', errorCode: 'HTTP_RESPONSE_TOO_LARGE', errorClass: 'VALIDATION', safeMessage: `Response exceeds ${maxResponseBytes} byte limit.` };
      }
      context.writeTraceMetadata({ type: 'HTTP_REQUEST_RESULT', payload: { status: response.status } });

      let parsedBody: unknown = text;
      try {
        parsedBody = JSON.parse(text);
      } catch {
        // non-JSON response body is returned as raw text
      }
      return {
        status: 'SUCCEEDED',
        output: { status: response.status, ok: response.ok, body: parsedBody as never },
      };
    } catch (error) {
      if (context.cancellationSignal.aborted) {
        return { status: 'FAILED', errorCode: 'HTTP_CANCELLED', errorClass: 'CANCELLED', safeMessage: 'Request was cancelled.' };
      }
      const safeMessage = error instanceof Error ? error.message : 'HTTP request failed.';
      return { status: 'FAILED', errorCode: 'HTTP_REQUEST_FAILED', errorClass: 'EXTERNAL_ERROR', safeMessage };
    }
  },
};
