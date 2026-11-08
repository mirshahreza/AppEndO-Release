import { WorkflowDomainError } from '../errors';
import { getWorkflowDefinitionById } from '../workflowDefinitionRepository';
import { createValidationReport } from '../workflowValidationReportRepository';
import type { WorkflowModel } from '../awm/types';
import type { WorkflowValidationReportRecord } from '../types';
import { validateWorkflowDraftForPublication } from './publicationValidator';
import { VALIDATOR_VERSION } from './validationTypes';

/**
 * `WorkflowDefinitionService.ValidateDraft(expectedDraftVersion)` (doc 02 section 13) — draft
 * authoring preview validation. Uses the exact same validator as `WorkflowPublicationService.Publish`
 * (doc 05 section 13's validation rules are one authority for both authoring preview and
 * publication) but never creates a WorkflowRevision; the persisted report has `revisionId: null`
 * per doc 03 section 16's draft-report binding.
 */
export async function validateWorkflowDraft(workflowDefinitionId: number, expectedDraftVersion: number): Promise<WorkflowValidationReportRecord> {
  const definition = await getWorkflowDefinitionById(workflowDefinitionId);
  if (!definition) {
    throw new WorkflowDomainError('WF_DEF_STALE_DRAFT_VERSION', 'WorkflowDefinition not found.', { workflowDefinitionId });
  }
  if (definition.draftVersion !== expectedDraftVersion) {
    throw new WorkflowDomainError('WF_DEF_STALE_DRAFT_VERSION', 'WorkflowDefinition draftVersion is stale.', { workflowDefinitionId, expectedDraftVersion });
  }

  const model = JSON.parse(definition.draftDefinitionJson) as WorkflowModel;
  const result = await validateWorkflowDraftForPublication(model, definition.scopeKey);

  return createValidationReport({
    workflowDefinitionId,
    draftVersion: expectedDraftVersion,
    status: result.status,
    validatorVersion: VALIDATOR_VERSION,
    issuesJson: JSON.stringify(result.issues),
  });
}
