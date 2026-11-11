import React from 'react';
import type { RolesPageState } from '../hooks/useRolesPage';
import { RoleAttributesModal } from './RoleAttributesModal';
import { RoleCreateModal } from './RoleCreateModal';
import { RoleDeleteModal } from './RoleDeleteModal';
import { RoleEditModal } from './RoleEditModal';
import { RoleMcpAccessModal } from './RoleMcpAccessModal';
import { EntityFunctionAccessModal } from '@/shared/ui/EntityFunctionAccessModal';
import { RolesTableGrid } from './RolesTableGrid';
import { RolesToast } from './RolesToast';
import { RolesToolbar } from './RolesToolbar';

export type RolesPageViewProps = {
  page: RolesPageState;
};

export const RolesPageView: React.FC<RolesPageViewProps> = ({ page }) => (
  <div className="flex h-full w-full flex-col bg-white font-sans">
    <RolesToolbar
      searchInput={page.searchInput}
      onSearchInputChange={page.setSearchInput}
      onAddRole={page.openCreateModal}
      onRefresh={page.retryLoadRoles}
      isRefreshing={page.isRefreshingRoles}
    />

    <RolesTableGrid
      isLoading={page.isLoading}
      isError={page.isError}
      error={page.error}
      onRetry={page.retryLoadRoles}
      isRetrying={page.isRetryingRoles}
      columns={page.gridColumns}
      rows={page.displayRoles}
      rowCount={page.rowCount}
    />

    <RoleCreateModal
      open={page.showCreateModal}
      form={page.form}
      onFormChange={page.setForm}
      formError={page.formError}
      isSaving={page.isSaving}
      onClose={() => page.setShowCreateModal(false)}
      onSubmit={() => void page.handleCreate()}
    />

    <RoleEditModal
      role={page.editingRole}
      form={page.editForm}
      onFormChange={page.setEditForm}
      editError={page.editError}
      isUpdating={page.isUpdating}
      onClose={page.cancelEdit}
      onSubmit={() => void page.saveEdit()}
    />

    <RoleMcpAccessModal
      open={Boolean(page.mcpAccessRole)}
      role={page.mcpAccessRole}
      editError={page.mcpAccessError}
      isSaving={page.isSavingMcpAccess}
      selectedGrants={page.mcpAccessGrants}
      onSelectedGrantsChange={page.setMcpAccessGrants}
      onClose={page.cancelMcpAccessEdit}
      onSubmit={() => void page.saveRoleMcpAccess()}
    />

    <EntityFunctionAccessModal {...page.roleFunctionAccessModalProps} />

    <RoleAttributesModal
      open={Boolean(page.attributesRole)}
      role={page.attributesRole}
      editError={page.attributesError}
      isSaving={page.isSavingAttributes}
      valuesBySettingsAttributeId={page.attributeValues}
      onValuesChange={page.setAttributeValues}
      onClose={page.cancelAttributesEdit}
      onSubmit={() => void page.saveRoleAttributes()}
    />

    <RoleDeleteModal
      role={page.deleteRole}
      deleteError={page.deleteError}
      isDeleting={page.isDeletingRole}
      onCancel={page.cancelDelete}
      onConfirm={() => void page.confirmDelete()}
    />

    <RolesToast toast={page.toast} />
  </div>
);

