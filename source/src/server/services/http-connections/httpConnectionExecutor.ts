import { createSsrfGuardedFetch, validateMcpRemoteUrl } from '../ai/mcp/mcpUrlGuard';
import { fillOpenApiPathParams } from '../../../shared/lib/openApiConnectorSpec';
import { HTTP_CONNECTION_VAULT_OWNER_TYPE, getHttpVaultSecret } from './httpConnectionVault';
import type { HttpConnectionRecord } from './httpConnectionStore';

const CALL_TIMEOUT_MS = 15000;
const MAX_RESPONSE_BYTES = 200_000;

const ssrfGuardedFetch = createSsrfGuardedFetch();

export type HttpConnectionCallInput = {
  operationId: string;
  pathParams?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
};

export type HttpConnectionCallResult = {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  truncated: boolean;
};

/**
 * Every call is restricted to an operation already present in the connection's imported OpenAPI
 * spec — this IS the "allowlist" PDK-8 requires in place of raw sandbox network access. There is
 * no code path that lets a caller supply an arbitrary URL/path directly.
 */
export async function callHttpConnection(
  connection: HttpConnectionRecord,
  input: HttpConnectionCallInput,
): Promise<HttpConnectionCallResult> {
  const operation = connection.openApiSpec?.operations.find((entry) => entry.operationId === input.operationId);
  if (!operation) {
    throw new Error(`Operation "${input.operationId}" is not part of this connection's imported OpenAPI spec.`);
  }

  const path = fillOpenApiPathParams(operation.path, input.pathParams);
  const baseUrl = connection.baseUrl.replace(/\/+$/, '');
  const fullUrlString = `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;

  const url = await validateMcpRemoteUrl(fullUrlString);
  if (input.query) {
    for (const [key, value] of Object.entries(input.query)) {
      url.searchParams.set(key, value);
    }
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  const secret = connection.hasSecret
    ? await getHttpVaultSecret(HTTP_CONNECTION_VAULT_OWNER_TYPE, connection.id)
    : null;
  if (connection.authKind === 'apiKey' && connection.apiKeyHeaderName && secret) {
    headers[connection.apiKeyHeaderName] = secret;
  } else if (connection.authKind === 'bearer' && secret) {
    headers.Authorization = `Bearer ${secret}`;
  } else if (connection.authKind === 'basic' && connection.basicUsername && secret) {
    headers.Authorization = `Basic ${Buffer.from(`${connection.basicUsername}:${secret}`).toString('base64')}`;
  }

  const hasBody = input.body !== undefined && !['GET', 'DELETE'].includes(operation.method);
  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);
  try {
    const response = await ssrfGuardedFetch(url, {
      method: operation.method,
      headers,
      body: hasBody ? JSON.stringify(input.body) : undefined,
      signal: controller.signal,
    });

    const rawText = await response.text();
    const truncated = rawText.length > MAX_RESPONSE_BYTES;
    const text = truncated ? rawText.slice(0, MAX_RESPONSE_BYTES) : rawText;
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      // Non-JSON response — return as plain text.
    }

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return { status: response.status, headers: responseHeaders, body, truncated };
  } finally {
    clearTimeout(timeout);
  }
}
