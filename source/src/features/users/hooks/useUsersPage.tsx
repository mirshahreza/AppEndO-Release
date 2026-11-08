import { useCallback, useEffect, useMemo, useRef, useState, type UIEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { areColumnLayoutsEqual } from '../../../shared/lib/appTableGridColumnLayout';
import { mapGridQueryToUsersListQuery } from '../../../shared/api/contracts/users/listQuery';
import { isAdminUser } from '../../../app/guards/roleAccess';
import { useAuth } from '../../../contexts/AuthContext';
import { APP_GRID_IDS } from '../../../shared/api/contracts/grids/gridIds';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import { useGridColumnLayout } from '../../../shared/lib/useGridColumnLayout';
import { useGridQueryState } from '../../../shared/lib/useGridQueryState';
import { usePersistedListPaging } from '../../../shared/lib/usePersistedListPreferences';
import { useEntityFunctionAccessModalState } from '../../../shared/ui/EntityFunctionAccessModal';
import type { UserRecord } from '../../../shared/api/queries/users';
import { useUsersPageMetaQuery, usersQueryKeys } from '../../../shared/api/queries/users';
import { DEFAULT_PAGE_SIZE, DEFAULT_AVAILABLE_ROLES, USER_SORT_FIELDS } from '../constants';
import type { UserTableActionHandlers } from '../types';
import { useCultureT } from '../../../core/culture/CultureContext';
import {
  createUserCardRowActions,
  createUserGridColumns,
  normalizeUsersGridColumnLayout,
  USER_GRID_QUERY_COLUMNS,
} from '../userGridColumns';
import { userHasAdminRole } from '../utils';
import { useUsersList } from './useUsersList';
import { useUsersModals } from './useUsersModals';
import { useUsersMutations } from './useUsersMutations';
import {
  USERS_WHERE_OPERATORS,
} from '../../../shared/api/contracts/users/usersListWhere';
import { serializeListWhereTree, useListFilter } from '../../../shared/ui';
import { useUsersPagingState, useUsersToolbarFilters, buildUsersPagingFooter } from './useUsersPagination';
import { useUsersOverlayDeepLink } from './useUsersOverlayDeepLink';
import type { EditMode } from '../types';

export function useUsersPage() {
  const t = useCultureT();
  const queryClient = useQueryClient();
  const { loginAs, currentUser } = useAuth();
  const modals = useUsersModals();
  const {
    open: openUserFunctionAccess,
    modalProps: userFunctionAccessModalProps,
  } = useEntityFunctionAccessModalState('user', {
    onPersisted: () => modals.showToast('success', 'User server function access updated.'),
  });

  const { pageSize, setPageSize, listMode, setListMode } = usePersistedListPaging({
    listKey: APP_LIST_PREFERENCE_KEYS.users,
    defaultPageSize: DEFAULT_PAGE_SIZE,
  });

  const isAdmin = useMemo(() => isAdminUser(currentUser), [currentUser]);

  const metaQuery = useUsersPageMetaQuery();
  const personTypeOptions = useMemo(
    () => (metaQuery.data?.personTypeOptions ?? []).map((option) => ({
      value: option.id,
      label: option.label,
    })),
    [metaQuery.data?.personTypeOptions],
  );
  const toolbar = useUsersToolbarFilters(metaQuery.data?.availableRoles ?? DEFAULT_AVAILABLE_ROLES);
  const listFilter = useListFilter({
    value: toolbar.where,
    fields: toolbar.whereFields,
    operators: USERS_WHERE_OPERATORS,
    onApply: toolbar.setWhere,
  });
  const { filterActive } = listFilter;
  const skipInitialMatchInvalidationRef = useRef(true);

  useEffect(() => {
    if (skipInitialMatchInvalidationRef.current) {
      skipInitialMatchInvalidationRef.current = false;
      return;
    }
    void queryClient.invalidateQueries({
      queryKey: usersQueryKeys.all,
      refetchType: 'active',
    });
  }, [toolbar.roleMatchLogic, queryClient]);

  const {
    query,
    handleGridQueryChange,
    setFooterSort,
    getFooterSort,
    getFooterSortBy,
  } = useGridQueryState({
    columns: USER_GRID_QUERY_COLUMNS,
    gridQueryMode: 'server',
    persistListKey: APP_LIST_PREFERENCE_KEYS.users,
  });

  const gridListParams = useMemo(
    () => mapGridQueryToUsersListQuery(query),
    [query],
  );

  const pagingResetKeys = useMemo(
    () => [
      gridListParams,
      toolbar.searchText,
      toolbar.selectedRoleNames,
      toolbar.roleMatchLogic,
      toolbar.personTypeCode,
      filterActive,
      toolbar.where,
    ],
    [
      gridListParams,
      toolbar.searchText,
      toolbar.selectedRoleNames,
      toolbar.roleMatchLogic,
      toolbar.personTypeCode,
      filterActive,
      toolbar.where,
    ],
  );

  const paging = useUsersPagingState({
    pageSize,
    listMode,
    resetKeys: pagingResetKeys,
  });

  const listParams = useMemo(
    () => ({
      ...gridListParams,
      search: toolbar.searchText.trim() || undefined,
      roleNames: toolbar.selectedRoleNames,
      roleMatch: toolbar.roleMatchLogic,
      personTypeCode: toolbar.personTypeCode || undefined,
      ...(filterActive ? { where: serializeListWhereTree(toolbar.where) } : {}),
      ...paging.listQueryPaging,
    }),
    [
      filterActive,
      gridListParams,
      paging.listQueryPaging,
      toolbar.searchText,
      toolbar.selectedRoleNames,
      toolbar.roleMatchLogic,
      toolbar.personTypeCode,
      toolbar.where,
    ],
  );

  const list = useUsersList(listParams, true, {
    availableRoles: metaQuery.data?.availableRoles ?? DEFAULT_AVAILABLE_ROLES,
    genderOptions: metaQuery.data?.genderOptions ?? [],
    personTypeOptions: metaQuery.data?.personTypeOptions ?? [],
    isMetaLoading: metaQuery.isLoading,
    isMetaError: metaQuery.isError,
    metaError: metaQuery.error,
    refetchMeta: () => { void metaQuery.refetch(); },
  });

  const pagingFooter = buildUsersPagingFooter({
    totalCount: list.totalCount,
    pageSize,
    listMode,
    page: paging.page,
    infiniteVisibleCount: paging.infiniteVisibleCount,
  });

  const onGridScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    paging.handleScrollEnd(event, list.totalCount, pagingFooter.hasMore);
  }, [list.totalCount, paging, pagingFooter.hasMore]);

  const mutations = useUsersMutations({
    ...modals,
    isAdmin,
    loginAs,
  });

  const handleEditSubmit = (reason?: { code: string; text: string }) => {
    if (modals.editMode === 'profile') {
      void mutations.saveUserProfile(reason);
    }
  };

  const openEditFunctionAccess = useCallback((user: UserRecord) => {
    const label = user.username?.trim() || user.email?.trim() || `User #${user.id}`;
    openUserFunctionAccess(String(user.id), label);
  }, [openUserFunctionAccess]);

  const [historyUser, setHistoryUser] = useState<UserRecord | null>(null);

  const tableActions = useMemo<UserTableActionHandlers>(() => ({
    onOpenEditProfile: mutations.openEditProfile,
    onOpenEditRoles: mutations.openEditRoles,
    onOpenEditAttributes: mutations.openEditAttributes,
    onEditFunctionAccess: openEditFunctionAccess,
    onStartChangePassword: modals.startChangePassword,
    onStartResetPassword: modals.startResetPassword,
    onToggleLocked: mutations.handleToggleLocked,
    onLoginAs: mutations.handleLoginAs,
    onRequestDelete: mutations.setDeleteUser,
    onOpenHistory: setHistoryUser,
  }), [
    mutations.openEditProfile,
    mutations.openEditRoles,
    mutations.openEditAttributes,
    openEditFunctionAccess,
    modals.startChangePassword,
    modals.startResetPassword,
    mutations.handleToggleLocked,
    mutations.handleLoginAs,
    mutations.setDeleteUser,
  ]);

  const gridColumnHandlers = useMemo(
    () => ({
      ...tableActions,
      getGenderOption: list.getGenderOption,
      getPersonTypeOption: list.getPersonTypeOption,
      renderActorLabel: list.renderActorLabel,
      getAvatarSrc: list.getAvatarSrc,
      currentUserId: list.currentUserId,
      isAdmin: list.isAdmin,
      isLoggingInAs: modals.isLoggingInAs,
    }),
    [
      tableActions,
      list.getGenderOption,
      list.getPersonTypeOption,
      list.renderActorLabel,
      list.getAvatarSrc,
      list.currentUserId,
      list.isAdmin,
      modals.isLoggingInAs,
    ],
  );

  const gridColumns = useMemo(
    () => createUserGridColumns(gridColumnHandlers, t),
    [gridColumnHandlers, t],
  );

  const getCardRowActions = useCallback(
    (user: UserRecord) => createUserCardRowActions(user, gridColumnHandlers, t),
    [gridColumnHandlers, t],
  );

  const {
    layout: columnLayout,
    setLayout: handleColumnLayoutChange,
  } = useGridColumnLayout({
    columns: gridColumns,
    gridId: APP_GRID_IDS.users,
  });

  useEffect(() => {
    const normalized = normalizeUsersGridColumnLayout(columnLayout);
    if (!areColumnLayoutsEqual(columnLayout, normalized)) {
      handleColumnLayoutChange(normalized, { source: 'reset' });
    }
  }, [columnLayout, handleColumnLayoutChange]);

  const footerSort = getFooterSort(USER_SORT_FIELDS);
  const sortBy = getFooterSortBy(USER_SORT_FIELDS, 'created_at');
  const sortDirection = footerSort.sortDirection;

  const openEditFromUrl = useCallback((userId: number, mode: EditMode) => {
    const user = list.users.find((item) => item.id === userId);
    if (user) {
      modals.openEditByMode(user, mode);
    }
  }, [list.users, modals]);

  useUsersOverlayDeepLink({
    showCreateModal: modals.showCreateModal,
    openCreateIndividualModal: modals.openCreateIndividualModal,
    filterDialogOpen: listFilter.filterOpen,
    setFilterDialogOpen: (open: boolean) => {
      if (open) {
        listFilter.openFilter();
      } else {
        listFilter.closeFilter();
      }
    },
    editMode: modals.editMode,
    editingUserId: modals.editingUser?.id ?? null,
    deleteUserId: modals.deleteUser?.id ?? null,
    changePasswordUserId: modals.changePasswordUser?.id ?? null,
    resetPasswordUserId: modals.resetPasswordUser?.id ?? null,
    lockConfirmUserId: modals.lockConfirmUser?.id ?? null,
    openEditFromUrl,
  });

  return {
    isLoading: list.isLoading,
    isError: list.isError,
    error: list.error,
    retryLoadUsers: list.retryLoadUsers,
    isRefreshingUsers: list.isRefreshingUsers,
    isRetryingUsers: list.isRetryingUsers,
    toast: modals.toast,
    availableRoles: list.availableRoles,
    genderOptions: list.genderOptions,
    personTypeOptions: list.personTypeOptions,
    searchInput: toolbar.searchInput,
    setSearchInput: toolbar.setSearchInput,
    roleFilters: toolbar.roleFilters,
    setRoleFilters: toolbar.setRoleFilters,
    roleMatchLogic: toolbar.roleMatchLogic,
    setRoleMatchLogic: toolbar.setRoleMatchLogic,
    personTypeFilterOptions: personTypeOptions,
    personTypeCode: toolbar.personTypeCode,
    setPersonTypeCode: toolbar.setPersonTypeCode,
    openCreateModal: modals.openCreateModal,
    openCreateIndividualModal: modals.openCreateIndividualModal,
    openCreateCompanyModal: modals.openCreateCompanyModal,
    showCreateModal: modals.showCreateModal,
    setShowCreateModal: modals.setShowCreateModal,
    createPersonTypeCode: modals.createPersonTypeCode,
    closeCreateModal: modals.closeCreateModal,
    form: modals.form,
    setForm: modals.setForm,
    formError: modals.formError,
    setFormError: modals.setFormError,
    handleCreate: mutations.handleCreate,
    createUserMutation: mutations.createUserMutation,
    setCreateRoleChecked: modals.setCreateRoleChecked,
    onCreateImageSelected: modals.onCreateImageSelected,
    editingUser: modals.editingUser,
    editMode: modals.editMode,
    editForm: modals.editForm,
    setEditForm: modals.setEditForm,
    editError: modals.editError,
    setEditError: modals.setEditError,
    cancelEdit: modals.cancelEdit,
    handleEditSubmit,
    saveUserRoles: mutations.saveUserRoles,
    saveUserAttributes: mutations.saveUserAttributes,
    isEditSaving: mutations.isEditSaving,
    setEditRoleChecked: modals.setEditRoleChecked,
    attributeValues: modals.attributeValues,
    setAttributeValues: modals.setAttributeValues,
    onEditImageSelected: modals.onEditImageSelected,
    changePasswordUser: modals.changePasswordUser,
    setChangePasswordUser: modals.setChangePasswordUser,
    newPassword: modals.newPassword,
    setNewPassword: modals.setNewPassword,
    confirmPassword: modals.confirmPassword,
    setConfirmPassword: modals.setConfirmPassword,
    changePasswordError: modals.changePasswordError,
    submitChangePassword: mutations.submitChangePassword,
    changePasswordMutation: mutations.changePasswordMutation,
    resetPasswordUser: modals.resetPasswordUser,
    setResetPasswordUser: modals.setResetPasswordUser,
    resetError: modals.resetError,
    submitResetPassword: mutations.submitResetPassword,
    resetPasswordMutation: mutations.resetPasswordMutation,
    deleteUser: modals.deleteUser,
    setDeleteUser: modals.setDeleteUser,
    confirmDelete: mutations.confirmDelete,
    isDeletingUser: mutations.deleteUserMutation.isPending,
    lockConfirmUser: modals.lockConfirmUser,
    setLockConfirmUser: modals.setLockConfirmUser,
    confirmToggleLocked: mutations.confirmToggleLocked,
    setUserLockedMutation: mutations.setUserLockedMutation,
    userFunctionAccessModalProps,
    gridColumns,
    getCardRowActions,
    columnLayout,
    handleColumnLayoutChange,
    query,
    handleGridQueryChange,
    displayUsers: list.users,
    orderedUsersCount: list.totalCount,
    getGenderOption: list.getGenderOption,
    getPersonTypeOption: list.getPersonTypeOption,
    renderActorLabel: list.renderActorLabel,
    getAvatarSrc: list.getAvatarSrc,
    currentUserId: list.currentUserId,
    isAdmin: list.isAdmin,
    isLoggingInAs: modals.isLoggingInAs,
    pageSize,
    setPageSize,
    listMode,
    setListMode,
    sortBy,
    sortDirection,
    setFooterSort,
    safePage: pagingFooter.safePage,
    totalPages: pagingFooter.totalPages,
    pageNumbers: pagingFooter.pageNumbers,
    setPage: paging.setPage,
    visibleInfiniteCount: pagingFooter.visibleInfiniteCount,
    onGridScroll,
    tableActions,
    historyUser,
    closeHistory: () => setHistoryUser(null),
    whereFields: toolbar.whereFields,
    filterOperators: USERS_WHERE_OPERATORS,
    ...listFilter,
  };
}

export type UsersPageState = ReturnType<typeof useUsersPage>;
