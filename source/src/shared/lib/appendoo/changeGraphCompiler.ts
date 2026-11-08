import type {
  ChangeGraph,
  ChangeNode,
  ChangeOperationType,
  ChangeReuseClassification,
} from '../../api/contracts/appendoo/changeGraph.types';
import type {
  AppEndooSemanticPlan,
  SemanticPlanArtifact,
  SemanticPlanCompositionCandidate,
} from '../../api/contracts/appendoo/semanticPlan.types';
import { CHANGE_GRAPH_COMPILER_VERSION } from '../../api/contracts/appendoo/changeGraph.types';
import { compileChangeGraphScaffold } from './engineeringWorkspaceScaffold';
import { resolveBuilderPrimitiveScope } from './builderPrimitivePaths';
import { inferChangeNodeDependencies } from './changeGraphScheduler';
import { resolveCurrentCapabilitySnapshotVersion } from './changeGraphDriftScaffold';
import { assertChangeGraphCompileAllowed } from './semanticPlanAuthorityGates';

export class ChangeGraphCompileForbiddenError extends Error {
  readonly code = 'CHANGE_GRAPH_COMPILE_FORBIDDEN' as const;

  constructor(public readonly errors: string[]) {
    super(errors.join(' '));
    this.name = 'ChangeGraphCompileForbiddenError';
  }
}

const mapArtifactToOperation = (artifact: SemanticPlanArtifact): ChangeOperationType => {
  switch (artifact.kind) {
    case 'server_function':
      return artifact.action === 'create' ? 'CREATE_SERVER_FUNCTION' : 'MODIFY_SERVER_FUNCTION';
    case 'page':
      return artifact.action === 'create' ? 'CREATE_PAGE' : 'MODIFY_PAGE';
    case 'component':
      return artifact.action === 'create' ? 'CREATE_COMPONENT' : 'MODIFY_COMPONENT';
    case 'entity':
      return artifact.action === 'create' ? 'CREATE_ENTITY' : 'MODIFY_ENTITY';
    case 'permission':
      return artifact.action === 'create' ? 'CREATE_PERMISSION' : 'MODIFY_PERMISSION';
    case 'route':
      return artifact.action === 'create' ? 'CREATE_ROUTE' : 'MODIFY_ROUTE';
    case 'package_manifest':
      return 'UPDATE_PACKAGE_MANIFEST';
    default:
      return 'UPDATE_CONFIGURATION';
  }
};

const findCompositionForArtifact = (
  plan: AppEndooSemanticPlan,
  artifact: SemanticPlanArtifact,
): SemanticPlanCompositionCandidate | undefined => {
  const candidates = plan.compositionCandidates ?? [];
  return candidates.find((candidate) => candidate.requestedOutcomeRefs.some((ref) => (
    ref === artifact.artifactId
    || ref === artifact.targetRef
    || artifact.evidenceIds.includes(ref)
  ))) ?? candidates[0];
};

const resolveReuseClassification = (
  plan: AppEndooSemanticPlan,
  artifact: SemanticPlanArtifact,
): ChangeReuseClassification | undefined => {
  const gap = plan.capabilityGaps.find((entry) => (
    entry.capabilityId.includes(artifact.kind)
    || artifact.evidenceIds.some((evidenceId) => evidenceId.includes(entry.capabilityId))
  ));
  if (!gap) return undefined;

  switch (gap.resolution) {
    case 'reuse':
      return 'REUSED';
    case 'adapt':
      return 'ADAPTED';
    case 'new_build':
      return 'NEW_BUILD';
    default:
      return undefined;
  }
};

