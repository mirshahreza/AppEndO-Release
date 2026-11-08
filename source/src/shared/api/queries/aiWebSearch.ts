import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPut } from '../client';
import type { AiWebSearchSettings } from '../contracts/ai/types';
import { aiModelsQueryKeys } from './aiModels';

export function useUpdateAiWebSearchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AiWebSearchSettings) => apiPut('/api/ai/web-search', payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: aiModelsQueryKeys.all });
    },
  });
}
