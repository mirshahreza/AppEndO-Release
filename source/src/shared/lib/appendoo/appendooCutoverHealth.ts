import {
  APPENDOO_V3_CUTOVER_ENABLED,
  ENGINEERING_PROPOSAL_BLOCKED_MESSAGE,
  isV1DirectWriteBlocked,
  resolvePanelApplyBlockedReason,
  V1_DIRECT_WRITE_BLOCKED_MESSAGE,
} from './appendooCutover';

export type AppendooCutoverHealth = {
  cutoverEnabled: boolean;
  v1DirectWriteBlocked: boolean;
  engineeringProposalBlockedMessage: string;
  v1DirectWriteBlockedMessage: string;
};

/** AE-22 prep — summarize V3 cutover gate state for ops/checklists. */
export const getAppendooCutoverHealth = (): AppendooCutoverHealth => ({
  cutoverEnabled: APPENDOO_V3_CUTOVER_ENABLED,
  v1DirectWriteBlocked: isV1DirectWriteBlocked(),
  engineeringProposalBlockedMessage: ENGINEERING_PROPOSAL_BLOCKED_MESSAGE,
  v1DirectWriteBlockedMessage: V1_DIRECT_WRITE_BLOCKED_MESSAGE,
});

export const probeEngineeringRoutingCutover = (): { ok: boolean; reason?: string } => {
  if (!APPENDOO_V3_CUTOVER_ENABLED) {
    return { ok: false, reason: 'V3 cutover flag is disabled.' };
  }

  // p-63 — with v1 direct apply reopened (PO decision), the auto-apply block is intentionally
  // absent; the probe only verifies consistency when the write block is actually active.
  if (isV1DirectWriteBlocked()) {
    const reason = resolvePanelApplyBlockedReason({
      useEngineeringPipeline: true,
      requestClass: 'ENGINEERING_CHANGE',
    });
    if (!reason) {
      return { ok: false, reason: 'Expected engineering auto-apply block reason.' };
    }
  }

  return { ok: true };
};
