import type { WorkflowModel } from '../../awm/types';
import { WORKFLOW_ERROR_REGISTRY } from '../../errors';
import type { ValidationIssue } from '../validationTypes';
import { findWorkflowDefinitionByScopeAndKey } from '../../workflowDefinitionRepository';

/**
 * SUBFLOW binding structural validation — doc 05 sections 7, 13. Publication only resolves that
 * the *target definition* exists in the governed scope; SUBFLOW "resolves and pins the exact child
 * revision at child start" (doc 05 section 7) is a runtime concern (Slice 9), not a publication-time
 * requirement that the target already have a published revision.
 */
export async function runSubflowValidation(model: WorkflowModel, ownerScopeKey: string): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  for (const node of model.nodes) {
    if (node.kind !== 'SUBFLOW') continue;
    const scopeKey = node.workflowDefinitionRef.scopeKey ?? ownerScopeKey;
    const target = await findWorkflowDefinitionByScopeAndKey(scopeKey, node.workflowDefinitionRef.workflowDefinitionKey);
    if (!target) {
      issues.push({
        code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_REFERENCE,
        severity: 'ERROR',
        message: `SUBFLOW node "${node.key}" references unknown WorkflowDefinition "${node.workflowDefinitionRef.workflowDefinitionKey}" in scope "${scopeKey}".`,
        nodeKey: node.key,
      });
    } else if (target.lifecycleStatus === 'ARCHIVED') {
      issues.push({
        code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_REFERENCE,
        severity: 'ERROR',
        message: `SUBFLOW node "${node.key}" references ARCHIVED WorkflowDefinition "${node.workflowDefinitionRef.workflowDefinitionKey}".`,
        nodeKey: node.key,
      });
    }
  }
  return issues;
}
