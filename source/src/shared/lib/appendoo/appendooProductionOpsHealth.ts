import { getAppendooCutoverHealth } from './appendooCutoverHealth';
import {
  getChangeGraphCheckpointBackingHealth,
  probeChangeGraphCheckpointBacking,
} from './changeGraphCheckpointBackingHealth';
import { probeContextPackEnrichmentProductionDepth } from './contextPackBuilderHealth';
import {
  getAppendooLivePipelineHealth,
  probeAppendooLivePipelineRollout,
  probeLiveRuntimeActivationDepth,
} from './appendooIntegrationFlags';

export const APPENDOO_PRODUCTION_OPS_VERSION = '1.0.0';

export type AppendooProductionOpsHealth = {
  version: string;
  cutoverEnabled: boolean;
  livePipelineRolloutOk: boolean;
  liveRuntimeActivationOk: boolean;
  checkpointBackingMode: string;
  checkpointBackingDurable: boolean;
  contextPackEnrichmentOk: boolean;
  killSwitchActive: boolean;
};

/** AE-11 — aggregate production ops health view for dashboards and golden closure. */
export const getAppendooProductionOpsHealth = (): AppendooProductionOpsHealth => {
  const cutover = getAppendooCutoverHealth();
  const live = getAppendooLivePipelineHealth();
  const checkpoint = getChangeGraphCheckpointBackingHealth();
  const enrichment = probeContextPackEnrichmentProductionDepth();
  const liveRollout = probeAppendooLivePipelineRollout();
  const liveActivation = probeLiveRuntimeActivationDepth();

  return {
    version: APPENDOO_PRODUCTION_OPS_VERSION,
    cutoverEnabled: cutover.cutoverEnabled,
    livePipelineRolloutOk: liveRollout.ok,
    liveRuntimeActivationOk: liveActivation.ok,
    checkpointBackingMode: checkpoint.mode,
    checkpointBackingDurable: checkpoint.durable,
    contextPackEnrichmentOk: enrichment.ok,
    killSwitchActive: live.cutoverEnabled && !live.livePipelineMasterEnabled,
  };
};

export type AppendooProductionOpsProbe = {
  ok: boolean;
  health: AppendooProductionOpsHealth;
  failures: string[];
};

/** Smoke-check production ops readiness (cutover, live rollout, checkpoints, context enrichment). */
export const probeAppendooProductionOps = (): AppendooProductionOpsProbe => {
  const health = getAppendooProductionOpsHealth();
  const failures: string[] = [];

  if (!health.cutoverEnabled) {
    failures.push('V3 cutover is disabled.');
  }
  if (!health.livePipelineRolloutOk) {
    failures.push('Live pipeline rollout probe failed.');
  }
  if (!health.liveRuntimeActivationOk) {
    failures.push('Live runtime activation depth probe failed.');
  }
  if (!probeChangeGraphCheckpointBacking().ok) {
    failures.push('Checkpoint backing probe failed.');
  }
  if (!health.contextPackEnrichmentOk) {
    failures.push('Context pack enrichment production depth probe failed.');
  }

  return {
    ok: failures.length === 0,
    health,
    failures,
  };
};
