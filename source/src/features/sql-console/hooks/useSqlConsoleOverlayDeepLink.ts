import { useCallback, useMemo } from 'react';
import { useWorkspaceOverlayDeepLink } from '../../../shared/routing/useWorkspaceOverlayDeepLink';
import {
  parseSqlConsoleTabOverlayToken,
  resolveSqlConsoleOverlayToken,
} from '../lib/sqlConsoleWorkspaceOverlay';

type PendingModal =
  | { kind: 'new-collection' }
  | { kind: 'new-folder'; collectionId: string; parentFolderId: string | null }
  | { kind: 'save-script'; tabId: string }
  | null;

type Args = {
  activeTabId: string;
  setActiveTabId: (id: string) => void;
  tabIds: string[];
  pendingModal: PendingModal;
  openNewCollectionModal: () => void;
  openSaveScriptModal: (tabId: string) => void;
};

export function useSqlConsoleOverlayDeepLink(args: Args): void {
  const activeToken = useMemo(
    () => resolveSqlConsoleOverlayToken({
      activeTabId: args.activeTabId,
      pendingModalKind: args.pendingModal?.kind ?? null,
    }),
    [args.activeTabId, args.pendingModal],
  );

  const openFromUrl = useCallback((token: string) => {
    if (token === 'dialog/new-collection') {
      args.openNewCollectionModal();
      return;
    }
    if (token === 'dialog/save-script') {
      return;
    }
    const tabId = parseSqlConsoleTabOverlayToken(token);
    if (tabId && args.tabIds.includes(tabId)) {
      args.setActiveTabId(tabId);
    }
  }, [args]);

  useWorkspaceOverlayDeepLink({ enabled: true, activeToken, openFromUrl });
}
