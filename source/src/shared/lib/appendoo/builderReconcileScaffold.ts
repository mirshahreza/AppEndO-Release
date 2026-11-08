import type { ChangeNode } from '../../api/contracts/appendoo/changeGraph.types';
import type {
  BuilderContext,
  BuilderReconcileResult,
  BuilderRollbackResult,
} from '../../api/contracts/appendoo/builderProtocol.types';
import { runExecuteScaffold } from './builderExecuteScaffold';

/** AE-8.3 scaffold — compare execute mutations against desired workspace state. */
export const runReconcileScaffold = (
  context: BuilderContext,
  executedMutations: ReturnType<typeof runExecuteScaffold>['mutations'],
): BuilderReconcileResult => {
  const expectedPath = executedMutations[0]?.path;
  const scopePrefix = context.changeNode.workspaceMutationScope[0]?.replace(/\*\*$/, '').replace(/\/$/, '');
  const driftDetected = !expectedPath
    || (scopePrefix ? !expectedPath.startsWith(scopePrefix) : false);

  return {
    ok: !driftDetected,
    phase: 'reconcile',
    reconciledMutations: executedMutations,
    driftDetected,
    warnings: driftDetected
      ? [`Workspace drift detected for node ${context.changeNode.nodeId}.`]
      : [],
  };
};

/** AE-8.3 scaffold — restore workspace artifacts from execute rollbackData. */
export const runRollbackScaffold = (
  context: BuilderContext,
  node: ChangeNode,
  rollbackData?: Record<string, unknown>,
): BuilderRollbackResult => {
  const revisionId = typeof rollbackData?.revisionId === 'string'
    ? rollbackData.revisionId
    : context.revisionId;

  const restoredArtifacts = [{
    artifactId: node.nodeId,
    path: `appendoo/ws/${node.changeSetId}/${node.targetRef.targetId}.rollback.ts`,
    fingerprint: `${revisionId}:${node.operationId}:rollback`,
    mutation: 'modified' as const,
  }];

  return {
    ok: true,
    phase: 'rollback',
    restoredArtifacts,
    warnings: [`Rolled back ${node.operationType} for revision ${revisionId}.`],
  };
};
