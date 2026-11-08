import type { OperationalState } from './operationalState';
import type { TaskContract } from './taskContract';

/**
 * V5 Phase P01 § 3.3 — `OperationalPolicyEngine`. `validateProposal` (the EDIT-repeat-failure
 * gate) shipped in P01. `select()` — choosing a recommended `AgentActionClass` from
 * `TaskContract` + `OperationalState` + evidence/progress signals — was deferred until those
 * types existed (P02). It now does, so V5 Phase P03 § V5-5 implements `select()` here.
 *
 * Scope note (kept honest, not silently expanded): the doc's full `select()` contract also takes
 * `UncertaintyState`/`RiskState`/`BudgetState`/`RuntimeHealth` as first-class inputs. This phase's
 * `select()` only uses the subset of those concepts that's mechanically derivable from real state
 * today (`OperationalState.failureSignatures` as a risk/uncertainty proxy, `governanceDepth` as
 * `RiskState`'s concrete P03 slice — see below) — not full uncertainty quantification, which
 * needs live-model confidence signals this environment cannot produce (EV-3).
 */
export type AgentActionClass =
  | 'CLARIFY'
  | 'REPRODUCE'
  | 'EXPLORE'
  | 'LOCALIZE'
  | 'INSPECT'
  | 'PLAN'
  | 'EDIT'
  | 'VERIFY'
  | 'REVIEW'
  | 'RECOVER'
  | 'COMPACT'
  | 'ESCALATE'
  | 'ABSTAIN'
  | 'COMPLETE';

const READ_TOOL_NAMES = new Set([
  'read_file', 'search_codebase', 'list_dir', 'glob_files', 'get_feature_graph',
  'get_page_context', 'get_server_function', 'list_server_functions', 'list_packages',
  'get_package_manifest', 'list_data_sources', 'describe_schema', 'query_readonly',
  'list_jobs', 'get_job', 'list_cache_keys', 'get_cache_entry', 'read_memory',
  'list_openapi_routes', 'get_openapi_spec', 'git_status', 'git_diff', 'git_log',
  'git_show', 'git_blame',
]);

/** Real, reachable-today classification — every tool name in the current registry maps somewhere. */
export const classifyToolCallActionClass = (toolName: string): AgentActionClass => {
  if (toolName === 'ask_clarifying_question') return 'CLARIFY';
  if (toolName === 'get_project_standards') return 'INSPECT';
  if (toolName === 'run_tests' || toolName === 'test_server_function') return 'VERIFY';
  if (toolName.startsWith('draft_')) return 'EDIT';
  if (toolName === 'update_todo_list') return 'PLAN';
  if (READ_TOOL_NAMES.has(toolName)) return 'EXPLORE';
  if (toolName.startsWith('git_commit') || toolName.startsWith('git_checkout') || toolName.startsWith('git_branch')) return 'EDIT';
  return 'EXPLORE';
};

export type ProposedAgentAction = {
  toolName: string;
  actionClass: AgentActionClass;
  /** Normalized mutation target — path, functionId, or 'default' — used for failure-signature matching. */
  target: string;
};

/**
 * V5 Phase P09 § V5-13 — tool idempotency, from the phase doc's `AgentToolOperationalMetadata`
 * contract (§14). Coarse, tool-name-level classification (mirrors `classifyToolCallActionClass`'s
 * own precedent of not needing per-argument granularity to be real and enforceable):
 *
 * - `SAFE_RETRY` — read-only/no-mutation tools. Re-issuing after an unknown outcome is harmless.
 * - `RETRY_WITH_CHECK` — mutates, but the mutation itself is a verifiable/re-checkable action
 *   (VERIFY-class tools re-run cleanly; git write tools only ever create a *draft* requiring a
 *   separate human-approval step — confirmed by direct inspection of `gitWriteTools.ts` — so a
 *   second draft is inspectable/discardable before it does anything, not a blind duplicate mutation).
 * - `NOT_SAFE` — mutates a real target with no re-check step before the mutation lands
 *   (`draft_*` builder/patch tools apply directly; `http_request` may have non-idempotent external
 *   side effects the runtime cannot verify). Must not be blindly retried after an unknown outcome.
 */
export type AgentToolIdempotency = 'SAFE_RETRY' | 'RETRY_WITH_CHECK' | 'NOT_SAFE';

const HTTP_REQUEST_TOOL_NAME = 'http_request';

