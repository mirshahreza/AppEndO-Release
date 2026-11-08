import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  ConnectivityTestResult,
  DataSourceRecord,
  SaveDataSourcePayload,
  TestAllConnectivityResult,
  TestDraftDataSourcePayload,
  UpdateDataSourcePayload,
} from '../contracts/data-sources/types';
import {
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  formatApiErrorMessage,
  isAbortError,
  isApiError,
  type ApiListResponse,
  type ApiMutationResponse,
  apiRequest,
} from '../client';
import type { DataSourcesListQuery } from '../contracts/data-sources/listQuery';
import type { CreateSchemaObjectInput } from '../contracts/data-sources/createSchemaObject';
import type { DeleteSchemaObjectInput } from '../contracts/data-sources/deleteSchemaObject';
import type {
  AddForeignKeyConstraintInput,
  DropForeignKeyConstraintInput,
} from '../contracts/data-sources/foreignKeyConstraint';
import type { TruncateSchemaObjectInput } from '../contracts/data-sources/truncateSchemaObject';
import type { SchemaObjectDefinitionQuery, UpdateSchemaObjectDefinitionInput } from '../contracts/data-sources/schemaObjectDefinition';
import type { ExecuteDataSourceQueryInput, ExecuteDataSourceQueryResult } from '../contracts/data-sources/executeQuery';
import type { SchemaObjectDeletePreview } from '../contracts/data-sources/deleteSchemaObjectPreview';
import type { SchemaObjectDependencies } from '../contracts/data-sources/schemaObjectDependencies';
import {
  normalizeSchemaObjectListItems,
  type SchemaObjectListItem,
} from '../contracts/data-sources/schemaObjects';
import type { SchemaRelationsSnapshot } from '../contracts/data-sources/schemaRelations';

const EDGE_FUNCTIONS_CATALOG_QUERY_KEY = ['server-functions', 'catalog'] as const;

export type {
  ConnectivityTestResult,
  DataSourceRecord,
  SaveDataSourcePayload,
  TestAllConnectivityResult,
  TestDraftDataSourcePayload,
  UpdateDataSourcePayload,
};

export type DataSourcesListData = {
  items: DataSourceRecord[];
  error: string | null;
};

export const dataSourcesQueryKeys = {
  all: ['data-sources'] as const,
  list: () => [...dataSourcesQueryKeys.all, 'list'] as const,
  schemaObjects: (dataSourceId: string, objectType: string) => (
    [...dataSourcesQueryKeys.all, 'schema-objects', dataSourceId, objectType] as const
  ),
  objectFields: (dataSourceId: string, objectType: string, objectName: string) => (
    [...dataSourcesQueryKeys.all, 'object-fields', dataSourceId, objectType, objectName] as const
  ),
  objectRelations: (dataSourceId: string, objectType: string, objectName: string) => (
    [...dataSourcesQueryKeys.all, 'object-relations', dataSourceId, objectType, objectName] as const
  ),
  deletePreview: (
    dataSourceId: string,
    objectType: string,
    objectName: string,
    functionKind?: string,
  ) => (
    [...dataSourcesQueryKeys.all, 'delete-preview', dataSourceId, objectType, objectName, functionKind ?? 'all'] as const
  ),
  objectDefinition: (
    dataSourceId: string,
    objectType: string,
    objectName: string,
    functionKind?: string,
  ) => (
    [...dataSourcesQueryKeys.all, 'object-definition', dataSourceId, objectType, objectName, functionKind ?? 'all'] as const
  ),
  objectDependencies: (
    dataSourceId: string,
    objectType: string,
    objectName: string,
    functionKind?: string,
  ) => (
    [...dataSourcesQueryKeys.all, 'object-dependencies', dataSourceId, objectType, objectName, functionKind ?? 'all'] as const
  ),
};

const invalidateDataSourceQueries = (queryClient: QueryClient) => {
  void queryClient.invalidateQueries({ queryKey: dataSourcesQueryKeys.all });
  void queryClient.invalidateQueries({ queryKey: EDGE_FUNCTIONS_CATALOG_QUERY_KEY });
};

