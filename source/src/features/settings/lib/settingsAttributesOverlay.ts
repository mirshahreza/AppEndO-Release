import { resolvePriorityOverlayToken } from '../../../shared/routing/resolvePriorityOverlayToken';

export const SETTINGS_ATTRIBUTES_OVERLAY_DIALOG_CREATE = 'dialog/create';

export function buildSettingsAttributeEditOverlayToken(id: number): string {
  return `dialog/edit/${id}`;
}

export function buildSettingsAttributeDeleteOverlayToken(id: number): string {
  return `dialog/delete/${id}`;
}

export function parseSettingsAttributeEditOverlayToken(token: string): number | null {
  const prefix = 'dialog/edit/';
  if (!token.startsWith(prefix)) {
    return null;
  }
  const id = Number(token.slice(prefix.length));
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function parseSettingsAttributeDeleteOverlayToken(token: string): number | null {
  const prefix = 'dialog/delete/';
  if (!token.startsWith(prefix)) {
    return null;
  }
  const id = Number(token.slice(prefix.length));
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function resolveSettingsAttributesOverlayToken(input: {
  showCreateModal: boolean;
  editingId: number | null;
  deleteId: number | null;
}): string | null {
  return resolvePriorityOverlayToken([
    {
      token: input.deleteId !== null
        ? buildSettingsAttributeDeleteOverlayToken(input.deleteId)
        : 'dialog/delete/0',
      isOpen: input.deleteId !== null,
      priority: 300,
    },
    {
      token: input.editingId !== null
        ? buildSettingsAttributeEditOverlayToken(input.editingId)
        : 'dialog/edit/0',
      isOpen: input.editingId !== null,
      priority: 200,
    },
    {
      token: SETTINGS_ATTRIBUTES_OVERLAY_DIALOG_CREATE,
      isOpen: input.showCreateModal,
      priority: 100,
    },
  ]);
}