export const resolveToolIdempotency = (toolName: string): AgentToolIdempotency => {
  if (toolName === 'run_tests' || toolName === 'test_server_function') return 'RETRY_WITH_CHECK';
  if (toolName.startsWith('git_commit') || toolName.startsWith('git_checkout') || toolName.startsWith('git_branch')) return 'RETRY_WITH_CHECK';
  // Phase doc §14's own worked example classifies draft_file_patch as RETRY_WITH_CHECK, not
  // NOT_SAFE: re-issuing is fine as long as it's preceded by a check (e.g. read_file) — the
  // runtime can inspect current file state before deciding to retry, unlike an external side
  // effect it cannot re-verify. See `DefaultOperationalPolicyEngine.validateProposal`'s
  // `pendingUnknownOutcomes` gate below, which blocks blind retry for BOTH NOT_SAFE and
  // RETRY_WITH_CHECK — the distinction is what recovery looks like, not whether a gate applies.
  if (toolName.startsWith('draft_')) return 'RETRY_WITH_CHECK';
  if (toolName === HTTP_REQUEST_TOOL_NAME) return 'NOT_SAFE';
  return classifyToolCallActionClass(toolName) === 'EDIT' ? 'NOT_SAFE' : 'SAFE_RETRY';
};

export type ActionValidation =
  | { allowed: true }
  | { allowed: false; reasonCode: string; reason: string };

/**
 * V5 Phase P03 § "Grounding — T7 Governance depth dial (p-60)" — turns the pre-existing, purely
 * internal Path A routing decision (lean/bounded agent-loop vs. heavy governed pipeline — see
 * `decision-log.md` V4-PATCH-0) into an explicit dial, per p-60 T7's own design rules: default
 * `AUTO`, `LEAN` is opt-in, and even `LEAN` auto-escalates to `THOROUGH` on high-risk targets.
 */
export type GovernanceDepth = 'LEAN' | 'AUTO' | 'THOROUGH';
export type MutationRiskLevel = 'LOW' | 'HIGH';

const HIGH_RISK_TARGET_PATTERN = /schema|migration|prisma|\.env(\.|$)|settings\.json|permission|role|auth/i;

/**
 * Real, mechanical risk classification from the mutation target path/functionId — not a live-model
 * judgment (EV-3 unavailable). Deliberately conservative pattern list: false positives (flagging a
 * benign file as HIGH) only make governance stricter, never bypass it — false negatives are the
 * unsafe direction, so the pattern favors recall over precision.
 */
export const classifyMutationRisk = (target: string): MutationRiskLevel => (
  HIGH_RISK_TARGET_PATTERN.test(target) ? 'HIGH' : 'LOW'
);

/** p-60 T7 rule: LEAN is never allowed to silently skip governance on a HIGH-risk target. */
export const resolveGovernanceDepth = (
  requested: GovernanceDepth,
  risk: MutationRiskLevel,
): GovernanceDepth => (
  requested === 'LEAN' && risk === 'HIGH' ? 'THOROUGH' : requested
);

/** THOROUGH tightens the P01 repeated-failure gate; LEAN loosens it (never disables it). */
export const resolveFailureBlockThreshold = (governanceDepth: GovernanceDepth): number => {
  switch (governanceDepth) {
    case 'THOROUGH': return 1;
    case 'LEAN': return 3;
    default: return 2;
  }
};

export interface OperationalPolicyEngine {
  validateProposal(input: {
    proposedAction: ProposedAgentAction;
    state: OperationalState;
    governanceDepth?: GovernanceDepth;
  }): ActionValidation;
  select(input: PolicySelectInput): AgentActionClass;
}

/**
 * Rule-set inputs mechanically derivable from real P01/P02 state (doc § V5-5 "initial rule set").
 * `hasSourceEvidence`/`hasUnresolvedAmbiguity` are booleans rather than the doc's richer
 * `EvidenceSnapshot`/`UncertaintyState` objects — see file-level scope note.
 */
export type PolicySelectInput = {
  taskContract: Pick<TaskContract, 'mutationExpectation' | 'ambiguity'>;
  state: Pick<OperationalState, 'failureSignatures' | 'draftToolCount'>;
  hasSourceEvidence: boolean;
  /** True once the model has been nudged toward drafting at least once and still hasn't. */
  workflowNudgeCount: number;
  governanceDepth: GovernanceDepth;
};

