import React from 'react';
import type { UsersPageState } from '../hooks/useUsersPage';
import { USER_SORT_FIELDS } from '../constants';
import {
  UserChangePasswordModal,
  UserDeleteConfirmModal,
  UserLockConfirmModal,
  UserCreateWizardModal,
  UserFilterToolbar,
  UserFormModal,
  UserAttributesModal,
  UserResetPasswordModal,
  UserRolesModal,
  UsersToast,
  UserTableGrid,
} from './index';
import { EntityFunctionAccessModal } from '@/src/shared/ui/EntityFunctionAccessModal';

export type UsersPageViewProps = {
  page: UsersPageState;
};

export const UsersPageView: React.FC<UsersPageViewProps> = ({ page }) => (
  <div className="w-full h-full flex flex-col bg-white font-sans">
    <UserFilterToolbar
      searchInput={page.searchInput}
      onSearchInputChange={page.setSearchInput}
      availableRoles={page.availableRoles}
      roleFilters={page.roleFilters}
      onRoleFilterChange={(role, checked) => page.setRoleFilters((prev) => ({ ...prev, [role]: checked }))}
      onAddUser={page.openCreateModal}
      onRefresh={page.retryLoadUsers}
      isRefreshing={page.isRefreshingUsers}
    />

    <UserTableGrid
      isLoading={page.isLoading}
      isError={page.isError}
      error={page.error}
      onRetry={page.retryLoadUsers}
      isRetrying={page.isRetryingUsers}
      columns={page.gridColumns}
      columnLayout={page.columnLayout}
      handleColumnLayoutChange={page.handleColumnLayoutChange}
      rows={page.displayUsers}
      query={page.query}
      onQueryChange={page.handleGridQueryChange}
      onScroll={page.handleGridScroll}
      orderedUsersCount={page.orderedUsersCount}
      pageSize={page.pageSize}
      onPageSizeChange={page.setPageSize}
      listMode={page.listMode}
      onListModeChange={page.setListMode}
      sortBy={page.sortBy}
      sortDirection={page.sortDirection}
      onSortByChange={(value) => page.setFooterSort(value, page.sortDirection, USER_SORT_FIELDS)}
      onSortDirectionChange={(value) => page.setFooterSort(page.sortBy, value, USER_SORT_FIELDS)}
      safePage={page.safePage}
      totalPages={page.totalPages}
      pageNumbers={page.pageNumbers}
      onPageChange={page.setPage}
      visibleInfiniteCount={page.visibleInfiniteCount}
    />

    <UserCreateWizardModal
      open={page.showCreateModal}
      form={page.form}
      onFormChange={page.setForm}
      availableRoles={page.availableRoles}
      genderOptions={page.genderOptions}
      personTypeOptions={page.personTypeOptions}
      formError={page.formError}
      onFormError={page.setFormError}
      isSaving={page.createUserMutation.isPending}
      onToggleCreateRole={page.toggleCreateRole}
      onCreateImageSelected={page.onCreateImageSelected}
      onClose={() => page.setShowCreateModal(false)}
      onSubmit={() => void page.handleCreate()}
      onImageReadError={() => page.setFormError('Failed to read selected image.')}
    />

    {page.editingUser && page.editMode === 'profile' ? (
      <UserFormModal
        open
        editingUser={page.editingUser}
        editForm={page.editForm}
        onEditFormChange={page.setEditForm}
        genderOptions={page.genderOptions}
        personTypeOptions={page.personTypeOptions}
        editError={page.editError}
        isSaving={page.isEditSaving}
        onEditImageSelected={page.onEditImageSelected}
        onClose={page.cancelEdit}
        onSubmit={page.handleEditSubmit}
        onImageReadError={() => page.setEditError('Failed to read selected image.')}
      />
    ) : null}

    <UserRolesModal
      open={Boolean(page.editingUser && page.editMode === 'roles')}
      editingUser={page.editingUser}
      editForm={page.editForm}
      availableRoles={page.availableRoles}
      editError={page.editError}
      isSaving={page.isEditSaving}
      onToggleEditRole={page.toggleEditRole}
      onClose={page.cancelEdit}
      onSubmit={() => void page.saveUserRoles()}
    />

    <UserAttributesModal
      open={Boolean(page.editingUser && page.editMode === 'attributes')}
      editingUser={page.editingUser}
      editError={page.editError}
      isSaving={page.isEditSaving}
      valuesBySettingsAttributeId={page.attributeValues}
      onValuesChange={page.setAttributeValues}
      onClose={page.cancelEdit}
      onSubmit={() => void page.saveUserAttributes()}
    />

    <EntityFunctionAccessModal {...page.userFunctionAccessModalProps} />

    <UserChangePasswordModal
      user={page.changePasswordUser}
      newPassword={page.newPassword}
      confirmPassword={page.confirmPassword}
      error={page.changePasswordError}
      isSaving={page.changePasswordMutation.isPending}
      onNewPasswordChange={page.setNewPassword}
      onConfirmPasswordChange={page.setConfirmPassword}
      onClose={() => page.setChangePasswordUser(null)}
      onSubmit={() => void page.submitChangePassword()}
    />

    <UserResetPasswordModal
      user={page.resetPasswordUser}
      error={page.resetError}
      isSaving={page.resetPasswordMutation.isPending}
      onClose={() => page.setResetPasswordUser(null)}
      onSubmit={() => void page.submitResetPassword()}
    />

    <UserDeleteConfirmModal
      user={page.deleteUser}
      isDeleting={page.isDeletingUser}
      onCancel={() => page.setDeleteUser(null)}
      onConfirm={() => void page.confirmDelete()}
    />

    <UserLockConfirmModal
      user={page.lockConfirmUser}
      isSaving={page.setUserLockedMutation.isPending}
      onCancel={() => page.setLockConfirmUser(null)}
      onConfirm={() => void page.confirmToggleLocked()}
    />

    <UsersToast toast={page.toast} />
  </div>
);
