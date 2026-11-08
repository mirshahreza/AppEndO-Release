import { describe, expect, it } from 'vitest';
import { createPromotionRunScaffold, executePromotionScaffold } from '../promotionScaffold';
import type { VerificationRun } from '../../../api/contracts/appendoo/verificationEngine.types';

const verifiedRun = (): VerificationRun => ({
  verificationRunId: 'verify:test:1',
  workspaceId: 'ws:test:1',
  revisionId: 'rev:test:1',
  revisionFingerprint: 'fp:test:1',
  changeSetId: 'cs:test:1',
  state: 'COMPLETED',
  graderResults: [],
  deployable: true,
  startedAt: '2026-07-11T00:00:00.000Z',
  completedAt: '2026-07-11T00:00:00.000Z',
});

describe('promotionScaffold', () => {
  it('executes staged promotion to DEPLOYED for verified revision', () => {
    const pending = createPromotionRunScaffold({
      changeSetId: 'cs:test:1',
      workspaceId: 'ws:test:1',
      revisionId: 'rev:test:1',
      revisionFingerprint: 'fp:test:1',
      verificationRunId: 'verify:test:1',
    }, verifiedRun());

    expect(pending?.state).toBe('PENDING');

    const deployed = executePromotionScaffold(pending!);
    expect(deployed.state).toBe('DEPLOYED');
    expect(deployed.deployedAt).toBeTruthy();
    expect(deployed.packageSnapshotId).toMatch(/^pkg-snap:/);
  });
});
