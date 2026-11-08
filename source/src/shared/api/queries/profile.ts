import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPost, apiPut, type ApiMutationResponse } from '../client';
import type { AttributeSummaryResponse, AttributeValuesResponse, UpdateAttributeValuesPayload } from '../contracts/attributes/types';
import type { ChangePasswordPayload } from '../../../types/auth';

export interface UserProfileRecord {
  id: number;
  email: string | null;
  username: string;
  firstname: string | null;
  lastname: string | null;
  fathername?: string | null;
  grandfathername?: string | null;
  phone?: string | null;
  nickname?: string | null;
  national_code?: string | null;
  birth_year?: string | null;
  birth_month?: string | null;
  birth_day?: string | null;
  gender_code?: string | null;
  person_type_code?: string | null;
  avatar_url?: string | null;
  profile_image_base64?: string | null;
  profile_image_xs_base64?: string | null;
  profile_image_mime?: string | null;
  profile_image_size?: number | null;
  has_profile_image?: boolean;
  has_profile_image_xs?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

type ProfileResponse = {
  success?: boolean;
  profile?: UserProfileRecord | null;
  error?: string;
};

export const profileQueryKeys = {
  all: ['profile'] as const,
  current: (userId?: number | null) => [...profileQueryKeys.all, 'current', userId ?? 'none'] as const,
  attributeSummary: (userId?: number | null) => [...profileQueryKeys.all, 'attribute-summary', userId ?? 'none'] as const,
  editableAttributes: (userId?: number | null) => [...profileQueryKeys.all, 'editable-attributes', userId ?? 'none'] as const,
  editableProfileFields: (userId?: number | null) => [...profileQueryKeys.all, 'editable-profile-fields', userId ?? 'none'] as const,
  sessions: (userId?: number | null) => [...profileQueryKeys.all, 'sessions', userId ?? 'none'] as const,
};

export const resetProfileQueriesOnAuthChange = (queryClient: QueryClient): void => {
  void queryClient.removeQueries({ queryKey: profileQueryKeys.all });
};

const getProfileLoadErrorMessage = (data: unknown, fallback: string): string => {
  if (!data || typeof data !== 'object') {
    return fallback;
  }

  const payload = data as { error?: string };
  return typeof payload.error === 'string' && payload.error.trim() ? payload.error : fallback;
};

export async function fetchCurrentUserProfile(): Promise<UserProfileRecord | null> {
  const { data, response } = await apiGet<ProfileResponse>('/api/profile');

  if (!response.ok) {
    throw new Error(getProfileLoadErrorMessage(data, `Failed to load profile (HTTP ${response.status}).`));
  }

  if (!data.success) {
    throw new Error(getProfileLoadErrorMessage(data, 'Failed to load profile.'));
  }

  return data.profile ?? null;
}

export function useCurrentUserProfileQuery(userId?: number | null, enabled = true) {
  const normalizedUserId = Number(userId);
  const hasUserId = Number.isInteger(normalizedUserId) && normalizedUserId > 0;

  return useQuery({
    queryKey: profileQueryKeys.current(hasUserId ? normalizedUserId : null),
    queryFn: fetchCurrentUserProfile,
    enabled: enabled && hasUserId,
  });
}

export async function fetchCurrentUserAttributeSummary(): Promise<AttributeSummaryResponse['items']> {
  const { data, response } = await apiGet<AttributeSummaryResponse>('/api/profile/me/attributes-summary');

  if (!response.ok) {
    throw new Error(getProfileLoadErrorMessage(data, `Failed to load attribute summary (HTTP ${response.status}).`));
  }

  if (!data.success) {
    throw new Error(getProfileLoadErrorMessage(data, 'Failed to load attribute summary.'));
  }

  return data.items ?? [];
}

export function useCurrentUserAttributeSummaryQuery(userId?: number | null, enabled = true) {
  const normalizedUserId = Number(userId);
  const hasUserId = Number.isInteger(normalizedUserId) && normalizedUserId > 0;

  return useQuery({
    queryKey: profileQueryKeys.attributeSummary(hasUserId ? normalizedUserId : null),
    queryFn: fetchCurrentUserAttributeSummary,
    enabled: enabled && hasUserId,
  });
}

export async function fetchMyEditableAttributes(): Promise<AttributeValuesResponse['items']> {
  const { data, response } = await apiGet<AttributeValuesResponse>('/api/profile/me/editable-attributes');

  if (!response.ok) {
    throw new Error(getProfileLoadErrorMessage(data, `Failed to load editable attributes (HTTP ${response.status}).`));
  }

  if (!data.success) {
    throw new Error(getProfileLoadErrorMessage(data, 'Failed to load editable attributes.'));
  }

  return data.items ?? [];
}

export function useMyEditableAttributesQuery(userId?: number | null, enabled = true) {
  const normalizedUserId = Number(userId);
  const hasUserId = Number.isInteger(normalizedUserId) && normalizedUserId > 0;

  return useQuery({
    queryKey: profileQueryKeys.editableAttributes(hasUserId ? normalizedUserId : null),
    queryFn: fetchMyEditableAttributes,
    enabled: enabled && hasUserId,
  });
}

export function useUpdateMyEditableAttributesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateAttributeValuesPayload) =>
      apiPut<ApiMutationResponse>('/api/profile/me/editable-attributes', payload),
    onSuccess: ({ data }) => {
      if (data.success) {
        invalidateCurrentProfile(queryClient);
      }
    },
  });
}

