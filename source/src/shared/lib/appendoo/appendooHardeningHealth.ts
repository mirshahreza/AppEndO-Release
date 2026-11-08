import { APPENDOO_V3_CUTOVER_ENABLED } from './appendooCutover';
import {
  getAppendooLivePipelineHealth,
  isForceVerificationFailureEnabled,
  probeLiveRuntimeActivationDepth,
} from './appendooIntegrationFlags';
import { probeAppendooProductionOps } from './appendooProductionOpsHealth';
import { evaluateAppendooV1RemovalChecklist } from './appendooV1RemovalChecklist';
import { probeAppendooV1DeadCodeRegistry } from './appendooV1DeadCodeRegistry';
import { isV1EngineeringWritePathBlocked, resolveAppendooEngineeringExecutionPath } from './appendooV1EngineeringGuard';
import { isLegacyE2eInCriticalPath, probeV1LegacyE2eMigration } from './appendooV1E2eMigration';

export const APPENDOO_RED_TEAM_CHECKLIST_VERSION = '1.0.0';

export type AppendooRedTeamChecklistItem = {
  id: string;
  label: string;
  ok: boolean;
  reason?: string;
};

export type AppendooRedTeamChecklistResult = {
  ok: boolean;
  version: string;
  items: AppendooRedTeamChecklistItem[];
  failures: string[];
};

/** AE-11.2 — release-blocking red-team guard checklist scaffold. */
export const evaluateAppendooRedTeamChecklist = (): AppendooRedTeamChecklistResult => {
  const items: AppendooRedTeamChecklistItem[] = [];
  const live = getAppendooLivePipelineHealth();
  const v1Removal = evaluateAppendooV1RemovalChecklist();
  const deadCode = probeAppendooV1DeadCodeRegistry();
  const liveActivation = probeLiveRuntimeActivationDepth();
  const productionOps = probeAppendooProductionOps();

  items.push({
    id: 'RT-01',
    label: 'V3 cutover enabled',
    ok: APPENDOO_V3_CUTOVER_ENABLED,
  });

  items.push({
    id: 'RT-02',
    label: 'V1 removal checklist green',
    ok: v1Removal.ok,
    reason: v1Removal.failures[0],
  });

  items.push({
    id: 'RT-03',
    label: 'V1 dead code registry complete',
    ok: deadCode.ok,
    reason: deadCode.reason,
  });

  items.push({
    id: 'RT-04',
    label: 'Live pipeline master enabled under cutover',
    ok: live.livePipelineMasterEnabled || live.testEnvironment,
    reason: live.testEnvironment ? 'Test environment defaults live activation on under cutover.' : undefined,
  });

  items.push({
    id: 'RT-05',
    label: 'Force verification failure is opt-in only',
    ok: !isForceVerificationFailureEnabled() || process.env.VITEST === 'true',
    reason: isForceVerificationFailureEnabled() ? 'Repair drill flag active.' : undefined,
  });

  items.push({
    id: 'RT-06',
    label: 'Engineering changes route to V3 pipeline under cutover',
    ok: resolveAppendooEngineeringExecutionPath({
      useEngineeringPipeline: true,
      requestClass: 'ENGINEERING_CHANGE',
    }) === 'v3_pipeline'
      && isV1EngineeringWritePathBlocked({
        useEngineeringPipeline: true,
        requestClass: 'ENGINEERING_CHANGE',
      }),
  });

  const e2eMigration = probeV1LegacyE2eMigration();
  items.push({
    id: 'RT-07',
    label: 'Legacy e2e migration registry complete',
    ok: e2eMigration.ok,
    reason: e2eMigration.reason,
  });

  items.push({
    id: 'RT-08',
    label: 'No legacy e2e in critical path',
    ok: e2eMigration.ok && !isLegacyE2eInCriticalPath(),
    reason: isLegacyE2eInCriticalPath() ? 'Legacy e2e still listed in test:critical.' : undefined,
  });

  items.push({
    id: 'RT-09',
    label: 'Live runtime activation depth probe',
    ok: liveActivation.ok,
    reason: liveActivation.reason,
  });

  items.push({
    id: 'RT-10',
    label: 'Production ops aggregate probe',
    ok: productionOps.ok,
    reason: productionOps.failures[0],
  });

  const failures = items
    .filter((item) => !item.ok)
    .map((item) => `${item.id}: ${item.reason ?? item.label}`);

  return {
    ok: failures.length === 0,
    version: APPENDOO_RED_TEAM_CHECKLIST_VERSION,
    items,
    failures,
  };
};

export type AppendooHardeningHealthProbe = {
  ok: boolean;
  redTeamOk: boolean;
  failures: string[];
};

/** AE-11.2 — combined hardening health probe for golden eval. */
export const probeAppendooHardeningScaffold = (): AppendooHardeningHealthProbe => {
  const redTeam = evaluateAppendooRedTeamChecklist();
  const failures = redTeam.ok ? [] : [...redTeam.failures];

  return {
    ok: failures.length === 0,
    redTeamOk: redTeam.ok,
    failures,
  };
};
