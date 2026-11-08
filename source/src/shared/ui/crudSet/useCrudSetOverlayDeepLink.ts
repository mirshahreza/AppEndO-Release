import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useWorkspaceOverlayDeepLink } from '../../routing/useWorkspaceOverlayDeepLink';
import {
  CRUD_SET_OVERLAY_DIALOG_FILTER,
  parseCrudSetDialogOverlayToken,
  resolveCrudSetOverlayToken,
  type CrudSetDialogOverlayState,
} from './crudSetWorkspaceOverlay';

type DialogState = CrudSetDialogOverlayState;

type Args = {
  enabled?: boolean;
  dialog: DialogState;
  setDialog: (next: DialogState) => void;
  filterOpen: boolean;
  openFilter: () => void;
  closeFilter: () => void;
  historyOpen: boolean;
  historyRowKey: string | null;
  openHistoryForRow: (rowKey: string) => void;
  rowKeys: Set<string>;
  validateCreateId: (createId: string) => boolean;
  validatePatchId: (patchId: string) => boolean;
  validateActionId: (actionId: string) => boolean;
};

export function useCrudSetOverlayDeepLink(args: Args): void {
  const pendingHistoryRowRef = useRef<string | null>(null);

  const activeToken = useMemo(
    () => resolveCrudSetOverlayToken({
      dialog: args.dialog,
      filterOpen: args.filterOpen,
      historyOpen: args.historyOpen,
      historyRowKey: args.historyRowKey,
    }),
    [args.dialog, args.filterOpen, args.historyOpen, args.historyRowKey],
  );

  const openFromUrl = useCallback((token: string) => {
    if (token === CRUD_SET_OVERLAY_DIALOG_FILTER) {
      args.openFilter();
      return;
    }

    const parsed = parseCrudSetDialogOverlayToken(token);
    if (!parsed) {
      return;
    }

    if (parsed.kind === 'history') {
      if (args.rowKeys.has(parsed.rowKey)) {
        pendingHistoryRowRef.current = parsed.rowKey;
        args.openHistoryForRow(parsed.rowKey);
      }
      return;
    }

    if (parsed.kind === 'create' && !args.validateCreateId(parsed.createId)) {
      return;
    }
    if (parsed.kind === 'form-patch' && !args.validatePatchId(parsed.patchId)) {
      return;
    }
    if (parsed.kind === 'toggle-confirm' && !args.validatePatchId(parsed.patchId)) {
      return;
    }
    if (
      (parsed.kind === 'view' || parsed.kind === 'host-confirm')
      && !args.validateActionId(parsed.actionId)
    ) {
      return;
    }
    if (parsed.kind === 'collection-confirm' && !args.validateActionId(parsed.actionId)) {
      return;
    }

    const needsRow = parsed.kind === 'form-patch'
      || parsed.kind === 'toggle-confirm'
      || parsed.kind === 'delete'
      || parsed.kind === 'view'
      || parsed.kind === 'host-confirm';

    if (needsRow && !args.rowKeys.has(parsed.rowKey)) {
      return;
    }

    args.setDialog(parsed);
  }, [args]);

  useWorkspaceOverlayDeepLink({
    enabled: args.enabled !== false,
    activeToken,
    openFromUrl,
  });

  useEffect(() => {
    pendingHistoryRowRef.current = null;
  }, [args.historyOpen, args.historyRowKey]);
}
