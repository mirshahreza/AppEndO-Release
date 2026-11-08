import { useCallback, useMemo } from 'react';
import { useWorkspaceOverlayDeepLink } from './useWorkspaceOverlayDeepLink';
import {
  parseRemoteHubEditOverlayToken,
  REMOTE_HUB_OVERLAY_DIALOG_CREATE,
  resolveRemoteHubOverlayToken,
} from './remoteHubWorkspaceOverlay';

type Args = {
  createOpen: boolean;
  setCreateOpen: (open: boolean) => void;
  editConnectionKey: string | null;
  openEditConnection: (key: string) => void;
};

export function useRemoteHubOverlayDeepLink(args: Args): void {
  const activeToken = useMemo(
    () => resolveRemoteHubOverlayToken({
      createOpen: args.createOpen,
      editConnectionKey: args.editConnectionKey,
    }),
    [args.createOpen, args.editConnectionKey],
  );

  const openFromUrl = useCallback((token: string) => {
    if (token === REMOTE_HUB_OVERLAY_DIALOG_CREATE) {
      args.setCreateOpen(true);
      return;
    }
    const key = parseRemoteHubEditOverlayToken(token);
    if (key) {
      args.openEditConnection(key);
    }
  }, [args]);

  useWorkspaceOverlayDeepLink({ enabled: true, activeToken, openFromUrl });
}
