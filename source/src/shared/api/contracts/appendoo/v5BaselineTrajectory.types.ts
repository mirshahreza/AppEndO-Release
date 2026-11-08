import type { AgentIterationTrace } from '../../../../core/ai/agent/types';
import type { ChangeSet, ProposalViolation } from '../ai/agentTypes';

/**
 * V5 Phase P00 (`PHASE-00-BASELINE-AND-TRAJECTORY.md`, V5-0) — required minimum scenario
 * coverage before baseline freeze. Matches the minimum scenario list verbatim.
 */
export type TrajectoryScenarioCategory =
  | 'simple_repository_question'
  | 'bug_fix'
  | 'server_function_edit'
  | 'server_function_to_ui'
  | 'designer_only_change'
  | 'multi_file_feature'
  | 'permission_change'
  | 'package_capability_request'
  | 'already_fixed_no_change'
  | 'ambiguous_request'
  | 'repeated_test_failure'
  | 'context_pressure'
  | 'large_tool_output';

export const BASELINE_TRAJECTORY_REQUIRED_CATEGORIES: readonly TrajectoryScenarioCategory[] = [
  'simple_repository_question',
  'bug_fix',
  'server_function_edit',
  'server_function_to_ui',
  'designer_only_change',
  'multi_file_feature',
  'permission_change',
  'package_capability_request',
  'already_fixed_no_change',
  'ambiguous_request',
  'repeated_test_failure',
  'context_pressure',
  'large_tool_output',
];

export type TrajectoryProviderStep =
  | { toolCalls: { id: string; name: string; args: Record<string, unknown> }[] }
  | { text: string };

/**
 * A persisted, replayable capture of one `AgentOrchestrator.run()` invocation.
 *
 * `providerMode` is always `'mock'` today (see `docs/appendoo/decision-log.md` D-007 — EV-3
 * blocks live-model capture). `debtRef` points at the tracker that must be cleared once a real
 * provider is configured. This is not itself a "real baseline" claim — see
 * `MUST-REVALIDATE-WITH-REAL-MODEL.md`.
 */
export type TrajectoryFixture = {
  /** Stable across regenerations of the same scenario id. */
  taskId: string;
  scenarioId: string;
  category: TrajectoryScenarioCategory;
  /** Short-hash fingerprint of tracked repo state (git HEAD) at capture time. */
  repositoryFingerprint: string;
  capturedAt: string;
  providerMode: 'mock';
  debtRef: string;
  prompt: string;
  scriptedSteps: TrajectoryProviderStep[];
  toolOrder: string[];
  result: {
    text: string;
    modelId: string;
    iterationCount: number;
    traces: AgentIterationTrace[];
    proposalId?: string;
    changeSets?: ChangeSet[];
    validationOk?: boolean;
    validationViolations?: ProposalViolation[];
    retrievalOperationCount?: number;
    draftToolCount?: number;
  };
};
