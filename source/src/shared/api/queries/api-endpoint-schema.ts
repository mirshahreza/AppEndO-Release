import { useQuery } from '@tanstack/react-query';
import { apiGet, isAbortError } from '../client';
import {
  mergeEndpointFieldNames,
  resolveEndpointFormFieldsFromOpenApi,
  resolveEndpointPathFromOpenApi,
  resolveEndpointResponseFieldsFromOpenApi,
  resolveEndpointResponseFormFieldsFromOpenApi,
  resolveRowFieldNamesFromApiPayload,
  responseFieldNamesToFormFields,
  type ApiFormField,
} from '../../../domain/component-designer/apiFieldSchema';

/** Raw OpenAPI document returned for a single managed function route. */
export type ApiEndpointOpenApiSpec = Record<string, unknown>;

export type FetchEndpointFieldsOptions = {
  endpointPath?: string;
  signal?: AbortSignal;
  /** Forces server OpenAPI caches to rebuild before reading the route spec. */
  refreshOpenApi?: boolean;
};

export const apiEndpointSchemaQueryKeys = {
  all: ['api-endpoint-schema'] as const,
  spec: (functionId: string) => [...apiEndpointSchemaQueryKeys.all, functionId] as const,
};

export {
  resolveEndpointFormFieldsFromOpenApi,
  resolveEndpointResponseFieldsFromOpenApi,
  resolveEndpointResponseFormFieldsFromOpenApi,
};

export async function fetchApiEndpointOpenApi(
  functionId: string,
  options?: { signal?: AbortSignal; refresh?: boolean },
): Promise<ApiEndpointOpenApiSpec> {
  const query = new URLSearchParams();
  if (options?.refresh) {
    query.set('refresh', '1');
    query.set('t', String(Date.now()));
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  const { data } = await apiGet<ApiEndpointOpenApiSpec>(
    `/api/docs/routes/${encodeURIComponent(functionId)}/openapi.json${suffix}`,
    { signal: options?.signal },
  );
  return data;
}

export async function fetchLiveApiRowFieldNames(
  endpointPath: string,
  method: string,
  signal?: AbortSignal,
): Promise<string[]> {
  if (method.trim().toUpperCase() !== 'GET') {
    return [];
  }

  const trimmed = endpointPath.trim().replace(/\/+$/, '');
  if (!trimmed.startsWith('/')) {
    return [];
  }

  const hasQuery = trimmed.includes('?');
  const path = hasQuery
    ? trimmed
    : `${trimmed}?limit=1&page=1`;

  const { data, response } = await apiGet<Record<string, unknown>>(path, { signal });
  if (!response.ok || !data || typeof data !== 'object') {
    return [];
  }

  return resolveRowFieldNamesFromApiPayload(data);
}

const enrichGetResponseFieldNames = async (
  spec: ApiEndpointOpenApiSpec,
  method: string,
  schemaFields: string[],
  options?: FetchEndpointFieldsOptions,
): Promise<string[]> => {
  if (method.trim().toUpperCase() !== 'GET') {
    return schemaFields;
  }

  const endpointPath = options?.endpointPath?.trim()
    || resolveEndpointPathFromOpenApi(spec, method);
  if (!endpointPath) {
    return schemaFields;
  }

  try {
    const liveFields = await fetchLiveApiRowFieldNames(endpointPath, method, options?.signal);
    return mergeEndpointFieldNames(schemaFields, liveFields);
  } catch {
    return schemaFields;
  }
};

export async function fetchEndpointFormFields(
  functionId: string,
  method: string,
  options?: FetchEndpointFieldsOptions,
): Promise<ApiFormField[]> {
  const spec = await fetchApiEndpointOpenApi(functionId, {
    signal: options?.signal,
    refresh: options?.refreshOpenApi,
  });
  const resolved = resolveEndpointFormFieldsFromOpenApi(spec, method);

  if (method.trim().toUpperCase() !== 'GET') {
    return resolved;
  }

  const schemaResponseFields = resolveEndpointResponseFieldsFromOpenApi(spec, method);
  const enrichedResponseFields = await enrichGetResponseFieldNames(
    spec,
    method,
    schemaResponseFields,
    options,
  );

  if (enrichedResponseFields.length <= resolved.length) {
    return resolved;
  }

  const enrichedFormFields = responseFieldNamesToFormFields(enrichedResponseFields, {
    excludeServerManaged: true,
  });

  return enrichedFormFields.length > resolved.length ? enrichedFormFields : resolved;
}

/** Row field names from a list/detail GET response schema (`data` object properties). */
export async function fetchEndpointResponseFields(
  functionId: string,
  method: string,
  options?: FetchEndpointFieldsOptions,
): Promise<string[]> {
  const spec = await fetchApiEndpointOpenApi(functionId, {
    signal: options?.signal,
    refresh: options?.refreshOpenApi,
  });
  const schemaFields = resolveEndpointResponseFieldsFromOpenApi(spec, method);
  return enrichGetResponseFieldNames(spec, method, schemaFields, options);
}

/**
 * Fetches the OpenAPI spec for a single endpoint so the auto-form wizard can read
 * its request fields. Disabled until a `functionId` is provided.
 */
export function useApiEndpointSchemaQuery(
  functionId: string | null | undefined,
  options?: { refresh?: boolean },
) {
  return useQuery({
    queryKey: [...apiEndpointSchemaQueryKeys.spec(functionId ?? ''), options?.refresh ? 'refresh' : 'cached'] as const,
    queryFn: ({ signal }) => fetchApiEndpointOpenApi(functionId as string, {
      signal,
      refresh: options?.refresh,
    }),
    enabled: Boolean(functionId && functionId.trim()),
    staleTime: options?.refresh ? 0 : 60_000,
    retry: (failureCount, error) => (
      isAbortError(error)
        ? failureCount < 2
        : failureCount < 1
    ),
  });
}
