import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  EdgeApiDefinition,
  EdgeModelDefinition,
  EdgeModelStudioMeta,
  ImportEdgeModelInput,
  UpsertEdgeModelStudioMetaInput,
} from '../contracts/data-api';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../client';
import { serverFunctionsQueryKeys } from './server-functions';

const DATA_API_MODELS_KEY = ['data-api', 'models'] as const;
const DATA_API_DEFINITIONS_KEY = ['data-api', 'definitions'] as const;
const DATA_API_STUDIO_META_KEY = ['data-api', 'studio-meta'] as const;

const invalidateDataApiDependentQueries = (
  queryClient: ReturnType<typeof useQueryClient>,
) => {
  void queryClient.invalidateQueries({ queryKey: DATA_API_DEFINITIONS_KEY });
  void queryClient.invalidateQueries({ queryKey: serverFunctionsQueryKeys.catalog() });
};

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  count?: number;
  error?: string;
};

const unwrapEnvelope = <T,>(body: ApiEnvelope<T>): T => {
  if (!body.success) {
    throw new Error(body.error || 'Request failed.');
  }
  return body.data;
};

export type ExplorerCatalog = {
  tables: string[];
  views: string[];
};

export const useEdgeModelsQuery = () => useQuery({
  queryKey: DATA_API_MODELS_KEY,
  queryFn: async () => {
    const { data } = await apiGet<ApiEnvelope<EdgeModelDefinition[]>>('/api/data-api/models');
    return unwrapEnvelope(data);
  },
});

export const useEdgeModelQuery = (modelId: string | null) => useQuery({
  queryKey: [...DATA_API_MODELS_KEY, modelId],
  enabled: Boolean(modelId),
  queryFn: async () => {
    const { data } = await apiGet<ApiEnvelope<EdgeModelDefinition>>(
      `/api/data-api/models/${encodeURIComponent(modelId || '')}`,
    );
    return unwrapEnvelope(data);
  },
});

export const useEdgeModelStudioMetaQuery = (modelId: string | null) => useQuery({
  queryKey: [...DATA_API_STUDIO_META_KEY, modelId],
  enabled: Boolean(modelId),
  queryFn: async () => {
    const { data } = await apiGet<ApiEnvelope<EdgeModelStudioMeta>>(
      `/api/data-api/models/${encodeURIComponent(modelId || '')}/studio-meta`,
    );
    return unwrapEnvelope(data);
  },
});

export const useUpsertEdgeModelStudioMetaMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { modelId: string; patch: UpsertEdgeModelStudioMetaInput }) => {
      const { data } = await apiPut<ApiEnvelope<EdgeModelStudioMeta>>(
        `/api/data-api/models/${encodeURIComponent(input.modelId)}/studio-meta`,
        input.patch,
      );
      return unwrapEnvelope(data);
    },
    onSuccess: (_meta, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...DATA_API_STUDIO_META_KEY, variables.modelId],
      });
    },
  });
};

export const useImportEdgeModelMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ImportEdgeModelInput) => {
      const { data } = await apiPost<ApiEnvelope<EdgeModelDefinition>>('/api/data-api/models/import', input);
      return unwrapEnvelope(data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: DATA_API_MODELS_KEY });
    },
  });
};

export const useRefreshEdgeModelMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (modelId: string) => {
      const { data } = await apiPost<ApiEnvelope<EdgeModelDefinition>>(
        `/api/data-api/models/${encodeURIComponent(modelId)}/refresh`,
        {},
      );
      return unwrapEnvelope(data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: DATA_API_MODELS_KEY });
    },
  });
};

export type PatchEdgeModelInput = {
  modelId: string;
  patch: Partial<Pick<EdgeModelDefinition, 'labels' | 'columns' | 'associations' | 'readOnly'>> & {
    /** Optional studio-meta upsert applied in the same request (tags/columnMeta/extensions). */
    studioMeta?: UpsertEdgeModelStudioMetaInput;
  };
};

export const usePatchEdgeModelMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: PatchEdgeModelInput) => {
      const { data } = await apiPatch<ApiEnvelope<EdgeModelDefinition>>(
        `/api/data-api/models/${encodeURIComponent(input.modelId)}`,
        input.patch,
      );
      return unwrapEnvelope(data);
    },
    onSuccess: (_model, variables) => {
      void queryClient.invalidateQueries({ queryKey: DATA_API_MODELS_KEY });
      if (variables.patch.studioMeta) {
        void queryClient.invalidateQueries({
          queryKey: [...DATA_API_STUDIO_META_KEY, variables.modelId],
        });
      }
    },
  });
};

export const useDeleteEdgeModelMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (modelId: string) => {
      await apiDelete(`/api/data-api/models/${modelId}`);
    },
    onSuccess: (_void, modelId) => {
      void queryClient.invalidateQueries({ queryKey: DATA_API_MODELS_KEY });
      void queryClient.invalidateQueries({ queryKey: [...DATA_API_STUDIO_META_KEY, modelId] });
    },
  });
};

