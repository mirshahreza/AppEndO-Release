import { useCallback, useEffect, useMemo, useState, type UIEvent } from 'react';
import { areColumnLayoutsEqual } from '@/shared/lib/appTableGridColumnLayout';
import { mapGridQueryToUsersListQuery } from '@/shared/api/contracts/users/listQuery';
import { isAdminUser } from '@/app/guards/roleAccess';
import { useAuth } from '@/contexts/AuthContext';
import { DEFAULT_GRID_LIST_MODE, type GridListMode } from '@/shared/lib/gridPagingConstants';
import { APP_GRID_IDS } from '@/shared/api/contracts/grids/gridIds';
import { useGridColumnLayout } from '@/shared/lib/useGridColumnLayout';
import { useGridQueryState } from '@/shared/lib/useGridQueryState';
import { useEntityFunctionAccessModalState } from '@/shared/ui/EntityFunctionAccessModal';
import type { UserRecord } from '@/shared/api/queries/users';
import { useUsersPageMetaQuery } from '@/shared/api/queries/users';
import { DEFAULT_PAGE_SIZE, DEFAULT_AVAILABLE_ROLES, USER_SORT_FIELDS } from '../constants';
import type { UserTableActionHandlers } from '../types';
import { useCultureT } from '@/core/culture/CultureContext';
import { createUserGridColumns, normalizeUsersGridColumnLayout, USER_GRID_QUERY_COLUMNS } from '../userGridColumns';
import { userHasAdminRole } from '../utils';
import { useUsersList } from './useUsersList';
import { useUsersModals } from './useUsersModals';
import { useUsersMutations } from './useUsersMutations';
import { useUsersPagingState, useUsersToolbarFilters, buildUsersPagingFooter } from './useUsersPagination';

export function useUsersPage() {
  const t = useCultureT();
  const { loginAs, currentUser } = useAuth();
  const modals = useUsersModals();
  const {
    open: openUserFunctionAccess,
    modalProps: userFunctionAccessModalProps,
  } = useEntityFunctionAccessModalState('user', {
    onPersisted: () => modals.showToast('success', 'User server function access updated.'),
  });

  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [listMode, setListMode] = useState<GridListMode>(DEFAULT_GRID_LIST_MODE);

  const isAdmin = useMemo(() => isAdminUser(currentUser), [currentUser]);

  const metaQuery = useUsersPageMetaQuery();
  const toolbar = useUsersToolbarFilters(metaQuery.data?.availableRoles ?? DEFAULT_AVAILABLE_ROLES);

  const {
    query,
    handleGridQueryChange,
    setFooterSort,
    getFooterSort,
    getFooterSortBy,
  } = useGridQueryState({
    columns: USER_GRID_QUERY_COLUMNS,
    gridQueryMode: 'server',
  });

  const gridListParams = useMemo(
    () => mapGridQueryToUsersListQuery(query),
    [query],
  );

  const pagingResetKeys = useMemo(
    () => [gridListParams, toolbar.searchText, toolbar.selectedRoleNames],
    [gridListParams, toolbar.searchText, toolbar.selectedRoleNames],
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
      ...paging.listQueryPaging,
    }),
    [
      gridListParams,
      paging.listQueryPaging,
      toolbar.searchText,
      toolbar.selectedRoleNames,
    ],
  );

  const list = useUsersList(listParams, toolbar.hasRoleSelection, {
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

  const handleGridScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    paging.handleScrollEnd(event, list.totalCount, pagingFooter.hasMore);
  }, [list.totalCount, paging, pagingFooter.hasMore]);

  const mutations = useUsersMutations({
    ...modals,
    isAdmin,
    loginAs,
  });

  const handleEditSubmit = () => {
    if (modals.editMode === 'profile') {
      void mutations.saveUserProfile();
    }
  };

  const openEditFunctionAccess = useCallback((user: UserRecord) => {
    if (userHasAdminRole(user)) return;
    const label = user.username?.trim() || user.email?.trim() || `User #${user.id}`;
    openUserFunctionAccess(String(user.id), label);
  }, [openUserFunctionAccess]);

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

  const gridColumns = useMemo(
    () => createUserGridColumns({
      ...tableActions,
      getGenderOption: list.getGenderOption,
      getPersonTypeOption: list.getPersonTypeOption,
      renderActorLabel: list.renderActorLabel,
      getAvatarSrc: list.getAvatarSrc,
      currentUserId: list.currentUserId,
      isAdmin: list.isAdmin,
      isLoggingInAs: modals.isLoggingInAs,
    }, t),
    [
      list.getGenderOption,
      list.getPersonTypeOption,
      list.renderActorLabel,
      list.getAvatarSrc,
      list.currentUserId,
      list.isAdmin,
      modals.isLoggingInAs,
      tableActions,
      t,
    ],
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
    openCreateModal: modals.openCreateModal,
    showCreateModal: modals.showCreateModal,
    setShowCreateModal: modals.setShowCreateModal,
    form: modals.form,
    setForm: modals.setForm,
    formError: modals.formError,
    setFormError: modals.setFormError,
    handleCreate: mutations.handleCreate,
    createUserMutation: mutations.createUserMutation,
    toggleCreateRole: modals.toggleCreateRole,
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
    toggleEditRole: modals.toggleEditRole,
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
    handleGridScroll,
    tableActions,
  };
}

export type UsersPageState = ReturnType<typeof useUsersPage>;
