import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  RecordPolicyAction,
  RecordPolicyBindingDocument,
  RecordPolicyDocument,
  ScopeDimensionDef,
} from '../contracts/record-policy';
import {
  apiDelete,
  apiGet,
  apiPut,
  type ApiListResponse,
  type ApiMutationResponse,
} from '../client';

export type RecordPolicyExplainResult = {
  edgeModelId: string;
  action: RecordPolicyAction;
  recordScope: 'off' | 'on';
  forceScopeForAdmin: boolean;
  adminBypassed: boolean;
  applicablePolicyIds: string[];
  denyAll: boolean;
  scopeHash: string;
  memberships: Record<string, { ids: string[]; mode: string }>;
  compiledWhereSummary: string;
};

export const recordPolicyQueryKeys = {
  all: ['record-policy'] as const,
  dimensions: () => [...recordPolicyQueryKeys.all, 'dimensions'] as const,
  policies: (edgeModelId?: string) => [...recordPolicyQueryKeys.all, 'policies', edgeModelId ?? 'all'] as const,
  binding: (edgeModelId: string) => [...recordPolicyQueryKeys.all, 'binding', edgeModelId] as const,
  explain: (edgeModelId: string, action: string) => [
    ...recordPolicyQueryKeys.all,
    'explain',
    edgeModelId,
    action,
  ] as const,
};

export async function fetchScopeDimensions(): Promise<ScopeDimensionDef[]> {
  const { data } = await apiGet<ApiListResponse>('/api/record-policy/dimensions');
  return (data.items ?? []) as ScopeDimensionDef[];
}

export async function fetchRecordPolicies(edgeModelId?: string): Promise<RecordPolicyDocument[]> {
  const search = edgeModelId ? `?edgeModelId=${encodeURIComponent(edgeModelId)}` : '';
  const { data } = await apiGet<ApiListResponse>(`/api/record-policy/policies${search}`);
  return (data.items ?? []) as RecordPolicyDocument[];
}

export async function fetchRecordPolicyBinding(edgeModelId: string): Promise<RecordPolicyBindingDocument> {
  const { data } = await apiGet<ApiMutationResponse>(
    `/api/record-policy/bindings/${encodeURIComponent(edgeModelId)}`,
  );
  return data.item as RecordPolicyBindingDocument;
}

export const useScopeDimensionsQuery = () => useQuery({
  queryKey: recordPolicyQueryKeys.dimensions(),
  queryFn: fetchScopeDimensions,
});

export const useRecordPoliciesQuery = (edgeModelId?: string, enabled = true) => useQuery({
  queryKey: recordPolicyQueryKeys.policies(edgeModelId),
  queryFn: () => fetchRecordPolicies(edgeModelId),
  enabled,
});

export const useRecordPolicyBindingQuery = (edgeModelId: string, enabled = true) => useQuery({
  queryKey: recordPolicyQueryKeys.binding(edgeModelId),
  queryFn: () => fetchRecordPolicyBinding(edgeModelId),
  enabled: enabled && Boolean(edgeModelId),
});

export const useSaveRecordPolicyMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: RecordPolicyDocument) => {
      const { data, response } = await apiPut<ApiMutationResponse>('/api/record-policy/policies', payload);
      if (!response.ok || data.success === false) {
        throw new Error(
          typeof data.error === 'string' && data.error.trim()
            ? data.error
            : `Failed to save policy (HTTP ${response.status}).`,
        );
      }
      return data.item as RecordPolicyDocument;
    },
    onSuccess: async (_item, variables) => {
      await queryClient.invalidateQueries({
        queryKey: recordPolicyQueryKeys.policies(variables.edgeModelId),
      });
      await queryClient.invalidateQueries({ queryKey: recordPolicyQueryKeys.policies() });
      await queryClient.invalidateQueries({ queryKey: [...recordPolicyQueryKeys.all, 'explain'] });
    },
  });
};

export const useDeleteRecordPolicyMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; edgeModelId: string }) => {
      await apiDelete(`/api/record-policy/policies/${encodeURIComponent(input.id)}`);
      return input;
    },
    onSuccess: async (input) => {
      await queryClient.invalidateQueries({
        queryKey: recordPolicyQueryKeys.policies(input.edgeModelId),
      });
      await queryClient.invalidateQueries({ queryKey: [...recordPolicyQueryKeys.all, 'explain'] });
    },
  });
};

export const useSaveRecordPolicyBindingMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: RecordPolicyBindingDocument) => {
      const { data } = await apiPut<ApiMutationResponse>('/api/record-policy/bindings', payload);
      return data.item as RecordPolicyBindingDocument;
    },
    onSuccess: async (item) => {
      await queryClient.invalidateQueries({
        queryKey: recordPolicyQueryKeys.binding(item.edgeModelId),
      });
    },
  });
};

export async function fetchRecordPolicyExplain(
  edgeModelId: string,
  action: RecordPolicyAction,
): Promise<RecordPolicyExplainResult> {
  const { data } = await apiGet<ApiMutationResponse>(
    `/api/record-policy/explain?edgeModelId=${encodeURIComponent(edgeModelId)}&action=${encodeURIComponent(action)}`,
  );
  return data.item as RecordPolicyExplainResult;
}

export const useRecordPolicyExplainQuery = (
  edgeModelId: string,
  action: RecordPolicyAction,
  enabled = true,
) => useQuery({
  queryKey: recordPolicyQueryKeys.explain(edgeModelId, action),
  queryFn: () => fetchRecordPolicyExplain(edgeModelId, action),
  enabled: enabled && Boolean(edgeModelId),
});