export async function fetchDataSourcesList(
  query: DataSourcesListQuery = {},
  signal?: AbortSignal,
): Promise<DataSourcesListData> {
  try {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value != null && String(value).trim() !== '') {
        params.set(key, String(value));
      }
    });
    const queryString = params.toString();
    const url = queryString ? `/api/data-sources?${queryString}` : '/api/data-sources';
    const { data, response } = await apiGet<ApiListResponse<DataSourceRecord>>(url, { signal });

    if (!response.ok) {
      return {
        items: [],
        error: typeof data.error === 'string'
          ? data.error
          : `Failed to load data sources (HTTP ${response.status}).`,
      };
    }

    if (!data.success) {
      return {
        items: [],
        error: typeof data.error === 'string' ? data.error : 'Failed to load data sources.',
      };
    }

    return {
      items: (data.items ?? []) as DataSourceRecord[],
      error: null,
    };
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    return {
      items: [],
      error: isApiError(error)
        ? formatApiErrorMessage(error)
        : 'Network error — could not load data sources.',
    };
  }
}

export const dataSourcesListQueryOptions = {
  queryKey: dataSourcesQueryKeys.list(),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchDataSourcesList({}, signal),
  staleTime: 30_000,
};

export function useDataSourcesQuery(options?: { enabled?: boolean }) {
  return useQuery({
    ...dataSourcesListQueryOptions,
    enabled: options?.enabled ?? true,
  });
}

export function useCreateDataSourceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SaveDataSourcePayload) => apiPost<ApiMutationResponse>('/api/data-sources', payload),
    onSuccess: ({ data }) => {
      if (data.success) {
        invalidateDataSourceQueries(queryClient);
      }
    },
  });
}

export function useUpdateDataSourceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateDataSourcePayload }) =>
      apiPut<ApiMutationResponse>(`/api/data-sources/${encodeURIComponent(id)}`, payload),
    onSuccess: ({ data }) => {
      if (data.success) {
        invalidateDataSourceQueries(queryClient);
      }
    },
  });
}

export function useDeleteDataSourceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiDelete<ApiMutationResponse>(`/api/data-sources/${encodeURIComponent(id)}`),
    onSuccess: ({ data }) => {
      if (data.success) {
        invalidateDataSourceQueries(queryClient);
      }
    },
  });
}

export async function requestTestDataSourceById(id: string, signal: AbortSignal) {
  return apiRequest<ConnectivityTestResult & ApiMutationResponse>(
    `/api/data-sources/${encodeURIComponent(id)}/test`,
    { method: 'POST', signal },
  );
}

