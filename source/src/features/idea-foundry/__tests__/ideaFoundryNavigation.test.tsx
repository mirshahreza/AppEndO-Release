// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { CultureProvider } from '../../../core/culture/CultureContext';
import { PlatformMountProvider } from '../../../app/platform/PlatformMountContext';
import { ShellHeaderOverrideProvider } from '../../../layouts/adminShell/ShellHeaderOverrideContext';
import type { ProductIdeaListItem, ProductIdeaRecord } from '../../../shared/api/contracts/idea-foundry/types';
import { IdeaFoundryWorkspace } from '../components/IdeaFoundryWorkspace';

const testMount = {
  id: 'studio',
  pathPrefix: '/studio',
  name: 'Studio',
  enabled: true,
  defaultRoute: '/studio',
  designerRoutePropagation: 'none' as const,
  authProfile: { requireAuth: true },
};

const listItem: ProductIdeaListItem = {
  id: 'idea-1',
  title: 'Night-shift board',
  description: 'Clerks still reconcile pick lists by hand each night.',
  icon: 'lucide:Moon',
  importance: 'medium',
  scale: 'small',
  maturity: 'defining',
  targetKind: 'new-package',
  packageId: null,
  packageTitle: null,
  sectionKey: null,
  sectionTitle: null,
  frontOffice: 'Guest scans a barcode.',
  backOffice: 'Clerk confirms the pick.',
  note: null,
  decisionMaker: {
    userId: 1,
    displayName: 'Ada Admin',
    username: 'ada',
    avatarUrl: null,
  },
  collaborators: [],
  models: [{ id: 'model-1', name: 'Workshop model' }],
  createdAt: '2026-08-01T00:00:00.000Z',
  createdBy: 1,
  createdByUsername: 'admin',
  updatedAt: '2026-08-28T00:00:00.000Z',
  updatedBy: 1,
  updatedByUsername: 'admin',
};

const record: ProductIdeaRecord = listItem;

vi.mock('../../../shared/api/queries/idea-foundry', () => ({
  useProductIdeasListQuery: () => ({
    data: [listItem],
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  }),
  useProductIdeaQuery: (id: string | null) => {
    if (id === 'idea-1') {
      return { data: record, isLoading: false, isError: false, error: null };
    }
    return { data: null, isLoading: false, isError: Boolean(id), error: id ? new Error('not found') : null };
  },
  useIdeaPackageHomesQuery: () => ({
    data: [],
    isLoading: false,
  }),
  useCreateProductIdeaMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateProductIdeaMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../../../shared/api/queries/aiModels', () => ({
  useAvailableAiModelsQuery: () => ({ data: { models: [] }, isLoading: false }),
}));

vi.mock('../../../shared/api/queries/packages', () => ({
  usePackagesGridQuery: () => ({ data: [], isLoading: false }),
}));

vi.mock('../../../hooks/useCurrentUserDisplay', () => ({
  useCurrentUserDisplay: () => ({
    currentUser: { id: 1 },
    displayName: 'Ada Admin',
    avatarXs: null,
    profile: { username: 'ada' },
  }),
}));

vi.mock('../components/IdeaFoundryView', () => ({
  IdeaFoundryView: ({ idea, onReconfigure }: { idea: ProductIdeaRecord; onReconfigure?: () => void }) => (
    <div data-testid="idea-foundry-view">
      {idea.title}
      {onReconfigure ? (
        <button type="button" onClick={onReconfigure}>Reconfigure</button>
      ) : null}
    </div>
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
          <IdeaFoundryWorkspace />
        </ShellHeaderOverrideProvider>
      </PlatformMountProvider>
    </CultureProvider>
  );
}

describe('IdeaFoundryWorkspace navigation', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the board on the list route', () => {
    render(
      <MemoryRouter initialEntries={['/studio/idea-foundry']}>
        <Routes>
          <Route path="/studio/idea-foundry/*" element={<NavigationHarness />} />
          <Route path="/studio/idea-foundry" element={<NavigationHarness />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('idea-foundry-board')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Night-shift board/i })).toBeInTheDocument();
  });

  it('opens the idea view from a board card', async () => {
    render(
      <MemoryRouter initialEntries={['/studio/idea-foundry']}>
        <Routes>
          <Route path="/studio/idea-foundry/*" element={<NavigationHarness />} />
          <Route path="/studio/idea-foundry" element={<NavigationHarness />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Night-shift board/i }));

    await waitFor(() => {
      expect(screen.getByTestId('pathname').textContent).toBe('/studio/idea-foundry/edit/idea-1');
    });
    expect(screen.getByTestId('idea-foundry-view')).toHaveTextContent('Night-shift board');
  });

  it('renders the idea view on an edit deep link', () => {
    render(
      <MemoryRouter initialEntries={['/studio/idea-foundry/edit/idea-1']}>
        <Routes>
          <Route path="/studio/idea-foundry/*" element={<NavigationHarness />} />
          <Route path="/studio/idea-foundry" element={<NavigationHarness />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('idea-foundry-view')).toHaveTextContent('Night-shift board');
  });

  it('redirects an unknown edit slug to the list', async () => {
    render(
      <MemoryRouter initialEntries={['/studio/idea-foundry/edit/missing']}>
        <Routes>
          <Route path="/studio/idea-foundry/*" element={<NavigationHarness />} />
          <Route path="/studio/idea-foundry" element={<NavigationHarness />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('pathname').textContent).toBe('/studio/idea-foundry');
    });
    expect(screen.getByTestId('idea-foundry-board')).toBeInTheDocument();
  });
});
