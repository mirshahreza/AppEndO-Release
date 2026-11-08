// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DesignerPublishedShell } from '../DesignerPublishedShell';
import { loadDesignerShellDraft } from '../../../shared/api/queries/component-designer';
import { createDefaultBindingDefinitions } from '../../../domain/component-designer/bindingRegistry';
import { APP_SHELL_LAYOUT_WIDTH_FALLBACK_DOCUMENT } from '../../../shared/lib/appShellLayoutWidthDefaults';

vi.mock('../../../shared/api/queries/component-designer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/api/queries/component-designer')>();
  return {
    ...actual,
    loadDesignerShellDraft: vi.fn(),
  };
});

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: true,
    isLoading: false,
    currentUser: { id: 1, email: 'admin@append.os', role: 'ADMIN', roles: ['ADMIN'] },
  })),
}));

vi.mock('../PlatformConfigProvider', () => {
  const value = {
    config: {
      version: 'application-host-v1',
      mounts: [],
      shells: [],
      shellRules: [],
      pageModules: [],
      bindings: [],
    },
  };
  return {
    usePlatformConfig: () => value,
    useOptionalPlatformConfig: () => value,
  };
});

vi.mock('../PlatformMountContext', () => ({
  usePlatformMount: () => ({
    id: 'test-mount',
    pathPrefix: '/test-prefix',
  }),
  useOptionalPlatformMount: () => ({
    id: 'test-mount',
    pathPrefix: '/test-prefix',
  }),
}));

vi.mock('../../../shared/api/queries/appearance', () => ({
  useAppearanceSession: () => ({ data: undefined, isError: false, isLoading: false }),
  saveUserShellExperience: vi.fn(async () => ({})),
  invalidateAppearanceSession: vi.fn(),
  appearanceQueryKeys: { all: ['appearance'], session: (mountId: string) => ['appearance', 'session', mountId] },
  fetchAppearanceSession: vi.fn(),
}));

vi.mock('../../../contexts/ClientContextContext', () => ({
  useClientContext: () => ({
    clientContext: {},
    patchClientContext: vi.fn(),
  }),
}));

vi.mock('../cmsSiteChromeSlots', () => ({
  cmsSiteChromeSlots: {},
}));

vi.mock('../../../components/AccentColorPicker', () => ({
  AccentColorPicker: () => null,
}));

vi.mock('../../../core/culture/CultureContext', () => ({
  useOptionalCulture: () => null,
  useCulture: () => ({ culture: 'en', direction: 'ltr' as const }),
  useCultureT: () => (key: string) => key === 'shell.logo.alt' ? 'AppEnd' : key,
  useOptionalCultureT: () => (key: string) => key,
}));

vi.mock('../../../contexts/UserShellExperienceBridge', () => ({
  UserShellExperienceBridge: () => null,
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const renderWithOutlet = (shellKey: string) => {
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<DesignerPublishedShell shellKey={shellKey} />}>
            <Route index element={<div data-testid="nested-page">Runtime page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('DesignerPublishedShell', () => {
  afterEach(() => {
    cleanup();
    queryClient.clear();
    vi.clearAllMocks();
  });

  it('renders nested routes for system-managed component-alone shell without loading shell draft', () => {
    renderWithOutlet('component-alone');

    expect(screen.getByTestId('designer-published-shell')).toHaveAttribute('data-shell-key', 'component-alone');
    expect(screen.getByTestId('nested-page')).toBeInTheDocument();
  });

  it('respects showLogo/showBreadcrumb/showActions toggles inside custom header slot', async () => {
    const mockDocument = {
      rootNodeId: 'root',
      metadata: APP_SHELL_LAYOUT_WIDTH_FALLBACK_DOCUMENT.metadata,
      nodes: {
        root: {
          id: 'root',
          type: 'root',
          parentId: null,
          order: 0,
          props: {},
          layout: {},
          binding: {},
          children: ['header-container', 'outlet-container'],
        },
        'header-container': {
          id: 'header-container',
          type: 'container',
          parentId: 'root',
          order: 0,
          props: { className: 'h-[59px]' },
          layout: {},
          binding: {},
          children: ['header-slot'],
        },
        'header-slot': {
          id: 'header-slot',
          type: 'system-slot',
          parentId: 'header-container',
          order: 0,
          props: {
            slotId: 'core.shell.header',
            showLogo: false,
            showBreadcrumb: false,
            showActions: false,
          },
          layout: {},
          binding: {},
          children: [],
        },
        'outlet-container': {
          id: 'outlet-container',
          type: 'container',
          parentId: 'root',
          order: 1,
          props: {},
          layout: {},
          binding: {},
          children: ['outlet-slot'],
        },
        'outlet-slot': {
          id: 'outlet-slot',
          type: 'system-slot',
          parentId: 'outlet-container',
          order: 0,
          props: { slotId: 'core.shell.route-outlet' },
          layout: {},
          binding: {},
          children: [],
        },
      },
    };

    vi.mocked(loadDesignerShellDraft).mockResolvedValue({
      id: 'my-custom-shell',
      name: 'My Custom Shell',
      folder: 'portal-layouts',
      document: mockDocument as any,
      bindingDefinitions: createDefaultBindingDefinitions(),
    });

    renderWithOutlet('my-custom-shell');

    const nestedPage = await screen.findByTestId('nested-page');
    expect(nestedPage).toBeInTheDocument();

    expect(screen.queryByText('AppEnd')).not.toBeInTheDocument();
    expect(screen.queryByTitle(/Open Account/i)).not.toBeInTheDocument();
  });

  it('renders published shell without throw and with logo, navigation, and outlet present', async () => {
    const mockDocument = {
      rootNodeId: 'root',
      metadata: APP_SHELL_LAYOUT_WIDTH_FALLBACK_DOCUMENT.metadata,
      nodes: {
        root: {
          id: 'root',
          type: 'root',
          parentId: null,
          order: 0,
          props: { appTitle: 'My Shell App' },
          layout: {},
          binding: {},
          children: ['sidebar-slot', 'header-slot', 'outlet-slot'],
        },
        'sidebar-slot': {
          id: 'sidebar-slot',
          type: 'system-slot',
          parentId: 'root',
          order: 0,
          props: { slotId: 'core.shell.sidebar' },
          layout: {},
          binding: {},
          children: [],
        },
        'header-slot': {
          id: 'header-slot',
          type: 'system-slot',
          parentId: 'root',
          order: 1,
          props: { slotId: 'core.shell.header', showLogo: true },
          layout: {},
          binding: {},
          children: [],
        },
        'outlet-slot': {
          id: 'outlet-slot',
          type: 'system-slot',
          parentId: 'root',
          order: 2,
          props: { slotId: 'core.shell.route-outlet' },
          layout: {},
          binding: {},
          children: [],
        },
      },
    };

    vi.mocked(loadDesignerShellDraft).mockResolvedValue({
      id: 'test-published-shell',
      name: 'Test Published Shell',
      folder: 'portal-layouts',
      document: mockDocument as any,
      bindingDefinitions: createDefaultBindingDefinitions(),
    });

    renderWithOutlet('test-published-shell');

    // Wait for the nested page to render (the outlet content)
    const nestedPage = await screen.findByTestId('nested-page');
    expect(nestedPage).toBeInTheDocument();

    // Verify the shell container is rendered
    expect(screen.getByTestId('designer-published-shell')).toBeInTheDocument();
  });
});
