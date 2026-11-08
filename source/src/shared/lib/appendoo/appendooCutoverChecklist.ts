import {
  APPENDOO_V3_CUTOVER_ENABLED,
  ENGINEERING_PROPOSAL_BLOCKED_MESSAGE,
  isV1DirectWriteBlocked,
  resolvePanelApplyBlockedReason,
  shouldBlockPanelAutoApply,
  V1_DIRECT_WRITE_BLOCKED_MESSAGE,
} from './appendooCutover';
import { probeEngineeringRoutingCutover } from './appendooCutoverHealth';
import { probeAppendooLivePipelineRollout } from './appendooIntegrationFlags';

export type AppendooCutoverChecklistItem = {
  id: string;
  label: string;
  ok: boolean;
  reason?: string;
};

export type AppendooCutoverChecklistResult = {
  ok: boolean;
  items: AppendooCutoverChecklistItem[];
  failures: string[];
};

/** AE-22.1 — automated cutover readiness checklist for golden eval / ops. */
export const evaluateAppendooCutoverChecklist = (input?: {
  pipelineGatePassed?: boolean;
}): AppendooCutoverChecklistResult => {
  const items: AppendooCutoverChecklistItem[] = [];

  // p-63 — CUT-01 checks the pipeline-gating flag itself, not the (reopened) v1 write block.
  items.push({
    id: 'CUT-01',
    label: 'V3 cutover flag enabled',
    ok: APPENDOO_V3_CUTOVER_ENABLED,
    reason: APPENDOO_V3_CUTOVER_ENABLED ? undefined : 'APPENDOO_V3_CUTOVER_ENABLED is false.',
  });

  items.push({
    id: 'CUT-02',
    label: 'v1 direct write blocked message configured',
    ok: V1_DIRECT_WRITE_BLOCKED_MESSAGE.includes('engineering pipeline'),
    reason: V1_DIRECT_WRITE_BLOCKED_MESSAGE.length > 0 ? undefined : 'Missing v1 block message.',
  });

  const routingProbe = probeEngineeringRoutingCutover();
  items.push({
    id: 'CUT-03',
    label: 'Engineering routing auto-apply block probe',
    ok: routingProbe.ok,
    reason: routingProbe.reason,
  });

  items.push({
    id: 'CUT-04',
    label: 'Panel auto-apply allowed for ENGINEERING_CHANGE without governed pipeline',
    ok: !shouldBlockPanelAutoApply({
      useEngineeringPipeline: false,
      requestClass: 'ENGINEERING_CHANGE',
    }),
    reason: shouldBlockPanelAutoApply({
      useEngineeringPipeline: false,
      requestClass: 'ENGINEERING_CHANGE',
    })
      ? 'ENGINEERING_CHANGE without pipeline must allow agent-loop proposal apply.'
      : undefined,
  });

  // p-63 — pipeline-routed panel apply blocking must be consistent with the v1 write-block
  // state: blocked while the write block is active, allowed once v1 apply is reopened.
  items.push({
    id: 'CUT-05',
    label: 'Panel auto-apply for pipeline routing consistent with v1 write-block state',
    ok: shouldBlockPanelAutoApply({
      useEngineeringPipeline: true,
      requestClass: 'TOOL_QUERY',
    }) === isV1DirectWriteBlocked(),
  });

  items.push({
    id: 'CUT-06',
    label: 'Non-engineering TOOL_QUERY routing not blocked',
    ok: !shouldBlockPanelAutoApply({
      useEngineeringPipeline: false,
      requestClass: 'TOOL_QUERY',
    }),
  });

  const blockReason = resolvePanelApplyBlockedReason({
    useEngineeringPipeline: true,
    requestClass: 'ENGINEERING_CHANGE',
  });
  items.push({
    id: 'CUT-07',
    label: 'Engineering proposal blocked message configured',
    ok: ENGINEERING_PROPOSAL_BLOCKED_MESSAGE.includes('Verification')
      && (Boolean(blockReason) === isV1DirectWriteBlocked()),
    reason: ENGINEERING_PROPOSAL_BLOCKED_MESSAGE.includes('Verification')
      ? undefined
      : 'Missing engineering proposal block message.',
  });

  if (input?.pipelineGatePassed !== undefined) {
    items.push({
      id: 'CUT-08',
      label: 'Engineering pipeline golden gate',
      ok: input.pipelineGatePassed,
      reason: input.pipelineGatePassed ? undefined : 'GE-PIPELINE-GATE failed.',
    });
  }

  const liveRollout = probeAppendooLivePipelineRollout();
  items.push({
    id: 'CUT-09',
    label: 'Live pipeline rollout probe',
    ok: liveRollout.ok,
    reason: liveRollout.reason,
  });

  const failures = items.filter((item) => !item.ok).map((item) => `${item.id}: ${item.reason ?? item.label}`);

  return {
    ok: failures.length === 0,
    items,
    failures,
  };
};
