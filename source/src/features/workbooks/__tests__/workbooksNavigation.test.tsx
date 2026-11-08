// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { CultureProvider } from '../../../core/culture/CultureContext';
import { PlatformMountProvider } from '../../../app/platform/PlatformMountContext';
import { ShellHeaderOverrideProvider } from '../../../layouts/adminShell/ShellHeaderOverrideContext';
import type { WorkbookListItem, WorkbookRecord } from '../../../shared/api/contracts/workbooks/types';
import { WorkbooksWorkspace } from '../components/WorkbooksWorkspace';

const testMount = {
  id: 'studio',
  pathPrefix: '/studio',
  name: 'Studio',
  enabled: true,
  defaultRoute: '/studio',
  designerRoutePropagation: 'none' as const,
  authProfile: { requireAuth: true },
};

const listItem: WorkbookListItem = {
  id: 'wb-1',
  name: 'Rate card',
  note: null,
  ownerUserId: 1,
  createdAt: '2026-08-01T00:00:00.000Z',
  createdBy: 1,
  createdByUsername: 'admin',
  updatedAt: '2026-08-28T00:00:00.000Z',
  updatedBy: 1,
  updatedByUsername: 'admin',
  accessControl: {
    accessMode: 'specific',
    allowRoles: [],
    allowUsers: [],
    denyRoles: [],
    denyUsers: [],
  },
  accessPermission: 'view',
  viewerRole: 'owner',
};

const record: WorkbookRecord = {
  ...listItem,
  sheets: [{ id: 'sheet-1', name: 'Sheet1', celldata: [] }],
  sharedMembers: [],
};

vi.mock('../../../shared/api/queries/workbooks', () => ({
  useWorkbooksListQuery: () => ({
    data: [listItem],
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  }),
  useWorkbookQuery: (id: string | null) => {
    if (id === 'wb-1') {
      return { data: record, isLoading: false, isError: false, error: null };
    }
    return { data: null, isLoading: false, isError: Boolean(id), error: id ? new Error('not found') : null };
  },
  useSharedWorkbooksListQuery: () => ({
    data: [],
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  }),
  useCreateWorkbookMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateWorkbookMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateWorkbookAccessMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useResolveWorkbookUsernameMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteWorkbookMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('../components/WorkbookEditor', () => ({
  WorkbookEditor: ({ workbook }: { workbook: WorkbookRecord }) => (
    <div data-testid="workbook-editor">{workbook.name}</div>
  ),
}));

vi.mock('../../../shared/lib/aiPageContextStore', () => ({
  usePublishAiPageContext: vi.fn(),
}));

vi.mock('../../../shared/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/ui')>();
  return {
    ...actual,
    showAppFeedbackToast: vi.fn(),
  };
});

function PathnameProbe() {
  const location = useLocation();
  return <div data-testid="pathname">{location.pathname}</div>;
}

function NavigationHarness() {
  return (
    <CultureProvider cultureId="us">
      <PlatformMountProvider mount={testMount as never}>
        <ShellHeaderOverrideProvider>
          <PathnameProbe />
          <WorkbooksWorkspace />
        </ShellHeaderOverrideProvider>
      </PlatformMountProvider>
    </CultureProvider>
  );
}

describe('WorkbooksWorkspace navigation', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps My Workbooks editor links on the my-workbooks segment', async () => {
    render(
      <MemoryRouter initialEntries={['/studio/my-workbooks']}>
        <Routes>
          <Route path="/studio/my-workbooks/*" element={(
            <CultureProvider cultureId="us">
              <PlatformMountProvider mount={testMount as never}>
                <ShellHeaderOverrideProvider>
                  <PathnameProbe />
                  <WorkbooksWorkspace listSegment="my-workbooks" pageKey="my-workbooks" allowSharing />
                </ShellHeaderOverrideProvider>
              </PlatformMountProvider>
            </CultureProvider>
          )}
          />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Rate card' }));

    await waitFor(() => {
      expect(screen.getByTestId('pathname').textContent).toBe('/studio/my-workbooks/edit/wb-1');
    });
  });

  it('opens Share from a My Workbooks catalog card', async () => {
    render(
      <MemoryRouter initialEntries={['/studio/my-workbooks']}>
        <Routes>
          <Route path="/studio/my-workbooks/*" element={(
            <CultureProvider cultureId="us">
              <PlatformMountProvider mount={testMount as never}>
                <ShellHeaderOverrideProvider>
                  <WorkbooksWorkspace listSegment="my-workbooks" pageKey="my-workbooks" allowSharing />
                </ShellHeaderOverrideProvider>
              </PlatformMountProvider>
            </CultureProvider>
          )}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Delete Rate card' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Share Rate card' }));

    await waitFor(() => {
      expect(screen.getByText('Share workbook')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Share link')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
  });

  it('hides Share on Records Workbooks catalog cards', () => {
    render(
      <MemoryRouter initialEntries={['/studio/workbooks']}>
        <Routes>
          <Route path="/studio/workbooks/*" element={<NavigationHarness />} />
          <Route path="/studio/workbooks" element={<NavigationHarness />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: 'Share Rate card' })).not.toBeInTheDocument();
  });

  it('renders the catalog list on the list route', () => {
    render(
      <MemoryRouter initialEntries={['/studio/workbooks']}>
        <Routes>
          <Route path="/studio/workbooks/*" element={<NavigationHarness />} />
          <Route path="/studio/workbooks" element={<NavigationHarness />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('workbooks-list')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rate card' })).toBeInTheDocument();
    expect(screen.getByTestId('workbook-card-audit')).toHaveTextContent('Created');
    expect(screen.getByTestId('workbook-card-audit')).toHaveTextContent('2026-08-01');
    expect(screen.getByTestId('workbook-card-audit')).toHaveTextContent('Edited');
    expect(screen.getByTestId('workbook-card-audit')).toHaveTextContent('2026-08-28');
    expect(screen.getByLabelText('Creator admin')).toBeInTheDocument();
    expect(screen.getByLabelText('Editor admin')).toBeInTheDocument();
  });

  it('opens the editor from a catalog card title', async () => {
    render(
      <MemoryRouter initialEntries={['/studio/workbooks']}>
        <Routes>
          <Route path="/studio/workbooks/*" element={<NavigationHarness />} />
          <Route path="/studio/workbooks" element={<NavigationHarness />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Rate card' }));

    await waitFor(() => {
      expect(screen.getByTestId('pathname').textContent).toBe('/studio/workbooks/edit/wb-1');
    });
    expect(screen.getByTestId('workbook-editor')).toHaveTextContent('Rate card');
  });

  it('renders the editor on an edit deep link', () => {
    render(
      <MemoryRouter initialEntries={['/studio/workbooks/edit/wb-1']}>
        <Routes>
          <Route path="/studio/workbooks/*" element={<NavigationHarness />} />
          <Route path="/studio/workbooks" element={<NavigationHarness />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('workbook-editor')).toHaveTextContent('Rate card');
  });

  it('redirects an unknown edit slug to the list', async () => {
    render(
      <MemoryRouter initialEntries={['/studio/workbooks/edit/missing']}>
        <Routes>
          <Route path="/studio/workbooks/*" element={<NavigationHarness />} />
          <Route path="/studio/workbooks" element={<NavigationHarness />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('pathname').textContent).toBe('/studio/workbooks');
    });
    expect(screen.getByTestId('workbooks-list')).toBeInTheDocument();
  });
});
