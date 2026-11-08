import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPut } from '../client';
import type { SettingsNodeEnv } from '../contracts/settings/authPolicy';

export type NodeSettingsSnapshot = {
  nodeName: string;
  capabilities: string[];
  nodeEnv: SettingsNodeEnv;
  port: number;
  logLevel: string;
  disableHmr: boolean;
  hmrPort: number;
  appUrl?: string;
};

export type PlatformSecuritySnapshot = {
  hasAccessTokenSecret: boolean;
  hasRefreshTokenSecret: boolean;
  accessTokenSecretPreview: string;
  refreshTokenSecretPreview: string;
};

export const useNodeSettingsQuery = () => useQuery({
  queryKey: ['settings', 'node'],
  queryFn: async () => {
    const { data } = await apiGet<{ success: true; node: NodeSettingsSnapshot }>('/api/settings/node');
    return data.node;
  },
});

export const useUpdateNodeSettingsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<NodeSettingsSnapshot>) => {
      const { data } = await apiPut<{ success: true; node: NodeSettingsSnapshot }>('/api/settings/node', payload);
      return data.node;
    },
    onSuccess: (node) => {
      queryClient.setQueryData(['settings', 'node'], node);
    },
  });
};

export const usePlatformSecurityQuery = () => useQuery({
  queryKey: ['settings', 'security'],
  queryFn: async () => {
    const { data } = await apiGet<{ success: true; security: PlatformSecuritySnapshot }>('/api/settings/security');
    return data.security;
  },
});

export const useUpdatePlatformSecurityMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { accessTokenSecret?: string; refreshTokenSecret?: string }) => {
      const { data } = await apiPut<{ success: true; security: PlatformSecuritySnapshot }>(
        '/api/settings/security',
        payload,
      );
      return data.security;
    },
    onSuccess: (security) => {
      queryClient.setQueryData(['settings', 'security'], security);
    },
  });
};
