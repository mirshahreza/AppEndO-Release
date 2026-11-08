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

export type GraphqlAdapterInput = {
  connector: WorkspaceDataConnector;
  query?: string;
  variables?: Record<string, unknown>;
  responseMapping?: DesignerResponseMapping;
  op?: 'list' | 'detail';
  primaryKey?: string;
  id?: string;
  fetchImpl?: typeof fetch;
  validateUrl?: typeof validateMcpRemoteUrl;
};

const buildAuthHeaders = (connector: WorkspaceDataConnector): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(connector.headers ?? {}),
  };
  const auth = connector.auth;
  if (auth?.kind === 'bearer' && auth.token.trim()) {
    headers.Authorization = `Bearer ${auth.token.trim()}`;
  } else if (auth?.kind === 'api-key-header' && auth.token.trim()) {
    headers[auth.headerName] = auth.token.trim();
  }
  return headers;
};

const joinUrl = (baseUrl: string, graphqlPath?: string): string => {
  const base = baseUrl.trim().replace(/\/+$/, '');
  const suffix = (graphqlPath?.trim() || '/graphql').replace(/^\/+/, '');
  if (/^https?:\/\//i.test(suffix)) {
    return suffix;
  }
  return `${base}/${suffix}`;
};

export const runGraphqlAdapter = async (
  input: GraphqlAdapterInput,
): Promise<DesignerConnectorQueryResult> => {
  const baseUrl = input.connector.baseUrl?.trim();
  if (!baseUrl) {
    throw new HttpError(400, 'graphql connector requires baseUrl.');
  }

  const query = (input.query ?? input.connector.graphqlQuery ?? '').trim();
  if (!query) {
    throw new HttpError(400, 'GraphQL query is required on the connector or request.');
  }

  const targetUrl = joinUrl(baseUrl, input.connector.graphqlPath);
  const validateUrl = input.validateUrl ?? validateMcpRemoteUrl;
  const fetchImpl = input.fetchImpl ?? guardedFetch;

  let validated: URL;
  try {
    validated = await validateUrl(targetUrl);
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : 'URL failed SSRF validation.');
  }

  const response = await fetchImpl(validated, {
    method: 'POST',
    headers: buildAuthHeaders(input.connector),
    body: JSON.stringify({
      query,
      variables: input.variables ?? {},
    }),
  });

  const contentLength = response.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
    throw new HttpError(502, 'GraphQL response exceeds size limit.');
  }

  if (!response.ok) {
    throw new HttpError(502, `GraphQL request failed (${response.status}).`);
  }

  const payload = await response.json() as unknown;
  if (
    payload
    && typeof payload === 'object'
    && Array.isArray((payload as { errors?: unknown }).errors)
    && ((payload as { errors: unknown[] }).errors.length > 0)
  ) {
    const first = (payload as { errors: Array<{ message?: string }> }).errors[0];
    throw new HttpError(502, first?.message?.trim() || 'GraphQL response contained errors.');
  }

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
