import { useCallback, useMemo } from 'react';
import { useWorkspaceOverlayDeepLink } from '../../../shared/routing/useWorkspaceOverlayDeepLink';
import type { SettingsAttributeRecord } from '../../../shared/api/contracts/attributes/types';
import {
  parseSettingsAttributeDeleteOverlayToken,
  parseSettingsAttributeEditOverlayToken,
  resolveSettingsAttributesOverlayToken,
  SETTINGS_ATTRIBUTES_OVERLAY_DIALOG_CREATE,
} from '../lib/settingsAttributesOverlay';

type Args = {
  showCreateModal: boolean;
  openCreateModal: () => void;
  editingRecord: SettingsAttributeRecord | null;
  startEdit: (record: SettingsAttributeRecord) => void;
  definitions: SettingsAttributeRecord[];
  deleteId: number | null;
  requestDelete: (id: number) => void;
};

export function useSettingsAttributesOverlayDeepLink(args: Args): void {
  const activeToken = useMemo(
    () => resolveSettingsAttributesOverlayToken({
      showCreateModal: args.showCreateModal,
      editingId: args.editingRecord?.id ?? null,
      deleteId: args.deleteId,
    }),
    [args.deleteId, args.editingRecord?.id, args.showCreateModal],
  );

  const openFromUrl = useCallback((token: string) => {
    if (token === SETTINGS_ATTRIBUTES_OVERLAY_DIALOG_CREATE) {
      args.openCreateModal();
      return;
    }
    const editId = parseSettingsAttributeEditOverlayToken(token);
    if (editId) {
      const record = args.definitions.find((item) => item.id === editId);
      if (record) {
        args.startEdit(record);
      }
      return;
    }
    const deleteTargetId = parseSettingsAttributeDeleteOverlayToken(token);
    if (deleteTargetId) {
      args.requestDelete(deleteTargetId);
    }
  }, [args.definitions, args.openCreateModal, args.requestDelete, args.startEdit]);

  useWorkspaceOverlayDeepLink({ enabled: true, activeToken, openFromUrl });
}