export interface UpdateMyAccountPayload {
  email?: string;
  firstName?: string;
  lastName?: string;
  fatherName?: string;
  grandfatherName?: string;
  phone?: string;
  nickname?: string;
  nationalCode?: string;
  birthYear?: string;
  birthMonth?: string;
  birthDay?: string;
  genderCode?: string;
  personTypeCode?: string;
  profileImageBody?: string | null;
  profileImageBodyXs?: string | null;
  profileImageMime?: string | null;
}

const invalidateCurrentProfile = (queryClient: ReturnType<typeof useQueryClient>) => {
  void queryClient.invalidateQueries({ queryKey: profileQueryKeys.all });
};

export function useUpdateMyAccountMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateMyAccountPayload) => apiPut('/api/profile/me', payload),
    onSuccess: ({ data }) => {
      if (data.success) {
        invalidateCurrentProfile(queryClient);
      }
    },
  });
}

export function useChangeMyPasswordMutation() {
  return useMutation({
    mutationFn: (payload: ChangePasswordPayload) => apiPost('/api/auth/change-password', payload),
  });
}

export function useDeleteMyAccountMutation() {
  return useMutation({
    mutationFn: (payload: { password: string }) => apiDelete('/api/auth/account', payload),
  });
}

export type AuthSessionRecord = {
  jti: string;
  userId: number;
  createdAt: string;
  expiresAt: number;
  revokedAt: string | null;
  replacedByJti: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  isCurrent: boolean;
};

type AuthSessionsResponse = {
  success?: boolean;
  items?: AuthSessionRecord[];
  error?: string;
};

export async function fetchMyAuthSessions(): Promise<AuthSessionRecord[]> {
  const { data, response } = await apiGet<AuthSessionsResponse>('/api/auth/sessions');

  if (!response.ok) {
    throw new Error(getProfileLoadErrorMessage(data, `Failed to load sessions (HTTP ${response.status}).`));
  }

  if (!data.success) {
    throw new Error(getProfileLoadErrorMessage(data, 'Failed to load sessions.'));
  }

  return data.items ?? [];
}

export function useMyAuthSessionsQuery(userId?: number | null, enabled = true) {
  const normalizedUserId = Number(userId);
  const hasUserId = Number.isInteger(normalizedUserId) && normalizedUserId > 0;

  return useQuery({
    queryKey: profileQueryKeys.sessions(hasUserId ? normalizedUserId : null),
    queryFn: fetchMyAuthSessions,
    enabled: enabled && hasUserId,
  });
}

export function useRevokeAuthSessionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jti: string) => apiDelete<ApiMutationResponse>(`/api/auth/sessions/${encodeURIComponent(jti)}`),
    onSuccess: ({ data }) => {
      if (data.success) {
        void queryClient.invalidateQueries({ queryKey: profileQueryKeys.all });
      }
    },
  });
}

export function useRevokeAllAuthSessionsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiDelete<ApiMutationResponse>('/api/auth/sessions?exceptCurrent=true'),
    onSuccess: ({ data }) => {
      if (data.success) {
        void queryClient.invalidateQueries({ queryKey: profileQueryKeys.all });
      }
    },
  });
}
