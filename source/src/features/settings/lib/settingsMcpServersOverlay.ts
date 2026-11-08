import { resolvePriorityOverlayToken } from '../../../shared/routing/resolvePriorityOverlayToken';

export const SETTINGS_MCP_OVERLAY_DIALOG_CREATE = 'dialog/create';

export function resolveSettingsMcpServersOverlayToken(input: {
  createOpen: boolean;
  resourceAccessOpen: boolean;
}): string | null {
  return resolvePriorityOverlayToken([
    { token: 'dialog/resource-access', isOpen: input.resourceAccessOpen, priority: 300 },
    { token: SETTINGS_MCP_OVERLAY_DIALOG_CREATE, isOpen: input.createOpen, priority: 200 },
  ]);
}
