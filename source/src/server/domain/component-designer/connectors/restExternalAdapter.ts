import type { DesignerConnectorQueryResult } from '../../../../domain/component-designer/dataConnectorTypes';
import {
  mapConnectorPayloadToQueryResult,
  selectConnectorDetailRecord,
} from '../../../../domain/component-designer/dataConnectorMapping';
import type { DesignerResponseMapping } from '../../../../domain/component-designer/types';
import {
  createSsrfGuardedFetch,
  validateMcpRemoteUrl,
} from '../../../services/ai/mcp/mcpUrlGuard';
import type { WorkspaceDataConnector } from '../../../../domain/component-designer/dataConnectorTypes';
import { HttpError } from '../../../errors/HttpError';

const guardedFetch = createSsrfGuardedFetch();
const MAX_RESPONSE_BYTES = 2_000_000;

export type RestExternalAdapterInput = {
  connector: WorkspaceDataConnector;
  path?: string;
  method?: string;
  query?: Record<string, string>;
  responseMapping?: DesignerResponseMapping;
  op?: 'list' | 'detail';
  primaryKey?: string;
  id?: string;
  /** Injectable for unit tests. */
  fetchImpl?: typeof fetch;
  validateUrl?: typeof validateMcpRemoteUrl;
};

const buildAuthHeaders = (connector: WorkspaceDataConnector): Record<string, string> => {
  const headers: Record<string, string> = { ...(connector.headers ?? {}) };
  const auth = connector.auth;
  if (auth?.kind === 'bearer' && auth.token.trim()) {
    headers.Authorization = `Bearer ${auth.token.trim()}`;
  } else if (auth?.kind === 'api-key-header' && auth.token.trim()) {
    headers[auth.headerName] = auth.token.trim();
  }
  return headers;
};

const joinUrl = (baseUrl: string, pathSuffix?: string): string => {
  const base = baseUrl.trim().replace(/\/+$/, '');
  const suffix = (pathSuffix ?? '').trim();
  if (!suffix) {
    return base;
  }
  if (/^https?:\/\//i.test(suffix)) {
    return suffix;
  }
  return `${base}/${suffix.replace(/^\/+/, '')}`;
};

export const runRestExternalAdapter = async (
  input: RestExternalAdapterInput,
): Promise<DesignerConnectorQueryResult> => {
  const baseUrl = input.connector.baseUrl?.trim();
  if (!baseUrl) {
    throw new HttpError(400, 'rest-external connector requires baseUrl.');
  }

  const pathSuffix = input.path?.trim() || input.connector.defaultPath?.trim() || '';
  const targetUrl = joinUrl(baseUrl, pathSuffix);
  const url = new URL(targetUrl);
  if (input.query) {
    for (const [key, value] of Object.entries(input.query)) {
      if (key.trim() && value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const validateUrl = input.validateUrl ?? validateMcpRemoteUrl;
  const fetchImpl = input.fetchImpl ?? guardedFetch;
  let validated: URL;
  try {
    validated = await validateUrl(url.toString());
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : 'URL failed SSRF validation.');
  }

  const method = (input.method ?? 'GET').toUpperCase();
  const response = await fetchImpl(validated, {
    method,
    headers: buildAuthHeaders(input.connector),
  });

  const contentLength = response.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
    throw new HttpError(502, 'External API response exceeds size limit.');
  }

  if (!response.ok) {
    throw new HttpError(502, `External API request failed (${response.status}).`);
  }

  const payload = await response.json() as unknown;
  const mapping = input.responseMapping ?? input.connector.responseMapping;
  const mapped = mapConnectorPayloadToQueryResult(payload, mapping);

  if (input.op === 'detail') {
    return selectConnectorDetailRecord(mapped, {
      primaryKey: input.primaryKey,
      id: input.id,
    });
  }

  return mapped;
};
