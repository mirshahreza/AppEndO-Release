import { useMutation, useQuery } from '@tanstack/react-query';
import { apiGet, apiPut } from '../client';
import {
  compareEntityFunctionAccessEntries,
  sortEntityFunctionAccessEntries,
  type EntityFunctionAccessDecision,
  type EntityFunctionAccessResponse,
  type FunctionAccessEntityKind,
  type ReplaceEntityFunctionAccessPayload,
} from '../contracts/server-functions/entityAccess';

export const functionEntityAccessQueryKeys = {  all: ['function-entity-access'] as const,
  entity: (
    entityKind: FunctionAccessEntityKind,
    entityKey: string,
  ) => [...functionEntityAccessQueryKeys.all, entityKind, entityKey] as const,
};

const entityKindPath = (entityKind: FunctionAccessEntityKind): string => (
  entityKind === 'user' ? 'users' : 'roles'
);

const getLoadErrorMessage = (data: unknown, fallback: string): string => {
  if (!data || typeof data !== 'object') {
    return fallback;
  }

  const payload = data as { error?: string };
  return typeof payload.error === 'string' && payload.error.trim() ? payload.error : fallback;
};

export async function fetchEntityFunctionAccess(
  entityKind: FunctionAccessEntityKind,
  entityKey: string,
  signal?: AbortSignal,
): Promise<EntityFunctionAccessResponse> {
  const encodedKey = encodeURIComponent(entityKey);
  const { data, response } = await apiGet<EntityFunctionAccessResponse>(
    `/api/functions/entity-access/${entityKindPath(entityKind)}/${encodedKey}`,
    { signal },
  );

  if (!response.ok) {
    throw new Error(getLoadErrorMessage(data, `Failed to load function access (HTTP ${response.status}).`));
  }

  if (!data.success || !Array.isArray(data.entries)) {
    throw new Error(getLoadErrorMessage(data, 'Failed to load function access.'));
  }

  return {
    ...data,
    entries: sortEntityFunctionAccessEntries(data.entries),
  };
}
export function useEntityFunctionAccessQuery(
  entityKind: FunctionAccessEntityKind,
  entityKey: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: entityKey
      ? functionEntityAccessQueryKeys.entity(entityKind, entityKey)
      : [...functionEntityAccessQueryKeys.all, 'idle'],
    queryFn: ({ signal }) => fetchEntityFunctionAccess(entityKind, entityKey as string, signal),
    enabled: enabled && Boolean(entityKey),
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useReplaceEntityFunctionAccessMutation() {
  return useMutation({
    mutationFn: async ({      entityKind,
      entityKey,
      payload,
    }: {
      entityKind: FunctionAccessEntityKind;
      entityKey: string;
      payload: ReplaceEntityFunctionAccessPayload;
    }) => {
      const encodedKey = encodeURIComponent(entityKey);
      const { data, response } = await apiPut<{ success: boolean; error?: string }>(
        `/api/functions/entity-access/${entityKindPath(entityKind)}/${encodedKey}`,
        payload,
      );

      if (!response.ok || !data.success) {
        throw new Error(getLoadErrorMessage(data, `Failed to update function access (HTTP ${response.status}).`));
      }

      return data;
    },
    onSuccess: () => {
      // Keep modal labels stable — no catalog/entity-access refetch after each toggle.
    },
  });
}

export type { EntityFunctionAccessDecision };
