import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiError, apiGet, apiPost } from '../client';
import type {
  InstallAdminPayload,
  InstallCachePayload,
  InstallCapabilitiesPayload,
  InstallDatabasePayload,
  InstallEmailPayload,
  InstallRedisPayload,
  InstallStatusResponse,
} from '../contracts/install/types';

export const installQueryKeys = {
  all: ['install'] as const,
  status: () => [...installQueryKeys.all, 'status'] as const,
};

type InstallApiPayload = Record<string, unknown> & {
  success?: boolean;
  error?: string;
  message?: string;
};

const getInstallApiErrorMessage = (
  response: Response,
  data: InstallApiPayload | undefined,
  fallback: string,
): string => {
  if (typeof data?.error === 'string' && data.error.trim()) {
    return data.error.trim();
  }
  if (typeof data?.message === 'string' && data.message.trim()) {
    return data.message.trim();
  }
  if (response.status === 503) {
    return 'Install API is unavailable. Restart the dev server so only one AppEndO instance is running.';
  }
  return fallback;
};

const assertInstallApiSuccess = <T extends InstallApiPayload>(
  response: Response,
  data: T,
  fallback: string,
): T => {
  if (!response.ok || data.success === false) {
    throw new ApiError(
      getInstallApiErrorMessage(response, data, fallback),
      {
        status: response.status,
        statusText: response.statusText,
        bodySnippet: typeof data.error === 'string' ? data.error : '',
        path: response.url,
      },
    );
  }
  return data;
};

const postInstall = async <T extends InstallApiPayload>(
  path: string,
  body: unknown,
  fallback: string,
): Promise<T> => {
  const { data, response } = await apiPost<T>(path, body);
  return assertInstallApiSuccess(response, data, fallback);
};

export function useInstallStatusQuery(enabled = true) {
  return useQuery({
    queryKey: installQueryKeys.status(),
    queryFn: async () => {
      const { data } = await apiGet<InstallStatusResponse>('/api/install/status');
      return data;
    },
    enabled,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useInstallTestDatabaseMutation() {
  return useMutation({
    mutationFn: async (payload: InstallDatabasePayload) => {
      const { data, response } = await apiPost('/api/install/database/test', payload);
      if (!response.ok) {
        throw new ApiError(
          getInstallApiErrorMessage(response, data, 'Database connection failed.'),
          {
            status: response.status,
            statusText: response.statusText,
            bodySnippet: typeof data?.error === 'string' ? data.error : '',
            path: response.url,
          },
        );
      }
      return data;
    },
  });
}

export function useInstallSaveDatabaseMutation() {
  return useMutation({
    mutationFn: (payload: InstallDatabasePayload) => postInstall(
      '/api/install/database/save',
      payload,
      'Failed to save database settings.',
    ),
  });
}

export function useInstallInitDatabaseMutation() {
  return useMutation({
    mutationFn: () => postInstall(
      '/api/install/database/init',
      {},
      'Failed to initialize the database.',
    ),
  });
}

export function useInstallEnsureDatabaseMutation() {
  return useMutation({
    mutationFn: () => postInstall(
      '/api/install/database/ensure',
      {},
      'Failed to ensure the database.',
    ),
  });
}

export function useInstallConfigureAdminMutation() {
  return useMutation({
    mutationFn: (payload: InstallAdminPayload) => postInstall(
      '/api/install/admin',
      payload,
      'Failed to configure the admin account.',
    ),
  });
}

export function useInstallSaveCapabilitiesMutation() {
  return useMutation({
    mutationFn: (payload: InstallCapabilitiesPayload) => postInstall(
      '/api/install/capabilities',
      payload,
      'Failed to save node capabilities.',
    ),
  });
}

export function useInstallTestRedisMutation() {
  return useMutation({
    mutationFn: async (payload: InstallRedisPayload) => postInstall<{
      success: boolean;
      result: { success: boolean; message: string };
    }>(
      '/api/install/redis/test',
      payload,
      'Redis connection test failed.',
    ),
  });
}

export function useInstallSaveCacheMutation() {
  return useMutation({
    mutationFn: (payload: InstallCachePayload) => postInstall(
      '/api/install/cache/save',
      payload,
      'Failed to save cache settings.',
    ),
  });
}

export function useInstallTestEmailMutation() {
  return useMutation({
    mutationFn: async (payload: InstallEmailPayload) => postInstall<{
      success: boolean;
      result: { success: boolean; message: string };
    }>(
      '/api/install/email/test',
      payload,
      'SMTP connection test failed.',
    ),
  });
}

export function useInstallSaveEmailMutation() {
  return useMutation({
    mutationFn: (payload: InstallEmailPayload) => postInstall(
      '/api/install/email/save',
      payload,
      'Failed to save email settings.',
    ),
  });
}

export function useInstallSkipEmailMutation() {
  return useMutation({
    mutationFn: () => postInstall(
      '/api/install/email/skip',
      {},
      'Failed to skip email setup.',
    ),
  });
}

export function useInstallCompleteMutation() {
  return useMutation({
    mutationFn: () => postInstall<{
      success: boolean;
      redirectTo?: string;
      message?: string;
      restartRequired?: boolean;
    }>(
      '/api/install/complete',
      {},
      'Failed to complete install.',
    ),
  });
}
