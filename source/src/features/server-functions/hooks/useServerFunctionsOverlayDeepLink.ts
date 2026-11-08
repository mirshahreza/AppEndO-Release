import { useCallback, useMemo } from 'react';
import { useWorkspaceOverlayDeepLink } from '../../../shared/routing/useWorkspaceOverlayDeepLink';
import {
  resolveServerFunctionsOverlayToken,
  SERVER_FUNCTIONS_OVERLAY_DIALOG_ACCESS,
  SERVER_FUNCTIONS_OVERLAY_DIALOG_BULK,
  SERVER_FUNCTIONS_OVERLAY_DIALOG_CREATE,
  SERVER_FUNCTIONS_OVERLAY_DIALOG_HOOKS,
  SERVER_FUNCTIONS_OVERLAY_DIALOG_SETTINGS,
  SERVER_FUNCTIONS_OVERLAY_DIALOG_UNUSED,
  SERVER_FUNCTIONS_OVERLAY_PANEL_AI,
} from '../lib/serverFunctionsWorkspaceOverlay';

type Args = {
  deleteOpen: boolean;
  renameOpen: boolean;
  duplicateOpen: boolean;
  createOpen: boolean;
  settingsOpen: boolean;
  accessOpen: boolean;
  hooksOpen: boolean;
  unusedOpen: boolean;
  bulkOpen: boolean;
  aiOpen: boolean;
  openCreateDialog: () => void;
  setIsSettingsOpen: (open: boolean) => void;
  setIsAccessOpen: (open: boolean) => void;
  setIsHooksOpen: (open: boolean) => void;
  setUnusedOpen: (open: boolean) => void;
  setIsBulkOpen: (open: boolean) => void;
  setAiOpen: (open: boolean) => void;
};

export function useServerFunctionsOverlayDeepLink(args: Args): void {
  const activeToken = useMemo(
    () => resolveServerFunctionsOverlayToken({
      deleteOpen: args.deleteOpen,
      renameOpen: args.renameOpen,
      duplicateOpen: args.duplicateOpen,
      createOpen: args.createOpen,
      settingsOpen: args.settingsOpen,
      accessOpen: args.accessOpen,
      hooksOpen: args.hooksOpen,
      unusedOpen: args.unusedOpen,
      bulkOpen: args.bulkOpen,
      aiOpen: args.aiOpen,
    }),
    [args],
  );

  const openFromUrl = useCallback((token: string) => {
    if (token === SERVER_FUNCTIONS_OVERLAY_DIALOG_CREATE) {
      args.openCreateDialog();
      return;
    }
    if (token === SERVER_FUNCTIONS_OVERLAY_DIALOG_SETTINGS) {
      args.setIsSettingsOpen(true);
      return;
    }
    if (token === SERVER_FUNCTIONS_OVERLAY_DIALOG_ACCESS) {
      args.setIsAccessOpen(true);
      return;
    }
    if (token === SERVER_FUNCTIONS_OVERLAY_DIALOG_HOOKS) {
      args.setIsHooksOpen(true);
      return;
    }
    if (token === SERVER_FUNCTIONS_OVERLAY_DIALOG_UNUSED) {
      args.setUnusedOpen(true);
      return;
    }
    if (token === SERVER_FUNCTIONS_OVERLAY_DIALOG_BULK) {
      args.setIsBulkOpen(true);
      return;
    }
    if (token === SERVER_FUNCTIONS_OVERLAY_PANEL_AI) {
      args.setAiOpen(true);
    }
  }, [args]);

  useWorkspaceOverlayDeepLink({ enabled: true, activeToken, openFromUrl });
}
