import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  mapApiFunction,
  mapSystemFunction,
  mergeFunctionsCatalog,
} from '../contracts/server-functions/mappers';
import type {
  CreateServerFunctionPayload,
  ServerFunctionsCatalog,
  ExecuteServerFunctionInput,
  UpdateServerFunctionPayload,
  UpdatePackageServerFunctionPayload,
  UpdateBuiltinFunctionMetadataPayload,
} from '../contracts/server-functions/payloads';
import { getActiveSourceLanguage } from '../contracts/server-functions/templates';
import type { ServerFunctionItem } from '../contracts/server-functions/types';
import type { UnusedServerFunctionEntry } from '../contracts/server-functions/unused';
import { isDataApiManagedFunction } from '../contracts/server-functions/dataApiRuntime';
import { apiDelete, apiFetch, apiGet, apiPost, apiPut, isAbortError, type ApiListResponse, type ApiMutationResponse } from '../client';

export type {
  CreateServerFunctionPayload,
  ServerFunctionsCatalog,
  ExecuteServerFunctionInput,
  UpdateServerFunctionPayload,
  UpdatePackageServerFunctionPayload,
  UpdateBuiltinFunctionMetadataPayload,
};

export const serverFunctionsQueryKeys = {
  all: ['server-functions'] as const,
  catalog: () => [...serverFunctionsQueryKeys.all, 'catalog'] as const,
  unusedCatalog: () => [...serverFunctionsQueryKeys.all, 'unused-catalog'] as const,
  draft: (id: string) => [...serverFunctionsQueryKeys.all, 'draft', id] as const,
};

const invalidateServerFunctionDependentQueries = (
  queryClient: ReturnType<typeof useQueryClient>,
) => {
  void queryClient.invalidateQueries({
    queryKey: serverFunctionsQueryKeys.catalog(),
    refetchType: 'all',
  });
  void queryClient.invalidateQueries({
    queryKey: serverFunctionsQueryKeys.unusedCatalog(),
  });
  void queryClient.invalidateQueries({ queryKey: ['function-entity-access'] });
};

export type ServerFunctionDraft = Partial<ServerFunctionItem>;

export async function fetchServerFunctionsCatalog(signal?: AbortSignal): Promise<ServerFunctionsCatalog> {
  const [systemRes, customRes] = await Promise.all([
    apiGet<ApiListResponse>('/api/functions/system', { signal }),
    apiGet<ApiListResponse>('/api/functions', { signal }),
  ]);

  const systemJson = systemRes.data;
  const customJson = customRes.data;

  const discoveredSystemFunctions = Array.isArray(systemJson?.items)
    ? systemJson.items.map((item) => mapSystemFunction(item as Record<string, unknown>))
    : [];

  const customFunctions = Array.isArray(customJson?.items)
    ? customJson.items.map((item) => mapApiFunction(item as Record<string, unknown>))
    : [];

  const functions = mergeFunctionsCatalog(discoveredSystemFunctions, customFunctions);

  return {
    functions,
    systemError: systemRes.response.ok
      ? null
      : (typeof systemJson?.error === 'string' ? systemJson.error : 'Failed to discover all system routes.'),
    customError: customRes.response.ok
      ? null
      : (typeof customJson?.error === 'string' ? customJson.error : 'Failed to load user-defined functions from API.'),
  };
}

export async function fetchUnusedServerFunctions(): Promise<UnusedServerFunctionEntry[]> {
  const { data, response } = await apiGet<{
    success: boolean;
    functions?: UnusedServerFunctionEntry[];
    error?: string;
  }>('/api/core/server-functions/catalog/unused');
  if (!response.ok || !data.success || !data.functions) {
    throw new Error(data.error || 'Failed to load unused server functions.');
  }
  return data.functions;
}

export function useUnusedServerFunctionsQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: serverFunctionsQueryKeys.unusedCatalog(),
    queryFn: () => fetchUnusedServerFunctions(),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

const asPayloadRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

const applyRouteParams = (path: string, params: Record<string, unknown>): string => (
  path.replace(/:([a-zA-Z0-9_]+)/g, (_match, key: string) => {
    const raw = params[key];
    return raw === undefined || raw === null ? `:${key}` : encodeURIComponent(String(raw));
  })
);

