import { randomUUID } from 'crypto';
import type { AssistantRequestRouting } from '../../../shared/api/contracts/ai/appendooGateway.types';
import type { AgentMode } from '../../../shared/api/contracts/ai/agentTypes';

/**
 * V5 Phase P02 § 17 — `TaskContract`.
 *
 * "conceptual removal: routing result = understanding" → "replacement: routing result = signal,
 * TaskContract = normalized engineering contract". `resolveTaskContract` treats the existing,
 * already-production-reachable `routeAssistantRequest()` output (`AssistantRequestRouting` —
 * `src/server/domain/ai/assistantRequestRouter.ts`) as exactly that: a SIGNAL it consumes, not
 * something it re-implements. `requiresClarification`, `requestClass`, `confidence`, and
 * `routingReason` all come from the real router; `resolveTaskContract` normalizes them into the
 * doc's canonical contract shape and adds the (today: single, derived) acceptance criterion.
 *
 * Scoped subset: the full doc shape also includes `explicitConstraints`/`inferredConstraints`,
 * multi-item `requestedOutcomes`, and `approvalPolicy` as a rich ref. Those require either NLU
 * extraction (no live model — EV-3) or an approval-policy registry that doesn't exist yet, so
 * they're intentionally minimal/deferred rather than fabricated — see PHASE-EVIDENCE-REPORT-P02.md.
 */
export type TaskClass =
  | 'ENGINEERING_CHANGE'
  | 'ENGINEERING_QUERY'
  | 'OPERATIONAL_ACTION'
  | 'GENERAL_CHAT';

export type AcceptanceCriterion = {
  criterionId: string;
  statement: string;
  required: boolean;
};

export type AmbiguityAssessment = {
  isAmbiguous: boolean;
  reason?: string;
};

export type TaskContract = {
  taskContractId: string;
  revision: number;
  taskId: string;

  rawUserRequest: string;
  normalizedObjective: string;

  taskClass: TaskClass;
  acceptanceCriteria: AcceptanceCriterion[];

  mutationExpectation: 'EXPECTED' | 'POSSIBLE' | 'NOT_EXPECTED' | 'UNKNOWN';

  ambiguity: AmbiguityAssessment;

  sourceRefs: string[];
  createdAt: string;
};

const mapRequestClassToTaskClass = (
  requestClass: AssistantRequestRouting['requestClass'],
): TaskClass => {
  switch (requestClass) {
    case 'ENGINEERING_CHANGE':
      return 'ENGINEERING_CHANGE';
    case 'ENGINEERING_QUERY':
    case 'CONTEXT_QUERY':
      return 'ENGINEERING_QUERY';
    case 'OPERATIONAL_ACTION':
      return 'OPERATIONAL_ACTION';
    case 'TOOL_QUERY':
      return 'ENGINEERING_QUERY';
    default:
      return 'GENERAL_CHAT';
  }
};

const resolveMutationExpectation = (taskClass: TaskClass): TaskContract['mutationExpectation'] => {
  switch (taskClass) {
    case 'ENGINEERING_CHANGE':
      return 'EXPECTED';
    case 'OPERATIONAL_ACTION':
      return 'POSSIBLE';
    case 'ENGINEERING_QUERY':
    case 'GENERAL_CHAT':
      return 'NOT_EXPECTED';
    default:
      return 'UNKNOWN';
  }
};

const buildAcceptanceCriteria = (taskClass: TaskClass): AcceptanceCriterion[] => {
  if (taskClass !== 'ENGINEERING_CHANGE') {
    return [];
  }
  return [{
    criterionId: randomUUID(),
    statement: 'The final proposal must pass proposal validation (validateProposal ok:true).',
    required: true,
  }];
};

/**
 * `routing`/`mode` are the only real, already-available signals at every current call site
 * (`AiManager.processAgentRun`, and by extension `AgentOrchestrator.run()` when no richer
 * routing was passed). When `routing` is omitted (e.g. a caller/test that doesn't route through
 * `routeAssistantRequest` first), falls back to a minimal contract derived from `mode` alone —
 * still real (not fabricated data), just lower-confidence, and `ambiguity.reason` says so.
 */
export const resolveTaskContract = (params: {
  taskId: string;
  rawUserRequest: string;
  mode: AgentMode;
  routing?: AssistantRequestRouting;
}): TaskContract => {
  const { taskId, rawUserRequest, mode, routing } = params;
  const taskClass = routing
    ? mapRequestClassToTaskClass(routing.requestClass)
    : (mode === 'agent' ? 'ENGINEERING_CHANGE' : mode === 'plan' ? 'ENGINEERING_QUERY' : 'GENERAL_CHAT');

  return {
    taskContractId: randomUUID(),
    revision: 1,
    taskId,
    rawUserRequest,
    normalizedObjective: rawUserRequest.trim().slice(0, 320),
    taskClass,
    acceptanceCriteria: buildAcceptanceCriteria(taskClass),
    mutationExpectation: resolveMutationExpectation(taskClass),
    ambiguity: routing
      ? { isAmbiguous: routing.requiresClarification, reason: routing.requiresClarification ? routing.routingReason : undefined }
      : { isAmbiguous: false, reason: 'No AssistantRequestRouting available — defaulted from mode only.' },
    sourceRefs: routing ? [`router:${routing.routerVersion}`, routing.routingReason] : ['mode-default'],
    createdAt: new Date().toISOString(),
  };
};
