import type {
  StartVerificationRunInput,
  VerificationFailureClass,
  VerificationGraderDefinition,
  VerificationGraderResult,
  VerificationRun,
} from '../../api/contracts/appendoo/verificationEngine.types';
import {
  DEFAULT_VERIFICATION_GRADERS,
  VERIFICATION_ENGINE_VERSION,
} from '../../api/contracts/appendoo/verificationEngine.types';
import { isForceVerificationFailureEnabled } from './appendooIntegrationFlags';
import { runVerificationGrader } from './verificationGraders';

const buildVerificationRunId = (): string => `verify:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

const classifyFailure = (results: VerificationGraderResult[]): VerificationFailureClass | undefined => {
  const failed = results.filter((result) => result.grade === 'FAIL');
  if (failed.length === 0) return undefined;

  if (failed.some((result) => (
    result.graderId === 'active-root-mutation'
    || result.graderId === 'workspace-drift'
    || result.graderId === 'project-standards'
  ))) {
    return 'BUILDER';
  }

  return 'PLAN';
};

/** AE-9.1 scaffold — deterministic verification run with active-root grader. */
export const runVerificationScaffold = (
  input: StartVerificationRunInput,
  graders: VerificationGraderDefinition[] = DEFAULT_VERIFICATION_GRADERS,
): VerificationRun => {
  const startedAt = new Date().toISOString();
  const enabledIds = new Set(input.enabledGraderIds ?? graders.filter((g) => g.enabled).map((g) => g.graderId));
  const selectedGraders = graders.filter((grader) => enabledIds.has(grader.graderId));
  const mutationPaths = input.mutationPaths ?? [];

  const graderResults = selectedGraders.map((grader) => (
    runVerificationGrader(grader, mutationPaths, input.changeSetId)
  ));
  const forcedFailure = isForceVerificationFailureEnabled();
  const hasFail = forcedFailure || graderResults.some((result) => result.grade === 'FAIL');
  const failureClass = forcedFailure ? 'BUILDER' : classifyFailure(graderResults);

  return {
    verificationRunId: buildVerificationRunId(),
    workspaceId: input.workspaceId,
    revisionId: input.revisionId,
    revisionFingerprint: input.revisionFingerprint,
    changeSetId: input.changeSetId,
    state: hasFail ? 'FAILED' : 'COMPLETED',
    graderResults,
    deployable: !hasFail,
    failureClass,
    startedAt,
    completedAt: new Date().toISOString(),
    reuseRatios: undefined,
  };
};

export const summarizeVerificationRun = (run: VerificationRun): {
  verificationRunId: string;
  deployable: boolean;
  passCount: number;
  failCount: number;
  warningCount: number;
  skippedCount: number;
  engineVersion: string;
} => {
  const passCount = run.graderResults.filter((r) => r.grade === 'PASS').length;
  const failCount = run.graderResults.filter((r) => r.grade === 'FAIL').length;
  const warningCount = run.graderResults.filter((r) => r.grade === 'WARNING').length;
  const skippedCount = run.graderResults.filter((r) => r.grade === 'SKIPPED').length;

  return {
    verificationRunId: run.verificationRunId,
    deployable: run.deployable,
    passCount,
    failCount,
    warningCount,
    skippedCount,
    engineVersion: VERIFICATION_ENGINE_VERSION,
  };
};
