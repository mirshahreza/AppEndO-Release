import { describe, expect, it, beforeEach } from 'vitest';
import { verificationEngineService } from '../verificationEngine.service';
import { engineeringWorkspaceService } from '../engineeringWorkspace.service';

describe('VerificationEngineService', () => {
  beforeEach(() => {
    engineeringWorkspaceService.resetForTests();
  });

  it('verifies workspace revision and marks result', () => {
    const created = engineeringWorkspaceService.createWorkspace({
      changeSetId: 'cs-verify-1',
      applicationScope: {
        kind: 'platform',
        scopeKey: 'platform:studio',
        mountId: 'studio',
      },
    });

    const result = verificationEngineService.verifyWorkspaceRevision(
      created.workspace.workspaceId,
      created.revision.revisionId,
      {
        changeSetId: 'cs-verify-1',
        mutationPaths: ['appendoo/ws/cs-verify-1/page.tsx'],
      },
    );

    expect(result?.run.deployable).toBe(true);
    expect(result?.summary.passCount).toBeGreaterThan(0);

    const updatedRevision = engineeringWorkspaceService.getRevision(
      created.workspace.workspaceId,
      created.revision.revisionId,
    );
    expect(updatedRevision?.state).toBe('VERIFIED');
  });
});
