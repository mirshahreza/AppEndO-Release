// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const listSecretReferences = vi.fn();
const createSecretReference = vi.fn();
const updateSecretReference = vi.fn();
const deleteSecretReference = vi.fn();

vi.mock('../../api/workflowsApi', () => ({
  workflowsApi: {
    listSecretReferences: (...args: unknown[]) => listSecretReferences(...args),
    createSecretReference: (...args: unknown[]) => createSecretReference(...args),
    updateSecretReference: (...args: unknown[]) => updateSecretReference(...args),
    deleteSecretReference: (...args: unknown[]) => deleteSecretReference(...args),
  },
  WorkflowsApiError: class WorkflowsApiError extends Error {},
}));

import { WorkflowSecretReferencesPanel } from '../WorkflowSecretReferencesPanel';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('WorkflowSecretReferencesPanel', () => {
  it('lists registered references, creates a new one, and reports the "configured on this node" state', async () => {
    listSecretReferences
      .mockResolvedValueOnce({ references: [] })
      .mockResolvedValueOnce({
        references: [{ id: 1, name: 'SLACK_WEBHOOK_URL', label: 'Slack webhook', description: null, configuredOnThisNode: true, hasStoredValue: false, createdAt: null, updatedAt: null }],
      });
    createSecretReference.mockResolvedValue({ record: { id: 1, name: 'SLACK_WEBHOOK_URL', label: 'Slack webhook', description: null, configuredOnThisNode: true, hasStoredValue: false, createdAt: null, updatedAt: null } });

    const onChanged = vi.fn();
    render(<WorkflowSecretReferencesPanel open onClose={() => {}} onChanged={onChanged} />);

    await waitFor(() => expect(screen.getByText('No secret references registered yet.')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText('Name, e.g. SLACK_WEBHOOK_URL'), { target: { value: 'SLACK_WEBHOOK_URL' } });
    fireEvent.change(screen.getByPlaceholderText('Friendly label, e.g. Slack webhook (#ops channel)'), { target: { value: 'Slack webhook' } });
    fireEvent.click(screen.getByRole('button', { name: /Add/ }));

    await waitFor(() => expect(createSecretReference).toHaveBeenCalledWith({ name: 'SLACK_WEBHOOK_URL', label: 'Slack webhook', description: null, value: undefined }));
    await waitFor(() => expect(screen.getByText('Slack webhook')).toBeInTheDocument());
    expect(screen.getByText('configured')).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalled();
  });

  it('deletes a reference after confirmation', async () => {
    listSecretReferences
      .mockResolvedValueOnce({
        references: [{ id: 7, name: 'GITHUB_TOKEN', label: 'GitHub token', description: null, configuredOnThisNode: false, hasStoredValue: false, createdAt: null, updatedAt: null }],
      })
      .mockResolvedValueOnce({ references: [] });
    deleteSecretReference.mockResolvedValue({ success: true });

    render(<WorkflowSecretReferencesPanel open onClose={() => {}} onChanged={() => {}} />);

    await waitFor(() => expect(screen.getByText('GitHub token')).toBeInTheDocument());
    expect(screen.getByText('not set here')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Delete'));
    // The row's icon-only trigger also carries a native `title="Delete"` (browser accessible-name
    // fallback), so it matches the same role/name query as the confirm dialog's "Delete" button —
    // the confirm button is the one that appears after the dialog opens.
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);

    await waitFor(() => expect(deleteSecretReference).toHaveBeenCalledWith(7));
    await waitFor(() => expect(screen.getByText('No secret references registered yet.')).toBeInTheDocument());
  });

  it('shows "value stored" for a vault-backed reference, and clearing it sends an explicit null', async () => {
    listSecretReferences.mockResolvedValue({
      references: [{ id: 3, name: 'API_KEY', label: 'API key', description: null, configuredOnThisNode: false, hasStoredValue: true, createdAt: null, updatedAt: null }],
    });
    updateSecretReference.mockResolvedValue({
      record: { id: 3, name: 'API_KEY', label: 'API key', description: null, configuredOnThisNode: false, hasStoredValue: false, createdAt: null, updatedAt: null },
    });

    render(<WorkflowSecretReferencesPanel open onClose={() => {}} onChanged={() => {}} />);

    await waitFor(() => expect(screen.getByText('value stored')).toBeInTheDocument());
    // Env-var badges are irrelevant once a value is stored — the row should not also claim "configured"/"not set here".
    expect(screen.queryByText('not set here')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText(/Clear the stored value/));
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));

    await waitFor(() => expect(updateSecretReference).toHaveBeenCalledWith(3, { label: 'API key', description: null, value: null }));
  });
});
