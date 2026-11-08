import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPut } from '../client';
import type { AiCapabilityPackId } from '../contracts/ai/capabilityPacks';
import { aiModelsQueryKeys } from './aiModels';

export function useUpdateAiDefaultCapabilityPacksMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { defaultCapabilityPackIds: AiCapabilityPackId[] }) => (
      apiPut('/api/ai/default-capability-packs', payload)
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: aiModelsQueryKeys.all });
    },
  });
}
