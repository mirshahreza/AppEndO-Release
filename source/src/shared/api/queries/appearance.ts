import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut } from '../client';
import type { AppearanceSessionResponse } from '../contracts/appearance/shellExperience.schema';
import type {
  PortalShellAppearanceDefaults,
  UserShellExperience,
} from '../contracts/appearance/shellExperience.schema';

export const appearanceQueryKeys = {
  all: ['appearance'] as const,
  session: (mountId: string) => [...appearanceQueryKeys.all, 'session', mountId] as const,
};

export async function fetchAppearanceSession(mountId: string): Promise<AppearanceSessionResponse> {
  const { data, response } = await apiGet<AppearanceSessionResponse>(
    `/api/appearance/session?mountId=${encodeURIComponent(mountId)}`,
  );
  if (!response.ok || !data?.success) {
    throw new Error('Failed to load appearance session.');
  }
  return data;
}

export function useAppearanceSession(mountId: string, enabled: boolean) {
  return useQuery({
    queryKey: appearanceQueryKeys.session(mountId),
    queryFn: () => fetchAppearanceSession(mountId),
    enabled: enabled && mountId.trim().length > 0,
    staleTime: 30_000,
  });
}

export const invalidateAppearanceSession = (
  queryClient: { invalidateQueries: (opts: { queryKey: readonly string[] }) => Promise<unknown> },
  mountId: string,
) => queryClient.invalidateQueries({ queryKey: appearanceQueryKeys.session(mountId) });

export async function saveUserShellExperience(patch: Partial<UserShellExperience>): Promise<UserShellExperience> {
  const { data, response } = await apiPut<{ success: boolean; userExperience: UserShellExperience }>(
    '/api/appearance/me',
    patch,
  );
  if (!response.ok || !data?.success) {
    throw new Error('Failed to save shell experience.');
  }
  return data.userExperience;
}

export async function savePortalAppearanceDefaults(
  mountId: string,
  patch: Partial<PortalShellAppearanceDefaults>,
): Promise<PortalShellAppearanceDefaults> {
  const { data, response } = await apiPut<{
    success: boolean;
    portalDefaults: PortalShellAppearanceDefaults;
  }>(`/api/appearance/portal-defaults/${encodeURIComponent(mountId)}`, patch);
  if (!response.ok || !data?.success) {
    throw new Error('Failed to save portal appearance defaults.');
  }
  return data.portalDefaults;
}

export function useSaveUserShellExperience(mountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveUserShellExperience,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: appearanceQueryKeys.session(mountId) });
    },
  });
}

export function useSavePortalAppearanceDefaults(mountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<PortalShellAppearanceDefaults>) =>
      savePortalAppearanceDefaults(mountId, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: appearanceQueryKeys.session(mountId) });
    },
  });
}

export async function resetUserShellExperience(mountId: string): Promise<AppearanceSessionResponse> {
  const { data, response } = await apiPost<AppearanceSessionResponse>(
    `/api/appearance/me/reset?mountId=${encodeURIComponent(mountId)}`,
    {},
  );
  if (!response.ok || !data?.success) {
    throw new Error('Failed to reset shell experience.');
  }
  return data;
}
