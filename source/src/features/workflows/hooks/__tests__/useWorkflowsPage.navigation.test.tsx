// @vitest-environment jsdom

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { PlatformMountProvider } from '../../../../app/platform/PlatformMountContext';
import { useWorkflowsPage } from '../useWorkflowsPage';

vi.mock('../../api/workflowsApi', () => ({
  workflowsApi: {
    listDefinitions: vi.fn(async () => ({
      definitions: [
        {
          id: 7,
          key: 'order-approval',
          scopeKey: 'platform',
          draftVersion: 1,
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    })),
  },
  WorkflowsApiError: class WorkflowsApiError extends Error {},
}));

const testMount = {
  id: 'studio',
  pathPrefix: '/studio',
  name: 'Studio',
  enabled: true,
  defaultRoute: '/studio',
  designerRoutePropagation: 'none' as const,
  authProfile: { requireAuth: true },
};

function WorkflowsNavigationProbe() {
  const navigate = useNavigate();
  const location = useLocation();
  const page = useWorkflowsPage();

  return (
    <div>
      <div data-testid="pathname">{location.pathname}</div>
      <div data-testid="open-definition-id">{page.openDefinitionId ?? 'none'}</div>
      <div data-testid="edit-slug">{page.editSlugFromUrl ?? 'none'}</div>
      <button type="button" onClick={() => navigate('/studio/workflows')}>
        Go to list
      </button>
    </div>
  );
}

function NavigationHarness() {
  return (
    <PlatformMountProvider mount={testMount}>
      <WorkflowsNavigationProbe />
    </PlatformMountProvider>
  );
}

describe('useWorkflowsPage navigation', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('stays on the workflow list route when leaving a designer deep link via main navigation', async () => {
    render(
      <MemoryRouter initialEntries={['/studio/workflows/edit/order-approval']}>
        <Routes>
          <Route path="/studio/*" element={<NavigationHarness />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('open-definition-id').textContent).toBe('7');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Go to list' }));

    await waitFor(() => {
      expect(screen.getByTestId('pathname').textContent).toBe('/studio/workflows');
      expect(screen.getByTestId('edit-slug').textContent).toBe('none');
      expect(screen.getByTestId('open-definition-id').textContent).toBe('none');
    });
  });
});
