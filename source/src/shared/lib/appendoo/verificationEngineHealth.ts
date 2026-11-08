import { DEFAULT_VERIFICATION_GRADERS, VERIFICATION_ENGINE_VERSION } from '../../api/contracts/appendoo/verificationEngine.types';
import { runVerificationScaffold } from './verificationEngineScaffold';

export type VerificationEngineHealthProbe = {
  ok: boolean;
  engineVersion: string;
  enabledGraderCount: number;
  implementedGraderCount: number;
  failures: string[];
};

const SAMPLE_MUTATION_PATHS = [
  'appendoo/ws/cs-verify/workspace/server-functions/custom/export.ts',
  'appendoo/ws/cs-verify/workspace/server-functions/custom/export.metadata.json',
  'appendoo/ws/cs-verify/workspace/designer/drafts/home-page/draft.json',
  'appendoo/ws/cs-verify/workspace/designer/drafts/home-page/page.tsx',
  'appendoo/ws/cs-verify/workspace/platform-registry/routes/home.json',
  'appendoo/ws/cs-verify/workspace/platform-registry/permissions/read-users.json',
  'appendoo/ws/cs-verify/runtime/data-sources/schema/users.json',
  'appendoo/ws/cs-verify/runtime/packages/manifest.json',
];

/** AE-9.3 — health probe ensuring graders execute with depth (not default SKIPPED). */
export const probeVerificationEngineScaffold = (): VerificationEngineHealthProbe => {
  const failures: string[] = [];
  const enabledGraders = DEFAULT_VERIFICATION_GRADERS.filter((grader) => grader.enabled);

  const run = runVerificationScaffold({
    workspaceId: 'ws-verify-health',
    revisionId: 'rev-verify-health',
    revisionFingerprint: 'fp-verify-health',
    changeSetId: 'cs-verify',
    mutationPaths: SAMPLE_MUTATION_PATHS,
  });

  const skippedDeferred = run.graderResults.filter((result) => (
    result.grade === 'SKIPPED'
    && result.diagnostics.some((entry) => entry.includes('depth deferred'))
  ));
  if (skippedDeferred.length > 0) {
    failures.push(`Deferred graders remain: ${skippedDeferred.map((item) => item.graderId).join(', ')}`);
  }

  const passOrSkipped = run.graderResults.filter((result) => result.grade === 'PASS' || result.grade === 'SKIPPED');
  if (passOrSkipped.length < enabledGraders.length) {
    failures.push('Expected all enabled graders to PASS or contextual SKIPPED.');
  }

  const failCount = run.graderResults.filter((result) => result.grade === 'FAIL').length;
  if (failCount > 0) {
    failures.push(`Sample verification run reported ${failCount} FAIL grade(s).`);
  }

  if (!run.deployable) {
    failures.push('Sample verification run should be deployable.');
  }

  const implementedGraderCount = enabledGraders.length - skippedDeferred.length;

  return {
    ok: failures.length === 0,
    engineVersion: VERIFICATION_ENGINE_VERSION,
    enabledGraderCount: enabledGraders.length,
    implementedGraderCount,
    failures,
  };
};
