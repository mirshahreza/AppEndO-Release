// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { WorkItemPayloadReadView } from '../WorkItemPayloadReadView';

afterEach(cleanup);

describe('WorkItemPayloadReadView', () => {
  it('renders inferred field labels for object input JSON', () => {
    render(
      <WorkItemPayloadReadView
        json={JSON.stringify({ customerName: 'Acme', amount: 42 })}
      />,
    );
    expect(screen.getByText('Customer Name')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
  });

  it('shows empty state for empty object', () => {
    render(<WorkItemPayloadReadView json="{}" emptyLabel="No context." />);
    expect(screen.getByText('No context.')).toBeInTheDocument();
  });
});
