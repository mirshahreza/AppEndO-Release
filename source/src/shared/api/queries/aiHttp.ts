import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPut } from '../client';
import type { AiHttpSettings } from '../contracts/ai/types';
import { aiModelsQueryKeys } from './aiModels';

export function useUpdateAiHttpMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AiHttpSettings) => apiPut('/api/ai/http', payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: aiModelsQueryKeys.all });
    },
  });
}
