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
import { UserHistoryDialog } from './UserHistoryDialog';
import { EntityFunctionAccessModal } from '../../../shared/ui/EntityFunctionAccessModal';
import { ListFilterDialog, ListFilterSummaryBand, ListPageShell } from '../../../shared/ui';

export type UsersPageViewProps = {
  page: UsersPageState;
};

export const UsersPageView: React.FC<UsersPageViewProps> = ({ page }) => (
  <ListPageShell onGridScroll={page.onGridScroll}>
    <UserFilterToolbar
      searchInput={page.searchInput}
      onSearchInputChange={page.setSearchInput}
      availableRoles={page.availableRoles}
      roleFilters={page.roleFilters}
      roleMatchLogic={page.roleMatchLogic}
      onRoleMatchLogicChange={page.setRoleMatchLogic}
      onRoleFiltersChange={page.setRoleFilters}
      personTypeOptions={page.personTypeFilterOptions}
      personTypeCode={page.personTypeCode}
      onPersonTypeCodeChange={page.setPersonTypeCode}
      onAddIndividualUser={page.openCreateIndividualModal}
      onAddCompanyUser={page.openCreateCompanyModal}
      onRefresh={page.retryLoadUsers}
      isRefreshing={page.isRefreshingUsers}
      filterButtonProps={page.filterButtonProps}
    />
    <ListFilterSummaryBand {...page.filterSummaryProps} />

    <div className="flex min-h-0 w-full flex-1 flex-col">
      <UserTableGrid
      isLoading={page.isLoading}
      isError={page.isError}
      error={page.error}
      onRetry={page.retryLoadUsers}
      isRetrying={page.isRetryingUsers}
      columns={page.gridColumns}
      getCardRowActions={page.getCardRowActions}
      columnLayout={page.columnLayout}
      handleColumnLayoutChange={page.handleColumnLayoutChange}
      rows={page.displayUsers}
      query={page.query}
      onQueryChange={page.handleGridQueryChange}
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
    </div>

    <UserCreateWizardModal
      key={page.showCreateModal ? (page.createPersonTypeCode ?? page.form.personTypeCode) : 'closed'}
      open={page.showCreateModal}
      layoutPersonTypeCode={page.createPersonTypeCode ?? page.form.personTypeCode}
      form={page.form}
      onFormChange={page.setForm}
      availableRoles={page.availableRoles}
      genderOptions={page.genderOptions}
      personTypeOptions={page.personTypeOptions}
      formError={page.formError}
      onFormError={page.setFormError}
      isSaving={page.createUserMutation.isPending}
      onSetCreateRoleChecked={page.setCreateRoleChecked}
      onCreateImageSelected={page.onCreateImageSelected}
      onClose={page.closeCreateModal}
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
      onSetEditRoleChecked={page.setEditRoleChecked}
      onClose={page.cancelEdit}
      onSubmit={(reason) => void page.saveUserRoles(reason)}
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
      onConfirm={(reason) => void page.confirmDelete(reason)}
    />

    <UserLockConfirmModal
      user={page.lockConfirmUser}
      isSaving={page.setUserLockedMutation.isPending}
      onCancel={() => page.setLockConfirmUser(null)}
      onConfirm={(reason) => void page.confirmToggleLocked(reason)}
    />

    <UserHistoryDialog
      userId={page.historyUser?.id ?? null}
      title={page.historyUser ? `History · ${page.historyUser.username}` : 'History'}
      open={Boolean(page.historyUser)}
      onClose={page.closeHistory}
    />

    <UsersToast toast={page.toast} />
    <ListFilterDialog {...page.filterDialogProps} />
  </ListPageShell>
);
