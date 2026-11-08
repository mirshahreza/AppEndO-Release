import { useCallback, useMemo } from 'react';
import { useWorkspaceOverlayDeepLink } from '../../../shared/routing/useWorkspaceOverlayDeepLink';
import {
  parseWorkflowDossierOverlayToken,
  parseWorkflowNodePropertiesOverlayToken,
  resolveWorkflowEditorOverlayToken,
  WORKFLOW_OVERLAY_DIALOG_FIXTURES,
  WORKFLOW_OVERLAY_PANEL_AI,
  WORKFLOW_OVERLAY_PANEL_EXECUTE,
  WORKFLOW_OVERLAY_PANEL_PALETTE,
  WORKFLOW_OVERLAY_PANEL_SECRET_REFERENCES,
  WORKFLOW_OVERLAY_PANEL_START_SETTINGS,
} from '../lib/workflowsWorkspaceOverlay';

type Args = {
  enabled: boolean;
  definitionId: number;
  executeOpen: boolean;
  setExecuteOpen: (open: boolean) => void;
  secretReferencesOpen: boolean;
  setSecretReferencesOpen: (open: boolean) => void;
  startSettingsOpen: boolean;
  setStartSettingsOpen: (open: boolean) => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  aiPanelOpen: boolean;
  setAiPanelOpen: (open: boolean) => void;
  fixturesOpen: boolean;
  setFixturesOpen: (open: boolean) => void;
  propertiesOpen: boolean;
  setPropertiesOpen: (open: boolean) => void;
  selectedNodeKey: string | null;
  openProperties: (nodeKey: string) => void;
  dossierDefinitionId: number | null;
  openDossier: (definitionId: number) => void;
};

export function useWorkflowEditorOverlayDeepLink(args: Args): void {
  const activeToken = useMemo(
    () => resolveWorkflowEditorOverlayToken({
      executeOpen: args.executeOpen,
      secretReferencesOpen: args.secretReferencesOpen,
      startSettingsOpen: args.startSettingsOpen,
      paletteOpen: args.paletteOpen,
      aiPanelOpen: args.aiPanelOpen,
      fixturesOpen: args.fixturesOpen,
      propertiesOpen: args.propertiesOpen,
      selectedNodeKey: args.selectedNodeKey,
      dossierDefinitionId: args.dossierDefinitionId,
    }),
    [
      args.aiPanelOpen,
      args.dossierDefinitionId,
      args.executeOpen,
      args.fixturesOpen,
      args.paletteOpen,
      args.propertiesOpen,
      args.secretReferencesOpen,
      args.selectedNodeKey,
      args.startSettingsOpen,
    ],
  );

  const openFromUrl = useCallback((token: string) => {
    const dossierId = parseWorkflowDossierOverlayToken(token);
    if (dossierId) {
      args.openDossier(dossierId);
      return;
    }
    if (token === WORKFLOW_OVERLAY_PANEL_EXECUTE) {
      args.setExecuteOpen(true);
      return;
    }
    if (token === WORKFLOW_OVERLAY_PANEL_SECRET_REFERENCES) {
      args.setSecretReferencesOpen(true);
      return;
    }
    if (token === WORKFLOW_OVERLAY_PANEL_START_SETTINGS) {
      args.setStartSettingsOpen(true);
      return;
    }
    if (token === WORKFLOW_OVERLAY_PANEL_PALETTE) {
      args.setPaletteOpen(true);
      return;
    }
    if (token === WORKFLOW_OVERLAY_PANEL_AI) {
      args.setAiPanelOpen(true);
      return;
    }
    if (token === WORKFLOW_OVERLAY_DIALOG_FIXTURES) {
      args.setFixturesOpen(true);
      return;
    }
    const nodeKey = parseWorkflowNodePropertiesOverlayToken(token);
    if (nodeKey) {
      args.openProperties(nodeKey);
    }
  }, [args]);

  useWorkspaceOverlayDeepLink({
    enabled: args.enabled,
    activeToken,
    openFromUrl,
  });
}
