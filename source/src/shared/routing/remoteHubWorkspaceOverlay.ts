import { resolvePriorityOverlayToken } from './resolvePriorityOverlayToken';

export const REMOTE_HUB_OVERLAY_DIALOG_CREATE = 'dialog/create';

export function buildRemoteHubEditOverlayToken(connectionKey: string): string {
  return `dialog/edit/${connectionKey.trim()}`;
}

export function parseRemoteHubEditOverlayToken(token: string): string | null {
  const prefix = 'dialog/edit/';
  if (!token.startsWith(prefix)) {
    return null;
  }
  const key = token.slice(prefix.length).trim();
  return key || null;
}

export function resolveRemoteHubOverlayToken(input: {
  createOpen: boolean;
  editConnectionKey: string | null;
}): string | null {
  return resolvePriorityOverlayToken([
    {
      token: input.editConnectionKey
        ? buildRemoteHubEditOverlayToken(input.editConnectionKey)
        : 'dialog/edit',
      isOpen: Boolean(input.editConnectionKey),
      priority: 300,
    },
    { token: REMOTE_HUB_OVERLAY_DIALOG_CREATE, isOpen: input.createOpen, priority: 200 },
  ]);
}