const extractPathParamNames = (path: string): string[] => (
  [...path.matchAll(/:([a-zA-Z0-9_]+)/g)].map((match) => match[1])
);

const buildManagedRouteUrl = (
  path: string,
  method: string,
  params: Record<string, unknown>,
  query: Record<string, unknown>,
): string => {
  const pathParamNames = new Set(extractPathParamNames(path));
  const mergedQuery: Record<string, unknown> = { ...query };

  if (method === 'GET') {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || pathParamNames.has(key)) {
        continue;
      }
      mergedQuery[key] = value;
    }
  }

  const requestPath = applyRouteParams(path, params);
  return `${requestPath}${buildQueryString(Object.keys(mergedQuery).length > 0 ? mergedQuery : null)}`;
};

const buildQueryString = (query: Record<string, unknown> | null): string => {
  if (!query) {
    return '';
  }

  const searchParams = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    searchParams.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  });

  const serialized = searchParams.toString();
  return serialized ? `?${serialized}` : '';
};

const readFetchJsonResponse = async (
  response: Response,
): Promise<Record<string, unknown>> => {
  const raw = await response.text();
  if (!raw.trim()) {
    return {
      success: response.ok,
      _httpStatus: response.status,
      status: response.status,
      statusText: response.statusText,
    };
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      ...parsed,
      _httpStatus: response.status,
    };
  } catch {
    return {
      success: false,
      _httpStatus: response.status,
      status: response.status,
      statusText: response.statusText,
      error: 'Response body is not JSON.',
      rawBody: raw.slice(0, 500),
    };
  }
};

const buildManagedRouteRequestBody = (
  method: string,
  payload: Record<string, unknown>,
): string | undefined => {
  if (method === 'GET') {
    return undefined;
  }

  const hasStructuredBody = payload.body !== undefined;
  const bodyPayload = hasStructuredBody
    ? payload.body
    : Object.fromEntries(
        Object.entries(payload).filter(([key]) => key !== 'query' && key !== 'params'),
      );
  return JSON.stringify(bodyPayload || {});
};

const invokeManagedRoute = async (input: {
  path: string;
  method: string;
  payload: Record<string, unknown>;
}): Promise<{ response: Response; data: Record<string, unknown> }> => {
  const params = asPayloadRecord(input.payload.params);
  const query = asPayloadRecord(input.payload.query);
  const finalUrl = buildManagedRouteUrl(input.path, input.method, params, query);

  const requestInit: RequestInit = {
    method: input.method,
    credentials: 'include',
  };

  const requestBody = buildManagedRouteRequestBody(input.method, input.payload);
  if (requestBody !== undefined) {
    requestInit.headers = { 'Content-Type': 'application/json' };
    requestInit.body = requestBody;
  }

  const response = await apiFetch(finalUrl, requestInit);
  const data = await readFetchJsonResponse(response);
  return { response, data };
};

const finalizeExecuteResponse = (
  data: Record<string, unknown>,
  response: Response,
): Record<string, unknown> => {
  const enriched: Record<string, unknown> = {
    ...data,
    _httpStatus: data._httpStatus ?? response.status,
  };

  if (response.status === 403) {
    enriched.error = (typeof enriched.error === 'string' ? enriched.error : undefined)
      ?? 'Forbidden: insufficient permissions to execute this route.';
  } else if (!response.ok && !enriched.error) {
    enriched.error = `Request failed with status ${response.status}`;
  }

  return enriched;
};

