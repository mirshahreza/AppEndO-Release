// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SemanticPlanPanel } from '../SemanticPlanPanel';

describe('SemanticPlanPanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a one-line ASP summary by default', () => {
    render(
      <SemanticPlanPanel
        pipeline={{
          type: 'engineering_pipeline',
          planId: 'asp:test:1',
          planRevision: 1,
          planObjective: 'Add export action to users grid',
          artifactCount: 2,
          capabilityGapCount: 1,
          changeGraphId: 'cg:test:1',
          changeNodeCount: 2,
          contextPackRevision: 1,
          approvalBindingId: 'asp-approval:test:1',
          approvalStatus: 'pending',
          executedNodeCount: 0,
          failedNodeCount: 0,
          requiresApproval: true,
        }}
      />,
    );

    expect(screen.getByTestId('semantic-plan-panel')).toBeTruthy();
    expect(screen.getByText(/Add export action to users grid/)).toBeTruthy();
    expect(screen.queryByText('cg:test:1')).toBeNull();
  });

  it('shows technical details after expanding', () => {
    render(
      <SemanticPlanPanel
        pipeline={{
          type: 'engineering_pipeline',
          planId: 'asp:test:1',
          planRevision: 1,
          planObjective: 'Add export action to users grid',
          artifactCount: 2,
          capabilityGapCount: 1,
          changeGraphId: 'cg:test:1',
          changeNodeCount: 2,
          approvalBindingId: 'asp-approval:test:1',
          approvalStatus: 'pending',
          executedNodeCount: 0,
          failedNodeCount: 0,
          requiresApproval: true,
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('semantic-plan-details-toggle'));
    expect(screen.getByText('cg:test:1')).toBeTruthy();
  });

  it('shows deployed summary text and details banner when expanded', () => {
    render(
      <SemanticPlanPanel
        pipeline={{
          type: 'engineering_pipeline',
          planId: 'asp:test:2',
          planRevision: 1,
          planObjective: 'Add export action to users grid',
          artifactCount: 2,
          capabilityGapCount: 0,
          changeGraphId: 'cg:test:2',
          changeNodeCount: 2,
          approvalStatus: 'approved',
          promotionState: 'DEPLOYED',
          packageSnapshotId: 'pkg-snap:test:2',
          packageRoundtripValidated: true,
          runtimeActivatedCount: 1,
          executedNodeCount: 2,
          failedNodeCount: 0,
          requiresApproval: true,
        }}
      />,
    );

    expect(screen.getByText(/Changes deployed: Add export action to users grid/)).toBeTruthy();
    fireEvent.click(screen.getByTestId('semantic-plan-details-toggle'));
    expect(screen.getByTestId('semantic-plan-deployed-banner')).toBeTruthy();
    expect(screen.getByText(/export validated/)).toBeTruthy();
  });
});
