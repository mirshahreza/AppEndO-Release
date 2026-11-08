import { resolvePriorityOverlayToken } from '../../../shared/routing/resolvePriorityOverlayToken';
import type { EditMode } from '../types';

export const USERS_OVERLAY_DIALOG_CREATE = 'dialog/create';
export const USERS_OVERLAY_DIALOG_FILTER = 'dialog/filter';

export function buildUsersEditOverlayToken(mode: EditMode, userId: number): string {
  return `dialog/edit/${mode}/${userId}`;
}

export function parseUsersEditOverlayToken(
  token: string,
): { mode: EditMode; userId: number } | null {
  const prefix = 'dialog/edit/';
  if (!token.startsWith(prefix)) {
    return null;
  }
  const rest = token.slice(prefix.length);
  const slash = rest.indexOf('/');
  if (slash <= 0) {
    return null;
  }
  const mode = rest.slice(0, slash) as EditMode;
  const userId = Number(rest.slice(slash + 1));
  if (!Number.isFinite(userId) || userId <= 0) {
    return null;
  }
  if (mode !== 'profile' && mode !== 'roles' && mode !== 'attributes') {
    return null;
  }
  return { mode, userId };
}

export function resolveUsersOverlayToken(input: {
  showCreateModal: boolean;
  filterDialogOpen: boolean;
  editMode: EditMode | null;
  editingUserId: number | null;
  deleteUserId: number | null;
  changePasswordUserId: number | null;
  resetPasswordUserId: number | null;
  lockConfirmUserId: number | null;
}): string | null {
  return resolvePriorityOverlayToken([
    { token: 'dialog/delete', isOpen: input.deleteUserId !== null, priority: 500 },
    { token: 'dialog/change-password', isOpen: input.changePasswordUserId !== null, priority: 450 },
    { token: 'dialog/reset-password', isOpen: input.resetPasswordUserId !== null, priority: 440 },
    { token: 'dialog/lock', isOpen: input.lockConfirmUserId !== null, priority: 430 },
    {
      token: input.editMode && input.editingUserId
        ? buildUsersEditOverlayToken(input.editMode, input.editingUserId)
        : 'dialog/edit',
      isOpen: Boolean(input.editMode && input.editingUserId),
      priority: 400,
    },
    { token: USERS_OVERLAY_DIALOG_CREATE, isOpen: input.showCreateModal, priority: 300 },
    { token: USERS_OVERLAY_DIALOG_FILTER, isOpen: input.filterDialogOpen, priority: 200 },
  ]);
}
