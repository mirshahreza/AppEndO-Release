import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { RoleRecord } from '../contracts/roles/types';
import type { UsersListQuery } from '../contracts/users/listQuery';
import { appendUsersListParams } from '../contracts/users/listQuery';
import { resolveListUserAvatarSrc } from '../contracts/users/avatar';
import { buildDataUrlFromBase64 } from '../../lib/fileFieldUtils';
import {
  apiGet,
  apiPatch,
  apiPost,
  apiPut,
  apiDelete,
  type ApiListResponse,
} from '../client';
import { RECORDS_LIST_QUERY_OPTIONS } from './recordsListQueryOptions';
import { BASE_ROLES, DEFAULT_ASSIGNABLE_ROLE } from '../contracts/roles/constants';
import { filterActiveRoleNames } from '../contracts/roles/roleNames';
import { useCulture } from '../../../core/culture/CultureContext';
import { fetchBaseInfoOptions } from './base-info';
import {
  PROFILE_GENDER_BASE_INFO_ROOT,
  PROFILE_PERSON_TYPE_BASE_INFO_ROOT,
} from '../../profile/profileBaseInfoRoots';

export interface UserRecord {
  id: number;
  username: string;
  /** Legacy HWY UserName / membership number from hwy_members when linked. */
  /** Resolved for Users grid under-avatar (legacy UserName; not member Id / tracking code). */
  avatar_username?: string | null;
  /** Legacy HWY `UserName` from MembersV2 (not member Id / TrackingCode). */
  legacy_hwy_username?: string | null;
  /** @deprecated Use legacy_hwy_username */
  membership_username?: string | null;
  email: string | null;
  role: string;
  roles: string[];
  firstname: string | null;
  lastname: string | null;
  fathername?: string | null;
  grandfathername?: string | null;
  nickname?: string | null;
  national_code?: string | null;
  birth_year?: string | null;
  birth_month?: string | null;
  birth_day?: string | null;
  gender_code?: string | null;
  person_type_code?: string | null;
  company_name?: string | null;
  registration_number?: string | null;
  website?: string | null;
  profile_image_mime?: string | null;
  profile_image_size?: number | null;
  profile_updated_at?: string | null;
  list_avatar_preview?: string | null;
  avatar_url?: string | null;
  has_profile_image?: boolean;
  has_profile_image_xs?: boolean;
  locked: boolean;
  locked_at?: string | null;
  locked_by?: number | null;
  locked_by_username?: string | null;
  unlocked_at?: string | null;
  unlocked_by?: number | null;
  unlocked_by_username?: string | null;
  is_builtin: boolean;
  created_at: string;
  created_by?: number | null;
  created_by_username?: string | null;
  updated_at?: string;
  updated_by?: number | null;
  updated_by_username?: string | null;
}

export type { RoleRecord };

export interface BaseInfoOption {
  id: string;
  label: string;
  uiHtml?: string | null;
}

export interface UsersPageMeta {
  availableRoles: string[];
  genderOptions: BaseInfoOption[];
  personTypeOptions: BaseInfoOption[];
}

export type { UsersListQuery };

export interface CreateUserPayload {
  email: string;
  password: string;
  roles: string[];
  firstName?: string;
  lastName?: string;
  fatherName?: string;
  grandfatherName?: string;
  nickname?: string;
  nationalCode?: string;
  birthYear?: string;
  birthMonth?: string;
  birthDay?: string;
  genderCode?: string;
  personTypeCode?: string;
  companyName?: string;
  registrationNumber?: string;
  website?: string;
  profileImageBody?: string;
  profileImageBodyXs?: string;
  __changeReasonCode?: string;
  __changeReasonText?: string;
}

export interface UpdateUserProfilePayload {
  firstName?: string;
  lastName?: string;
  fatherName?: string;
  grandfatherName?: string;
  nickname?: string;
  nationalCode?: string;
  birthYear?: string;
  birthMonth?: string;
  birthDay?: string;
  genderCode?: string;
  personTypeCode?: string;
  companyName?: string;
  registrationNumber?: string;
  website?: string;
  profileImageBody?: string | null;
  profileImageBodyXs?: string | null;
  profileImageMime?: string | null;
  __changeReasonCode?: string;
  __changeReasonText?: string;
  __revertedFromSeq?: number | string;
  __revertedFromEventId?: string;
}

export interface UpdateUserProfileResponse {
  success: boolean;
  error?: string;
  profile?: {
    has_profile_image_xs: boolean;
    profile_image_size: number | null;
    profile_image_mime: string | null;
    profile_updated_at: string | null;
  };
}

