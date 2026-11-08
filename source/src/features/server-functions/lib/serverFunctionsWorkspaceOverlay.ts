import { resolvePriorityOverlayToken } from '../../../shared/routing/resolvePriorityOverlayToken';

export const SERVER_FUNCTIONS_OVERLAY_DIALOG_CREATE = 'dialog/create';
export const SERVER_FUNCTIONS_OVERLAY_DIALOG_SETTINGS = 'dialog/settings';
export const SERVER_FUNCTIONS_OVERLAY_DIALOG_ACCESS = 'dialog/access';
export const SERVER_FUNCTIONS_OVERLAY_DIALOG_HOOKS = 'dialog/hooks';
export const SERVER_FUNCTIONS_OVERLAY_DIALOG_DUPLICATE = 'dialog/duplicate';
export const SERVER_FUNCTIONS_OVERLAY_DIALOG_RENAME = 'dialog/rename';
export const SERVER_FUNCTIONS_OVERLAY_DIALOG_DELETE = 'dialog/delete';
export const SERVER_FUNCTIONS_OVERLAY_DIALOG_UNUSED = 'dialog/unused-functions';
export const SERVER_FUNCTIONS_OVERLAY_DIALOG_BULK = 'dialog/bulk-settings';
export const SERVER_FUNCTIONS_OVERLAY_PANEL_AI = 'panel/ai';

export function resolveServerFunctionsOverlayToken(input: {
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
}): string | null {
  return resolvePriorityOverlayToken([
    { token: SERVER_FUNCTIONS_OVERLAY_DIALOG_DELETE, isOpen: input.deleteOpen, priority: 500 },
    { token: SERVER_FUNCTIONS_OVERLAY_DIALOG_RENAME, isOpen: input.renameOpen, priority: 450 },
    { token: SERVER_FUNCTIONS_OVERLAY_DIALOG_DUPLICATE, isOpen: input.duplicateOpen, priority: 400 },
    { token: SERVER_FUNCTIONS_OVERLAY_DIALOG_CREATE, isOpen: input.createOpen, priority: 350 },
    { token: SERVER_FUNCTIONS_OVERLAY_DIALOG_SETTINGS, isOpen: input.settingsOpen, priority: 340 },
    { token: SERVER_FUNCTIONS_OVERLAY_DIALOG_ACCESS, isOpen: input.accessOpen, priority: 330 },
    { token: SERVER_FUNCTIONS_OVERLAY_DIALOG_HOOKS, isOpen: input.hooksOpen, priority: 320 },
    { token: SERVER_FUNCTIONS_OVERLAY_DIALOG_UNUSED, isOpen: input.unusedOpen, priority: 310 },
    { token: SERVER_FUNCTIONS_OVERLAY_DIALOG_BULK, isOpen: input.bulkOpen, priority: 300 },
    { token: SERVER_FUNCTIONS_OVERLAY_PANEL_AI, isOpen: input.aiOpen, priority: 200 },
  ]);
}
