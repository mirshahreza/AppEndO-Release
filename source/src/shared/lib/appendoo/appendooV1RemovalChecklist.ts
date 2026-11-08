import {
  assertV1DirectWriteAllowed,
  ENGINEERING_PROPOSAL_BLOCKED_MESSAGE,
  isAppendooTestEnvironment,
  isV1DirectWriteBlocked,
  shouldBlockPanelAutoApply,
  shouldBlockV1ChangeSetApply,
  shouldBlockV1ProposalForEngineering,
  V1_DIRECT_WRITE_BLOCKED_MESSAGE,
} from './appendooCutover';
export type AppendooV1RemovalChecklistItem = {
  id: string;
  label: string;
  ok: boolean;
  reason?: string;
};

export type AppendooV1RemovalChecklistResult = {
  ok: boolean;
  items: AppendooV1RemovalChecklistItem[];
  failures: string[];
};

/**
 * AE-22.2 — originally "prove v1 write path is unreachable from V3 engineering surfaces".
 * p-63 (PO decision 2026-07-18) reopened v1 proposal apply, so the checklist now verifies
 * CONSISTENCY with the active write-block policy instead of asserting the block is on:
 * every guard must agree with `isV1DirectWriteBlocked()`, whichever way the dial is set.
 */
export const evaluateAppendooV1RemovalChecklist = (): AppendooV1RemovalChecklistResult => {
  const items: AppendooV1RemovalChecklistItem[] = [];
  const writeBlocked = isV1DirectWriteBlocked();

  items.push({
    id: 'V1R-01',
    label: 'v1 write-block policy resolved',
    ok: typeof writeBlocked === 'boolean',
  });

  items.push({
    id: 'V1R-02',
    label: 'Agent apply API blocked message configured',
    ok: V1_DIRECT_WRITE_BLOCKED_MESSAGE.includes('engineering pipeline'),
  });

  items.push({
    id: 'V1R-03',
    label: 'ChangeSet apply guard consistent with write-block policy',
    ok: writeBlocked
      ? (isAppendooTestEnvironment() || shouldBlockV1ChangeSetApply())
      : !shouldBlockV1ChangeSetApply(),
    reason: isAppendooTestEnvironment() && writeBlocked
      ? 'Test environment bypasses ChangeSet guard for legacy e2e coverage.'
      : undefined,
  });

  items.push({
    id: 'V1R-04',
    label: 'Orchestrator engineering proposal finalize consistent with write-block policy',
    ok: shouldBlockV1ProposalForEngineering(true) === writeBlocked,
  });

  items.push({
    id: 'V1R-05',
    label: 'Panel auto-apply allowed for ENGINEERING_CHANGE without governed pipeline',
    ok: !shouldBlockPanelAutoApply({
      useEngineeringPipeline: false,
      requestClass: 'ENGINEERING_CHANGE',
    }),
  });

  items.push({
    id: 'V1R-06',
    label: 'Engineering proposal blocked message configured',
    ok: ENGINEERING_PROPOSAL_BLOCKED_MESSAGE.includes('Verification'),
  });

  items.push({
    id: 'V1R-07',
    label: 'Direct v1 write assert consistent with write-block policy',
    ok: (() => {
      try {
        assertV1DirectWriteAllowed();
        return !writeBlocked;
      } catch {
        return writeBlocked;
      }
    })(),
  });

  const failures = items
    .filter((item) => !item.ok)
    .map((item) => `${item.id}: ${item.reason ?? item.label}`);

  return {
    ok: failures.length === 0,
    items,
    failures,
  };
};

export const probeAppendooV1Removal = (): { ok: boolean; reason?: string } => {
  const checklist = evaluateAppendooV1RemovalChecklist();
  if (checklist.ok) {
    return { ok: true };
  }
  return { ok: false, reason: checklist.failures[0] };
};
