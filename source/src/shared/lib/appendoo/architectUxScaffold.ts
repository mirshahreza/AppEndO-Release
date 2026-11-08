import type { ChangeGraph } from '../../api/contracts/appendoo/changeGraph.types';
import type { VerificationGraderResult } from '../../api/contracts/appendoo/verificationEngine.types';
import type {
  EngineeringPipelineSnapshot,
  EngineeringPipelineViewModel,
} from '../../api/contracts/appendoo/engineeringPipeline.types';

export const ARCHITECT_UX_VERSION = '1.0.0';

export type EngineeringUxPhase =
  | 'routing'
  | 'understanding'
  | 'planning'
  | 'change_graph'
  | 'building'
  | 'verification'
  | 'deployment'
  | 'repair';

export type ArchitectViewId =
  | 'conversation'
  | 'understanding'
  | 'context'
  | 'plan'
  | 'change_graph'
  | 'workspace'
  | 'verification'
  | 'deployment';

export type ChangeGraphNodeUxSummary = {
  nodeId: string;
  operationType: string;
  state: string;
};

export type VerificationGraderUxSummary = {
  graderId: string;
  grade: VerificationGraderResult['grade'];
  layer: VerificationGraderResult['layer'];
};

export const summarizeChangeGraphForUx = (graph: ChangeGraph): {
  readyCount: number;
  verifiedCount: number;
  failedCount: number;
  nodePreview: ChangeGraphNodeUxSummary[];
} => ({
  readyCount: graph.nodes.filter((node) => node.state === 'READY').length,
  verifiedCount: graph.nodes.filter((node) => node.state === 'VERIFIED').length,
  failedCount: graph.nodes.filter((node) => node.state === 'FAILED').length,
  nodePreview: graph.nodes.slice(0, 8).map((node) => ({
    nodeId: node.nodeId,
    operationType: node.operationType,
    state: node.state,
  })),
});

export const summarizeVerificationGradersForUx = (
  graderResults: VerificationGraderResult[],
): VerificationGraderUxSummary[] => (
  graderResults.map((result) => ({
    graderId: result.graderId,
    grade: result.grade,
    layer: result.layer,
  }))
);

export const resolveEngineeringUxPhase = (
  pipeline?: Pick<
    EngineeringPipelineViewModel,
    | 'requiresApproval'
    | 'approvalStatus'
    | 'executedNodeCount'
    | 'verificationRunId'
    | 'deployable'
    | 'promotionState'
    | 'repairRevisionId'
  >,
): EngineeringUxPhase => {
  if (!pipeline) return 'routing';
  if (pipeline.repairRevisionId && pipeline.deployable === false) return 'repair';
  if (pipeline.promotionState === 'DEPLOYED') return 'deployment';
  if (pipeline.verificationRunId) return 'verification';
  if ((pipeline.executedNodeCount ?? 0) > 0) return 'building';
  if (pipeline.approvalStatus === 'pending' || pipeline.requiresApproval) return 'planning';
  if ((pipeline.executedNodeCount ?? 0) === 0 && pipeline.approvalStatus === 'approved') {
    return 'change_graph';
  }
  return 'understanding';
};

export const listVisibleArchitectViews = (
  snapshot: EngineeringPipelineSnapshot,
  pipeline?: EngineeringPipelineViewModel,
): ArchitectViewId[] => {
  const views: ArchitectViewId[] = ['conversation'];

  if (snapshot.requestClass === 'CONTEXT_QUERY' || snapshot.useEngineeringPipeline) {
    views.push('understanding', 'context');
  }

  if (snapshot.useEngineeringPipeline && pipeline) {
    views.push('plan', 'change_graph');
    if (pipeline.workspaceId) views.push('workspace');
    if (pipeline.verificationRunId) views.push('verification');
    if (pipeline.promotionState) views.push('deployment');
  }

  return views;
};

export const shouldShowArchitectWorkspace = (
  snapshot: EngineeringPipelineSnapshot,
  pipeline?: EngineeringPipelineViewModel,
): boolean => (
  Boolean(snapshot.useEngineeringPipeline && pipeline?.planId)
);

export const formatEngineeringUxPhaseLabel = (phase: EngineeringUxPhase): string => {
  switch (phase) {
    case 'routing': return 'Routing';
    case 'understanding': return 'Understanding';
    case 'planning': return 'Plan review';
    case 'change_graph': return 'Change graph';
    case 'building': return 'Build';
    case 'verification': return 'Verification';
    case 'deployment': return 'Deployment';
    case 'repair': return 'Repair';
  }
};
