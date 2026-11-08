import type {
  AgentStreamEngineeringPipelineEvent,
  AgentStreamRequestRoutingEvent,
} from '../ai/agentTypes';
import type { ChangeGraph } from './changeGraph.types';
import type { VerificationGraderResult } from './verificationEngine.types';
import {
  summarizeChangeGraphForUx,
  summarizeVerificationGradersForUx,
} from '../../../lib/appendoo/architectUxScaffold';

/** Engineering pipeline telemetry surfaced in AppEndooPanel (Phase 20). */
export type EngineeringPipelineSnapshot = Pick<
  AgentStreamRequestRoutingEvent,
  | 'requestClass'
  | 'taskProfile'
  | 'routingReason'
  | 'useEngineeringPipeline'
  | 'applicationScopeKey'
  | 'applicationScopeKind'
  | 'contextPackId'
  | 'contextPackTargetCount'
  | 'contextPackStandardsCount'
  | 'contextPackSelectionExplanations'
>;

export type EngineeringPipelineDetails = AgentStreamEngineeringPipelineEvent;

export type EngineeringPipelineViewModel = EngineeringPipelineDetails & {
  routingReason?: string;
  applicationScopeKey?: string;
  contextPackTargetCount?: number;
  contextPackStandardsCount?: number;
};

export const toEngineeringPipelineSnapshot = (
  event: AgentStreamRequestRoutingEvent,
): EngineeringPipelineSnapshot => ({
  requestClass: event.requestClass,
  taskProfile: event.taskProfile,
  routingReason: event.routingReason,
  useEngineeringPipeline: event.useEngineeringPipeline,
  applicationScopeKey: event.applicationScopeKey,
  applicationScopeKind: event.applicationScopeKind,
  contextPackId: event.contextPackId,
  contextPackTargetCount: event.contextPackTargetCount,
  contextPackStandardsCount: event.contextPackStandardsCount,
  contextPackSelectionExplanations: event.contextPackSelectionExplanations,
});

export const buildEngineeringPipelineViewModel = (
  pipeline: AgentStreamEngineeringPipelineEvent,
  routing?: {
    routingReason?: string;
    applicationScopeKey?: string;
    contextPackTargetCount?: number;
    contextPackStandardsCount?: number;
  },
): EngineeringPipelineViewModel => ({
  ...pipeline,
  routingReason: routing?.routingReason,
  applicationScopeKey: routing?.applicationScopeKey,
  contextPackTargetCount: routing?.contextPackTargetCount,
  contextPackStandardsCount: routing?.contextPackStandardsCount,
});

export const formatRequestClassLabel = (requestClass: EngineeringPipelineSnapshot['requestClass']): string => {
  switch (requestClass) {
    case 'ENGINEERING_CHANGE': return 'Engineering change';
    case 'ENGINEERING_QUERY': return 'Engineering query';
    case 'CONTEXT_QUERY': return 'Context query';
    case 'TOOL_QUERY': return 'Tool query';
    case 'OPERATIONAL_ACTION': return 'Operational action';
    case 'CONVERSATION': return 'Conversation';
  }
};

export const mapChangeGraphToStreamFields = (
  graph: ChangeGraph,
): Pick<
  AgentStreamEngineeringPipelineEvent,
  'changeGraphReadyCount' | 'changeGraphVerifiedCount' | 'changeGraphFailedCount' | 'changeGraphNodePreview'
> => {
  const summary = summarizeChangeGraphForUx(graph);
  return {
    changeGraphReadyCount: summary.readyCount,
    changeGraphVerifiedCount: summary.verifiedCount,
    changeGraphFailedCount: summary.failedCount,
    changeGraphNodePreview: summary.nodePreview,
  };
};

export const mapGraderResultsToStreamFields = (
  graderResults: VerificationGraderResult[],
): Pick<AgentStreamEngineeringPipelineEvent, 'verificationGraderSummary'> => ({
  verificationGraderSummary: summarizeVerificationGradersForUx(graderResults),
});

export const mapChangeGraphDriftToStreamFields = (input: {
  ok: boolean;
  staleNodeIds: string[];
  failures: string[];
}): Pick<
  AgentStreamEngineeringPipelineEvent,
  'changeGraphDriftOk' | 'changeGraphDriftStaleCount' | 'builderOrchestrationErrors' | 'builderOrchestrationErrorCount'
> => ({
  changeGraphDriftOk: input.ok,
  changeGraphDriftStaleCount: input.staleNodeIds.length,
  builderOrchestrationErrors: input.failures.length > 0 ? input.failures : undefined,
  builderOrchestrationErrorCount: input.failures.length > 0 ? input.failures.length : undefined,
});

export const mapBuilderOrchestrationErrorsToStreamFields = (errors: string[]): Pick<
  AgentStreamEngineeringPipelineEvent,
  'builderOrchestrationErrors' | 'builderOrchestrationErrorCount'
> => ({
  builderOrchestrationErrors: errors.length > 0 ? errors : undefined,
  builderOrchestrationErrorCount: errors.length > 0 ? errors.length : undefined,
});

export const buildEngineeringPipelineStreamEvent = (
  input: Omit<AgentStreamEngineeringPipelineEvent, 'type'>,
): AgentStreamEngineeringPipelineEvent => ({
  type: 'engineering_pipeline',
  ...input,
});
