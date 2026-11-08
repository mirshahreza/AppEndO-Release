import { useCallback, useMemo } from 'react';
import { useWorkspaceOverlayDeepLink } from '../../../shared/routing/useWorkspaceOverlayDeepLink';
import type { WorkflowDefinitionSummary } from '../types';
import {
  parseWorkflowDeleteOverlayToken,
  parseWorkflowDossierOverlayToken,
  resolveWorkflowListOverlayToken,
  WORKFLOW_OVERLAY_DIALOG_CREATE,
  WORKFLOW_OVERLAY_PANEL_DEAD_LETTERS,
  WORKFLOW_OVERLAY_PANEL_SLA_VIOLATIONS,
} from '../lib/workflowsWorkspaceOverlay';

type Args = {
  enabled: boolean;
  definitions: WorkflowDefinitionSummary[];
  deadLettersOpen: boolean;
  setDeadLettersOpen: (open: boolean) => void;
  slaViolationsOpen: boolean;
  setSlaViolationsOpen: (open: boolean) => void;
  isCreateOpen: boolean;
  openCreateModal: () => void;
  isDuplicateOpen: boolean;
  deleteTarget: WorkflowDefinitionSummary | null;
  openDeleteDialog: (definition: WorkflowDefinitionSummary) => void;
  dossierDefinitionId: number | null;
  openDossier: (definitionId: number) => void;
};

export function useWorkflowsListOverlayDeepLink(args: Args): void {
  const activeToken = useMemo(
    () => resolveWorkflowListOverlayToken({
      deadLettersOpen: args.deadLettersOpen,
      slaViolationsOpen: args.slaViolationsOpen,
      createOpen: args.isCreateOpen,
      duplicateOpen: args.isDuplicateOpen,
      deleteOpen: Boolean(args.deleteTarget),
      deleteDefinitionId: args.deleteTarget?.id ?? null,
      dossierDefinitionId: args.dossierDefinitionId,
    }),
    [
      args.deadLettersOpen,
      args.deleteTarget,
      args.dossierDefinitionId,
      args.isCreateOpen,
      args.isDuplicateOpen,
      args.slaViolationsOpen,
    ],
  );

  const openFromUrl = useCallback((token: string) => {
    if (token === WORKFLOW_OVERLAY_PANEL_DEAD_LETTERS) {
      args.setDeadLettersOpen(true);
      return;
    }
    if (token === WORKFLOW_OVERLAY_PANEL_SLA_VIOLATIONS) {
      args.setSlaViolationsOpen(true);
      return;
    }
    if (token === WORKFLOW_OVERLAY_DIALOG_CREATE) {
      args.openCreateModal();
      return;
    }
    const deleteId = parseWorkflowDeleteOverlayToken(token);
    if (deleteId) {
      const definition = args.definitions.find((item) => item.id === deleteId);
      if (definition) {
        args.openDeleteDialog(definition);
      }
      return;
    }
    const dossierId = parseWorkflowDossierOverlayToken(token);
    if (dossierId) {
      args.openDossier(dossierId);
    }
  }, [args]);

  useWorkspaceOverlayDeepLink({
    enabled: args.enabled,
    activeToken,
    openFromUrl,
  });
}
