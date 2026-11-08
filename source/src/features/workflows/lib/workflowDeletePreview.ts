import type { WorkflowDefinitionDossier } from '../types';
import type { WorkflowDeleteImpact } from '../api/workflowsApi';
import { WorkflowsApiError } from '../api/workflowsApi';

export type WorkflowDeletePreview = {
  canDelete: boolean;
  hasExecutionHistory: boolean;
  instanceCount: number;
  revisionCount: number;
  nonTerminalInstanceCount: number;
  stateVersion: number;
  blockerMessage?: string;
  subflowReferencers?: Array<{ id: number; key: string }>;
};

export const buildWorkflowDeletePreview = (
  dossier: WorkflowDefinitionDossier,
  stateVersion: number,
): WorkflowDeletePreview => {
  const canDelete = !dossier.definition.isPublished;

  return {
    canDelete,
    hasExecutionHistory: dossier.instanceSummary.total > 0,
    instanceCount: dossier.instanceSummary.total,
    revisionCount: dossier.revisions.length,
    nonTerminalInstanceCount: dossier.instanceSummary.nonTerminal,
    stateVersion,
    blockerMessage: canDelete
      ? undefined
      : 'Only unpublished workflows can be deleted. Unpublish this workflow first.',
  };
};

export const buildWorkflowDeletePreviewFromImpact = (impact: WorkflowDeleteImpact): WorkflowDeletePreview => ({
  canDelete: impact.canDelete,
  hasExecutionHistory: impact.hasExecutionHistory,
  instanceCount: impact.instanceCount,
  revisionCount: impact.revisionCount,
  nonTerminalInstanceCount: impact.nonTerminalInstanceCount,
  stateVersion: impact.stateVersion,
  blockerMessage: impact.blockerMessage,
  subflowReferencers: impact.subflowReferencers,
});

export const formatWorkflowsApiError = (error: unknown, fallback: string): string => {
  if (error instanceof WorkflowsApiError) {
    if (error.message.includes('API route not found')) {
      return 'Delete API is unavailable. Restart the development server (npm run dev) and try again.';
    }
    return error.code ? `${error.code}: ${error.message}` : error.message;
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
};
