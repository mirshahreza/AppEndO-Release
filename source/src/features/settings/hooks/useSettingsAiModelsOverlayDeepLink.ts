import { useCallback, useMemo } from 'react';
import { useWorkspaceOverlayDeepLink } from '../../../shared/routing/useWorkspaceOverlayDeepLink';
import {
  resolveSettingsAiModelsOverlayToken,
  SETTINGS_AI_OVERLAY_DIALOG_AGENT_PREFERENCES,
  SETTINGS_AI_OVERLAY_DIALOG_MODEL,
  SETTINGS_AI_OVERLAY_DIALOG_PREFERENCES,
  SETTINGS_AI_OVERLAY_DIALOG_PROVIDER,
} from '../lib/settingsAiModelsOverlay';

type Args = {
  showModelModal: boolean;
  openCreateModal: () => void;
  showProviderModal: boolean;
  openCreateProviderModal: () => void;
  showPreferencesModal: boolean;
  openPreferencesModal: () => void;
  showAgentPreferencesModal: boolean;
  openAgentPreferencesModal: () => void;
  deleteTarget: unknown;
  deleteProviderTarget: unknown;
};

export function useSettingsAiModelsOverlayDeepLink(args: Args): void {
  const activeToken = useMemo(
    () => resolveSettingsAiModelsOverlayToken({
      modelModalOpen: args.showModelModal,
      providerModalOpen: args.showProviderModal,
      preferencesOpen: args.showPreferencesModal,
      agentPreferencesOpen: args.showAgentPreferencesModal,
      deleteModelOpen: Boolean(args.deleteTarget),
      deleteProviderOpen: Boolean(args.deleteProviderTarget),
    }),
    [
      args.deleteProviderTarget,
      args.deleteTarget,
      args.showAgentPreferencesModal,
      args.showModelModal,
      args.showPreferencesModal,
      args.showProviderModal,
    ],
  );

  const openFromUrl = useCallback((token: string) => {
    if (token === SETTINGS_AI_OVERLAY_DIALOG_MODEL) {
      args.openCreateModal();
      return;
    }
    if (token === SETTINGS_AI_OVERLAY_DIALOG_PROVIDER) {
      args.openCreateProviderModal();
      return;
    }
    if (token === SETTINGS_AI_OVERLAY_DIALOG_PREFERENCES) {
      args.openPreferencesModal();
      return;
    }
    if (token === SETTINGS_AI_OVERLAY_DIALOG_AGENT_PREFERENCES) {
      args.openAgentPreferencesModal();
    }
  }, [args]);

  useWorkspaceOverlayDeepLink({ enabled: true, activeToken, openFromUrl });
}