export async function requestTestDataSourceDraft(payload: TestDraftDataSourcePayload, signal: AbortSignal) {
  return apiRequest<ConnectivityTestResult & ApiMutationResponse>('/api/data-sources/test-draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
}

export async function requestTestAllDataSources(signal: AbortSignal) {
  return apiRequest<TestAllConnectivityResult & ApiMutationResponse>('/api/data-sources/test-all', {
    method: 'POST',
    signal,
  });
}

export type SchemaObjectType = 'TABLE' | 'VIEW' | 'PROCEDURE' | 'FUNCTION';
export type SchemaFunctionKind = 'SCALAR' | 'TABLE_VALUED';

const SCHEMA_OBJECT_TYPES: SchemaObjectType[] = ['TABLE', 'VIEW', 'PROCEDURE', 'FUNCTION'];

const EMPTY_SCHEMA_CATALOG: Record<SchemaObjectType, string[]> = {
  TABLE: [],
  VIEW: [],
  PROCEDURE: [],
  FUNCTION: [],
};

const SCHEMA_CATALOG_ENDPOINTS = (dataSourceId: string) => [
  `/api/data-sources/schema-catalog?dataSourceId=${encodeURIComponent(dataSourceId)}`,
  `/api/data-sources/schema/catalog?dataSourceId=${encodeURIComponent(dataSourceId)}`,
];

const SCHEMA_OBJECTS_ENDPOINTS = (
  dataSourceId: string,
  objectType: SchemaObjectType,
  functionKind?: SchemaFunctionKind,
) => {
  const params = new URLSearchParams({ dataSourceId, objectType });
  if (functionKind) {
    params.set('functionKind', functionKind);
  }
  const query = params.toString();
  return [
    `/api/data-sources/objects?${query}`,
    `/api/data-sources/schema/objects?${query}`,
  ];
};

const SCHEMA_RELATIONS_ENDPOINTS = (
  dataSourceId: string,
  objectType: 'TABLE' | 'VIEW',
  objectName: string,
) => [
  `/api/data-sources/relations?${new URLSearchParams({ dataSourceId, objectType, objectName }).toString()}`,
  `/api/data-sources/schema/relations?${new URLSearchParams({ dataSourceId, objectType, objectName }).toString()}`,
];

const SCHEMA_FIELDS_ENDPOINTS = (
  dataSourceId: string,
  objectType: SchemaObjectType,
  objectName: string,
) => [
  `/api/data-sources/fields?${new URLSearchParams({ dataSourceId, objectType, objectName }).toString()}`,
  `/api/data-sources/schema/fields?${new URLSearchParams({ dataSourceId, objectType, objectName }).toString()}`,
];

const SCHEMA_DELETE_PREVIEW_ENDPOINTS = (
  dataSourceId: string,
  objectType: SchemaObjectType,
  objectName: string,
  functionKind?: SchemaFunctionKind,
) => {
  const params = new URLSearchParams({ dataSourceId, objectType, objectName });
  if (functionKind) {
    params.set('functionKind', functionKind);
  }
  const query = params.toString();
  return [
    `/api/data-sources/objects/delete-preview?${query}`,
    `/api/data-sources/schema/objects/delete-preview?${query}`,
  ];
};

const SCHEMA_DEFINITION_ENDPOINTS = (
  dataSourceId: string,
  objectType: SchemaObjectType,
  objectName: string,
  functionKind?: SchemaFunctionKind,
) => {
  const params = new URLSearchParams({ dataSourceId, objectType, objectName });
  if (functionKind) {
    params.set('functionKind', functionKind);
  }
  const query = params.toString();
  return [
    `/api/data-sources/objects/definition?${query}`,
    `/api/data-sources/schema/objects/definition?${query}`,
  ];
};

const SCHEMA_DEPENDENCIES_ENDPOINTS = (
  dataSourceId: string,
  objectType: SchemaObjectType,
  objectName: string,
  functionKind?: SchemaFunctionKind,
) => {
  const params = new URLSearchParams({ dataSourceId, objectType, objectName });
  if (functionKind) {
    params.set('functionKind', functionKind);
  }
  const query = params.toString();
  return [
    `/api/data-sources/objects/dependencies?${query}`,
    `/api/data-sources/schema/objects/dependencies?${query}`,
  ];
};

const normalizeSchemaCatalog = (
  catalog: unknown,
): Record<SchemaObjectType, string[]> => {
  const next = { ...EMPTY_SCHEMA_CATALOG };
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
    return next;
  }

  for (const objectType of SCHEMA_OBJECT_TYPES) {
    const items = (catalog as Record<string, unknown>)[objectType];
    next[objectType] = Array.isArray(items)
      ? items.filter((item): item is string => typeof item === 'string')
      : [];
  }

  return next;
};

const readApiListError = (
  data: ApiListResponse<unknown>,
  response: Response,
  fallback: string,
): string => (
  typeof data.error === 'string'
    ? data.error
    : `Failed to load schema data (HTTP ${response.status}).`
);

export type { SchemaObjectListItem } from '../contracts/data-sources/schemaObjects';

export type SchemaFieldInfo = {
  name: string;
  dataType: string;
  suggestedFieldType: 'string' | 'number' | 'integer' | 'boolean';
  nullable: boolean;
  isPrimaryKey: boolean;
};

