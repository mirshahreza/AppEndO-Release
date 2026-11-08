import { resolvePriorityOverlayToken } from '../../../shared/routing/resolvePriorityOverlayToken';

export const SETTINGS_AI_OVERLAY_DIALOG_MODEL = 'dialog/model';
export const SETTINGS_AI_OVERLAY_DIALOG_PROVIDER = 'dialog/provider';
export const SETTINGS_AI_OVERLAY_DIALOG_PREFERENCES = 'dialog/chat-preferences';
export const SETTINGS_AI_OVERLAY_DIALOG_AGENT_PREFERENCES = 'dialog/agent-preferences';

export function resolveSettingsAiModelsOverlayToken(input: {
  modelModalOpen: boolean;
  providerModalOpen: boolean;
  preferencesOpen: boolean;
  agentPreferencesOpen: boolean;
  deleteModelOpen: boolean;
  deleteProviderOpen: boolean;
}): string | null {
  return resolvePriorityOverlayToken([
    { token: 'dialog/delete-provider', isOpen: input.deleteProviderOpen, priority: 500 },
    { token: 'dialog/delete-model', isOpen: input.deleteModelOpen, priority: 490 },
    { token: SETTINGS_AI_OVERLAY_DIALOG_AGENT_PREFERENCES, isOpen: input.agentPreferencesOpen, priority: 400 },
    { token: SETTINGS_AI_OVERLAY_DIALOG_PREFERENCES, isOpen: input.preferencesOpen, priority: 390 },
    { token: SETTINGS_AI_OVERLAY_DIALOG_PROVIDER, isOpen: input.providerModalOpen, priority: 380 },
    { token: SETTINGS_AI_OVERLAY_DIALOG_MODEL, isOpen: input.modelModalOpen, priority: 370 },
  ]);
}
