// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VerificationGraderMatrixPanel } from '../VerificationGraderMatrixPanel';

describe('VerificationGraderMatrixPanel', () => {
  it('renders grader matrix when summary is present', () => {
    render(
      <VerificationGraderMatrixPanel
        pipeline={{
          type: 'engineering_pipeline',
          planId: 'asp:1',
          planRevision: 1,
          planObjective: 'Add function',
          artifactCount: 1,
          capabilityGapCount: 0,
          changeGraphId: 'cg:1',
          changeNodeCount: 1,
          verificationRunId: 'verify:1',
          verificationPassCount: 2,
          verificationFailCount: 0,
          verificationGraderSummary: [
            { graderId: 'workspace-drift', grade: 'PASS', layer: 'artifact_rules' },
            { graderId: 'project-standards', grade: 'PASS', layer: 'lint_standards' },
          ],
          executedNodeCount: 1,
          failedNodeCount: 0,
          requiresApproval: true,
        }}
      />,
    );

    expect(screen.getByTestId('verification-grader-matrix-panel')).toBeTruthy();
    expect(screen.getByText('workspace-drift')).toBeTruthy();
  });
});
