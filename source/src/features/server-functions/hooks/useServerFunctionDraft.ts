import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  serverFunctionsQueryKeys,
  type ServerFunctionDraft,
} from '../../../shared/api/queries/server-functions';
import {
  clearServerFunctionDraft,
  getServerFunctionDraft,
  mergeServerFunctionWithDraft,
  patchServerFunctionDraft,
} from './serverFunctionDraftCache';
import type { ServerFunctionItem } from '../types';

export function useServerFunctionDraft(functionId: string | null, catalogFn: ServerFunctionItem | null) {
  const queryClient = useQueryClient();

  const draftQuery = useQuery<ServerFunctionDraft | undefined>({
    queryKey: serverFunctionsQueryKeys.draft(functionId ?? '__inactive__'),
    queryFn: () => (functionId ? getServerFunctionDraft(queryClient, functionId) : undefined),
    enabled: Boolean(functionId),
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const mergedFn = catalogFn && functionId
    ? mergeServerFunctionWithDraft(catalogFn, draftQuery.data)
    : null;

  const patchDraft = (patch: ServerFunctionDraft) => {
    if (!functionId) {
      return;
    }
    patchServerFunctionDraft(queryClient, functionId, patch);
  };

  const clearDraft = () => {
    if (!functionId) {
      return;
    }
    clearServerFunctionDraft(queryClient, functionId);
  };

  return {
    draft: draftQuery.data,
    mergedFn,
    patchDraft,
    clearDraft,
  };
}