export async function fetchDataSourceSchemaObjects(
  dataSourceId: string,
  objectType: SchemaObjectType,
  functionKind?: SchemaFunctionKind,
): Promise<{ items: SchemaObjectListItem[]; error: string | null }> {
  try {
    for (const endpoint of SCHEMA_OBJECTS_ENDPOINTS(dataSourceId, objectType, functionKind)) {
      const { data, response } = await apiGet<ApiListResponse<SchemaObjectListItem>>(endpoint);

      if (response.status === 404) {
        continue;
      }

      if (!response.ok || !data.success) {
        return {
          items: [],
          error: readApiListError(data, response, 'Failed to load schema objects.'),
        };
      }

      const items = normalizeSchemaObjectListItems(data.items);

      return { items, error: null };
    }

    return {
      items: [],
      error: 'Schema introspection API is unavailable. Restart the dev server (npm run restart) and reload the page.',
    };
  } catch (error) {
    return {
      items: [],
      error: isApiError(error)
        ? formatApiErrorMessage(error)
        : 'Network error — could not load schema objects.',
    };
  }
}

export async function fetchDataSourceSchemaCatalog(
  dataSourceId: string,
): Promise<{ objectsByType: Record<SchemaObjectType, string[]>; error: string | null }> {
  try {
    for (const endpoint of SCHEMA_CATALOG_ENDPOINTS(dataSourceId)) {
      const { data, response } = await apiGet<ApiListResponse<string> & {
        catalog?: Record<string, string[]>;
      }>(endpoint);

      if (response.status === 404) {
        continue;
      }

      if (!response.ok || !data.success) {
        return {
          objectsByType: { ...EMPTY_SCHEMA_CATALOG },
          error: readApiListError(data, response, 'Failed to load schema catalog.'),
        };
      }

      if (data.catalog) {
        return {
          objectsByType: normalizeSchemaCatalog(data.catalog),
          error: null,
        };
      }
    }

    const perTypeResults = await Promise.all(
      SCHEMA_OBJECT_TYPES.map((objectType) => fetchDataSourceSchemaObjects(dataSourceId, objectType)),
    );
    const firstError = perTypeResults.find((result) => result.error)?.error ?? null;
    if (firstError) {
      return {
        objectsByType: { ...EMPTY_SCHEMA_CATALOG },
        error: firstError,
      };
    }

    const objectsByType = { ...EMPTY_SCHEMA_CATALOG };
    SCHEMA_OBJECT_TYPES.forEach((objectType, index) => {
      objectsByType[objectType] = (perTypeResults[index]?.items ?? []).map((item) => item.name);
    });

    return { objectsByType, error: null };
  } catch (error) {
    return {
      objectsByType: { ...EMPTY_SCHEMA_CATALOG },
      error: isApiError(error)
        ? formatApiErrorMessage(error)
        : 'Network error — could not load schema catalog.',
    };
  }
}

export function useDataSourceSchemaObjectsQuery(
  dataSourceId: string,
  objectType: SchemaObjectType,
  functionKind?: SchemaFunctionKind,
) {
  return useQuery({
    queryKey: [...dataSourcesQueryKeys.schemaObjects(dataSourceId, objectType), functionKind ?? 'all', 'v2'],
    queryFn: () => fetchDataSourceSchemaObjects(dataSourceId, objectType, functionKind),
    enabled: Boolean(dataSourceId) && Boolean(objectType),
    staleTime: 30_000,
  });
}

export function useDataSourceSchemaCatalogQuery(dataSourceId: string, enabled = true) {
  const query = useQuery({
    queryKey: [...dataSourcesQueryKeys.all, 'schema-catalog', dataSourceId] as const,
    queryFn: () => fetchDataSourceSchemaCatalog(dataSourceId),
    enabled: enabled && Boolean(dataSourceId),
    staleTime: 30_000,
  });

  return {
    objectsByType: query.data?.objectsByType ?? EMPTY_SCHEMA_CATALOG,
    isLoading: query.isLoading || query.isFetching,
    error: query.data?.error ?? (query.error instanceof Error ? query.error.message : null),
  };
}

