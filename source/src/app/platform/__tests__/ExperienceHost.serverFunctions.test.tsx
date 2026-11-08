// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { bootstrapCultureRegistry } from '../../../core/culture/CultureRegistry';
import {
  loadPlatformRegistryDefaultMounts,
  loadPlatformRegistryDefaultNavigations,
  loadPlatformRegistryDefaultPageModules,
  loadPlatformRegistryDefaultRouteBindings,
  loadPlatformRegistryDefaultShellRules,
  loadPlatformRegistryDefaultShells,
} from '../../../core/platform-registry/loadPlatformRegistryDefaults';
import type { PlatformRuntimeConfig } from '../../../shared/api/contracts/platform/types';
import { ExperienceHost } from '../ExperienceHost';
import { usePlatformConfig } from '../PlatformConfigProvider';

vi.mock('../PlatformConfigProvider', () => ({
  usePlatformConfig: vi.fn(),
  useOptionalPlatformConfig: vi.fn(() => null),
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: true,
    isLoading: false,
    currentUser: { id: 1, email: 'admin@append.os', role: 'ADMIN', roles: ['ADMIN'] },
  })),
}));

vi.mock('../../../components/AppEndooPanel', () => ({
  AppEndooPanel: () => null,
}));

vi.mock('../../../layouts/AdminLayout', () => {
  const { Outlet } = require('react-router-dom');
  return {
    AdminLayout: () => (
      <div data-testid="admin-shell">
        <Outlet />
      </div>
    ),
  };
});

vi.mock('../MountAuthGate', () => ({
  MountAuthGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../routes/LazyRoute', () => ({
  LazyRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../routes/lazyPages', () => ({
  DashboardPage: () => null,
  UsersPage: () => null,
  SettingsPage: () => null,
  BaseInfoPage: () => null,
  ChatHistoryPage: () => null,
  MyApisPage: () => null,
  ServerFunctionsPage: () => <div data-testid="server-functions-page">Server Functions workspace</div>,
  ComponentDesignerPage: () => null,
  LogsPage: () => null,
  RecordEventsPage: () => null,
  WorkbooksPage: () => null,
  MyWorkbooksPage: () => null,
  SharedWorkbookPage: () => null,
  DashboardSnapshotPage: () => null,
  IdeaFoundryPage: () => null,
  PlatformPortalsPage: () => null,
  PlatformNavigationsPage: () => null,
  PlatformTransferPage: () => null,
  PackageManagerPage: () => null,
  LibrariesPage: () => null,
  RolesPage: () => null,
  DataStudioPage: () => null,
  DataSourcesPage: () => null,
  FileManagerPage: () => null,
  WorkflowsPage: () => null,
  MyInboxPage: () => null,
  MyFeedbackPage: () => null,
  FeedbackInboxPage: () => null,
  CachePage: () => null,
  ScheduledTasksPage: () => null,
  JobsPage: () => null,
  GitPage: () => null,
  BaseComponentsPage: () => null,
  DevReferencePage: () => null,
  AppearancePage: () => null,
  SqlConsolePage: () => null,
  ApiTalkPage: () => null,
  OrganizationChartPage: () => null,
  GeographicDivisionsPage: () => null,
}));

const mockedUsePlatformConfig = vi.mocked(usePlatformConfig);
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const renderHost = (path: string) => render(
  <QueryClientProvider client={queryClient}>
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/us/*" element={<ExperienceHost mountId="us" />} />
      </Routes>
    </MemoryRouter>
  </QueryClientProvider>,
);

function buildRuntimeConfig(): PlatformRuntimeConfig {
  return {
    version: 'server-functions-routing-v1',
    mounts: loadPlatformRegistryDefaultMounts(),
    shells: loadPlatformRegistryDefaultShells(),
    shellRules: loadPlatformRegistryDefaultShellRules(),
    pageModules: loadPlatformRegistryDefaultPageModules(),
    bindings: loadPlatformRegistryDefaultRouteBindings(),
    navigations: loadPlatformRegistryDefaultNavigations(),
  };
}

describe('ExperienceHost server-functions routing', () => {
  afterEach(() => {
    cleanup();
    bootstrapCultureRegistry(['us', 'ir', 'iq']);
  });

  it('renders server-functions at canonical /us/studio/server-functions', async () => {
    const config = buildRuntimeConfig();
    mockedUsePlatformConfig.mockReturnValue({
      config,
      version: config.version,
      refetch: async () => undefined,
    });

    bootstrapCultureRegistry(['us']);

    renderHost('/us/studio/server-functions');

    await waitFor(() => {
      expect(screen.getByTestId('server-functions-page')).toBeInTheDocument();
    });
    expect(screen.getByTestId('admin-shell')).toBeInTheDocument();
  });

  it('renders server-functions edit deep links under server-functions/*', async () => {
    const config = buildRuntimeConfig();
    mockedUsePlatformConfig.mockReturnValue({
      config,
      version: config.version,
      refetch: async () => undefined,
    });

    bootstrapCultureRegistry(['us']);

    renderHost('/us/studio/server-functions/auth/login');

    await waitFor(() => {
      expect(screen.getByTestId('server-functions-page')).toBeInTheDocument();
    });
  });

  it('redirects legacy /us/studio/edge to server-functions page', async () => {
    const config = buildRuntimeConfig();
    mockedUsePlatformConfig.mockReturnValue({
      config,
      version: config.version,
      refetch: async () => undefined,
    });

    bootstrapCultureRegistry(['us']);

    renderHost('/us/studio/edge');

    await waitFor(() => {
      expect(screen.getByTestId('server-functions-page')).toBeInTheDocument();
    });
  });
});
