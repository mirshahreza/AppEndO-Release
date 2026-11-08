// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EngineeringWorkspacePanel } from '../EngineeringWorkspacePanel';

describe('EngineeringWorkspacePanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders workspace summary and details when expanded', () => {
    render(
      <EngineeringWorkspacePanel
        pipeline={{
          type: 'engineering_pipeline',
          planId: 'asp:ws:1',
          planRevision: 1,
          planObjective: 'Add export action',
          artifactCount: 1,
          capabilityGapCount: 0,
          changeGraphId: 'cg:ws:1',
          changeNodeCount: 1,
          changeSetId: 'cs:ws:1',
          workspaceId: 'ws:test:1',
          revisionId: 'rev:test:1',
          revisionNumber: 1,
          workspaceLineageLabel: 'R1 initial',
          workspaceState: 'OPEN',
          revisionState: 'OPEN',
          revisionFingerprint: 'fp:test:1',
          workspaceStorageKind: 'git_branch',
          mutationPathCount: 1,
          mutationPathPreview: ['appendoo/ws/cs-ws-1/workspace/server-functions/custom/demo.ts'],
          verifiedNodeCount: 1,
          executedNodeCount: 1,
          failedNodeCount: 0,
          requiresApproval: true,
        }}
      />,
    );

    expect(screen.getByTestId('engineering-workspace-panel')).toBeTruthy();
    expect(screen.getByText(/Isolated workspace prepared with 1 file change/)).toBeTruthy();

    fireEvent.click(screen.getByTestId('engineering-workspace-details-toggle'));
    expect(screen.getByTestId('engineering-workspace-lineage-badge')).toBeTruthy();
    expect(screen.getByText('R1 initial')).toBeTruthy();
    expect(screen.getByText('git_branch')).toBeTruthy();
    expect(screen.getByText(/appendoo\/ws\/cs-ws-1/)).toBeTruthy();
  });

  it('returns null when workspace is not created yet', () => {
    const { container } = render(
      <EngineeringWorkspacePanel
        pipeline={{
          type: 'engineering_pipeline',
          planId: 'asp:ws:2',
          planRevision: 1,
          planObjective: 'Add export action',
          artifactCount: 1,
          capabilityGapCount: 0,
          changeGraphId: 'cg:ws:2',
          changeNodeCount: 1,
          executedNodeCount: 0,
          failedNodeCount: 0,
          requiresApproval: true,
        }}
      />,
    );

    expect(container.firstChild).toBeNull();
  });
});
