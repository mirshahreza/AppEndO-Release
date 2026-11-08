import { createHash } from 'node:crypto';
import type {
  PackageDnaReport,
  PromotionCheckpoint,
  PromotionPreflightResult,
  PromotionRun,
  StartPromotionInput,
} from '../../api/contracts/appendoo/promotion.types';
import { PROMOTION_ENGINE_VERSION } from '../../api/contracts/appendoo/promotion.types';
import type { VerificationRun } from '../../api/contracts/appendoo/verificationEngine.types';

const buildPromotionRunId = (): string => `promote:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

export const runPromotionPreflight = (
  verificationRun: VerificationRun,
): PromotionPreflightResult => {
  const errors: string[] = [];

  if (!verificationRun.deployable) {
    errors.push('ChangeSet is not DEPLOYABLE — verification did not pass.');
  }

  if (verificationRun.state !== 'COMPLETED') {
    errors.push(`Verification run state is ${verificationRun.state}, expected COMPLETED.`);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings: [],
  };
};

export const createPromotionCheckpointScaffold = (
  revisionFingerprint: string,
): PromotionCheckpoint => ({
  checkpointId: `ckpt:${revisionFingerprint.slice(0, 12)}`,
  capturedAt: new Date().toISOString(),
  sourceFingerprints: { baseline: revisionFingerprint },
  indexVersion: undefined,
});

/** AE-9.2 scaffold — promotion run from verified revision. */
export const createPromotionRunScaffold = (
  input: StartPromotionInput,
  verificationRun: VerificationRun,
): PromotionRun | null => {
  const preflight = runPromotionPreflight(verificationRun);
  if (!preflight.ok) {
    return {
      promotionRunId: buildPromotionRunId(),
      changeSetId: input.changeSetId,
      workspaceId: input.workspaceId,
      revisionId: input.revisionId,
      revisionFingerprint: input.revisionFingerprint,
      verificationRunId: input.verificationRunId,
      state: 'FAILED',
      preflight,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
  }

  const checkpoint = createPromotionCheckpointScaffold(input.revisionFingerprint);

  return {
    promotionRunId: buildPromotionRunId(),
    changeSetId: input.changeSetId,
    workspaceId: input.workspaceId,
    revisionId: input.revisionId,
    revisionFingerprint: input.revisionFingerprint,
    verificationRunId: input.verificationRunId,
    state: 'PENDING',
    preflight,
    checkpoint,
    startedAt: new Date().toISOString(),
  };
};

/** AE-9.3 scaffold — staged promotion through checkpoint to DEPLOYED. */
export const advancePromotionScaffold = (run: PromotionRun): PromotionRun => {
  if (run.state === 'FAILED' || !run.preflight?.ok) {
    return run;
  }

  const now = new Date().toISOString();
  const stagedStates: PromotionRun['state'][] = ['PREFLIGHT', 'CHECKPOINT', 'STAGING', 'PROMOTING', 'DEPLOYED'];
  const currentIndex = stagedStates.indexOf(run.state);
  const nextState = currentIndex >= 0 && currentIndex < stagedStates.length - 1
    ? stagedStates[currentIndex + 1]
    : run.state === 'PENDING'
      ? 'DEPLOYED'
      : run.state;

  if (nextState !== 'DEPLOYED') {
    return {
      ...run,
      state: nextState,
      checkpoint: run.checkpoint ?? createPromotionCheckpointScaffold(run.revisionFingerprint),
    };
  }

  return {
    ...run,
    state: 'DEPLOYED',
    deployedAt: now,
    completedAt: now,
    packageSnapshotId: run.packageSnapshotId ?? `pkg-snap:${run.promotionRunId.slice(-12)}`,
  };
};

/** Run full staged promotion scaffold to DEPLOYED. */
export const executePromotionScaffold = (run: PromotionRun): PromotionRun => {
  let current = run;
  let guard = 0;
  while (current.state !== 'DEPLOYED' && current.state !== 'FAILED' && guard < 8) {
    const next = advancePromotionScaffold(current);
    if (next.state === current.state) break;
    current = next;
    guard += 1;
  }
  return current;
};

export const compilePackageDnaScaffold = (
  verificationRun: VerificationRun,
  packageId?: string,
): PackageDnaReport => {
  const sourceFingerprint = verificationRun.revisionFingerprint;
  const dnaFingerprint = createHash('sha256')
    .update(`${sourceFingerprint}:${verificationRun.verificationRunId}`)
    .digest('hex')
    .slice(0, 24);

  return {
    reportId: `dna:${dnaFingerprint}`,
    packageId,
    status: verificationRun.deployable ? 'VERIFIED' : 'FAILED',
    sourceFingerprint,
    dnaFingerprint,
    verificationRef: verificationRun.verificationRunId,
    compiledAt: new Date().toISOString(),
  };
};

export const summarizePromotionRun = (run: PromotionRun): {
  promotionRunId: string;
  state: PromotionRun['state'];
  preflightOk: boolean;
  engineVersion: string;
} => ({
  promotionRunId: run.promotionRunId,
  state: run.state,
  preflightOk: run.preflight?.ok ?? false,
  engineVersion: PROMOTION_ENGINE_VERSION,
});
