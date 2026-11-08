import { describe, expect, it, beforeEach } from 'vitest';
import { EngineeringWorkspaceService } from '../engineeringWorkspace.service';

describe('EngineeringWorkspaceService', () => {
  const service = new EngineeringWorkspaceService();

  beforeEach(() => {
    service.resetForTests();
  });

  it('creates workspace and retrieves revision', () => {
    const created = service.createWorkspace({
      changeSetId: 'cs-svc-1',
      applicationScope: {
        kind: 'platform',
        scopeKey: 'platform:studio:page:roles',
        mountId: 'studio',
        pageKey: 'roles',
      },
    });

    expect(service.getWorkspace(created.workspace.workspaceId)).toEqual(created.workspace);
    expect(service.getRevision(created.workspace.workspaceId, created.revision.revisionId)).toEqual(created.revision);
  });

  it('supports R1 fail → R2 repair revision flow', () => {
    const created = service.createWorkspace({
      changeSetId: 'cs-svc-2',
      applicationScope: {
        kind: 'platform',
        scopeKey: 'platform:studio',
        mountId: 'studio',
      },
    });

    const frozen = service.freezeForVerification(created.workspace.workspaceId, created.revision.revisionId);
    expect(frozen?.state).toBe('FROZEN_FOR_VERIFICATION');

    const failed = service.markVerificationResult(
      created.workspace.workspaceId,
      created.revision.revisionId,
      {
        passed: false,
        verificationRunId: 'verify-1',
        revisionFingerprint: created.revision.revisionFingerprint,
        at: new Date().toISOString(),
      },
    );
    expect(failed?.revision.state).toBe('FAILED');
    expect(failed?.workspace.state).toBe('FAILED');

    const repair = service.createRevision({
      workspaceId: created.workspace.workspaceId,
      parentRevisionId: created.revision.revisionId,
      reason: 'repair after verify fail',
    });
    expect(repair?.revisionNumber).toBe(2);
    expect(repair?.state).toBe('OPEN');
  });
});