export async function fetchDataSourceObjectFields(
  dataSourceId: string,
  objectType: SchemaObjectType,
  objectName: string,
): Promise<{ items: SchemaFieldInfo[]; error: string | null }> {
  try {
    for (const endpoint of SCHEMA_FIELDS_ENDPOINTS(dataSourceId, objectType, objectName)) {
      const { data, response } = await apiGet<ApiListResponse<SchemaFieldInfo>>(endpoint);

      if (response.status === 404) {
        continue;
      }

      if (!response.ok || !data.success) {
        return {
          items: [],
          error: readApiListError(data, response, 'Failed to load object fields.'),
        };
      }

      const items = Array.isArray(data.items)
        ? data.items.filter((item): item is SchemaFieldInfo => (
          Boolean(item)
          && typeof item === 'object'
          && typeof (item as SchemaFieldInfo).name === 'string'
        )).map((item) => ({
          ...item,
          isPrimaryKey: Boolean((item as SchemaFieldInfo).isPrimaryKey),
        }))
        : [];

      return { items, error: null };
    }

    return {
      items: [],
      error: 'Schema field introspection API is unavailable. Restart the dev server (npm run restart) and reload the page.',
    };
  } catch (error) {
    return {
      items: [],
      error: isApiError(error)
        ? formatApiErrorMessage(error)
        : 'Network error — could not load object fields.',
    };
  }
}

export function useDataSourceObjectFieldsQuery(
  dataSourceId: string,
  objectType: SchemaObjectType,
  objectName: string,
) {
  return useQuery({
    queryKey: dataSourcesQueryKeys.objectFields(dataSourceId, objectType, objectName),
    queryFn: () => fetchDataSourceObjectFields(dataSourceId, objectType, objectName),
    enabled: Boolean(dataSourceId) && Boolean(objectType) && Boolean(objectName),
    staleTime: 30_000,
  });
}

type SchemaDeletePreviewResponse = {
  success: boolean;
  preview?: SchemaObjectDeletePreview;
  error?: string;
};

export async function fetchSchemaObjectDeletePreview(
  dataSourceId: string,
  objectType: SchemaObjectType,
  objectName: string,
  functionKind?: SchemaFunctionKind,
): Promise<{ preview: SchemaObjectDeletePreview | null; error: string | null }> {
  try {
    for (const endpoint of SCHEMA_DELETE_PREVIEW_ENDPOINTS(dataSourceId, objectType, objectName, functionKind)) {
      const { data, response } = await apiGet<SchemaDeletePreviewResponse>(endpoint);

      if (response.status === 404) {
        continue;
      }

      if (!response.ok || !data.success || !data.preview) {
        return {
          preview: null,
          error: typeof data.error === 'string'
            ? data.error
            : `Failed to load delete preview (HTTP ${response.status}).`,
        };
      }

      return { preview: data.preview, error: null };
    }

    return {
      preview: null,
      error: 'Delete preview API is unavailable. Restart the dev server and reload the page.',
    };
  } catch (error) {
    return {
      preview: null,
      error: isApiError(error)
        ? formatApiErrorMessage(error)
        : 'Network error — could not load delete preview.',
    };
  }
}

export function useSchemaObjectDeletePreviewQuery(
  dataSourceId: string | null,
  objectType: SchemaObjectType | null,
  objectName: string | null,
  functionKind?: SchemaFunctionKind,
  enabled = true,
) {
  return useQuery({
    queryKey: dataSourcesQueryKeys.deletePreview(
      dataSourceId ?? '',
      objectType ?? 'TABLE',
      objectName ?? '',
      functionKind,
    ),
    queryFn: () => fetchSchemaObjectDeletePreview(
      dataSourceId ?? '',
      objectType ?? 'TABLE',
      objectName ?? '',
      functionKind,
    ),
    enabled: enabled
      && Boolean(dataSourceId)
      && Boolean(objectType)
      && Boolean(objectName),
  });
}

type SchemaRelationsResponse = {
  success: boolean;
  data?: SchemaRelationsSnapshot;
  error?: string;
};

