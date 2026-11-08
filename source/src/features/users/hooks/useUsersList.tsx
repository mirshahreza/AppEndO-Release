import { useCallback, useMemo } from 'react';
import { formatQueryError } from '../../../shared/api/client';
import { resolveListUserAvatarSrc } from '../../../shared/api/contracts/users/avatar';
import type { UsersListQuery } from '../../../shared/api/queries/users';
import { useUsersListQuery } from '../../../shared/api/queries/users';
import { isAdminUser } from '../../../app/guards/roleAccess';
import { useAuth } from '../../../contexts/AuthContext';
import type { BaseInfoOption } from '../../../shared/api/queries/users';

export function useUsersList(
  listParams: UsersListQuery,
  enabled: boolean,
  meta: {
    availableRoles: string[];
    genderOptions: BaseInfoOption[];
    personTypeOptions: BaseInfoOption[];
    isMetaLoading: boolean;
    isMetaError: boolean;
    metaError: unknown;
    refetchMeta: () => void;
  },
) {
  const { currentUser } = useAuth();
  const usersQuery = useUsersListQuery(listParams, { enabled });

  const users = enabled ? (usersQuery.data?.items ?? []) : [];
  const totalCount = enabled ? (usersQuery.data?.totalCount ?? 0) : 0;

  const isLoading = meta.isMetaLoading || (enabled && usersQuery.isLoading);
  const isError = meta.isMetaError || usersQuery.isError;
  const error = isError
    ? formatQueryError(
      meta.metaError ?? usersQuery.error,
      'Failed to load users.',
    )
    : null;

  const retryLoadUsers = useCallback(() => {
    meta.refetchMeta();
    if (enabled) {
      void usersQuery.refetch();
    }
  }, [enabled, meta, usersQuery]);

  const genderOptionById = useMemo(() => {
    return new Map(meta.genderOptions.map((option) => [option.id, option]));
  }, [meta.genderOptions]);

  const personTypeOptionById = useMemo(() => {
    return new Map(meta.personTypeOptions.map((option) => [option.id, option]));
  }, [meta.personTypeOptions]);

  const getGenderOption = useCallback((code?: string | null) => {
    if (!code) return null;
    return genderOptionById.get(code) ?? null;
  }, [genderOptionById]);

  const getPersonTypeOption = useCallback((code?: string | null) => {
    if (!code) return null;
    return personTypeOptionById.get(code) ?? null;
  }, [personTypeOptionById]);

  const actorUsernameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const user of users) {
      if (user.username) {
        map.set(user.id, user.username);
      }
    }
    return map;
  }, [users]);

  const renderActorLabel = useCallback((username?: string | null, actorId?: number | null) => {
    const label = username || (actorId ? actorUsernameById.get(actorId) : undefined) || (actorId ? `#${actorId}` : null);
    if (!label) return <span className="text-slate-300">-</span>;
    return <span className="text-slate-600">{label}</span>;
  }, [actorUsernameById]);

  const getAvatarSrc = useCallback((user: {
    id: number;
    avatar_url?: string | null;
    has_profile_image_xs?: boolean;
    profile_image_size?: number | null;
    profile_updated_at?: string | null;
    list_avatar_preview?: string | null;
  }) => resolveListUserAvatarSrc(user), []);

  const isAdmin = useMemo(() => isAdminUser(currentUser), [currentUser]);

  return {
    isLoading,
    isError,
    error,
    retryLoadUsers,
    isRefreshingUsers: usersQuery.isFetching,
    isRetryingUsers: usersQuery.isFetching && isError,
    users,
    totalCount,
    availableRoles: meta.availableRoles,
    genderOptions: meta.genderOptions,
    personTypeOptions: meta.personTypeOptions,
    getGenderOption,
    getPersonTypeOption,
    renderActorLabel,
    getAvatarSrc,
    currentUserId: currentUser?.id,
    isAdmin,
  };
}
