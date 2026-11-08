// @vitest-environment jsdom

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { PlatformMountProvider } from '../../../app/platform/PlatformMountContext';
import { ComponentDesignerWorkspace } from '../components/ComponentDesignerWorkspace';

const testMount = {
  id: 'studio',
  pathPrefix: '/studio',
  name: 'Studio',
  enabled: true,
  defaultRoute: '/studio',
  designerRoutePropagation: 'none' as const,
  authProfile: { requireAuth: true },
};

const activeDraftSummary = {
  id: 'draft-1',
  folder: 'general',
  name: 'test-c',
  isBuiltIn: false,
};

const mockPage = {
  activeDraftId: null as string | null,
  activeDraftSummary: null as typeof activeDraftSummary | null,
  drafts: [activeDraftSummary],
  isDraftsLoading: false,
  loadingComponentId: null,
  hasUnsavedChanges: false,
  isUnsavedChangesDialogOpen: false,
  state: {
    selectedNodeId: null,
    viewport: { preset: 'desktop', width: 1280, height: 800, fillMode: 'fixed' },
  },
  resetDesignerWorkspace: vi.fn(),
  handleLoadComponentFromList: vi.fn(),
  handleRefreshComponents: vi.fn(),
  flashToolbarStatus: vi.fn(),
  requestNavigateAway: vi.fn(),
  requestPageReload: vi.fn(),
};

vi.mock('../hooks/useComponentDesignerPage', () => ({
  useComponentDesignerPage: () => mockPage,
  ComponentDesignerPageView: ({ isCatalogListMode }: { isCatalogListMode?: boolean }) => (
    <div data-testid="catalog-list-mode">{String(Boolean(isCatalogListMode))}</div>
  ),
}));

vi.mock('../components/live-designer/LiveDesignerWorkspace', () => ({
  LiveDesignerWorkspace: ({ componentPath }: { componentPath: string }) => (
    <div data-testid="live-designer-workspace">{componentPath}</div>
  ),
}));

vi.mock('../../../shared/lib/aiPageContextStore', () => ({
  usePublishAiPageContext: vi.fn(),
}));

function PathnameProbe() {
  const location = useLocation();
  return <div data-testid="pathname">{location.pathname}</div>;
}

function NavigationHarness() {
  return (
    <PlatformMountProvider mount={testMount}>
      <PathnameProbe />
      <ComponentDesignerWorkspace />
    </PlatformMountProvider>
  );
}

describe('ComponentDesignerWorkspace navigation', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockPage.activeDraftId = null;
    mockPage.activeDraftSummary = null;
  });

  it('redirects classic edit deep links to live designer', async () => {
    render(
      <MemoryRouter initialEntries={['/studio/client-components/general/test-c']}>
        <Routes>
          <Route path="/studio/client-components/*" element={<NavigationHarness />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('pathname').textContent).toBe(
        '/studio/client-components/edit/test-c',
      );
    });
    expect(screen.getByTestId('live-designer-workspace')).toHaveTextContent('test-c');
  });

  it('renders the catalog list on the list route', async () => {
    render(
      <MemoryRouter initialEntries={['/studio/client-components']}>
        <Routes>
          <Route path="/studio/client-components/*" element={<NavigationHarness />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('catalog-list-mode')).toHaveTextContent('true');
    });
  });
});