export async function fetchDataSourceObjectRelations(
  dataSourceId: string,
  objectType: 'TABLE' | 'VIEW',
  objectName: string,
): Promise<{ data: SchemaRelationsSnapshot | null; error: string | null }> {
  try {
    for (const endpoint of SCHEMA_RELATIONS_ENDPOINTS(dataSourceId, objectType, objectName)) {
      const { data, response } = await apiGet<SchemaRelationsResponse>(endpoint);

      if (response.status === 404) {
        continue;
      }

      if (!response.ok || !data.success || !data.data) {
        return {
          data: null,
          error: typeof data.error === 'string'
            ? data.error
            : `Failed to load object relations (HTTP ${response.status}).`,
        };
      }

      return { data: data.data, error: null };
    }

    return {
      data: null,
      error: 'Schema relations API is unavailable. Restart the dev server and reload the page.',
    };
  } catch (error) {
    return {
      data: null,
      error: isApiError(error)
        ? formatApiErrorMessage(error)
        : 'Network error — could not load object relations.',
    };
  }
}

export function useDataSourceObjectRelationsQuery(
  dataSourceId: string,
  objectType: 'TABLE' | 'VIEW' | null,
  objectName: string,
  enabled = true,
) {
  return useQuery({
    queryKey: dataSourcesQueryKeys.objectRelations(dataSourceId, objectType ?? 'TABLE', objectName),
    queryFn: async () => {
      const result = await fetchDataSourceObjectRelations(
        dataSourceId,
        objectType ?? 'TABLE',
        objectName,
      );
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data;
    },
    enabled: enabled && Boolean(dataSourceId) && Boolean(objectType) && Boolean(objectName),
    staleTime: 30_000,
  });
}

export function useCreateSchemaObjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSchemaObjectInput) => {
      const { data, response } = await apiPost<ApiMutationResponse & {
        objectName?: string | null;
        objectType?: SchemaObjectType;
        functionKind?: SchemaFunctionKind | null;
      }>('/api/data-sources/schema/objects', input);
      if (!response.ok || !data.success) {
        throw new Error(data.error || `Failed to create schema object (HTTP ${response.status}).`);
      }
      return data;
    },
    onSuccess: () => {
      invalidateDataSourceQueries(queryClient);
    },
  });
}

export function useDeleteSchemaObjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: DeleteSchemaObjectInput) => {
      const { data, response } = await apiDelete<ApiMutationResponse & {
        objectName?: string;
        objectType?: SchemaObjectType;
        functionKind?: SchemaFunctionKind | null;
      }>('/api/data-sources/schema/objects', input);
      if (!response.ok || !data.success) {
        throw new Error(data.error || `Failed to delete schema object (HTTP ${response.status}).`);
      }
      return data;
    },
    onSuccess: () => {
      invalidateDataSourceQueries(queryClient);
      void queryClient.invalidateQueries({ queryKey: ['data-api', 'models'] });
    },
  });
}

export function useAddForeignKeyConstraintMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddForeignKeyConstraintInput) => {
      const endpoints = [
        '/api/data-sources/schema/foreign-keys',
        '/api/data-sources/foreign-keys',
      ];

      let lastError = 'Foreign-key API is unavailable. Restart the dev server and reload the page.';

      for (const endpoint of endpoints) {
        const { data, response } = await apiPost<ApiMutationResponse & {
          tableName?: string;
          constraintName?: string;
          columnName?: string;
          referencedTable?: string;
          referencedColumn?: string;
        }>(endpoint, input);

        if (response.status === 404) {
          continue;
        }

        if (!response.ok || !data.success) {
          throw new Error(data.error || `Failed to add foreign-key constraint (HTTP ${response.status}).`);
        }

        return data;
      }

      throw new Error(lastError);
    },
    onSuccess: (_data, variables) => {
      invalidateDataSourceQueries(queryClient);
      void queryClient.invalidateQueries({
        queryKey: dataSourcesQueryKeys.objectRelations(variables.dataSourceId, 'TABLE', variables.tableName),
      });
    },
  });
}

export function useDropForeignKeyConstraintMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: DropForeignKeyConstraintInput) => {
      const endpoints = [
        '/api/data-sources/schema/foreign-keys',
        '/api/data-sources/foreign-keys',
      ];

      let lastError = 'Foreign-key API is unavailable. Restart the dev server and reload the page.';

      for (const endpoint of endpoints) {
        const { data, response } = await apiDelete<ApiMutationResponse & {
          tableName?: string;
          constraintName?: string;
        }>(endpoint, input);

        if (response.status === 404) {
          continue;
        }

        if (!response.ok || !data.success) {
          throw new Error(data.error || `Failed to drop foreign-key constraint (HTTP ${response.status}).`);
        }

        return data;
      }

      throw new Error(lastError);
    },
    onSuccess: (_data, variables) => {
      invalidateDataSourceQueries(queryClient);
      void queryClient.invalidateQueries({
        queryKey: dataSourcesQueryKeys.objectRelations(variables.dataSourceId, 'TABLE', variables.tableName),
      });
    },
  });
}

export function useTruncateSchemaObjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: TruncateSchemaObjectInput) => {
      const endpoints = [
        '/api/data-sources/schema/objects/truncate',
        '/api/data-sources/objects/truncate',
      ];

      let lastError = 'Truncate API is unavailable. Restart the dev server and reload the page.';

      for (const endpoint of endpoints) {
        const { data, response } = await apiPost<ApiMutationResponse & {
          objectName?: string;
          objectType?: SchemaObjectType;
        }>(endpoint, input);

        if (response.status === 404) {
          continue;
        }

        if (!response.ok || !data.success) {
          throw new Error(data.error || `Failed to truncate table (HTTP ${response.status}).`);
        }

        return data;
      }

      throw new Error(lastError);
    },
    onSuccess: () => {
      invalidateDataSourceQueries(queryClient);
      // CMS / designer list UIs read through Data API GET caches — force client refetch too.
      void queryClient.invalidateQueries({ queryKey: ['data-api'] });
    },
  });
}

type SchemaObjectDefinitionResponse = {
  success: boolean;
  definition?: string;
  error?: string;
};

type SchemaObjectDependenciesResponse = {
  success: boolean;
  dependencies?: SchemaObjectDependencies;
  error?: string;
};

export async function fetchSchemaObjectDefinition(
  query: SchemaObjectDefinitionQuery,
): Promise<{ definition: string | null; error: string | null }> {
  const { dataSourceId, objectName, objectType, functionKind } = query;

  try {
    for (const endpoint of SCHEMA_DEFINITION_ENDPOINTS(dataSourceId, objectType, objectName, functionKind)) {
      const { data, response } = await apiGet<SchemaObjectDefinitionResponse>(endpoint);

      if (response.status === 404) {
        continue;
      }

      if (!response.ok || !data.success || typeof data.definition !== 'string') {
        return {
          definition: null,
          error: typeof data.error === 'string'
            ? data.error
            : `Failed to load object definition (HTTP ${response.status}).`,
        };
      }

      return { definition: data.definition, error: null };
    }

    return {
      definition: null,
      error: 'Object definition API is unavailable. Restart the dev server and reload the page.',
    };
  } catch (error) {
    return {
      definition: null,
      error: isApiError(error)
        ? formatApiErrorMessage(error)
        : 'Network error — could not load object definition.',
    };
  }
}

export function useSchemaObjectDefinitionQuery(
  query: SchemaObjectDefinitionQuery | null,
  enabled = true,
) {
  return useQuery({
    queryKey: dataSourcesQueryKeys.objectDefinition(
      query?.dataSourceId ?? '',
      query?.objectType ?? 'VIEW',
      query?.objectName ?? '',
      query?.functionKind,
    ),
    queryFn: async () => {
      if (!query) {
        throw new Error('Schema object definition query is required.');
      }
      const result = await fetchSchemaObjectDefinition(query);
      if (result.error || !result.definition) {
        throw new Error(result.error ?? 'Schema object definition was not found.');
      }
      return result.definition;
    },
    enabled: enabled
      && Boolean(query?.dataSourceId)
      && Boolean(query?.objectType)
      && Boolean(query?.objectName),
  });
}

