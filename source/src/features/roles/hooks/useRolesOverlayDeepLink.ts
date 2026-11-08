import { useCallback, useMemo } from 'react';
import { useWorkspaceOverlayDeepLink } from '../../../shared/routing/useWorkspaceOverlayDeepLink';
import type { RoleRecord } from '../types';
import {
  parseRolesEditOverlayToken,
  resolveRolesOverlayToken,
  ROLES_OVERLAY_DIALOG_CREATE,
  ROLES_OVERLAY_DIALOG_HISTORY,
} from '../lib/rolesWorkspaceOverlay';

type Args = {
  roles: RoleRecord[];
  showCreateModal: boolean;
  openCreateModal: () => void;
  editingRole: RoleRecord | null;
  attributesRole: RoleRecord | null;
  mcpAccessRole: RoleRecord | null;
  deleteRole: RoleRecord | null;
  historyRole: RoleRecord | null;
  startEdit: (role: RoleRecord) => void;
  openEditAttributes: (role: RoleRecord) => void;
  openEditMcpAccess: (role: RoleRecord) => void;
  setHistoryRole: (role: RoleRecord | null) => void;
};

export function useRolesOverlayDeepLink(args: Args): void {
  const activeToken = useMemo(
    () => resolveRolesOverlayToken({
      createOpen: args.showCreateModal,
      editingRoleId: args.editingRole ? Number(args.editingRole.id) : null,
      attributesRoleId: args.attributesRole ? Number(args.attributesRole.id) : null,
      mcpAccessRoleId: args.mcpAccessRole ? Number(args.mcpAccessRole.id) : null,
      deleteRoleId: args.deleteRole ? Number(args.deleteRole.id) : null,
      historyRoleId: args.historyRole ? Number(args.historyRole.id) : null,
    }),
    [
      args.attributesRole,
      args.deleteRole,
      args.editingRole,
      args.historyRole,
      args.mcpAccessRole,
      args.showCreateModal,
    ],
  );

  const findRole = useCallback((roleId: number) => (
    args.roles.find((role) => Number(role.id) === roleId)
  ), [args.roles]);

  const openFromUrl = useCallback((token: string) => {
    if (token === ROLES_OVERLAY_DIALOG_CREATE) {
      args.openCreateModal();
      return;
    }
    if (token.startsWith(`${ROLES_OVERLAY_DIALOG_HISTORY}/`)) {
      const roleId = Number(token.slice(`${ROLES_OVERLAY_DIALOG_HISTORY}/`.length));
      const role = findRole(roleId);
      if (role) {
        args.setHistoryRole(role);
      }
      return;
    }
    const edit = parseRolesEditOverlayToken(token);
    if (!edit) {
      return;
    }
    const role = findRole(edit.roleId);
    if (!role) {
      return;
    }
    if (edit.mode === 'profile') {
      args.startEdit(role);
    } else if (edit.mode === 'attributes') {
      args.openEditAttributes(role);
    } else {
      args.openEditMcpAccess(role);
    }
  }, [args, findRole]);

  useWorkspaceOverlayDeepLink({ enabled: true, activeToken, openFromUrl });
}
