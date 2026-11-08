import type { WorkflowModel } from '../awm/types';
import { normalizeNode } from '../awm/draftOperationApplier';
import { canonicalJsonFingerprint } from '../canonicalJson';
import type { ResolvedActionNodeBinding } from './validationTypes';

/**
 * Resolved-snapshot builder — doc 02 section 3, doc 03 sections 3 and 20. Only ever called after
 * `publicationValidator.ts` returns `status: 'PASSED'`; this module does no validation of its own.
 */
export type ResolvedWorkflowSnapshot = {
  normalizedModel: WorkflowModel;
  definitionJson: string;
  actionBindingsJson: string;
  schemaProjectionsJson: string;
  semanticFingerprint: string;
};

export function buildResolvedSnapshot(model: WorkflowModel, actionBindings: readonly ResolvedActionNodeBinding[]): ResolvedWorkflowSnapshot {
  const normalizedModel: WorkflowModel = { ...model, nodes: model.nodes.map(normalizeNode) };
  const semanticFingerprint = canonicalJsonFingerprint(normalizedModel as unknown);
  const schemaProjectionsJson = JSON.stringify({ inputSchema: normalizedModel.inputSchema, outputSchema: normalizedModel.outputSchema });
  const actionBindingsJson = JSON.stringify(actionBindings);

  return {
    normalizedModel,
    definitionJson: JSON.stringify(normalizedModel),
    actionBindingsJson,
    schemaProjectionsJson,
    semanticFingerprint,
  };
}
