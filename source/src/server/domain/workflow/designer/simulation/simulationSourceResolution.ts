import { WorkflowDomainError } from '../../errors';
import { getWorkflowDefinitionById } from '../../workflowDefinitionRepository';
import { getWorkflowRevisionById } from '../../workflowRevisionRepository';
import { validateWorkflowDraftForPublication } from '../../publication/publicationValidator';
import { normalizeNode } from '../../awm/draftOperationApplier';
import { canonicalJsonFingerprint } from '../../canonicalJson';
import type { WorkflowModel } from '../../awm/types';
import type { WorkflowSimulationSource, SimulationResolvedSource } from './simulationTypes';

/**
 * `WorkflowSimulationSource` resolution — doc 02 section 8, doc 11 section 6. Exactly one variant
 * (enforced by the closed TS union at the type level; the repository layer's `createSimulationRun`
 * additionally enforces the DB-level XOR per Slice 1 plan D5 when the run is persisted).
 *
 * DRAFT: reads canonical draft under the exact `expectedDraftVersion`, runs the SAME validator
 * publication uses (`validateWorkflowDraftForPublication` — doc 11 section 25's "authoring and
 * publication share one validation authority"), and on PASSED produces an immutable
 * `SimulationResolvedSnapshot` (represented here purely as `{model, actionBindings, fingerprint}` —
 * doc 02 section 8 is explicit this snapshot "is not a WorkflowRevision, has no revision
 * number/publication/binding/start authority and cannot be referenced by a production
 * WorkflowInstance", so no new persisted row type is introduced for it; the fingerprint alone is
 * what `WorkflowSimulationRun.simulationResolvedSnapshotFingerprint` persists as evidence). A FAILED
 * validation stops simulation before any node ever executes — resolving exact Action key/version
 * happens as part of that same validation pass, before fixture lookup, matching doc 11 section 6.
 *
 * REVISION: uses the already-immutable resolved revision snapshot verbatim — no re-validation, no
 * re-resolution (the revision's `actionBindingsJson` already IS the resolved-binding evidence).
 */
export async function resolveSimulationSource(source: WorkflowSimulationSource): Promise<SimulationResolvedSource> {
  if (source.type === 'DRAFT') {
    const definition = await getWorkflowDefinitionById(source.workflowDefinitionId);
    if (!definition) {
      throw new WorkflowDomainError('WF_SIM_INVALID_SOURCE', 'Source WorkflowDefinition not found.', { workflowDefinitionId: source.workflowDefinitionId });
    }
    if (definition.draftVersion !== source.expectedDraftVersion) {
      throw new WorkflowDomainError('WF_SIM_INVALID_SOURCE', 'Source draftVersion is stale.', { workflowDefinitionId: source.workflowDefinitionId, expectedDraftVersion: source.expectedDraftVersion });
    }

    const model = JSON.parse(definition.draftDefinitionJson) as WorkflowModel;
    const result = await validateWorkflowDraftForPublication(model, definition.scopeKey);
    if (result.status !== 'PASSED') {
      throw new WorkflowDomainError('WF_SIM_INVALID_SOURCE', 'Draft failed publication-equivalent validation — simulation cannot resolve exact Action bindings for an invalid draft.', { issues: result.issues });
    }

    const normalizedModel: WorkflowModel = { ...model, nodes: model.nodes.map(normalizeNode) };
    const simulationResolvedSnapshotFingerprint = canonicalJsonFingerprint({ model: normalizedModel, actionBindings: result.actionBindings } as unknown);

    return {
      model: normalizedModel,
      actionBindings: result.actionBindings,
      simulationResolvedSnapshotFingerprint,
      sourceDraftVersion: source.expectedDraftVersion,
      sourceRevisionId: null,
    };
  }

  const revision = await getWorkflowRevisionById(source.sourceRevisionId);
  if (!revision) {
    throw new WorkflowDomainError('WF_SIM_INVALID_SOURCE', 'Source WorkflowRevision not found.', { sourceRevisionId: source.sourceRevisionId });
  }
  const model = JSON.parse(revision.definitionJson) as WorkflowModel;
  const actionBindings = JSON.parse(revision.actionBindingsJson) as SimulationResolvedSource['actionBindings'];

  return {
    model,
    actionBindings,
    simulationResolvedSnapshotFingerprint: revision.semanticFingerprint,
    sourceDraftVersion: null,
    sourceRevisionId: revision.id,
  };
}
