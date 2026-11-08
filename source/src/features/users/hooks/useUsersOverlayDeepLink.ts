import { useCallback, useMemo } from 'react';
import { useWorkspaceOverlayDeepLink } from '../../../shared/routing/useWorkspaceOverlayDeepLink';
import type { EditMode } from '../types';
import {
  parseUsersEditOverlayToken,
  resolveUsersOverlayToken,
  USERS_OVERLAY_DIALOG_CREATE,
  USERS_OVERLAY_DIALOG_FILTER,
} from '../lib/usersWorkspaceOverlay';

type Args = {
  showCreateModal: boolean;
  openCreateIndividualModal: () => void;
  filterDialogOpen: boolean;
  setFilterDialogOpen: (open: boolean) => void;
  editMode: EditMode | null;
  editingUserId: number | null;
  deleteUserId: number | null;
  changePasswordUserId: number | null;
  resetPasswordUserId: number | null;
  lockConfirmUserId: number | null;
  openEditFromUrl: (userId: number, mode: EditMode) => void;
};

export function useUsersOverlayDeepLink(args: Args): void {
  const activeToken = useMemo(
    () => resolveUsersOverlayToken({
      showCreateModal: args.showCreateModal,
      filterDialogOpen: args.filterDialogOpen,
      editMode: args.editMode,
      editingUserId: args.editingUserId,
      deleteUserId: args.deleteUserId,
      changePasswordUserId: args.changePasswordUserId,
      resetPasswordUserId: args.resetPasswordUserId,
      lockConfirmUserId: args.lockConfirmUserId,
    }),
    [args],
  );

  const openFromUrl = useCallback((token: string) => {
    if (token === USERS_OVERLAY_DIALOG_CREATE) {
      args.openCreateIndividualModal();
      return;
    }
    if (token === USERS_OVERLAY_DIALOG_FILTER) {
      args.setFilterDialogOpen(true);
      return;
    }
    const edit = parseUsersEditOverlayToken(token);
    if (edit) {
      args.openEditFromUrl(edit.userId, edit.mode);
    }
  }, [args]);

  useWorkspaceOverlayDeepLink({ enabled: true, activeToken, openFromUrl });
}
