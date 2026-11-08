import { isV1DirectWriteBlocked, shouldBlockV1ProposalForEngineering } from './appendooCutover';
import { resolveAppendooEngineeringExecutionPath } from './appendooV1EngineeringGuard';
import { probeChatPerceivedLatencyHealth } from './chatPerceivedLatencyTelemetry';
import { runGeAgentWf4_001OrchestratorScenario } from './goldenEvalAgentLoopE2e';
import { probeProposalOutcomeTelemetryHealth, summarizeProposalOutcomes } from './proposalOutcomeTelemetry';

export type V4QualityMetricsSnapshot = {
  collectedAt: string;
  source: 'dev_gate';
  productionBaselinePending: true;
  metrics: {
    retrievalOperationCountGate: number | null;
    iterationCountGate: number | null;
    proposalOutcomeSampleCount: number;
    proposalAcceptanceRate: number | null;
    dismissedPreApplyCount: number;
    deadlockProbeOk: boolean;
    perceivedLatencyInstrumentationOk: boolean;
    perceivedLatencySampleCount: number;
    perceivedLatencyP50Ms: number | null;
    perceivedLatencyUnderTargetRate: number | null;
  };
};

/** Dev-gate snapshot for §13.1 — production numeric baseline remains post-rollout. */
export const buildV4QualityMetricsSnapshot = async (): Promise<V4QualityMetricsSnapshot> => {
  const wf4 = await runGeAgentWf4_001OrchestratorScenario();
  const proposalSummary = summarizeProposalOutcomes();
  const perceivedLatencyProbe = probeChatPerceivedLatencyHealth();
  // p-63 — governed-turn v1 blocking must track the write-block policy (reopened by PO).
  const deadlockProbeOk = !shouldBlockV1ProposalForEngineering(false)
    && shouldBlockV1ProposalForEngineering(true) === isV1DirectWriteBlocked()
    && resolveAppendooEngineeringExecutionPath({ useEngineeringPipeline: false }) === 'v1_legacy_test_only';

  return {
    collectedAt: new Date().toISOString(),
    source: 'dev_gate',
    productionBaselinePending: true,
    metrics: {
      retrievalOperationCountGate: wf4.retrievalOperationCount ?? null,
      iterationCountGate: null,
      proposalOutcomeSampleCount: proposalSummary.total,
      proposalAcceptanceRate: proposalSummary.acceptanceRate,
      dismissedPreApplyCount: proposalSummary.dismissedPreApply,
      deadlockProbeOk,
      perceivedLatencyInstrumentationOk: perceivedLatencyProbe.ok,
      perceivedLatencySampleCount: 0,
      perceivedLatencyP50Ms: null,
      perceivedLatencyUnderTargetRate: null,
    },
  };
};

export const probeV4QualityMetricsHealth = (): { ok: boolean; failures: string[] } => {
  const failures: string[] = [];
  if (!probeProposalOutcomeTelemetryHealth().ok) {
    failures.push('Proposal outcome telemetry health probe failed.');
  }
  if (!probeChatPerceivedLatencyHealth().ok) {
    failures.push('Perceived latency telemetry health probe failed.');
  }
  return { ok: failures.length === 0, failures };
};
