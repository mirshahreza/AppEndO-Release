import type { AgentStreamRequestRoutingEvent } from '../../api/contracts/ai/agentTypes';

/** AE-22 — V3 cutover disables p-50 v1 direct write to active roots. */
export const APPENDOO_V3_CUTOVER_ENABLED = true;

/**
 * p-63 (PO decision 2026-07-18) — reopen v1 proposal apply. The cutover left Agent mode in a
 * dead end: the panel auto-applies a valid proposal, this flag unconditionally 403'd it, and
 * the engineering pipeline only auto-executes a narrow scenario set — so most agent turns
 * produced proposals that could never be applied. `APPENDOO_V3_CUTOVER_ENABLED` stays true so
 * the live-pipeline integration flags (appendooIntegrationFlags.ts) keep their gating; only
 * the v1 write block is lifted.
 */
export const V1_DIRECT_APPLY_REOPENED = true;

export const V1_DIRECT_WRITE_BLOCKED_MESSAGE =
  'V3 engineering cutover is active — direct v1 apply to active roots is disabled. '
  + 'Use the AppEndoo engineering pipeline (Workspace → Builders → Verification → Promotion).';

export const ENGINEERING_PROPOSAL_BLOCKED_MESSAGE =
  'Engineering changes cannot use v1 proposal auto-apply after V3 cutover. '
  + 'Approval, Change Graph, Workspace, and Verification are required before promotion.';

export function isV1DirectWriteBlocked(): boolean {
  return APPENDOO_V3_CUTOVER_ENABLED && !V1_DIRECT_APPLY_REOPENED;
}

export function assertV1DirectWriteAllowed(): void {
  if (isV1DirectWriteBlocked()) {
    throw new Error(V1_DIRECT_WRITE_BLOCKED_MESSAGE);
  }
}

export function shouldBlockV1ProposalForEngineering(useEngineeringPipeline: boolean): boolean {
  return isV1DirectWriteBlocked() && useEngineeringPipeline;
}

export function shouldBlockPanelAutoApply(
  routing?: Pick<AgentStreamRequestRoutingEvent, 'useEngineeringPipeline' | 'requestClass'> | null,
): boolean {
  if (!isV1DirectWriteBlocked()) return false;
  if (!routing) return false;
  // V4-PATCH-1: block v1 auto-apply only on governed pipeline routing — not every ENGINEERING_CHANGE.
  return routing.useEngineeringPipeline;
}

export function resolvePanelApplyBlockedReason(
  routing?: Pick<AgentStreamRequestRoutingEvent, 'useEngineeringPipeline' | 'requestClass'> | null,
): string | undefined {
  if (!shouldBlockPanelAutoApply(routing)) return undefined;
  return ENGINEERING_PROPOSAL_BLOCKED_MESSAGE;
}

export function isAppendooTestEnvironment(): boolean {
  return process.env.VITEST === 'true'
    || process.env.NODE_ENV === 'test'
    || process.env.APPENDOO_TEST_MODE === '1';
}

/** AE-22.2 — block direct ChangeSet apply in production; vitest keeps legacy e2e apply tests. */
export function shouldBlockV1ChangeSetApply(): boolean {
  return isV1DirectWriteBlocked() && !isAppendooTestEnvironment();
}