export async function fetchSchemaObjectDependencies(
  dataSourceId: string,
  objectType: SchemaObjectType,
  objectName: string,
  functionKind?: SchemaFunctionKind,
): Promise<{ dependencies: SchemaObjectDependencies | null; error: string | null }> {
  try {
    for (const endpoint of SCHEMA_DEPENDENCIES_ENDPOINTS(
      dataSourceId,
      objectType,
      objectName,
      functionKind,
    )) {
      const { data, response } = await apiGet<SchemaObjectDependenciesResponse>(endpoint);

      if (response.status === 404) {
        continue;
      }

      if (!response.ok || !data.success || !data.dependencies) {
        return {
          dependencies: null,
          error: typeof data.error === 'string'
            ? data.error
            : `Failed to load object dependencies (HTTP ${response.status}).`,
        };
      }

      return { dependencies: data.dependencies, error: null };
    }

    return {
      dependencies: null,
      error: 'Object dependency API is unavailable. Restart the dev server and reload the page.',
    };
  } catch (error) {
    return {
      dependencies: null,
      error: isApiError(error)
        ? formatApiErrorMessage(error)
        : 'Network error — could not load object dependencies.',
    };
  }
}

export function useSchemaObjectDependenciesQuery(
  dataSourceId: string | null,
  objectType: SchemaObjectType | null,
  objectName: string | null,
  functionKind?: SchemaFunctionKind,
  enabled = true,
) {
  return useQuery({
    queryKey: dataSourcesQueryKeys.objectDependencies(
      dataSourceId ?? '',
      objectType ?? 'TABLE',
      objectName ?? '',
      functionKind,
    ),
    queryFn: async () => {
      if (!dataSourceId || !objectType || !objectName) {
        throw new Error('Schema object dependencies query is required.');
      }
      const result = await fetchSchemaObjectDependencies(
        dataSourceId,
        objectType,
        objectName,
        functionKind,
      );
      if (result.error || !result.dependencies) {
        throw new Error(result.error ?? 'Schema object dependencies were not found.');
      }
      return result.dependencies;
    },
    enabled: enabled && Boolean(dataSourceId) && Boolean(objectType) && Boolean(objectName),
  });
}

export function useUpdateSchemaObjectDefinitionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateSchemaObjectDefinitionInput) => {
      const { data, response } = await apiPut<ApiMutationResponse>('/api/data-sources/schema/objects/definition', input);
      if (!response.ok || !data.success) {
        throw new Error(data.error || `Failed to update schema object definition (HTTP ${response.status}).`);
      }
      return data;
    },
    onSuccess: () => {
      invalidateDataSourceQueries(queryClient);
      void queryClient.invalidateQueries({ queryKey: ['data-api', 'models'] });
    },
  });
}

type ExecuteDataSourceQueryResponse = {
  success: boolean;
  data?: unknown[];
  count?: number;
  truncated?: boolean;
  source?: ExecuteDataSourceQueryResult['source'];
  error?: string;
};

export async function executeDataSourceQuery(
  input: ExecuteDataSourceQueryInput,
): Promise<ExecuteDataSourceQueryResult> {
  const endpoints = [
    '/api/data-sources/query/execute',
    '/api/data-sources/schema/query/execute',
  ];

  let lastError = 'Query execution API is unavailable. Restart the dev server and reload the page.';

  for (const endpoint of endpoints) {
    const { data, response } = await apiPost<ExecuteDataSourceQueryResponse>(endpoint, input);

    if (response.status === 404) {
      continue;
    }

    if (!response.ok || !data.success || !Array.isArray(data.data) || !data.source) {
      lastError = typeof data.error === 'string'
        ? data.error
        : `Failed to execute query (HTTP ${response.status}).`;
      throw new Error(lastError);
    }

    return {
      data: data.data,
      count: data.count ?? data.data.length,
      truncated: Boolean(data.truncated),
      source: data.source,
    };
  }

  throw new Error(lastError);
}

export function useExecuteDataSourceQueryMutation() {
  return useMutation({
    mutationFn: executeDataSourceQuery,
  });
}
