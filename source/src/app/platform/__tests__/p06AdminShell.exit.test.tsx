// @vitest-environment jsdom
/**
 * p-06 exit criteria — Admin Shell redesign (6.1–6.4).
 * Surface tokens · registry nav · /studio/* regression · dashboard slot host · integrated layout.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import {
  loadPlatformRegistryDefaultMounts,
  loadPlatformRegistryDefaultPageModules,
  loadPlatformRegistryDefaultRouteBindings,
  loadPlatformRegistryDefaultShellRules,
  loadPlatformRegistryDefaultShells,
} from '../../../core/platform-registry/loadPlatformRegistryDefaults';
import { slotRegistry } from '../../../core/slots/SlotRegistry';
import { DashboardWorkspace } from '../../../features/dashboard/components/DashboardWorkspace';
import { CultureProvider } from '../CultureContext';
import { CORE_SLOT_CATALOG } from '../../../shared/api/contracts/slots/catalog';
import type { PlatformRuntimeConfig } from '../../../shared/api/contracts/platform/types';
import {
  ADMIN_SHELL_CONTENT_HOST_CLASS,
  ADMIN_SHELL_CONTENT_WRAPPER_CLASS,
  ADMIN_SHELL_HEADER_CLASS,
  ADMIN_SHELL_MAIN_CLASS,
  ADMIN_SHELL_ROOT_CLASS,
  ADMIN_SHELL_SIDEBAR_CLASS,
} from '../../../shared/ui/surfaceClasses';
import {
  buildAdminShellNav,
  findAdminShellNavItemByPath,
  flattenAdminShellNavItems,
} from '../../../layouts/adminShell/buildAdminShellNav';
import {
  buildBindingNavAbsolutePath,
  buildMountAbsolutePath,
  getPageModuleByKey,
  resolveRouteBindingForRelativePath,
  resolveShellRuleForPath,
} from '../platformConfigHelpers';
import { resolvePageModule, resolveShellComponent } from '../resolvers';
import { AdminLayout } from '../../../layouts/AdminLayout';
import { PlatformMountProvider } from '../PlatformMountContext';
import { usePlatformConfig } from '../PlatformConfigProvider';
import { useAuth } from '../../../contexts/AuthContext';
import { useClientContext } from '../../../contexts/ClientContextContext';
import { useCurrentUserDisplay } from '../../../hooks/useCurrentUserDisplay';

const STUDIO_MOUNT_PREFIX = '/studio';
const mockedUsePlatformConfig = vi.mocked(usePlatformConfig);
const mockedUseAuth = vi.mocked(useAuth);
const mockedUseClientContext = vi.mocked(useClientContext);
const mockedUseCurrentUserDisplay = vi.mocked(useCurrentUserDisplay);
const P06_TEST_PLUGIN_ID = 'p06-exit-test-widget';

vi.mock('../../../features/dashboard/hooks/useMyInboxWidget', () => ({
  useMyInboxWidget: () => ({
    items: [],
    assignedCount: 0,
    claimedCount: 0,
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('../../../features/dashboard/components/DashboardMyLinks', () => ({
  DashboardMyLinks: () => null,
}));

vi.mock('../../../features/dashboard/components/DashboardMyShortcuts', () => ({
  DashboardMyShortcuts: () => null,
}));

vi.mock('../PlatformConfigProvider', () => ({
  usePlatformConfig: vi.fn(),
  useOptionalPlatformConfig: vi.fn(() => null),
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../contexts/ClientContextContext', () => ({
  useClientContext: vi.fn(),
}));

vi.mock('../../../features/feedback/hooks/useFeedbackPolicy', () => ({
  useFeedbackPolicy: vi.fn(() => ({
    showOnDashboard: false,
  })),
}));

vi.mock('../../../hooks/useCurrentUserDisplay', () => ({
  useCurrentUserDisplay: vi.fn(),
}));

vi.mock('../../../hooks/useProfileAccount', () => ({
  useProfileAccount: () => ({
    canChangePassword: false,
    canDeleteAccount: false,
    isDeletePending: false,
  }),
}));

vi.mock('../../../shared/lib/aiPageContextStore', () => ({
  useAiPageContextEnrichment: () => null,
}));

vi.mock('../../../components/AppEndooPanel', () => ({
  AppEndooPanel: () => null,
}));

vi.mock('../../../shared/ui/shell/ShellAppEndooControl', () => ({
  ShellAppEndooControl: () => null,
}));

vi.mock('../../../components/ProfileDrawer', () => ({
  ProfileDrawer: () => null,
}));

vi.mock('../../../components/AboutAppModal', () => ({
  AboutAppModal: () => null,
}));

vi.mock('../../../components/AccentColorPicker', () => ({
  AccentColorPicker: () => null,
}));

vi.mock('../../../shared/api/queries/platform', () => ({
  useExperienceManifestQuery: () => ({
    data: {
      id: 'admin',
      cultureId: 'us',
      portals: [
        {
          segment: 'studio',
          name: 'Studio',
          shellKey: 'studio',
          enabled: true,
          routes: [],
        },
      ],
    },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('../../../components/AppEndLogo', () => ({
  APPENDO_LOGO_SRC: '/assets/appendo/brand/transparent/appendo-wordmark-currentColor.svg',
  APPENDO_LOGO_ONLY_SRC: '/assets/appendo/brand/transparent/appendo-mark-currentColor.svg',
  AppEndLogo: () => <div data-testid="p06-logo" />,
}));

vi.mock('../../../core/packages/PackageSlotRegistryHost', () => ({
  PackageSlotRegistryHost: () => null,
}));

vi.mock('../../../features/dashboard/hooks/useDashboardPage', () => ({
  useDashboardPage: () => ({
    isAdmin: true,
    displayName: 'Admin',
    primaryRole: 'ADMIN',
    isLoadingAdminData: false,
    kpiCards: [],
    agentStats: {
      runsLast24h: 0,
      toolCallsLast24h: 0,
      tokensEstimateLast24h: 0,
      appliesLast24h: 0,
      applyRatePercent: null,
    },
    aiEnabled: false,
    healthRows: [],
    insightLinks: [],
    quickActions: [],
    myLinks: [],
    lastUpdatedTimestamp: Date.now(),
    dashboardPollMs: 60_000,
    lastUpdated: '12:00:00',
    countdownProgress: 0,
  }),
}));

function buildStudioExitRuntimeConfig(): PlatformRuntimeConfig {
  return {
    version: 'p06-exit-v1',
    mounts: loadPlatformRegistryDefaultMounts().filter((mount) => mount.id === 'studio'),
    shells: loadPlatformRegistryDefaultShells(),
    shellRules: loadPlatformRegistryDefaultShellRules().filter((rule) => rule.mountId === 'studio'),
    pageModules: loadPlatformRegistryDefaultPageModules(),
    bindings: loadPlatformRegistryDefaultRouteBindings().filter((binding) => binding.mountId === 'studio'),
    navigations: [],
  };
}

function renderAdminLayoutAt(path: string) {
  const config = buildStudioExitRuntimeConfig();

  mockedUsePlatformConfig.mockReturnValue({
    config,
    version: config.version,
    refetch: async () => undefined,
  });
  mockedUseAuth.mockReturnValue({
    isAuthenticated: true,
    isLoading: false,
    currentUser: { id: 1, email: 'admin@append.os', role: 'ADMIN', roles: ['ADMIN'] },
    login: vi.fn(),
    loginAs: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    refreshSession: vi.fn(),
  });
  mockedUseCurrentUserDisplay.mockReturnValue({
    currentUser: { id: 1, email: 'admin@append.os', role: 'ADMIN', roles: ['ADMIN'] },
    profile: null,
    displayName: 'Admin User',
    avatarXs: '',
    avatarFull: '',
    avatarInitial: 'A',
    primaryRole: 'ADMIN',
    roles: ['ADMIN'],
  });
  mockedUseClientContext.mockReturnValue({
    clientContext: {},
    patchClientContext: vi.fn(),
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <CultureProvider cultureId="us">
          <PlatformMountProvider mount={config.mounts[0]!}>
            <Routes>
              <Route path="/studio" element={<AdminLayout />}>
                <Route index element={<div data-testid="p06-page-outlet">Dashboard page</div>} />
                <Route path="git" element={<div data-testid="p06-page-outlet">Git page</div>} />
              </Route>
            </Routes>
          </PlatformMountProvider>
        </CultureProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('p-06 admin shell exit criteria', () => {
  afterEach(() => {
    cleanup();
    slotRegistry.unregisterByPackage(P06_TEST_PLUGIN_ID);
  });

  it('exposes continuous admin shell surface tokens (6.1)', () => {
    const sharedSurface = ['admin-shell-surface'];

    for (const token of [
      ADMIN_SHELL_ROOT_CLASS,
      ADMIN_SHELL_SIDEBAR_CLASS,
      ADMIN_SHELL_MAIN_CLASS,
      ADMIN_SHELL_HEADER_CLASS,
    ]) {
      for (const part of sharedSurface) {
        expect(token).toContain(part);
      }
    }

    expect(ADMIN_SHELL_ROOT_CLASS).toContain('shell-atmosphere');
    expect(ADMIN_SHELL_SIDEBAR_CLASS).toContain('admin-shell-chrome');
    expect(ADMIN_SHELL_MAIN_CLASS).toContain('admin-shell-chrome');
    expect(ADMIN_SHELL_HEADER_CLASS).toContain('admin-shell-chrome');
    expect(ADMIN_SHELL_HEADER_CLASS).not.toContain('border-b');
    expect(ADMIN_SHELL_HEADER_CLASS).not.toContain('header-line-pattern');
    expect(ADMIN_SHELL_HEADER_CLASS).not.toContain('menu-line-pattern');
    expect(ADMIN_SHELL_SIDEBAR_CLASS).not.toContain('menu-line-pattern');
    expect(ADMIN_SHELL_SIDEBAR_CLASS).not.toContain('header-line-pattern');
    expect(ADMIN_SHELL_CONTENT_WRAPPER_CLASS).not.toMatch(/\bmr-|mb-/);
    expect(ADMIN_SHELL_CONTENT_HOST_CLASS).toContain('bg-white');
    expect(ADMIN_SHELL_CONTENT_HOST_CLASS).toContain('border-t');
    expect(ADMIN_SHELL_CONTENT_HOST_CLASS).toContain('shadow-content-host');
    expect(ADMIN_SHELL_CONTENT_HOST_CLASS).toContain('border-shell-content-border');
    expect(ADMIN_SHELL_CONTENT_HOST_CLASS).not.toContain('border-e');
  });

  it('builds registry-driven navigation for studio defaults (6.2)', () => {
    const config = buildStudioExitRuntimeConfig();
    const groups = buildAdminShellNav({
      config,
      mountId: 'studio',
      mountPathPrefix: STUDIO_MOUNT_PREFIX,
      currentUser: { roles: ['ADMIN'] },
    });

    const navPaths = flattenAdminShellNavItems(groups)
      .filter((item) => item.type !== 'separator' && item.path)
      .map((item) => item.path as string);

    const expectedPaths = config.bindings
      .filter((binding) => binding.nav)
      .map((binding) => buildBindingNavAbsolutePath(STUDIO_MOUNT_PREFIX, binding));

    for (const path of expectedPaths) {
      expect(navPaths).toContain(path);
    }

    expect(findAdminShellNavItemByPath(groups, '/studio')?.label).toBe('Home');
    expect(findAdminShellNavItemByPath(groups, '/studio/git')?.label).toBe('Git');
    expect(findAdminShellNavItemByPath(groups, '/studio/settings')?.description).toBeTruthy();
  });

  it('filters studio nav bindings for non-admin users', () => {
    const config = buildStudioExitRuntimeConfig();
    const groups = buildAdminShellNav({
      config,
      mountId: 'studio',
      mountPathPrefix: STUDIO_MOUNT_PREFIX,
      currentUser: { roles: ['USER'] },
    });

    const labels = flattenAdminShellNavItems(groups)
      .filter((item) => item.type !== 'separator')
      .map((item) => item.label);

    expect(labels).toContain('Home');
    expect(labels).toContain('Base Info');
    expect(labels).not.toContain('My APIs');
    expect(labels).not.toContain('Users');
    expect(labels).not.toContain('Server Functions');
  });

  it('resolves every studio default route to a core page module (studio regression)', () => {
    const config = buildStudioExitRuntimeConfig();

    for (const binding of config.bindings.filter((entry) => entry.enabled)) {
      const resolvedBinding = resolveRouteBindingForRelativePath(config, 'studio', binding.routePattern);
      const pageModule = getPageModuleByKey(config, resolvedBinding?.pageKey ?? '');
      const resolved = resolvePageModule(pageModule?.loaderRef ?? '');

      expect(resolvedBinding?.pageKey).toBe(binding.pageKey);
      expect(pageModule?.loaderRef).toBeTruthy();
      if (pageModule?.loaderKind === 'designer') {
        continue;
      }
      expect(resolved?.component).toBeTruthy();
    }
  });

  it('keeps disabled designer shell rule out of runtime resolution', () => {
    const config = buildStudioExitRuntimeConfig();

    expect(resolveShellRuleForPath(config, 'studio', '/studio/client-components')).toBeUndefined();
    expect(resolveShellRuleForPath(config, 'studio', '/studio/users')).toBeUndefined();

    expect(resolveShellComponent('core:AdminLayout')).toBeTruthy();
    expect(config.shellRules.some((rule) => rule.shellKey === 'designer')).toBe(true);
  });

  it('keeps core.dashboard.widgets in slot catalog', () => {
    const catalogEntry = CORE_SLOT_CATALOG.find((entry) => entry.id === 'core.dashboard.widgets');
    expect(catalogEntry).toBeDefined();
    expect(catalogEntry?.surface).toBe('portal');
    expect(resolvePageModule('core:Dashboard')?.component).toBeTruthy();
  });

  it('renders integrated admin shell layout with surface tokens on DOM (6.4 layout + surface)', () => {
    const { container } = renderAdminLayoutAt('/studio');

    const root = container.querySelector('[data-admin-shell-root]');
    expect(root).toBeTruthy();
    expect(root).toHaveClass('admin-shell-surface', 'shell-atmosphere', 'h-screen');

    const aside = container.querySelector('aside');
    const main = container.querySelector('main');
    const header = container.querySelector('header');
    const contentHost = container.querySelector('.shadow-content-host');

    expect(aside).toHaveClass('admin-shell-surface', 'admin-shell-chrome');
    expect(main).toHaveClass('admin-shell-surface', 'admin-shell-chrome');
    expect(header).toHaveClass('admin-shell-surface', 'admin-shell-chrome');
    expect(contentHost).toHaveClass('bg-white', 'border-shell-content-border');
    expect(document.querySelector('.designer-shell')).toBeNull();
  });

  it('renders registry-driven sidebar navigation and header for active route (6.4 navigation)', () => {
    const { container } = renderAdminLayoutAt('/studio/git');
    const aside = container.querySelector('aside');
    expect(aside).toBeTruthy();

    expect(within(aside!).getByText('Home')).toBeInTheDocument();
    expect(within(aside!).getAllByText('Git').length).toBeGreaterThan(0);
    const header = container.querySelector('header');
    expect(header).toBeTruthy();
    expect(within(header!).getAllByText(/Git/).length).toBeGreaterThan(0);
  });

  it('renders routed page content inside the content host without designer regression (6.4)', () => {
    renderAdminLayoutAt('/studio/git');

    const outlet = screen.getByTestId('p06-page-outlet');
    expect(outlet).toHaveTextContent('Git page');
    expect(outlet.closest('.shadow-content-host')).toBeTruthy();
    expect(document.querySelector('.designer-shell')).toBeNull();
  });
});
