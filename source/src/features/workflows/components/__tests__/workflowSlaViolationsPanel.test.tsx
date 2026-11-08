// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const listSlaViolations = vi.fn();

vi.mock('../../api/workflowRuntimeApi', () => ({
  workflowRuntimeApi: {
    listSlaViolations: (...args: unknown[]) => listSlaViolations(...args),
  },
  WorkflowRuntimeApiError: class WorkflowRuntimeApiError extends Error {},
}));

import { WorkflowSlaViolationsPanel } from '../WorkflowSlaViolationsPanel';

const violation = {
  id: 5,
  workflowInstanceId: 100,
  workItemType: 'APPROVAL',
  titleText: 'Approve purchase order',
  status: 'OPEN' as const,
  priority: 0,
  dueAt: '2026-08-28T10:00:00.000Z',
  completedAt: null,
  breachKind: 'STILL_OPEN' as const,
  overdueMs: 3 * 60 * 60_000,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('WorkflowSlaViolationsPanel', () => {
  it('lists SLA violations', async () => {
    listSlaViolations.mockResolvedValueOnce({ items: [violation] });

    render(<WorkflowSlaViolationsPanel open onClose={() => {}} />);

    await waitFor(() => expect(screen.getByText('Approve purchase order')).toBeInTheDocument());
    expect(screen.getByText(/Still open/)).toBeInTheDocument();
    expect(listSlaViolations).toHaveBeenCalled();
  });

  it('shows an empty state when there are no violations', async () => {
    listSlaViolations.mockResolvedValueOnce({ items: [] });

    render(<WorkflowSlaViolationsPanel open onClose={() => {}} />);

    await waitFor(() => expect(screen.getByText('No SLA violations.')).toBeInTheDocument());
  });
});