export interface UpdateUserRolesPayload {
  roles: string[];
  __changeReasonCode?: string;
  __changeReasonText?: string;
}

export interface ChangePasswordPayload {
  newPassword: string;
}

const FALLBACK_ROLES = [...BASE_ROLES] as const;

export const usersQueryKeys = {
  all: ['users'] as const,
  meta: (cultureId: string) => [...usersQueryKeys.all, 'meta', cultureId] as const,
  list: (params: UsersListQuery) => [
    ...usersQueryKeys.all,
    'list',
    {
      ...params,
      roleMatch: params.roleMatch ?? 'or',
    },
  ] as const,
};

const normalizeUserItems = (items: unknown[]): UserRecord[] => {
  return items.map((item) => {
    const record = item as UserRecord & { role?: string };
    const roles = Array.isArray(record.roles)
      ? record.roles.map((role) => String(role).toUpperCase()).filter(Boolean)
      : record.role
        ? [String(record.role).toUpperCase()]
        : [];
    const uniqueRoles = Array.from(new Set(roles));

    return {
      ...record,
      roles: uniqueRoles,
      role: uniqueRoles[0] ?? '',
    };
  });
};

const normalizeAvailableRoles = (items: RoleRecord[]): string[] => {
  const fromApi = items
    .map((role) => String(role.name || '').toUpperCase())
    .filter(Boolean);
  return filterActiveRoleNames([...FALLBACK_ROLES, ...fromApi]);
};

export const normalizeBaseInfoOptions = (items: unknown[], excludeRootId: string): BaseInfoOption[] => {
  return (items as Array<{ id: string | number; label?: string; title?: string; ui_html?: string | null }>)
    .filter((item) => String(item.id) !== excludeRootId)
    .map((item) => ({
      id: String(item.id),
      label: String(item.label || item.title || item.id),
      uiHtml: item.ui_html ?? null,
    }));
};

const getUsersLoadErrorMessage = (data: unknown, fallback: string): string => {
  if (!data || typeof data !== 'object') {
    return fallback;
  }

  const payload = data as { error?: string };
  return typeof payload.error === 'string' && payload.error.trim() ? payload.error : fallback;
};

export async function fetchUsersList(
  query: UsersListQuery = {},
  signal?: AbortSignal,
): Promise<{ items: UserRecord[]; totalCount: number }> {
  const searchParams = new URLSearchParams();
  appendUsersListParams(searchParams, query);
  const queryString = searchParams.toString();
  const url = queryString ? `/api/users?${queryString}` : '/api/users';

  const { data: usersData, response: usersResponse } = await apiGet<ApiListResponse>(url, { signal });

  if (!usersResponse.ok) {
    throw new Error(getUsersLoadErrorMessage(usersData, `Failed to load users (HTTP ${usersResponse.status}).`));
  }

  if (!usersData.success) {
    throw new Error(getUsersLoadErrorMessage(usersData, 'Failed to load users.'));
  }

  const items = normalizeUserItems(usersData.items ?? []);
  const totalCount = typeof usersData.totalCount === 'number'
    ? usersData.totalCount
    : items.length;

  return { items, totalCount };
}

export async function fetchUsersPageMeta(cultureId: string): Promise<UsersPageMeta> {
  const culture = cultureId.trim() || 'us';
  const [rolesResult, genderResult, personTypeResult] = await Promise.allSettled([
    apiGet<ApiListResponse<RoleRecord>>('/api/roles'),
    fetchBaseInfoOptions(PROFILE_GENDER_BASE_INFO_ROOT, culture),
    fetchBaseInfoOptions(PROFILE_PERSON_TYPE_BASE_INFO_ROOT, culture),
  ]);

  const rolesData = rolesResult.status === 'fulfilled' ? rolesResult.value.data : null;
  const genderRows = genderResult.status === 'fulfilled' ? genderResult.value : [];
  const personTypeRows = personTypeResult.status === 'fulfilled' ? personTypeResult.value : [];

  const availableRoles = rolesData?.success
    ? normalizeAvailableRoles((rolesData.items ?? []) as RoleRecord[])
    : [...FALLBACK_ROLES];

  const genderOptions = normalizeBaseInfoOptions(genderRows, PROFILE_GENDER_BASE_INFO_ROOT);
  const personTypeOptions = normalizeBaseInfoOptions(personTypeRows, PROFILE_PERSON_TYPE_BASE_INFO_ROOT);

  return {
    availableRoles,
    genderOptions,
    personTypeOptions,
  };
}

