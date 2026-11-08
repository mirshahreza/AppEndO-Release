import { APPENDOO_V3_CUTOVER_ENABLED, isAppendooTestEnvironment } from './appendooCutover';

export type AppendooLivePipelineHealth = {
  cutoverEnabled: boolean;
  testEnvironment: boolean;
  livePipelineMasterEnabled: boolean;
  liveRuntimeActivation: boolean;
  liveDesignerPublish: boolean;
  liveExperienceRegistry: boolean;
  livePackageExport: boolean;
};

const isLivePipelineKillSwitchActive = (): boolean => {
  const value = process.env.APPENDOO_DISABLE_LIVE_PIPELINE?.trim().toLowerCase();
  return value === '1' || value === 'true';
};

/** AE-9.11 — tri-state env with V3 cutover default-on (opt-out via `=0` or master kill switch). */
export const resolveAppendooLiveFlag = (envKey: string): boolean => {
  const raw = process.env[envKey]?.trim().toLowerCase();
  if (raw === '1' || raw === 'true') {
    return true;
  }
  if (raw === '0' || raw === 'false') {
    return false;
  }

  if (isLivePipelineKillSwitchActive()) {
    return false;
  }
  if (!APPENDOO_V3_CUTOVER_ENABLED) {
    return false;
  }

  return true;
};

/** AE-9.6 — live platform writes after workspace validation (default-on under V3 cutover). */
export function isLiveRuntimeActivationEnabled(): boolean {
  return resolveAppendooLiveFlag('APPENDOO_LIVE_RUNTIME_ACTIVATION');
}

/** AE-9.7 — live ComponentDesigner publish after workspace validation. */
export function isLiveDesignerPublishEnabled(): boolean {
  const raw = process.env.APPENDOO_LIVE_DESIGNER_PUBLISH?.trim().toLowerCase();
  if (raw === '1' || raw === 'true') {
    return true;
  }
  if (raw === '0' || raw === 'false') {
    return false;
  }
  return isLiveRuntimeActivationEnabled();
}

/** AE-9.8 — live experience registry compile after activation. */
export function isLiveExperienceRegistryEnabled(): boolean {
  const raw = process.env.APPENDOO_LIVE_EXPERIENCE_REGISTRY?.trim().toLowerCase();
  if (raw === '1' || raw === 'true') {
    return true;
  }
  if (raw === '0' || raw === 'false') {
    return false;
  }
  return isLiveDesignerPublishEnabled();
}

/** AE-9.10 — live AppEndO package ZIP export after snapshot finalize. */
export function isLivePackageExportEnabled(): boolean {
  return resolveAppendooLiveFlag('APPENDOO_LIVE_PACKAGE_EXPORT');
}

/** AE-7.8 — checkpoint backing mode: memory (default) | disk (`APPENDOO_DURABLE_GRAPH_CHECKPOINTS=1`) | sqlite (`APPENDOO_CHECKPOINT_BACKING=sqlite`). */
export function isSqliteCheckpointBackingEnabled(): boolean {
  const backing = process.env.APPENDOO_CHECKPOINT_BACKING?.trim().toLowerCase();
  return backing === 'sqlite' || backing === 'db' || process.env.APPENDOO_DURABLE_GRAPH_CHECKPOINTS === 'db';
}

/** AE-10.5 / test-only — force verification failure to exercise R1→R2 repair flow. */
export function isForceVerificationFailureEnabled(): boolean {
  return process.env.APPENDOO_FORCE_VERIFICATION_FAILURE === '1';
}

/** AE-9.11 — summarize live pipeline rollout state for ops/checklists. */
export const getAppendooLivePipelineHealth = (): AppendooLivePipelineHealth => ({
  cutoverEnabled: APPENDOO_V3_CUTOVER_ENABLED,
  testEnvironment: isAppendooTestEnvironment(),
  livePipelineMasterEnabled: APPENDOO_V3_CUTOVER_ENABLED && !isLivePipelineKillSwitchActive(),
  liveRuntimeActivation: isLiveRuntimeActivationEnabled(),
  liveDesignerPublish: isLiveDesignerPublishEnabled(),
  liveExperienceRegistry: isLiveExperienceRegistryEnabled(),
  livePackageExport: isLivePackageExportEnabled(),
});

export const probeAppendooLivePipelineRollout = (): { ok: boolean; reason?: string } => {
  const health = getAppendooLivePipelineHealth();

  if (!health.cutoverEnabled) {
    return { ok: false, reason: 'V3 cutover is disabled.' };
  }

  if (!health.liveRuntimeActivation) {
    return { ok: false, reason: 'Live runtime activation is disabled under cutover.' };
  }

  if (health.testEnvironment) {
    return { ok: true, reason: 'Test environment defaults live activation on under cutover (use tmp cwd for file writes).' };
  }

  return { ok: true };
};

export type LiveRuntimeActivationHealth = {
  liveRuntimeActivation: boolean;
  liveDesignerPublish: boolean;
  testEnvironment: boolean;
};

/** AE-9.6/9.7 — health probe for live runtime + designer activation depth. */
export const getLiveRuntimeActivationHealth = (): LiveRuntimeActivationHealth => ({
  liveRuntimeActivation: isLiveRuntimeActivationEnabled(),
  liveDesignerPublish: isLiveDesignerPublishEnabled(),
  testEnvironment: isAppendooTestEnvironment(),
});

/** Smoke-check that live activation flags are enabled under V3 cutover. */
export const probeLiveRuntimeActivationDepth = (): { ok: boolean; reason?: string } => {
  const health = getLiveRuntimeActivationHealth();

  if (!APPENDOO_V3_CUTOVER_ENABLED) {
    return { ok: false, reason: 'V3 cutover is disabled.' };
  }

  if (!health.liveRuntimeActivation) {
    return { ok: false, reason: 'Live runtime activation is disabled.' };
  }

  if (!health.liveDesignerPublish) {
    return { ok: false, reason: 'Live designer publish is disabled.' };
  }

  return { ok: true };
};
