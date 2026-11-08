import { createHash } from 'node:crypto';
import type {
  BuilderContext,
  BuilderExecuteResult,
  BuilderPreviewResult,
} from '../../api/contracts/appendoo/builderProtocol.types';
import {
  describeBuilderPrimitive,
  resolveBuilderPrimitivePaths,
  resolveWorkspaceMutationPath,
} from './builderPrimitivePaths';
import { writeBuilderWorkspaceArtifacts } from './builderWorkspaceWriter';

export { resolveWorkspaceMutationPath };

const fingerprint = (seed: string): string => (
  createHash('sha256').update(seed).digest('hex').slice(0, 16)
);

export const runPreviewScaffold = (
  context: BuilderContext,
  mutationPaths: string[],
): BuilderPreviewResult => {
  const plannedMutations = mutationPaths.map((path) => ({
    artifactId: context.changeNode.nodeId,
    path,
    fingerprint: fingerprint(`${context.operationId}:${path}:preview`),
    mutation: 'modified' as const,
  }));

  return {
    ok: plannedMutations.length > 0,
    phase: 'preview',
    plannedMutations,
    warnings: [],
  };
};

/** AE-8.4 — record workspace-scoped mutations at platform primitive paths. */
export const runExecuteScaffold = (
  context: BuilderContext,
  mutationPaths: string[] = resolveBuilderPrimitivePaths(context.changeNode),
): BuilderExecuteResult => {
  const paths = mutationPaths.length > 0 ? mutationPaths : resolveBuilderPrimitivePaths(context.changeNode);
  writeBuilderWorkspaceArtifacts(context, paths);
  const mutations = paths.map((path) => ({
    artifactId: context.changeNode.nodeId,
    path,
    fingerprint: fingerprint(`${context.operationId}:${path}:execute`),
    mutation: 'modified' as const,
  }));

  return {
    ok: mutations.length > 0,
    phase: 'execute',
    mutations,
    semanticRelationships: [
      describeBuilderPrimitive(context.changeNode),
      `${context.changeNode.operationType}:${context.changeNode.targetRef.targetId}`,
    ],
    appliedKnowledgeRefs: context.applicableStandards.map((standard) => ({
      recordId: standard.recordId,
      sourceId: standard.sourceId,
      trust: standard.trust,
    })),
    usedCapabilityRefs: context.validatedCapabilities,
    warnings: [],
    verificationHints: [`Verify ${describeBuilderPrimitive(context.changeNode)} in workspace ${context.workspaceId}`],
    rollbackData: {
      revisionId: context.revisionId,
      operationId: context.operationId,
      primitivePaths: paths,
    },
  };
};
