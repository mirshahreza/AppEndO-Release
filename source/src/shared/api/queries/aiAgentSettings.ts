import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPut } from '../client';
import type { AiAgentSettings } from '../contracts/ai/types';
import { aiModelsQueryKeys } from './aiModels';

export type AiAgentSettingsUpdate = Pick<AiAgentSettings, 'contextSummarizeWithLlm'>;

export function useUpdateAiAgentSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AiAgentSettingsUpdate) => apiPut('/api/ai/agent-settings', payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: aiModelsQueryKeys.all });
    },
  });
}
