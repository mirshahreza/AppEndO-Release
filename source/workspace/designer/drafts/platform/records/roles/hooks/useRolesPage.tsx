import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useCreateRoleMutation,
  useDeleteRoleMutation,
  useRolesListQuery,
  useUpdateRoleMutation,
} from '@/shared/api/queries/roles';
import {
  buildAttributeValuesPayload,
  fetchRoleAttributes,
  useUpdateRoleAttributesMutation,
} from '@/shared/api/queries/attributeValues';
import {
  useReplaceRoleMcpGrantsMutation,
} from '@/shared/api/queries/aiMcpAccess';
import { useEntityFunctionAccessModalState } from '@/shared/ui/EntityFunctionAccessModal';
import type { RoleMcpGrantInput } from '@/shared/api/contracts/ai/mcpAccess';
import { formatApiErrorMessage, formatQueryError, isApiError } from '@/shared/api/client';
import {
  EMPTY_ROLE_FORM,
} from '../constants';
import { useCultureT } from '@/core/culture/CultureContext';
import { createRoleGridColumns } from '../roleGridColumns';
import type { RoleFormState, RoleRecord, ToastState } from '../types';
import { getMutationError, isAdminRoleName } from '../utils';

export function useRolesPage() {
  const t = useCultureT();
  const rolesQuery = useRolesListQuery();
  const createRoleMutation = useCreateRoleMutation();
  const updateRoleMutation = useUpdateRoleMutation();
  const deleteRoleMutation = useDeleteRoleMutation();

  const roles = rolesQuery.data ?? [];
  const isLoading = rolesQuery.isLoading;
  const isError = rolesQuery.isError;
  const error = isError
    ? formatQueryError(rolesQuery.error, 'Failed to load roles.')
    : null;

  const retryLoadRoles = useCallback(() => {
    void rolesQuery.refetch();
  }, [rolesQuery]);

  const [searchInput, setSearchInput] = useState('');
  const [searchText, setSearchText] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState<RoleFormState>(EMPTY_ROLE_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const [editingRole, setEditingRole] = useState<RoleRecord | null>(null);
  const [editForm, setEditForm] = useState<RoleFormState>(EMPTY_ROLE_FORM);
  const [editError, setEditError] = useState<string | null>(null);

  const [attributesRole, setAttributesRole] = useState<RoleRecord | null>(null);
  const [attributeValues, setAttributeValues] = useState<Record<number, unknown>>({});
  const [attributesError, setAttributesError] = useState<string | null>(null);
  const updateRoleAttributesMutation = useUpdateRoleAttributesMutation();

  const [mcpAccessRole, setMcpAccessRole] = useState<RoleRecord | null>(null);
  const [mcpAccessGrants, setMcpAccessGrants] = useState<RoleMcpGrantInput[]>([]);
  const [mcpAccessError, setMcpAccessError] = useState<string | null>(null);
  const replaceRoleMcpGrantsMutation = useReplaceRoleMcpGrantsMutation();

  const [deleteRole, setDeleteRole] = useState<RoleRecord | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchText(searchInput), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = (type: ToastState['type'], text: string) => setToast({ type, text });

  const {
    open: openRoleFunctionAccess,
    modalProps: roleFunctionAccessModalProps,
  } = useEntityFunctionAccessModalState('role', {
    onPersisted: () => showToast('success', 'Role server function access updated.'),
  });

  const renderActorLabel = useCallback((username?: string | null, actorId?: number | null) => {
    const label = username || (actorId ? `#${actorId}` : null);
    if (!label) return <span className="text-slate-300">-</span>;
    return <span className="text-slate-600">{label}</span>;
  }, []);

  const openCreateModal = () => {
    setShowCreateModal(true);
    setFormError(null);
    setForm(EMPTY_ROLE_FORM);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) {
      setFormError('Role name is required.');
      return;
    }

    setFormError(null);
    try {
      const { data } = await createRoleMutation.mutateAsync({
        name: form.name.trim(),
        note: form.note.trim() || undefined,
      });
      const mutationError = getMutationError(data, 'Failed to create role.');
      if (mutationError) {
        setFormError(mutationError);
        return;
      }
      setForm(EMPTY_ROLE_FORM);
      setShowCreateModal(false);
      showToast('success', 'Role created successfully.');
    } catch (caught) {
      setFormError(isApiError(caught) ? formatApiErrorMessage(caught) : 'Network error.');
    }
  };

  const startEdit = (role: RoleRecord) => {
    if (isAdminRoleName(role.name)) return;
    setEditingRole(role);
    setEditForm({ name: role.name, note: role.note ?? '' });
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingRole(null);
    setEditForm(EMPTY_ROLE_FORM);
    setEditError(null);
  };

  const saveEdit = async () => {
    if (!editingRole) return;

    setEditError(null);
    try {
      const { data } = await updateRoleMutation.mutateAsync({
        roleId: editingRole.id,
        payload: { note: editForm.note.trim() || null },
      });
      const mutationError = getMutationError(data, 'Failed to update role.');
      if (mutationError) {
        setEditError(mutationError);
        return;
      }
      cancelEdit();
      showToast('success', 'Role updated successfully.');
    } catch (caught) {
      setEditError(isApiError(caught) ? formatApiErrorMessage(caught) : 'Network error.');
    }
  };

  const openEditAttributes = (role: RoleRecord) => {
    if (isAdminRoleName(role.name)) return;
    setAttributesRole(role);
    setAttributesError(null);
    setAttributeValues({});
  };

  const cancelAttributesEdit = () => {
    setAttributesRole(null);
    setAttributeValues({});
    setAttributesError(null);
  };

  const saveRoleAttributes = async () => {
    if (!attributesRole) return;

    setAttributesError(null);
    try {
      const roleId = Number(attributesRole.id);
      const attributesData = await fetchRoleAttributes(roleId);
      const { data } = await updateRoleAttributesMutation.mutateAsync({
        roleId,
        payload: buildAttributeValuesPayload(attributesData.items, attributeValues),
      });
      const mutationError = getMutationError(data, 'Failed to update role attributes.');
      if (mutationError) {
        setAttributesError(mutationError);
        return;
      }
      cancelAttributesEdit();
      showToast('success', 'Role attributes updated successfully.');
    } catch (caught) {
      setAttributesError(isApiError(caught) ? formatApiErrorMessage(caught) : (caught instanceof Error ? caught.message : 'Network error.'));
    }
  };

  const openEditMcpAccess = (role: RoleRecord) => {
    if (isAdminRoleName(role.name)) return;
    setMcpAccessRole(role);
    setMcpAccessError(null);
    setMcpAccessGrants([]);
  };

  const cancelMcpAccessEdit = () => {
    setMcpAccessRole(null);
    setMcpAccessGrants([]);
    setMcpAccessError(null);
  };

  const saveRoleMcpAccess = async () => {
    if (!mcpAccessRole) return;

    setMcpAccessError(null);
    try {
      await replaceRoleMcpGrantsMutation.mutateAsync({
        roleName: mcpAccessRole.name,
        payload: { grants: mcpAccessGrants },
      });
      cancelMcpAccessEdit();
      showToast('success', 'Role MCP access updated successfully.');
    } catch (caught) {
      setMcpAccessError(
        isApiError(caught)
          ? formatApiErrorMessage(caught)
          : (caught instanceof Error ? caught.message : 'Network error.'),
      );
    }
  };

  const openEditFunctionAccess = useCallback((role: RoleRecord) => {
    if (isAdminRoleName(role.name)) return;
    openRoleFunctionAccess(role.name, role.name);
  }, [openRoleFunctionAccess]);

  const requestDelete = (role: RoleRecord) => {
    setDeleteRole(role);
    setDeleteError(null);
  };

  const cancelDelete = () => {
    setDeleteRole(null);
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (!deleteRole) return;

    setDeleteError(null);
    try {
      const { data } = await deleteRoleMutation.mutateAsync(deleteRole.id);
      const mutationError = getMutationError(data, 'Could not delete role.');
      if (mutationError) {
        setDeleteError(mutationError);
        return;
      }
      setDeleteRole(null);
      showToast('success', 'Role deleted successfully.');
    } catch (caught) {
      setDeleteError(isApiError(caught) ? formatApiErrorMessage(caught) : 'Network error.');
    }
  };

  const searchFilteredRoles = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return roles;

    return roles.filter((role) =>
      role.name.toLowerCase().includes(q)
      || (role.note ?? '').toLowerCase().includes(q)
      || String(role.id).includes(q),
    );
  }, [roles, searchText]);

  const gridColumns = useMemo(
    () => createRoleGridColumns({
      renderActorLabel,
      onEdit: startEdit,
      onEditMcpAccess: openEditMcpAccess,
      onEditFunctionAccess: openEditFunctionAccess,
      onEditAttributes: openEditAttributes,
      onDelete: requestDelete,
    }, t),
    [renderActorLabel, startEdit, openEditMcpAccess, openEditFunctionAccess, openEditAttributes, requestDelete, t],
  );

  return {
    searchInput,
    setSearchInput,
    gridColumns,
    openCreateModal,
    isLoading,
    isError,
    error,
    retryLoadRoles,
    isRefreshingRoles: rolesQuery.isFetching,
    isRetryingRoles: rolesQuery.isFetching && isError,
    displayRoles: searchFilteredRoles,
    rowCount: searchFilteredRoles.length,
    renderActorLabel,
    startEdit,
    openEditMcpAccess,
    openEditAttributes,
    requestDelete,
    showCreateModal,
    setShowCreateModal,
    form,
    setForm,
    formError,
    handleCreate,
    isSaving: createRoleMutation.isPending,
    editingRole,
    editForm,
    setEditForm,
    editError,
    cancelEdit,
    saveEdit,
    isUpdating: updateRoleMutation.isPending,
    attributesRole,
    attributeValues,
    setAttributeValues,
    attributesError,
    cancelAttributesEdit,
    saveRoleAttributes,
    isSavingAttributes: updateRoleAttributesMutation.isPending,
    mcpAccessRole,
    mcpAccessGrants,
    setMcpAccessGrants,
    mcpAccessError,
    cancelMcpAccessEdit,
    saveRoleMcpAccess,
    isSavingMcpAccess: replaceRoleMcpGrantsMutation.isPending,
    roleFunctionAccessModalProps,
    deleteRole,
    deleteError,
    isDeletingRole: deleteRoleMutation.isPending,
    cancelDelete,
    confirmDelete,
    toast,
  };
}

export type RolesPageState = ReturnType<typeof useRolesPage>;

