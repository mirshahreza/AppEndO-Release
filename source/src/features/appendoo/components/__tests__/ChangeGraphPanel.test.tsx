// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ChangeGraphPanel } from '../ChangeGraphPanel';

describe('ChangeGraphPanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a one-line summary and node preview when expanded', () => {
    render(
      <ChangeGraphPanel
        pipeline={{
          type: 'engineering_pipeline',
          planId: 'asp:1',
          planRevision: 1,
          planObjective: 'Add function',
          artifactCount: 1,
          capabilityGapCount: 0,
          changeGraphId: 'cg:1',
          changeNodeCount: 2,
          changeGraphReadyCount: 2,
          changeGraphNodePreview: [
            { nodeId: 'node:1', operationType: 'CREATE_SERVER_FUNCTION', state: 'PLANNED' },
          ],
          executedNodeCount: 0,
          failedNodeCount: 0,
          requiresApproval: true,
        }}
      />,
    );

    expect(screen.getByTestId('change-graph-panel')).toBeTruthy();
    expect(screen.getByText(/Build steps: 2 planned/)).toBeTruthy();
    expect(screen.queryByText('CREATE_SERVER_FUNCTION')).toBeNull();

    fireEvent.click(screen.getByTestId('change-graph-details-toggle'));
    expect(screen.getByText('CREATE_SERVER_FUNCTION')).toBeTruthy();
  });
});
