// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EngineeringVerificationPanel } from '../EngineeringVerificationPanel';

describe('EngineeringVerificationPanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders verification summary and details when expanded', () => {
    render(
      <EngineeringVerificationPanel
        pipeline={{
          type: 'engineering_pipeline',
          planId: 'asp:test:1',
          planRevision: 1,
          planObjective: 'Add export action',
          artifactCount: 1,
          capabilityGapCount: 0,
          changeGraphId: 'cg:test:1',
          changeNodeCount: 1,
          verificationRunId: 'verify:test:1',
          deployable: true,
          verificationPassCount: 1,
          verificationFailCount: 0,
          promotionRunId: 'promote:test:1',
          promotionState: 'DEPLOYED',
          promotionPreflightOk: true,
          packageSnapshotId: 'pkg-snap:test:1',
          packageRoundtripValidated: true,
          runtimeActivatedCount: 2,
          checkpointId: 'cg:test:1:123',
          executedNodeCount: 1,
          failedNodeCount: 0,
          requiresApproval: true,
        }}
      />,
    );

    expect(screen.getByTestId('engineering-verification-panel')).toBeTruthy();
    expect(screen.getByText(/Verification passed and changes were promoted/)).toBeTruthy();

    fireEvent.click(screen.getByTestId('engineering-verification-details-toggle'));
    expect(screen.getByText('Deployable')).toBeTruthy();
    expect(screen.getByText('DEPLOYED')).toBeTruthy();
    expect(screen.getByText('Validated')).toBeTruthy();
    expect(screen.getByText('pkg-snap:test:1')).toBeTruthy();
  });

  it('returns null when verification has not run', () => {
    const { container } = render(
      <EngineeringVerificationPanel
        pipeline={{
          type: 'engineering_pipeline',
          planId: 'asp:test:1',
          planRevision: 1,
          planObjective: 'Add export action',
          artifactCount: 1,
          capabilityGapCount: 0,
          changeGraphId: 'cg:test:1',
          changeNodeCount: 1,
          executedNodeCount: 0,
          failedNodeCount: 0,
          requiresApproval: true,
        }}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('shows repair banner when verification fails and details are expanded', () => {
    render(
      <EngineeringVerificationPanel
        pipeline={{
          type: 'engineering_pipeline',
          planId: 'asp:test:1',
          planRevision: 1,
          planObjective: 'Add export action',
          artifactCount: 1,
          capabilityGapCount: 0,
          changeGraphId: 'cg:test:1',
          changeNodeCount: 1,
          verificationRunId: 'verify:test:1',
          deployable: false,
          verificationPassCount: 0,
          verificationFailCount: 1,
          failedRevisionId: 'rev:failed:1',
          repairRevisionId: 'rev:repair:2',
          repairRevisionNumber: 2,
          executedNodeCount: 1,
          failedNodeCount: 0,
          requiresApproval: true,
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('engineering-verification-details-toggle'));
    expect(screen.getByTestId('engineering-verification-repair-banner')).toBeTruthy();
    expect(screen.getByText(/Verification blocked/)).toBeTruthy();
    expect(screen.getByText(/R2/)).toBeTruthy();
  });

  it('shows repair re-execute button when repair revision is open', () => {
    render(
      <EngineeringVerificationPanel
        pipeline={{
          type: 'engineering_pipeline',
          planId: 'asp:test:1',
          planRevision: 1,
          planObjective: 'Add export action',
          artifactCount: 1,
          capabilityGapCount: 0,
          changeGraphId: 'cg:test:1',
          changeNodeCount: 1,
          approvalBindingId: 'bind:test:1',
          verificationRunId: 'verify:test:1',
          deployable: false,
          verificationPassCount: 0,
          verificationFailCount: 1,
          failedRevisionId: 'rev:failed:1',
          repairRevisionId: 'rev:repair:2',
          repairRevisionNumber: 2,
          executedNodeCount: 1,
          failedNodeCount: 0,
          requiresApproval: true,
        }}
        onRepairExecute={() => undefined}
      />,
    );

    fireEvent.click(screen.getByTestId('engineering-verification-details-toggle'));
    expect(screen.getByTestId('engineering-verification-repair-execute')).toBeTruthy();
    expect(screen.getByText('Re-run repair revision')).toBeTruthy();
  });
});