export const useExplorerCatalogQuery = (dataSourceId: string | null) => useQuery({
  queryKey: ['data-api', 'explorer', dataSourceId],
  enabled: Boolean(dataSourceId),
  queryFn: async () => {
    const { data } = await apiGet<ApiEnvelope<ExplorerCatalog>>(
      `/api/data-api/explorer/catalog?dataSourceId=${encodeURIComponent(dataSourceId || '')}`,
    );
    return unwrapEnvelope(data);
  },
});

export const useEdgeApiDefinitionsQuery = () => useQuery({
  queryKey: DATA_API_DEFINITIONS_KEY,
  queryFn: async () => {
    const { data } = await apiGet<ApiEnvelope<EdgeApiDefinition[]>>('/api/data-api/definitions');
    return unwrapEnvelope(data);
  },
});

export type PublishedEdgeApiOption = {
  key: string;
  label: string;
};

/** Published Data APIs for workflow Action pickers (`format: 'edge-api-key'`). */
export async function fetchPublishedEdgeApiOptions(): Promise<PublishedEdgeApiOption[]> {
  try {
    const { data } = await apiGet<ApiEnvelope<EdgeApiDefinition[]>>('/api/data-api/definitions');
    const definitions = unwrapEnvelope(data);
    return definitions
      .filter((definition) => Boolean(definition.publishedAt))
      .map((definition) => ({ key: definition.key, label: definition.label }));
  } catch {
    return [];
  }
}

export const useEdgeApiDefinitionQuery = (definitionId: string | null) => useQuery({
  queryKey: [...DATA_API_DEFINITIONS_KEY, definitionId],
  enabled: Boolean(definitionId),
  queryFn: async () => {
    const { data } = await apiGet<ApiEnvelope<EdgeApiDefinition>>(
      `/api/data-api/definitions/${definitionId}`,
    );
    return unwrapEnvelope(data);
  },
});

export type CreateEdgeApiDefinitionInput = {
  edgeModelId: string;
  key: string;
  label: string;
  basePath: string;
  operations?: EdgeApiDefinition['operations'];
};

export const useCreateEdgeApiDefinitionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateEdgeApiDefinitionInput) => {
      const { data } = await apiPost<ApiEnvelope<EdgeApiDefinition>>('/api/data-api/definitions', input);
      return unwrapEnvelope(data);
    },
    onSuccess: () => {
      invalidateDataApiDependentQueries(queryClient);
    },
  });
};

export const usePatchEdgeApiDefinitionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      definitionId: string;
      patch: Partial<Pick<EdgeApiDefinition, 'key' | 'label' | 'basePath' | 'operations' | 'accessControl' | 'runtime' | 'openapi' | 'defaultWhere' | 'changeReason'>>;
    }) => {
      const { data } = await apiPatch<ApiEnvelope<EdgeApiDefinition>>(
        `/api/data-api/definitions/${input.definitionId}`,
        input.patch,
      );
      return unwrapEnvelope(data);
    },
    onSuccess: () => {
      invalidateDataApiDependentQueries(queryClient);
    },
  });
};

export const usePublishEdgeApiDefinitionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (definitionId: string) => {
      const { data } = await apiPost<ApiEnvelope<EdgeApiDefinition>>(
        `/api/data-api/definitions/${definitionId}/publish`,
        {},
      );
      return unwrapEnvelope(data);
    },
    onSuccess: () => {
      invalidateDataApiDependentQueries(queryClient);
    },
  });
};

export const useUnpublishEdgeApiDefinitionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (definitionId: string) => {
      const { data } = await apiPost<ApiEnvelope<EdgeApiDefinition>>(
        `/api/data-api/definitions/${definitionId}/unpublish`,
        {},
      );
      return unwrapEnvelope(data);
    },
    onSuccess: () => {
      invalidateDataApiDependentQueries(queryClient);
    },
  });
};

export const useDeleteEdgeApiDefinitionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (definitionId: string) => {
      await apiDelete(`/api/data-api/definitions/${definitionId}`);
    },
    onSuccess: () => {
      invalidateDataApiDependentQueries(queryClient);
    },
  });
};

export type TryEdgeApiDefinitionInput = {
  definitionId: string;
  method: string;
  path: string;
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: unknown;
  /** PDK-5 — test this operation's Record Policy as a specific actor instead of anonymous. */
  testActorUserId?: string | number | null;
  testActorRoles?: string[];
  testActorIsAdmin?: boolean;
};

export const useTryEdgeApiDefinitionMutation = () => useMutation({
  mutationFn: async (input: TryEdgeApiDefinitionInput) => {
    const response = await apiPost<Record<string, unknown>>(
      `/api/data-api/definitions/${input.definitionId}/try`,
      input,
    );
    return response;
  },
});

export type DataApiExportPayload = {
  name: string;
  folder: string;
  method: string;
  path: string;
  language: 'ts';
  code: string;
  metadataJson: Record<string, unknown>;
  description: string;
};

export const useExportEdgeApiDefinitionMutation = () => useMutation({
  mutationFn: async (input: { definitionId: string; operationId?: string }) => {
    const { data } = await apiPost<ApiEnvelope<DataApiExportPayload>>(
      `/api/data-api/definitions/${input.definitionId}/export`,
      { operationId: input.operationId },
    );
    return unwrapEnvelope(data);
  },
});