export async function executeServerFunctionRequest(input: ExecuteServerFunctionInput): Promise<{
  data: Record<string, unknown>;
  response: Response;
}> {
  const {
    activeFn,
    parsedPayload,
    vmMode,
    runRam,
    runTimeout,
    requestMethod,
  } = input;

  const resolvedRequestMethod = requestMethod ?? activeFn.method;
  const payload = asPayloadRecord(parsedPayload);
  const usesManagedDataApiRoute = isDataApiManagedFunction(activeFn);
  const shouldUseManagedRoute = Boolean(activeFn.isBuiltIn || usesManagedDataApiRoute);

  let response: Response;
  let data: Record<string, unknown>;

  if (shouldUseManagedRoute) {
    const managedResult = await invokeManagedRoute({
      path: activeFn.path,
      method: resolvedRequestMethod,
      payload,
    });
    response = managedResult.response;
    data = managedResult.data;
  } else {
    const result = await apiPost<ApiMutationResponse>('/api/core/server-functions/execute', {
      code: activeFn.code,
      language: getActiveSourceLanguage(activeFn.language),
      runtimeVersion: vmMode,
      memoryLimit: runRam,
      timeoutMs: runTimeout,
      engineType: activeFn.engineType,
      metadataJson: activeFn.metadataJson,
      functionId: activeFn.id,
      edgeCache: {
        enabled: Boolean(activeFn.cacheEnabled),
        requestMethod: resolvedRequestMethod,
        ttlMs: activeFn.cacheTtlMs,
        byParam: Boolean(activeFn.cacheByParam),
        byUser: Boolean(activeFn.cacheByUser),
        keyNamespace: `${resolvedRequestMethod}:${activeFn.path}`,
        requestParams: payload.params,
        requestQuery: payload.query,
      },
      ...payload,
    });
    response = result.response;
    data = {
      ...(result.data as Record<string, unknown>),
      _httpStatus: result.response.status,
    };
  }

  return {
    data: finalizeExecuteResponse(data, response),
    response,
  };
}

export async function invokeAuthenticatedApiRoute(input: {
  path: string;
  method: string;
  payload: Record<string, unknown>;
}): Promise<{ data: Record<string, unknown>; response: Response }> {
  const result = await invokeManagedRoute({
    path: input.path,
    method: input.method,
    payload: input.payload,
  });

  return {
    data: finalizeExecuteResponse(result.data, result.response),
    response: result.response,
  };
}

export function useServerFunctionsCatalogQuery(enabled = true) {
  return useQuery({
    queryKey: serverFunctionsQueryKeys.catalog(),
    queryFn: ({ signal }) => fetchServerFunctionsCatalog(signal),
    enabled,
    retry: (failureCount, error) => (
      isAbortError(error)
        ? failureCount < 2
        : failureCount < 1
    ),
  });
}

export function useCreateServerFunctionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateServerFunctionPayload) => apiPost<ApiMutationResponse & { id?: string | number }>('/api/functions', payload),
    onSuccess: ({ data }) => {
      if (data.success) {
        invalidateServerFunctionDependentQueries(queryClient);
      }
    },
  });
}

export function useUpdateBuiltinServerFunctionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateBuiltinFunctionMetadataPayload }) =>
      apiPut<ApiMutationResponse>(`/api/functions/builtin/${encodeURIComponent(id)}`, payload),
    onSuccess: ({ data }, { id }) => {
      if (data.success) {
        queryClient.removeQueries({ queryKey: serverFunctionsQueryKeys.draft(id), exact: true });
        invalidateServerFunctionDependentQueries(queryClient);
      }
    },
  });
}

export function useUpdatePackageServerFunctionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdatePackageServerFunctionPayload }) =>
      apiPut<ApiMutationResponse>(`/api/functions/package/${encodeURIComponent(id)}`, payload),
    onSuccess: ({ data }, { id }) => {
      if (data.success) {
        queryClient.removeQueries({ queryKey: serverFunctionsQueryKeys.draft(id), exact: true });
        invalidateServerFunctionDependentQueries(queryClient);
      }
    },
  });
}

export function useUpdateServerFunctionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateServerFunctionPayload }) =>
      apiPut<ApiMutationResponse>(`/api/functions/${encodeURIComponent(id)}`, payload),
    onSuccess: ({ data }, { id }) => {
      if (data.success) {
        queryClient.removeQueries({ queryKey: serverFunctionsQueryKeys.draft(id), exact: true });
        invalidateServerFunctionDependentQueries(queryClient);
      }
    },
  });
}

export function useDeleteServerFunctionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<ApiMutationResponse>(`/api/functions/${encodeURIComponent(id)}`),
    onSuccess: ({ data }, id) => {
      if (data.success) {
        queryClient.removeQueries({ queryKey: serverFunctionsQueryKeys.draft(id), exact: true });
        invalidateServerFunctionDependentQueries(queryClient);
      }
    },
  });
}

export function useExecuteServerFunctionMutation() {
  return useMutation({
    mutationFn: executeServerFunctionRequest,
  });
}