const buildChangeNode = (
  plan: AppEndooSemanticPlan,
  artifact: SemanticPlanArtifact,
  changeSetId: string,
  index: number,
): ChangeNode => {
  const operationType = mapArtifactToOperation(artifact);
  const composition = findCompositionForArtifact(plan, artifact);
  const snapshotVersion = resolveCurrentCapabilitySnapshotVersion();
  const requiredCapabilityIds = composition?.capabilityRefs.length
    ? [...composition.capabilityRefs]
    : plan.requiredCapabilities.length > 0
      ? [...plan.requiredCapabilities]
      : ['capability:appendo-server-functions'];
  const providerBindingId = composition?.providerBindings[0] ?? 'binding:appendo-server-functions';
  const now = new Date().toISOString();

  return {
    nodeId: `node:${artifact.artifactId}`,
    operationId: `op:${changeSetId}:${index + 1}`,
    changeSetId,
    operationType,
    targetRef: {
      targetKind: artifact.kind === 'server_function'
        ? 'function'
        : artifact.kind === 'page'
          ? 'page'
          : artifact.kind === 'component'
            ? 'component'
            : 'configuration',
      targetId: artifact.targetRef ?? artifact.artifactId,
      ref: artifact.targetRef,
    },
    inputs: { evidenceIds: artifact.evidenceIds },
    expectedOutputs: [artifact.title],
    dependencies: [],
    requiredCapabilityIds,
    capabilitySnapshotVersion: snapshotVersion,
    providerBinding: {
      capabilityId: requiredCapabilityIds[0] ?? 'capability:appendo-server-functions',
      providerBindingId,
      capabilitySnapshotVersion: snapshotVersion,
      compositionPlanId: composition?.compositionCandidateId,
      compositionContractVersion: composition?.compositionContractVersion,
    },
    workspaceMutationScope: resolveBuilderPrimitiveScope(changeSetId),
    reuseClassification: resolveReuseClassification(plan, artifact),
    state: 'PLANNED',
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  };
};

export const validateChangeGraphCompilePreconditions = (
  plan: AppEndooSemanticPlan,
  options?: { approvedRevisionId?: number },
): { ok: true } | { ok: false; code: 'CHANGE_GRAPH_COMPILE_FORBIDDEN'; errors: string[] } => (
  assertChangeGraphCompileAllowed(plan, {
    approvedRevisionId: options?.approvedRevisionId,
    approvedAuthority: plan.authority,
  })
);

/** AE-7.2 — compile validated ASP artifacts into ordered ChangeGraph nodes. */
export const compileChangeGraphFromPlan = (
  plan: AppEndooSemanticPlan,
  options?: { approvedRevisionId?: number; skipPreconditions?: boolean },
): ChangeGraph => {
  if (!options?.skipPreconditions) {
    const preconditions = validateChangeGraphCompilePreconditions(plan, options);
    if (!preconditions.ok) {
      throw new ChangeGraphCompileForbiddenError(preconditions.errors);
    }
  }

  const changeSetId = plan.changeGraphProposal?.changeSetId ?? `cs:${plan.planId}`;
  const rawNodes = plan.proposedArtifacts.map(
    (artifact, index) => buildChangeNode(plan, artifact, changeSetId, index),
  );
  const nodes = inferChangeNodeDependencies(rawNodes);

  const graph = compileChangeGraphScaffold({
    changeSetId,
    applicationScope: null,
    nodes,
  });

  return {
    ...graph,
    applicationScopeRef: plan.applicationScopeRef,
    revision: plan.revision,
    compilerVersion: CHANGE_GRAPH_COMPILER_VERSION,
  };
};

export const summarizeChangeGraph = (graph: ChangeGraph): {
  changeGraphId: string;
  nodeCount: number;
  plannedCount: number;
  readyCount: number;
  verifiedCount: number;
  failedCount: number;
  compilerVersion: string;
} => ({
  changeGraphId: graph.changeGraphId,
  nodeCount: graph.nodes.length,
  plannedCount: graph.nodes.filter((node) => node.state === 'PLANNED').length,
  readyCount: graph.nodes.filter((node) => node.state === 'READY').length,
  verifiedCount: graph.nodes.filter((node) => node.state === 'VERIFIED').length,
  failedCount: graph.nodes.filter((node) => node.state === 'FAILED').length,
  compilerVersion: graph.compilerVersion,
});
