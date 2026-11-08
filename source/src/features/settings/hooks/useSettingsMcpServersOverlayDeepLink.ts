import { useCallback, useMemo } from 'react';
import { useWorkspaceOverlayDeepLink } from '../../../shared/routing/useWorkspaceOverlayDeepLink';
import {
  resolveSettingsMcpServersOverlayToken,
  SETTINGS_MCP_OVERLAY_DIALOG_CREATE,
} from '../lib/settingsMcpServersOverlay';

type Args = {
  showCreateModal: boolean;
  openCreateModal: () => void;
  resourceAccessOpen: boolean;
};

export function useSettingsMcpServersOverlayDeepLink(args: Args): void {
  const activeToken = useMemo(
    () => resolveSettingsMcpServersOverlayToken({
      createOpen: args.showCreateModal,
      resourceAccessOpen: args.resourceAccessOpen,
    }),
    [args.resourceAccessOpen, args.showCreateModal],
  );

  const openFromUrl = useCallback((token: string) => {
    if (token === SETTINGS_MCP_OVERLAY_DIALOG_CREATE) {
      args.openCreateModal();
    }
  }, [args]);

  useWorkspaceOverlayDeepLink({ enabled: true, activeToken, openFromUrl });
}
