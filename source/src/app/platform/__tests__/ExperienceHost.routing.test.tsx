// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { cleanup, render, screen, waitFor } from '@testing-library/react';

import '@testing-library/jest-dom/vitest';

import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { bootstrapCultureRegistry } from '../../../core/culture/CultureRegistry';

import type { PlatformRuntimeConfig } from '../../../shared/api/contracts/platform/types';



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

vi.mock('../PackagePageModule', () => ({
  PackagePageModule: ({ loaderRef }: { loaderRef: string }) => (
    <div data-testid={loaderRef.replace(':', '-')}>{loaderRef}</div>
  ),
}));

vi.mock('../DynamicOutlet', () => ({
  DynamicOutlet: ({ binding }: { binding: { pageKey: string } }) => (
    <div data-testid={`page-${binding.pageKey}`}>{binding.pageKey}</div>
  ),
  MountRouteFallback: () => <div data-testid="mount-route-fallback">fallback</div>,
}));

vi.mock('../../routes/LazyRoute', () => ({
  LazyRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../routes/lazyPages', () => {
  const Stub = () => null;
  return {
    DashboardPage: Stub,
    UsersPage: Stub,
    SettingsPage: Stub,
    BaseInfoPage: Stub,
    ChatHistoryPage: Stub,
    MyApisPage: Stub,
    ServerFunctionsPage: Stub,
    ComponentDesignerPage: () => <div data-testid="component-designer-page">Designer workspace</div>,
    LogsPage: Stub,
    RecordEventsPage: Stub,
    PlatformPortalsPage: Stub,
    PlatformNavigationsPage: Stub,
    PackageManagerPage: Stub,
    LibrariesPage: Stub,
    RolesPage: Stub,
    DataStudioPage: Stub,
    DataSourcesPage: Stub,
    SqlConsolePage: Stub,
    WorkbooksPage: Stub,
    MyWorkbooksPage: Stub,
    SharedWorkbookPage: Stub,
    DashboardSnapshotPage: Stub,
    IdeaFoundryPage: Stub,
    ApiTalkPage: Stub,
    FileManagerPage: Stub,
    WorkflowsPage: Stub,
    MyInboxPage: Stub,
    MyFeedbackPage: Stub,
    FeedbackInboxPage: Stub,
    CachePage: Stub,
    ScheduledTasksPage: Stub,
    JobsPage: Stub,
    GitPage: Stub,
    BaseComponentsPage: Stub,
    DevReferencePage: Stub,
    PlatformTransferPage: Stub,
    AppearancePage: Stub,
    OrganizationChartPage: Stub,
    GeographicDivisionsPage: Stub,
  };
});



vi.mock('../../../layouts/DesignerShell', () => {
  const { Outlet } = require('react-router-dom');
  return {
    DesignerShell: () => (
      <div data-testid="designer-shell" className="designer-shell">
        <Outlet />
      </div>
    ),
  };
});

vi.mock('../DesignerPublishedPage', () => ({
  DesignerPublishedPage: () => <div data-testid="designer-published-page">Designer page</div>,
}));

vi.mock('../../../domain/component-designer/designerRuntimePreview', () => ({
  DesignerDocumentPreview: () => <div data-testid="designer-document-preview">Shell preview</div>,
  renderDesignerDocumentPreview: () => <div data-testid="designer-document-preview">Shell preview</div>,
}));

vi.mock('../DesignerPublishedShell', () => {
  const { Outlet } = require('react-router-dom');
  return {
    createDesignerPublishedShellComponent: (shellKey: string) => {
      const Shell: React.FC = () => (
        <div data-testid="designer-published-shell" data-shell-key={shellKey}>
          <Outlet />
        </div>
      );
      return Shell;
    },
  };
});



const studioRuntimeConfig: PlatformRuntimeConfig = {

  version: 'seed-v1',

  mounts: [

    {

      id: 'studio',

      pathPrefix: '/studio',

      name: 'Studio',

      enabled: true,

      defaultRoute: '/studio',

      designerRoutePropagation: 'none',

      authProfile: { requireAuth: true },

    },

  ],

  shells: [

    {

      shellKey: 'home-shell',

      name: 'Home Redirect',

      entry: '',

      surface: 'home',

      enabled: true,

      entryMode: 'redirect',

      redirectToSegment: 'studio',

      redirectToCulture: 'us',

    },

    {

      shellKey: 'studio',

      name: 'Studio',

      entry: 'core:AdminLayout',

      surface: 'studio',

      enabled: true,

    },

    {

      shellKey: 'designer',

      name: 'Designer Shell',

      entry: 'core:DesignerShell',

      surface: 'designer',

      enabled: true,

    },

  ],

  shellRules: [

    {

      id: 1,

      mountId: 'studio',

      pathPrefix: '/studio/client-components',

      shellKey: 'designer',

      priority: 10,

      enabled: false,

    },

  ],

  pageModules: [

    {

      pageKey: 'client-components',

      title: 'Client Components',

      loaderKind: 'core',

      loaderRef: 'core:ComponentDesigner',

      defaultRoles: ['ADMIN'],

      enabled: true,

    },

  ],

  bindings: [

    {

      id: 1,

      mountId: 'studio',

      routePattern: 'client-components',

      pageKey: 'client-components',

      enabled: true,

      auth: { accessMode: 'specific', allowRoles: ['ADMIN'], allowUsers: [], denyRoles: [], denyUsers: [] },

    },

  ],

  navigations: [],

};



import { ExperienceHost } from '../ExperienceHost';



import { usePlatformConfig } from '../PlatformConfigProvider';



const mockedUsePlatformConfig = vi.mocked(usePlatformConfig);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const renderExperienceAt = (initialPath: string, mountId: string) => {

  mockedUsePlatformConfig.mockReturnValue({

    config: studioRuntimeConfig,

    version: studioRuntimeConfig.version,

    refetch: async () => undefined,

  });



  return render(

    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>

        <Routes>

          <Route path="/studio/*" element={<ExperienceHost mountId={mountId} />} />

        </Routes>

      </MemoryRouter>
    </QueryClientProvider>,

  );

};



describe('ExperienceHost routing', () => {

  afterEach(() => {
    cleanup();
    bootstrapCultureRegistry(['us', 'ir', 'iq']);
  });

  it('redirects bare /studio/client-components to canonical AdminLayout route', async () => {
    bootstrapCultureRegistry(['us']);

    mockedUsePlatformConfig.mockReturnValue({
      config: studioRuntimeConfig,
      version: studioRuntimeConfig.version,
      refetch: async () => undefined,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/studio/client-components']}>
          <Routes>
            <Route path="/studio/*" element={<ExperienceHost mountId="studio" />} />
            <Route path="/us/*" element={<ExperienceHost mountId="us" />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('admin-shell')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('designer-shell')).toBeNull();
  });

  it('redirects legacy /studio/users to canonical /us/studio/users', async () => {
    bootstrapCultureRegistry(['us']);

    mockedUsePlatformConfig.mockReturnValue({
      config: studioRuntimeConfig,
      version: studioRuntimeConfig.version,
      refetch: async () => undefined,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/studio/users']}>
          <Routes>
            <Route path="/studio/*" element={<ExperienceHost mountId="studio" />} />
            <Route path="/us/*" element={<ExperienceHost mountId="us" />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('admin-shell')).toBeInTheDocument();
    });
  });

  it('renders AdminLayout and page at canonical /us/studio/client-components', async () => {

    bootstrapCultureRegistry(['us']);



    mockedUsePlatformConfig.mockReturnValue({

      config: studioRuntimeConfig,

      version: studioRuntimeConfig.version,

      refetch: async () => undefined,

    });



    render(

      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/us/studio/client-components']}>

          <Routes>

            <Route path="/us/*" element={<ExperienceHost mountId="us" />} />

          </Routes>

        </MemoryRouter>
      </QueryClientProvider>,

    );



    await waitFor(() => {

      expect(screen.getByTestId('page-client-components')).toBeInTheDocument();

    });



    expect(screen.getByTestId('admin-shell')).toBeInTheDocument();
    expect(screen.queryByTestId('designer-shell')).not.toBeInTheDocument();
  });



  it('resolves culture from URL pathname instead of mount.cultureId', async () => {

    bootstrapCultureRegistry(['ir', 'us']);



    mockedUsePlatformConfig.mockReturnValue({

      config: studioRuntimeConfig,

      version: studioRuntimeConfig.version,

      refetch: async () => undefined,

    });



    render(

      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/ir/studio/client-components']}>

          <Routes>

            <Route path="/ir/*" element={<ExperienceHost mountId="ir" />} />

          </Routes>

        </MemoryRouter>
      </QueryClientProvider>,

    );



    await waitFor(() => {

      expect(document.documentElement.getAttribute('dir')).toBe('rtl');

    });

  });

  it('renders designer published page for component-alone canonical URL', async () => {
    bootstrapCultureRegistry(['us']);

    const configWithComponentAlone: PlatformRuntimeConfig = {
      ...studioRuntimeConfig,
      shells: [
        ...studioRuntimeConfig.shells,
        {
          shellKey: 'component-alone',
          name: 'Component Alone',
          entry: 'core:ComponentAlone',
          surface: 'studio',
          enabled: true,
        },
      ],
      pageModules: [
        ...studioRuntimeConfig.pageModules,
        {
          pageKey: 'my-widget',
          title: 'My Widget',
          loaderKind: 'designer',
          loaderRef: 'general/my-widget',
          enabled: true,
          source: 'auto',
        },
      ],
    };

    mockedUsePlatformConfig.mockReturnValue({
      config: configWithComponentAlone,
      version: configWithComponentAlone.version,
      refetch: async () => undefined,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/us/component-alone/general/my-widget']}>
          <Routes>
            <Route path="/us/*" element={<ExperienceHost mountId="us" />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('component-alone-layout')).toBeInTheDocument();
      expect(screen.getByTestId('page-my-widget')).toBeInTheDocument();
    });
  });

  it('renders public CMS pages inside the home SiteLayout', async () => {
    bootstrapCultureRegistry(['us']);

    const publicHomeConfig: PlatformRuntimeConfig = {
      ...studioRuntimeConfig,
      shells: studioRuntimeConfig.shells.map((shell) => (
        shell.shellKey === 'home-shell'
          ? {
              ...shell,
              entry: 'designer:portal-layouts/site-shell',
              entryMode: 'shell',
              redirectToSegment: undefined,
              redirectToCulture: undefined,
            }
          : shell
      )),
      pageModules: [
        ...studioRuntimeConfig.pageModules,
        {
          pageKey: 'cms-site-article',
          title: 'Site Stories',
          loaderKind: 'package',
          loaderRef: 'cms:cms-site-article',
          enabled: true,
        },
      ],
    };

    mockedUsePlatformConfig.mockReturnValue({
      config: publicHomeConfig,
      version: publicHomeConfig.version,
      refetch: async () => undefined,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/us/about']}>
          <Routes>
            <Route path="/us/*" element={<ExperienceHost mountId="us" />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('cms-cms-site-article')).toBeInTheDocument();
    });

    expect(screen.getByTestId('designer-published-shell')).toHaveAttribute('data-shell-key', 'site-shell');
    expect(screen.queryByTestId('admin-shell')).not.toBeInTheDocument();
  });

});


