// @vitest-environment jsdom

import React, { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { NodeKindForm } from '../NodeKindForm';
import type { WorkflowModel, WorkflowNode } from '../../types';

afterEach(cleanup);

const ControlledHarness: React.FC<{ initialNode: WorkflowNode; model: WorkflowModel }> = ({ initialNode, model }) => {
  const [node, setNode] = useState(initialNode);
  return <NodeKindForm node={node} model={model} definitionId={1} actionCatalog={[]} onChange={setNode} />;
};

const model: WorkflowModel = { schemaVersion: '1', key: 'wf', name: 'wf', start: { type: 'MANUAL_API', targetNodeKey: 'w1' }, nodes: [], edges: [] };

const workItemNode = (overrides: Partial<WorkflowNode> = {}): WorkflowNode => ({
  key: 'w1',
  kind: 'WORK_ITEM',
  workItemType: 'APPROVAL',
  assignment: { strategy: 'ROLE', roleId: 'USER' },
  allowedOutcomes: ['APPROVE'],
  title: { op: 'LITERAL', value: 'Approve request' },
  input: { type: 'OBJECT', fields: {} },
  outputSchema: { type: 'INLINE', schema: {} },
  ...overrides,
} as WorkflowNode);

describe('EscalationPolicyEditor (HWF-2.3) — first-ever Designer UI for WorkItemEscalationPolicy', () => {
  it('shows "no escalation steps" when the policy is unset', () => {
    render(<NodeKindForm node={workItemNode()} model={model} definitionId={1} actionCatalog={[]} onChange={() => {}} />);
    expect(screen.getByText(/No escalation steps/)).toBeInTheDocument();
  });

  it('adding a step defaults to a NOTIFY reminder and the UI reflects it after re-render', () => {
    render(<ControlledHarness initialNode={workItemNode()} model={model} />);
    fireEvent.click(screen.getByText('Add step'));
    expect(screen.getByText('Reminder (no state change)')).toBeInTheDocument();
  });

  it('an existing REASSIGN_ROLE step is labeled Escalation, not Reminder, and shows its role field', () => {
    const node = workItemNode({
      escalationPolicy: { steps: [{ key: 'e1', trigger: { type: 'AFTER_OPEN_MS', afterMs: 3_600_000 }, action: { type: 'REASSIGN_ROLE', roleId: 'MANAGER' }, maxExecutions: 1 }] },
    } as never);
    render(<NodeKindForm node={node} model={model} definitionId={1} actionCatalog={[]} onChange={() => {}} />);
    expect(screen.getByText('Escalation')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('target role name')).toHaveValue('MANAGER');
  });

  it('removing the last step clears escalationPolicy back to undefined and the empty-state message returns', () => {
    const node = workItemNode({
      escalationPolicy: { steps: [{ key: 'e1', trigger: { type: 'AFTER_OPEN_MS', afterMs: 1000 }, action: { type: 'NOTIFY', notificationRef: { bindingType: 'notification', bindingId: 'default' }, input: { type: 'OBJECT', fields: {} } }, maxExecutions: 1 }] },
    } as never);
    render(<ControlledHarness initialNode={node} model={model} />);
    expect(screen.queryByText(/No escalation steps/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Remove escalation step'));
    expect(screen.getByText(/No escalation steps/)).toBeInTheDocument();
  });
});
