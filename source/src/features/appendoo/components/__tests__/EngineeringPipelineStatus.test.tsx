// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EngineeringPipelineStatus } from '../EngineeringPipelineStatus';

describe('EngineeringPipelineStatus', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a one-line engineering summary by default', () => {
    render(
      <EngineeringPipelineStatus
        snapshot={{
          requestClass: 'ENGINEERING_CHANGE',
          taskProfile: 'INTENT_COMPILE',
          routingReason: 'User requested an engineering change.',
          useEngineeringPipeline: true,
          applicationScopeKey: 'platform:studio:page:users',
          applicationScopeKind: 'platform',
          contextPackId: 'ctxpack:run-1:123',
          contextPackTargetCount: 2,
          contextPackStandardsCount: 5,
        }}
      />,
    );

    expect(screen.getByTestId('engineering-pipeline-status')).toBeTruthy();
    expect(screen.getByText('User requested an engineering change.')).toBeTruthy();
    expect(screen.queryByText('platform:studio:page:users')).toBeNull();
  });

  it('hides for non-engineering general requests', () => {
    const { container } = render(
      <EngineeringPipelineStatus
        snapshot={{
          requestClass: 'TOOL_QUERY',
          taskProfile: 'TOOL_SESSION',
          routingReason: 'Tool lookup.',
          useEngineeringPipeline: false,
        }}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('surfaces drift badge and grader matrix when details are expanded', () => {
    render(
      <EngineeringPipelineStatus
        snapshot={{
          requestClass: 'ENGINEERING_CHANGE',
          taskProfile: 'INTENT_COMPILE',
          routingReason: 'Engineering change routed.',
          useEngineeringPipeline: true,
          applicationScopeKey: 'platform:studio:page:users',
          applicationScopeKind: 'platform',
        }}
        pipeline={{
          type: 'engineering_pipeline',
          planId: 'asp:test',
          planRevision: 1,
          planObjective: 'Add export',
          artifactCount: 1,
          capabilityGapCount: 0,
          changeGraphId: 'cg:test',
          changeNodeCount: 2,
          executedNodeCount: 1,
          failedNodeCount: 0,
          requiresApproval: true,
          changeGraphDriftOk: false,
          changeGraphDriftStaleCount: 1,
          verificationRunId: 'vr:test',
          verificationGraderSummary: [{
            graderId: 'workspace-drift',
            grade: 'PASS',
            layer: 'workspace',
          }],
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('engineering-pipeline-details-toggle'));
    expect(screen.getByTestId('engineering-pipeline-drift-badge')).toBeTruthy();
    expect(screen.getByTestId('verification-grader-matrix-panel')).toBeTruthy();
  });

  it('hides drift badge when changeGraphDriftOk is true or undefined', () => {
    const { rerender } = render(
      <EngineeringPipelineStatus
        snapshot={{
          requestClass: 'ENGINEERING_CHANGE',
          taskProfile: 'INTENT_COMPILE',
          routingReason: 'Engineering change routed.',
          useEngineeringPipeline: true,
        }}
        pipeline={{
          type: 'engineering_pipeline',
          planId: 'asp:test',
          planRevision: 1,
          planObjective: 'Add export',
          artifactCount: 1,
          capabilityGapCount: 0,
          changeGraphId: 'cg:test',
          changeNodeCount: 2,
          executedNodeCount: 1,
          failedNodeCount: 0,
          requiresApproval: true,
          changeGraphDriftOk: true,
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('engineering-pipeline-details-toggle'));
    expect(screen.queryByTestId('engineering-pipeline-drift-badge')).toBeNull();

    rerender(
      <EngineeringPipelineStatus
        snapshot={{
          requestClass: 'ENGINEERING_CHANGE',
          taskProfile: 'INTENT_COMPILE',
          routingReason: 'Engineering change routed.',
          useEngineeringPipeline: true,
        }}
        pipeline={{
          type: 'engineering_pipeline',
          planId: 'asp:test',
          planRevision: 1,
          planObjective: 'Add export',
          artifactCount: 1,
          capabilityGapCount: 0,
          changeGraphId: 'cg:test',
          changeNodeCount: 2,
          executedNodeCount: 1,
          failedNodeCount: 0,
          requiresApproval: true,
        }}
      />,
    );

    expect(screen.queryByTestId('engineering-pipeline-drift-badge')).toBeNull();
  });
});
