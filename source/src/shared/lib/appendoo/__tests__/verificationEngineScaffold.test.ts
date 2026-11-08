import { describe, expect, it } from 'vitest';
import { runVerificationScaffold, summarizeVerificationRun } from '../verificationEngineScaffold';

describe('verificationEngineScaffold', () => {
  it('passes when no active-root mutations', () => {
    const run = runVerificationScaffold({
      workspaceId: 'ws-1',
      revisionId: 'rev-1',
      revisionFingerprint: 'fp-abc',
      changeSetId: 'cs-1',
      mutationPaths: ['appendoo/ws/cs-1/demo.ts'],
      enabledGraderIds: ['active-root-mutation', 'project-standards'],
    });

    expect(run.deployable).toBe(true);
    expect(run.state).toBe('COMPLETED');
    expect(run.graderResults.find((r) => r.graderId === 'active-root-mutation')?.grade).toBe('PASS');
  });

  it('fails deployable on active-root mutation', () => {
    const run = runVerificationScaffold({
      workspaceId: 'ws-2',
      revisionId: 'rev-2',
      revisionFingerprint: 'fp-def',
      changeSetId: 'cs-2',
      mutationPaths: ['src/server/routes/users.routes.ts'],
      enabledGraderIds: ['active-root-mutation', 'workspace-drift', 'project-standards'],
    });

    expect(run.deployable).toBe(false);
    expect(run.state).toBe('FAILED');
    expect(run.failureClass).toBe('BUILDER');
  });

  it('fails deployable on workspace drift outside appendoo/ws prefix', () => {
    const run = runVerificationScaffold({
      workspaceId: 'ws-4',
      revisionId: 'rev-4',
      revisionFingerprint: 'fp-jkl',
      changeSetId: 'cs-4',
      mutationPaths: ['packages/demo/manifest.json'],
      enabledGraderIds: ['workspace-drift'],
    });

    expect(run.deployable).toBe(false);
    expect(run.graderResults.find((result) => result.graderId === 'workspace-drift')?.grade).toBe('FAIL');
  });

  it('summarizes verification run', () => {
    const run = runVerificationScaffold({
      workspaceId: 'ws-3',
      revisionId: 'rev-3',
      revisionFingerprint: 'fp-ghi',
      changeSetId: 'cs-3',
      enabledGraderIds: ['active-root-mutation'],
    });

    const summary = summarizeVerificationRun(run);
    expect(summary.verificationRunId).toBe(run.verificationRunId);
    expect(summary.engineVersion).toBeTruthy();
  });
});
