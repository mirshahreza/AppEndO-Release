import { useMutation } from '@tanstack/react-query';
import { apiDelete, apiPost } from '../client';

export type StartImpersonationInput = {
  targetUserId?: number;
  targetRole?: string;
  durationMinutes?: number;
};

export type StartImpersonationResult = {
  success: boolean;
  grantId: string;
  expiresAt: string;
  targetUserId: number | null;
  targetEmail: string | null;
  targetRoles: string[];
};

export const useStartImpersonationMutation = () => useMutation({
  mutationFn: async (input: StartImpersonationInput) => {
    const { data } = await apiPost<StartImpersonationResult>('/api/dev-toolbar/impersonate', input);
    return data;
  },
});

export const useEndImpersonationMutation = () => useMutation({
  mutationFn: async (grantId: string) => {
    await apiDelete(`/api/dev-toolbar/impersonate/${encodeURIComponent(grantId)}`);
  },
});