/**
 * `DefaultOperationalPolicyEngine` — real, production-reachable rules:
 *
 * `validateProposal`: an EDIT-class action targeting the same normalized target as an unrecovered
 * failure signature (>= a governance-depth-aware threshold, no intervening VERIFY success) is
 * rejected. Stronger than the pre-existing `orchestrationPolicy.ts` redundancy check (exact
 * tool+args repetition) because it matches on (tool, normalized target) regardless of args, and it
 * requires a real recovery signal to clear.
 *
 * `select`: recommends an `AgentActionClass` from the doc's rule table, restricted to the subset
 * decidable from real, non-fabricated signals (see `PolicySelectInput`).
 */
export class DefaultOperationalPolicyEngine implements OperationalPolicyEngine {
  validateProposal(input: {
    proposedAction: ProposedAgentAction;
    state: OperationalState;
    governanceDepth?: GovernanceDepth;
  }): ActionValidation {
    const { proposedAction, state } = input;

    // V5 Phase P09 § V5-13 — crash-safety gate. A tool call left over from a prior attempt whose
    // outcome is unknown (process crashed between ToolExecutionStarted and its resolution — see
    // `crashRecovery.ts`) must not be blindly re-issued unless it's SAFE_RETRY: both NOT_SAFE and
    // RETRY_WITH_CHECK require a check step first (the difference between them is what recovery
    // looks like afterward, not whether blind retry is allowed). Cleared once any
    // ToolExecutionCompleted/Failed is recorded for the same (toolName, target) — see
    // `reduceOperationalState`.
    const unresolvedUnknownOutcome = (state.pendingUnknownOutcomes ?? []).find(
      (entry) => entry.toolName === proposedAction.toolName
        && entry.target === proposedAction.target
        && entry.idempotency !== 'SAFE_RETRY',
    );
    if (unresolvedUnknownOutcome) {
      return {
        allowed: false,
        reasonCode: 'unresolved_unknown_outcome',
        reason: `"${proposedAction.toolName}" targeting "${proposedAction.target}" was interrupted in a previous attempt and its outcome is unknown (not safe to retry blindly). Verify current state first (e.g. read_file/run_tests) before re-issuing this exact action.`,
      };
    }

    if (proposedAction.actionClass !== 'EDIT') {
      return { allowed: true };
    }

    const threshold = resolveFailureBlockThreshold(input.governanceDepth ?? 'AUTO');
    const signature = `${proposedAction.toolName}:${proposedAction.target}`;
    const failure = state.failureSignatures.find((entry) => entry.signature === signature);

    if (failure && !failure.recoveredAt && failure.occurrences >= threshold) {
      return {
        allowed: false,
        reasonCode: 'repeated_failure_without_recovery',
        reason: `"${proposedAction.toolName}" targeting "${proposedAction.target}" has failed ${failure.occurrences} time(s) with no successful verification since. Run a VERIFY-class tool (run_tests/test_server_function) to confirm a fix before retrying, or escalate/ask for clarification.`,
      };
    }

    return { allowed: true };
  }

  select(input: PolicySelectInput): AgentActionClass {
    const { taskContract, state, hasSourceEvidence, workflowNudgeCount, governanceDepth } = input;

    const threshold = resolveFailureBlockThreshold(governanceDepth);
    const unrecoveredRepeatedFailure = state.failureSignatures.some(
      (entry) => !entry.recoveredAt && entry.occurrences >= threshold,
    );
    if (unrecoveredRepeatedFailure) {
      return 'RECOVER';
    }

    if (taskContract.ambiguity.isAmbiguous && state.draftToolCount === 0) {
      return 'CLARIFY';
    }

    if (taskContract.mutationExpectation !== 'EXPECTED') {
      return hasSourceEvidence ? 'COMPLETE' : 'EXPLORE';
    }

    // mutationExpectation === 'EXPECTED' from here.
    if (state.draftToolCount > 0) {
      return 'VERIFY';
    }

    // No draft yet. § 9 root finding: "no draft yet → nudge draft" is the wrong default — a
    // model that already gathered real evidence and STILL didn't draft after being nudged once
    // is real (mechanical, not textual/NLP) signal that no change may be needed, not that it
    // needs a harder push. First nudge is still allowed (workflowNudgeCount check).
    if (workflowNudgeCount >= 1 && hasSourceEvidence) {
      return 'ABSTAIN';
    }

    return hasSourceEvidence ? 'EDIT' : 'EXPLORE';
  }
}

export const defaultOperationalPolicyEngine = new DefaultOperationalPolicyEngine();
