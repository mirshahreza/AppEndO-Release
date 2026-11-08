// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SemanticPlanApprovalBar } from '../SemanticPlanApprovalBar';

const pendingPipeline = {
  type: 'engineering_pipeline' as const,
  planId: 'asp:test:1',
  planRevision: 1,
  planObjective: 'Add export action to users grid',
  artifactCount: 2,
  capabilityGapCount: 1,
  changeGraphId: 'cg:test:1',
  changeNodeCount: 2,
  approvalBindingId: 'asp-approval:test:1',
  approvalStatus: 'pending' as const,
  executedNodeCount: 0,
  failedNodeCount: 0,
  requiresApproval: true,
  planActionPolicy: {
    canApprove: true,
    canRevise: false,
    canExecute: false,
    blockingReasonCodes: [],
  },
};

describe('SemanticPlanApprovalBar', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders plain approval message and button outside technical panels', () => {
    render(
      <SemanticPlanApprovalBar
        pipeline={pendingPipeline}
        onApprove={vi.fn()}
      />,
    );

    expect(screen.getByTestId('semantic-plan-approval-bar')).toBeTruthy();
    expect(screen.getByText(/A build plan is ready for/)).toBeTruthy();
    expect(screen.getByTestId('semantic-plan-approve-button')).toBeTruthy();
  });

  it('hides when agent already auto-built', () => {
    const { container } = render(
      <SemanticPlanApprovalBar
        pipeline={{
          ...pendingPipeline,
          requiresApproval: false,
          approvalStatus: 'approved',
          executedNodeCount: 1,
          promotionState: 'DEPLOYED',
        }}
        onApprove={vi.fn()}
      />,
    );

    expect(container.querySelector('[data-testid="semantic-plan-approval-bar"]')).toBeNull();
  });

  it('calls onApprove when approve button is clicked', () => {
    const onApprove = vi.fn();
    render(
      <SemanticPlanApprovalBar
        pipeline={pendingPipeline}
        onApprove={onApprove}
      />,
    );

    fireEvent.click(screen.getByTestId('semantic-plan-approve-button'));
    expect(onApprove).toHaveBeenCalledWith('asp-approval:test:1');
  });

  it('renders promotion export approval when verification is deployable', () => {
    const onApprove = vi.fn();
    render(
      <SemanticPlanApprovalBar
        pipeline={{
          ...pendingPipeline,
          requiresApproval: false,
          approvalStatus: 'approved',
          executedNodeCount: 2,
          deployable: true,
          promotionApprovalRequired: true,
          promotionApprovalBindingId: 'promo-approval:cs:test:1',
        }}
        onApprove={onApprove}
      />,
    );

    expect(screen.getByText(/Approve package export/)).toBeTruthy();
    fireEvent.click(screen.getByTestId('semantic-plan-approve-button'));
    expect(onApprove).toHaveBeenCalledWith('promo-approval:cs:test:1');
  });
});
