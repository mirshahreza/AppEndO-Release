import { resolvePriorityOverlayToken } from '../../../shared/routing/resolvePriorityOverlayToken';

export const WORKBOOK_OVERLAY_DIALOG_CREATE = 'dialog/create';
export const WORKBOOK_OVERLAY_DIALOG_LEAVE = 'dialog/leave';

export function buildWorkbookShareOverlayToken(workbookId: string): string {
  return `dialog/share/${workbookId.trim()}`;
}

export function parseWorkbookShareOverlayToken(token: string): string | null {
  const prefix = 'dialog/share/';
  if (!token.startsWith(prefix)) {
    return null;
  }
  const id = token.slice(prefix.length).trim();
  return id || null;
}

export function resolveWorkbooksOverlayToken(input: {
  createOpen: boolean;
  shareWorkbookId: string | null;
  deleteOpen: boolean;
  leaveOpen: boolean;
}): string | null {
  return resolvePriorityOverlayToken([
    { token: WORKBOOK_OVERLAY_DIALOG_LEAVE, isOpen: input.leaveOpen, priority: 400 },
    { token: 'dialog/delete', isOpen: input.deleteOpen, priority: 350 },
    {
      token: input.shareWorkbookId
        ? buildWorkbookShareOverlayToken(input.shareWorkbookId)
        : 'dialog/share',
      isOpen: Boolean(input.shareWorkbookId),
      priority: 300,
    },
    { token: WORKBOOK_OVERLAY_DIALOG_CREATE, isOpen: input.createOpen, priority: 200 },
  ]);
}
