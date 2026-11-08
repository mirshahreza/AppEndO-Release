import { resolvePriorityOverlayToken } from '../../../shared/routing/resolvePriorityOverlayToken';

export const LIVE_DESIGNER_OVERLAY_PANEL_OUTLINE = 'panel/outline';
export const LIVE_DESIGNER_OVERLAY_PANEL_PROPERTIES = 'panel/properties';
export const LIVE_DESIGNER_OVERLAY_PANEL_CODE = 'panel/code';
export const LIVE_DESIGNER_OVERLAY_PANEL_AI = 'panel/ai';

export function resolveLiveDesignerOverlayToken(input: {
  outlineOpen: boolean;
  propertiesOpen: boolean;
  codeOpen: boolean;
  aiOpen: boolean;
}): string | null {
  return resolvePriorityOverlayToken([
    { token: LIVE_DESIGNER_OVERLAY_PANEL_PROPERTIES, isOpen: input.propertiesOpen, priority: 400 },
    { token: LIVE_DESIGNER_OVERLAY_PANEL_CODE, isOpen: input.codeOpen, priority: 350 },
    { token: LIVE_DESIGNER_OVERLAY_PANEL_OUTLINE, isOpen: input.outlineOpen, priority: 300 },
    { token: LIVE_DESIGNER_OVERLAY_PANEL_AI, isOpen: input.aiOpen, priority: 250 },
  ]);
}
