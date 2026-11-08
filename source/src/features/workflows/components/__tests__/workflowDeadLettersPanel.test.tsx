// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const listDeadLetters = vi.fn();
const resolveDeadLetter = vi.fn();

vi.mock('../../api/workflowRuntimeApi', () => ({
  workflowRuntimeApi: {
    listDeadLetters: (...args: unknown[]) => listDeadLetters(...args),
    getDeadLetter: vi.fn(),
    resolveDeadLetter: (...args: unknown[]) => resolveDeadLetter(...args),
  },
  WorkflowRuntimeApiError: class WorkflowRuntimeApiError extends Error {},
}));

import { WorkflowDeadLettersPanel } from '../WorkflowDeadLettersPanel';

const record = {
  id: 5,
  workflowInstanceId: 100,
  nodeInstanceId: 200,
  attemptId: 3,
  nodeKey: 'send-email',
  status: 'OPEN' as const,
  errorCode: 'WF_ACTION_TIMEOUT',
  errorClass: 'TIMEOUT',
  errorMessage: 'Action timed out after 3 attempts.',
  evidenceJson: null,
  resolvedByUserId: null,
  resolvedAt: null,
  resolutionNote: null,
  stateVersion: 1,
  createdAt: '2026-08-28T10:00:00.000Z',
  updatedAt: '2026-08-28T10:00:00.000Z',
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('WorkflowDeadLettersPanel', () => {
  it('lists open dead letters and resolves one after confirmation', async () => {
    listDeadLetters
      .mockResolvedValueOnce({ items: [record], nextCursor: null, total: 1 })
      .mockResolvedValueOnce({ items: [], nextCursor: null, total: 0 });
    resolveDeadLetter.mockResolvedValue({ item: { ...record, status: 'RESOLVED' } });

    render(<WorkflowDeadLettersPanel open onClose={() => {}} />);

    await waitFor(() => expect(screen.getByText('send-email')).toBeInTheDocument());
    expect(screen.getByText('Action timed out after 3 attempts.')).toBeInTheDocument();
    expect(listDeadLetters).toHaveBeenCalledWith('OPEN');

    fireEvent.click(screen.getByRole('button', { name: /Mark resolved/ }));
    // Row trigger and dialog confirm both render the text "Mark resolved" — the confirm button is
    // the one that appears after the dialog opens (same ambiguity as the Secrets panel's Delete test).
    const confirmButtons = screen.getAllByRole('button', { name: /Mark resolved/ });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(resolveDeadLetter).toHaveBeenCalledWith(5, { expectedStateVersion: 1, resolution: 'RESOLVED', resolutionNote: null }));
    await waitFor(() => expect(screen.getByText('No open dead letters.')).toBeInTheDocument());
  });

  it('shows an empty state when there are no dead letters', async () => {
    listDeadLetters.mockResolvedValue({ items: [], nextCursor: null, total: 0 });

    render(<WorkflowDeadLettersPanel open onClose={() => {}} />);

    await waitFor(() => expect(screen.getByText('No open dead letters.')).toBeInTheDocument());
  });
});