const invalidateUsersQueries = (queryClient: QueryClient) => {
  void queryClient.invalidateQueries({ queryKey: usersQueryKeys.all });
  void queryClient.refetchQueries({ queryKey: usersQueryKeys.all, type: 'active' });
};

const markUsersQueriesStale = (queryClient: QueryClient) => {
  void queryClient.invalidateQueries({
    queryKey: usersQueryKeys.all,
    refetchType: 'none',
  });
};

export const applyUsersListProfileImagePatch = (
  queryClient: QueryClient,
  userId: number,
  payload: UpdateUserProfilePayload,
  serverProfile?: UpdateUserProfileResponse['profile'],
) => {
  const clientPatch = buildProfileImageListPatch(payload);
  if (!clientPatch) return;

  patchUsersListProfileImage(queryClient, userId, {
    ...clientPatch,
    ...(serverProfile ? mapServerProfileToListPatch(serverProfile) : {}),
    list_avatar_preview: clientPatch.list_avatar_preview ?? null,
  });
  markUsersQueriesStale(queryClient);
};

const decodeBase64ByteLength = (base64: string): number => {
  const normalized = base64.replace(/=+$/, '');
  return Math.floor((normalized.length * 3) / 4);
};

const payloadTouchesProfileImage = (payload: UpdateUserProfilePayload): boolean => (
  Object.prototype.hasOwnProperty.call(payload, 'profileImageBody')
  || Object.prototype.hasOwnProperty.call(payload, 'profileImageBodyXs')
  || Object.prototype.hasOwnProperty.call(payload, 'profileImageMime')
);

const buildProfileImageListPatch = (
  payload: UpdateUserProfilePayload,
): Partial<UserRecord> | null => {
  if (!payloadTouchesProfileImage(payload)) return null;

  const profileUpdatedAt = new Date().toISOString();
  if (payload.profileImageBody === null) {
    return {
      has_profile_image_xs: false,
      has_profile_image: false,
      profile_image_size: null,
      profile_image_mime: null,
      profile_updated_at: profileUpdatedAt,
      list_avatar_preview: null,
      avatar_url: null,
    };
  }

  if (payload.profileImageBody) {
    const thumbBase64 = payload.profileImageBodyXs ?? payload.profileImageBody;
    const listAvatarPreview = thumbBase64
      ? buildDataUrlFromBase64(thumbBase64, payload.profileImageMime ?? 'image/jpeg')
      : null;
    return {
      has_profile_image_xs: true,
      has_profile_image: true,
      profile_image_size: decodeBase64ByteLength(payload.profileImageBody),
      profile_image_mime: payload.profileImageMime ?? null,
      profile_updated_at: profileUpdatedAt,
      list_avatar_preview: listAvatarPreview,
      avatar_url: null,
    };
  }

  if (payload.profileImageBodyXs) {
    return {
      has_profile_image_xs: true,
      has_profile_image: true,
      profile_image_size: decodeBase64ByteLength(payload.profileImageBodyXs),
      profile_image_mime: payload.profileImageMime ?? null,
      profile_updated_at: profileUpdatedAt,
      list_avatar_preview: buildDataUrlFromBase64(
        payload.profileImageBodyXs,
        payload.profileImageMime ?? 'image/jpeg',
      ),
      avatar_url: null,
    };
  }

  return {
    profile_updated_at: profileUpdatedAt,
    avatar_url: null,
  };
};

const mapServerProfileToListPatch = (
  profile: NonNullable<UpdateUserProfileResponse['profile']>,
): Partial<UserRecord> => ({
  has_profile_image_xs: profile.has_profile_image_xs,
  has_profile_image: profile.has_profile_image_xs,
  profile_image_size: profile.profile_image_size,
  profile_image_mime: profile.profile_image_mime,
  profile_updated_at: profile.profile_updated_at,
});

export const patchUsersListRoles = (
  queryClient: QueryClient,
  userId: number,
  roles: string[],
) => {
  const normalizedRoles = Array.from(new Set(
    roles.map((role) => String(role).toUpperCase()).filter(Boolean),
  ));
  queryClient.setQueriesData<{ items: UserRecord[]; totalCount: number }>(
    { queryKey: usersQueryKeys.all },
    (cached) => {
      if (!cached?.items) return cached;
      return {
        ...cached,
        items: cached.items.map((user) => (
          user.id !== userId
            ? user
            : {
              ...user,
              roles: normalizedRoles,
              role: normalizedRoles[0] ?? '',
            }
        )),
      };
    },
  );
};

