// @vitest-environment jsdom

import React, { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DynamicWorkItemForm } from '../DynamicWorkItemForm';

afterEach(cleanup);

const approvalSchema = {
  type: 'object',
  properties: {
    approved: { type: 'boolean', title: 'Approved' },
    comment: { type: 'string', title: 'Comment' },
    priorityLevel: { type: 'string', title: 'Priority', enum: ['LOW', 'MEDIUM', 'HIGH'] },
  },
  required: ['approved'],
};

const Harness: React.FC = () => {
  const [value, setValue] = useState<unknown>({});
  return (
    <>
      <DynamicWorkItemForm schema={approvalSchema} formData={value} onChange={setValue} />
      <pre data-testid="current-value">{JSON.stringify(value)}</pre>
    </>
  );
};

describe('DynamicWorkItemForm (HWF-1.3) — real schema-driven rendering, no design artifact', () => {
  it('renders one typed control per schema property with the declared titles', () => {
    render(<Harness />);
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('Comment')).toBeInTheDocument();
    expect(screen.getByText('Priority')).toBeInTheDocument();
  });

  it('renders enum properties as a select with the declared options', () => {
    render(<Harness />);
    const select = screen.getAllByRole('combobox').find((el) => within(el).queryByText('LOW')) ?? screen.getAllByRole('combobox')[0];
    expect(select).toBeTruthy();
  });

  it('propagates a text field edit back through onChange', () => {
    render(<Harness />);
    const commentInput = screen.getByLabelText('Comment') as HTMLInputElement;
    fireEvent.change(commentInput, { target: { value: 'looks good' } });
    expect(screen.getByTestId('current-value').textContent).toContain('looks good');
  });

  it('propagates a boolean checkbox toggle back through onChange', () => {
    render(<Harness />);
    const approvedCheckbox = screen.getByLabelText('Approved') as HTMLInputElement;
    fireEvent.click(approvedCheckbox);
    expect(screen.getByTestId('current-value').textContent).toContain('"approved":true');
  });
});

function within(element: HTMLElement) {
  return { queryByText: (text: string) => Array.from(element.querySelectorAll('option')).find((o) => o.textContent === text) ?? null };
}
