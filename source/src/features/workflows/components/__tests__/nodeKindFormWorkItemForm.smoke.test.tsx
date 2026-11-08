// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { NodeKindForm } from '../NodeKindForm';
import type { WorkflowModel, WorkflowNode } from '../../types';

afterEach(cleanup);

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

describe('NodeKindForm WORK_ITEM case — HWF-1.1 completion form selector', () => {
  it('defaults to Raw JSON and does not show the component ref field', () => {
    render(<NodeKindForm node={workItemNode()} model={model} definitionId={1} actionCatalog={[]} onChange={() => {}} />);
    expect(screen.getByText('Completion form (HWF-1.1)')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/workflows\/approval-review-form/)).not.toBeInTheDocument();
  });

  it('reflects an already-set formMode of DYNAMIC_SCHEMA_FORM', () => {
    render(<NodeKindForm node={workItemNode({ formMode: 'DYNAMIC_SCHEMA_FORM' } as never)} model={model} definitionId={1} actionCatalog={[]} onChange={() => {}} />);
    expect(screen.getByDisplayValue(/Dynamic form/)).toBeInTheDocument();
  });

  it('shows the component reference input only when formMode is DESIGNED_COMPONENT', () => {
    const onChange = () => {};
    render(<NodeKindForm node={workItemNode({ formMode: 'DESIGNED_COMPONENT' } as never)} model={model} definitionId={1} actionCatalog={[]} onChange={onChange} />);
    expect(screen.getByPlaceholderText(/workflows\/approval-review-form/)).toBeInTheDocument();
  });

  it('switching the select to Designed component fires onChange with formMode DESIGNED_COMPONENT', () => {
    let latest: WorkflowNode | null = null;
    render(
      <NodeKindForm
        node={workItemNode()}
        model={model}
        definitionId={1}
        actionCatalog={[]}
        onChange={(next) => { latest = next; }}
      />,
    );
    fireEvent.change(screen.getByText('Completion form (HWF-1.1)').closest('label')!.querySelector('select')!, { target: { value: 'DESIGNED_COMPONENT' } });
    expect((latest as unknown as { formMode?: string } | null)?.formMode).toBe('DESIGNED_COMPONENT');
  });
});