const patchUsersListProfileImage = (
  queryClient: QueryClient,
  userId: number,
  patch: Partial<UserRecord>,
) => {
  queryClient.setQueriesData<{ items: UserRecord[]; totalCount: number }>(
    { queryKey: usersQueryKeys.all },
    (cached) => {
      if (!cached?.items) return cached;
      return {
        ...cached,
        items: cached.items.map((user) => {
          if (user.id !== userId) return user;
          const nextUser = { ...user, ...patch };
          return {
            ...nextUser,
            avatar_url: resolveListUserAvatarSrc(nextUser),
          };
        }),
      };
    },
  );
};

export function useUsersPageMetaQuery() {
  const { cultureId } = useCulture();
  return useQuery({
    queryKey: usersQueryKeys.meta(cultureId),
    queryFn: () => fetchUsersPageMeta(cultureId),
  });
}

export function useUsersListQuery(params: UsersListQuery, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: usersQueryKeys.list(params),
    queryFn: async ({ signal, client }) => {
      const previews = new Map<number, string>();
      client.getQueriesData<{ items: UserRecord[]; totalCount: number }>({
        queryKey: usersQueryKeys.all,
      }).forEach(([, cached]) => {
        cached?.items?.forEach((user) => {
          if (user.list_avatar_preview) {
            previews.set(user.id, user.list_avatar_preview);
          }
        });
      });

      const result = await fetchUsersList(params, signal);
      if (previews.size === 0) return result;

      return {
        ...result,
        items: result.items.map((user) => {
          const preview = previews.get(user.id);
          return preview ? { ...user, list_avatar_preview: preview } : user;
        }),
      };
    },
    enabled: options?.enabled ?? true,
    structuralSharing: false,
    ...RECORDS_LIST_QUERY_OPTIONS,
  });
}

export function useCreateUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateUserPayload) => apiPost('/api/users', payload),
    onSuccess: ({ data }) => {
      if (data.success) {
        invalidateUsersQueries(queryClient);
      }
    },
  });
}

export function useUpdateUserProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, payload }: { userId: number; payload: UpdateUserProfilePayload }) =>
      apiPut<UpdateUserProfileResponse>(`/api/users/${userId}/profile`, payload),
    onSuccess: ({ data }, variables) => {
      if (data.success) {
        if (payloadTouchesProfileImage(variables.payload)) {
          applyUsersListProfileImagePatch(
            queryClient,
            variables.userId,
            variables.payload,
            data.profile,
          );
        } else {
          invalidateUsersQueries(queryClient);
        }
      }
    },
  });
}

export function useUpdateUserRolesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, payload }: { userId: number; payload: UpdateUserRolesPayload }) =>
      apiPut(`/api/users/${userId}/roles`, payload),
    onSuccess: ({ data }, variables) => {
      if (data.success) {
        patchUsersListRoles(queryClient, variables.userId, variables.payload.roles);
        invalidateUsersQueries(queryClient);
      }
    },
  });
}

export function useChangePasswordMutation() {
  return useMutation({
    mutationFn: ({ userId, payload }: { userId: number; payload: ChangePasswordPayload }) =>
      apiPost(`/api/users/${userId}/change-password`, payload),
  });
}

export function useResetPasswordMutation() {
  return useMutation({
    mutationFn: (userId: number) => apiPost(`/api/users/${userId}/reset-password`),
  });
}

export function useDeleteUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, payload }: { userId: number; payload?: Record<string, unknown> }) =>
      apiDelete(`/api/users/${userId}`, payload),
    onSuccess: ({ data }) => {
      if (data.success) {
        invalidateUsersQueries(queryClient);
      }
    },
  });
}

export function useLockUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: number) => apiPatch(`/api/users/${userId}/lock`),
    onSuccess: ({ data }) => {
      if (data.success) {
        invalidateUsersQueries(queryClient);
      }
    },
  });
}

export function useUnlockUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: number) => apiPatch(`/api/users/${userId}/unlock`),
    onSuccess: ({ data }) => {
      if (data.success) {
        invalidateUsersQueries(queryClient);
      }
    },
  });
}

export function useSetUserLockedMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, locked, __changeReasonCode, __changeReasonText }: {
      userId: number;
      locked: boolean;
      __changeReasonCode?: string;
      __changeReasonText?: string;
    }) =>
      apiPatch(`/api/users/${userId}/locked`, {
        locked,
        __changeReasonCode,
        __changeReasonText,
      }),
    onSuccess: ({ data }) => {
      if (data.success) {
        invalidateUsersQueries(queryClient);
      }
    },
  });
}
