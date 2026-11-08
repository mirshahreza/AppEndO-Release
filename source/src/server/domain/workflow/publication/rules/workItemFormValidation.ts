import type { WorkflowModel } from '../../awm/types';
import { WORKFLOW_ERROR_REGISTRY } from '../../errors';
import type { ValidationIssue } from '../validationTypes';
import { getDesignerDraft } from '../../../component-designer/draftIo';

/**
 * HWF-1.5 — when a WORK_ITEM node's `formMode` is `DESIGNED_COMPONENT`, `formComponentRef` must be
 * set and must resolve to a real, existing Component Designer component (`getDesignerDraft` is the
 * same file-backed lookup `ComponentDesignerService.getDraft` uses for `GET
 * /api/component-designer/drafts/by-path`) — same existence-check shape as `subflowValidation.ts`
 * for SUBFLOW target definitions, just against a different subsystem's storage.
 */
export function runWorkItemFormValidation(model: WorkflowModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const node of model.nodes) {
    if (node.kind !== 'WORK_ITEM' || node.formMode !== 'DESIGNED_COMPONENT') continue;
    if (!node.formComponentRef) {
      issues.push({
        code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_AWM,
        severity: 'ERROR',
        message: `WORK_ITEM node "${node.key}" has formMode DESIGNED_COMPONENT but no formComponentRef.`,
        nodeKey: node.key,
      });
      continue;
    }
    const draft = getDesignerDraft(node.formComponentRef);
    if (!draft) {
      issues.push({
        code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_REFERENCE,
        severity: 'ERROR',
        message: `WORK_ITEM node "${node.key}" references unknown Component Designer component "${node.formComponentRef}".`,
        nodeKey: node.key,
      });
    }
  }
  return issues;
}
