import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPut } from '../client';
import type { AiMcpInboundHostSettings } from '../contracts/ai/types';
import { aiModelsQueryKeys } from './aiModels';

export function useUpdateAiInboundMcpMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AiMcpInboundHostSettings) => apiPut('/api/ai/inbound-mcp', payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: aiModelsQueryKeys.all });
    },
  });
}
