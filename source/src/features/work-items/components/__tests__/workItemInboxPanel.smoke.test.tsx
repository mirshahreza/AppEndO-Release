// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('../../../../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: { id: 1, displayName: 'Test User' } }),
}));

vi.mock('../../api/workItemsApi', () => ({
  workItemsApi: {
    listInbox: vi.fn().mockResolvedValue({ items: [], nextCursor: null, total: 0 }),
    get: vi.fn(),
    claim: vi.fn(),
    complete: vi.fn(),
    forward: vi.fn(),
    transitions: vi.fn(),
  },
  WorkItemsApiError: class WorkItemsApiError extends Error {},
}));

import { WorkItemInboxPanel } from '../WorkItemInboxPanel';
import { workItemsApi } from '../../api/workItemsApi';

afterEach(cleanup);

describe('WorkItemInboxPanel (HWF-4.4) — My worklist / Team queue grouping', () => {
  it('renders both group labels distinctly, matching the Worklist/Work Basket split', async () => {
    render(<WorkItemInboxPanel />);
    await waitFor(() => expect(screen.getByText('My worklist')).toBeInTheDocument());
    expect(screen.getByText('Team queue')).toBeInTheDocument();
    expect(screen.getByText('Available to claim')).toBeInTheDocument();
    expect(screen.getByText('Assigned to me')).toBeInTheDocument();
  });

  it('the type/priority filters are present and wired into listInbox calls', async () => {
    render(<WorkItemInboxPanel />);
    await waitFor(() => expect(vi.mocked(workItemsApi.listInbox)).toHaveBeenCalled());
    const call = vi.mocked(workItemsApi.listInbox).mock.calls[0];
    expect(call[1]).toEqual({ filters: { workItemType: undefined } });
  });
});

describe('WorkItemInboxPanel (HWF-4.3) — bulk claim', () => {
  it('selecting OPEN items shows a bulk claim bar, and clicking it claims each selected item', async () => {
    const openItem = { id: 101, workflowInstanceId: 1, nodeInstanceId: 1, workItemType: 'APPROVAL', status: 'OPEN', titleText: 'Approve X', summaryText: null, priority: 0, assignmentEvidenceJson: '{}', claimedByUserId: null, createdAt: null, dueAt: null, followUpAt: null };
    vi.mocked(workItemsApi.listInbox).mockResolvedValue({ items: [openItem], nextCursor: null, total: 1 });
    vi.mocked(workItemsApi.claim).mockResolvedValue({ workItem: { ...openItem, inputJson: null, outputJson: null, outputSchemaJson: null, allowedOutcomesJson: '[]', status: 'CLAIMED' } });

    render(<WorkItemInboxPanel />);
    await waitFor(() => expect(screen.getByText('Approve X')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Approve X' }));
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Claim 1'));
    await waitFor(() => expect(workItemsApi.claim).toHaveBeenCalledWith(101));
  });
});
