import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../client';
import type { WhereField } from '../../ui/where-builder/whereBuilderModel';
import type { QueryPresetDefinition } from '../contracts/data-api';

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

export type QuerySurfaceRuntimeManifest = {
  listWhereFields: WhereField[];
  presets: Array<Pick<QueryPresetDefinition, 'id' | 'label' | 'labelKey' | 'description' | 'descriptionKey' | 'application' | 'defaultSelected' | 'icon' | 'visibility'>>;
  defaultPresetIds: string[];
};

const querySurfaceRuntimeKey = (edgeModelId: string) => ['data-api', 'query-surfaces', edgeModelId] as const;

export const useQuerySurfaceRuntimeQuery = (edgeModelId: string | undefined) => useQuery({
  queryKey: querySurfaceRuntimeKey(edgeModelId ?? ''),
  enabled: Boolean(edgeModelId?.trim()),
  queryFn: async (): Promise<QuerySurfaceRuntimeManifest> => {
    const { data } = await apiGet<ApiEnvelope<QuerySurfaceRuntimeManifest>>(
      `/api/data-api/models/${encodeURIComponent(edgeModelId!)}/query-surfaces/runtime`,
    );
    return unwrapEnvelope(data);
  },
});

const resolveEdgeModelKey = (endpoint: string) => ['data-api', 'resolve-edge-model', endpoint] as const;

export const useResolveEdgeModelIdQuery = (endpoint: string | undefined, enabled = true) => useQuery({
  queryKey: resolveEdgeModelKey(endpoint ?? ''),
  enabled: enabled && Boolean(endpoint?.trim()),
  queryFn: async (): Promise<{ edgeModelId: string }> => {
    const { data } = await apiGet<ApiEnvelope<{ edgeModelId: string }>>(
      `/api/data-api/resolve-edge-model?endpoint=${encodeURIComponent(endpoint!)}`,
    );
    return unwrapEnvelope(data);
  },
});

export const parseQueryPresetsStoreValue = (raw: unknown): string[] => {
  if (typeof raw !== 'string' || !raw.trim()) {
    return [];
  }
  return raw.split(',').map((entry) => entry.trim()).filter(Boolean);
};

export const serializeQueryPresetsStoreValue = (ids: readonly string[]): string => (
  ids.map((id) => id.trim()).filter(Boolean).join(',')
);
