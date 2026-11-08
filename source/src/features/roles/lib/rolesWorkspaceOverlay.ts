import { resolvePriorityOverlayToken } from '../../../shared/routing/resolvePriorityOverlayToken';

export const ROLES_OVERLAY_DIALOG_CREATE = 'dialog/create';
export const ROLES_OVERLAY_DIALOG_HISTORY = 'dialog/history';

export function buildRolesEditOverlayToken(mode: 'profile' | 'attributes' | 'mcp-access', roleId: number): string {
  return `dialog/edit/${mode}/${roleId}`;
}

export function parseRolesEditOverlayToken(
  token: string,
): { mode: 'profile' | 'attributes' | 'mcp-access'; roleId: number } | null {
  const prefix = 'dialog/edit/';
  if (!token.startsWith(prefix)) {
    return null;
  }
  const rest = token.slice(prefix.length);
  const slash = rest.indexOf('/');
  if (slash <= 0) {
    return null;
  }
  const mode = rest.slice(0, slash) as 'profile' | 'attributes' | 'mcp-access';
  const roleId = Number(rest.slice(slash + 1));
  if (!Number.isFinite(roleId) || roleId <= 0) {
    return null;
  }
  if (mode !== 'profile' && mode !== 'attributes' && mode !== 'mcp-access') {
    return null;
  }
  return { mode, roleId };
}

export function resolveRolesOverlayToken(input: {
  createOpen: boolean;
  editingRoleId: number | null;
  attributesRoleId: number | null;
  mcpAccessRoleId: number | null;
  deleteRoleId: number | null;
  historyRoleId: number | null;
}): string | null {
  return resolvePriorityOverlayToken([
    { token: 'dialog/delete', isOpen: input.deleteRoleId !== null, priority: 500 },
    {
      token: input.historyRoleId ? `${ROLES_OVERLAY_DIALOG_HISTORY}/${input.historyRoleId}` : ROLES_OVERLAY_DIALOG_HISTORY,
      isOpen: input.historyRoleId !== null,
      priority: 450,
    },
    {
      token: input.mcpAccessRoleId
        ? buildRolesEditOverlayToken('mcp-access', input.mcpAccessRoleId)
        : 'dialog/edit/mcp-access',
      isOpen: input.mcpAccessRoleId !== null,
      priority: 420,
    },
    {
      token: input.attributesRoleId
        ? buildRolesEditOverlayToken('attributes', input.attributesRoleId)
        : 'dialog/edit/attributes',
      isOpen: input.attributesRoleId !== null,
      priority: 410,
    },
    {
      token: input.editingRoleId
        ? buildRolesEditOverlayToken('profile', input.editingRoleId)
        : 'dialog/edit/profile',
      isOpen: input.editingRoleId !== null,
      priority: 400,
    },
    { token: ROLES_OVERLAY_DIALOG_CREATE, isOpen: input.createOpen, priority: 300 },
  ]);
}
