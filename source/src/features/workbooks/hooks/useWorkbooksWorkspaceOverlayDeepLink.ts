import { useCallback, useMemo } from 'react';
import { useWorkspaceOverlayDeepLink } from '../../../shared/routing/useWorkspaceOverlayDeepLink';
import {
  parseWorkbookShareOverlayToken,
  resolveWorkbooksOverlayToken,
  WORKBOOK_OVERLAY_DIALOG_CREATE,
  WORKBOOK_OVERLAY_DIALOG_LEAVE,
} from '../lib/workbooksWorkspaceOverlay';

type Args = {
  createOpen: boolean;
  setCreateOpen: (open: boolean) => void;
  shareWorkbookId: string | null;
  setShareWorkbookId: (id: string | null) => void;
  deleteOpen: boolean;
  leaveOpen: boolean;
  setPendingLeave: (open: boolean) => void;
  onShareFromUrl: (workbookId: string) => void;
};

export function useWorkbooksWorkspaceOverlayDeepLink(args: Args): void {
  const activeToken = useMemo(
    () => resolveWorkbooksOverlayToken({
      createOpen: args.createOpen,
      shareWorkbookId: args.shareWorkbookId,
      deleteOpen: args.deleteOpen,
      leaveOpen: args.leaveOpen,
    }),
    [args.createOpen, args.deleteOpen, args.leaveOpen, args.shareWorkbookId],
  );

  const openFromUrl = useCallback((token: string) => {
    if (token === WORKBOOK_OVERLAY_DIALOG_CREATE) {
      args.setCreateOpen(true);
      return;
    }
    if (token === WORKBOOK_OVERLAY_DIALOG_LEAVE) {
      args.setPendingLeave(true);
      return;
    }
    if (token === 'dialog/delete') {
      return;
    }
    const shareId = parseWorkbookShareOverlayToken(token);
    if (shareId) {
      args.onShareFromUrl(shareId);
    }
  }, [args]);

  useWorkspaceOverlayDeepLink({ enabled: true, activeToken, openFromUrl });
}
